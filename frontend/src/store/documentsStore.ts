/**
 * @file Zustand store for document management state.
 * 
 * This store manages all document-related state including:
 * - Document lists per subject
 * - Upload progress tracking
 * - Processing status monitoring
 * - Error handling
 * 
 * The store follows the same patterns as authStore for consistency.
 */

import { create } from 'zustand';
import { 
  Document, 
  DocumentUploadResponse, 
  DocumentProcessingStatus,
  UploadProgress,
  ProcessingStatus 
} from '@/types';
import api from '@/services/api';

/**
 * Interface defining the shape of the documents store.
 * Split into state properties and actions for clarity.
 */
interface DocumentsState {
  // ============================================================================
  // STATE PROPERTIES
  // ============================================================================
  
  /**
   * Map of documents organized by subject ID.
   * Structure: { [subjectId]: Document[] }
   * This allows efficient retrieval of documents per subject.
   */
  documentsBySubject: Record<number, Document[]>;
  
  /**
   * Currently selected/viewed document.
   * Used for detail views and status monitoring.
   */
  currentDocument: Document | null;
  
  /**
   * Map tracking upload progress for multiple files.
   * Key is a unique upload ID (usually filename + timestamp).
   * This allows simultaneous uploads with individual progress tracking.
   */
  uploadProgress: Record<string, UploadProgress>;
  
  /**
   * Map tracking processing status for documents.
   * Key is document ID, value is the latest status.
   * Used for real-time status updates via polling.
   */
  processingStatus: Record<string, DocumentProcessingStatus>;
  
  /**
   * Loading states for different operations.
   * Granular loading states provide better UX.
   */
  isLoading: {
    fetch: boolean;      // Loading document list
    upload: boolean;     // Uploading file
    delete: boolean;     // Deleting document
    status: boolean;     // Checking processing status
  };
  
  /**
   * Error messages for different operations.
   * Allows showing specific errors in different UI components.
   */
  errors: {
    fetch: string | null;
    upload: string | null;
    delete: string | null;
    status: string | null;
  };
  
  /**
   * Pagination information for document lists.
   * Tracks current page and total for each subject.
   */
  pagination: Record<number, {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  }>;
  
  // ============================================================================
  // ACTIONS
  // ============================================================================
  
  /**
   * Fetches documents for a specific subject.
   * 
   * @param subjectId - The ID of the subject
   * @param page - Page number (1-based)
   * @param includesFailed - Whether to include failed documents
   * 
   * This action populates documentsBySubject and updates pagination.
   */
  fetchDocuments: (
    subjectId: number, 
    page?: number, 
    includesFailed?: boolean
  ) => Promise<void>;
  
  /**
   * Uploads a document to a subject.
   * 
   * @param subjectId - The subject to upload to
   * @param file - The file to upload
   * @param onProgress - Optional callback for progress updates
   * @returns The upload response with document ID
   * 
   * This action:
   * 1. Creates an upload progress entry
   * 2. Uploads the file with progress tracking
   * 3. Initiates background processing
   * 4. Returns document ID for status polling
   */
  uploadDocument: (
    subjectId: number,
    file: File,
    onProgress?: (progress: UploadProgress) => void
  ) => Promise<DocumentUploadResponse>;
  
  /**
   * Deletes a document.
   * 
   * @param documentId - The document to delete
   * @param subjectId - The subject it belongs to (for state update)
   * 
   * Removes the document from both backend and local state.
   */
  deleteDocument: (documentId: string, subjectId: number) => Promise<void>;
  
  /**
   * Checks the processing status of a document.
   * 
   * @param documentId - The document to check
   * @returns Current processing status
   * 
   * Used for polling to track processing progress.
   */
  checkDocumentStatus: (documentId: string) => Promise<DocumentProcessingStatus>;
  
  /**
   * Starts polling for document processing status.
   * 
   * @param documentId - The document to monitor
   * @param interval - Poll interval in milliseconds (default 2000)
   * @param onComplete - Callback when processing completes
   * @param onError - Callback if processing fails
   * @returns Function to stop polling
   * 
   * This creates an interval that polls the status endpoint
   * until the document is completed or failed.
   */
  startStatusPolling: (
    documentId: string,
    interval?: number,
    onComplete?: (doc: Document) => void,
    onError?: (error: string) => void
  ) => () => void;
  
  /**
   * Gets a specific document's details.
   * 
   * @param documentId - The document to fetch
   * 
   * Fetches full document details and sets as currentDocument.
   */
  getDocument: (documentId: string) => Promise<Document>;
  
  /**
   * Clears all documents for a subject from the store.
   * Useful when switching subjects or logging out.
   */
  clearSubjectDocuments: (subjectId: number) => void;
  
  /**
   * Clears all error states.
   * Called when dismissing error messages.
   */
  clearErrors: () => void;
  
  /**
   * Resets the entire store to initial state.
   * Called on logout or app reset.
   */
  reset: () => void;
}

/**
 * Initial state factory function.
 * Returns a fresh initial state object.
 */
const initialState = () => ({
  documentsBySubject: {},
  currentDocument: null,
  uploadProgress: {},
  processingStatus: {},
  isLoading: {
    fetch: false,
    upload: false,
    delete: false,
    status: false,
  },
  errors: {
    fetch: null,
    upload: null,
    delete: null,
    status: null,
  },
  pagination: {},
});

/**
 * The main documents store using Zustand.
 * Manages all document-related state and operations.
 */
export const useDocumentsStore = create<DocumentsState>((set, get) => ({
  // Initialize with default state
  ...initialState(),
  
  /**
   * Fetches documents for a subject with pagination.
   */
  fetchDocuments: async (subjectId, page = 1, includesFailed = false) => {
    // Set loading state and clear previous errors
    set(state => ({
      isLoading: { ...state.isLoading, fetch: true },
      errors: { ...state.errors, fetch: null }
    }));
    
    try {
      const response = await api.get(`/subjects/${subjectId}/documents`, {
        params: {
          page,
          size: 20,
          include_failed: includesFailed
        }
      });
      
      // Update store with fetched documents
      set(state => ({
        documentsBySubject: {
          ...state.documentsBySubject,
          [subjectId]: response.data.items
        },
        pagination: {
          ...state.pagination,
          [subjectId]: {
            currentPage: response.data.page,
            totalPages: response.data.pages,
            totalItems: response.data.total,
            itemsPerPage: response.data.size
          }
        },
        isLoading: { ...state.isLoading, fetch: false }
      }));
      
    } catch (error: any) {
      set(state => ({
        isLoading: { ...state.isLoading, fetch: false },
        errors: { 
          ...state.errors, 
          fetch: error.response?.data?.detail || 'Failed to fetch documents' 
        }
      }));
      throw error;
    }
  },
  
  /**
   * Uploads a document with progress tracking.
   */
  uploadDocument: async (subjectId, file, onProgress) => {
    // Generate unique upload ID
    const uploadId = `${file.name}_${Date.now()}`;
    
    // Initialize upload progress
    const progressData: UploadProgress = {
      filename: file.name,
      loaded: 0,
      total: file.size,
      percentage: 0,
      status: 'pending'
    };
    
    // Update store with initial progress
    set(state => ({
      uploadProgress: {
        ...state.uploadProgress,
        [uploadId]: progressData
      },
      isLoading: { ...state.isLoading, upload: true },
      errors: { ...state.errors, upload: null }
    }));
    
    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', file);
      
      // Upload with progress tracking
      const response = await api.post<DocumentUploadResponse>(
        `/subjects/${subjectId}/documents`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            // Calculate and update progress
            const percentage = progressEvent.total 
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0;
            
            const progress: UploadProgress = {
              documentId: progressData.documentId,
              filename: file.name,
              loaded: progressEvent.loaded,
              total: progressEvent.total || file.size,
              percentage,
              status: percentage === 100 ? 'processing' : 'uploading'
            };
            
            // Update store
            set(state => ({
              uploadProgress: {
                ...state.uploadProgress,
                [uploadId]: progress
              }
            }));
            
            // Call external progress callback if provided
            onProgress?.(progress);
          }
        }
      );
      
      // Update progress with document ID
      set(state => ({
        uploadProgress: {
          ...state.uploadProgress,
          [uploadId]: {
            ...state.uploadProgress[uploadId],
            documentId: response.data.document_id,
            status: 'processing'
          }
        },
        isLoading: { ...state.isLoading, upload: false }
      }));
      
      // Refresh document list
      await get().fetchDocuments(subjectId);
      
      return response.data;
      
    } catch (error: any) {
      // Update progress to show error
      set(state => ({
        uploadProgress: {
          ...state.uploadProgress,
          [uploadId]: {
            ...state.uploadProgress[uploadId],
            status: 'error',
            error: error.response?.data?.detail || 'Upload failed'
          }
        },
        isLoading: { ...state.isLoading, upload: false },
        errors: { 
          ...state.errors, 
          upload: error.response?.data?.detail || 'Failed to upload document' 
        }
      }));
      throw error;
    }
  },
  
  /**
   * Deletes a document from the system.
   */
  deleteDocument: async (documentId, subjectId) => {
    set(state => ({
      isLoading: { ...state.isLoading, delete: true },
      errors: { ...state.errors, delete: null }
    }));
    
    try {
      await api.delete(`/documents/${documentId}`);
      
      // Remove from local state
      set(state => ({
        documentsBySubject: {
          ...state.documentsBySubject,
          [subjectId]: state.documentsBySubject[subjectId]?.filter(
            doc => doc.id !== documentId
          ) || []
        },
        isLoading: { ...state.isLoading, delete: false }
      }));
      
    } catch (error: any) {
      set(state => ({
        isLoading: { ...state.isLoading, delete: false },
        errors: { 
          ...state.errors, 
          delete: error.response?.data?.detail || 'Failed to delete document' 
        }
      }));
      throw error;
    }
  },
  
  /**
   * Checks document processing status.
   */
  checkDocumentStatus: async (documentId) => {
    try {
      const response = await api.get<DocumentProcessingStatus>(
        `/documents/${documentId}/status`
      );
      
      // Update store with latest status
      set(state => ({
        processingStatus: {
          ...state.processingStatus,
          [documentId]: response.data
        }
      }));
      
      return response.data;
      
    } catch (error: any) {
      set(state => ({
        errors: { 
          ...state.errors, 
          status: error.response?.data?.detail || 'Failed to check status' 
        }
      }));
      throw error;
    }
  },
  
  /**
   * Starts polling for document status updates.
   */
  startStatusPolling: (documentId, interval = 2000, onComplete, onError) => {
    // Create polling interval
    const pollInterval = setInterval(async () => {
      try {
        const status = await get().checkDocumentStatus(documentId);
        
        // Check if processing is complete
        if (status.status === ProcessingStatus.COMPLETED) {
          clearInterval(pollInterval);
          
          // Fetch full document details
          const document = await get().getDocument(documentId);
          onComplete?.(document);
          
          // Update upload progress if exists
          const uploadEntry = Object.entries(get().uploadProgress).find(
            ([_, progress]) => progress.documentId === documentId
          );
          if (uploadEntry) {
            set(state => ({
              uploadProgress: {
                ...state.uploadProgress,
                [uploadEntry[0]]: {
                  ...state.uploadProgress[uploadEntry[0]],
                  status: 'completed'
                }
              }
            }));
          }
        }
        
        // Check if processing failed
        if (status.status === ProcessingStatus.FAILED) {
          clearInterval(pollInterval);
          onError?.(status.processing_error || 'Processing failed');
          
          // Update upload progress if exists
          const uploadEntry = Object.entries(get().uploadProgress).find(
            ([_, progress]) => progress.documentId === documentId
          );
          if (uploadEntry) {
            set(state => ({
              uploadProgress: {
                ...state.uploadProgress,
                [uploadEntry[0]]: {
                  ...state.uploadProgress[uploadEntry[0]],
                  status: 'error',
                  error: status.processing_error
                }
              }
            }));
          }
        }
      } catch (error) {
        // Don't stop polling on error, might be temporary
        console.error('Polling error:', error);
      }
    }, interval);
    
    // Return function to stop polling
    return () => clearInterval(pollInterval);
  },
  
  /**
   * Fetches full document details.
   */
  getDocument: async (documentId) => {
    set(state => ({
      isLoading: { ...state.isLoading, fetch: true }
    }));
    
    try {
      const response = await api.get<Document>(`/documents/${documentId}`);
      
      set(state => ({
        currentDocument: response.data,
        isLoading: { ...state.isLoading, fetch: false }
      }));
      
      return response.data;
      
    } catch (error: any) {
      set(state => ({
        isLoading: { ...state.isLoading, fetch: false },
        errors: { 
          ...state.errors, 
          fetch: error.response?.data?.detail || 'Failed to fetch document' 
        }
      }));
      throw error;
    }
  },
  
  /**
   * Clears documents for a specific subject.
   */
  clearSubjectDocuments: (subjectId) => {
    set(state => {
      const newDocumentsBySubject = { ...state.documentsBySubject };
      delete newDocumentsBySubject[subjectId];
      
      const newPagination = { ...state.pagination };
      delete newPagination[subjectId];
      
      return {
        documentsBySubject: newDocumentsBySubject,
        pagination: newPagination
      };
    });
  },
  
  /**
   * Clears all error states.
   */
  clearErrors: () => {
    set({
      errors: {
        fetch: null,
        upload: null,
        delete: null,
        status: null,
      }
    });
  },
  
  /**
   * Resets the store to initial state.
   */
  reset: () => {
    set(initialState());
  }
}));