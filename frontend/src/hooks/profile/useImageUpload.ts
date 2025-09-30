/**
 * @file useImageUpload Custom Hook
 * 
 * Gestisce tutta la logica per upload immagini profilo.
 * Separa completamente la logica di upload dalla UI.
 * 
 * PATTERN: Single Responsibility Hook
 * - Una sola responsabilità: gestione upload immagini
 * - Riutilizzabile in altri contesti
 * - Testabile isolatamente
 * 
 * FEATURES:
 * 1. Preview immagine prima di upload
 * 2. Validazione client-side
 * 3. Progress tracking
 * 4. Cleanup automatico URLs
 * 5. Gestione errori robusta
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { profileService } from '@/services/profile';
import { useAuthStore } from '@/store/authStore';

/**
 * Configurazione per upload immagini.
 * Permette personalizzazione limiti e comportamento.
 */
interface ImageUploadConfig {
  /**
   * Dimensione massima file in bytes.
   * Default: 5MB
   */
  maxSize?: number;
  
  /**
   * Tipi MIME accettati.
   * Default: immagini comuni
   */
  acceptedTypes?: string[];
  
  /**
   * Se comprimere immagine prima di upload.
   * Default: false (futura implementazione)
   */
  compress?: boolean;
  
  /**
   * Qualità compressione (1-100).
   * Default: 80
   */
  compressionQuality?: number;
  
  /**
   * Callback dopo upload successo.
   */
  onUploadSuccess?: (url: string) => void;
  
  /**
   * Callback dopo errore upload.
   */
  onUploadError?: (error: Error) => void;
}

/**
 * Stato upload con tutte le info necessarie.
 */
interface UploadState {
  /**
   * File selezionato per upload.
   */
  selectedFile: File | null;
  
  /**
   * URL preview (blob URL per anteprima).
   */
  previewUrl: string | null;
  
  /**
   * Se upload in corso.
   */
  isUploading: boolean;
  
  /**
   * Progresso upload (0-100).
   */
  uploadProgress: number;
  
  /**
   * Errore corrente se presente.
   */
  error: string | null;
  
  /**
   * Se operazione delete in corso.
   */
  isDeleting: boolean;
}

/**
 * Return type del hook.
 * Interfaccia completa per gestione upload.
 */
interface UseImageUploadReturn extends UploadState {
  // Azioni principali
  selectFile: (file: File) => void;
  uploadFile: () => Promise<void>;
  cancelUpload: () => void;
  deleteImage: () => Promise<void>;
  
  // Utilities
  clearError: () => void;
  resetUpload: () => void;
  validateFile: (file: File) => string | null;
}

// Costanti default
const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_ACCEPTED_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/gif',
  'image/webp'
];

/**
 * useImageUpload - Hook per gestione upload immagini
 * 
 * Fornisce interfaccia completa per:
 * - Selezione file con validazione
 * - Preview immediato
 * - Upload con progress tracking
 * - Gestione errori
 * - Cleanup automatico
 * 
 * ESEMPIO USO:
 * ```tsx
 * const upload = useImageUpload({
 *   maxSize: 10 * 1024 * 1024, // 10MB
 *   onUploadSuccess: (url) => console.log('Uploaded:', url)
 * });
 * 
 * // In component
 * <input onChange={(e) => upload.selectFile(e.target.files[0])} />
 * {upload.previewUrl && <img src={upload.previewUrl} />}
 * <button onClick={upload.uploadFile}>Upload</button>
 * ```
 * 
 * @param config - Configurazione opzionale
 * @returns Stato e azioni upload
 */
export function useImageUpload(config: ImageUploadConfig = {}): UseImageUploadReturn {
  const {
    maxSize = DEFAULT_MAX_SIZE,
    acceptedTypes = DEFAULT_ACCEPTED_TYPES,
    compress = false, // TODO sviluppare compressione
    compressionQuality = 80, // TODO sviluppare compressione
    onUploadSuccess,
    onUploadError
  } = config;

  useEffect(() => {
    if (compress) {
      console.warn(
        'Image compression is not implemented yet. Received configuration:',
        { compress, compressionQuality }
      );
    }
  }, [compress, compressionQuality]);
  
  // ============================================================================
  // GLOBAL STATE
  // ============================================================================
  
  const { setUser } = useAuthStore();
  
  // ============================================================================
  // LOCAL STATE
  // ============================================================================
  
  const [state, setState] = useState<UploadState>({
    selectedFile: null,
    previewUrl: null,
    isUploading: false,
    uploadProgress: 0,
    error: null,
    isDeleting: false
  });
  
  // ============================================================================
  // REFS
  // Per tracking valori che non causano re-render
  // ============================================================================
  
  /**
   * Ref per URL preview corrente.
   * Necessario per cleanup affidabile.
   */
  const previewUrlRef = useRef<string | null>(null);
  
  /**
   * Ref per AbortController.
   * Permette cancellazione upload in corso.
   */
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // ============================================================================
  // VALIDATION
  // ============================================================================
  
  /**
   * Valida file secondo configurazione.
   * 
   * @param file - File da validare
   * @returns Messaggio errore o null se valido
   */
  const validateFile = useCallback((file: File): string | null => {
    // Check tipo file
    if (!acceptedTypes.includes(file.type)) {
      // Fallback: check estensione
      const extension = file.name.toLowerCase().split('.').pop();
      const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      
      if (!extension || !validExtensions.includes(extension)) {
        return `File type not supported. Please upload: ${validExtensions.join(', ')}`;
      }
    }
    
    // Check dimensione
    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024));
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return `File size (${fileSizeMB}MB) exceeds maximum allowed size of ${maxSizeMB}MB`;
    }
    
    // Check se è immagine valida (basic check)
    if (!file.type.startsWith('image/')) {
      return 'Please select a valid image file';
    }
    
    return null;
  }, [acceptedTypes, maxSize]);
  
  // ============================================================================
  // PREVIEW MANAGEMENT
  // ============================================================================
  
  /**
   * Crea URL preview per file.
   * Usa blob URL per performance.
   * 
   * @param file - File per preview
   * @returns Blob URL
   */
  const createPreviewUrl = useCallback((file: File): string => {
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    return url;
  }, []);
  
  /**
   * Cleanup URL preview.
   * IMPORTANTE: Previene memory leak!
   */
  const cleanupPreviewUrl = useCallback(() => {
    if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);
  
  // ============================================================================
  // FILE OPERATIONS
  // ============================================================================
  
  /**
   * Seleziona file e crea preview.
   * 
   * @param file - File selezionato
   */
  const selectFile = useCallback((file: File | null) => {
    if (!file) {
      setState(prev => ({
        ...prev,
        selectedFile: null,
        previewUrl: null,
        error: null
      }));
      cleanupPreviewUrl();
      return;
    }
    
    // Valida file
    const validationError = validateFile(file);
    if (validationError) {
      setState(prev => ({
        ...prev,
        error: validationError,
        selectedFile: null,
        previewUrl: null
      }));
      return;
    }
    
    // Cleanup vecchio preview se esiste
    cleanupPreviewUrl();
    
    // Crea nuovo preview
    const newPreviewUrl = createPreviewUrl(file);
    
    // Aggiorna stato
    setState(prev => ({
      ...prev,
      selectedFile: file,
      previewUrl: newPreviewUrl,
      error: null,
      uploadProgress: 0
    }));
  }, [validateFile, createPreviewUrl, cleanupPreviewUrl]);
  
  /**
   * Esegue upload del file selezionato.
   * 
   * PATTERN: Progress Tracking
   * Simula progresso per UX migliore
   */
  const uploadFile = useCallback(async (): Promise<void> => {
    const { selectedFile } = state;
    
    if (!selectedFile) {
      setState(prev => ({ ...prev, error: 'No file selected' }));
      return;
    }
    
    // Setup per cancellazione
    abortControllerRef.current = new AbortController();
    
    setState(prev => ({
      ...prev,
      isUploading: true,
      uploadProgress: 0,
      error: null
    }));
    
    try {
      // Simula progresso (API reale potrebbe fornire eventi progress)
      const progressInterval = setInterval(() => {
        setState(prev => {
          if (prev.uploadProgress >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return {
            ...prev,
            uploadProgress: prev.uploadProgress + 10
          };
        });
      }, 100);
      
      // Upload effettivo
      const updatedUser = await profileService.uploadProfilePicture(selectedFile);
      
      // Clear interval e set 100%
      clearInterval(progressInterval);
      setState(prev => ({ ...prev, uploadProgress: 100 }));
      
      // Update global user state
      setUser(updatedUser);
      
      // Success callback
      onUploadSuccess?.(updatedUser.profile_picture_url || '');
      
      // Reset stato dopo successo
      setTimeout(() => {
        setState({
          selectedFile: null,
          previewUrl: updatedUser.profile_picture_url || null,
          isUploading: false,
          uploadProgress: 0,
          error: null,
          isDeleting: false
        });
        cleanupPreviewUrl();
      }, 500); // Delay per mostrare 100%
      
    } catch (error: any) {
      // Handle error
      const errorMessage = 
        error.response?.data?.detail || 
        error.message ||
        'Failed to upload image. Please try again.';
      
      setState(prev => ({
        ...prev,
        isUploading: false,
        uploadProgress: 0,
        error: errorMessage
      }));
      
      onUploadError?.(error);
    } finally {
      abortControllerRef.current = null;
    }
  }, [state, setUser, onUploadSuccess, onUploadError, cleanupPreviewUrl]);
  
  /**
   * Cancella upload in corso.
   */
  const cancelUpload = useCallback(() => {
    // Abort request se in corso
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Reset stato
    setState(prev => ({
      ...prev,
      selectedFile: null,
      previewUrl: null,
      isUploading: false,
      uploadProgress: 0,
      error: null
    }));
    
    // Cleanup preview
    cleanupPreviewUrl();
  }, [cleanupPreviewUrl]);
  
  /**
   * Elimina immagine profilo esistente.
   */
  const deleteImage = useCallback(async (): Promise<void> => {
    if (!window.confirm('Are you sure you want to remove your profile picture?')) {
      return;
    }
    
    setState(prev => ({ ...prev, isDeleting: true, error: null }));
    
    try {
      const updatedUser = await profileService.deleteProfilePicture();
      setUser(updatedUser);
      
      setState(prev => ({
        ...prev,
        previewUrl: null,
        isDeleting: false
      }));
      
    } catch (error: any) {
      const errorMessage = 
        error.response?.data?.detail || 
        'Failed to delete profile picture. Please try again.';
      
      setState(prev => ({
        ...prev,
        isDeleting: false,
        error: errorMessage
      }));
    }
  }, [setUser]);
  
  // ============================================================================
  // UTILITIES
  // ============================================================================
  
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);
  
  const resetUpload = useCallback(() => {
    cancelUpload();
  }, [cancelUpload]);
  
  // ============================================================================
  // CLEANUP EFFECT
  // ============================================================================
  
  useEffect(() => {
    return () => {
      cleanupPreviewUrl();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [cleanupPreviewUrl]);
  
  // ============================================================================
  // RETURN
  // ============================================================================
  
  return {
    // State
    ...state,
    
    // Actions
    selectFile,
    uploadFile,
    cancelUpload,
    deleteImage,
    clearError,
    resetUpload,
    validateFile
  };
}