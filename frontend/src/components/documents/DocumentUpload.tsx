/**
 * @file DocumentUpload component for handling file uploads with drag-and-drop.
 * 
 * This component provides a user-friendly interface for uploading documents
 * to a subject. It features:
 * - Drag and drop support
 * - File type and size validation
 * - Upload progress tracking
 * - Real-time processing status
 * 
 * The component handles the entire upload flow from file selection to
 * processing completion.
 */

import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useDocumentsStore } from '@/store/documentsStore';
import { ProcessingStatus, UploadProgress } from '@/types';
import clsx from 'clsx';

/**
 * Props for the DocumentUpload component.
 */
interface DocumentUploadProps {
  /**
   * The ID of the subject to upload documents to.
   */
  subjectId: number;
  
  /**
   * Callback triggered when upload completes successfully.
   * Useful for refreshing lists or showing success messages.
   */
  onUploadComplete?: (documentId: string) => void;
  
  /**
   * Callback triggered when upload fails.
   */
  onUploadError?: (error: string) => void;
  
  /**
   * Maximum file size in MB (default: 50).
   */
  maxSizeMB?: number;
  
  /**
   * Whether to show the component in compact mode.
   */
  compact?: boolean;
}

/**
 * Allowed file types for upload.
 * Maps MIME types to user-friendly descriptions.
 */
const ALLOWED_FILE_TYPES = {
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'text/markdown': '.md',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
};

/**
 * Helper function to format file size for display.
 * Converts bytes to human-readable format (KB, MB, GB).
 */
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

/**
 * DocumentUpload component for uploading and processing documents.
 * 
 * This component provides a complete upload experience with:
 * 1. Drag-and-drop or click-to-select file input
 * 2. Client-side validation (type and size)
 * 3. Upload progress visualization
 * 4. Processing status tracking
 * 5. Error handling and retry
 */
export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  subjectId,
  onUploadComplete,
  onUploadError,
  maxSizeMB = 50,
  compact = false
}) => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  /**
   * Track whether user is dragging a file over the drop zone.
   * Used for visual feedback during drag operations.
   */
  const [isDragging, setIsDragging] = useState(false);
  
  /**
   * Currently selected file before upload.
   * Allows user to review selection before confirming.
   */
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  /**
   * Current upload/processing progress.
   * Shows real-time progress during upload and processing.
   */
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  
  /**
   * Current processing status from backend.
   * Updated via polling after upload completes.
   */
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);
  
  /**
   * Error message to display to user.
   */
  const [error, setError] = useState<string | null>(null);
  
  /**
   * Reference to hidden file input element.
   * Used to programmatically trigger file selection dialog.
   */
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  /**
   * Reference to polling interval for cleanup.
   */
  const pollingIntervalRef = useRef<(() => void) | null>(null);
  
  // Get actions from Zustand store
  const { uploadDocument, startStatusPolling } = useDocumentsStore();
  
  // ============================================================================
  // FILE VALIDATION
  // ============================================================================
  
  /**
   * Validates a file before upload.
   * Checks file type and size constraints.
   * 
   * @param file - The file to validate
   * @returns Error message if invalid, null if valid
   */
  const validateFile = (file: File): string | null => {
    // Check file type by MIME type
    const allowedMimes = Object.keys(ALLOWED_FILE_TYPES);
    if (!allowedMimes.includes(file.type)) {
      // Also check by extension as fallback
      const extension = file.name.toLowerCase().split('.').pop();
      const allowedExtensions = ['pdf', 'txt', 'md', 'docx'];
      if (!extension || !allowedExtensions.includes(extension)) {
        return `File type not supported. Please upload: ${Object.values(ALLOWED_FILE_TYPES).join(', ')}`;
      }
    }
    
    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return `File size (${formatFileSize(file.size)}) exceeds maximum allowed size of ${maxSizeMB}MB`;
    }
    
    return null; // File is valid
  };
  
  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  
  /**
   * Handles file selection from input or drop.
   * Validates the file and updates state.
   */
  const handleFileSelect = (file: File) => {
    // Clear previous state
    setError(null);
    setUploadProgress(null);
    setProcessingStatus(null);
    
    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      return;
    }
    
    // File is valid, set it as selected
    setSelectedFile(file);
  };
  
  /**
   * Handles drag over event for drop zone.
   * Prevents default browser behavior and shows visual feedback.
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);
  
  /**
   * Handles drag leave event for drop zone.
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);
  
  /**
   * Handles file drop event.
   * Extracts the first file and validates it.
   */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    // Get the first file from the drop
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, []);
  
  /**
   * Handles file selection from input element.
   */
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };
  
  /**
   * Handles the upload process for the selected file.
   * This includes uploading the file and monitoring its processing status.
   */
  const handleUpload = async () => {
    if (!selectedFile) return;
    
    try {
      // Clear any previous errors
      setError(null);
      
      // Upload the document with progress tracking
      const response = await uploadDocument(
        subjectId,
        selectedFile,
        (progress) => {
          // Update local progress state as upload progresses
          setUploadProgress(progress);
        }
      );
      
      // Start polling for processing status
      // The polling will check every 2 seconds until document is processed
      pollingIntervalRef.current = startStatusPolling(
        response.document_id,
        2000, // Poll every 2 seconds
        (document) => {
          // Called when processing completes successfully
          setProcessingStatus(ProcessingStatus.COMPLETED);
          setUploadProgress(prev => prev ? { ...prev, status: 'completed' } : null);
          onUploadComplete?.(document.id);
          
          // Reset after a delay to show success
          setTimeout(() => {
            resetUpload();
          }, 3000);
        },
        (error) => {
          // Called when processing fails
          setProcessingStatus(ProcessingStatus.FAILED);
          setError(error);
          onUploadError?.(error);
        }
      );
      
    } catch (err: any) {
      // Handle upload errors
      const errorMessage = err.response?.data?.detail || 'Failed to upload document';
      setError(errorMessage);
      onUploadError?.(errorMessage);
    }
  };
  
  /**
   * Cancels the current upload/processing.
   * Cleans up polling and resets state.
   */
  const handleCancel = () => {
    // Stop polling if active
    if (pollingIntervalRef.current) {
      pollingIntervalRef.current();
      pollingIntervalRef.current = null;
    }
    
    // Reset all state
    resetUpload();
  };
  
  /**
   * Resets the upload component to initial state.
   * Clears all selections, progress, and errors.
   */
  const resetUpload = () => {
    setSelectedFile(null);
    setUploadProgress(null);
    setProcessingStatus(null);
    setError(null);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // ============================================================================
  // RENDER HELPERS
  // ============================================================================
  
  /**
   * Renders the appropriate icon based on current state.
   * Shows different icons for different file types and states.
   */
  const renderIcon = () => {
    if (uploadProgress?.status === 'uploading' || processingStatus === ProcessingStatus.EMBEDDING) {
      return <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />;
    }
    if (uploadProgress?.status === 'completed' || processingStatus === ProcessingStatus.COMPLETED) {
      return <CheckCircle className="w-12 h-12 text-green-500" />;
    }
    if (uploadProgress?.status === 'error' || processingStatus === ProcessingStatus.FAILED) {
      return <AlertCircle className="w-12 h-12 text-red-500" />;
    }
    if (selectedFile) {
      return <FileText className="w-12 h-12 text-gray-400" />;
    }
    return <Upload className="w-12 h-12 text-gray-400" />;
  };
  
  /**
   * Gets status text to display to user.
   * Provides human-readable status messages for each processing stage.
   */
  const getStatusText = (): string => {
    if (uploadProgress?.status === 'uploading') {
      return `Uploading... ${uploadProgress.percentage}%`;
    }
    if (processingStatus === ProcessingStatus.PARSING) {
      return 'Extracting text from document...';
    }
    if (processingStatus === ProcessingStatus.CHUNKING) {
      return 'Splitting document into chunks...';
    }
    if (processingStatus === ProcessingStatus.EMBEDDING) {
      return 'Generating embeddings...';
    }
    if (processingStatus === ProcessingStatus.COMPLETED) {
      return 'Document processed successfully!';
    }
    if (processingStatus === ProcessingStatus.FAILED) {
      return 'Processing failed';
    }
    if (selectedFile) {
      return `Selected: ${selectedFile.name}`;
    }
    return 'Drag and drop or click to select a document';
  };
  
  // ============================================================================
  // COMPONENT RENDER
  // ============================================================================
  
  // Compact mode for inline upload (e.g., in modals)
  if (compact) {
    return (
      <div className="w-full">
        <input
          ref={fileInputRef}
          type="file"
          accept={Object.keys(ALLOWED_FILE_TYPES).join(',')}
          onChange={handleFileInputChange}
          className="hidden"
        />
        
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload Document
        </button>
        
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  }
  
  // Full upload interface
  return (
    <div className="w-full">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={Object.keys(ALLOWED_FILE_TYPES).join(',')}
        onChange={handleFileInputChange}
        className="hidden"
      />
      
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !selectedFile && fileInputRef.current?.click()}
        className={clsx(
          'relative border-2 border-dashed rounded-lg p-8 transition-all cursor-pointer',
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400',
          selectedFile && 'cursor-default',
          error && 'border-red-300 bg-red-50'
        )}
      >
        {/* Clear button when file is selected */}
        {selectedFile && !uploadProgress && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              resetUpload();
            }}
            className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        )}
        
        {/* Main content area */}
        <div className="flex flex-col items-center justify-center space-y-4">
          {/* Icon */}
          {renderIcon()}
          
          {/* Status text */}
          <div className="text-center">
            <p className={clsx(
              'text-lg font-medium',
              error ? 'text-red-600' : 'text-gray-700'
            )}>
              {getStatusText()}
            </p>
            
            {/* Additional info */}
            {!selectedFile && !uploadProgress && (
              <p className="mt-2 text-sm text-gray-500">
                Supported formats: PDF, DOCX, TXT, MD • Max size: {maxSizeMB}MB
              </p>
            )}
            
            {/* File info when selected */}
            {selectedFile && !uploadProgress && (
              <p className="mt-2 text-sm text-gray-500">
                Size: {formatFileSize(selectedFile.size)}
              </p>
            )}
            
            {/* Error message */}
            {error && (
              <p className="mt-2 text-sm text-red-600">
                {error}
              </p>
            )}
          </div>
          
          {/* Progress bar for upload/processing */}
          {uploadProgress && uploadProgress.percentage < 100 && (
            <div className="w-full max-w-xs">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress.percentage}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1 text-center">
                {formatFileSize(uploadProgress.loaded)} / {formatFileSize(uploadProgress.total)}
              </p>
            </div>
          )}
          
          {/* Processing stages indicator */}
          {processingStatus && processingStatus !== ProcessingStatus.COMPLETED && processingStatus !== ProcessingStatus.FAILED && (
            <div className="flex space-x-2 mt-4">
              <div className={clsx(
                'w-2 h-2 rounded-full',
                processingStatus === ProcessingStatus.PARSING ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'
              )} />
              <div className={clsx(
                'w-2 h-2 rounded-full',
                processingStatus === ProcessingStatus.CHUNKING ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'
              )} />
              <div className={clsx(
                'w-2 h-2 rounded-full',
                processingStatus === ProcessingStatus.EMBEDDING ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'
              )} />
            </div>
          )}
          
          {/* Action buttons */}
          {selectedFile && !uploadProgress && (
            <div className="flex space-x-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpload();
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Upload & Process
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  resetUpload();
                }}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
          
          {/* Cancel button during processing */}
          {uploadProgress && uploadProgress.status !== 'completed' && uploadProgress.status !== 'error' && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
      
      {/* Help text */}
      <div className="mt-4 text-xs text-gray-500">
        <p>📄 Your document will be processed to enable intelligent search</p>
        <p>🔒 Files are securely stored and only accessible by you</p>
      </div>
    </div>
  );
};

export default DocumentUpload;