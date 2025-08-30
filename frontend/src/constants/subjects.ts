/**
 * @file Subject Constants
 * 
 * Centralizza tutte le costanti relative ai subjects.
 * Questo approccio migliora la manutenibilità e consistenza.
 * 
 * PATTERN: Constants Module
 * - Single source of truth per valori costanti
 * - Facilita modifiche globali
 * - Type safety con TypeScript
 */

/**
 * Colori disponibili per i subjects.
 * Hex colors per massima flessibilità.
 * 
 * DESIGN: Palette coerente con il brand
 */
export const COLORS = [
  '#3B82F6', // blue-500
  '#8B5CF6', // purple-500
  '#EC4899', // pink-500
  '#F59E0B', // amber-500
  '#10B981', // emerald-500
  '#14B8A6', // teal-500
  '#F97316', // orange-500
  '#EF4444', // red-500
] as const;

/**
 * Icone disponibili per i subjects.
 * Usiamo emoji per semplicità e supporto universale.
 * 
 * ALTERNATIVA: Potremmo usare lucide-react icons
 */
export const ICONS = [
  { name: 'book', icon: '📚', label: 'Books' },
  { name: 'math', icon: '🔢', label: 'Mathematics' },
  { name: 'science', icon: '🔬', label: 'Science' },
  { name: 'language', icon: '💬', label: 'Language' },
  { name: 'computer', icon: '💻', label: 'Computer' },
  { name: 'art', icon: '🎨', label: 'Art' },
  { name: 'music', icon: '🎵', label: 'Music' },
  { name: 'sport', icon: '⚽', label: 'Sports' },
  { name: 'history', icon: '🏛️', label: 'History' },
  { name: 'geography', icon: '🌍', label: 'Geography' },
  { name: 'chemistry', icon: '⚗️', label: 'Chemistry' },
  { name: 'biology', icon: '🧬', label: 'Biology' },
] as const;

/**
 * Categorie predefinite per i subjects.
 * Usate nel dropdown del form.
 */
export const SUBJECT_CATEGORIES = [
  { value: 'Mathematics', label: 'Mathematics' },
  { value: 'Science', label: 'Science' },
  { value: 'Languages', label: 'Languages' },
  { value: 'Social Studies', label: 'Social Studies' },
  { value: 'Arts', label: 'Arts' },
  { value: 'Technology', label: 'Technology' },
  { value: 'Physical Education', label: 'Physical Education' },
  { value: 'Other', label: 'Other' },
] as const;

/**
 * Livelli accademici predefiniti.
 * Esempi comuni per diversi sistemi educativi.
 */
export const ACADEMIC_LEVELS = [
  'Elementary School',
  'Middle School',
  'High School',
  'University - Year 1',
  'University - Year 2',
  'University - Year 3',
  'University - Year 4',
  'Graduate',
  'Postgraduate',
  'Professional',
] as const;

/**
 * Configurazione di default per nuovo subject.
 * Usata come base nel form.
 */
export const DEFAULT_SUBJECT = {
  name: '',
  description: '',
  academic_year: '',
  level: '',
  category: '',
  color: COLORS[0],
  icon: ICONS[0].name,
  is_active: true,
  is_archived: false,
} as const;

/**
 * Limiti di validazione per i campi.
 * Centralizzati per consistenza.
 */
export const SUBJECT_VALIDATION = {
  name: {
    minLength: 2,
    maxLength: 100,
  },
  description: {
    maxLength: 500,
  },
  academic_year: {
    pattern: /^\d{4}-\d{4}$/,
    example: '2024-2025',
  },
  level: {
    maxLength: 50,
  },
} as const;

/**
 * Messaggi di errore standard.
 * Centralizzati per consistenza UX.
 */
export const SUBJECT_ERROR_MESSAGES = {
  name: {
    required: 'Subject name is required',
    minLength: `Name must be at least ${SUBJECT_VALIDATION.name.minLength} characters`,
    maxLength: `Name must be less than ${SUBJECT_VALIDATION.name.maxLength} characters`,
  },
  description: {
    maxLength: `Description must be less than ${SUBJECT_VALIDATION.description.maxLength} characters`,
  },
  academic_year: {
    pattern: `Format should be YYYY-YYYY (e.g., ${SUBJECT_VALIDATION.academic_year.example})`,
  },
  generic: {
    createFailed: 'Failed to create subject. Please try again.',
    updateFailed: 'Failed to update subject. Please try again.',
    deleteFailed: 'Failed to delete subject. Please try again.',
    loadFailed: 'Failed to load subjects. Please try again.',
  },
} as const;

/**
 * Type helper per ottenere i valori delle costanti.
 * Utile per type safety in TypeScript.
 */
export type ColorValue = typeof COLORS[number];
export type IconName = typeof ICONS[number]['name'];
export type CategoryValue = typeof SUBJECT_CATEGORIES[number]['value'];