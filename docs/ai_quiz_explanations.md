# AI Quiz Explanation Feature

This document describes the server and client changes that power the new “Why was this wrong?” explanations shown after a student completes an AI-generated quiz. It is meant to help reviewers understand the architecture, API contract, and data flow before merging the feature.

---

## 1. Architectural Overview

| Layer | Responsibilities | Key Modules |
| ----- | ---------------- | ----------- |
| Backend API | Authenticated endpoint that accepts quiz question context, orchestrates prompt construction, calls the LLM provider, and returns a concise explanation. | `backend/app/api/v1/quizzes.py`, `backend/app/services/quiz_explanation.py`, `backend/app/schemas/quiz.py`, `backend/app/core/config.py` |
| Frontend UI | Enables the “Why was this wrong?” button on incorrect answers, loads document context once, requests explanations on demand, caches responses per question, and renders accordion-style explanations with loading/error states. | `frontend/src/components/documents/DocumentQuizModal.tsx`, `frontend/src/services/quizzes.ts`, `frontend/src/services/documents.ts`, `frontend/src/types/index.ts` |
| Shared Types | Defines request/response schemas consumed on both sides of the stack to ensure the payload is structured consistently. | `backend/app/schemas/quiz.py`, `frontend/src/types/index.ts` |

High-level flow:

1. User completes a quiz, sees results in `DocumentQuizModal` and clicks **Why was this wrong?**.
2. The modal lazily fetches document chunks (if not already cached), builds the explanation payload, and invokes the quizzes API helper.
3. `POST /api/v1/quizzes/questions/explain-error` validates the payload, renders the LLM prompt, calls OpenAI via the service layer, and returns the explanation text.
4. The UI stores the explanation in component state. Subsequent toggles read from cache without extra network calls.

---

## 2. Backend Implementation Details

### 2.1 API Surface

```http
POST /api/v1/quizzes/questions/explain-error
Authorization: Bearer <access token>
Content-Type: application/json
```

Payload schema (`QuestionExplanationRequest`):

```json
{
  "documentContext": "<excerpt used as the answer source>",
  "questionText": "<quiz prompt>",
  "userSelectedAnswer": "<student's incorrect option text>",
  "correctAnswer": "<correct option text>"
}
```

Response (`QuestionExplanationResponse`):

```json
{
  "explanation": "<supportive, concise explanation>"
}
```

### 2.2 Router and Service Wiring

- `backend/app/api/v1/quizzes.py`
  - Registers the `/questions/explain-error` endpoint.
  - Requires an active user through `get_current_active_user`.
  - Instantiates `QuizExplanationService`, delegates to `explain_answer`, and normalizes error handling (HTTP 400 on validation or provider failures).

- `backend/app/api/router.py`
  - Adds `quizzes.router` under `/api/v1/quizzes`.

### 2.3 Service Layer

`backend/app/services/quiz_explanation.py` encapsulates interaction with OpenAI:

- Accepts configuration overrides but defaults to the new settings block (`QUIZ_EXPLANATION_MODEL`, `QUIZ_EXPLANATION_TEMPERATURE`, `QUIZ_EXPLANATION_MAX_TOKENS`).
- Validates that `document_context` is present (the LLM is worthless without source text).
- Builds a deterministic prompt using the specification provided in the feature brief. The prompt enforces tone, structure, brevity, and ensures no extra preamble leaks into the response.
- Calls `OpenAIClient.get_completion` with the crafted prompt and system message.
- Raises `QuizExplanationError` on API/validation failures so the router can translate them into HTTP errors.
- Exposes an `aclose` coroutine to release provider resources (mirrors the quiz generation service pattern).

### 2.4 Schema and Settings Extensions

- `backend/app/schemas/quiz.py`
  - Adds `QuestionExplanationRequest` and `QuestionExplanationResponse` models with alias support so camelCase JSON binds to snake_case attributes internally.
- `backend/app/core/config.py`
  - Introduces explanation-specific tunables (model name, temperature, max tokens). They default to the same `gpt-4o-mini` stack used for quiz generation but can be overridden via environment variables.

---

## 3. Frontend Implementation Details

### 3.1 Types and API Helpers

- `frontend/src/types/index.ts`
  - Defines `QuizExplanationRequest`/`QuizExplanationResponse` matching the backend payload.

- `frontend/src/services/quizzes.ts`
  - Contains `requestQuizQuestionExplanation(payload)`, a thin Axios wrapper targeting `/quizzes/questions/explain-error`.

- `frontend/src/services/documents.ts`
  - Adds `fetchDocumentChunks(documentId)` to retrieve all chunk text. The quiz modal uses this to gather document context exactly once per document.

### 3.2 UI/State Management (`DocumentQuizModal.tsx`)

Key additions:

- **State buckets**
  - `documentContext`: Combined chunk text cached per open document.
  - `explanations`: Record keyed by `questionId` storing `{ isExpanded, isLoading, explanation, error }`.
  - `documentContextPromise` ref: Ensures a single in-flight chunk fetch even if multiple explanations are requested concurrently.
  - `activeDocumentIdRef`: Prevents race conditions when the user switches documents while a fetch is pending.

- **Lifecycle integration**
  - Resets explanation state whenever the modal closes, a new quiz loads, the quiz is retaken, or a new document is selected.

- **Explanation fetch path**
  1. Toggle expands the explanation panel.
  2. Modal ensures document context is available (fetches chunks via `fetchDocumentChunks` if needed, with loading/error handling and caching).
  3. Builds the explanation payload using question text, selected option text, and correct option text.
  4. Calls `requestQuizQuestionExplanation`; caches the successful response or displays error messaging on failure.

- **UI/UX**
  - Button shows spinner while explanation loads and is disabled during context or explanation fetches.
  - Accordion view renders explanation text, loading indicator, or error message with contextual iconography.
  - Quiz summary copy updated to guide students toward reviewing explanations.

### 3.3 Error Handling & Caching

- Context fetch errors are surfaced in the accordion so the user understands why no explanation is available.
- Axios errors are normalized to human-readable strings via `getErrorMessage`.
- Once an explanation is fetched, subsequent toggles are instant (no re-fetch) unless the quiz/document state resets.

---

## 4. Prompt Engineering Recap

The service composes a prompt adhering to the spec:

```
Role: helpful tutor
Context: <document excerpt>
Task: explain why the student answer is wrong and the correct one is right
Instructions: supportive tone, 2-4 sentences, reference the excerpt, no extra preamble
```

A dedicated system message reiterates conciseness and reliance on provided context. The prompt trims incoming strings to avoid runaway whitespace and enforces positive, supportive phrasing.

---

## 5. Data Flow Diagram

```
DocumentQuizModal
   └─(click)─► handleToggleExplanation(question)
         ├─► loadDocumentContext()
         │     └─► fetchDocumentChunks(documentId)  (one-time cache)
         └─► requestQuizQuestionExplanation(payload)
                  └─► POST /api/v1/quizzes/questions/explain-error
                            └─► QuizExplanationService.explain_answer()
                                   └─► OpenAIClient.get_completion()
```

---

## 6. Error Surfaces & Logging

- Backend logs at INFO when requesting explanations, and at ERROR when provider communication or validation fails. These logs include the question text for traceability without leaking personal data.
- Router returns HTTP 400 for recoverable issues (missing context, provider failure) so the frontend can show actionable messages.
- Frontend sets inline error text adjacent to the explanation accordion; no global toast spam.

---

## 7. Configuration & Operations

Environment variables (with defaults):

- `QUIZ_EXPLANATION_MODEL` (`gpt-4o-mini`)
- `QUIZ_EXPLANATION_TEMPERATURE` (`0.2`)
- `QUIZ_EXPLANATION_MAX_TOKENS` (`350`)

These mirror the style of existing quiz generation settings. Updating them does not require code changes.

---

## 8. Validation & Follow-Up

- `npm run lint` (frontend) currently fails due to pre-existing lint issues unrelated to this feature (`react-refresh/only-export-components`, unused vars, etc.). The lint run still confirms that the new files respect the project’s lint rules.
- Recommended follow-up: resolve outstanding lint errors in the existing codebase so CI can pass cleanly once this feature merges.

---

## 9. Future Enhancements

- **Chunk selection**: Instead of sending all chunks, integrate retrieval that selects the most relevant chunk based on the quiz question to reduce token usage.
- **Persistent caching**: Store explanations in a per-document cache keyed by `questionId` across modal sessions.
- **Usage analytics**: Track explanation requests to evaluate adoption and identify quizzes that consistently confuse learners.