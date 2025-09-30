/**
 * @file useSubjectForm Custom Hook
 * 
 * Gestisce la logica del form per creare/modificare subjects.
 * Separa completamente la logica del form dalla UI.
 * 
 * PATTERN: Form Logic Separation
 * - Logica di validazione isolata
 * - Gestione stato form centralizzata
 * - Riutilizzabile in diversi componenti
 * 
 * VANTAGGI:
 * 1. Testabilità - Possiamo testare la logica senza UI
 * 2. Riusabilità - Stesso form logic per create/edit
 * 3. Separazione concerns - UI e logica separate
 */

import { useForm } from 'react-hook-form';
import { useState, useEffect, useCallback } from 'react';
import { Subject, SubjectCreate } from '@/types';
import { COLORS, ICONS } from '@/constants/subjects';

/**
 * Configurazione per il form.
 * Permette personalizzazione del comportamento.
 */
interface UseSubjectFormConfig {
  onSubmit: (data: SubjectCreate) => Promise<void>;
  initialValues?: Partial<Subject>;
}

/**
 * Tipo di ritorno del hook.
 * Espone tutto il necessario per gestire il form.
 */
interface UseSubjectFormReturn {
  // Form state e metodi da react-hook-form
  register: any;
  handleSubmit: any;
  reset: any;
  setValue: any;
  watch: any;
  formState: {
    errors: any;
    isSubmitting: boolean;
    isDirty: boolean;
    isValid: boolean;
  };
  
  // Stati custom
  selectedColor: string;
  selectedIcon: string;
  isEditMode: boolean;
  
  // Azioni
  onSubmit: (data: SubjectCreate) => Promise<void>;
  resetForm: () => void;
  setEditMode: (subject: Subject | null) => void;
}

/**
 * useSubjectForm - Hook per gestione form subjects
 * 
 * Centralizza tutta la logica del form inclusa validazione,
 * gestione stato, e invio dati.
 * 
 * DESIGN DECISIONS:
 * 1. Usa react-hook-form per performance (meno re-render)
 * 2. Validazione sincrona per feedback immediato
 * 3. Gestione unificata per create/edit
 * 
 * @param config - Configurazione del form
 * @returns Oggetto con tutto il necessario per il form
 */
export function useSubjectForm(config: UseSubjectFormConfig): UseSubjectFormReturn {
  const { onSubmit, initialValues } = config;
  
  // ============================================================================
  // FORM STATE
  // react-hook-form gestisce lo stato del form efficientemente
  // ============================================================================
  
  /**
   * Inizializza react-hook-form con validazione.
   * 
   * NOTA: react-hook-form è la libreria standard per form in React perché:
   * 1. Minimizza re-render (usa refs internamente)
   * 2. Validazione built-in potente
   * 3. Gestione errori automatica
   * 4. TypeScript support eccellente
   */
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty, isValid }
  } = useForm<SubjectCreate>({
    // Valori di default per nuovo subject
    defaultValues: {
      name: '',
      description: '',
      academic_year: '',
      level: '',
      category: '',
      color: COLORS[0],
      icon: ICONS[0].name,
      ...initialValues // Override con valori iniziali se presenti
    },
    // Modalità di validazione
    mode: 'onChange', // Valida mentre l'utente digita
    reValidateMode: 'onChange'
  });
  
  // ============================================================================
  // CUSTOM STATE
  // Stati aggiuntivi non gestiti da react-hook-form
  // ============================================================================
  
  /**
   * Traccia se siamo in modalità edit.
   * Influenza il comportamento del form e i label.
   */
  const [isEditMode, setIsEditMode] = useState(!!initialValues);
  
  // ============================================================================
  // WATCHED VALUES
  // Valori osservati per aggiornamenti UI real-time
  // ============================================================================
  
  /**
   * Osserva il colore selezionato per preview.
   * watch() causa re-render solo quando il valore cambia.
   */
  const selectedColor = watch('color') || COLORS[0];
  
  /**
   * Osserva l'icona selezionata per preview.
   */
  const selectedIcon = watch('icon') || ICONS[0].name;
  
  // ============================================================================
  // FORM ACTIONS
  // ============================================================================
  
  /**
   * Gestisce l'invio del form.
   * Wrapper che aggiunge error handling al callback fornito.
   * 
   * @param data - Dati validati del form
   */
  const handleFormSubmit = useCallback(async (data: SubjectCreate) => {
    try {
      await onSubmit(data);
      // Reset form solo su successo
      if (!isEditMode) {
        reset();
      }
    } catch (error) {
      // L'errore è già gestito nel callback onSubmit
      // Qui potremmo aggiungere logging o analytics
      console.error('Form submission error:', error);
    }
  }, [onSubmit, isEditMode, reset]);
  
  /**
   * Reset completo del form.
   * Ripristina valori di default e stati.
   */
  const resetForm = useCallback(() => {
    reset({
      name: '',
      description: '',
      academic_year: '',
      level: '',
      category: '',
      color: COLORS[0],
      icon: ICONS[0].name,
    });
    setIsEditMode(false);
  }, [reset]);
  
  /**
   * Imposta il form in modalità edit con dati esistenti.
   * 
   * @param subject - Subject da editare o null per nuovo
   */
  const setEditModeWithData = useCallback((subject: Subject | null) => {
    if (subject) {
      // Modalità edit: popola il form
      setIsEditMode(true);
      
      // Popola tutti i campi del form
      Object.keys(subject).forEach((key) => {
        setValue(key as any, (subject as any)[key]);
      });
    } else {
      // Modalità create: reset tutto
      resetForm();
    }
  }, [setValue, resetForm]);
  
  // ============================================================================
  // EFFECTS
  // ============================================================================
  
  /**
   * Aggiorna il form quando cambiano i valori iniziali.
   * Utile quando il componente parent passa nuovi dati.
   */
  useEffect(() => {
    if (initialValues) {
      Object.keys(initialValues).forEach((key) => {
        setValue(key as any, (initialValues as any)[key]);
      });
    }
  }, [initialValues, setValue]);
  
  // ============================================================================
  // VALIDATION RULES
  // Regole di validazione per i campi
  // ============================================================================
  
  /**
   * Regole di validazione per ogni campo.
   * Centralizzate per consistenza e manutenibilità.
   * 
   * PATTERN: Validation Rules Object
   * Meglio di inline validation per riusabilità
   */
  const validationRules = {
    name: {
      required: 'Subject name is required',
      minLength: {
        value: 2,
        message: 'Name must be at least 2 characters'
      },
      maxLength: {
        value: 100,
        message: 'Name must be less than 100 characters'
      }
    },
    description: {
      maxLength: {
        value: 500,
        message: 'Description must be less than 500 characters'
      }
    },
    academic_year: {
      pattern: {
        value: /^\d{4}-\d{4}$/,
        message: 'Format should be YYYY-YYYY (e.g., 2024-2025)'
      }
    },
    level: {
      maxLength: {
        value: 50,
        message: 'Level must be less than 50 characters'
      }
    }
  };
  
  // ============================================================================
  // RETURN VALUE
  // ============================================================================
  
  return {
    // react-hook-form exports
    register: (name: keyof SubjectCreate) => register(name, validationRules[name as keyof typeof validationRules]),
    handleSubmit: handleSubmit(handleFormSubmit),
    reset,
    setValue,
    watch,
    formState: {
      errors,
      isSubmitting,
      isDirty,
      isValid
    },
    
    // Custom state
    selectedColor,
    selectedIcon,
    isEditMode,
    
    // Actions
    onSubmit: handleFormSubmit,
    resetForm,
    setEditMode: setEditModeWithData
  };
}

/**
 * Hook per validazione custom aggiuntiva.
 * 
 * PATTERN: Composable Validation
 * Permette di aggiungere validazioni custom senza modificare il form principale
 * 
 * @param value - Valore da validare
 * @param fieldName - Nome del campo
 * @returns Messaggio di errore o undefined se valido
 */
export function useSubjectValidation(value: any, fieldName: string): string | undefined {
  // Esempio di validazione custom che potrebbe essere aggiunta
  if (fieldName === 'name' && value) {
    // Controlla che non ci siano caratteri speciali
    if (!/^[a-zA-Z0-9\s-]+$/.test(value)) {
      return 'Name can only contain letters, numbers, spaces and hyphens';
    }
  }
  
  return undefined;
}