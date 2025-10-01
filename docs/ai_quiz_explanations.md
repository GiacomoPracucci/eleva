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
  "documentId": "<source document UUID>",
  "questionText": "<quiz prompt>",
  "userSelectedAnswer": "<student's incorrect option text>",
  "correctAnswer": "<correct option text>",
  "maxChunks": 10 // optional override, defaults to server setting
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

- Accepts configuration overrides but defaults to the settings block (`QUIZ_EXPLANATION_MODEL`, `QUIZ_EXPLANATION_TEMPERATURE`, `QUIZ_EXPLANATION_MAX_TOKENS`, `QUIZ_EXPLANATION_MAX_CONTEXT_CHUNKS`).
- Uses `DocumentRetrievalService` to embed the `(question + correct answer)` query and fetch the top-N similar chunks for the document.
- Numbers and formats the retrieved snippets so the tutor prompt can cite `[Chunk N]` in its explanation.
- Builds a supportive tutor prompt that asks the LLM to refute the student's answer, justify the correct answer, and ground both steps in the referenced chunks.
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

### 3.2 UI/State Management (`DocumentQuizModal.tsx`)

Key adjustments:

- **State buckets**
  - `explanations`: Record keyed by `questionId` storing `{ isExpanded, isLoading, explanation, error }` for cached responses.
  - The previous `documentContext` cache and associated refs were removed; retrieval is now server-driven.

- **Lifecycle integration**
  - Explanation state resets whenever the modal closes, a new quiz loads, the quiz is retaken, or a different document is selected.

- **Explanation fetch path**
  1. Toggle expands the explanation panel.
  2. The modal packages `documentId`, `questionText`, `userSelectedAnswer`, and `correctAnswer` into the explanation request.
  3. Backend performs semantic search and prompt orchestration; the UI caches the resulting explanation per question or surfaces any errors.

- **UI/UX**
  - Button shows a spinner while the explanation request is in flight and disables repeat clicks until it resolves.
  - Accordion view renders explanation text, loading indicator, or error messaging with contextual iconography.
  - Quiz summary copy continues to guide students toward reviewing explanations.

### 3.3 Error Handling & Caching

- Retrieval or provider errors bubble up as inline accordion messages so the user understands why no explanation is available.
- Axios errors are normalized to human-readable strings via `getErrorMessage`.
- Once an explanation is fetched, subsequent toggles are instant (no re-fetch) unless the quiz/document state resets.

---

## 4. Prompt Engineering Recap

The service now builds a prompt that:

- Injects the top-N retrieved chunks, each prefixed with `[Chunk index]` so the LLM can reference them explicitly.
- Asks the model to explain why the student's answer is incorrect and why the correct answer fits, citing chunk numbers in brackets.
- Encourages a supportive tone across 3–5 sentences while forbidding any information outside the provided context.

The system message reinforces chunk citations and forbids extra preamble so responses stay grounded and concise.

---

## 5. Data Flow Diagram

```
DocumentQuizModal
   └─(click)─► handleToggleExplanation(question)
         └─► requestQuizQuestionExplanation({ documentId, questionText, ... })
                  └─► POST /api/v1/quizzes/questions/explain-error
                            └─► QuizExplanationService.explain_answer()
                                   ├─► DocumentRetrievalService.top_chunks()
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
