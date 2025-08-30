/**
 * @file ProfilePicture Component
 * 
 * Componente presentazionale per gestione immagine profilo.
 * Completamente controllato, zero stato interno.
 * 
 * PATTERN: Controlled Presentational Component
 * - Tutto via props
 * - Eventi via callbacks
 * - Facilmente testabile
 * - Riutilizzabile
 */

import React, { useRef } from 'react';
import { 
  Camera, 
  Upload, 
  X, 
  Trash2, 
  Loader2,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import clsx from 'clsx';

/**
 * Props per ProfilePicture component.
 * Ogni prop ha uno scopo specifico per controllo completo.
 */
interface ProfilePictureProps {
  /**
   * URL immagine corrente (può essere blob: o http:).
   */
  imageUrl?: string | null;
  
  /**
   * Iniziale username per placeholder.
   */
  username?: string;
  
  /**
   * File selezionato ma non ancora caricato.
   */
  selectedFile?: File | null;
  
  /**
   * Se upload in corso.
   */
  isUploading?: boolean;
  
  /**
   * Progresso upload (0-100).
   */
  uploadProgress?: number;
  
  /**
   * Se delete in corso.
   */
  isDeleting?: boolean;
  
  /**
   * Messaggio errore da mostrare.
   */
  error?: string | null;
  
  /**
   * Se mostrare stato successo.
   */
  showSuccess?: boolean;
  
  /**
   * Callback selezione file.
   */
  onFileSelect: (file: File) => void;
  
  /**
   * Callback upload.
   */
  onUpload: () => void;
  
  /**
   * Callback cancella selezione.
   */
  onCancel: () => void;
  
  /**
   * Callback elimina immagine.
   */
  onDelete: () => void;
  
  /**
   * Dimensione avatar (sm, md, lg, xl).
   */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  
  /**
   * Se disabilitare interazioni.
   */
  disabled?: boolean;
  
  /**
   * Classe CSS aggiuntiva.
   */
  className?: string;
}

/**
 * Mappa dimensioni avatar.
 * Centralizzata per consistenza.
 */
const SIZES = {
  sm: 'w-16 h-16',
  md: 'w-24 h-24',
  lg: 'w-32 h-32',
  xl: 'w-40 h-40'
} as const;

/**
 * ProfilePicture - Componente per immagine profilo
 * 
 * Features:
 * - Avatar con iniziali fallback
 * - Preview prima di upload
 * - Progress indicator durante upload
 * - Azioni contestuali (upload/delete)
 * - Stati error/success
 * 
 * DESIGN:
 * - Mobile-first responsive
 * - Accessibile (ARIA labels)
 * - Feedback visivo chiaro
 * 
 * @component
 */
export const ProfilePicture: React.FC<ProfilePictureProps> = ({
  imageUrl,
  username = '',
  selectedFile,
  isUploading = false,
  uploadProgress = 0,
  isDeleting = false,
  error,
  showSuccess = false,
  onFileSelect,
  onUpload,
  onCancel,
  onDelete,
  size = 'lg',
  disabled = false,
  className
}) => {
  // ============================================================================
  // REFS
  // ============================================================================
  
  /**
   * Ref per input file nascosto.
   * Permette trigger programmatico.
   */
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  
  /**
   * Gestisce cambio file input.
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
    // Reset input per permettere re-selezione stesso file
    e.target.value = '';
  };
  
  /**
   * Apre dialog selezione file.
   */
  const handleSelectClick = () => {
    if (!disabled && !isUploading && !isDeleting) {
      fileInputRef.current?.click();
    }
  };
  
  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================
  
  /**
   * Determina se mostrare overlay loading.
   */
  const showLoadingOverlay = isUploading || isDeleting;
  
  /**
   * Calcola iniziali per placeholder.
   */
  const initials = username
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
  
  /**
   * Determina stato visuale corrente.
   */
  const visualState = {
    isError: !!error,
    isSuccess: showSuccess && !error,
    isLoading: showLoadingOverlay,
    hasImage: !!imageUrl,
    hasSelection: !!selectedFile
  };
  
  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <div className={clsx('relative inline-block', className)}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isUploading || isDeleting}
        aria-label="Select profile picture"
      />
      
      {/* Avatar container */}
      <div className="relative">
        <div 
          className={clsx(
            SIZES[size],
            'bg-gray-200 rounded-full flex items-center justify-center overflow-hidden transition-all',
            visualState.isError && 'ring-2 ring-red-500',
            visualState.isSuccess && 'ring-2 ring-green-500',
            !disabled && !showLoadingOverlay && 'hover:ring-2 hover:ring-blue-500'
          )}
        >
          {/* Image or initials */}
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt="Profile" 
              className="w-full h-full object-cover"
            />
          ) : (
            <span className={clsx(
              'font-semibold text-gray-600',
              size === 'sm' && 'text-lg',
              size === 'md' && 'text-2xl',
              size === 'lg' && 'text-3xl',
              size === 'xl' && 'text-4xl'
            )}>
              {initials}
            </span>
          )}
          
          {/* Loading overlay */}
          {showLoadingOverlay && (
            <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
              {uploadProgress > 0 && uploadProgress < 100 && (
                <span className="text-white text-xs mt-1">
                  {uploadProgress}%
                </span>
              )}
            </div>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="absolute -bottom-2 -right-2 flex space-x-1">
          {/* Main action button (change/upload) */}
          {!selectedFile ? (
            <button
              onClick={handleSelectClick}
              disabled={disabled || showLoadingOverlay}
              className={clsx(
                'p-2 rounded-full transition-colors',
                'bg-blue-600 text-white hover:bg-blue-700',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              title="Change profile picture"
              aria-label="Change profile picture"
            >
              <Camera className="w-4 h-4" />
            </button>
          ) : (
            // Upload/Cancel buttons when file selected
            <>
              <button
                onClick={onUpload}
                disabled={isUploading}
                className="p-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors disabled:opacity-50"
                title="Upload photo"
                aria-label="Upload photo"
              >
                <Upload className="w-4 h-4" />
              </button>
              <button
                onClick={onCancel}
                disabled={isUploading}
                className="p-2 bg-gray-600 text-white rounded-full hover:bg-gray-700 transition-colors disabled:opacity-50"
                title="Cancel selection"
                aria-label="Cancel selection"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
          
          {/* Delete button (only if has existing image) */}
          {imageUrl && !selectedFile && !imageUrl.startsWith('blob:') && (
            <button
              onClick={onDelete}
              disabled={disabled || showLoadingOverlay}
              className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Remove profile picture"
              aria-label="Remove profile picture"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {/* Status indicators */}
        {visualState.isError && (
          <div className="absolute -top-2 -right-2">
            <div className="bg-red-500 rounded-full p-1">
              <AlertCircle className="w-4 h-4 text-white" />
            </div>
          </div>
        )}
        
        {visualState.isSuccess && (
          <div className="absolute -top-2 -right-2">
            <div className="bg-green-500 rounded-full p-1">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
          </div>
        )}
      </div>
      
      {/* Helper text */}
      {selectedFile && !error && (
        <p className="mt-2 text-xs text-gray-600 text-center">
          Preview mode - click upload to save
        </p>
      )}
      
      {error && (
        <p className="mt-2 text-xs text-red-600 text-center">
          {error}
        </p>
      )}
    </div>
  );
};

export default ProfilePicture;