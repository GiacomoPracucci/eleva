/**
 * @file SubjectList Component
 * 
 * Componente presentazionale per visualizzare la griglia di subjects.
 * Puro rendering, nessuna logica di business.
 * 
 * PATTERN: Presentational Component
 * - Riceve dati via props
 * - Emette eventi via callbacks
 * - Zero stato interno (stateless)
 * - Facilmente testabile
 */

import React from 'react';
import { Subject } from '@/types';
import SubjectCard from './SubjectCard';
import { Loader2 } from 'lucide-react';

/**
 * Props per SubjectList.
 * Minimali e focalizzate sul rendering.
 */
interface SubjectListProps {
  /**
   * Array di subjects da visualizzare.
   * Può essere vuoto per mostrare empty state.
   */
  subjects: Subject[];
  
  /**
   * Se true, mostra loading spinner.
   * PATTERN: Loading State
   */
  isLoading?: boolean;
  
  /**
   * Callback quando si clicca edit su un subject.
   * Il parent gestisce l'azione.
   */
  onEdit: (subject: Subject) => void;
  
  /**
   * Callback quando si elimina un subject.
   */
  onDelete: (id: number) => void;
  
  /**
   * Callback quando si archivia/disarchivia.
   */
  onArchive: (subject: Subject) => void;
  
  /**
   * ID del subject in fase di eliminazione.
   * Usato per mostrare loading su card specifica.
   */
  deletingSubjectId: number | null;
  
  /**
   * Componente custom per empty state.
   * PATTERN: Render Prop / Component Injection
   */
  emptyStateComponent?: React.ReactNode;
  
  /**
   * Layout della griglia.
   * Permette diversi layout predefiniti.
   * 
   * NOTA: Con Tailwind, dobbiamo usare classi complete
   * che esistono nel codice, non possiamo costruirle dinamicamente.
   */
  gridLayout?: 'default' | 'compact' | 'expanded' | 'single';
}

/**
 * Configurazioni layout predefinite.
 * 
 * IMPORTANTE: Con Tailwind, tutte le classi devono essere
 * scritte complete nel codice sorgente per essere incluse nel CSS finale.
 * Non possiamo costruire classi dinamicamente con template literals.
 * 
 * Questa è una limitazione di Tailwind che usa PurgeCSS/JIT compiler
 * per ottimizzare la dimensione del CSS finale.
 */
const GRID_LAYOUTS = {
  // Layout di default: 1 colonna mobile, 2 tablet, 3 desktop
  default: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6',
  
  // Layout compatto: più colonne, meno spazio
  compact: 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4',
  
  // Layout espanso: meno colonne, più spazio per card
  expanded: 'grid grid-cols-1 md:grid-cols-2 gap-8',
  
  // Layout singola colonna (lista)
  single: 'grid grid-cols-1 gap-4',
} as const;

/**
 * SubjectList - Lista/griglia di subject cards
 * 
 * RESPONSIBILITIES:
 * 1. Rendering della griglia
 * 2. Gestione layout responsive
 * 3. Mostrare loading state
 * 4. Delegare eventi ai callbacks
 * 
 * NON-RESPONSIBILITIES:
 * - Fetching dati
 * - Gestione stato
 * - Business logic
 * 
 * TAILWIND LIMITATION:
 * Non possiamo generare classi dinamicamente come `grid-cols-${n}`.
 * Dobbiamo usare classi predefinite o un approccio con style inline
 * per valori veramente dinamici.
 * 
 * @component
 */
export const SubjectList: React.FC<SubjectListProps> = ({
  subjects,
  isLoading = false,
  onEdit,
  onDelete,
  onArchive,
  deletingSubjectId,
  emptyStateComponent,
  gridLayout = 'default'
}) => {
  // ============================================================================
  // LOADING STATE
  // ============================================================================
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading subjects...</p>
        </div>
      </div>
    );
  }
  
  // ============================================================================
  // EMPTY STATE
  // ============================================================================
  
  if (subjects.length === 0) {
    // Se fornito un componente custom, usalo
    if (emptyStateComponent) {
      return <>{emptyStateComponent}</>;
    }
    
    // Altrimenti, empty state di default
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No subjects found</p>
      </div>
    );
  }
  
  // ============================================================================
  // MAIN RENDER - GRID DI CARDS
  // ============================================================================
  
  /**
   * Usa il layout predefinito basato sulla prop.
   * Se hai bisogno di colonne veramente dinamiche (es. dall'utente),
   * considera di usare CSS Grid con variabili CSS invece di Tailwind:
   * 
   * style={{ 
   *   display: 'grid',
   *   gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
   *   gap: '1.5rem'
   * }}
   */
  return (
    <div 
      className={GRID_LAYOUTS[gridLayout]}
      role="list"
      aria-label="Subjects list"
    >
      {subjects.map((subject) => (
        <div key={subject.id} role="listitem">
          <SubjectCard
            subject={subject}
            onEdit={onEdit}
            onDelete={onDelete}
            onArchive={onArchive}
            deletingSubjectId={deletingSubjectId}
          />
        </div>
      ))}
    </div>
  );
};

/**
 * Versione alternativa con colonne dinamiche usando CSS Grid.
 * Usa questa se hai bisogno di controllo dinamico completo.
 * 
 * @component
 */
export const SubjectListDynamic: React.FC<SubjectListProps & {
  columns?: { mobile: number; tablet: number; desktop: number; }
}> = ({
  subjects,
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  ...otherProps
}) => {
  // Per colonne veramente dinamiche, usiamo CSS inline
  // invece di classi Tailwind
  return (
    <div 
      role="list"
      aria-label="Subjects list"
      style={{
        display: 'grid',
        gap: '1.5rem',
        gridTemplateColumns: `repeat(${columns.mobile}, minmax(0, 1fr))`,
      }}
      className="md:hidden"
    >
      {/* Mobile view */}
      {subjects.map((subject) => (
        <div key={`mobile-${subject.id}`} role="listitem">
          <SubjectCard subject={subject} {...otherProps} />
        </div>
      ))}
    </div>
    
    // Poi ripeti per tablet e desktop con media queries...
    // O usa una libreria come styled-components per gestione più pulita
  );
};

/**
 * Componente per mostrare skeleton loading.
 * 
 * PATTERN: Skeleton Loading
 * Mostra placeholder mentre i dati caricano per migliore UX
 * 
 * @component
 */
export const SubjectListSkeleton: React.FC<{ 
  count?: number;
  layout?: 'default' | 'compact' | 'expanded' | 'single';
}> = ({ 
  count = 6,
  layout = 'default' 
}) => {
  return (
    <div className={GRID_LAYOUTS[layout]}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-6 animate-pulse"
        >
          {/* Skeleton per icona e titolo */}
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-gray-200 rounded-lg" />
            <div className="flex-1">
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-full mb-1" />
              <div className="h-4 bg-gray-200 rounded w-2/3" />
            </div>
          </div>
          
          {/* Skeleton per tags */}
          <div className="flex gap-2 mt-4">
            <div className="h-6 bg-gray-200 rounded-full w-20" />
            <div className="h-6 bg-gray-200 rounded-full w-24" />
            <div className="h-6 bg-gray-200 rounded-full w-16" />
          </div>
          
          {/* Skeleton per documents section */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="h-4 bg-gray-200 rounded w-32" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default SubjectList;

/**
 * NOTA IMPORTANTE SU TAILWIND E CLASSI DINAMICHE:
 * ================================================
 * 
 * Tailwind CSS (v3 e v4) usa un compilatore JIT (Just-In-Time) che:
 * 1. Analizza il codice sorgente staticamente
 * 2. Trova tutte le classi usate
 * 3. Genera solo il CSS necessario
 * 
 * Questo significa che:
 * ❌ NON FUNZIONA: `className={\`grid-cols-${columns}\`}`
 * ✅ FUNZIONA: `className="grid-cols-3"`
 * ✅ FUNZIONA: `className={columns === 3 ? 'grid-cols-3' : 'grid-cols-2'}`
 * 
 * SOLUZIONI:
 * 1. Usa classi predefinite (come fatto sopra con GRID_LAYOUTS)
 * 2. Usa style inline per valori veramente dinamici
 * 3. Configura safelist in tailwind.config.js per classi dinamiche
 * 4. Usa librerie CSS-in-JS come styled-components per casi complessi
 * 
 * ESEMPIO SAFELIST (tailwind.config.js):
 * ```javascript
 * module.exports = {
 *   safelist: [
 *     'grid-cols-1',
 *     'grid-cols-2', 
 *     'grid-cols-3',
 *     'grid-cols-4',
 *     // O con pattern
 *     { pattern: /grid-cols-(1|2|3|4|5|6)/ }
 *   ]
 * }
 * ```
 */