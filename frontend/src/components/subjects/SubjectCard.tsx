// React's core hooks for managing state and side effects.
import { useState, useEffect } from 'react';
// The primary hook from React Hook Form to manage form state and validation.
// A comprehensive set of icons from the lucide-react library.
import { 
  Plus, 
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
// TypeScript types defining the shape of subject and document data.
import { Subject, ProcessingStatus } from '@/types';
// Import our document components
import DocumentUpload from '@/components/documents/DocumentUpload';
import DocumentList from '@/components/documents/DocumentList';
// Import documents store for fetching documents
import { useDocumentsStore } from '@/store/documentsStore';
import { ICONS } from '@/constants/subjects';

// ===================================================================================
// SUBJECT CARD COMPONENT - EXTRACTED AS SEPARATE COMPONENT
// ===================================================================================

interface SubjectCardProps {
  subject: Subject;
  onEdit: (subject: Subject) => void;
  onDelete: (id: number) => void;
  onArchive: (subject: Subject) => void;
  deletingSubjectId: number | null;
}

/**
 * A presentational component that renders a single subject card with document management.
 * NOW EXTRACTED AS A SEPARATE COMPONENT TO AVOID RE-CREATION ON PARENT RE-RENDERS
 */
const SubjectCard: React.FC<SubjectCardProps> = ({ 
  subject, 
  onEdit, 
  onDelete, 
  onArchive, 
  deletingSubjectId 
}) => {
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
   * Track if we've already fetched documents for this subject.
   * This prevents infinite loops when there are no documents.
   */
  const [hasFetchedDocuments, setHasFetchedDocuments] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log('SubjectCard render:', {
      subjectId: subject.id,
      isDocumentsExpanded,
      showUploadInterface,
      isArchived: subject.is_archived,
      documentsLength: documents.length,
      hasFetchedDocuments
    });
  }, [subject.id, isDocumentsExpanded, showUploadInterface, subject.is_archived, documents.length, hasFetchedDocuments]);
  
  /**
   * Update document counts when documents change.
   * This provides a quick overview without expanding the section.
   */
  useEffect(() => {
    // Update counts based on fetched documents
    setDocumentCount(documents.length);
    
    // Count processing documents
    const processing = documents.filter(doc => 
      [ProcessingStatus.PENDING, ProcessingStatus.PARSING, 
       ProcessingStatus.CHUNKING, ProcessingStatus.EMBEDDING].includes(doc.processing_status)
    ).length;
    setProcessingCount(processing);
  }, [documents]);
  
  /**
   * Optionally fetch document count on mount.
   * This is lightweight and gives us the count without full expansion.
   */
  useEffect(() => {
    // Only fetch if we have documents in the store already
    // This means they were fetched previously
    if (documents.length > 0 && !hasFetchedDocuments) {
      setHasFetchedDocuments(true);
    }
  }, [documents.length, hasFetchedDocuments]);
  
  /**
   * Handles successful document upload.
   * Refreshes the document list and provides feedback.
   */
  const handleUploadComplete = (documentId: string) => {
    console.log('Upload complete for document:', documentId);
    // Refresh document list
    fetchDocuments(subject.id);
    setHasFetchedDocuments(true);
    // Close upload interface after successful upload
    setShowUploadInterface(false);
    // Keep documents section expanded to show the new document
    setIsDocumentsExpanded(true);
  };
  
  /**
   * Toggles the documents section expansion.
   * Can also force a specific state (open/closed).
   * @param forceState - (Optional) Boolean to force open (true) or closed (false).
   */
  const handleToggleDocuments = (forceState?: boolean) => {
    // Determine the new state: use forceState if provided, otherwise toggle.
    const newExpanded = forceState !== undefined ? forceState : !isDocumentsExpanded;
    
    console.log('Toggling documents section:', { 
      current: isDocumentsExpanded, 
      new: newExpanded,
      forced: forceState !== undefined 
    });
    
    setIsDocumentsExpanded(newExpanded);
    
    // Fetch documents only when expanding and haven't fetched yet
    if (newExpanded && !hasFetchedDocuments) {
      console.log('Fetching documents for subject:', subject.id);
      fetchDocuments(subject.id);
      setHasFetchedDocuments(true);
    }
    
    // Always hide the upload interface when collapsing the section
    if (!newExpanded) {
      setShowUploadInterface(false);
    }
  };

  /**
   * Handles the click on the quick upload button.
   * Ensures the documents section is open and shows the upload interface.
   */
  const handleQuickUploadClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Quick upload clicked for subject:', subject.id);
    console.log('Current state:', { isDocumentsExpanded, showUploadInterface });
    
    // Step 1: Force the documents panel to be open.
    setIsDocumentsExpanded(true);
    // Step 2: Show the upload interface.
    setShowUploadInterface(true);
    
    console.log('State after quick upload click - should open documents and show upload UI');
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
                  onEdit(subject);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit
              </button>
              <button
                onClick={() => {
                  onArchive(subject);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
              >
                <Archive className="w-4 h-4 mr-2" />
                {subject.is_archived ? 'Unarchive' : 'Archive'}
              </button>
              <button
                onClick={() => {
                  onDelete(subject.id);
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
              onClick={() => handleToggleDocuments()}
              className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              type="button"
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
            
            {/* Quick upload button - FIXED EVENT HANDLER */}
            {!subject.is_archived && (
              <button
                onClick={handleQuickUploadClick}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Upload document"
                type="button"
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
                onClick={() => {
                  console.log('Add Document button clicked for subject:', subject.id);
                  setShowUploadInterface(true);
                }}
                className="w-full py-2 px-4 bg-white border-2 border-dashed border-gray-300 rounded-lg 
                         text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 
                         transition-colors flex items-center justify-center space-x-2"
                type="button"
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
                    onClick={() => {
                      console.log('Closing upload interface for subject:', subject.id);
                      setShowUploadInterface(false);
                    }}
                    className="p-1 hover:bg-gray-100 rounded"
                    type="button"
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

export default SubjectCard;