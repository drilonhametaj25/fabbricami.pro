=== PegasoWorld ERP Connector ===
Contributors: pegasoworld
Tags: woocommerce, erp, inventory, sync, orders
Requires at least: 5.8
Tested up to: 6.4
Stable tag: 1.0.0
Requires PHP: 7.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Connettore bidirezionale tra WooCommerce e PegasoWorld ERP per sincronizzazione prodotti, ordini, clienti e inventario.

== Description ==

PegasoWorld ERP Connector permette di sincronizzare automaticamente:

* **Ordini**: Invio automatico dei nuovi ordini all'ERP
* **Clienti**: Sincronizzazione dei clienti B2C
* **Prodotti**: Ricezione prodotti dall'ERP (semplici, variabili, digitali)
* **Inventario**: Aggiornamento stock in tempo reale

= Caratteristiche =

* Sincronizzazione bidirezionale
* Supporto prodotti variabili con attributi dinamici
* Supporto prodotti digitali/scaricabili
* Autenticazione Basic Auth sicura
* Log dettagliato delle sincronizzazioni
* Pannello admin intuitivo
* Toggle on/off per ogni tipo di sync

= Requisiti =

* WordPress 5.8 o superiore
* WooCommerce 5.0 o superiore
* PHP 7.4 o superiore
* PegasoWorld ERP configurato

== Installation ==

1. Carica la cartella `pegasoworld-erp-connector` nella directory `/wp-content/plugins/`
2. Attiva il plugin dal menu 'Plugin' in WordPress
3. Vai su 'PegasoWorld ERP' nel menu admin
4. Configura URL e credenziali dell'ERP
5. Abilita la sincronizzazione

== Frequently Asked Questions ==

= Come configuro le credenziali? =

Le credenziali vengono generate dall'ERP PegasoWorld. Vai nelle impostazioni WordPress dell'ERP per creare un nuovo set di credenziali.

= Posso disabilitare singoli tipi di sync? =

Si, dalla pagina impostazioni puoi abilitare/disabilitare indipendentemente: ordini, clienti e stock.

= Come funziona la gestione dello stock? =

Lo stock viene gestito dall'ERP come sorgente principale. Gli aggiornamenti vengono inviati automaticamente a WooCommerce quando cambia lo stock nell'ERP.

== Changelog ==

= 1.0.0 =
* Versione iniziale
* Sync ordini WooCommerce -> ERP
* Sync clienti WooCommerce -> ERP
* Ricezione prodotti ERP -> WooCommerce
* Aggiornamento stock ERP -> WooCommerce
* Pannello admin con statistiche e log

== Upgrade Notice ==

= 1.0.0 =
Versione iniziale del plugin.
