/**
 * @file Document-specific API helpers.
 *
 * This module groups together higher-level document actions that are not
 * directly tied to the Zustand store, keeping network logic reusable across
 * the application. The quiz generation helper returns the raw JSON contract
 * from the backend so UI layers can remain entirely declarative.
 */

import api from '@/services/api';
import { DocumentChunk, DocumentQuiz, DocumentQuizRequest } from '@/types';

/**
 * Request an AI-generated quiz for a document.
 *
 * @param documentId - The UUID of the document
 * @param payload - Quiz generation preferences
 * @returns The generated quiz payload
 */
export const generateQuizFromDocument = async (
  documentId: string,
  payload: DocumentQuizRequest
): Promise<DocumentQuiz> => {
  const response = await api.post<DocumentQuiz>(
    `/documents/${documentId}/generate-quiz`,
    payload
  );

  return response.data;
};

/**
 * Fetch the full set of chunks for a document, including their text content.
 *
 * @param documentId - The UUID of the document
 * @returns All chunks with text included
 */
export const fetchDocumentChunks = async (documentId: string): Promise<DocumentChunk[]> => {
  const response = await api.get<DocumentChunk[]>(`/documents/${documentId}/chunks`, {
    params: { include_text: true },
  });

  return response.data;
};

export default {
  generateQuizFromDocument,
  fetchDocumentChunks,
};
