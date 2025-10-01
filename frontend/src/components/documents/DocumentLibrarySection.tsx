import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  FileWarning,
  Loader2,
  Sparkles,
} from 'lucide-react';
import clsx from 'clsx';

import { useDocumentsStore } from '@/store/documentsStore';
import { Document, ProcessingStatus } from '@/types';
import { DocumentActionMenu } from '@/components/documents/DocumentActionMenu';
import DocumentQuizModal from '@/components/documents/DocumentQuizModal';

interface DocumentLibrarySectionProps {
  subjectId: number;
  onRequestUpload: () => void;
}

const isProcessingStatus = (status: ProcessingStatus) => [
  ProcessingStatus.PENDING,
  ProcessingStatus.PARSING,
  ProcessingStatus.CHUNKING,
  ProcessingStatus.EMBEDDING,
].includes(status);

const getFileIcon = (fileType: string, filename: string) => {
  if (fileType.includes('pdf')) return '📄';
  if (fileType.includes('word') || filename.endsWith('.docx')) return '📝';
  if (fileType.includes('text')) return '📃';
  if (filename.endsWith('.md')) return '📑';
  return '📎';
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const normalizeFileType = (fileType: string): string => {
  if (!fileType) return 'Unknown';
  if (fileType.includes('pdf')) return 'PDF';
  if (fileType.includes('word')) return 'DOCX';
  if (fileType.includes('text/plain')) return 'Text';
  if (fileType.includes('markdown')) return 'Markdown';
  return fileType.split('/').pop()?.toUpperCase() ?? fileType;
};

const StatusBadge: React.FC<{ status: ProcessingStatus }> = ({ status }) => {
  const { icon, label, className } = useMemo(() => {
    switch (status) {
      case ProcessingStatus.PENDING:
        return {
          icon: <Clock className="h-3 w-3" />, label: 'Pending', className: 'bg-gray-100 text-gray-700',
        };
      case ProcessingStatus.PARSING:
      case ProcessingStatus.CHUNKING:
      case ProcessingStatus.EMBEDDING:
        return {
          icon: <Loader2 className="h-3 w-3 animate-spin" />, label: 'Processing', className: 'bg-blue-100 text-blue-700',
        };
      case ProcessingStatus.COMPLETED:
        return {
          icon: <CheckCircle className="h-3 w-3" />, label: 'Ready', className: 'bg-green-100 text-green-700',
        };
      case ProcessingStatus.FAILED:
        return {
          icon: <FileWarning className="h-3 w-3" />, label: 'Failed', className: 'bg-red-100 text-red-700',
        };
      default:
        return { icon: null, label: status, className: 'bg-gray-100 text-gray-700' };
    }
  }, [status]);

  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium', className)}>
      {icon}
      {label}
    </span>
  );
};

export const DocumentLibrarySection: React.FC<DocumentLibrarySectionProps> = ({
  subjectId,
  onRequestUpload,
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [processingDocIds, setProcessingDocIds] = useState<Set<string>>(new Set());
  const [quizDocument, setQuizDocument] = useState<Document | null>(null);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);

  const {
    documentsBySubject,
    fetchDocuments,
    isLoading,
    errors,
    deleteDocument,
    startStatusPolling,
    clearErrors,
  } = useDocumentsStore();

  const documents = useMemo(
    () => documentsBySubject[subjectId] ?? [],
    [documentsBySubject, subjectId]
  );

  useEffect(() => {
    fetchDocuments(subjectId, 1, true).catch(() => {
      /* handled by store */
    });
  }, [subjectId, fetchDocuments]);

  useEffect(() => {
    const stopPollingCallbacks: Array<() => void> = [];

    documents.forEach((doc) => {
      if (isProcessingStatus(doc.processing_status) && !processingDocIds.has(doc.id)) {
        const stop = startStatusPolling(
          doc.id,
          3000,
          () => {
            fetchDocuments(subjectId, 1, true);
            setProcessingDocIds((prev) => {
              const next = new Set(prev);
              next.delete(doc.id);
              return next;
            });
          },
          () => {
            fetchDocuments(subjectId, 1, true);
            setProcessingDocIds((prev) => {
              const next = new Set(prev);
              next.delete(doc.id);
              return next;
            });
          },
        );

        stopPollingCallbacks.push(stop);
        setProcessingDocIds((prev) => {
          const next = new Set(prev);
          next.add(doc.id);
          return next;
        });
      }
    });

    return () => {
      stopPollingCallbacks.forEach((stop) => stop());
    };
  }, [documents, fetchDocuments, processingDocIds, startStatusPolling, subjectId]);

  useEffect(() => {
    setProcessingDocIds((prev) => {
      const next = new Set(prev);
      let changed = false;

      prev.forEach((id) => {
        const doc = documents.find((item) => item.id === id);
        if (!doc || !isProcessingStatus(doc.processing_status)) {
          next.delete(id);
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [documents]);

  const handleDelete = async (documentId: string) => {
    if (!window.confirm('Delete this document? This action cannot be undone.')) {
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

  const renderTableBody = () => {
    if (documents.length === 0) {
      return (
        <tr>
          <td colSpan={5} className="px-6 py-10 text-center">
            <div className="flex flex-col items-center gap-3 text-gray-500">
              <Sparkles className="h-10 w-10 text-gray-300" />
              <div>
                <p className="text-sm font-semibold text-gray-700">No documents yet</p>
                <p className="text-sm">Upload your first study material to get started.</p>
              </div>
              <button
                type="button"
                onClick={onRequestUpload}
                className="btn-primary px-4 py-2"
              >
                Add Document
              </button>
            </div>
          </td>
        </tr>
      );
    }

    return documents.map((document) => {
      const isDeleting = deletingId === document.id;
      const isReadyForQuiz = document.is_ready && document.processing_status === ProcessingStatus.COMPLETED;

      return (
        <tr key={document.id} className="hover:bg-gray-50">
          <td className="whitespace-nowrap px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{getFileIcon(document.file_type, document.filename)}</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">{document.filename}</p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(document.file_size)} • {document.total_chunks || 0} chunks
                </p>
              </div>
            </div>
          </td>
          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
            {formatDate(document.created_at)}
          </td>
          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
            {normalizeFileType(document.file_type)}
          </td>
          <td className="px-6 py-4">
            <div className="flex items-center gap-2">
              <StatusBadge status={document.processing_status} />
              {document.processing_error && (
                <span className="text-xs text-red-600">{document.processing_error}</span>
              )}
            </div>
          </td>
          <td className="px-6 py-4">
            <div className="flex justify-end">
              <DocumentActionMenu
                onGenerateQuiz={() => handleGenerateQuiz(document)}
                onDownload={document.file_url ? () => window.open(document.file_url, '_blank') : undefined}
                onDelete={() => handleDelete(document.id)}
                isDeleting={isDeleting}
                disableDownload={!document.file_url}
                disableQuiz={!isReadyForQuiz}
              />
            </div>
          </td>
        </tr>
      );
    });
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-gray-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Document Library</h2>
          <p className="text-sm text-gray-600">Upload, review, and manage your study materials.</p>
        </div>
        <div className="flex items-center gap-3">
          {errors.fetch && (
            <button
              type="button"
              onClick={() => {
                clearErrors();
                fetchDocuments(subjectId, 1, true).catch(() => {
                  /* handled by store */
                });
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              <AlertCircle className="h-4 w-4" />
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={onRequestUpload}
            className="btn-primary px-4 py-2"
          >
            Upload Document
          </button>
        </div>
      </div>

      {errors.fetch && (
        <div className="flex items-start gap-3 border-b border-red-100 bg-red-50 px-6 py-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-medium">We couldn’t load your documents.</p>
            <p className="mt-1 text-xs">{errors.fetch}</p>
          </div>
        </div>
      )}

      <div className="relative overflow-hidden">
        {isLoading.fetch && documents.length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Document</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Uploaded</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Type</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {renderTableBody()}
            </tbody>
          </table>
        </div>
      </div>

      <DocumentQuizModal
        document={quizDocument}
        isOpen={isQuizModalOpen}
        onClose={handleCloseQuiz}
      />
    </section>
  );
};

export default DocumentLibrarySection;
