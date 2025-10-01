// User related types
export interface User {
  id: number;
  email: string;
  username: string;
  full_name?: string;
  academic_level?: string;
  bio?: string;
  profile_picture_url?: string;
  show_profile_publicly: boolean;
  allow_ai_training: boolean;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  role: 'user' | 'admin' | 'super_admin'; 
}

export interface UserCreate {
  email: string;
  username: string;
  password: string;
  full_name?: string;
  academic_level?: string;
  bio?: string;
  show_profile_publicly?: boolean;
  allow_ai_training?: boolean;
}

export interface UserUpdate {
  full_name?: string;
  academic_level?: string;
  bio?: string;
  show_profile_publicly?: boolean;
  allow_ai_training?: boolean;
}

// Auth related types
export interface LoginCredentials {
  username: string; // Can be email or username
  password: string;
}

export interface Token {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface PasswordResetRequest {
  email: string;
}

// Subject related types
export interface Subject {
  id: number;
  name: string;
  description?: string;
  academic_year?: string;
  level?: string;
  category?: string;
  color?: string;
  icon?: string;
  is_active: boolean;
  is_archived: boolean;
  owner_id: number;
  created_at: string;
  updated_at: string;
}

export interface SubjectCreate {
  name: string;
  description?: string;
  academic_year?: string;
  level?: string;
  category?: string;
  color?: string;
  icon?: string;
}

export interface SubjectUpdate {
  name?: string;
  description?: string;
  academic_year?: string;
  level?: string;
  category?: string;
  color?: string;
  icon?: string;
  is_active?: boolean;
  is_archived?: boolean;
}

// API Response types
export interface ApiError {
  detail: string;
  status?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

// Form types
export interface FieldError {
  message: string;
  type: string;
}

// ============================================================================
// DOCUMENT MANAGEMENT TYPES
// ============================================================================

/**
 * Enumeration of all possible document processing states.
 * These states track the document through its processing pipeline.
 * 
 * Flow: PENDING → PARSING → CHUNKING → EMBEDDING → COMPLETED
 *       Any state can transition to FAILED if an error occurs
 */
export enum ProcessingStatus {
  PENDING = 'pending',       // File uploaded, waiting to start processing
  PARSING = 'parsing',       // Extracting text from the file (PDF/DOCX → text)
  CHUNKING = 'chunking',     // Splitting text into smaller segments
  EMBEDDING = 'embedding',   // Generating vector embeddings via OpenAI
  COMPLETED = 'completed',   // Ready for semantic search
  FAILED = 'failed'         // Processing encountered an error
}

/**
 * Represents a document stored in the system.
 * Documents are files uploaded by users that get processed for semantic search.
 * 
 * Each document belongs to a subject and goes through a processing pipeline
 * that extracts text, chunks it, and generates embeddings for search.
 */
export interface Document {
  id: string;                          // UUID identifier
  subject_id: number;                  // Which subject this document belongs to
  owner_id: number;                    // User who uploaded the document
  filename: string;                    // Original name of the uploaded file
  file_type: string;                   // MIME type (e.g., 'application/pdf')
  file_size: number;                   // Size in bytes
  file_url?: string;                   // Optional URL to download original file
  
  // Processing information
  processing_status: ProcessingStatus; // Current state in the pipeline
  total_chunks: number;                // Number of text chunks created
  processing_error?: string;           // Error message if status is FAILED
  processing_started_at?: string;      // ISO timestamp when processing began
  processing_completed_at?: string;    // ISO timestamp when processing finished
  processing_duration?: number;        // Time taken in seconds
  
  // Metadata and timestamps
  metadata: Record<string, any>;       // Flexible storage for additional info
  created_at: string;                  // When document was uploaded
  updated_at: string;                  // Last modification time
  
  // Computed fields (from backend)
  is_ready: boolean;                   // True if status is COMPLETED
}

/**
 * Data required to create a new document.
 * Most information is extracted from the uploaded file itself.
 */
export interface DocumentCreate {
  file: File;                          // The actual file object from input
  metadata?: Record<string, any>;      // Optional metadata to attach
}

/**
 * Response received after uploading a document.
 * Provides information needed to track the processing status.
 */
export interface DocumentUploadResponse {
  document_id: string;                 // UUID to track this document
  filename: string;                    // Confirmed filename
  file_size: number;                   // Confirmed size
  processing_status: ProcessingStatus; // Initial status (usually PENDING)
  message: string;                     // User-friendly status message
  status_endpoint: string;             // API endpoint to check progress
}

/**
 * Detailed processing status for a document.
 * Used for real-time progress tracking during processing.
 */
export interface DocumentProcessingStatus {
  document_id: string;
  status: ProcessingStatus;
  total_chunks?: number;               // Total chunks to process
  processed_chunks?: number;           // Chunks completed so far
  processing_started_at?: string;
  processing_completed_at?: string;
  processing_error?: string;
  estimated_time_remaining?: number;   // Seconds until completion
  progress_percentage?: number;        // 0-100 progress indicator
}

// ============================================================================
// QUIZ TYPES
// ============================================================================

export interface QuizOption {
  optionId: string;
  optionText: string;
}

export interface QuizQuestion {
  questionId: string;
  questionText: string;
  options: QuizOption[];
  correctOptionId: string;
}

export interface DocumentQuiz {
  quizTitle: string;
  questions: QuizQuestion[];
}

export interface DocumentQuizRequest {
  question_count: number;
}

export interface QuizQuestionResult {
  questionId: string;
  selectedOptionId: string | null;
  correctOptionId: string;
  isCorrect: boolean;
}

export interface QuizResultSummary {
  correctCount: number;
  totalQuestions: number;
  questionResults: QuizQuestionResult[];
}

export interface QuizExplanationRequest {
  documentId: string;
  questionText: string;
  userSelectedAnswer: string;
  correctAnswer: string;
  maxChunks?: number;
}

export interface QuizExplanationResponse {
  explanation: string;
}

/**
 * Tracks upload progress for file uploads.
 * Used to show progress bars during file upload.
 */
export interface UploadProgress {
  documentId?: string;                 // Set after upload starts
  filename: string;
  loaded: number;                      // Bytes uploaded so far
  total: number;                       // Total bytes to upload
  percentage: number;                  // 0-100 progress
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

/**
 * Represents a chunk of text from a document.
 * Documents are split into chunks for more granular search.
 */
export interface DocumentChunk {
  id: number;
  chunk_index: number;                 // Position in the document (0-based)
  chunk_text: string;                  // The actual text content
  start_char?: number;                 // Starting position in original
  end_char?: number;                   // Ending position in original
  metadata: Record<string, any>;
  has_embedding: boolean;              // Whether embedding was generated
  created_at: string;
}
