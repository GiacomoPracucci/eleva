### Sicurezza e Comunicazione tra Domini Web: Cos'è CORS in FastAPI

Nel mondo dello sviluppo web moderno, è comune avere un'applicazione frontend (come un sito web interattivo costruito con React, Angular o Vue.js) che comunica con un'API di backend per recuperare e inviare dati. Quando queste due componenti risiedono su "origini" diverse (ad esempio, il frontend su `http://localhost:3000` e il backend su `http://localhost:8000`), i browser web applicano una politica di sicurezza nota come **Same-Origin Policy (SOP)**. Questa politica impedisce a uno script in esecuzione su una pagina web di effettuare richieste a un'origine diversa da quella da cui la pagina stessa è stata caricata.

Qui entra in gioco il **Cross-Origin Resource Sharing (CORS)**. Si tratta di un meccanismo che consente a un server di indicare quali origini diverse dalla propria sono autorizzate a caricare risorse. In pratica, è un modo per il backend di dire al browser: "Fidati, so che questa richiesta proviene da un dominio diverso, ma è autorizzata a interagire con me".

**FastAPI**, un moderno e performante framework web per Python, offre un modo semplice e robusto per gestire il CORS attraverso un componente chiamato **`CORSMiddleware`**.

FastAPI integra il `CORSMiddleware` che intercetta le richieste in arrivo prima che raggiungano il codice dell'applicazione. Questo middleware è responsabile di aggiungere le intestazioni HTTP appropriate alle risposte del server, comunicando così al browser del client le policy CORS dell'API.

Per abilitare e configurare il CORS in un'applicazione FastAPI, è necessario aggiungere il `CORSMiddleware` all'applicazione e specificare le regole desiderate.