/**
 * @file DocumentList component for displaying documents in a subject.
 *
 * This component shows all documents uploaded to a subject with:
 * - Processing status indicators
 * - File information display
 * - Action buttons (view, delete, quiz generation)
 * - Empty state handling
 * - Loading and error states
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Download,
  FileX,
  Loader2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import clsx from 'clsx';

import { useDocumentsStore } from '@/store/documentsStore';
import { Document, ProcessingStatus } from '@/types';
import DocumentQuizModal from '@/components/documents/DocumentQuizModal';

/**
 * Props for the DocumentList component.
 */
interface DocumentListProps {
  /**
   * The ID of the subject whose documents to display.
   */
  subjectId: number;

  /**
   * Whether to include documents that failed processing.
   */
  includesFailed?: boolean;

  /**
   * Callback when a document is selected for viewing.
   */
  onDocumentClick?: (document: Document) => void;

  /**
   * Whether to show in compact mode (fewer details).
   */
  compact?: boolean;
}

/**
 * Helper function to get icon for file type.
 * Returns appropriate icon based on MIME type or extension.
 */
const getFileIcon = (fileType: string, filename: string) => {
  if (fileType.includes('pdf')) return '📄';
  if (fileType.includes('word') || filename.endsWith('.docx')) return '📝';
  if (fileType.includes('text')) return '📃';
  if (filename.endsWith('.md')) return '📑';
  return '📎';
};

/**
 * Helper function to format file size.
 * Converts bytes to human-readable format.
 */
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

/**
 * Helper function to format date.
 * Returns relative time for recent dates, absolute for older.
 */
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return date.toLocaleDateString();
};

/**
 * Component to render processing status badge.
 * Shows different colors and icons based on status.
 */
const StatusBadge: React.FC<{ status: ProcessingStatus }> = ({ status }) => {
  const { icon, text, className } = useMemo(() => {
    switch (status) {
      case ProcessingStatus.PENDING:
        return {
          icon: <Clock className="w-3 h-3" />, text: 'Pending', className: 'bg-gray-100 text-gray-700',
        };
      case ProcessingStatus.PARSING:
      case ProcessingStatus.CHUNKING:
        return {
          icon: <Loader2 className="w-3 h-3 animate-spin" />, text: 'Processing', className: 'bg-blue-100 text-blue-700',
        };
      case ProcessingStatus.EMBEDDING:
        return {
          icon: <Loader2 className="w-3 h-3 animate-spin" />, text: 'Embedding', className: 'bg-purple-100 text-purple-700',
        };
      case ProcessingStatus.COMPLETED:
        return {
          icon: <CheckCircle className="w-3 h-3" />, text: 'Ready', className: 'bg-green-100 text-green-700',
        };
      case ProcessingStatus.FAILED:
        return {
          icon: <AlertCircle className="w-3 h-3" />, text: 'Failed', className: 'bg-red-100 text-red-700',
        };
      default:
        return { icon: null, text: status, className: 'bg-gray-100 text-gray-700' };
    }
  }, [status]);

  return (
    <span className={clsx(
      'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
      className,
    )}
    >
      {icon && <span className="mr-1">{icon}</span>}
      {text}
    </span>
  );
};

interface DocumentItemProps {
  document: Document;
  onDelete: (id: string) => void;
  onClick?: (document: Document) => void;
  onGenerateQuiz: (document: Document) => void;
  compact?: boolean;
  isDeleting?: boolean;
}

/**
 * Component to render a single document item.
 * Shows document info, status, and actions.
 */
const DocumentItem: React.FC<DocumentItemProps> = ({
  document,
  onDelete,
  onClick,
  onGenerateQuiz,
  compact,
  isDeleting,
}) => {
  const fileIcon = getFileIcon(document.file_type, document.filename);
  const fileUrl = document.file_url;
  const isReadyForQuiz = document.is_ready && document.processing_status === ProcessingStatus.COMPLETED;

  return (
    <div
      className={clsx(
        'rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md',
        onClick && 'cursor-pointer',
      )}
    >
      <div className="flex items-start justify-between">
        {/* Left side - File info */}
        <div className="min-w-0 flex-1" onClick={() => onClick?.(document)}>
          <div className="flex items-start space-x-3">
            {/* File icon */}
            <span className="flex-shrink-0 text-2xl">{fileIcon}</span>

            {/* File details */}
            <div className="min-w-0 flex-1">
              {/* Filename - truncate if too long */}
              <h4 className="truncate text-sm font-medium text-gray-900">{document.filename}</h4>

              {/* File metadata */}
              {!compact && (
                <div className="mt-1 flex items-center space-x-3 text-xs text-gray-500">
                  <span>{formatFileSize(document.file_size)}</span>
                  <span>•</span>
                  <span>{formatDate(document.created_at)}</span>
                  {document.total_chunks > 0 && (
                    <>
                      <span>•</span>
                      <span>{document.total_chunks} chunks</span>
                    </>
                  )}
                </div>
              )}

              {/* Processing status */}
              <div className="mt-2">
                <StatusBadge status={document.processing_status} />
              </div>

              {/* Error message if failed */}
              {document.processing_error && (
                <p className="mt-2 line-clamp-2 text-xs text-red-600">Error: {document.processing_error}</p>
              )}
            </div>
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="ml-4 flex items-center space-x-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onGenerateQuiz(document);
            }}
            disabled={!isReadyForQuiz}
            className={clsx(
              'flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold transition-colors',
              isReadyForQuiz
                ? 'border-blue-500 text-blue-600 hover:bg-blue-50'
                : 'cursor-not-allowed border-gray-200 text-gray-300',
            )}
            title={
              isReadyForQuiz
                ? 'Generate an AI quiz from this document'
                : 'Quiz generation becomes available once processing is complete'
            }
          >
            <Sparkles className="h-4 w-4" />
            Quiz
          </button>

          {fileUrl && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                window.open(fileUrl, '_blank');
              }}
              className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              title="Download original"
            >
              <Download className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (!isDeleting) {
                onDelete(document.id);
              }
            }}
            disabled={isDeleting}
            className={clsx(
              'rounded-lg p-2 transition-colors',
              isDeleting ? 'cursor-not-allowed text-gray-300' : 'text-red-500 hover:bg-red-50 hover:text-red-700',
            )}
            title="Delete document"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * DocumentList component for displaying all documents in a subject.
 *
 * Features:
 * - Automatic data fetching on mount
 * - Real-time status updates for processing documents
 * - Delete confirmation and handling
 * - Empty state for no documents
 * - Loading and error states
 */
export const DocumentList: React.FC<DocumentListProps> = ({
  subjectId,
  includesFailed = false,
  onDocumentClick,
  compact = false,
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [processingDocIds, setProcessingDocIds] = useState<Set<string>>(new Set());
  const [quizDocument, setQuizDocument] = useState<Document | null>(null);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);

  const {
    documentsBySubject,
    isLoading,
    errors,
    fetchDocuments,
    deleteDocument,
    startStatusPolling,
    clearErrors,
  } = useDocumentsStore();

  const documents = documentsBySubject[subjectId] || [];

  useEffect(() => {
    fetchDocuments(subjectId, 1, includesFailed).catch(() => {
      /* handled by store */
    });
  }, [subjectId, includesFailed, fetchDocuments]);

  useEffect(() => {
    const stops: Array<() => void> = [];

    documents.forEach((doc) => {
      const isProcessing = [
        ProcessingStatus.PENDING,
        ProcessingStatus.PARSING,
        ProcessingStatus.CHUNKING,
        ProcessingStatus.EMBEDDING,
      ].includes(doc.processing_status);

      if (isProcessing && !processingDocIds.has(doc.id)) {
        const stop = startStatusPolling(
          doc.id,
          3000,
          () => {
            fetchDocuments(subjectId, 1, includesFailed);
            setProcessingDocIds((prev) => {
              const next = new Set(prev);
              next.delete(doc.id);
              return next;
            });
          },
          () => {
            fetchDocuments(subjectId, 1, includesFailed);
            setProcessingDocIds((prev) => {
              const next = new Set(prev);
              next.delete(doc.id);
              return next;
            });
          },
        );

        stops.push(stop);
        setProcessingDocIds((prev) => new Set(prev).add(doc.id));
      }
    });

    return () => {
      stops.forEach((stop) => stop());
    };
  }, [documents, fetchDocuments, includesFailed, processingDocIds, startStatusPolling, subjectId]);

  const handleDelete = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }

    setDeletingId(documentId);
    try {
      await deleteDocument(documentId, subjectId);
    } finally {
      setDeletingId(null);
    }
  };

  const handleGenerateQuiz = (document: Document) => {
    setQuizDocument(document);
    setIsQuizModalOpen(true);
  };

  const handleCloseQuiz = () => {
    setIsQuizModalOpen(false);
    setQuizDocument(null);
  };

  if (isLoading.fetch && documents.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (errors.fetch) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-start">
          <AlertCircle className="mt-0.5 h-5 w-5 text-red-500" />
          <div className="ml-3">
            <p className="text-sm text-red-700">Failed to load documents</p>
            <p className="mt-1 text-xs text-red-600">{errors.fetch}</p>
            <button
              type="button"
              onClick={() => {
                clearErrors();
                fetchDocuments(subjectId, 1, includesFailed);
              }}
              className="mt-2 text-xs text-red-700 underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="py-12 text-center">
        <FileX className="mx-auto mb-4 h-12 w-12 text-gray-300" />
        <h3 className="mb-2 text-lg font-medium text-gray-900">No documents yet</h3>
        <p className="text-sm text-gray-500">Upload your first document to enable intelligent search</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {documents.map((document) => (
          <DocumentItem
            key={document.id}
            document={document}
            onDelete={handleDelete}
            onClick={onDocumentClick}
            onGenerateQuiz={handleGenerateQuiz}
            compact={compact}
            isDeleting={deletingId === document.id}
          />
        ))}
      </div>

      <DocumentQuizModal document={quizDocument} isOpen={isQuizModalOpen} onClose={handleCloseQuiz} />
    </>
  );
};

export default DocumentList;