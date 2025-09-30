import { useCallback, useState } from 'react';

import { DocumentQuiz } from '@/types';
import { generateQuizFromDocument } from '@/services/documents';

interface UseDocumentQuizOptions {
  onQuizLoaded?: (quiz: DocumentQuiz) => void;
}

interface UseDocumentQuizResult {
  quiz: DocumentQuiz | null;
  isGenerating: boolean;
  error: string | null;
  generateQuiz: (documentId: string, questionCount: number) => Promise<DocumentQuiz | null>;
  resetQuiz: () => void;
}

/**
 * Hook encapsulating the lifecycle of generating a quiz from a document.
 *
 * Separating this logic keeps UI components lean and prepares the codebase
 * for future quiz-related features (e.g. requesting explanations).
 */
export const useDocumentQuiz = (
  options: UseDocumentQuizOptions = {}
): UseDocumentQuizResult => {
  const { onQuizLoaded } = options;

  const [quiz, setQuiz] = useState<DocumentQuiz | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateQuiz = useCallback<UseDocumentQuizResult['generateQuiz']>(
    async (documentId, questionCount) => {
      setIsGenerating(true);
      setError(null);

      try {
        const payload = await generateQuizFromDocument(documentId, {
          question_count: questionCount,
        });

        setQuiz(payload);
        onQuizLoaded?.(payload);
        return payload;
      } catch (err: any) {
        const detail = err?.response?.data?.detail;
        const message = typeof detail === 'string' ? detail : 'Unable to generate quiz.';
        setError(message);
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [onQuizLoaded]
  );

  const resetQuiz = useCallback(() => {
    setQuiz(null);
    setError(null);
  }, []);

  return {
    quiz,
    isGenerating,
    error,
    generateQuiz,
    resetQuiz,
  };
};

export default useDocumentQuiz;