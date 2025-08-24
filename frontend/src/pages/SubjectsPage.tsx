/**
 * @file This file defines the SubjectsPage, a full-featured component for managing
 * a user's academic subjects with integrated document management.
 * It handles all CRUD operations for subjects and provides document upload/management
 * capabilities directly within each subject card.
 */

// React's core hooks for managing state and side effects.
import { useState, useEffect } from 'react';
// The primary hook from React Hook Form to manage form state and validation.
import { useForm } from 'react-hook-form';
// A comprehensive set of icons from the lucide-react library.
import { 
  Plus, 
  BookOpen, 
  Edit2, 
  Trash2, 
  X, 
  Calendar,
  Tag,
  Archive,
  MoreVertical,
  GraduationCap,
  Upload,
  ChevronDown,
  ChevronUp,
  Folder,
  FolderOpen
} from 'lucide-react';
// A utility to conditionally join CSS class names together.
import clsx from 'clsx';
// The configured Axios instance for making API calls.
import api from '@/services/api';
// TypeScript types defining the shape of subject and document data.
import { Subject, SubjectCreate, ProcessingStatus } from '@/types';
// Import our document components
import DocumentUpload from '@/components/documents/DocumentUpload';
import DocumentList from '@/components/documents/DocumentList';
// Import documents store for fetching documents
import { useDocumentsStore } from '@/store/documentsStore';

// ===================================================================================
// CONSTANTS
// These constants provide predefined options for the user when creating a subject.
// ===================================================================================
const COLORS = [
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#F59E0B', // amber
  '#10B981', // emerald
  '#14B8A6', // teal
  '#F97316', // orange
  '#EF4444', // red
];

/** A list of available icons (emojis) for subject representation. */
const ICONS = [
  { name: 'book', icon: '📚' },
  { name: 'math', icon: '🔢' },
  { name: 'science', icon: '🔬' },
  { name: 'language', icon: '💬' },
  { name: 'computer', icon: '💻' },
  { name: 'art', icon: '🎨' },
  { name: 'music', icon: '🎵' },
  { name: 'sport', icon: '⚽' },
];

/**
 * The SubjectsPage component provides a complete interface for managing subjects
 * with integrated document management capabilities.
 */
const SubjectsPage = () => {
  // ===================================================================================
  // STATE MANAGEMENT
  // All component-level state is managed here using React's `useState` hook.
  // ===================================================================================
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [deletingSubjectId, setDeletingSubjectId] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Get documents state from store
  const { documentsBySubject } = useDocumentsStore();

  // ===================================================================================
  // FORM MANAGEMENT
  // `react-hook-form` is used for robust and performant form handling.
  // ===================================================================================
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SubjectCreate>();

  // We "watch" these fields to update the UI in real-time as the user selects them.
  const selectedColor = watch('color') || COLORS[0];
  const selectedIcon = watch('icon') || ICONS[0].name;

  // ===================================================================================
  // DATA FETCHING & SIDE EFFECTS
  // `useEffect` is used to fetch data when the component mounts or dependencies change.
  // ===================================================================================

  // This effect triggers the data fetching process whenever the `showArchived` filter changes.
  useEffect(() => {
    fetchSubjects();
  }, [showArchived]);

  /**
   * Fetches the list of subjects from the API based on the current filter settings.
   */
  const fetchSubjects = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<Subject[]>('/subjects', {
        params: { include_archived: showArchived }
      });
      setSubjects(response.data);
      setError(null); // Clear previous errors on success
    } catch (error: any) {
      setError('Failed to load subjects');
      console.error('Error fetching subjects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ===================================================================================
  // EVENT HANDLERS & LOGIC
  // These functions handle user interactions and API mutations (Create, Update, Delete).
  // ===================================================================================

  /**
   * Opens the modal for either creating a new subject or editing an existing one.
   * @param subject - (Optional) The subject to be edited. If not provided, the modal opens in "create" mode.
   */
  const openModal = (subject?: Subject) => {
    if (subject) {
      // "Edit" mode: Set the subject to be edited and populate the form fields.
      setEditingSubject(subject);
      Object.keys(subject).forEach((key) => {
        setValue(key as any, (subject as any)[key]);
      });
    } else {
      // "Create" mode: Clear any editing state and reset the form with default values.
      setEditingSubject(null);
      reset({
        color: COLORS[0],
        icon: ICONS[0].name,
      });
    }
    setIsModalOpen(true);
  };

  /** Closes the modal and resets all related state. */
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSubject(null);
    reset();
  };

  /**
   * Handles the form submission for both creating and updating subjects.
   * @param data - The validated form data.
   */
  const onSubmit = async (data: SubjectCreate) => {
    try {
      if (editingSubject) {
        // Update logic: Send a PUT request to the specific subject's endpoint.
        const response = await api.put<Subject>(
          `/subjects/${editingSubject.id}`,
          data
        );
        // Update the local state optimistically to reflect the change immediately.
        setSubjects(subjects.map(s => 
          s.id === editingSubject.id ? response.data : s
        ));
      } else {
        // Create logic: Send a POST request to create a new subject.
        const response = await api.post<Subject>('/subjects', data);
        // Add the new subject to the local state.
        setSubjects([...subjects, response.data]);
      }
      closeModal();
    } catch (error: any) {
      console.error('Error saving subject:', error);
      setError(error.response?.data?.detail || 'Failed to save subject');
    }
  };

  /**
   * Deletes a subject after user confirmation.
   * @param id - The ID of the subject to delete.
   */
  const deleteSubject = async (id: number) => {
    // A simple `window.confirm` is used here for confirmation.
    if (!window.confirm('Are you sure you want to delete this subject?')) {
      return;
    }

    setDeletingSubjectId(id); // Used to disable the delete button during the API call.
    try {
      await api.delete(`/subjects/${id}`);
      // Remove the deleted subject from the local state.
      setSubjects(subjects.filter(s => s.id !== id));
    } catch (error: any) {
      console.error('Error deleting subject:', error);
      setError('Failed to delete subject');
    } finally {
      setDeletingSubjectId(null);
    }
  };

  /**
   * Toggles the `is_archived` status of a subject.
   * @param subject - The subject to archive or unarchive.
   */
  const toggleArchive = async (subject: Subject) => {
    try {
      const response = await api.put<Subject>(
        `/subjects/${subject.id}`,
        { is_archived: !subject.is_archived }
      );
      // Update the local state to reflect the change.
      setSubjects(subjects.map(s => 
        s.id === subject.id ? response.data : s
      ));
    } catch (error: any) {
      console.error('Error updating subject:', error);
      setError('Failed to update subject');
    }
  };

  // ===================================================================================
  // SUB-COMPONENTS
  // Breaking down the UI into smaller components makes the code more readable and reusable.
  // ===================================================================================

  /**
   * A presentational component that renders a single subject card with document management.
   * @param {object} props - The component props.
   * @param {Subject} props.subject - The subject data to display.
   */
  const SubjectCard = ({ subject }: { subject: Subject }) => {
    const [showMenu, setShowMenu] = useState(false);
    const icon = ICONS.find(i => i.name === subject.icon)?.icon || '📚';
    
    // ========================================================================
    // DOCUMENT MANAGEMENT STATE
    // ========================================================================
    
    /**
     * Controls whether the documents section is expanded.
     * Each subject card can independently show/hide its documents.
     */
    const [isDocumentsExpanded, setIsDocumentsExpanded] = useState(false);
    
    /**
     * Controls the visibility of the document upload interface.
     * When true, shows the upload component inline in the card.
     */
    const [showUploadInterface, setShowUploadInterface] = useState(false);
    
    /**
     * Tracks the number of documents for this subject.
     * Updated when documents are fetched or modified.
     */
    const [documentCount, setDocumentCount] = useState<number>(0);
    
    /**
     * Tracks how many documents are currently processing.
     * Used to show a loading indicator on the card.
     */
    const [processingCount, setProcessingCount] = useState<number>(0);
    
    // Get documents from the store for this subject
    const { documentsBySubject, fetchDocuments } = useDocumentsStore();
    const documents = documentsBySubject[subject.id] || [];
    
    // ========================================================================
    // EFFECTS FOR DOCUMENT DATA
    // ========================================================================
    
    /**
     * Fetch document count when component mounts or when documents change.
     * This provides a quick overview without expanding the section.
     */
    useEffect(() => {
      // Update counts based on fetched documents
      if (documents.length > 0) {
        setDocumentCount(documents.length);
        
        // Count processing documents
        const processing = documents.filter(doc => 
          [ProcessingStatus.PENDING, ProcessingStatus.PARSING, 
           ProcessingStatus.CHUNKING, ProcessingStatus.EMBEDDING].includes(doc.processing_status)
        ).length;
        setProcessingCount(processing);
      } else if (isDocumentsExpanded) {
        // If expanded but no documents loaded, fetch them
        fetchDocuments(subject.id);
      }
    }, [documents, subject.id, isDocumentsExpanded]);
    
    /**
     * Handles successful document upload.
     * Refreshes the document list and provides feedback.
     */
    const handleUploadComplete = (documentId: string) => {
      // Refresh document list
      fetchDocuments(subject.id);
      // Close upload interface after successful upload
      setShowUploadInterface(false);
      // Keep documents section expanded to show the new document
      setIsDocumentsExpanded(true);
    };
    
    /**
     * Toggles the documents section expansion.
     * Fetches documents on first expansion for performance.
     */
    const handleToggleDocuments = () => {
      const newExpanded = !isDocumentsExpanded;
      setIsDocumentsExpanded(newExpanded);
      
      // Fetch documents when expanding for the first time
      if (newExpanded && documents.length === 0) {
        fetchDocuments(subject.id);
      }
      
      // Close upload interface when collapsing
      if (!newExpanded) {
        setShowUploadInterface(false);
      }
    };

    return (
      <div 
        className={clsx(
          "bg-white rounded-xl shadow-sm border-2 relative transition-all hover:shadow-md",
          subject.is_archived && "opacity-60"
        )}
        style={{ borderColor: subject.color || '#e5e7eb' }}
      >
        {/* ================================================================
            CARD HEADER - Subject info and actions
            ================================================================ */}
        <div className="p-6">
          {/* Dropdown menu for actions */}
          <div className="absolute top-4 right-4">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:bg-gray-100 rounded-lg"
            >
              <MoreVertical className="w-5 h-5 text-gray-500" />
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                <button
                  onClick={() => {
                    openModal(subject);
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </button>
                <button
                  onClick={() => {
                    toggleArchive(subject);
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
                >
                  <Archive className="w-4 h-4 mr-2" />
                  {subject.is_archived ? 'Unarchive' : 'Archive'}
                </button>
                <button
                  onClick={() => {
                    deleteSubject(subject.id);
                    setShowMenu(false);
                  }}
                  disabled={deletingSubjectId === subject.id}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </button>
              </div>
            )}
          </div>

          {/* Main card content */}
          <div className="flex items-start space-x-4">
            <div 
              className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
              style={{ backgroundColor: `${subject.color}20` }}
            >
              {icon}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                {subject.name}
              </h3>
              {subject.description && (
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                  {subject.description}
                </p>
              )}
              {/* Metadata tags */}
              <div className="flex flex-wrap gap-2 mt-3">
                {subject.level && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                    <GraduationCap className="w-3 h-3 mr-1" />
                    {subject.level}
                  </span>
                )}
                {subject.academic_year && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                    <Calendar className="w-3 h-3 mr-1" />
                    {subject.academic_year}
                  </span>
                )}
                {subject.category && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                    <Tag className="w-3 h-3 mr-1" />
                    {subject.category}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* ================================================================
              DOCUMENTS SECTION HEADER - Shows count and toggle
              ================================================================ */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              {/* Documents toggle button with count */}
              <button
                onClick={handleToggleDocuments}
                className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                {isDocumentsExpanded ? (
                  <FolderOpen className="w-4 h-4" />
                ) : (
                  <Folder className="w-4 h-4" />
                )}
                <span className="font-medium">
                  Documents
                  {documentCount > 0 && (
                    <span className="ml-1 text-xs">
                      ({documentCount})
                    </span>
                  )}
                </span>
                {processingCount > 0 && (
                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                    {processingCount} processing
                  </span>
                )}
                {isDocumentsExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              
              {/* Quick upload button - always visible */}
              {!subject.is_archived && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDocumentsExpanded(true);
                    setShowUploadInterface(true);
                  }}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Upload document"
                >
                  <Upload className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* ================================================================
            EXPANDABLE DOCUMENTS SECTION
            ================================================================ */}
        {isDocumentsExpanded && (
          <div className="border-t border-gray-100 bg-gray-50/50">
            <div className="p-4 space-y-4">
              {/* Upload interface toggle button */}
              {!subject.is_archived && !showUploadInterface && (
                <button
                  onClick={() => setShowUploadInterface(true)}
                  className="w-full py-2 px-4 bg-white border-2 border-dashed border-gray-300 rounded-lg 
                           text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 
                           transition-colors flex items-center justify-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Document</span>
                </button>
              )}
              
              {/* Document upload component */}
              {showUploadInterface && !subject.is_archived && (
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  {/* Close button for upload interface */}
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-medium text-gray-900">
                      Upload Document
                    </h4>
                    <button
                      onClick={() => setShowUploadInterface(false)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                  
                  {/* Upload component */}
                  <DocumentUpload
                    subjectId={subject.id}
                    onUploadComplete={handleUploadComplete}
                    onUploadError={(error) => {
                      console.error('Upload error:', error);
                      // Could show a toast notification here
                    }}
                    compact={false}
                  />
                </div>
              )}
              
              {/* Document list */}
              <div className="space-y-2">
                <DocumentList
                  subjectId={subject.id}
                  compact={true}
                  onDocumentClick={(doc) => {
                    // Could open a modal or navigate to document details
                    console.log('Document clicked:', doc);
                  }}
                />
              </div>
              
              {/* Documents summary footer */}
              {documents.length > 0 && (
                <div className="pt-3 border-t border-gray-200 text-xs text-gray-500 flex items-center justify-between">
                  <span>
                    {documents.filter(d => d.is_ready).length} ready for search
                  </span>
                  <span>
                    {documents.reduce((acc, doc) => acc + (doc.total_chunks || 0), 0)} total chunks
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ===================================================================================
  // MAIN RENDER
  // The final JSX output of the component, with conditional rendering for different states.
  // ===================================================================================

  // Calculate global processing count across all subjects
  const totalProcessingDocuments = subjects.reduce((acc, subject) => {
    const docs = documentsBySubject[subject.id] || [];
    const processing = docs.filter(doc => 
      [ProcessingStatus.PENDING, ProcessingStatus.PARSING, 
       ProcessingStatus.CHUNKING, ProcessingStatus.EMBEDDING].includes(doc.processing_status)
    ).length;
    return acc + processing;
  }, 0);

  return (
    <div>
      {/* Page Header with title and primary actions */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Subjects</h1>
          <p className="text-gray-600 mt-1">
            Manage your academic subjects and track your progress
          </p>
          {/* Global processing indicator */}
          {totalProcessingDocuments > 0 && (
            <p className="text-sm text-blue-600 mt-2 flex items-center">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
              {totalProcessingDocuments} document{totalProcessingDocuments > 1 ? 's' : ''} processing...
            </p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={clsx(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              showArchived 
                ? "bg-gray-200 text-gray-900" 
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            <Archive className="w-4 h-4 inline mr-2" />
            {showArchived ? 'Hide' : 'Show'} Archived
          </button>
          <button
            onClick={() => openModal()}
            className="btn-primary inline-flex items-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Subject
          </button>
        </div>
      </div>

      {/* Global Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Conditional Rendering: Shows a loader, an empty state, or the subjects grid. */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : subjects.length === 0 ? (
        /* Empty state */
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
          <div className="text-center">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {showArchived ? 'No archived subjects' : 'No subjects yet'}
            </h2>
            <p className="text-gray-600 mb-6">
              {showArchived 
                ? 'You haven\'t archived any subjects yet'
                : 'Start by adding your first subject to track your learning progress'}
            </p>
            {!showArchived && (
              <button
                onClick={() => openModal()}
                className="btn-primary inline-flex items-center"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Your First Subject
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Subjects grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.map((subject) => (
            <SubjectCard key={subject.id} subject={subject} />
          ))}
        </div>
      )}

      {/* Create/Edit Modal: Rendered conditionally based on `isModalOpen` state. */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingSubject ? 'Edit Subject' : 'Add New Subject'}
                </h2>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            {/* Modal Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              {/* Form fields are registered here */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject Name *
                </label>
                <input
                  {...register('name', { required: 'Subject name is required' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Mathematics, Physics, Literature"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  {...register('description')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Brief description of the subject..."
                />
              </div>

              {/* Academic Year and Level */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Academic Year
                  </label>
                  <input
                    {...register('academic_year')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 2024-2025"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Level
                  </label>
                  <input
                    {...register('level')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Grade 11, Year 2"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  {...register('category')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a category</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Science">Science</option>
                  <option value="Languages">Languages</option>
                  <option value="Social Studies">Social Studies</option>
                  <option value="Arts">Arts</option>
                  <option value="Technology">Technology</option>
                  <option value="Physical Education">Physical Education</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Custom color picker */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color Theme
                </label>
                <div className="flex space-x-2">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setValue('color', color)}
                      className={clsx(
                        "w-10 h-10 rounded-lg border-2 transition-all",
                        selectedColor === color
                          ? "border-gray-800 scale-110"
                          : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Custom icon picker */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Icon
                </label>
                <div className="grid grid-cols-8 gap-2">
                  {ICONS.map(({ name, icon }) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setValue('icon', name)}
                      className={clsx(
                        "p-3 rounded-lg border-2 text-2xl transition-all hover:bg-gray-50",
                        selectedIcon === name
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200"
                      )}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={clsx(
                    "px-6 py-2 rounded-lg font-medium text-white transition-colors",
                    isSubmitting
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  )}
                >
                  {isSubmitting ? 'Saving...' : editingSubject ? 'Update' : 'Create'} Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubjectsPage;