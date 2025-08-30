/**
 * @file useSubjects Custom Hook
 * 
 * Questo è il cuore della logica per la gestione dei subjects.
 * Implementa il pattern "Custom Hook" che è fondamentale in React moderno.
 * 
 * CONCETTI CHIAVE:
 * 1. Custom Hooks sono funzioni che iniziano con "use"
 * 2. Possono usare altri hooks (useState, useEffect, etc.)
 * 3. Incapsulano logica stateful riutilizzabile
 * 4. Separano la logica dalla presentazione
 * 
 * PATTERN: Custom Hook
 * - Estrae logica complessa dai componenti
 * - Rende il codice testabile e riutilizzabile
 * - Segue le regole degli hooks React
 */

import { useState, useCallback, useEffect } from 'react';
import { Subject, SubjectCreate, SubjectUpdate } from '@/types';
import { subjectService } from '@/services/subjects';

/**
 * Tipo per lo stato del hook.
 * Definiamo esplicitamente la forma dello stato per type safety.
 */
interface UseSubjectsState {
    subjects: Subject[];
    isLoading: boolean;
    error: string | null;
    showArchived: boolean;
} 

/**
 * Tipo per le azioni disponibili.
 * Questo rende esplicite tutte le operazioni possibili.
 */
interface UseSubjectsActions {
    fetchSubjects: () => Promise<void>;
    createSubject: (data: SubjectCreate) => Promise<Subject>;
    updateSubject: (id: number, data: Partial<SubjectUpdate>) => Promise<Subject>;
    deleteSubject: (id: number) => Promise<void>;
    toggleArchive: (subject: Subject) => Promise<void>;
    setShowArchived: (show: boolean) => void;
    clearError: () => void;
    refreshSubjects: () => Promise<void>;
}

export interface UseSubjectsReturn extends UseSubjectsState, UseSubjectsActions {}

/**
 * useSubjects - Hook principale per la gestione dei subjects
 * 
 * Questo hook centralizza tutta la logica di business per i subjects,
 * seguendo il principio di Single Source of Truth.
 * 
 * DESIGN PATTERNS UTILIZZATI:
 * 1. Facade Pattern - Fornisce un'interfaccia semplificata
 * 2. State Management Pattern - Gestisce stato locale complesso
 * 3. Error Boundary Pattern - Gestione centralizzata errori
 * 
 * @returns Oggetto con stato e azioni per i subjects
 */
export function useSubjects(): UseSubjectsReturn {
  // ============================================================================
  // STATE MANAGEMENT
  // Usiamo useState per gestire lo stato locale del hook
  // ============================================================================
  
  /**
   * Array dei subjects caricati.
   * NOTA: Non usiamo useReducer qui perché lo stato non è troppo complesso.
   * Se crescesse, considereremmo useReducer per gestione più strutturata.
   */
  const [subjects, setSubjects] = useState<Subject[]>([]);
  
  /**
   * Flag di caricamento per mostrare spinner.
   * PATTERN: Loading State - Sempre mostrare feedback durante operazioni async
   */
  const [isLoading, setIsLoading] = useState(true);
  
  /**
   * Messaggio di errore per feedback utente.
   * PATTERN: Error State - Gestione esplicita degli errori
   */
  const [error, setError] = useState<string | null>(null);
  
  /**
   * Filtro per mostrare/nascondere subjects archiviati.
   * PATTERN: Filter State - Stato UI che influenza data fetching
   */
  const [showArchived, setShowArchived] = useState(false);

  // ============================================================================
  // DATA FETCHING
  // Funzioni per interagire con il backend
  // ============================================================================

  /**
   * Recupera tutti i subjects dal backend.
   * 
   * useCallback previene ricreazioni inutili della funzione.
   * Questo è importante quando la funzione è passata come prop
   * o usata come dipendenza in useEffect.
   * 
   * PATTERN: Data Fetching with Loading States
   */
  const fetchSubjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
        const data = await subjectService.getSubjects(showArchived);
        setSubjects(data);
    } catch (err: any) {
        const errorMessage = err.response?.data?.detail || 'Failed to load subjects';
        setError(errorMessage);
        console.error('Error fetching subjects:', err);
    } finally {
        setIsLoading(false);
    }
  }, [showArchived]); // Dipendenza: rifetch quando cambia showArchived

  /**
   * Crea un nuovo subject.
   * 
   * PATTERN: Optimistic Update
   * Potremmo aggiungere l'elemento immediatamente e rollback su errore,
   * ma qui preferiamo attendere la conferma del server per l'ID.
   * 
   * @param data - Dati del nuovo subject
   * @returns Il subject creato con ID dal backend
   */
  const createSubject = useCallback(async (data: SubjectCreate): Promise<Subject> => {
    setError(null);
    
    try {
      const newSubject = await subjectService.createSubject(data);
      
      // Aggiorna lo stato locale aggiungendo il nuovo subject
      // PATTERN: Immutable Update - Sempre creare nuovo array, mai mutare
      setSubjects(prev => [...prev, newSubject]);
      
      return newSubject;
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Failed to create subject';
      setError(errorMessage);
      throw err; // Rilanciamo per gestione nel componente se necessario
    }
  }, []);  

  /**
   * Aggiorna un subject esistente.
   * 
   * PATTERN: Partial Update
   * Aggiorniamo solo i campi modificati per efficienza
   * 
   * @param id - ID del subject da aggiornare
   * @param data - Dati parziali da aggiornare
   * @returns Il subject aggiornato
   */
  const updateSubject = useCallback(async (
    id: number, 
    data: Partial<SubjectUpdate>
  ): Promise<Subject> => {
    setError(null);
    
    try {
      const updatedSubject = await subjectService.updateSubject(id, data);
      
      // Aggiorna lo stato locale sostituendo il subject modificato
      // PATTERN: Immutable Update with map
      setSubjects(prev => prev.map(subject => 
        subject.id === id ? updatedSubject : subject
      ));
      
      return updatedSubject;
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Failed to update subject';
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Elimina un subject.
   * 
   * PATTERN: Soft Delete vs Hard Delete
   * Qui facciamo hard delete, ma potremmo considerare soft delete
   * (archiviazione) per recuperabilità.
   * 
   * @param id - ID del subject da eliminare
   */
  const deleteSubject = useCallback(async (id: number): Promise<void> => {
    setError(null);
    
    // Conferma prima di eliminare (potrebbe essere gestita nel componente)
    if (!window.confirm('Are you sure you want to delete this subject?')) {
      return;
    }
    
    try {
      await subjectService.deleteSubject(id);
      
      // Rimuovi dal stato locale
      // PATTERN: Filter for Removal
      setSubjects(prev => prev.filter(subject => subject.id !== id));
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Failed to delete subject';
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Toggle stato archiviato di un subject.
   * 
   * CONVENIENCE METHOD: Wrapper per azione comune
   * 
   * @param subject - Subject da archiviare/disarchiviare
   */
  const toggleArchive = useCallback(async (subject: Subject): Promise<void> => {
    const newArchivedState = !subject.is_archived;
    
    try {
      await updateSubject(subject.id, { is_archived: newArchivedState });
    } catch (err) {
      // Errore già gestito in updateSubject
      throw err;
    }
  }, [updateSubject]);

  /**
   * Pulisce i messaggi di errore.
   * 
   * PATTERN: Error Dismissal
   * Permette all'utente di chiudere messaggi di errore
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Forza un refresh dei subjects.
   * 
   * UTILITY: Per azioni che richiedono refresh manuale
   */
  const refreshSubjects = useCallback(async () => {
    await fetchSubjects();
  }, [fetchSubjects]);

  // ============================================================================
  // EFFECTS
  // Side effects per sincronizzazione e data fetching iniziale
  // ============================================================================
  
  /**
   * Carica i subjects quando il componente monta o cambia showArchived.
   * 
   * PATTERN: Effect for Initial Data Load
   * Carichiamo i dati quando il componente che usa questo hook monta
   */
  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]); // fetchSubjects cambia quando cambia showArchived

  // ============================================================================
  // RETURN VALUE
  // Esponiamo stato e azioni in un oggetto unico
  // ============================================================================

  return {
    // State
    subjects,
    isLoading,
    error,
    showArchived,
    
    // Actions
    fetchSubjects,
    createSubject,
    updateSubject,
    deleteSubject,
    toggleArchive,
    setShowArchived,
    clearError,
    refreshSubjects,
  };
}

/**
 * Hook helper per filtrare subjects.
 * 
 * PATTERN: Derived State Hook
 * Calcola valori derivati dallo stato principale
 * 
 * @param subjects - Array di subjects da filtrare
 * @returns Oggetto con subjects filtrati per categoria
 */
export function useFilteredSubjects(subjects: Subject[]) {
  const active = subjects.filter(s => !s.is_archived);
  const archived = subjects.filter(s => s.is_archived);
  
  const byCategory = subjects.reduce((acc, subject) => {
    const category = subject.category || 'Uncategorized';
    if (!acc[category]) acc[category] = [];
    acc[category].push(subject);
    return acc;
  }, {} as Record<string, Subject[]>);
  
  return {
    all: subjects,
    active,
    archived,
    byCategory,
    count: {
      total: subjects.length,
      active: active.length,
      archived: archived.length
    }
  };
}
