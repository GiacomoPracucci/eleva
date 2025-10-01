# Quiz Explanation and Generation Enhancements

## 1. Overview

Recent changes overhaul how the application builds quiz explanations and tightens quiz generation responses. The primary goals were to shrink prompt context to the most relevant segments, enforce higher-quality tutor explanations, and reduce JSON parsing failures when creating quizzes. The result is a retrieval-augmented explanation pipeline, stricter prompt engineering for quiz creation, and a simplified UI contract that delegates more responsibility to the backend.

## 2. Retrieval-Driven Explanation Pipeline

### 2.1 Document Vector Search

- `DocumentRetrievalService` (`backend/app/services/document_retrieval.py`) now mediates access to the pgvector-powered similarity search.
- The service embeds the composed query `(question text + correct answer)` using the existing `EmbeddingService` and requests the top `N` closest chunks via `document_chunk_crud.search_similar_chunks` (`backend/app/crud/document.py`).
- Chunk selection is capped by the new setting `QUIZ_EXPLANATION_MAX_CONTEXT_CHUNKS` (`backend/app/core/config.py`) and can be reduced per-request through the optional `maxChunks` field.
- Results are normalized into lightweight `RetrievedChunk` dataclasses and filtered to discard empty chunk text before being sent to the LLM.

### 2.2 Explanation Prompt Construction

- `QuizExplanationService.explain_answer` (`backend/app/services/quiz_explanation.py`) now receives the `Document` object and database session, retrieves relevant chunks, and formats them as `"[Chunk {index}] …"` blocks.
- The user prompt explicitly instructs the LLM to:
  1. Refute the student’s answer using cited chunks.
  2. Justify the correct answer with grounded evidence.
  3. Reinforce the key learning item in a supportive tone while referencing chunk numbers.
- The system message reinforces citation requirements and forbids preamble, lifting explanation quality beyond the previous “correct answer is X” responses.
- Retrieval failures (e.g., missing embeddings, empty results) propagate as `QuizExplanationError` so API consumers receive actionable error messages.

### 2.3 API Contract and Authorization

- `QuestionExplanationRequest` now carries `documentId` instead of pre-baked context (`backend/app/schemas/quiz.py`). Optional `maxChunks` enforces both client and server limits.
- `POST /api/v1/quizzes/questions/explain-error` (`backend/app/api/v1/quizzes.py`) verifies document ownership/admin status, then forwards the hydrated document and DB session to the service.
- This removes the need for the frontend to download entire document chunks and keeps sensitive text on the server.

## 3. Frontend Adjustments

- `DocumentQuizModal` (`frontend/src/components/documents/DocumentQuizModal.tsx`) no longer fetches or caches document context. It now sends `{ documentId, questionText, userSelectedAnswer, correctAnswer }` to the backend.
- Explanation UI state remains per-question (`{ isExpanded, isLoading, explanation, error }`) with unchanged UX affordances (loading spinner, inline errors, cached answers).
- `QuizExplanationRequest` type reflects the new contract (`frontend/src/types/index.ts`).

## 4. Quiz Generation Robustness

- The generation prompt (`backend/app/services/quiz_generation.py`) now:
  - Enumerates strict directives (option IDs `A`–`D`, sequential `questionId` values, no commentary).
  - Embeds a JSON mini-schema to keep the LLM on target.
  - Requests OpenAI’s `response_format={"type": "json_object"}` so invalid JSON is less likely.
- Output handling strips optional markdown fences, validates non-empty payloads, and retains existing Pydantic validation.

## 5. Supporting Infrastructure Changes

- `backend/app/crud/document.py` exposes `search_similar_chunks`, joining `DocumentChunk` with `DocumentEmbedding` and ordering by cosine distance.
- `QUIZ_EXPLANATION_MAX_CONTEXT_CHUNKS` setting keeps retrieval bounded and easily tunable.
- Documentation (`docs/ai_quiz_explanations.md`) now describes the retrieval workflow, updated request payload, and prompt strategy.

## 6. Operational Considerations

- **Embeddings prerequisite**: Documents must finish processing and possess embeddings (`ProcessingStatus.COMPLETED`), otherwise retrieval fails fast.
- **Error surfacing**: Retrieval or provider errors appear inline in the modal; the backend returns HTTP 400 with descriptive messages for client display.
- **Caching**: Explanations remain cached client-side by question ID; the server does not persist explanation text.

## 7. Suggested Follow-Up Activities

1. Add automated tests for `DocumentRetrievalService.top_chunks` and the new quiz generation prompt to guard against future regressions.
2. Instrument explanation requests (counts, latency) to monitor retrieval quality and user engagement.
3. Consider batching embeddings for multi-sentence queries if chunk density warrants broader coverage.

---

This report should serve as a reference when onboarding teammates or auditing the new retrieval-aware explanation workflow.
