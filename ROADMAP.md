PROMPT DETTAGLIATO: SPECIFICA TECNICA FABBRICAMI.PRO

FASE 0: AUDIT E ANALISI ESISTENTE
A. VERIFICA LAVORO PEGASOWORLD
Obiettivo: Capire esattamente cosa hai già costruito per evitare duplicazioni e identificare riutilizzabile.
Cosa verificare:

Plugin WordPress esistente

Quali endpoint API WordPress stai usando (REST API, custom endpoints)?
Come gestisci l'autenticazione (API keys, OAuth, JWT)?
Quali webhook hai implementato (nuovo ordine, aggiornamento prodotto, cambio stato)?
Come sincronizzi i dati (polling ogni X minuti, webhook real-time, cron job)?
Gestione errori e retry logic implementata?


Database gestionale attuale

Schema tabelle esistenti (prodotti, ordini, clienti, magazzino)
Relazioni tra tabelle già definite
Indici e ottimizzazioni presenti
-Constrains e validazioni a livello database
Trigger o stored procedures in uso


Logica business implementata

Sincronizzazione prodotti: unidirezionale o bidirezionale?
Gestione varianti prodotto: come le mappi tra gestionale e WooCommerce?
Aggiornamento giacenze: quando avviene (tempo reale, batch)?
Gestione ordini: quali stati ordine gestisci?
Fatturazione: formato XML SDI già implementato?


UI/Frontend costruito

Framework usato (React, Vue, vanilla JS)?
Componenti riutilizzabili già creati
State management (Redux, Context, Zustand)?
Autenticazione utenti gestita come?
Responsive design implementato?


Integrazioni terze parti

Servizi fatturazione elettronica integrati
Gateway pagamento
Servizi corrieri
Altre API esterne



Output atteso:

Documento markdown con inventario completo del codice esistente
Identificazione parti riutilizzabili vs da rifare
Lista gap funzionali da colmare


FASE 1: ARCHITETTURA E SETUP INIZIALE
A. ARCHITETTURA GENERALE SISTEMA
Componenti principali:

Frontend Gestionale (Web App)

Single Page Application accessibile via browser
Responsive design (desktop primary, mobile secondary)
Autenticazione multi-tenant (ogni azienda isolata)
Router per navigazione (dashboard, prodotti, ordini, magazzino, etc)


Backend API Server

RESTful API per comunicazione frontend-backend
WebSocket per notifiche real-time
Background jobs per task asincroni
Rate limiting per protezione
Multi-tenancy a livello database


Plugin WordPress

Installabile da marketplace o upload manuale
UI configurazione semplice
Comunicazione bidirezionale con backend API
Gestione webhook per eventi WordPress
Logging errori per debugging


Database

PostgreSQL come database principale
Schema multi-tenant (tenant_id su ogni tabella)
Redis per caching e queue jobs
Backup automatici giornalieri


Storage

Immagini prodotti (S3-compatible storage)
Documenti PDF (fatture, DDT)
Backup database



Comunicazione tra componenti:
Frontend ←→ Backend API ←→ Database
                ↓
          Background Jobs
                ↓
          WordPress Plugin ←→ WooCommerce
B. DATA MODEL CORE
Struttura multi-tenant:
Ogni tabella deve avere:

id (UUID primary key)
tenant_id (UUID, riferimento all'azienda)
created_at (timestamp)
updated_at (timestamp)
deleted_at (timestamp nullable per soft delete)

Indici obbligatori:

Indice composto su (tenant_id, id) per ogni tabella
Indice su created_at per query temporali
Indici specifici per campi frequentemente cercati

Regole validazione livello database:

Foreign keys con ON DELETE CASCADE dove appropriato
Check constraints per valori ammessi
NOT NULL su campi obbligatori
Unique constraints dove necessario

C. AUTENTICAZIONE E AUTORIZZAZIONE
Sistema autenticazione:

Registrazione azienda

Form raccolta: nome azienda, email, password, P.IVA
Verifica email obbligatoria
Creazione automatica tenant_id univoco
Setup iniziale guidato (wizard onboarding)


Login utenti

Email + password
JWT token con refresh token
Sessioni con scadenza configurabile
Possibilità logout da tutti i dispositivi


Gestione utenti multipli per azienda

Ruoli: Owner, Admin, Manager, Operatore, Viewer
Permessi granulari per modulo
Invito collaboratori via email
Attivazione/disattivazione utenti


Sicurezza

Rate limiting login (max 5 tentativi)
2FA opzionale (TOTP)
Password policy (min 8 caratteri, maiuscola, numero)
Hash password con bcrypt




FASE 2: MODULO PLUGIN WORDPRESS (FONDAMENTA)
A. ARCHITETTURA PLUGIN
Struttura file plugin:
fabbricami-connector/
├── fabbricami.php (main plugin file)
├── includes/
│   ├── class-api-connector.php
│   ├── class-webhook-handler.php
│   ├── class-product-sync.php
│   ├── class-order-sync.php
│   └── class-settings.php
├── admin/
│   ├── settings-page.php
│   └── assets/
└── readme.txt
B. CONFIGURAZIONE PLUGIN
Setup wizard prima connessione:

Schermata benvenuto

Spiegazione cosa fa il plugin
Link documentazione
Bottone "Inizia configurazione"


Connessione API

Input URL backend API FabbricaMi
Generazione API key automatica
Test connessione con validazione
Salvataggio credenziali criptate in wp_options


Configurazione sync

Selezione modalità sync prodotti (automatica vs manuale)
Frequenza aggiornamento giacenze (real-time, ogni 5 min, oraria)
Selezione categorie prodotti da sincronizzare
Mapping campi custom (se presenti)


Configurazione ordini

Quali stati ordine inviare a FabbricaMi
Mapping stati ordine WooCommerce → FabbricaMi
Email notifiche errori sync



Pagina impostazioni permanente:

Tab "Connessione": modifica API key, URL, test connessione
Tab "Prodotti": configurazione sync prodotti
Tab "Ordini": configurazione sync ordini
Tab "Avanzate": logging, debug mode, webhook URL
Tab "Stato": dashboard salute connessione, ultimi sync, errori

C. SINCRONIZZAZIONE PRODOTTI
Direzione 1: FabbricaMi → WordPress (Creazione/Aggiornamento)
Trigger:

Admin crea prodotto in FabbricaMi
Admin modifica prodotto in FabbricaMi
Background job ogni X minuti

Flusso:

FabbricaMi invia POST a /wp-json/fabbricami/v1/products/sync
Plugin riceve payload JSON prodotto
Validazione payload (campi obbligatori presenti)
Verifica se prodotto esiste (match per SKU)
Se esiste: aggiorna dati WooCommerce
Se non esiste: crea nuovo prodotto WooCommerce
Gestione varianti se presenti
Upload immagini da URL se fornite
Aggiorna categorie e tag
Salva mapping ID FabbricaMi ↔ ID WooCommerce in meta
Response conferma o errore

Campi sincronizzati:

SKU (identificatore univoco)
Nome prodotto
Descrizione breve e lunga
Prezzo regolare e prezzo scontato
Giacenza (stock quantity)
Stato stock (in stock, out of stock)
Peso e dimensioni
Immagine principale + galleria
Categorie
Tag
Attributi per varianti

Gestione varianti:

Prodotto parent con varianti child
Ogni variante ha SKU univoco
Attributi variazione (colore, taglia, etc)
Prezzo e giacenza specifica per variante

Errori da gestire:

SKU duplicato in WordPress (conflitto)
Immagine non raggiungibile
Categoria non esistente
Dati mancanti obbligatori
Timeout connessione

Direzione 2: WordPress → FabbricaMi (Aggiornamenti giacenza)
Trigger:

Ordine completato in WooCommerce
Admin modifica manualmente giacenza
Prodotto eliminato

Flusso:

Hook WooCommerce woocommerce_order_status_completed
Estrai prodotti dall'ordine
Per ogni prodotto, invia aggiornamento giacenza a FabbricaMi
FabbricaMi aggiorna giacenza nel gestionale
Conferma sync ricevuta

Webhook da implementare:

product.updated → notifica FabbricaMi
product.deleted → notifica FabbricaMi
order.created → invia ordine a FabbricaMi
order.status_changed → aggiorna stato in FabbricaMi

D. SINCRONIZZAZIONE ORDINI
Flusso completo ordine:

Cliente completa checkout WordPress

WooCommerce crea ordine
Stato iniziale: "Processing" o "Pending payment"


Plugin cattura evento woocommerce_new_order

Estrae dati ordine (prodotti, quantità, cliente, totali)
Formatta JSON payload
Invia POST a FabbricaMi /api/orders/import


FabbricaMi riceve ordine

Crea record ordine in database
Collega prodotti ordinati
Verifica disponibilità giacenze
Se tutto OK, crea ordine produzione automatico
Risponde con ID ordine FabbricaMi


Plugin salva mapping

Meta order: _fabbricami_order_id
Conferma sync avvenuta


Aggiornamenti stato ordine

Admin FabbricaMi segna "In produzione"
Webhook a WordPress aggiorna stato
Admin FabbricaMi segna "Spedito" + tracking
Webhook aggiorna WordPress + invia email cliente



Dati ordine sincronizzati:

Numero ordine WordPress
Data ordine
Cliente (nome, cognome, email, telefono)
Indirizzo fatturazione
Indirizzo spedizione (se diverso)
Prodotti ordinati (SKU, quantità, prezzo)
Totali (subtotale, tasse, spedizione, totale)
Metodo pagamento
Note ordine
Stato ordine

Gestione errori:

Prodotto non trovato in FabbricaMi (SKU mismatch)
Quantità non disponibile
Dati cliente incompleti
Errore rete/timeout
Retry automatico (max 3 tentativi)

E. LOGGING E DEBUG
Sistema logging plugin:

Log eventi sync

Timestamp evento
Tipo sync (prodotto, ordine, giacenza)
Direzione (WordPress→FabbricaMi o viceversa)
Esito (success, error, warning)
Dettagli errore se presente
Payload JSON (se debug mode attivo)


Visualizzazione log in admin

Tabella ultimi 100 eventi
Filtri per tipo e stato
Dettaglio evento espandibile
Bottone "Retry" per eventi falliti
Export log CSV


Notifiche errori

Email admin se errore critico
Badge notifica in menu WordPress
Dashboard widget con riepilogo salute




FASE 3: MODULO GESTIONE PRODOTTI
A. ANAGRAFICA PRODOTTI
Entità Prodotto:
Campi obbligatori:

Nome prodotto (string, max 255 caratteri)
SKU (string univoco, max 50 caratteri, alphanumerico + dash)
Tipo prodotto (enum: semplice, variabile, composito)
Categoria (riferimento a tabella categorie)
Unità di misura (enum: pz, kg, m, l, etc)
IVA applicabile (% standard: 22%, 10%, 4%, 0%)
Stato (enum: attivo, bozza, archiviato)

Campi opzionali:

Descrizione breve (text, max 500 caratteri)
Descrizione completa (rich text)
Codice a barre / EAN
Marca / Brand
Tag multipli
Peso (decimal)
Dimensioni (lunghezza, larghezza, altezza in cm)
Immagine principale (URL)
Galleria immagini (array URL)
Note interne (text)

Campi calcolati automaticamente:

Costo medio ponderato (da movimenti magazzino)
Giacenza totale (sum da magazzini)
Giacenza disponibile (totale - impegnato)
Giacenza impegnata (da ordini non evasi)
Valore giacenza (giacenza × costo medio)
Ultimo carico (data)
Ultimo scarico (data)

Prezzi prodotto:

Prezzo acquisto (decimal)
Prezzo vendita base (decimal)
Margine percentuale (calcolato: (vendita-acquisto)/vendita * 100)
Prezzo vendita online (può differire da base)
Data ultimo aggiornamento prezzo

Varianti prodotto (se tipo = variabile):
Relazione 1 prodotto parent → N varianti child
Attributi variazione:

Nome attributo (es: "Colore", "Taglia")
Valori possibili (es: ["Rosso", "Blu", "Verde"])
Visibile su frontend WordPress (boolean)

Variante specifica:

Combinazione attributi (es: Colore=Rosso, Taglia=M)
SKU proprio univoco
Prezzo specifico (o eredita da parent)
Giacenza specifica
Immagine specifica (opzionale)

Validazioni:

SKU univoco a livello tenant
Nome non vuoto
Prezzo vendita >= prezzo acquisto (warning, non blocco)
Se tipo variabile, almeno 1 attributo definito
Se variante, deve avere parent valido
IVA tra valori ammessi
Peso e dimensioni se presenti devono essere > 0

B. CATEGORIE E ORGANIZZAZIONE
Struttura categorie:

Albero gerarchico (categoria → sottocategoria → sotto-sottocategoria)
Profondità massima 3 livelli
Ogni categoria ha: nome, slug, descrizione, parent_id (nullable)
Mapping automatico con categorie WordPress

Tag prodotti:

Tag liberi definibili dall'utente
Autocomplete quando digiti (suggerisce tag esistenti)
Multipli tag per prodotto
Usati per filtri e ricerche

Filtri e ricerca prodotti:

Ricerca full-text su nome, SKU, descrizione
Filtro per categoria (incluso figli)
Filtro per tag
Filtro per stato (attivo, bozza, archiviato)
Filtro per tipo (semplice, variabile)
Filtro per giacenza (in stock, sotto scorta, esaurito)
Ordinamento per: nome, SKU, prezzo, giacenza, ultimo aggiornamento

C. GESTIONE IMMAGINI
Upload immagini:

Drag & drop diretto in UI
Formati accettati: JPG, PNG, WEBP
Dimensione max 5MB per immagine
Resize automatico se troppo grande (max 2000x2000px)
Compressione automatica per ridurre peso
Generazione thumbnail automatica

Storage immagini:

Salvataggio su S3-compatible storage
Naming convention: {tenant_id}/products/{product_id}/{timestamp}_{filename}
URL pubblici generati automaticamente
CDN per delivery veloce

Gestione galleria:

Immagine principale (obbligatoria)
Galleria immagini secondarie (max 10)
Drag & drop per riordinare
Bottone "Elimina" per ogni immagine
Zoom preview al click

Sync immagini con WordPress:

Upload automatico a media library WordPress
Mapping ID immagine FabbricaMi ↔ ID WordPress media
Aggiornamento se immagine cambiata

D. DISTINTA BASE (BOM - Bill of Materials)
Concetto: Definire COSA serve per produrre un prodotto finito.
Struttura BOM:
Prodotto finito → Lista componenti necessari
Esempio:
Prodotto: Boeing 747 (Modellino)
Componenti:
  - Fusoliera ABS (1 pz)
  - Ali destra/sinistra (2 pz)
  - Motori (4 pz)
  - Carrello (3 pz)
  - Decal Boeing (1 set)
  - Scatola confezione (1 pz)
Implementazione:
Tabella bom_items:

product_id (prodotto finito)
component_id (prodotto componente)
quantity (quantità necessaria)
unit (unità di misura)
notes (note opzionali)

UI Gestione BOM:

Scheda prodotto, tab "Distinta Base"

Se prodotto semplice: mostra form aggiungi componenti
Lista componenti correnti in tabella
Colonne: Nome componente, SKU, Quantità, UM, Giacenza disponibile, Azioni


Aggiunta componente:

Search box con autocomplete prodotti esistenti
Input quantità necessaria
Bottone "Aggiungi"
Componente aggiunto alla lista


Modifica/Rimozione:

Click su quantità per modificare inline
Icona cestino per rimuovere
Salvataggio automatico



BOM multi-livello (opzionale v2):

Prodotto finito → Sub-assemblaggi → Componenti base
Calcolo ricorsivo componenti totali necessari
Esplosione BOM completa

Validazioni:

Un prodotto non può contenere sé stesso
Niente cicli nella BOM (A contiene B che contiene A)
Quantità deve essere > 0
Componente deve essere prodotto esistente

Calcoli automatici:
Quando apri prodotto con BOM, mostra:

"Quantità producibile con giacenze attuali"
Calcolo: MIN(giacenza_componente / quantità_necessaria) per tutti i componenti
Se manca qualche componente, evidenzia in rosso

Esempio:
Boeing 747: Puoi produrre 12 unità

Componenti disponibili:
✅ Fusoliera: 50 (serve 1) → OK per 50 unità
✅ Ali: 30 (serve 2) → OK per 15 unità  
❌ Motori: 45 (serve 4) → OK solo per 11 unità ← LIMITANTE
✅ Scatola: 100 (serve 1) → OK per 100 unità

Bottiglia: Motori (mancano 3 per produrre 1 unità extra)
E. LISTINI E PREZZI
Listino base:

Prezzo vendita standard per ogni prodotto
Applicato a clienti B2C e B2B senza listino custom

Listini personalizzati B2B:
Tabella price_lists:

name (nome listino, es: "Rivenditori", "Grossisti")
type (percentuale sconto, prezzo fisso, formula)
discount_percentage (se type = percentuale)
valid_from (data inizio validità)
valid_to (data fine, nullable)
active (boolean)

Tabella price_list_items:

price_list_id
product_id
custom_price (prezzo specifico per questo listino)
min_quantity (quantità minima per prezzo, default 1)

Assegnazione listino a cliente:

Tabella clienti ha campo price_list_id (nullable)
Se cliente ha listino assegnato, usa quello
Altrimenti usa listino base

Prezzi a scaglioni quantità:
Prodotto X:
1-9 pz: €10 cad
10-49 pz: €9 cad (-10%)
50+ pz: €8 cad (-20%)
Implementazione:

price_list_items con min_quantity diverso
Ordinamento per min_quantity DESC
Seleziona primo match

Calcolo prezzo ordine:

Identifica cliente
Ottieni listino assegnato (se presente)
Per ogni prodotto:

Cerca prezzo in listino custom per quella quantità
Se non trovato, usa prezzo base


Applica eventuali sconti extra (promo, coupon)

Marginalità:

Calcolo automatico: (prezzo_vendita - costo_acquisto) / prezzo_vendita * 100
Visualizzazione in tabella prodotti
Alert se margine < soglia configurata (es: <15%)
Report marginalità aggregata per categoria


FASE 4: MODULO GESTIONE MAGAZZINO
A. GIACENZE E MOVIMENTI
Concetto giacenze:
Ogni prodotto può avere giacenza in uno o più magazzini.
Tabella warehouse_stock:

warehouse_id (magazzino, default 1 = principale)
product_id
quantity (giacenza fisica)
reserved_quantity (impegnata per ordini)
available_quantity (calcolato: quantity - reserved)
last_inventory_date (ultima verifica fisica)

Magazzini:
Tabella warehouses:

name (es: "Magazzino Principale", "Deposito 2")
code (codice breve univoco)
address (indirizzo fisico)
is_default (boolean, solo uno può essere default)
active (boolean)

MVP: 1 solo magazzino attivo
Fase 2: Multi-magazzino con trasferimenti
Movimenti di magazzino:
Ogni variazione giacenza deve essere tracciata.
Tabella stock_movements:

product_id
warehouse_id
type (enum: carico, scarico, rettifica, trasferimento)
quantity (positiva per carico, negativa per scarico)
reference_type (enum: ordine_cliente, ordine_fornitore, produzione, inventario, altro)
reference_id (ID entità collegata)
notes (motivazione movimento)
user_id (chi ha fatto il movimento)
movement_date (data movimento, default oggi)

Flusso carico manuale:

Admin va in "Magazzino → Carico merce"
Seleziona prodotto (autocomplete)
Inserisce quantità
Opzionale: documento riferimento (es: DDT fornitore)
Opzionale: costo unitario (aggiorna costo medio)
Note
Salva
Sistema:

Crea record in stock_movements
Aggiorna warehouse_stock.quantity (+quantità)
Ricalcola costo medio ponderato se fornito
Salva log audit



Flusso scarico manuale:

Analogo a carico ma quantity negativa
Validazione: quantità disponibile sufficiente

Flusso rettifica inventario:

Admin fa inventario fisico
Conta pezzi reali
Inserisce nuova giacenza corretta
Sistema calcola differenza (quantity_corretta - quantity_attuale)
Crea movimento tipo "rettifica"
Aggiorna giacenza

Scarico automatico da ordine cliente:

Quando ordine passa a "Completato" o "Spedito"
Per ogni prodotto nell'ordine:

Crea movimento scarico
Tipo: ordine_cliente
Reference_id: order_id
Quantity: -quantità_ordinata
Aggiorna giacenza



Carico automatico da produzione:

Quando ordine produzione completato
Crea movimento carico
Tipo: produzione
Reference_id: production_order_id
Quantity: quantità prodotta

Scarico automatico componenti produzione:

Quando ordine produzione inizia o completa
Per ogni componente nella BOM:

Crea movimento scarico
Quantity: -quantità_componente × quantità_prodotta



B. GESTIONE SCORTE E ALERT
Campi prodotto per gestione scorte:

min_stock (scorta minima, trigger riordino)
reorder_point (punto di riordino ottimale)
max_stock (scorta massima consigliata)
reorder_quantity (quantità standard da ordinare)
lead_time_days (giorni consegna fornitore)

Calcolo automatico punto riordino:
Formula: reorder_point = (vendite_medie_giornaliere × lead_time_days) + scorta_sicurezza
Dove:

vendite_medie_giornaliere = media ultimi 30/60/90 giorni (configurabile)
scorta_sicurezza = % variabilità domanda (es: 20% delle vendite medie)

Sistema alert:
Tabella stock_alerts:

product_id
alert_type (enum: sotto_scorta, esaurito, eccesso, da_riordinare)
current_quantity
threshold_quantity
generated_at
resolved_at (nullable)
resolved_by_user_id (nullable)

Trigger alert automatici:

Sotto scorta minima:

Trigger: giacenza < min_stock
Generato ogni notte (cron job)
Notifica dashboard + email opzionale


Esaurito:

Trigger: giacenza <= 0
Priorità alta
Blocca possibilità ordini online (opzionale)


Punto riordino raggiunto:

Trigger: giacenza <= reorder_point
Suggerisce quantità da ordinare
Calcola quando ordinare per non finire scorte


Eccesso giacenza (opzionale):

Trigger: giacenza > max_stock
Suggerisce riduzione ordini o promozioni



Dashboard alert:
Sezione dedicata in homepage:
🔴 ALERT MAGAZZINO (3)

Prodotti esauriti (1):
  - Motori turbina (SKU: MOT-001)
    Giacenza: 0 | Ordini in attesa: 3
    [RIORDINA ORA]

Sotto scorta minima (2):
  - Viti M3 (SKU: VIT-003)
    Giacenza: 15 | Minimo: 50 | Vendite medie: 8/gg
    Scorte per 1.9 giorni
    [RIORDINA 500 PZ]
    
  - Decal Boeing (SKU: DEC-747)
    Giacenza: 8 | Minimo: 20
    [RIORDINA 50 PZ]
Risoluzione alert:

Click su "RIORDINA" genera bozza ordine fornitore
Oppure admin segna manualmente "Risolto" con nota
Alert scompare quando giacenza torna sopra soglia

C. INVENTARIO FISICO
Processo inventario:

Pianificazione

Admin crea "Sessione inventario"
Seleziona magazzino
Opzionale: filtra categorie prodotti
Genera lista prodotti da contare


Conteggio

Per ogni prodotto:

Mostra giacenza teorica attuale
Input giacenza contata reale
Note eventuali discrepanze


Possibilità salvataggio parziale (riprendi dopo)


Riconciliazione

Mostra tabella differenze:

Prodotto | Teorico | Contato | Diff | Valore diff


Ordinamento per valore differenza (evidenzia discrepanze maggiori)
Possibilità ricontare specifici prodotti


Conferma e rettifica

Admin conferma inventario
Sistema per ogni differenza:

Crea movimento "rettifica inventario"
Aggiorna giacenza a valore contato
Registra chi/quando fatto


Generazione report PDF inventario



Report inventario:

Data inventario
Magazzino
Totale prodotti contati
Valore giacenza totale
Elenco differenze
Firma operatore

D. PREVISIONI E FORECASTING
Dati necessari per forecasting:
Tabella sales_statistics (generata notte da cron):

product_id
period (giorno, settimana, mese)
period_date
quantity_sold
revenue
num_orders

Calcoli forecasting:

Vendite medie giornaliere:

Media mobile ultimi 30 giorni
Esclusione outliers (giorni con vendite > 3× std deviation)
Aggiornamento giornaliero


Trend vendite:

Confronto ultimi 30 vs precedenti 30 giorni
Percentuale crescita/decrescita
Classificazione: crescita forte (>30%), crescita (+10-30%), stabile (-10/+10%), calo (-10-30%), calo forte (<-30%)


Stagionalità:

Se dati >= 12 mesi, calcola indice stagionalità per mese
Esempio: vendite Dicembre sono 150% della media annua
Applica fattore stagionale a previsioni


Giorni scorte rimanenti:

   giorni_rimanenti = giacenza_disponibile / vendite_medie_giornaliere

Data prevista esaurimento:

   data_esaurimento = oggi + giorni_rimanenti

Quantità consigliata riordino:

   qta_riordino = (vendite_medie_giornaliere × lead_time × 2) + scorta_sicurezza
Il "×2" assicura scorte per doppio lead time (margine)
Dashboard forecasting:
Widget "Previsioni Magazzino":
Prossimi prodotti da riordinare:

1. Viti M3
   Giacenza: 45 pz
   Vendite medie: 12/gg
   Scorte per: 3.8 giorni
   Esaurimento previsto: 4 Feb 2026
   Lead time: 7 gg
   ⚠️ ORDINA ENTRO: 28 Gen (OGGI!)
   Quantità consigliata: 200 pz
   [CREA ORDINE]

2. Plastica ABS
   Giacenza: 15 kg
   Vendite medie: 2 kg/gg  
   Scorte per: 7.5 giorni
   Esaurimento previsto: 8 Feb 2026
   Lead time: 10 gg
   Ordina entro: 29 Gen (domani)
   Quantità consigliata: 25 kg
   [CREA ORDINE]
Notifiche proattive:
Email automatica ogni lunedì mattina:

Lista prodotti da riordinare questa settimana
Link diretti per creare ordini
Sommario situazione magazzino


FASE 5: MODULO GESTIONE ORDINI CLIENTI
A. ANAGRAFICA CLIENTI
Tabella customers:
Campi base:

type (enum: privato, azienda)
company_name (se azienda)
first_name, last_name (se privato)
email (univoco)
phone
mobile

Dati fiscali:

vat_number (P.IVA se azienda)
tax_code (Codice Fiscale se privato)
sdi_code (Codice SDI per fatturazione elettronica)
pec (PEC come alternativa a SDI)
billing_address (JSON: via, città, CAP, provincia, nazione)

Dati commerciali:

customer_category (enum: B2C, B2B_small, B2B_large, VIP)
price_list_id (listino assegnato)
payment_terms (enum: immediato, 30gg, 60gg, 90gg)
credit_limit (limite fido, nullable)
discount_percentage (sconto extra generale, 0-100)
notes (note interne non visibili al cliente)

Indirizzi spedizione:
Tabella customer_addresses:

customer_id
address_type (enum: billing, shipping, both)
address_name (es: "Sede principale", "Magazzino 2")
address_line_1
address_line_2 (opzionale)
city
state_province
postal_code
country
is_default (boolean)

Campi calcolati:

total_orders (count ordini)
total_revenue (sum totali ordini)
average_order_value
last_order_date
first_order_date
customer_since (= first_order_date)

Import clienti da WordPress:
Quando ordine arriva da WordPress:

Cerca cliente per email
Se esiste: aggiorna dati se cambiati
Se non esiste: crea nuovo automaticamente
Salva mapping _wordpress_customer_id in meta

Form creazione/modifica cliente:
Wizard step:

Tipo cliente (privato/azienda)
Dati anagrafici
Dati fiscali (se azienda richiedi P.IVA obbligatoria)
Indirizzo fatturazione
Indirizzi spedizione (multipli)
Condizioni commerciali
Riepilogo e salva

Validazioni:

Email formato valido e univoca
Se azienda: P.IVA formato corretto (11 cifre IT)
Codice Fiscale formato corretto (16 caratteri)
SDI code 7 caratteri alfanumerici OPPURE PEC valida
CAP formato corretto per nazione
Credit limit >= 0

B. CREAZIONE ORDINE CLIENTE
Flusso creazione manuale ordine:

Selezione cliente

Autocomplete ricerca cliente (nome, email, P.IVA)
Bottone "Nuovo cliente veloce" (crea al volo con dati essenziali)
Una volta selezionato: mostra riepilogo cliente (listino, sconto, fido)


Aggiunta prodotti

Autocomplete prodotti (nome, SKU)
Per ogni prodotto:

Mostra giacenza disponibile
Input quantità
Mostra prezzo unitario (dal listino cliente)
Possibilità override prezzo (con permesso admin)
Sconto % riga
Calcolo automatico totale riga


Bottone "Aggiungi prodotto"
Tabella prodotti aggiunti con totali


Dettagli ordine

Data ordine (default oggi, modificabile)
Data consegna richiesta (opzionale)
Indirizzo spedizione (select tra indirizzi cliente o nuovo)
Metodo spedizione (corriere, ritiro, altro)
Metodo pagamento (contanti, bonifico, carta, Paypal, altro)
Note ordine (visibili al cliente)
Note interne (non visibili)


Totali

Subtotale prodotti
Sconto generale % (se cliente ha sconto)
Spese spedizione (input manuale o calcolo auto)
Totale imponibile
IVA (suddivisa per aliquota se prodotti diversi)
Totale ordine


Riepilogo e conferma

Mostra riepilogo completo
Controlla fido cliente (warning se supera limite)
Controlla disponibilità prodotti (warning se insufficienti)
Bottone "Salva come bozza"
Bottone "Conferma ordine"



Calcolo prezzo prodotto nell'ordine:
Per ogni prodotto:
1. Ottieni prezzo base da listino cliente (o default)
2. Applica sconto riga (se presente)
3. Applica sconto generale cliente (se presente)
4. Calcola totale riga = prezzo_finale × quantità
Stati ordine:
Ciclo vita ordine:

draft (bozza, modificabile)
pending (confermato, in attesa pagamento)
confirmed (confermato e pagato)
processing (in lavorazione/produzione)
ready_to_ship (pronto per spedizione)
shipped (spedito, con tracking)
delivered (consegnato)
cancelled (annullato)
refunded (rimborsato)

Transizioni stato:

Draft → Confirmed: admin conferma
Confirmed → Processing: admin inizia lavorazione
Processing → Ready: produzione completata
Ready → Shipped: spedizione avvenuta (inserisci tracking)
Shipped → Delivered: conferma consegna
Any → Cancelled: annullamento (prima di shipped)

Tracciamento cambio stato:
Tabella order_status_history:

order_id
old_status
new_status
changed_by_user_id
changed_at
notes

Notifiche cambio stato:
Quando stato cambia:

Se ordine da WordPress: invia webhook aggiornamento
Se cliente ha email: invia email automatica (template per stato)
Salva in history

C. GESTIONE GIACENZE IMPEGNATE
Concetto: Quando ordine confermato, prodotti sono "impegnati" ma non ancora scaricati.
Quando confermi ordine:
Per ogni prodotto:

Controlla warehouse_stock.available_quantity
Se sufficiente:

Incrementa reserved_quantity (+quantità ordinata)
Decrementa available_quantity (ricalcolo: quantity - reserved)


Se insufficiente:

Warning: "Giacenza insufficiente"
Opzioni:

Conferma comunque (backorder)
Riduci quantità
Annulla prodotto da ordine





Quando ordine spedito/completato:
Per ogni prodotto:

Decrementa reserved_quantity (-quantità)
Decrementa quantity (-quantità) = scarico effettivo
Ricalcola available_quantity
Crea movimento magazzino tipo "scarico vendita"

Quando ordine annullato:
Per ogni prodotto:

Decrementa reserved_quantity (-quantità)
Incrementa available_quantity (+quantità)
Prodotti tornano disponibili

Visualizzazione giacenze:
In scheda prodotto mostrare:
Giacenza fisica: 100 pz
Impegnata per ordini: 25 pz
Disponibile vendita: 75 pz
D. DOCUMENTI ORDINE
Generazione documenti:
Per ogni ordine, possibilità generare:

Preventivo / Offerta

Prima della conferma
Nessun impegno
Validità (es: 30 giorni)
Bottone "Converti in ordine"


Conferma d'ordine

Dopo conferma ordine
Riepilogo ordine per cliente
Condizioni pagamento e consegna


DDT (Documento Di Trasporto)

Quando merce pronta per spedire
Numero progressivo annuale
Data trasporto
Peso e colli
Causale trasporto
Aspetto esteriore beni
Firma trasportatore


Fattura

Quando ordine completato o su richiesta
Formato XML per fatturazione elettronica
PDF per archivio/stampa



Template PDF:
Layout professionale con:

Logo azienda (configurabile)
Dati azienda (P.IVA, indirizzo, contatti)
Numero documento e data
Dati cliente
Tabella prodotti (descrizione, quantità, prezzo, totale)
Totali con IVA
Condizioni pagamento
Note

Numerazione documenti:
Per ogni tipo documento:

Numerazione progressiva per anno fiscale
Formato: {prefix}/{numero}/{anno} (es: FT/001/2026)
Reset automatico a gennaio
Impossibile eliminare documento emesso (solo annullo)


FASE 6: MODULO PRODUZIONE
A. ORDINI DI PRODUZIONE
Concetto: Documento che dice "produci X unità del prodotto Y".
Tabella production_orders:

order_number (progressivo annuale)
product_id (cosa produrre)
quantity_to_produce (quanti pezzi)
quantity_produced (già prodotti)
status (enum: planned, in_progress, completed, cancelled)
priority (enum: low, normal, high, urgent)
customer_order_id (nullable, se collegato a ordine cliente)
planned_start_date
planned_end_date
actual_start_date
actual_end_date
warehouse_id (dove caricare prodotti finiti)
notes

Creazione ordine produzione:
Metodo 1: Manuale

Admin va in "Produzione → Nuovo ordine"
Seleziona prodotto da produrre
Inserisce quantità
Sistema verifica BOM:

Mostra componenti necessari
Controlla disponibilità
Evidenzia cosa manca


Scegli priorità
Date pianificate
Salva

Metodo 2: Automatico da ordine cliente
Quando confermi ordine cliente:

Per ogni prodotto che ha BOM:

Chiedi "Creare ordine produzione?"
Default: SÌ
Se SÌ: crea production_order automatico
Quantity = quantity ordinata
Priority = calcolata da data consegna
Link customer_order_id



Metodo 3: Produzione stock

Crea ordine per bestseller
Nessun ordine cliente collegato
Quantità basata su forecast

Componenti necessari:
Tabella production_order_components (generata da BOM):

production_order_id
component_product_id
quantity_required
quantity_reserved (quando ordine avviato)
quantity_consumed (quando produzione completa)

All'avvio ordine produzione:
Sistema automaticamente:

Per ogni componente:

Riserva giacenza (incrementa reserved_quantity)
Crea picking list (lista prelievo)


Cambia stato production_order → "in_progress"

Picking list:
Documento stampabile:
LISTA PRELIEVO - Ordine Produzione #OP-025/2026

Prodotto da produrre: Boeing 747 (x5 pz)
Data inizio: 31 Gen 2026

Componenti da prelevare:
☐ Fusoliera ABS (5 pz) - Scaffale A-12
☐ Ali destra/sinistra (10 pz) - Scaffale A-13  
☐ Motori (20 pz) - Scaffale B-05
☐ Carrello (15 pz) - Scaffale B-06
☐ Decal Boeing (5 set) - Scaffale C-01
☐ Scatola (5 pz) - Scaffale D-10

Operatore: ____________
Data prelievo: ____________
Firma: ____________
Completamento produzione:

Admin segna quantità effettivamente prodotta
Sistema:

Scarica componenti (crea movimenti magazzino)
Carica prodotti finiti (crea movimento carico)
Libera giacenze riservate
Aggiorna stato → "completed"


Se linked a ordine cliente:

Aggiorna stato ordine → "ready_to_ship"
Notifica cliente (se configurato)



Calcolo tempi produzione:
Tabella production_phases (opzionale, v2):

production_order_id
phase_name (es: "Taglio", "Assemblaggio", "Verniciatura")
sequence (ordine fasi)
estimated_duration_hours
actual_duration_hours
assigned_to_user_id (operatore)
status (not_started, in_progress, completed)
started_at, completed_at

Permette tracking granulare produzione.
B. PIANIFICAZIONE PRODUZIONE
Piano produzione settimanale:
Vista Gantt o calendario:

Asse X: giorni settimana
Asse Y: ordini produzione pianificati
Barre colorate per stato
Drag & drop per ripianificare

Capacità produttiva:
Tabella production_capacity:

date
available_hours (ore lavoro disponibili)
allocated_hours (ore già allocate)
remaining_hours (calcolato)

Calcolo automatico allocazione:
Per ogni ordine produzione:

Stima ore necessarie (da BOM + tempi fasi)
Alloca ore nel periodo pianificato
Verifica se capacità sufficiente
Se no: suggerisci date alternative

Algoritmo prioritizzazione (per dashboard "Cosa fare oggi"):
Per ogni ordine produzione non completato:

Calcola score priorità:
- Se customer_order urgente (data consegna vicina): +1000
- Se customer_order in ritardo: +2000
- Ogni giorno mancante a data pianificata: +10
- Se priority = urgent: +500
- Se priority = high: +200

Ordina per score DESC
Mostra top 10 in dashboard
Dashboard produzione giornaliera:
📅 PIANO PRODUZIONE OGGI - 31 Gen 2026
Capacità: 8 ore | Allocate: 6.5h | Disponibili: 1.5h

🔴 DA COMPLETARE URGENTE:

1. OP-023/2026 - Boeing 747 (x2)
   Cliente: ModelliPro SRL - Ordine #1234
   ⚠️ In ritardo di 2 giorni
   Tempo stimato: 3h
   Componenti: ✅ Tutti disponibili
   [INIZIA PRODUZIONE]

2. OP-024/2026 - Spitfire (x1)  
   Cliente: ModelliItalia
   Consegna: 3 Feb (tra 3 gg)
   Tempo stimato: 1.5h
   Componenti: ✅ Disponibili
   [INIZIA PRODUZIONE]

🟡 PIANIFICATI OGGI:

3. OP-025/2026 - F-16 (x3)
   Per stock (no ordine cliente)
   Tempo stimato: 2h
   Componenti: ⚠️ Mancano 4 motori
   [ATTENDI COMPONENTI]

💡 SUGGERIMENTO:
Hai 1.5h libere. Produci stock di "P-51 Mustang" 
(bestseller, scorte per solo 5 giorni)
C. TRACKING COSTI PRODUZIONE
Costo di produzione = Componenti + Lavorazione
Componenti:

Sum (costo_componente × quantità_usata) per tutti componenti BOM

Lavorazione (opzionale v2):

Ore operatore × costo orario
Tracked da production_phases

Calcolo costo unitario produzione:
costo_prodotto_finito = (sum_costi_componenti + costi_lavorazione) / quantità_prodotta
Confronto con prezzo vendita:
Margine prodotto = (prezzo_vendita - costo_produzione) / prezzo_vendita × 100
Report marginalità:

Prodotti ordinati per margine
Evidenzia prodotti in perdita (margine < 0)
Suggerimenti: aumenta prezzo o riduci costi


FASE 7: MODULO ACQUISTI E FORNITORI
A. ANAGRAFICA FORNITORI
Tabella suppliers:
Campi base:

company_name
vat_number
tax_code
sdi_code / pec
email, phone
website
address (JSON)

Dati commerciali:

payment_terms (es: 30gg FM, 60gg DF)
min_order_amount (ordine minimo €)
free_shipping_threshold (soglia spedizione gratis €)
lead_time_days (giorni consegna standard)
active (boolean)
notes

Campi calcolati:

total_orders (count ordini)
total_spent (sum totali ordini)
average_order_value
last_order_date
on_time_delivery_rate (% consegne puntuali)

Prodotti forniti:
Tabella supplier_products:

supplier_id
product_id
supplier_sku (codice prodotto del fornitore)
purchase_price (prezzo acquisto)
currency (default EUR)
min_order_quantity
lead_time_days (specifico prodotto, override default)
is_preferred (boolean, fornitore preferito per questo prodotto)
notes

Gestione multi-fornitore:
Stesso prodotto può avere più fornitori:

Marca fornitore preferito (default per ordini)
Confronto prezzi automatico
Alert se fornitore alternativo più conveniente

B. ORDINI A FORNITORE
Tabella purchase_orders:

order_number (progressivo)
supplier_id
order_date
expected_delivery_date
actual_delivery_date
status (enum: draft, sent, confirmed, partially_received, received, cancelled)
total_amount
paid (boolean)
payment_date
notes
created_by_user_id

Righe ordine:
Tabella purchase_order_items:

purchase_order_id
product_id
quantity_ordered
quantity_received
unit_price
discount_percentage
total_line
notes

Creazione ordine fornitore:
Metodo 1: Manuale

Seleziona fornitore
Aggiungi prodotti (autocomplete limitato a prodotti del fornitore)
Quantità e prezzi (pre-compilati da anagrafica supplier_products)
Totali e conferma

Metodo 2: Da suggerimenti magazzino
Dashboard magazzino mostra "DA RIORDINARE":

Click su "RIORDINA X pz"
Se prodotto ha fornitore preferito: pre-seleziona
Pre-compila quantità consigliata
Possibilità aggiungere altri prodotti stesso fornitore

Metodo 3: Ottimizzazione ordini fornitore
Funzione "Raggruppa ordini per fornitore":

Sistema trova tutti prodotti sotto scorta
Raggruppa per fornitore
Per ogni fornitore:

Calcola totale ordine
Confronta con soglia spedizione gratis
Suggerisce prodotti aggiuntivi per raggiungere soglia


Mostra bozze ordini ottimizzate
Admin conferma o modifica

Esempio UI:
🛒 ORDINI SUGGERITI

Fornitore: PlasticSupply SRL
Prodotti sotto scorta:
  - Viti M3 (500 pz × €0.05) = €25
  - Plastica ABS (10 kg × €4.50) = €45
  
Subtotale: €70
Spedizione: €15
Totale: €85

💡 OTTIMIZZA ORDINE:
Aggiungi €30 di prodotti per spedizione gratis (soglia €100)

Suggerimenti prodotti:
  ☐ Colla cianoacrilica (5 pz × €6.50) = €32.50
  ☐ Carta vetrata (10 fogli × €3) = €30
  
[AGGIUNGI SUGGERITI] [CREA ORDINE COSÌ]
Invio ordine:
Quando confermi ordine:

Genera PDF ordine
Opzioni invio:

Email automatica a fornitore
Download PDF per invio manuale


Stato → "sent"
Salva in log

C. RICEZIONE MERCE
Processo ricezione:

Arrivo merce fornitore

Admin va in "Acquisti → Ricevi merce"
Seleziona ordine fornitore in attesa
Mostra lista prodotti ordinati


Verifica e conteggio

Per ogni prodotto:

Quantità ordinata
Input quantità ricevuta effettiva
Se differenza: note


Numero DDT fornitore
Data ricezione


Conferma ricezione

Se tutto corretto: "Conferma ricezione completa"
Se parziale: "Conferma ricezione parziale"
Sistema:

Aggiorna quantity_received in purchase_order_items
Crea movimenti carico magazzino
Aggiorna giacenze prodotti
Se ricezione completa: stato ordine → "received"
Se parziale: stato → "partially_received"




Gestione discrepanze

Se quantità ricevuta < ordinata:

Registra differenza
Opzioni:

Attendi resto merce
Annulla quantità mancante
Crea nuovo ordine per mancante







Aggiornamento costo medio:
Alla ricezione merce:
Per ogni prodotto ricevuto:

nuovo_costo_medio = (
  (giacenza_precedente × costo_medio_precedente) + 
  (quantità_ricevuta × prezzo_acquisto)
) / (giacenza_precedente + quantità_ricevuta)

Aggiorna product.average_cost
Costo medio ponderato per valorizzazione giacenze corretta.
D. ANALISI FORNITORI
Report fornitori:

Affidabilità consegne

% consegne puntuali (entro expected_delivery_date)
Ritardo medio (giorni)
Ordinamento per affidabilità


Confronto prezzi

Stesso prodotto, prezzi fornitori diversi
Evidenzia più conveniente
Considera anche lead time e affidabilità


Spesa per fornitore

Totale speso anno corrente
Trend mensile
Prodotti più acquistati


Performance generale

Score fornitore (combinazione prezzo, qualità, puntualità)
Raccomandazioni ottimizzazione




FASE 8: MODULO FATTURAZIONE
A. FATTURAZIONE ELETTRONICA ITALIA
Processo fatturazione:

Generazione fattura da ordine cliente

Click "Genera fattura" su ordine completato
Pre-compilazione dati da ordine
Possibilità modifiche (prodotti, prezzi, date)


Dati fattura:

Tabella invoices:

invoice_number (progressivo annuale)
invoice_date
customer_id
customer_order_id (riferimento ordine)
type (enum: invoice, credit_note)
status (enum: draft, issued, sent, paid, overdue, cancelled)
subtotal
tax_amount
total_amount
due_date
paid_date
xml_file_path (path file XML generato)
pdf_file_path (path PDF)
sdi_status (enum: not_sent, sent, accepted, rejected)
sdi_sent_date
sdi_response_date
notes

Righe fattura:
Tabella invoice_items:

invoice_id
description
quantity
unit_price
vat_rate
discount_percentage
total_line


Generazione XML fattura elettronica

Formato: conforme a specifiche SdI v1.6.1
Elementi XML essenziali:

CedentePrestatore (dati azienda emittente)
CessionarioCommittente (dati cliente)
DatiGenerali (numero, data, tipo documento)
DatiBeniServizi (righe fattura con aliquote IVA)
DatiPagamento (metodo e scadenza)

Validazione XML:

Schema XSD ufficiale Agenzia Entrate
Controlli formali:

Partita IVA formato corretto
Codice SDI o PEC presente
Totale documento = sum righe + IVA
Aliquote IVA ammesse
Date logiche (emissione <= scadenza)




Invio a SdI

Opzioni implementazione:
Opzione A: Integrazione diretta

Connessione PEC aziendale
Invio XML via PEC a sdi01@pec.fatturapa.it
Gestione ricevute automatiche
Richiede setup PEC server

Opzione B: API terze parti (consigliato MVP)

Aruba Fatturazione API
Fatture in Cloud API
TeamSystem API
Costi: €10-30/mese

Opzione C: Hybrid

Generazione XML locale (FabbricaMi)
Download XML
Utente invia manualmente via portale

Flusso con API (es: Aruba):
1. FabbricaMi genera XML fattura
2. Chiama Aruba API /invoices/send
   POST con XML in payload
3. Aruba:
   - Valida XML
   - Assegna ID univoco
   - Invia a SdI
   - Risponde con receipt
4. FabbricaMi salva sdi_status = "sent"
5. Webhook da Aruba con esito:
   - Accettata: sdi_status = "accepted"
   - Rifiutata: sdi_status = "rejected" + errori
6. Notifica admin se rifiutata
Gestione stati SdI:

not_sent: Fattura creata, XML generato
sent: Inviata a SdI, attesa risposta
accepted: Accettata da SdI e recapitata
rejected: Rifiutata, richiede correzione

Notifiche fattura al cliente:
Quando fattura emessa e accettata:

Email automatica con PDF allegato
Se B2B: anche XML allegato (per importazione loro gestionale)
Link visualizzazione online (portale cliente)

B. DDT (Documento Di Trasporto)
Tabella shipping_documents (DDT):

document_number (progressivo annuale)
document_date
customer_order_id
customer_id
shipping_address_id
transport_reason (enum: vendita, riparazione, c/lavorazione, altro)
appearance (enum: colli, bancali, sfuso)
num_packages
weight_kg
carrier_name
carrier_date (data ritiro merce)
notes
pdf_file_path

Generazione DDT:

Da ordine pronto per spedire
Click "Genera DDT"
Pre-compilazione da ordine:

Dati cliente
Indirizzo spedizione
Prodotti


Aggiungi info trasporto:

Causale
Aspetto esteriore
Numero colli
Peso totale
Corriere
Data trasporto


Genera PDF
Stampa e allega a spedizione

Relazione DDT - Fattura:
DDT può precedere fattura:

Invio merce oggi con DDT
Fatturazione fine mese
Fattura deve riferire DDT (numero e data)

Campo in invoice: ddt_references (JSON array DDT collegati)
C. NOTE DI CREDITO
Quando serve:

Reso merce
Storno fattura errata
Sconto posticipato
Annullo parziale/totale

Processo:

Selezione fattura da stornare

Cerca fattura originale
Click "Crea nota di credito"


Definizione NC:

Tipo: totale o parziale
Se parziale: seleziona righe o quantità
Motivazione
Data emissione NC


Generazione:

XML formato fattura elettronica (tipo "TD04" = nota credito)
Riferimento fattura originale (numero e data)
Importi negativi
Invio SdI come fattura normale


Effetti contabili:

Storna fattura originale (totale o parziale)
Aggiorna totale dovuto cliente
Se reso merce: opzionale ricarico magazzino



Validazioni NC:

Importo NC <= importo fattura originale
Data NC >= data fattura originale
Motivazione obbligatoria
Se reso fisico: documentato

D. SCADENZARIO E INCASSI
Tabella payment_schedules (scadenzario):

invoice_id
due_date
amount_due
paid_amount
remaining_amount
status (enum: pending, paid, overdue, partially_paid)
payment_date
payment_method
payment_reference (es: numero bonifico)
notes

Generazione scadenze:
Quando emetti fattura:

Se pagamento immediato: 1 scadenza = totale fattura, data = oggi
Se pagamento differito (es: 30gg):

Calcola due_date = invoice_date + payment_terms
1 scadenza = totale


Se pagamento rateale (es: 30-60gg):

Crea N scadenze
Split importo
Date scaglionate



Registrazione incasso:

Admin va in "Scadenzario"
Visualizza scadenze pending/overdue
Seleziona scadenza
"Registra pagamento":

Data incasso
Importo (può essere parziale)
Metodo (bonifico, assegno, contanti, etc)
Riferimento (numero operazione)


Sistema:

Aggiorna paid_amount
Ricalcola remaining_amount
Se paid_amount = amount_due: status → "paid"
Aggiorna invoice.status se tutte scadenze pagate



Dashboard scadenzario:
Widget "Incassi":
💰 SITUAZIONE CREDITI

Scaduto (3):
  - Fattura #045/2026 | ModelliPro | €1,250 | Scaduta il 15 Gen
  - Fattura #038/2026 | ArtigianiSRL | €850 | Scaduta il 10 Gen
  - Fattura #042/2026 | CreativiCoop | €450 | Scaduta il 20 Gen
  Totale: €2,550
  [SOLLECITA]

In scadenza questa settimana (2):
  - Fattura #050/2026 | DesignLab | €1,100 | 3 Feb
  - Fattura #052/2026 | StudioX | €750 | 5 Feb
  Totale: €1,850

Incassato gennaio: €15,430
Da incassare gennaio: €4,400
Alert automatici:

Scadenza prossima (7 giorni prima): email promemoria cliente
Scadenza superata (1 giorno dopo): flag overdue
Scadenza superata (7 giorni): email sollecito automatico
Scadenza superata (30 giorni): alert admin per azioni legali


FASE 9: DASHBOARD E INTELLIGENZA
A. DASHBOARD PRINCIPALE "COSA FARE OGGI"
Layout dashboard homepage:
Sezione 1: Saluto e KPI giornalieri
🌅 Buongiorno Drilon - Lunedì 31 Gennaio 2026

Oggi:
📦 3 ordini da evadere
🏭 2 ordini produzione urgenti  
💰 1 fattura da emettere
⚠️ 2 prodotti sotto scorta
Sezione 2: Task urgenti (rosso)
Widget espandibile "URGENZE (5)":

Ordini in ritardo
Prodotti esauriti
Fatture scadute non pagate
Ordini produzione bloccati

Ogni item con:

Icona tipo
Descrizione breve
CTA principale ("EVADI", "RIORDINA", "SOLLECITA")
Link dettaglio

Sezione 3: Piano giorno (giallo)
Widget "PIANO OGGI":

Ordini da processare (normali, non urgenti)
Produzione pianificata
Fatture da emettere
Ordini fornitore da confermare

Sezione 4: Suggerimenti proattivi (blu)
Widget "💡 SUGGERIMENTI":
Generati da motore intelligenza:

"Bestseller X sta finendo, produci 10 unità stock"
"Raggruppa ordini PlasticSupply per spedizione gratis"
"Prodotto Y ha margine basso (12%), rivedi pricing"
"Trend vendite Dicembre +45%, prepara stock Natale in anticipo"

Sezione 5: Quick stats
Mini widget overview:

Fatturato mese (vs obiettivo)
Ordini mese (numero e €)
Margine medio mese
Valore giacenza magazzino

Personalizzazione dashboard:

Configurazione widget mostrati
Ordine sezioni (drag & drop)
Filtri temporali (oggi, settimana, mese)
Preferenze notifiche

B. MOTORE SUGGERIMENTI INTELLIGENTI
Architettura motore:
Cron job notturno (3 AM):

Analizza dati ultimo periodo
Esegue algoritmi detection
Genera suggestions
Salva in tabella suggestions
Aggiorna dashboard

Tabella suggestions:

type (enum: reorder, pricing, production, optimization, trend)
priority (enum: low, medium, high, critical)
title (breve descrizione)
description (dettaglio)
action (cosa fare)
action_link (URL diretta azione)
impact (stima beneficio)
generated_at
dismissed_at (se utente scarta)
actioned_at (se utente esegue)
metadata (JSON extra dati)

Algoritmo 1: Riordini intelligenti
Per ogni prodotto:
  
  vendite_medie = calcola_media_mobile_30gg()
  giorni_scorte = giacenza / vendite_medie
  
  se giorni_scorte <= lead_time_fornitore + margine_sicurezza:
    genera_suggestion(
      type: "reorder",
      priority: calcola_urgenza(giorni_scorte),
      title: "Riordina {prodotto} entro {data}",
      description: "Scorte sufficienti per {giorni} giorni. Lead time fornitore {lead_time}gg.",
      action: "Ordina {quantità} pz",
      action_link: "/acquisti/nuovo?product_id={id}&qty={quantità}",
      impact: "Evita rottura stock -€{valore_vendite_perse}"
    )
Algoritmo 2: Ottimizzazione ordini fornitore
prodotti_da_riordinare = find_prodotti_sotto_scorta()

raggruppa per fornitore:
  
  per ogni fornitore:
    totale_ordine = sum(prodotti × prezzi)
    soglia_gratis = fornitore.free_shipping_threshold
    
    se totale_ordine < soglia_gratis:
      differenza = soglia_gratis - totale_ordine
      
      candidati = trova_prodotti_vicini_a_scorta_minima(fornitore)
      
      per ogni candidato:
        se candidato.prezzo_acquisto × quantità ≈ differenza:
          
          genera_suggestion(
            type: "optimization",
            priority: "medium",
            title: "Risparmia €15 spedizione con {fornitore}",
            description: "Aggiungi {candidato} per raggiungere soglia spedizione gratis",
            action: "Aggiungi a ordine",
            impact: "+€15 risparmiato"
          )
Algoritmo 3: Analisi marginalità
per ogni prodotto:
  
  margine = (prezzo_vendita - costo_medio) / prezzo_vendita × 100
  margine_medio_categoria = get_average_margin(categoria)
  
  se margine < 15%:
    genera_suggestion(
      type: "pricing",
      priority: "medium",
      title: "Prodotto {nome} ha margine basso ({margine}%)",
      description: "Margine attuale {margine}% vs media categoria {margine_medio}%",
      action: "Rivedi prezzo o costi",
      suggestions: [
        "Aumenta prezzo a €{prezzo_suggerito} per margine 25%",
        "Trova fornitore alternativo (attuale €{costo})",
        "Produci in batch per ridurre costi lavorazione"
      ]
    )
Algoritmo 4: Trend detection
per ogni prodotto:
  
  vendite_ultimo_mese = sum_vendite(30)
  vendite_mese_precedente = sum_vendite(30, offset=30)
  
  variazione = (ultimo - precedente) / precedente × 100
  
  se variazione > 30%:
    genera_suggestion(
      type: "trend",
      priority: "high",
      title: "Vendite {prodotto} +{variazione}% ultimo mese",
      description: "Trend positivo marcato. Vendite: {precedente} → {ultimo} pz/mese",
      action: "Aumenta scorte preventivamente",
      suggestions: [
        "Incrementa scorta minima da {old} a {new}",
        "Pianifica produzione stock {quantità} unità",
        "Verifica capacità fornitore gestire aumento domanda"
      ]
    )
    
  se variazione < -30%:
    genera_suggestion(
      type: "trend",
      priority: "medium",
      title: "Vendite {prodotto} {variazione}% ultimo mese",
      description: "Calo marcato vendite. Possibile problema.",
      action: "Analizza cause",
      suggestions: [
        "Verifica disponibilità online (potrebbe essere marcato esaurito)",
        "Controlla prezzi competitor",
        "Ridimensiona scorte per evitare invenduto",
        "Considera promozione per smaltire stock"
      ]
    )
Algoritmo 5: Stagionalità
se dati >= 12 mesi:
  
  per ogni prodotto:
    
    vendite_per_mese = aggregate_by_month(24_mesi)
    
    identifica_pattern_stagionale:
      mese_picco = max(vendite_per_mese)
      mese_basso = min(vendite_per_mese)
      
      se mese_picco / mese_basso > 2:
        # Prodotto stagionale
        
        mese_corrente = oggi.mese
        mesi_a_picco = mese_picco - mese_corrente
        
        se mesi_a_picco == 2:
          genera_suggestion(
            type: "production",
            priority: "high",
            title: "Prepara stock per stagione {prodotto}",
            description: "Picco vendite storiche a {mese_picco}. Tra 2 mesi.",
            action: "Produci {quantità} unità ora",
            impact: "Evita rotture stock in alta stagione"
          )
Algoritmo 6: Batch production
ordini_produzione_pending = get_production_orders(status: "planned")

raggruppa per prodotto:
  
  per ogni gruppo:
    se gruppo.count >= 3:
      
      totale_quantità = sum(gruppo.quantity)
      
      risparmio_batch = calcola_risparmio_setup(totale_quantità)
      
      genera_suggestion(
        type: "production",
        priority: "medium",
        title: "Produci {prodotto} in batch",
        description: "{count} ordini per totale {totale_quantità} pz",
        action: "Unifica in 1 ordine produzione",
        impact: "Risparmio {risparmio_batch}% tempo setup"
      )
C. NOTIFICHE E ALERT
Sistema notifiche:
Tabella notifications:

user_id
type (enum: info, warning, error, success)
category (enum: order, stock, invoice, production, system)
title
message
action_url (link azione)
read_at (nullable)
created_at

Canali notifica:

In-app (UI):

Badge numero notifiche non lette
Dropdown menu notifiche
Toast popup per notifiche critiche


Email:

Configurabile per utente
Raggruppamento giornaliero digest
Immediata per alert critici


Webhook (opzionale v2):

Integrazione Slack/Teams
SMS per urgenze (via Twilio)



Trigger notifiche automatiche:
Magazzino:

Prodotto sotto scorta minima → warning
Prodotto esaurito → error
Punto riordino raggiunto → info

Ordini:

Nuovo ordine WordPress → info
Ordine in ritardo → warning
Ordine annullato → info

Produzione:

Ordine produzione bloccato (mancano componenti) → warning
Ordine produzione completato → success

Fatturazione:

Fattura rifiutata SdI → error
Fattura accettata → success
Scadenza pagamento imminente (7 gg) → info
Pagamento scaduto → warning

Fornitori:

Merce ricevuta → info
Discrepanza ricezione → warning

Sistema:

Errore sync WordPress → error
Backup completato → success

Preferenze notifiche utente:
Configurazione granulare:
Per ogni categoria (ordini, magazzino, etc):
  - Ricevi in app: ON/OFF
  - Ricevi via email: ON/OFF
  - Solo urgenti: ON/OFF
  - Digest giornaliero: ON/OFF

FASE 10: REPORTISTICA E ANALYTICS
A. REPORT VENDITE
Report base:

Vendite per periodo

Filtri: data inizio/fine, cliente, prodotto, categoria
Metriche:

Numero ordini
Totale fatturato
Scontrino medio
Margine medio


Grafico trend temporale (giornaliero/settimanale/mensile)
Export CSV/Excel


Top prodotti

Ordinamento per: quantità vendute, fatturato, margine
Tabella con: prodotto, quantità, fatturato, margine %, margine €
Top 10/20/50 configurabile
Grafico a barre


Analisi clienti

Segmentazione: B2C vs B2B
Top clienti per fatturato
Frequenza acquisto
Customer Lifetime Value
Clienti inattivi (nessun ordine ultimi 90gg)


Performance categorie

Fatturato per categoria
Marginalità per categoria
Trend crescita
% contribuzione al totale



Report avanzati:

Cohort analysis

Clienti raggruppati per mese prima acquisizione
Tasso retention mese per mese
LTV per cohort


Analisi ABC prodotti

Classificazione prodotti:

A: top 20% per fatturato (80% revenue)
B: middle 30%
C: bottom 50% (20% revenue)


Strategie gestione differenziate


Forecast vendite

Proiezione vendite prossimi 3/6/12 mesi
Basato su: trend storico + stagionalità
Visualizzazione con range confidenza



B. REPORT MAGAZZINO
Report base:

Situazione giacenze

Valore totale giacenza
Prodotti in stock / sotto scorta / esauriti
Tabella prodotti con: nome, giacenza, valore, rotazione
Filtri categoria, fornitore


Movimenti magazzino

Storico movimenti periodo
Filtri: tipo movimento, prodotto, magazzino
Totali carichi/scarichi
Dettaglio per documento (ordine, produzione, etc)


Rotazione stock

Indice rotazione per prodotto: vendite_annue / giacenza_media
Giorni giacenza media
Prodotti slow-moving (rotazione bassa)
Prodotti fast-moving (alta rotazione)



Report avanzati:

Dead stock

Prodotti senza movimenti ultimi 90/180/365 giorni
Valore immobilizzato
Suggerimenti azione (promozione, dismissione)


Stockout analysis

Frequenza rotture stock per prodotto
Vendite perse stimate
Impact fatturato


Valore giacenza trend

Andamento valore giacenza nel tempo
Ottimizzazione capitale circolante



C. REPORT PRODUZIONE
Report base:

Efficienza produzione

Ordini completati vs pianificati
Tempo medio produzione per prodotto
Differenze tempo stimato vs effettivo
Tasso completamento nei tempi


Analisi ritardi

Ordini produzione in ritardo
Cause principali (mancanza componenti, capacità)
Impact su ordini clienti


Utilizzo capacità

Ore produttive disponibili vs allocate
Tasso saturazione capacità
Colli di bottiglia



Report avanzati:

Costi produzione

Costo medio produzione per prodotto
Breakdown: materiali vs lavorazione
Trend costi nel tempo
Varianze costo standard vs effettivo


Resa produttiva

Scarti e difetti
% resa (prodotti OK / totale prodotti)
Costo degli scarti



D. REPORT FINANZIARI
Report base:

Situazione crediti

Totale crediti vs clienti
Scaduto vs da scadere
Aging: 0-30gg, 30-60gg, 60-90gg, >90gg
Dettaglio per cliente


Fatturato vs incassato

Confronto fatturato emesso vs pagamenti ricevuti
Gap cashflow
DSO (Days Sales Outstanding)


Marginalità

Margine lordo totale
Margine per prodotto/categoria/cliente
Trend marginalità



Report avanzati:

Forecast cashflow

Proiezione entrate (scadenze fatture)
Proiezione uscite (scadenze fornitori)
Saldo previsto prossimi 30/60/90 giorni


Profitability analysis

P&L semplificato
Ricavi


Costo del venduto


= Margine lordo


Spese operative (stimate)


= Profitto netto stimato



E. EXPORT E AUTOMAZIONE
Formati export:

CSV (standard)
Excel (.xlsx) con formattazione
PDF (per report presentazione)

Report schedulati:
Configurazione report automatici:

Frequenza: giornaliera, settimanale, mensile
Destinatari email
Filtri e parametri predefiniti
Formato output

Esempio:
Report "Vendite settimanali"
Frequenza: Ogni Lunedì 9:00
Filtri: Data ultima settimana
Destinatari: admin@azienda.it, sales@azienda.it
Formato: Excel
Dashboard condivise:

Creazione dashboard custom
Sharing URL pubblico (con autenticazione opzionale)
Embedding iframe (per intranet aziendale)
White-label branding


FASE 11: CONFIGURAZIONE E SETUP
A. SETUP INIZIALE AZIENDA
Wizard primo accesso:
Step 1: Dati azienda

Ragione sociale
Partita IVA
Codice Fiscale
Indirizzo sede legale
Telefono, email, sito web
Logo (upload)

Step 2: Dati fatturazione

Regime fiscale (ordinario, forfettario, etc)
Codice SDI (se fatturazione elettronica)
PEC aziendale
Banca (per coordinate IBAN su fatture)
Termini pagamento default
Numerazione fatture (prefisso, prossimo numero)

Step 3: Connessione WordPress

URL sito WordPress
Verifica WooCommerce installato
Installazione guidata plugin FabbricaMi
Generazione API key
Test connessione

Step 4: Configurazione magazzino

Nome magazzino principale
Indirizzo fisico
Unità misura predefinite

Step 5: Invito collaboratori

Aggiungi email colleghi
Assegna ruoli
Invio inviti

Step 6: Tour guidato

Tutorial interattivo UI
Video dimostrativi
Link documentazione

B. IMPOSTAZIONI SISTEMA
Impostazioni generali:

Nome azienda (modificabile)
Logo (modificabile)
Formato data (DD/MM/YYYY vs MM/DD/YYYY)
Timezone
Lingua interfaccia
Valuta principale

Impostazioni vendite:

Numerazione ordini (formato, prefisso)
Stati ordine custom (oltre ai default)
Email template notifiche ordini
Termini e condizioni vendita (testo)
Note standard su documenti

Impostazioni magazzino:

Metodo valorizzazione (FIFO, LIFO, costo medio)
Scorte negative permesse (SI/NO)
Magazzini attivi
Alert scorta minima (% vs valore assoluto)
Frequenza calcolo disponibilità

Impostazioni produzione:

Ore lavorative giornaliere
Giorni lavorativi settimana
Costo orario medio lavorazione (se tracked)
Lead time produzione default

Impostazioni fatturazione:

Template fattura (layout PDF)
Numerazione fatture (formato, reset annuale)
Ritenuta d'acconto default
Causale pagamento default
Email template fatture clienti

Impostazioni WordPress:

URL API
API key
Frequenza sync prodotti (real-time, 5min, 1h)
Categorie da sincronizzare
Webhook configurati
Log level (none, errors, all)

Impostazioni notifiche:

Email server (SMTP configuration)
Email mittente default
Template email
Webhook URL (Slack, Teams, custom)

C. GESTIONE UTENTI E PERMESSI
Ruoli predefiniti:

Owner

Accesso completo
Gestione utenti
Configurazione sistema
Modifica impostazioni fatturazione
Non eliminabile (almeno 1 owner)


Admin

Accesso completo moduli operativi
Creazione ordini, fatture, produzione
Gestione magazzino
Report completi
NO modifica impostazioni sistema


Manager

Visualizzazione tutti i moduli
Creazione ordini e preventivi
Gestione magazzino (con limiti)
Report standard
NO fatturazione


Operatore

Gestione ordini produzione assegnati
Carico/scarico magazzino
Visualizzazione ordini
NO creazione ordini
NO report finanziari


Viewer

Solo visualizzazione
Report base
NO modifiche



Permessi granulari:
Per utente, possibilità override permessi specifici:
Modulo Ordini:
  ☑ Visualizza
  ☐ Crea
  ☐ Modifica
  ☐ Elimina
  ☐ Annulla ordini confermati

Modulo Magazzino:
  ☑ Visualizza giacenze
  ☑ Carico merce
  ☐ Scarico merce
  ☐ Rettifica inventario

Modulo Produzione:
  ☑ Visualizza ordini produzione
  ☑ Avvia produzione
  ☑ Completa produzione
  ☐ Crea ordini produzione
Audit log:
Tabella audit_logs:

user_id
action (enum: create, update, delete, view)
entity_type (enum: order, product, invoice, etc)
entity_id
old_values (JSON, per update/delete)
new_values (JSON, per create/update)
ip_address
user_agent
timestamp

Log immutabile di tutte le azioni sensibili.
Report audit:

Filtro per utente, azione, entità, periodo
Visualizzazione dettaglio modifiche (diff)
Export per compliance


FASE 12: ORDINE DI IMPLEMENTAZIONE
PRIORITÀ SVILUPPO (Ordine esatto per evitare bug):
Sprint 1 (Settimane 1-2): Fondamenta

Setup architettura generale (database, API server, auth)
Multi-tenancy e isolamento dati
Sistema autenticazione (registro, login, JWT)
UI base (layout, router, componenti comuni)
Gestione utenti e permessi

Sprint 2 (Settimane 3-4): Plugin WordPress Core

Plugin skeleton con settings page
Connessione API FabbricaMi (test connection)
Sincronizzazione prodotti FabbricaMi → WordPress (unidirezionale)
Webhook ordini WordPress → FabbricaMi
Logging e debug tools

Sprint 3 (Settimane 5-6): Modulo Prodotti

CRUD prodotti base (senza BOM)
Gestione categorie e tag
Upload immagini e gallery
Varianti prodotto
Listini prezzi base

Sprint 4 (Settimane 7-8): Modulo Magazzino Base

Giacenze prodotti (singolo magazzino)
Movimenti carico/scarico manuali
Visualizzazione stock
Giacenze impegnate (reserved)
Alert scorte minime (semplice)

Sprint 5 (Settimane 9-10): Modulo Ordini Clienti

Anagrafica clienti
Creazione ordine manuale
Stati ordine e workflow
Import ordini da WordPress
Gestione indirizzi spedizione

Sprint 6 (Settimane 11-12): Integrazione Magazzino-Ordini

Scarico automatico prodotti da ordini
Check disponibilità in creazione ordine
Gestione backorder
Sync giacenze WordPress ↔ FabbricaMi
Movimenti magazzino tracciati per ordini

Sprint 7 (Settimane 13-14): Distinta Base e Produzione

BOM semplice (1 livello)
Calcolo "quantità producibile"
Ordini di produzione base
Scarico componenti + carico prodotto finito
Stati ordini produzione

Sprint 8 (Settimane 15-16): Fatturazione Elettronica

Generazione XML fattura (formato SDI)
Validazione XML con schema XSD
Integrazione API Aruba/Fatture in Cloud (scelta)
Invio a SdI e gestione stati
Generazione PDF fattura

Sprint 9 (Settimane 17-18): Fornitori e Acquisti

Anagrafica fornitori
Listino prodotti per fornitore
Ordini a fornitore
Ricezione merce e carico magazzino
Aggiornamento costo medio

Sprint 10 (Settimane 19-20): Dashboard Intelligente

Dashboard principale layout
Widget task urgenti
Piano giornata
Calcoli forecasting base (scorte, riordini)
Sistema suggestions (motore base)

Sprint 11 (Settimane 21-22): Ottimizzazioni e Intelligenza

Algoritmi suggerimenti avanzati
Analisi trend vendite
Ottimizzazione ordini fornitore
Batch production suggestions
Sistema notifiche in-app

Sprint 12 (Settimane 23-24): Reportistica

Report vendite base
Report magazzino
Scadenzario e situazione crediti
Export CSV/Excel
Grafici e visualizzazioni

Sprint 13 (Settimane 25-26): Polishing e Testing

UI/UX refinement
Mobile responsive
Performance optimization
Bug fixing
Testing end-to-end

Sprint 14 (Settimane 27-28): Onboarding e Documentazione

Wizard setup iniziale
Tutorial interattivi
Help tooltips
Documentazione utente
Video guide

Sprint 15 (Settimane 29-30): Beta e Deploy

Deploy ambiente staging
Beta testing con 3-5 utenti reali
Raccolta feedback
Fix critici
Deploy produzione

Totale: ~7-8 mesi per MVP completo