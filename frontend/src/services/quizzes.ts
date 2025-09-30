/**
 * @file Quiz-specific API helpers.
 *
 * Provides functions to interact with quiz-related backend endpoints,
 * keeping API calls centralized for reuse across the application.
 */

import api from '@/services/api';
import { QuizExplanationRequest, QuizExplanationResponse } from '@/types';

/**
 * Request an explanation for an incorrectly answered quiz question.
 *
 * @param payload - Context required for the LLM to generate an explanation
 * @returns The explanation text returned by the backend
 */
export const requestQuizQuestionExplanation = async (
  payload: QuizExplanationRequest
): Promise<QuizExplanationResponse> => {
  const response = await api.post<QuizExplanationResponse>(
    '/quizzes/questions/explain-error',
    payload
  );

  return response.data;
};

export default {
  requestQuizQuestionExplanation,
};
