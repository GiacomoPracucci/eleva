/**
 * @file SubjectFilters Component
 * components/subjects/SubjectFilters.tsx
 * 
 * Header con filtri e azioni per la pagina subjects.
 * Separa la UI di controllo dalla lista.
 * 
 * PATTERN: Filter Bar Component
 */

import { Archive, Plus, Search, Filter } from 'lucide-react';
import clsx from 'clsx';

interface SubjectFiltersProps {
  /**
   * Titolo della pagina.
   */
  title?: string;
  
  /**
   * Descrizione sotto il titolo.
   */
  description?: string;
  
  /**
   * Se mostrare subjects archiviati.
   */
  showArchived: boolean;
  
  /**
   * Callback per toggle archivio.
   */
  onToggleArchive: (show: boolean) => void;
  
  /**
   * Callback per aprire modal creazione.
   */
  onCreateClick: () => void;
  
  /**
   * Valore di ricerca corrente.
   */
  searchQuery?: string;
  
  /**
   * Callback per cambio ricerca.
   */
  onSearchChange?: (query: string) => void;
  
  /**
   * Numero totale di subjects.
   */
  totalCount?: number;
  
  /**
   * Numero di subjects filtrati.
   */
  filteredCount?: number;
  
  /**
   * Se mostrare controlli avanzati.
   */
  showAdvancedFilters?: boolean;
}

export const SubjectFilters: React.FC<SubjectFiltersProps> = ({
  title = 'My Subjects',
  description = 'Manage your academic subjects and track your progress',
  showArchived,
  onToggleArchive,
  onCreateClick,
  searchQuery = '',
  onSearchChange,
  totalCount,
  filteredCount,
  showAdvancedFilters = false
}) => {
  return (
    <div className="mb-6">
      {/* Header principale */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {title}
            {totalCount !== undefined && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({totalCount})
              </span>
            )}
          </h1>
          <p className="text-gray-600 mt-1">
            {description}
          </p>
        </div>
        
        {/* Azione primaria - sempre visibile */}
        <button
          onClick={onCreateClick}
          className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Subject
        </button>
      </div>
      
      {/* Barra dei filtri */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Ricerca (se abilitata) */}
        {onSearchChange && (
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search subjects..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
        
        {/* Filtri rapidi */}
        <div className="flex gap-2">
          {/* Toggle Archivio */}
          <button
            onClick={() => onToggleArchive(!showArchived)}
            className={clsx(
              "inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              showArchived 
                ? "bg-gray-200 text-gray-900" 
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            <Archive className="w-4 h-4 mr-2" />
            {showArchived ? 'Hide' : 'Show'} Archived
          </button>
          
          {/* Filtri avanzati (futuro) */}
          {showAdvancedFilters && (
            <button
              className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </button>
          )}
        </div>
      </div>
      
      {/* Info sui risultati filtrati */}
      {filteredCount !== undefined && filteredCount !== totalCount && (
        <div className="mt-3 text-sm text-gray-600">
          Showing {filteredCount} of {totalCount} subjects
        </div>
      )}
    </div>
  );
};

export default SubjectFilters;