/**
 * @file Subject Service Layer
 * 
 * Questo file implementa il pattern Service Layer per centralizzare
 * tutte le chiamate API relative ai subjects. Questo approccio:
 * 
 * 1. Separa la logica di rete dai componenti
 * 2. Fornisce un'interfaccia consistente per le API
 * 3. Facilita il testing (possiamo mockare il service)
 * 4. Centralizza la gestione degli errori API
 * 
 * PATTERN: Service Layer
 * - Isola le chiamate API dal resto dell'applicazione
 * - Fornisce type safety con TypeScript
 * - Gestisce trasformazioni dei dati se necessarie
 */

import api from '@/services/api';
import { Subject, SubjectCreate, SubjectUpdate } from '@/types';

/**
 * Subject Service Class
 * 
 * Implementa tutte le operazioni CRUD per i subjects.
 * Usa il pattern class-based per raggruppare metodi correlati.
 * 
 * NOTA: In React, i services sono spesso implementati come oggetti
 * o funzioni pure, ma una classe fornisce migliore organizzazione
 * per sviluppatori provenienti da OOP.
 */
class SubjectService {
    
   /**
   * Recupera tutti i subjects dell'utente corrente.
   * 
   * @param includeArchived - Se includere i subjects archiviati
   * @returns Promise con array di subjects
   * 
   * DESIGN: Restituiamo sempre una Promise per consistenza,
   * anche se potremmo usare async/await internamente.
   */
    async getSubjects(includeArchived: boolean = false): Promise<Subject[]> {
        const response = await api.get<Subject[]>('/subjects', {
            params: { include_archived: includeArchived }
        });
        return response.data;
    }
    
  /**
   * Recupera un singolo subject per ID.
   * 
   * @param id - ID del subject
   * @returns Promise con il subject
   * 
   * PATTERN: Single Responsibility
   * Ogni metodo fa una sola cosa specifica
   */
  async getSubject(id: number): Promise<Subject> {
    const response = await api.get<Subject>(`/subjects/${id}`);
    return response.data;
  }

/**
   * Crea un nuovo subject.
   * 
   * @param data - Dati del nuovo subject
   * @returns Promise con il subject creato
   * 
   * NOTA: Il backend restituisce il subject completo con ID
   * dopo la creazione, permettendo aggiornamenti ottimistici UI
   */
  async createSubject(data: SubjectCreate): Promise<Subject> {
    const response = await api.post<Subject>('/subjects', data);
    return response.data;
  }

  /**
   * Aggiorna un subject esistente.
   * 
   * @param id - ID del subject da aggiornare
   * @param data - Dati aggiornati (parziali)
   * @returns Promise con il subject aggiornato
   * 
   * PATTERN: Partial Updates
   * Permettiamo aggiornamenti parziali per efficienza
   */
  async updateSubject(id: number, data: Partial<SubjectUpdate>): Promise<Subject> {
    const response = await api.put<Subject>(`/subjects/${id}`, data);
    return response.data;
  }

  /**
   * Elimina un subject.
   * 
   * @param id - ID del subject da eliminare
   * @returns Promise void
   * 
   * DESIGN: Non restituiamo nulla perché DELETE
   * tipicamente non ha response body
   */
  async deleteSubject(id: number): Promise<void> {
    await api.delete(`/subjects/${id}`);
  }

  /**
   * Archivia o dis-archivia un subject.
   * 
   * @param id - ID del subject
   * @param isArchived - Nuovo stato di archiviazione
   * @returns Promise con il subject aggiornato
   * 
   * CONVENIENCE METHOD: Wrapper specifico per un'azione comune
   */
  async toggleArchive(id: number, isArchived: boolean): Promise<Subject> {
    return this.updateSubject(id, { is_archived: isArchived });
  }

  /**
   * Ricerca subjects per nome o descrizione.
   * 
   * @param query - Stringa di ricerca
   * @returns Promise con array di subjects corrispondenti
   * 
   * FUTURE: Potrebbe essere implementato lato backend
   */
  async searchSubjects(query: string): Promise<Subject[]> {
    const response = await api.get<Subject[]>('/subjects/search', {
      params: { q: query }
    });
    return response.data;
  }

  /**
   * Ottiene statistiche aggregate sui subjects.
   * 
   * @returns Promise con statistiche
   * 
   * ESEMPIO di endpoint aggiuntivo che potrebbe essere utile
   */
  async getSubjectStats(): Promise<{
    total: number;
    active: number;
    archived: number;
    byCategory: Record<string, number>;
  }> {
    const response = await api.get('/subjects/stats');
    return response.data;
  }

}

/**
 * Esportiamo un'istanza singleton del service.
 * 
 * PATTERN: Singleton
 * - Una sola istanza del service per tutta l'app
 * - Evita creazioni multiple e spreco di memoria
 * - Facilita il mocking nei test
 */
export const subjectService = new SubjectService();
export default SubjectService;