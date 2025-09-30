/**
 * @file SubjectsPage Component (REFACTORED)
 * 
 * Container component per la gestione subjects.
 * Dopo il refactoring, questo componente è MOLTO più snello.
 * 
 * RESPONSABILITÀ:
 * 1. Orchestrare componenti child
 * 2. Connettere hooks con UI
 * 3. Gestire navigazione/routing
 * 
 * NON-RESPONSABILITÀ (delegate):
 * - Business logic → useSubjects hook
 * - Form logic → useSubjectForm hook  
 * - API calls → SubjectService
 * - UI components → Componenti presentazionali
 * 
 * PATTERN: Smart/Container Component
 * - Connette logica e presentazione
 * - Minima UI diretta
 * - Focalizzato su orchestrazione
 * 
 * DA 600+ RIGHE A ~150 RIGHE! 🎉
 */

import React, { useState, useCallback } from 'react';
import { Subject } from '@/types';

// Custom Hooks (Business Logic)
import { useSubjects } from '@/hooks/subjects/useSubjects';
import { useSubjectForm } from '@/hooks/subjects/useSubjectForm';

// Presentational Components
import { SubjectList } from '@/components/subjects/SubjectList';
import { SubjectModal } from '@/components/subjects/SubjectModal';
import { SubjectEmptyState } from '@/components/subjects/SubjectEmptyState';
import { SubjectFilters } from '@/components/subjects/SubjectFilters';

// Utils
import { AlertCircle } from 'lucide-react';

/**
 * SubjectsPage - Pagina principale per gestione subjects
 * 
 * ARCHITETTURA:
 * ```
 * SubjectsPage (Container)
 *   ├── useSubjects (Logic)
 *   ├── useSubjectForm (Form Logic)
 *   ├── SubjectFilters (UI)
 *   ├── SubjectList (UI)
 *   ├── SubjectModal (UI)
 *   └── SubjectEmptyState (UI)
 * ```
 * 
 * Questo componente è ora un "orchestratore" che:
 * 1. Usa hooks per la logica
 * 2. Passa dati/callbacks ai componenti presentazionali
 * 3. Gestisce solo stato UI locale (modal open/close)
 * 
 * @component
 */
const SubjectsPage: React.FC = () => {
  // ============================================================================
  // HOOKS - BUSINESS LOGIC
  // Tutta la logica complessa è estratta in custom hooks
  // ============================================================================
  
  /**
   * Hook principale per gestione subjects.
   * Gestisce stato, API calls, e azioni CRUD.
   * 
   * SEPARATION OF CONCERNS: Logica isolata dal componente
   */
  const {
    subjects,
    isLoading,
    error,
    showArchived,
    setShowArchived,
    createSubject,
    updateSubject,
    deleteSubject,
    toggleArchive,
    clearError,
  } = useSubjects();
  
  // ============================================================================
  // LOCAL UI STATE
  // Solo stato relativo alla UI, non business logic
  // ============================================================================
  
  /**
   * Controlla visibilità del modal.
   * NOTA: Questo è stato UI, non business state
   */
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  /**
   * Subject attualmente in editing.
   * null = creazione nuovo, Subject = modifica esistente
   */
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  
  /**
   * ID del subject in eliminazione.
   * Usato per feedback visivo durante eliminazione
   */
  const [deletingSubjectId, setDeletingSubjectId] = useState<number | null>(null);
  
  // ============================================================================
  // FORM HOOK
  // Gestisce tutta la logica del form
  // ============================================================================

  /**
   * Chiude il modal e resetta stato.
   */
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingSubject(null);
  }, []);

  /**
   * Hook per gestione form.
   * Configurato con callbacks per submit e cancel.
   * 
   * PATTERN: Dependency Injection via callbacks
   */
  const formHook = useSubjectForm({
    onSubmit: async (data) => {
      try {
        if (editingSubject) {
          // Modalità edit
          await updateSubject(editingSubject.id, data);
        } else {
          // Modalità create
          await createSubject(data);
        }
        // Chiudi modal su successo
        handleCloseModal();
        formHook.resetForm();
      } catch (error) {
        // Errore già gestito nel hook useSubjects
        console.error('Form submission error:', error);
      }
    },
    initialValues: editingSubject || undefined,
  });
  
  // ============================================================================
  // EVENT HANDLERS
  // Handler per eventi UI
  // ============================================================================
  
  /**
   * Apre il modal per creare nuovo subject.
   * 
   * useCallback previene ricreazioni inutili
   */
  const handleCreateClick = useCallback(() => {
    setEditingSubject(null);
    formHook.resetForm();
    setIsModalOpen(true);
  }, [formHook]);
  
  /**
   * Apre il modal per editare subject esistente.
   * 
   * @param subject - Subject da editare
   */
  const handleEditClick = useCallback((subject: Subject) => {
    setEditingSubject(subject);
    formHook.setEditMode(subject);
    setIsModalOpen(true);
  }, [formHook]);
  
  /**
   * Gestisce eliminazione con feedback visivo.
   * 
   * @param id - ID del subject da eliminare
   */
  const handleDeleteClick = useCallback(async (id: number) => {
    setDeletingSubjectId(id);
    try {
      await deleteSubject(id);
    } finally {
      setDeletingSubjectId(null);
    }
  }, [deleteSubject]);
  
  // ============================================================================
  // RENDER
  // UI minimale, principalmente composizione di componenti
  // ============================================================================
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* HEADER CON FILTRI */}
        <SubjectFilters
          showArchived={showArchived}
          onToggleArchive={setShowArchived}
          onCreateClick={handleCreateClick}
          totalCount={subjects.length}
        />
        
        {/* ERROR MESSAGE */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={clearError}
                className="mt-2 text-sm text-red-600 underline hover:no-underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        
        {/* MAIN CONTENT - LIST O EMPTY STATE */}
        {subjects.length === 0 && !isLoading ? (
          <SubjectEmptyState
            isArchiveView={showArchived}
            onCreateClick={handleCreateClick}
            onToggleArchive={() => setShowArchived(!showArchived)}
          />
        ) : (
          <SubjectList
            subjects={subjects}
            isLoading={isLoading}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
            onArchive={toggleArchive}
            deletingSubjectId={deletingSubjectId}
          />
        )}
        
        {/* MODAL - SEMPRE RENDERIZZATO MA CONTROLLATO DA isOpen */}
        <SubjectModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          title={editingSubject ? 'Edit Subject' : 'Add New Subject'}
          isEditMode={!!editingSubject}
          register={formHook.register}
          handleSubmit={formHook.handleSubmit}
          errors={formHook.formState.errors}
          isSubmitting={formHook.formState.isSubmitting}
          selectedColor={formHook.selectedColor}
          selectedIcon={formHook.selectedIcon}
          onColorChange={(color) => formHook.setValue('color', color)}
          onIconChange={(icon) => formHook.setValue('icon', icon)}
        />
        
      </div>
    </div>
  );
};

/**
 * Export default per lazy loading e code splitting.
 * React.lazy() richiede export default.
 */
export default SubjectsPage;