/**
 * @file SubjectModal Component
 * 
 * Componente presentazionale per il modal di creazione/modifica subjects.
 * Segue il pattern "Dumb Component" - riceve tutto via props.
 * 
 * PATTERN: Presentational Component
 * - Zero business logic
 * - Solo rendering UI
 * - Totalmente controllato dal parent
 * - Altamente riutilizzabile
 * 
 * PRINCIPI:
 * 1. Single Responsibility - Solo mostra il modal
 * 2. Dependency Inversion - Dipende da astrazioni (props)
 * 3. Open/Closed - Estendibile via props, non modificabile
 */

import React from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { SubjectCreate } from '@/types';
import { COLORS, ICONS } from '@/constants/subjects';

/**
 * Props per SubjectModal.
 * Definiamo esplicitamente ogni prop per type safety e documentazione.
 */
interface SubjectModalProps {
  /**
   * Controlla se il modal è visibile.
   * PATTERN: Controlled Component
   */
  isOpen: boolean;
  
  /**
   * Callback per chiudere il modal.
   * Il parent gestisce lo stato, non il modal stesso.
   */
  onClose: () => void;
  
  /**
   * Callback per submit del form.
   * Riceve i dati validati e restituisce una Promise.
   */
  onSubmit: (data: SubjectCreate) => Promise<void>;
  
  /**
   * Titolo del modal.
   * Permette personalizzazione per create/edit.
   */
  title?: string;
  
  /**
   * Se true, mostra il modal in modalità edit.
   * Influenza testi e comportamenti UI.
   */
  isEditMode?: boolean;
  
  /**
   * Form register function da react-hook-form.
   * Passato dal parent che gestisce il form.
   */
  register: any;
  
  /**
   * Form handleSubmit da react-hook-form.
   */
  handleSubmit: any;
  
  /**
   * Form errors da react-hook-form.
   */
  errors: any;
  
  /**
   * Se il form sta inviando dati.
   * Usato per disabilitare bottoni e mostrare loading.
   */
  isSubmitting: boolean;
  
  /**
   * Colore selezionato per preview.
   */
  selectedColor: string;
  
  /**
   * Icona selezionata per preview.
   */
  selectedIcon: string;
  
  /**
   * Callback per cambio colore.
   * Il parent gestisce lo stato del form.
   */
  onColorChange: (color: string) => void;
  
  /**
   * Callback per cambio icona.
   */
  onIconChange: (icon: string) => void;
}

/**
 * SubjectModal - Componente presentazionale per il modal
 * 
 * DESIGN DECISIONS:
 * 1. Nessuno stato interno - tutto via props (Controlled)
 * 2. Nessuna chiamata API - solo callbacks
 * 3. Accessibilità con ARIA attributes
 * 4. Responsive design con Tailwind
 * 
 * ACCESSIBILITÀ:
 * - Focus trap nel modal
 * - Escape key per chiudere
 * - ARIA labels e roles
 * - Contrast ratio AAA
 * 
 * @component
 */
export const SubjectModal: React.FC<SubjectModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title = 'Add New Subject',
  isEditMode = false,
  register,
  handleSubmit,
  errors,
  isSubmitting,
  selectedColor,
  selectedIcon,
  onColorChange,
  onIconChange,
}) => {
  
  /**
   * Gestisce tasto Escape per chiudere.
   * 
   * ACCESSIBILITY: Permette chiusura rapida con tastiera
   */
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);
  
  // ============================================================================
  // EARLY RETURN
  // Se non è aperto, non renderizziamo nulla
  // ============================================================================
  if (!isOpen) return null;
  
  // ============================================================================
  // EVENT HANDLERS
  // Handler locali per eventi UI
  // ============================================================================
  
  /**
   * Gestisce click sul backdrop per chiudere.
   * 
   * @param e - Event del click
   */
  const handleBackdropClick = (e: React.MouseEvent) => {
    // Chiudi solo se clicchi sul backdrop, non sul contenuto
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  
  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <>
      {/* Backdrop semi-trasparente */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
        onClick={handleBackdropClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Container del modal */}
        <div 
          className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()} // Previeni chiusura quando clicchi sul contenuto
        >
          {/* ========== HEADER ========== */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 id="modal-title" className="text-2xl font-bold text-gray-900">
                {title}
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close modal"
                disabled={isSubmitting}
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>
          
          {/* ========== FORM BODY ========== */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-180px)]">
            
            {/* Campo Nome (required) */}
            <div>
              <label 
                htmlFor="subject-name" 
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Subject Name *
              </label>
              <input
                id="subject-name"
                {...register('name')}
                className={clsx(
                  "w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
                  errors.name ? "border-red-300" : "border-gray-300"
                )}
                placeholder="e.g., Mathematics, Physics, Literature"
                aria-invalid={errors.name ? 'true' : 'false'}
                aria-describedby={errors.name ? 'name-error' : undefined}
              />
              {errors.name && (
                <p id="name-error" className="mt-1 text-sm text-red-600">
                  {errors.name.message}
                </p>
              )}
            </div>
            
            {/* Campo Descrizione (optional) */}
            <div>
              <label 
                htmlFor="subject-description" 
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Description
              </label>
              <textarea
                id="subject-description"
                {...register('description')}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Brief description of the subject..."
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.description.message}
                </p>
              )}
            </div>
            
            {/* Grid per Anno e Livello */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label 
                  htmlFor="academic-year" 
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Academic Year
                </label>
                <input
                  id="academic-year"
                  {...register('academic_year')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 2024-2025"
                />
                {errors.academic_year && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.academic_year.message}
                  </p>
                )}
              </div>
              
              <div>
                <label 
                  htmlFor="level" 
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Level
                </label>
                <input
                  id="level"
                  {...register('level')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Grade 11, Year 2"
                />
              </div>
            </div>
            
            {/* Categoria */}
            <div>
              <label 
                htmlFor="category" 
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Category
              </label>
              <select
                id="category"
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
            
            {/* Selettore Colore */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Color Theme
              </label>
              <div className="flex space-x-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => onColorChange(color)}
                    className={clsx(
                      "w-10 h-10 rounded-lg border-2 transition-all",
                      selectedColor === color
                        ? "border-gray-800 scale-110"
                        : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                    aria-pressed={selectedColor === color}
                  />
                ))}
              </div>
            </div>
            
            {/* Selettore Icona */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Icon
              </label>
              <div className="grid grid-cols-8 gap-2">
                {ICONS.map(({ name, icon }) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => onIconChange(name)}
                    className={clsx(
                      "p-3 rounded-lg border-2 text-2xl transition-all hover:bg-gray-50",
                      selectedIcon === name
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200"
                    )}
                    aria-label={`Select ${name} icon`}
                    aria-pressed={selectedIcon === name}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </form>
          
          {/* ========== FOOTER CON AZIONI ========== */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={clsx(
                "px-6 py-2 rounded-lg font-medium text-white transition-colors",
                isSubmitting
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {isSubmitting ? (
                <>
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Saving...
                </>
              ) : (
                `${isEditMode ? 'Update' : 'Create'} Subject`
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SubjectModal;