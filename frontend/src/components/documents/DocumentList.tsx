/**
 * @file DocumentList component for displaying documents in a subject.
 * 
 * This component shows all documents uploaded to a subject with:
 * - Processing status indicators
 * - File information display
 * - Action buttons (view, delete)
 * - Empty state handling
 * - Loading and error states
 */

import React, { useEffect, useState } from 'react';
import { 
  Trash2, 
  Download, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  FileX
} from 'lucide-react';
import { useDocumentsStore } from '@/store/documentsStore';
import { Document, ProcessingStatus } from '@/types';
import clsx from 'clsx';

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
  // Check by MIME type
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
  const getStatusConfig = () => {
    switch (status) {
      case ProcessingStatus.PENDING:
        return {
          icon: <Clock className="w-3 h-3" />,
          text: 'Pending',
          className: 'bg-gray-100 text-gray-700'
        };
      case ProcessingStatus.PARSING:
        return {
          icon: <Loader2 className="w-3 h-3 animate-spin" />,
          text: 'Parsing',
          className: 'bg-blue-100 text-blue-700'
        };
      case ProcessingStatus.CHUNKING:
        return {
          icon: <Loader2 className="w-3 h-3 animate-spin" />,
          text: 'Chunking',
          className: 'bg-blue-100 text-blue-700'
        };
      case ProcessingStatus.EMBEDDING:
        return {
          icon: <Loader2 className="w-3 h-3 animate-spin" />,
          text: 'Embedding',
          className: 'bg-purple-100 text-purple-700'
        };
      case ProcessingStatus.COMPLETED:
        return {
          icon: <CheckCircle className="w-3 h-3" />,
          text: 'Ready',
          className: 'bg-green-100 text-green-700'
        };
      case ProcessingStatus.FAILED:
        return {
          icon: <AlertCircle className="w-3 h-3" />,
          text: 'Failed',
          className: 'bg-red-100 text-red-700'
        };
      default:
        return {
          icon: null,
          text: status,
          className: 'bg-gray-100 text-gray-700'
        };
    }
  };
  
  const config = getStatusConfig();
  
  return (
    <span className={clsx(
      'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
      config.className
    )}>
      {config.icon && <span className="mr-1">{config.icon}</span>}
      {config.text}
    </span>
  );
};

/**
 * Component to render a single document item.
 * Shows document info, status, and actions.
 */
const DocumentItem: React.FC<{
  document: Document;
  onDelete: (id: string) => void;
  onClick?: (document: Document) => void;
  compact?: boolean;
  isDeleting?: boolean;
}> = ({ document, onDelete, onClick, compact, isDeleting }) => {
  const fileIcon = getFileIcon(document.file_type, document.filename);
  
  return (
    <div className={clsx(
      'bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow',
      onClick && 'cursor-pointer'
    )}>
      <div className="flex items-start justify-between">
        {/* Left side - File info */}
        <div 
          className="flex-1 min-w-0"
          onClick={() => onClick?.(document)}
        >
          <div className="flex items-start space-x-3">
            {/* File icon */}
            <span className="text-2xl flex-shrink-0">{fileIcon}</span>
            
            {/* File details */}
            <div className="flex-1 min-w-0">
              {/* Filename - truncate if too long */}
              <h4 className="text-sm font-medium text-gray-900 truncate">
                {document.filename}
              </h4>
              
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
                <p className="mt-2 text-xs text-red-600 line-clamp-2">
                  Error: {document.processing_error}
                </p>
              )}
            </div>
          </div>
        </div>
        
        {/* Right side - Actions */}
        <div className="flex items-center space-x-2 ml-4">
          {/* Download button (if file URL exists) */}
          {document.file_url && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(document.file_url, '_blank');
              }}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Download original"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          
          {/* Delete button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isDeleting) {
                onDelete(document.id);
              }
            }}
            disabled={isDeleting}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              isDeleting 
                ? 'text-gray-300 cursor-not-allowed' 
                : 'text-red-500 hover:text-red-700 hover:bg-red-50'
            )}
            title="Delete document"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
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
  compact = false
}) => {
  // ============================================================================
  // STATE & STORE
  // ============================================================================
  
  /**
   * Track which document is being deleted.
   * Used to show loading state on delete button.
   */
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  /**
   * Track documents that are processing.
   * Used to set up polling for status updates.
   */
  const [processingDocIds, setProcessingDocIds] = useState<Set<string>>(new Set());
  
  // Get data and actions from store
  const {
    documentsBySubject,
    isLoading,
    errors,
    fetchDocuments,
    deleteDocument,
    startStatusPolling,
    clearErrors
  } = useDocumentsStore();
  
  // Get documents for this subject
  const documents = documentsBySubject[subjectId] || [];
  
  // ============================================================================
  // EFFECTS
  // ============================================================================
  
  /**
   * Fetch documents when component mounts or subjectId changes.
   */
  useEffect(() => {
    fetchDocuments(subjectId, 1, includesFailed);
  }, [subjectId, includesFailed]);
  
  /**
   * Set up polling for documents that are processing.
   * Polls status every 3 seconds until processing completes.
   */
  useEffect(() => {
    const intervals: (() => void)[] = [];
    
    documents.forEach(doc => {
      // Check if document is in a processing state
      const isProcessing = [
        ProcessingStatus.PENDING,
        ProcessingStatus.PARSING,
        ProcessingStatus.CHUNKING,
        ProcessingStatus.EMBEDDING
      ].includes(doc.processing_status);
      
      if (isProcessing && !processingDocIds.has(doc.id)) {
        // Start polling for this document
        const stopPolling = startStatusPolling(
          doc.id,
          3000, // Poll every 3 seconds
          () => {
            // On complete, refresh the list
            fetchDocuments(subjectId, 1, includesFailed);
            setProcessingDocIds(prev => {
              const next = new Set(prev);
              next.delete(doc.id);
              return next;
            });
          },
          () => {
            // On error, refresh the list
            fetchDocuments(subjectId, 1, includesFailed);
            setProcessingDocIds(prev => {
              const next = new Set(prev);
              next.delete(doc.id);
              return next;
            });
          }
        );
        
        intervals.push(stopPolling);
        setProcessingDocIds(prev => new Set(prev).add(doc.id));
      }
    });
    
    // Cleanup function to stop all polling
    return () => {
      intervals.forEach(stop => stop());
    };
  }, [documents]);
  
  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  
  /**
   * Handles document deletion with confirmation.
   */
  const handleDelete = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }
    
    setDeletingId(documentId);
    try {
      await deleteDocument(documentId, subjectId);
      // Success - list will be refreshed automatically by the store
    } catch (error) {
      // Error is handled by the store
    } finally {
      setDeletingId(null);
    }
  };
  
  // ============================================================================
  // RENDER
  // ============================================================================
  
  // Loading state
  if (isLoading.fetch && documents.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }
  
  // Error state
  if (errors.fetch) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
          <div className="ml-3">
            <p className="text-sm text-red-700">Failed to load documents</p>
            <p className="text-xs text-red-600 mt-1">{errors.fetch}</p>
            <button
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
  
  // Empty state
  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <FileX className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No documents yet
        </h3>
        <p className="text-sm text-gray-500">
          Upload your first document to enable intelligent search
        </p>
      </div>
    );
  }
  
  // Document list
  return (
    <div className="space-y-3">
      {documents.map(document => (
        <DocumentItem
          key={document.id}
          document={document}
          onDelete={handleDelete}
          onClick={onDocumentClick}
          compact={compact}
          isDeleting={deletingId === document.id}
        />
      ))}
    </div>
  );
};

export default DocumentList;