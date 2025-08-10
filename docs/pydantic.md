# Pydantic nel progetto Eléva

## Che cos'è Pydantic?

Pydantic è una libreria Python che offre **validazione dei dati** utilizzando le **type hints** di Python. Il suo motto è "Data validation using Python type hints" e rappresenta uno strumento fondamentale per garantire l'integrità e la consistenza dei dati nelle applicazioni moderne.

### Caratteristiche principali:
- **Validazione automatica**: Converte e valida automaticamente i dati in base ai tipi specificati
- **Type hints native**: Utilizza le annotazioni di tipo standard di Python
- **Serializzazione**: Converte facilmente gli oggetti in dizionari/JSON e viceversa
- **Messaggi di errore chiari**: Fornisce errori dettagliati quando la validazione fallisce
- **Performance**: Implementato in Rust (pydantic v2) per massime prestazioni

## Come viene utilizzato Pydantic in Eléva

Nel progetto Eléva, Pydantic viene utilizzato principalmente in due contesti:

### 1. **Schemi API (Schemas)** 
Gli schemi definiscono la struttura dei dati che l'API accetta e restituisce.

#### Esempio pratico - User Schema (`schemas/user.py`):

```python
class UserCreate(UserBase):
    password: str = Field(..., min_length=8)  # Password obbligatoria, min 8 caratteri

class UserUpdate(BaseModel):
    full_name: Optional[str] = None           # Campo opzionale
    bio: Optional[str] = None                 # Campo opzionale
```

**Cosa succede quando qualcuno fa una richiesta?**
- Se un utente invia `{"password": "123"}`, Pydantic **rifiuta automaticamente** la richiesta (password troppo corta)
- Se invia `{"password": "password123", "email": "not-an-email"}`, Pydantic valida che l'email sia nel formato corretto
- **Zero codice di validazione manuale necessario!**

### 2. **Configurazione dell'applicazione** (`core/config.py`)

```python
class Settings(BaseSettings):
    PROJECT_NAME: str = "Eléva"
    SECRET_KEY: str                    # Obbligatorio dall'env
    DATABASE_URL: str                  # Obbligatorio dall'env
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30  # Default se non specificato
    
    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v):
        # Converte "http://localhost:3000,http://localhost:5173" 
        # in ["http://localhost:3000", "http://localhost:5173"]
        if isinstance(v, str):
            return [i.strip() for i in v.split(",")]
        return v
```

**Vantaggi:**
- **Validazione automatica** delle variabili d'ambiente
- **Conversione automatica** dei tipi (stringa → intero, stringa → lista)
- **Valori di default** gestiti elegantemente
- **Errori chiari** se manca una configurazione obbligatoria

## Confronto: Con e Senza Pydantic

### ❌ **Senza Pydantic** (approccio tradizionale):

```python
@app.post("/users/")
def create_user(request: dict):
    # Validazione manuale lunga e soggetta a errori
    if "email" not in request:
        raise HTTPException(400, "Email richiesta")
    
    email = request["email"]
    if "@" not in email or "." not in email:
        raise HTTPException(400, "Email non valida")
    
    if "password" not in request:
        raise HTTPException(400, "Password richiesta")
    
    password = request["password"]
    if len(password) < 8:
        raise HTTPException(400, "Password troppo corta")
    
    # ... continua per ogni campo ...
    # Codice ripetitivo, difficile da mantenere!
```

### ✅ **Con Pydantic**:

```python
@app.post("/users/")
def create_user(user_data: UserCreate):  # Pydantic fa TUTTO automaticamente!
    # user_data è già validato e convertito
    # Possiamo usarlo direttamente
    return user_crud.create(db, user_data)
```

## Valore aggiunto di Pydantic in Eléva

### 🛡️ **1. Sicurezza e Robustezza**
- **Prevenzione automatica** di dati corrotti o maliziosi
- **Validazione stricta** dei tipi (es: `user_id` deve essere un intero)
- **Sanitizzazione** automatica degli input

### 📚 **2. Documentazione Automatica**
FastAPI + Pydantic generano automaticamente:
- **Swagger UI** con tutti i modelli di dati
- **Documentazione OpenAPI** completa
- **Esempi di richiesta/risposta** automatici

### 🔄 **3. Serializzazione Intelligente**
```python
# Da oggetto SQLAlchemy a JSON automaticamente
user = User(id=1, email="test@example.com")
return user  # FastAPI + Pydantic convertono automaticamente in JSON
```

### 🎯 **4. Type Safety**
- **IntelliSense migliorato** negli IDE
- **Meno bug** in produzione
- **Refactoring più sicuro**

### ⚡ **5. Performance**
- **Pydantic v2** è scritto in Rust = velocità estrema
- **Validazione ottimizzata** vs controlli manuali
- **Meno codice** = meno superficie di errore

## Esempi Concreti nel Progetto

### Schema Subject (`schemas/subject.py`):
```python
class SubjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)  # Nome obbligatorio, 1-200 char
    color: Optional[str] = Field(None, pattern="^#[0-9A-Fa-f]{6}$")  # Regex per colore hex

class SubjectCreate(SubjectBase):
    pass  # Eredita tutte le validazioni da SubjectBase

class SubjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)  # Tutti campi opzionali
    is_active: Optional[bool] = None
```

**Cosa succede in pratica:**
- POST con `{"name": ""}` → **Errore automatico** (nome troppo corto)
- POST con `{"color": "#gggggg"}` → **Errore automatico** (colore non valido)
- PUT con `{"name": "Matematica"}` → **Successo**, altri campi non modificati

### Configurazione CORS automatica:
```python
BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []

@field_validator("BACKEND_CORS_ORIGINS", mode="before")
def assemble_cors_origins(cls, v):
    if isinstance(v, str):
        return [i.strip() for i in v.split(",")]
    return v
```

Nel file `.env` puoi scrivere:
```
BACKEND_CORS_ORIGINS=http://localhost:3000,http://localhost:5173,https://myapp.com
```

E Pydantic automaticamente:
1. **Splitta** la stringa
2. **Rimuove** spazi extra  
3. **Valida** che siano URL validi
4. **Converte** in lista di oggetti AnyHttpUrl

## Conclusione

Pydantic trasforma Eléva da un'applicazione che richiede **validazione manuale verbosa** a un sistema **robusto, sicuro e self-documenting**. Riduce drasticamente il boilerplate code e aumenta la reliability dell'applicazione.

**In sintesi:** Pydantic ti permette di concentrarti sulla logica di business invece che sulla validazione dei dati, rendendo il codice più pulito, sicuro e mantenibile.