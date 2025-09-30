import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, HelpCircle, Loader2, X } from 'lucide-react';
import clsx from 'clsx';

import { Document, DocumentQuiz, QuizResultSummary } from '@/types';
import { useDocumentQuiz } from '@/hooks/documents/useDocumentQuiz';

interface DocumentQuizModalProps {
  document: Document | null;
  isOpen: boolean;
  onClose: () => void;
}

type AnswerState = Record<string, string | null>;

const QUESTION_PRESETS = [3, 5, 7, 10];
const MAX_QUESTIONS = 20;

/**
 * Modal that orchestrates quiz generation, participation and results display.
 */
export const DocumentQuizModal: React.FC<DocumentQuizModalProps> = ({
  document,
  isOpen,
  onClose,
}) => {
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [results, setResults] = useState<QuizResultSummary | null>(null);

  const {
    quiz,
    isGenerating,
    error,
    generateQuiz,
    resetQuiz,
  } = useDocumentQuiz({
    onQuizLoaded: (payload) => {
      const initialAnswers = payload.questions.reduce<AnswerState>((acc, question) => {
        acc[question.questionId] = null;
        return acc;
      }, {});

      setAnswers(initialAnswers);
      setResults(null);
    },
  });

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      resetQuiz();
    }
  }, [isOpen, resetQuiz]);

  const resetState = useCallback(() => {
    setAnswers({});
    setResults(null);
    setQuestionCount(5);
  }, []);

  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget && !isGenerating) {
        onClose();
      }
    },
    [onClose, isGenerating]
  );

  const handleGenerateQuiz = useCallback(async () => {
    if (!document) return;
    await generateQuiz(document.id, questionCount);
  }, [document, generateQuiz, questionCount]);

  const handleAnswerSelect = useCallback((questionId: string, optionId: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionId,
    }));
  }, []);

  const canSubmit = useMemo(() => {
    if (!quiz) return false;
    return quiz.questions.every((question) => answers[question.questionId]);
  }, [quiz, answers]);

  const handleSubmitQuiz = useCallback(() => {
    if (!quiz) return;

    const questionResults = quiz.questions.map((question) => {
      const selectedOptionId = answers[question.questionId] || null;
      const isCorrect = selectedOptionId === question.correctOptionId;

      return {
        questionId: question.questionId,
        selectedOptionId,
        correctOptionId: question.correctOptionId,
        isCorrect,
      };
    });

    const correctCount = questionResults.filter((item) => item.isCorrect).length;

    setResults({
      questionResults,
      correctCount,
      totalQuestions: quiz.questions.length,
    });
  }, [quiz, answers]);

  const handleRetakeQuiz = useCallback(() => {
    if (!quiz) return;

    const resetAnswers = quiz.questions.reduce<AnswerState>((acc, question) => {
      acc[question.questionId] = null;
      return acc;
    }, {});

    setAnswers(resetAnswers);
    setResults(null);
  }, [quiz]);

  const renderOption = (quizData: DocumentQuiz, questionId: string, optionId: string) => {
    const question = quizData.questions.find((item) => item.questionId === questionId);
    if (!question) return null;
    const option = question.options.find((item) => item.optionId === optionId);
    if (!option) return null;

    const selected = answers[questionId];
    const isSelected = selected === optionId;
    const isCorrect = question.correctOptionId === optionId;
    const isQuizResolved = Boolean(results);
    const isIncorrectSelection = isQuizResolved && isSelected && !isCorrect;

    const baseClasses = 'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors';

    const stateClasses = clsx({
      'border-blue-500 bg-blue-50': isSelected && !isQuizResolved,
      'border-green-500 bg-green-50': isQuizResolved && isCorrect,
      'border-red-500 bg-red-50': isIncorrectSelection,
      'hover:border-blue-400': !isQuizResolved,
    });

    return (
      <label key={optionId} className={`${baseClasses} ${stateClasses}`}>
        <input
          type="radio"
          className="mt-1"
          name={questionId}
          value={optionId}
          checked={isSelected}
          onChange={() => handleAnswerSelect(questionId, optionId)}
          disabled={isQuizResolved}
        />
        <div>
          <p className="font-medium text-gray-900">{option.optionText}</p>
          {isQuizResolved && isCorrect && (
            <p className="mt-1 text-sm text-green-600">Correct answer</p>
          )}
          {isIncorrectSelection && (
            <p className="mt-1 text-sm text-red-600">Your selection</p>
          )}
        </div>
      </label>
    );
  };

  const renderQuestion = (quizData: DocumentQuiz) => {
    return quizData.questions.map((question, index) => {
      const questionResult = results?.questionResults.find((item) => item.questionId === question.questionId);
      const isCorrect = questionResult?.isCorrect ?? false;
      const isResolved = Boolean(results);

      return (
        <div key={question.questionId} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400">
                Question {index + 1}
              </p>
              <h3 className="text-lg font-semibold text-gray-900">{question.questionText}</h3>
            </div>
            {isResolved && (
              <div
                className={clsx('flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium', {
                  'bg-green-100 text-green-700': isCorrect,
                  'bg-red-100 text-red-700': !isCorrect,
                })}
              >
                {isCorrect ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                {isCorrect ? 'Correct' : 'Incorrect'}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {question.options.map((option) => renderOption(quizData, question.questionId, option.optionId))}
          </div>

          {isResolved && questionResult && !questionResult.isCorrect && (
            <div className="mt-4 flex items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>The correct answer has been highlighted above.</span>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md border border-yellow-300 px-3 py-1 text-xs font-medium text-yellow-700 opacity-60"
                disabled
                title="Explanations will arrive soon!"
              >
                <HelpCircle className="h-4 w-4" />
                Why was this wrong?
              </button>
            </div>
          )}
        </div>
      );
    });
  };

  if (!isOpen || !document) {
    return null;
  }

  const modalTitle = quiz ? quiz.quizTitle : `Generate quiz for ${document.filename}`;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      onClick={handleBackdropClick}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-gray-50 shadow-2xl">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">AI Quiz Generator</p>
            <h2 className="text-2xl font-semibold text-gray-900">{modalTitle}</h2>
            <p className="text-sm text-gray-500">Based on your uploaded document</p>
          </div>
          <button
            type="button"
            className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            onClick={onClose}
            disabled={isGenerating}
            aria-label="Close quiz modal"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {!quiz && (
            <div className="mx-auto max-w-xl space-y-6 rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center">
              <h3 className="text-lg font-semibold text-gray-900">Configure your quiz</h3>
              <p className="text-sm text-gray-500">
                Choose how many questions you would like to study. You can generate as many quizzes as you need and repeat the exercise at any time.
              </p>

              <div className="flex flex-wrap justify-center gap-3">
                {QUESTION_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={clsx(
                      'rounded-full border px-4 py-2 text-sm font-medium transition',
                      preset === questionCount
                        ? 'border-blue-500 bg-blue-50 text-blue-600'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-blue-400 hover:text-blue-600'
                    )}
                    onClick={() => setQuestionCount(preset)}
                    disabled={isGenerating}
                  >
                    {preset} questions
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-center gap-3 text-sm text-gray-500">
                <span>Custom amount:</span>
                <input
                  type="number"
                  min={1}
                  max={MAX_QUESTIONS}
                  value={questionCount}
                  disabled={isGenerating}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isNaN(value)) return;
                    const clamped = Math.min(Math.max(1, value), MAX_QUESTIONS);
                    setQuestionCount(clamped);
                  }}
                  className="w-20 rounded-lg border border-gray-200 px-3 py-2 text-center focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {error && (
                <div className="flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-6 py-3 font-semibold text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-blue-300"
                onClick={handleGenerateQuiz}
                disabled={isGenerating}
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isGenerating ? 'Generating quiz...' : 'Generate quiz'}
              </button>
            </div>
          )}

          {quiz && (
            <div className="space-y-6">
              {results && (
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-blue-800">
                  <p className="text-sm font-medium uppercase tracking-wide">Quiz summary</p>
                  <p className="mt-1 text-2xl font-semibold">
                    {results.correctCount} / {results.totalQuestions} correct answers
                  </p>
                  <p className="text-sm text-blue-700">Keep practicing to unlock the upcoming explanations feature!</p>
                </div>
              )}

              <div className="space-y-5">{renderQuestion(quiz)}</div>
            </div>
          )}
        </div>

        {quiz && (
          <footer className="flex items-center justify-between border-t border-gray-200 bg-white px-6 py-4">
            <div className="text-sm text-gray-500">
              {results ? 'Review your answers or generate a new quiz to continue practicing.' : 'Select one answer per question to enable submission.'}
            </div>
            <div className="flex items-center gap-3">
              {results ? (
                <>
                  <button
                    type="button"
                    className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:border-gray-400"
                    onClick={handleRetakeQuiz}
                  >
                    Retake this quiz
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-blue-500 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                    onClick={() => {
                      resetQuiz();
                      setResults(null);
                      setAnswers({});
                    }}
                  >
                    Generate a new quiz
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow disabled:cursor-not-allowed disabled:bg-blue-300"
                  disabled={!canSubmit}
                  onClick={handleSubmitQuiz}
                >
                  Submit quiz
                </button>
              )}
            </div>
          </footer>
        )}
      </div>
    </div>
  );
};

export default DocumentQuizModal;