/**
 * @file SubjectEmptyState Component
 * components/subjects/SubjectEmptyState.tsx
 * 
 * Componente per mostrare stati vuoti con azioni.
 * Migliora l'UX guidando l'utente su cosa fare.
 * 
 * PATTERN: Empty State with CTA (Call To Action)
 */

import React from 'react';
import { BookOpen, Plus, Archive } from 'lucide-react';

interface SubjectEmptyStateProps {
  /**
   * Se true, mostra messaggio per archivio vuoto.
   */
  isArchiveView?: boolean;
  
  /**
   * Callback per creare nuovo subject.
   */
  onCreateClick?: () => void;
  
  /**
   * Callback per cambiare vista archivio.
   */
  onToggleArchive?: () => void;
}

export const SubjectEmptyState: React.FC<SubjectEmptyStateProps> = ({
  isArchiveView = false,
  onCreateClick,
  onToggleArchive
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
      <div className="text-center max-w-md mx-auto">
        {/* Icona principale */}
        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <BookOpen className="w-8 h-8 text-gray-400" />
        </div>
        
        {/* Messaggio principale */}
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {isArchiveView ? 'No archived subjects' : 'No subjects yet'}
        </h2>
        
        {/* Descrizione */}
        <p className="text-gray-600 mb-6">
          {isArchiveView 
            ? "You haven't archived any subjects yet. Archive subjects you're not actively using to keep your workspace organized."
            : "Start by adding your first subject to track your learning progress and manage your documents."}
        </p>
        
        {/* Azioni */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {!isArchiveView && onCreateClick && (
            <button
              onClick={onCreateClick}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Your First Subject
            </button>
          )}
          
          {onToggleArchive && (
            <button
              onClick={onToggleArchive}
              className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Archive className="w-5 h-5 mr-2" />
              {isArchiveView ? 'View Active Subjects' : 'View Archived'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

