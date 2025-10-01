import React, { useEffect, useRef, useState } from 'react';
import { Download, MoreVertical, Sparkles, Trash2 } from 'lucide-react';
import clsx from 'clsx';

interface DocumentActionMenuProps {
  onDelete: () => void;
  onDownload?: () => void;
  onGenerateQuiz?: () => void;
  isDeleting?: boolean;
  disableDownload?: boolean;
  disableQuiz?: boolean;
}

/**
 * Contextual menu exposing secondary document actions.
 */
export const DocumentActionMenu: React.FC<DocumentActionMenuProps> = ({
  onDelete,
  onDownload,
  onGenerateQuiz,
  isDeleting = false,
  disableDownload = false,
  disableQuiz = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <MoreVertical className="h-5 w-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-20 mt-2 w-40 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg">
          {onGenerateQuiz && (
            <button
              type="button"
              onClick={() => {
                if (disableQuiz) {
                  return;
                }
                onGenerateQuiz();
                setIsOpen(false);
              }}
              className={clsx(
                'flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium transition',
                disableQuiz
                  ? 'cursor-not-allowed text-gray-300'
                  : 'text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700'
              )}
              disabled={disableQuiz}
            >
              <Sparkles className="h-4 w-4" />
              Generate quiz
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (disableDownload) return;
              onDownload?.();
              setIsOpen(false);
            }}
            className={clsx(
              'flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium transition',
              disableDownload
                ? 'cursor-not-allowed text-gray-300'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
            disabled={disableDownload}
          >
            <Download className="h-4 w-4" />
            Download
          </button>

          <button
            type="button"
            onClick={() => {
              onDelete();
              setIsOpen(false);
            }}
            disabled={isDeleting}
            className={clsx(
              'flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium transition',
              isDeleting
                ? 'cursor-not-allowed text-red-200'
                : 'text-red-600 hover:bg-red-50 hover:text-red-700'
            )}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default DocumentActionMenu;
