# AI-Powered Quiz Generation Feature Overview

## 1. Feature Goals and User Flow
The AI quiz workflow lets learners turn any processed subject document into a multiple-choice assessment. Users launch the flow from the redesigned document library, request a quiz with a chosen number of questions, answer each prompt, and review immediate results with future-facing affordances for AI explanations.

The implementation is split between backend orchestration (LLM prompting, schema validation, access control) and a modular frontend (API helpers, stateful hooks, and UI building blocks). This document walks through both halves so the feature can be confidently extended.

## 2. Backend Architecture

### 2.1 Configuration Surface
Quiz generation reuses the existing OpenAI client but adds dedicated tuning knobs that are exposed via `Settings`:

- `QUIZ_GENERATION_MODEL` – default model override (`gpt-4o-mini`).
- `QUIZ_GENERATION_TEMPERATURE` – deterministic response control.
- `QUIZ_MAX_INPUT_CHARACTERS` – guard rail on prompt size.
- `QUIZ_MAX_QUESTIONS` – validates client requests.

All four values sit alongside the other AI flags, making them easy to override in `.env` files or deployment environments.【F:backend/app/core/config.py†L110-L137】

### 2.2 Contract Schemas
`app/schemas/quiz.py` defines the JSON contract shared across the stack. Three nested Pydantic models mirror the LLM output:

- `QuizOption` and `QuizQuestion` capture the option IDs/text and correct answer reference while providing a lookup helper for future UI needs.
- `QuizResponse` wraps the quiz title and questions array exactly as the frontend expects.
- `QuizGenerationRequest` enforces question bounds based on `QUIZ_MAX_QUESTIONS` and supplies a default of five.

By validating responses against these models, the backend can reject malformed AI output before it reaches the client.【F:backend/app/schemas/quiz.py†L1-L59】

### 2.3 LLM Orchestration Service
`QuizGenerationService` encapsulates every interaction with the LLM provider so endpoints stay thin. The flow is:

1. Ensure the document finished processing (only `COMPLETED` is accepted) and that text chunks exist.【F:backend/app/services/quiz_generation.py†L52-L66】
2. Concatenate chunk text while respecting the configured character cap to avoid oversized prompts.【F:backend/app/services/quiz_generation.py†L107-L132】
3. Build a deterministic prompt that reiterates the schema, inlines document metadata for extra grounding, and injects the user-specified question count.【F:backend/app/services/quiz_generation.py†L133-L171】
4. Call the OpenAI client with a purpose-built system message that mandates JSON-only replies.【F:backend/app/services/quiz_generation.py†L77-L178】
5. Parse the LLM response as JSON and validate it against `QuizResponse`, surfacing clear errors if either step fails.【F:backend/app/services/quiz_generation.py†L88-L100】

The service also exposes `aclose()` so callers can release HTTP resources when the request finishes.【F:backend/app/services/quiz_generation.py†L102-L106】

### 2.4 REST Endpoint
A new `POST /documents/{document_id}/generate-quiz` route wires the service into the existing document API. It:

- Verifies the document exists and belongs to the authenticated user (admins are allowed regardless of ownership).
- Instantiates the quiz service, delegates generation with the requested question count, and converts service exceptions into `400` responses.
- Always closes the underlying API client via `finally`.

The endpoint returns the validated `QuizResponse`, giving the frontend a predictable payload.【F:backend/app/api/v1/documents.py†L559-L597】

## 3. Frontend Architecture

### 3.1 Shared Types
`frontend/src/types/index.ts` adds TypeScript interfaces that mirror the backend schema (`DocumentQuiz`, `QuizQuestion`, `QuizOption`) plus client-only structures for request payloads and result summaries. Keeping these types centralized ensures components and hooks share a single source of truth.【F:frontend/src/types/index.ts†L203-L239】

### 3.2 API Helper
`frontend/src/services/documents.ts` introduces `generateQuizFromDocument`, an API helper that posts to the backend and returns the typed response. It deliberately lives outside the Zustand store so multiple UI surfaces can reuse it without pulling store dependencies.【F:frontend/src/services/documents.ts†L1-L34】

### 3.3 Quiz Lifecycle Hook
`useDocumentQuiz` wraps the helper with local state for loading, errors, and the current quiz. It exposes `generateQuiz` and `resetQuiz` while accepting an optional `onQuizLoaded` callback for UI initialization. Errors returned from the API are normalized for display, and the hook keeps presentation components lean.【F:frontend/src/hooks/documents/useDocumentQuiz.ts†L1-L72】

### 3.4 Document Action Surface
`DocumentList` retains the familiar list layout but layers in the “Generate Quiz” button alongside download and delete controls. The component keeps polling for in-flight processing, surfaces deletion feedback, and orchestrates the quiz modal so the new capability feels native to the existing UX.【F:frontend/src/components/documents/DocumentList.tsx†L1-L438】

### 3.5 Quiz Modal Experience
`DocumentQuizModal` owns the end-to-end quiz experience:

- When opened, it boots `useDocumentQuiz`, collects the number of questions (presets plus manual input), and issues the generation request.【F:frontend/src/components/documents/DocumentQuizModal.tsx†L16-L115】【F:frontend/src/components/documents/DocumentQuizModal.tsx†L259-L321】
- Answer selection is tracked per-question, enabling submit only when all prompts are answered.【F:frontend/src/components/documents/DocumentQuizModal.tsx†L81-L115】
- Submission calculates correctness locally and presents a results summary with per-question badges and color-coded states.【F:frontend/src/components/documents/DocumentQuizModal.tsx†L93-L200】【F:frontend/src/components/documents/DocumentQuizModal.tsx†L323-L379】
- Incorrect answers expose a disabled “Why was this wrong?” button, reserving space for the forthcoming explanation flow without a future redesign.【F:frontend/src/components/documents/DocumentQuizModal.tsx†L206-L221】

## 4. End-to-End Sequence
1. A document card’s “Generate Quiz” button opens the modal with the selected document context.【F:frontend/src/components/documents/DocumentList.tsx†L154-L438】
2. The modal collects quiz settings and calls `useDocumentQuiz.generateQuiz`, which posts to the backend service.【F:frontend/src/components/documents/DocumentQuizModal.tsx†L76-L119】【F:frontend/src/hooks/documents/useDocumentQuiz.ts†L33-L68】
3. The backend endpoint authenticates, builds the LLM prompt, and returns validated quiz JSON.【F:backend/app/api/v1/documents.py†L559-L597】【F:backend/app/services/quiz_generation.py†L52-L100】
4. The hook hydrates local state, enabling question rendering and answer capture through the modal UI.【F:frontend/src/components/documents/DocumentQuizModal.tsx†L31-L205】
5. On submit, the modal computes results client-side, reveals the summary, and presents retake/regenerate options without another network call.【F:frontend/src/components/documents/DocumentQuizModal.tsx†L93-L379】

## 5. Extension Points
- **AI Explanations:** The disabled CTA in each incorrect question card provides an obvious integration point once explanation endpoints are available.【F:frontend/src/components/documents/DocumentQuizModal.tsx†L206-L221】
- **Additional Document Actions:** The action row in `DocumentList` keeps the design scalable for future buttons such as “Summarize” or “Generate Flashcards” without another layout overhaul.【F:frontend/src/components/documents/DocumentList.tsx†L126-L215】
- **Service Customization:** New prompt variants or providers can slot into `QuizGenerationService` by swapping the client or overriding the prompt builder, while configuration knobs already expose model and token limits.【F:backend/app/services/quiz_generation.py†L31-L178】【F:backend/app/core/config.py†L110-L137】

With this structure, the AI quiz feature remains modular, testable, and ready for the next wave of AI-driven study tools.