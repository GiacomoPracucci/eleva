/**
 * @file useProfile Custom Hook
 * 
 * Hook principale per la gestione del profilo utente.
 * Centralizza tutta la logica di business del profilo.
 * 
 * PATTERN: Facade Hook
 * - Fornisce interfaccia semplificata per operazioni complesse
 * - Gestisce stato e side effects
 * - Coordina con altri hooks e services
 * 
 * RESPONSABILITÀ:
 * 1. Gestione stato profilo
 * 2. Aggiornamento dati utente
 * 3. Gestione notifiche successo/errore
 * 4. Coordinamento con store globale
 */

import { useState, useCallback, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { profileService } from '@/services/profile';
import { UserUpdate } from '@/types';

/**
 * Stato di notifica per feedback utente.
 * Separato per tipo per UI differenziate.
 */
interface NotificationState {
  success: string | null;
  error: string | null;
  info: string | null;
}

/**
 * Configurazione hook profilo.
 * Permette personalizzazione comportamento.
 */
interface UseProfileConfig {
  /**
   * Auto-dismiss notifiche dopo X millisecondi.
   * 0 = non auto-dismiss
   */
  notificationDuration?: number;
  
  /**
   * Callback dopo aggiornamento successo.
   */
  onUpdateSuccess?: (user: any) => void;
  
  /**
   * Callback dopo errore.
   */
  onUpdateError?: (error: Error) => void;
}

/**
 * Return type del hook.
 * Espone stato e azioni necessarie.
 */
interface UseProfileReturn {
  // Stato
  user: any;
  isLoading: boolean;
  notifications: NotificationState;
  isDirty: boolean;
  
  // Azioni
  updateProfile: (data: UserUpdate) => Promise<void>;
  setUser: (user: any) => void;
  clearNotifications: () => void;
  setNotification: (type: keyof NotificationState, message: string) => void;
}

/**
 * useProfile - Hook per gestione profilo utente
 * 
 * Centralizza la logica del profilo fornendo:
 * - Stato utente sincronizzato con store globale
 * - Gestione aggiornamenti con feedback
 * - Sistema notifiche integrato
 * - Loading states granulari
 * 
 * DESIGN DECISIONS:
 * 1. Usa store globale per stato utente (single source of truth)
 * 2. Notifiche locali (non globali) per feedback contestuale
 * 3. Auto-dismiss configurabile per UX migliore
 * 
 * @param config - Configurazione opzionale
 * @returns Stato e azioni profilo
 */
export function useProfile(config: UseProfileConfig = {}): UseProfileReturn {
  const {
    notificationDuration = 3000,
    onUpdateSuccess,
    onUpdateError
  } = config;
  
  // ============================================================================
  // GLOBAL STATE
  // Connessione con store Zustand
  // ============================================================================
  
  /**
   * Ottieni user e setter dallo store globale.
   * PATTERN: Single Source of Truth
   */
  const { user, setUser: setGlobalUser } = useAuthStore();
  
  // ============================================================================
  // LOCAL STATE
  // Stati specifici per UI profilo
  // ============================================================================
  
  /**
   * Loading state per operazioni async.
   * Separato per operazione per granularità.
   */
  const [isLoading, setIsLoading] = useState(false);
  
  /**
   * Sistema notifiche per feedback.
   * Separato per tipo per styling differenziato.
   */
  const [notifications, setNotifications] = useState<NotificationState>({
    success: null,
    error: null,
    info: null
  });
  
  /**
   * Traccia se ci sono modifiche non salvate.
   * Utile per warning navigazione.
   */
  const [isDirty, setIsDirty] = useState(false);
  
  /**
   * Timer per auto-dismiss notifiche.
   * Stored per cleanup.
   */
  const [notificationTimer, setNotificationTimer] = useState<NodeJS.Timeout | null>(null);
  
  // ============================================================================
  // NOTIFICATION MANAGEMENT
  // Sistema notifiche con auto-dismiss
  // ============================================================================
  
  /**
   * Imposta notifica con auto-dismiss opzionale.
   * 
   * @param type - Tipo notifica (success/error/info)
   * @param message - Messaggio da mostrare
   */
  const setNotification = useCallback((
    type: keyof NotificationState, 
    message: string
  ) => {
    // Clear timer precedente se esiste
    if (notificationTimer) {
      clearTimeout(notificationTimer);
    }
    
    // Set nuova notifica
    setNotifications(prev => ({
      ...prev,
      [type]: message,
      // Clear altri tipi per evitare sovrapposizioni
      ...(type !== 'success' && { success: null }),
      ...(type !== 'error' && { error: null }),
      ...(type !== 'info' && { info: null })
    }));
    
    // Setup auto-dismiss se configurato
    if (notificationDuration > 0) {
      const timer = setTimeout(() => {
        setNotifications(prev => ({
          ...prev,
          [type]: null
        }));
      }, notificationDuration);
      
      setNotificationTimer(timer);
    }
  }, [notificationDuration, notificationTimer]);
  
  /**
   * Pulisce tutte le notifiche.
   * Utile per dismissal manuale.
   */
  const clearNotifications = useCallback(() => {
    if (notificationTimer) {
      clearTimeout(notificationTimer);
      setNotificationTimer(null);
    }
    
    setNotifications({
      success: null,
      error: null,
      info: null
    });
  }, [notificationTimer]);
  
  // ============================================================================
  // PROFILE OPERATIONS
  // Operazioni CRUD sul profilo
  // ============================================================================
  
  /**
   * Aggiorna profilo utente.
   * 
   * PATTERN: Optimistic Update with Rollback
   * Potremmo implementare update ottimistico per UX migliore
   * 
   * @param data - Dati aggiornati profilo
   */
  const updateProfile = useCallback(async (data: UserUpdate): Promise<void> => {
    setIsLoading(true);
    clearNotifications();
    
    try {
      // Call API service
      const updatedUser = await profileService.updateProfile(data);
      
      // Update global state
      setGlobalUser(updatedUser);
      
      // Reset dirty state
      setIsDirty(false);
      
      // Show success notification
      setNotification('success', 'Profile updated successfully!');
      
      // Call success callback if provided
      onUpdateSuccess?.(updatedUser);
      
    } catch (error: any) {
      // Extract error message
      const errorMessage = 
        error.response?.data?.detail || 
        error.message ||
        'Failed to update profile. Please try again.';
      
      // Show error notification
      setNotification('error', errorMessage);
      
      // Call error callback if provided
      onUpdateError?.(error);
      
      // Re-throw per gestione componente se necessario
      throw error;
      
    } finally {
      setIsLoading(false);
    }
  }, [setGlobalUser, setNotification, clearNotifications, onUpdateSuccess, onUpdateError]);
  
  /**
   * Wrapper per setUser che marca anche come dirty.
   * Usato quando si modificano campi localmente.
   */
  const setUserWithDirty = useCallback((userData: any) => {
    setGlobalUser(userData);
    setIsDirty(true);
  }, [setGlobalUser]);
  
  // ============================================================================
  // EFFECTS
  // Side effects e cleanup
  // ============================================================================
  
  /**
   * Cleanup timer on unmount.
   * Previene memory leak.
   */
  useEffect(() => {
    return () => {
      if (notificationTimer) {
        clearTimeout(notificationTimer);
      }
    };
  }, [notificationTimer]);
  
  /**
   * Warn user about unsaved changes.
   * Browser API per prevenire navigazione accidentale.
   */
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };
    
    if (isDirty) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);
  
  // ============================================================================
  // RETURN
  // ============================================================================
  
  return {
    // State
    user,
    isLoading,
    notifications,
    isDirty,
    
    // Actions
    updateProfile,
    setUser: setUserWithDirty,
    clearNotifications,
    setNotification
  };
}

/**
 * Hook helper per validazione profilo.
 * Separato per single responsibility.
 * 
 * @param field - Nome campo da validare
 * @param value - Valore da validare
 * @returns Messaggio errore o null se valido
 */
export function useProfileValidation(field: string, value: any): string | null {
  switch (field) {
    case 'full_name':
      if (value && value.length > 100) {
        return 'Full name must be less than 100 characters';
      }
      break;
      
    case 'bio':
      if (value && value.length > 500) {
        return 'Bio must be less than 500 characters';
      }
      break;
      
    case 'academic_year':
      if (value && !/^\d{4}-\d{4}$/.test(value)) {
        return 'Academic year format should be YYYY-YYYY';
      }
      break;
      
    default:
      break;
  }
  
  return null;
}