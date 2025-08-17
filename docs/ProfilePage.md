* * * * *

Guida ai Concetti Fondamentali: Sviluppo di un Componente React Moderno
=======================================================================

Questo documento analizza la logica e le *best practice* dietro l'implementazione del componente `ProfilePage`. L'obiettivo è deconstructare una soluzione complessa per capire i principi di base che la rendono robusta, manutenibile e user-friendly.

1\. Gestione dello Stato: Il Cervello dell'Applicazione
-------------------------------------------------------

Lo "stato" (state) è semplicemente un insieme di dati che descrive come si presenta e si comporta la nostra applicazione in un dato momento. La decisione più importante è *dove* far vivere questo stato.

### Stato Locale vs. Stato Globale

Immagina un'azienda: ogni dipendente ha le sue note personali sulla scrivania (stato locale), ma tutti condividono l'accesso a una bacheca centrale con le informazioni aziendali (stato globale).

#### Stato Locale (`useState`)

-   **Cos'è**: Dati che servono a **un solo componente**. È la sua memoria a breve termine.

-   **Quando usarlo**: Per stati legati esclusivamente alla UI di quel componente.

-   **Esempi nel nostro codice**:

    -   `isModalOpen`: Il modale è aperto o chiuso? Serve saperlo solo nella pagina `SubjectsPage`.

    -   `apiError`: C'è un errore API da mostrare? Questo messaggio è rilevante solo nella `ProfilePage` mentre l'utente è lì.

    -   `showSuccessMessage`: Stessa logica dell'errore.

JavaScript

```
// Lo stato 'apiError' vive e muore con il componente ProfilePage
const [apiError, setApiError] = useState<string | null>(null);

```

#### Stato Globale (`Zustand`/`useAuthStore`)

-   **Cos'è**: Dati che devono essere accessibili o modificati da **più componenti** in parti diverse dell'applicazione. È la memoria condivisa, la "fonte di verità".

-   **Quando usarlo**: Per dati critici e condivisi.

-   **Esempi nel nostro codice**:

    -   `user`: Le informazioni dell'utente loggato servono in `ProfilePage`, nella `DashboardPage` per il benvenuto, e magari in una futura navbar. Tenerlo in uno stato globale evita di dover passare questi dati manualmente tra i componenti.

    -   `isLoading`, `error` (nello store): Utili per gestire stati di autenticazione a livello di app (es. mostrare uno spinner globale).

Quando in `ProfilePage` salviamo le modifiche, non basta aggiornare il database. Dobbiamo anche aggiornare lo stato globale con `setUser(nuoviDati)`. In questo modo, se l'utente naviga alla dashboard, vedrà subito il suo nuovo nome senza dover ricaricare la pagina.

* * * * *

2\. Gestione dei Form Complessi con `react-hook-form`
-----------------------------------------------------

I form sono una delle parti più complesse dello sviluppo front-end. Gestire ogni campo con `useState` diventa rapidamente un incubo per performance e leggibilità. `react-hook-form` risolve questi problemi in modo elegante.

### Logiche Chiave Implementate

-   **Controlled Components & `defaultValues`**: Il form viene inizializzato con i dati dell'utente. Questo è fondamentale perché `react-hook-form` ha bisogno di un punto di partenza per sapere quali sono i valori originali. Lo `useEffect` che usa `reset(user)` garantisce che il form si popoli non appena i dati dell'utente sono disponibili.

-   **Tracciamento delle Modifiche (`isDirty`)**: Questa è una feature di UX potentissima. `isDirty` è un booleano che diventa `true` solo se l'utente modifica almeno un campo rispetto ai `defaultValues`. Nel nostro codice, lo usiamo per:

    1.  **Abilitare il pulsante "Save Changes"**: Evita salvataggi inutili se non è cambiato nulla.

    2.  **Mostrare il pulsante "Cancel"**: Appare solo se ci sono modifiche da annullare.

    3.  **Mostrare il testo "You have unsaved changes"**: Un feedback chiaro per l'utente.

-   **Gestione della Sottomissione (`handleSubmit` e `isSubmitting`)**:

    -   `handleSubmit(onSubmit)` è un "wrapper". Quando il form viene inviato, `handleSubmit` prima esegue la validazione. Solo se tutti i campi sono validi, chiama la nostra funzione `onSubmit` passandole i dati.

    -   `isSubmitting` diventa `true` durante l'esecuzione della nostra `onSubmit` (che è `async`). Lo usiamo per mostrare lo spinner e disabilitare il pulsante, prevenendo invii multipli.

* * * * *

3\. Interazione con le API e Feedback Utente (UX)
-------------------------------------------------

Un'interfaccia moderna deve "parlare" con l'utente, informandolo costantemente di ciò che accade, specialmente durante le operazioni di rete che richiedono tempo.

### Il Flusso di una Richiesta API

1.  **Azione Utente**: L'utente clicca "Save Changes".

2.  **Stato di Caricamento**: L'UI entra in stato di loading (`isSubmitting: true`). Il pulsante mostra "Saving..." e viene disabilitato.

3.  **Chiamata Asincrona**: Parte la chiamata `api.put(...)`. Usiamo `async/await` dentro un blocco `try/catch`.

    -   **`try`**: Qui mettiamo il "codice felice" (happy path). Se la chiamata va a buon fine, procediamo.

    -   **`catch`**: Se la chiamata fallisce (errore di rete, errore del server), il codice nel `catch` viene eseguito.

4.  **Gestione del Risultato**:

    -   **Successo (blocco `try`)**: Aggiorniamo lo stato globale (`setUser`), resettiamo il form (`reset`) e mostriamo un messaggio di successo.

    -   **Errore (blocco `catch`)**: Non facciamo crashare l'app. Invece, catturiamo l'errore, lo salviamo nello stato locale `apiError` e lo mostriamo all'utente in un box di notifica.

Questo ciclo completo assicura che l'applicazione sia resiliente e che l'utente non venga mai lasciato nel dubbio.

* * * * *

4\. Scomposizione in Componenti più Piccoli
-------------------------------------------

Come hai notato, `ProfilePage` è diventato un file lungo. Sebbene sia tutto logicamente correlato, viola il **Principio della Singola Responsabilità** (Single Responsibility Principle). Un componente dovrebbe fare una cosa sola e farla bene. `ProfilePage` al momento fa troppe cose: gestisce il layout, il form, l'header, le impostazioni di privacy, ecc.

### Il "Perché" della Scomposizione

-   **Leggibilità**: Un componente di 50 righe è più facile da capire di uno di 250.

-   **Manutenibilità**: Se c'è un bug nelle impostazioni di privacy, sai esattamente in quale file guardare (`PrivacySettings.tsx`) invece di cercare in un file enorme.

-   **Riutilizzabilità**: Un domani potresti voler usare le stesse `PrivacySettings` in un'altra parte dell'app. Se è un componente separato, puoi farlo.

### Esempio Pratico: Estrazione di `PrivacySettings`

Vediamo come estrarre la sezione delle impostazioni di privacy.

**Prima: Tutto dentro `ProfilePage.tsx`**

JavaScript

```
// ... dentro il return di ProfilePage
<div className="border-t pt-4">
  <h3 className="text-lg font-medium text-gray-900 mb-3">Privacy Settings</h3>
  <div className="space-y-3">
    <label className="flex items-center space-x-3">
      <input
        type="checkbox"
        {...register('show_profile_publicly')}
        className="w-4 h-4 text-blue-600..."
      />
      {/* ... */}
    </label>
    <label className="flex items-center space-x-3">
      <input
        type="checkbox"
        {...register('allow_ai_training')}
        className="w-4 h-4 text-blue-600..."
      />
      {/* ... */}
    </label>
  </div>
</div>

```

**Dopo: Creazione di un nuovo componente**

1.  Crea un nuovo file: `src/components/profile/PrivacySettings.tsx`.

2.  Sposta la logica e il JSX lì. Il componente deve ricevere la funzione `register` come prop.

    TypeScript

    ```
    // src/components/profile/PrivacySettings.tsx
    import { UseFormRegister } from 'react-hook-form';
    import { UserUpdate } from '@/types';

    interface PrivacySettingsProps {
      register: UseFormRegister<UserUpdate>;
    }

    export const PrivacySettings = ({ register }: PrivacySettingsProps) => {
      return (
        <div className="border-t pt-4">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Privacy Settings</h3>
          <div className="space-y-3">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                {...register('show_profile_publicly')}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Show profile publicly</span>
                <p className="text-xs text-gray-500">Allow other users to view your profile</p>
              </div>
            </label>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                {...register('allow_ai_training')}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Allow AI training</span>
                <p className="text-xs text-gray-500">Help improve our AI by allowing anonymous usage of your data</p>
              </div>
            </label>
          </div>
        </div>
      );
    };

    ```

3.  Usa il nuovo componente in `ProfilePage.tsx`.

    JavaScript

    ```
    // ... dentro il form di ProfilePage.tsx
    import { PrivacySettings } from '@/components/profile/PrivacySettings';

    // ...
    <select {...register('academic_level')} >
      {/* ... options ... */}
    </select>

    {/* Molto più pulito! */}
    <PrivacySettings register={register} />

    <div className="flex justify-between items-center pt-4 border-t">
        {/* ... Form Actions ... */}
    </div>

    ```

Il risultato è che `ProfilePage` diventa un "contenitore" che orchestra componenti più piccoli e specializzati. Questa è la via per creare applicazioni scalabili e facili da mantenere.

* * * * *

5\. Spunti di Miglioramento Suggeriti
-------------------------------------

-   **Notifiche "Toast" Centralizzate**: Utilizzare una libreria come `Sonner` o `React Hot Toast` per gestire tutte le notifiche dell'app da un unico punto, garantendo consistenza e una migliore UX.

-   **Upload Immagine Atomico**: Separare la logica di upload dell'immagine dal salvataggio del form. L'immagine viene caricata immediatamente dopo la selezione, e solo il suo URL viene gestito insieme agli altri dati del profilo.

-   **Creazione di Componenti UI Generici**: Oltre a scomporre la pagina, creare una libreria di componenti UI di base (in `src/components/ui`) come `<Button>`, `<Input>`, `<Card>`, `<Select>`. Questo è il passo finale per costruire un vero e proprio **Design System**.