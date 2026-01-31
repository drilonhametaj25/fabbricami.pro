<template>
  <div class="wordpress-settings">
    <PageHeader
      title="WordPress / WooCommerce"
      subtitle="Gestisci la sincronizzazione con il tuo sito e-commerce"
      icon="pi pi-globe"
    />

    <div class="settings-content">
      <!-- Configurazione WooCommerce -->
      <section class="config-section">
        <div class="section-header">
          <h3 class="section-title">
            <i class="pi pi-cog"></i>
            Configurazione WooCommerce
          </h3>
          <Tag
            :value="wooConfig.isConfigured ? 'Configurato' : 'Non configurato'"
            :severity="wooConfig.isConfigured ? 'success' : 'warning'"
          />
        </div>

        <div class="config-form">
          <div class="config-row">
            <div class="field">
              <label for="wooUrl">URL Sito WordPress *</label>
              <InputText
                id="wooUrl"
                v-model="wooConfig.url"
                placeholder="https://tuosito.com"
                class="w-full"
              />
              <small class="field-hint">L'URL del tuo sito WordPress con WooCommerce installato</small>
            </div>
          </div>

          <div class="config-row two-cols">
            <div class="field">
              <label for="consumerKey">Consumer Key *</label>
              <InputText
                id="consumerKey"
                v-model="wooConfig.consumerKey"
                :placeholder="wooConfig.hasExistingKeys ? 'Chiave gia configurata - inserisci per modificare' : 'ck_xxxxxxxxxxxxxxxx'"
                class="w-full"
              />
              <small v-if="wooConfig.hasExistingKeys && !wooConfig.consumerKey" class="field-hint success">
                <i class="pi pi-check-circle"></i> Chiave salvata nel sistema
              </small>
            </div>
            <div class="field">
              <label for="consumerSecret">Consumer Secret *</label>
              <Password
                id="consumerSecret"
                v-model="wooConfig.consumerSecret"
                :feedback="false"
                toggleMask
                :placeholder="wooConfig.hasExistingKeys ? 'Secret gia configurato - inserisci per modificare' : 'cs_xxxxxxxxxxxxxxxx'"
                class="w-full"
              />
              <small v-if="wooConfig.hasExistingKeys && !wooConfig.consumerSecret" class="field-hint success">
                <i class="pi pi-check-circle"></i> Secret salvato nel sistema
              </small>
            </div>
          </div>

          <div class="help-box">
            <i class="pi pi-info-circle"></i>
            <div>
              <strong>Come ottenere le credenziali:</strong>
              <ol>
                <li>Vai su WooCommerce → Impostazioni → Avanzate → REST API</li>
                <li>Clicca "Aggiungi chiave"</li>
                <li>Scegli un utente con permessi amministratore</li>
                <li>Imposta "Permessi" su "Lettura/Scrittura"</li>
                <li>Copia Consumer Key e Consumer Secret qui</li>
              </ol>
            </div>
          </div>

          <div class="config-actions">
            <Button
              label="Testa Connessione"
              icon="pi pi-wifi"
              class="p-button-outlined"
              :loading="testingConnection"
              @click="testConnection"
            />
            <Button
              label="Salva Configurazione"
              icon="pi pi-save"
              :loading="savingConfig"
              :disabled="!wooConfig.url || (!wooConfig.consumerKey && !wooConfig.hasExistingKeys)"
              @click="saveConfiguration"
            />
          </div>

          <div v-if="connectionTestResult" class="test-result" :class="connectionTestResult.success ? 'success' : 'error'">
            <i :class="connectionTestResult.success ? 'pi pi-check-circle' : 'pi pi-times-circle'"></i>
            <div>
              <strong>{{ connectionTestResult.message }}</strong>
              <div v-if="connectionTestResult.details" class="test-details">
                <span v-if="connectionTestResult.details.woocommerceVersion">WooCommerce: {{ connectionTestResult.details.woocommerceVersion }}</span>
                <span v-if="connectionTestResult.details.wordpressVersion">WordPress: {{ connectionTestResult.details.wordpressVersion }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Status Cards -->
      <section class="status-section">
        <div class="status-grid">
          <!-- Connection Status -->
          <div class="status-card" :class="{ connected: syncStatus?.connected }">
            <div class="status-icon">
              <i :class="syncStatus?.connected ? 'pi pi-check-circle' : 'pi pi-times-circle'"></i>
            </div>
            <div class="status-info">
              <h4>Connessione</h4>
              <span class="status-value">{{ syncStatus?.connected ? 'Connesso' : 'Non connesso' }}</span>
            </div>
          </div>

          <!-- Prodotti Sincronizzati -->
          <div class="status-card stat">
            <div class="status-icon blue">
              <i class="pi pi-box"></i>
            </div>
            <div class="status-info">
              <h4>Prodotti Sync</h4>
              <span class="status-value">{{ syncStatus?.stats?.syncedProducts || 0 }}</span>
            </div>
          </div>

          <!-- Prodotti Web Attivi -->
          <div class="status-card stat">
            <div class="status-icon green">
              <i class="pi pi-check"></i>
            </div>
            <div class="status-info">
              <h4>Web Attivi</h4>
              <span class="status-value">{{ syncStatus?.stats?.webActiveProducts || 0 }}</span>
            </div>
          </div>

          <!-- Errori -->
          <div class="status-card stat" :class="{ error: (syncStatus?.stats?.syncErrors || 0) > 0 }">
            <div class="status-icon" :class="{ red: (syncStatus?.stats?.syncErrors || 0) > 0 }">
              <i class="pi pi-exclamation-triangle"></i>
            </div>
            <div class="status-info">
              <h4>Errori</h4>
              <span class="status-value">{{ syncStatus?.stats?.syncErrors || 0 }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Actions Section -->
      <section class="actions-section">
        <h3 class="section-title">Sincronizzazione</h3>
        <div class="actions-grid">
          <div class="action-card">
            <div class="action-icon">
              <i class="pi pi-sync"></i>
            </div>
            <div class="action-content">
              <h4>Sync Prodotti Web</h4>
              <p>Sincronizza tutti i prodotti con webActive=true verso WooCommerce</p>
            </div>
            <Button
              label="Avvia Sync"
              icon="pi pi-play"
              :loading="syncing.webProducts"
              @click="syncWebProducts"
            />
          </div>

          <div class="action-card">
            <div class="action-icon">
              <i class="pi pi-database"></i>
            </div>
            <div class="action-content">
              <h4>Sync Giacenze</h4>
              <p>Aggiorna le quantita stock su WooCommerce</p>
            </div>
            <Button
              label="Avvia Sync"
              icon="pi pi-play"
              :loading="syncing.inventory"
              @click="syncInventory"
            />
          </div>

          <div class="action-card highlight">
            <div class="action-icon wizard">
              <i class="pi pi-bolt"></i>
            </div>
            <div class="action-content">
              <h4>Import/Export Wizard</h4>
              <p>Setup iniziale: importa da WooCommerce o esporta verso WooCommerce</p>
            </div>
            <Button
              label="Apri Wizard"
              icon="pi pi-external-link"
              class="p-button-success"
              @click="openBulkWizard"
            />
          </div>
        </div>

        <div v-if="lastSyncResult" class="sync-result" :class="lastSyncResult.type">
          <i :class="lastSyncResult.type === 'success' ? 'pi pi-check' : 'pi pi-times'"></i>
          <span>{{ lastSyncResult.message }}</span>
        </div>
      </section>

      <!-- Import Step-by-Step Section -->
      <section class="step-import-section">
        <div class="section-header">
          <h3 class="section-title">
            <i class="pi pi-download"></i>
            Import Step-by-Step da WooCommerce
          </h3>
          <Tag value="Consigliato per grandi quantità" severity="info" />
        </div>

        <p class="section-description">
          Importa i dati separatamente per evitare timeout. Segui l'ordine consigliato:
          prima le categorie, poi i prodotti, clienti e infine gli ordini.
        </p>

        <div class="step-import-grid">
          <!-- Step 1: Categorie -->
          <div class="step-import-card" :class="{ completed: stepImport.categories.completed, running: stepImport.categories.running }">
            <div class="step-number">1</div>
            <div class="step-content">
              <h4><i class="pi pi-folder"></i> Categorie Prodotti</h4>
              <p>Importa tutte le categorie con gerarchia</p>
              <div v-if="stepImport.categories.result" class="step-result">
                <span class="success">{{ stepImport.categories.result.imported }} importate</span>
                <span>{{ stepImport.categories.result.updated }} aggiornate</span>
                <span v-if="stepImport.categories.result.errors" class="error">{{ stepImport.categories.result.errors }} errori</span>
              </div>
            </div>
            <Button
              :label="stepImport.categories.running ? 'Importazione...' : 'Importa Categorie'"
              icon="pi pi-cloud-download"
              :loading="stepImport.categories.running"
              :disabled="stepImport.categories.running"
              @click="importStepCategories"
            />
          </div>

          <!-- Step 2: Classi Spedizione -->
          <div class="step-import-card" :class="{ completed: stepImport.shippingClasses.completed, running: stepImport.shippingClasses.running }">
            <div class="step-number">2</div>
            <div class="step-content">
              <h4><i class="pi pi-truck"></i> Classi Spedizione</h4>
              <p>Importa le classi di spedizione</p>
              <div v-if="stepImport.shippingClasses.result" class="step-result">
                <span class="success">{{ stepImport.shippingClasses.result.imported }} importate</span>
                <span>{{ stepImport.shippingClasses.result.updated }} aggiornate</span>
              </div>
            </div>
            <Button
              :label="stepImport.shippingClasses.running ? 'Importazione...' : 'Importa Classi'"
              icon="pi pi-cloud-download"
              :loading="stepImport.shippingClasses.running"
              :disabled="stepImport.shippingClasses.running"
              @click="importStepShippingClasses"
            />
          </div>

          <!-- Step 3: Prodotti -->
          <div class="step-import-card" :class="{ completed: stepImport.products.completed, running: stepImport.products.running }">
            <div class="step-number">3</div>
            <div class="step-content">
              <h4><i class="pi pi-box"></i> Prodotti</h4>
              <p>Importa prodotti con immagini e varianti</p>
              <div class="step-options">
                <Dropdown
                  v-model="stepImport.products.status"
                  :options="productStatusOptions"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Stato prodotti"
                  class="w-full"
                />
              </div>
              <div v-if="stepImport.products.result" class="step-result">
                <span class="success">{{ stepImport.products.result.imported }} importati</span>
                <span>{{ stepImport.products.result.updated }} aggiornati</span>
                <span v-if="stepImport.products.result.errors" class="error">{{ stepImport.products.result.errors }} errori</span>
              </div>
            </div>
            <Button
              :label="stepImport.products.running ? 'Importazione...' : 'Importa Prodotti'"
              icon="pi pi-cloud-download"
              :loading="stepImport.products.running"
              :disabled="stepImport.products.running"
              @click="importStepProducts"
            />
          </div>

          <!-- Step 4: Clienti -->
          <div class="step-import-card" :class="{ completed: stepImport.customers.completed, running: stepImport.customers.running }">
            <div class="step-number">4</div>
            <div class="step-content">
              <h4><i class="pi pi-users"></i> Clienti</h4>
              <p>Importa tutti i clienti registrati (in background)</p>
              <div v-if="stepImport.customers.result" class="step-result">
                <span class="success">{{ stepImport.customers.result.imported }} importati</span>
                <span>{{ stepImport.customers.result.updated }} aggiornati</span>
                <span v-if="stepImport.customers.result.errors" class="error">{{ stepImport.customers.result.errors }} errori</span>
              </div>
            </div>
            <Button
              :label="stepImport.customers.running ? 'In corso...' : 'Importa Clienti'"
              icon="pi pi-cloud-download"
              :loading="stepImport.customers.running"
              :disabled="stepImport.customers.running"
              @click="importStepCustomers"
            />
          </div>

          <!-- Progress bar importazione clienti -->
          <WordPressImportProgress
            v-model:visible="customerImportJob.visible"
            :jobId="customerImportJob.jobId"
            @completed="onCustomerImportCompleted"
            @cancelled="onCustomerImportCancelled"
          />

          <!-- Storico importazioni -->
          <ImportJobHistory
            ref="importJobHistoryRef"
            @resume="onJobResumed"
          />

          <!-- Step 5: Ordini -->
          <div class="step-import-card" :class="{ completed: stepImport.orders.completed, running: stepImport.orders.running }">
            <div class="step-number">5</div>
            <div class="step-content">
              <h4><i class="pi pi-shopping-cart"></i> Ordini</h4>
              <p>Importa ordini con dettagli completi</p>
              <div class="step-options">
                <Dropdown
                  v-model="stepImport.orders.status"
                  :options="orderStatusOptions"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Stato ordini"
                  class="w-full"
                />
              </div>
              <div v-if="stepImport.orders.result" class="step-result">
                <span class="success">{{ stepImport.orders.result.imported }} importati</span>
                <span>{{ stepImport.orders.result.updated }} aggiornati</span>
                <span v-if="stepImport.orders.result.errors" class="error">{{ stepImport.orders.result.errors }} errori</span>
              </div>
            </div>
            <Button
              :label="stepImport.orders.running ? 'Importazione...' : 'Importa Ordini'"
              icon="pi pi-cloud-download"
              :loading="stepImport.orders.running"
              :disabled="stepImport.orders.running"
              @click="importStepOrders"
            />
          </div>

          <!-- Import Tutto -->
          <div class="step-import-card full-import" :class="{ running: stepImport.all.running }">
            <div class="step-number"><i class="pi pi-bolt"></i></div>
            <div class="step-content">
              <h4>Import Completo</h4>
              <p>Esegui tutti gli step in sequenza automaticamente</p>
              <div v-if="stepImport.all.running" class="step-progress">
                <ProgressSpinner style="width: 20px; height: 20px" />
                <span>{{ stepImport.all.currentStep }}</span>
              </div>
            </div>
            <Button
              :label="stepImport.all.running ? 'In esecuzione...' : 'Importa Tutto'"
              icon="pi pi-play"
              class="p-button-success"
              :loading="stepImport.all.running"
              :disabled="stepImport.all.running || isAnyStepRunning"
              @click="importAllSteps"
            />
          </div>
        </div>
      </section>

      <!-- Credenziali Plugin -->
      <section class="credentials-section">
        <div class="section-header">
          <h3 class="section-title">Credenziali Plugin WordPress</h3>
          <Button
            label="Nuove Credenziali"
            icon="pi pi-plus"
            class="p-button-sm"
            @click="showCreateCredentials = true"
          />
        </div>

        <p class="section-description">
          Genera credenziali per permettere al plugin WordPress di comunicare con l'ERP.
          Usa queste credenziali nella configurazione del plugin.
        </p>

        <DataTable
          :value="credentials"
          :loading="loadingCredentials"
          responsiveLayout="scroll"
          class="credentials-table"
        >
          <Column field="label" header="Etichetta">
            <template #body="{ data }">
              <span>{{ data.label || 'Senza nome' }}</span>
            </template>
          </Column>
          <Column field="username" header="Username">
            <template #body="{ data }">
              <code class="username-code">{{ data.username }}</code>
            </template>
          </Column>
          <Column field="isActive" header="Stato" style="width: 100px">
            <template #body="{ data }">
              <Tag
                :value="data.isActive ? 'Attivo' : 'Disattivato'"
                :severity="data.isActive ? 'success' : 'danger'"
              />
            </template>
          </Column>
          <Column field="lastUsed" header="Ultimo Utilizzo" style="width: 150px">
            <template #body="{ data }">
              <span v-if="data.lastUsed">{{ formatDate(data.lastUsed) }}</span>
              <span v-else class="text-gray-400">Mai usato</span>
            </template>
          </Column>
          <Column header="Azioni" style="width: 120px">
            <template #body="{ data }">
              <div class="action-buttons">
                <Button
                  :icon="data.isActive ? 'pi pi-pause' : 'pi pi-play'"
                  class="p-button-text p-button-sm"
                  :class="data.isActive ? 'p-button-warning' : 'p-button-success'"
                  v-tooltip="data.isActive ? 'Disattiva' : 'Attiva'"
                  @click="toggleCredential(data)"
                />
                <Button
                  icon="pi pi-trash"
                  class="p-button-text p-button-sm p-button-danger"
                  v-tooltip="'Elimina'"
                  @click="deleteCredential(data)"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </section>

      <!-- Log Sincronizzazione -->
      <section class="logs-section">
        <div class="section-header">
          <h3 class="section-title">Log Sincronizzazione</h3>
          <div class="logs-filters">
            <Dropdown
              v-model="logsFilter.entity"
              :options="entityOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Tutte le entita"
              class="filter-dropdown"
              @change="loadLogs"
            />
            <Dropdown
              v-model="logsFilter.status"
              :options="statusOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Tutti gli stati"
              class="filter-dropdown"
              @change="loadLogs"
            />
            <Button
              icon="pi pi-refresh"
              class="p-button-text"
              @click="loadLogs"
            />
          </div>
        </div>

        <DataTable
          :value="syncLogs"
          :loading="loadingLogs"
          responsiveLayout="scroll"
          class="logs-table"
          :rows="10"
          :paginator="true"
        >
          <Column field="createdAt" header="Data" style="width: 150px">
            <template #body="{ data }">
              {{ formatDateTime(data.createdAt) }}
            </template>
          </Column>
          <Column field="direction" header="Direzione" style="width: 100px">
            <template #body="{ data }">
              <Tag
                :value="data.direction === 'TO_WP' ? 'ERP → WP' : 'WP → ERP'"
                :severity="data.direction === 'TO_WP' ? 'info' : 'warning'"
              />
            </template>
          </Column>
          <Column field="entity" header="Entita" style="width: 100px">
            <template #body="{ data }">
              {{ entityLabels[data.entity] || data.entity }}
            </template>
          </Column>
          <Column field="action" header="Azione" style="width: 120px" />
          <Column field="status" header="Stato" style="width: 100px">
            <template #body="{ data }">
              <Tag
                :value="data.status"
                :severity="getStatusSeverity(data.status)"
              />
            </template>
          </Column>
          <Column field="error" header="Dettagli">
            <template #body="{ data }">
              <span v-if="data.error" class="error-text">{{ data.error }}</span>
              <span v-else class="text-gray-400">-</span>
            </template>
          </Column>
        </DataTable>
      </section>
    </div>

    <!-- Dialog Creazione Credenziali -->
    <Dialog
      v-model:visible="showCreateCredentials"
      header="Nuove Credenziali Plugin"
      :style="{ width: '450px' }"
      modal
    >
      <div class="p-fluid">
        <div class="field">
          <label for="credLabel">Etichetta (opzionale)</label>
          <InputText
            id="credLabel"
            v-model="newCredential.label"
            placeholder="es. Plugin Sito Principale"
          />
        </div>
      </div>

      <template #footer>
        <Button
          label="Annulla"
          icon="pi pi-times"
          class="p-button-text"
          @click="showCreateCredentials = false"
        />
        <Button
          label="Genera"
          icon="pi pi-key"
          :loading="creatingCredential"
          @click="createCredential"
        />
      </template>
    </Dialog>

    <!-- Dialog Credenziali Create -->
    <Dialog
      v-model:visible="showCredentialsResult"
      header="Credenziali Create"
      :style="{ width: '500px' }"
      modal
      :closable="false"
    >
      <div class="credentials-result">
        <Message severity="warn" :closable="false">
          <strong>Salva queste credenziali!</strong><br>
          La password non sara piu visibile dopo la chiusura di questo dialog.
        </Message>

        <div class="credential-field">
          <label>Username</label>
          <div class="credential-value">
            <code>{{ createdCredentials.username }}</code>
            <Button
              icon="pi pi-copy"
              class="p-button-text p-button-sm"
              @click="copyToClipboard(createdCredentials.username)"
            />
          </div>
        </div>

        <div class="credential-field">
          <label>Password</label>
          <div class="credential-value">
            <code>{{ createdCredentials.password }}</code>
            <Button
              icon="pi pi-copy"
              class="p-button-text p-button-sm"
              @click="copyToClipboard(createdCredentials.password)"
            />
          </div>
        </div>
      </div>

      <template #footer>
        <Button
          label="Ho salvato le credenziali"
          icon="pi pi-check"
          @click="closeCredentialsResult"
        />
      </template>
    </Dialog>

    <!-- Dialog Import/Export Wizard -->
    <Dialog
      v-model:visible="showBulkWizard"
      header="Import/Export Wizard"
      :style="{ width: '700px', maxWidth: '95vw' }"
      modal
      :closable="!bulkOperationRunning"
    >
      <!-- Step 1: Scelta Direzione -->
      <div v-if="wizardStep === 1" class="wizard-step">
        <h3>Scegli la direzione</h3>
        <p class="step-description">Seleziona se vuoi importare dati da WooCommerce o esportare dati verso WooCommerce</p>

        <div class="direction-cards">
          <div
            class="direction-card"
            :class="{ selected: bulkDirection === 'import' }"
            @click="bulkDirection = 'import'"
          >
            <i class="pi pi-cloud-download"></i>
            <h4>Importa da WooCommerce</h4>
            <p>Importa prodotti, clienti e ordini esistenti da WooCommerce nell'ERP</p>
            <div v-if="importPreview" class="preview-counts">
              <span><strong>{{ importPreview.woocommerce.products }}</strong> prodotti</span>
              <span><strong>{{ importPreview.woocommerce.customers }}</strong> clienti</span>
              <span><strong>{{ importPreview.woocommerce.orders }}</strong> ordini</span>
            </div>
          </div>

          <div
            class="direction-card"
            :class="{ selected: bulkDirection === 'export' }"
            @click="bulkDirection = 'export'"
          >
            <i class="pi pi-cloud-upload"></i>
            <h4>Esporta verso WooCommerce</h4>
            <p>Sincronizza i prodotti dell'ERP verso WooCommerce</p>
            <div v-if="importPreview" class="preview-counts">
              <span><strong>{{ importPreview.erp.webActiveProducts }}</strong> prodotti web attivi</span>
              <span><strong>{{ importPreview.erp.products }}</strong> prodotti totali</span>
            </div>
          </div>
        </div>

        <div v-if="loadingPreview" class="loading-preview">
          <ProgressSpinner style="width: 30px; height: 30px" />
          <span>Caricamento conteggi...</span>
        </div>
      </div>

      <!-- Step 2: Opzioni Import -->
      <div v-if="wizardStep === 2 && bulkDirection === 'import'" class="wizard-step">
        <h3>Opzioni Import</h3>
        <p class="step-description">Seleziona il tipo di import e le opzioni</p>

        <div class="options-list">
          <!-- Tipo Import -->
          <div class="import-type-selection">
            <label><strong>Tipo di Import</strong></label>
            <div class="import-type-cards">
              <div
                class="import-type-card"
                :class="{ selected: bulkOptions.importType === 'full' }"
                @click="bulkOptions.importType = 'full'"
              >
                <i class="pi pi-star-fill"></i>
                <h5>Import Completo (Consigliato)</h5>
                <p>Importa prodotti con tutte le relazioni: categorie gerarchiche, immagini, varianti, classi spedizione, inventario e SEO</p>
              </div>
              <div
                class="import-type-card"
                :class="{ selected: bulkOptions.importType === 'basic' }"
                @click="bulkOptions.importType = 'basic'"
              >
                <i class="pi pi-bolt"></i>
                <h5>Import Base</h5>
                <p>Import veloce con clienti e ordini. Per prodotti usa solo dati base senza relazioni complete</p>
              </div>
            </div>
          </div>

          <Divider />

          <!-- Opzioni Full Import -->
          <div v-if="bulkOptions.importType === 'full'" class="full-import-options">
            <div class="option-item">
              <Checkbox v-model="bulkOptions.importCategories" binary inputId="importCategories" />
              <label for="importCategories">
                <strong>Categorie</strong>
                <span class="option-hint">Importa categorie gerarchiche con immagini</span>
              </label>
            </div>

            <div class="option-item">
              <Checkbox v-model="bulkOptions.importShippingClasses" binary inputId="importShippingClasses" />
              <label for="importShippingClasses">
                <strong>Classi di Spedizione</strong>
                <span class="option-hint">Importa tutte le classi di spedizione</span>
              </label>
            </div>

            <div class="option-item">
              <Checkbox v-model="bulkOptions.importProducts" binary inputId="importProductsFull" />
              <label for="importProductsFull">
                <strong>Prodotti</strong>
                <span class="option-hint">Con immagini relazionali, varianti complete, SEO e inventario</span>
                <span v-if="importPreview">({{ importPreview.woocommerce.products }} disponibili)</span>
              </label>
            </div>
          </div>

          <!-- Opzioni Basic Import -->
          <div v-if="bulkOptions.importType === 'basic'" class="basic-import-options">
            <div class="option-item">
              <Checkbox v-model="bulkOptions.importProducts" binary inputId="importProducts" />
              <label for="importProducts">
                <strong>Prodotti</strong>
                <span v-if="importPreview">({{ importPreview.woocommerce.products }} disponibili)</span>
              </label>
            </div>

            <div class="option-item">
              <Checkbox v-model="bulkOptions.importCustomers" binary inputId="importCustomers" />
              <label for="importCustomers">
                <strong>Clienti</strong>
                <span v-if="importPreview">({{ importPreview.woocommerce.customers }} disponibili)</span>
              </label>
            </div>

            <div class="option-item">
              <Checkbox v-model="bulkOptions.importOrders" binary inputId="importOrders" />
              <label for="importOrders">
                <strong>Ordini</strong>
                <span v-if="importPreview">({{ importPreview.woocommerce.orders }} disponibili)</span>
              </label>
            </div>

            <div v-if="bulkOptions.importOrders" class="option-item sub-option">
              <label for="orderStatus"><strong>Stato ordini da importare</strong></label>
              <Dropdown
                v-model="bulkOptions.orderStatus"
                :options="orderStatusOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Tutti gli stati"
                class="w-full mt-2"
              />
            </div>
          </div>

          <Divider />

          <div class="option-item">
            <Checkbox v-model="bulkOptions.overwriteExisting" binary inputId="overwrite" />
            <label for="overwrite">
              <strong>Sovrascrivi esistenti</strong>
              <span class="option-hint">Se disattivato, i record gia esistenti non verranno modificati</span>
            </label>
          </div>

          <div class="option-item">
            <label for="productStatus"><strong>Stato prodotti da importare</strong></label>
            <Dropdown
              v-model="bulkOptions.productStatus"
              :options="productStatusOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Seleziona"
              class="w-full mt-2"
            />
          </div>

          <Divider />

          <div class="option-item highlight-option">
            <Checkbox v-model="bulkOptions.autoCreateDependencies" binary inputId="autoCreateDeps" />
            <label for="autoCreateDeps">
              <strong>Crea dipendenze automaticamente</strong>
              <span class="option-hint">
                Se un prodotto/cliente/categoria non esiste durante l'import, viene creato automaticamente.
                Garantisce zero errori di relazione.
              </span>
            </label>
          </div>
        </div>
      </div>

      <!-- Step 2: Opzioni Export -->
      <div v-if="wizardStep === 2 && bulkDirection === 'export'" class="wizard-step">
        <h3>Opzioni Export</h3>
        <p class="step-description">Configura l'export verso WooCommerce</p>

        <div class="options-list">
          <div class="option-item">
            <Checkbox v-model="bulkOptions.includeInventory" binary inputId="includeInventory" />
            <label for="includeInventory">
              <strong>Includi aggiornamento giacenze</strong>
              <span class="option-hint">Sincronizza anche le quantita stock</span>
            </label>
          </div>

          <Message severity="info" :closable="false" class="mt-4">
            Verranno esportati tutti i prodotti con <code>webActive = true</code>.<br>
            Attualmente hai <strong>{{ importPreview?.erp?.webActiveProducts || 0 }}</strong> prodotti pronti per l'export.
          </Message>

          <Message v-if="(importPreview?.erp?.webActiveProducts || 0) === 0" severity="warn" :closable="false">
            <strong>Nessun prodotto da esportare!</strong><br>
            Vai nella scheda prodotti e attiva l'opzione "Pubblica su Web" per i prodotti che vuoi sincronizzare.
          </Message>
        </div>
      </div>

      <!-- Step 3: Esecuzione -->
      <div v-if="wizardStep === 3" class="wizard-step">
        <h3>{{ bulkOperationRunning ? 'Operazione in corso...' : 'Risultati' }}</h3>

        <div v-if="bulkOperationRunning" class="operation-progress">
          <ProgressSpinner style="width: 50px; height: 50px" />
          <p>{{ bulkDirection === 'import' ? 'Importazione' : 'Esportazione' }} in corso...</p>
          <p class="progress-hint">Questa operazione potrebbe richiedere diversi minuti per grandi quantita di dati.</p>
        </div>

        <div v-else-if="bulkResult" class="operation-results">
          <Message :severity="bulkResult.success ? 'success' : 'error'" :closable="false">
            {{ bulkResult.success ? 'Operazione completata!' : 'Operazione completata con errori' }}
          </Message>

          <!-- Smart Import Results (con dipendenze automatiche) -->
          <div v-if="bulkDirection === 'import' && bulkResult.importType === 'smart'" class="results-grid smart-import-results">
            <div class="result-card" v-if="bulkResult.data?.categories">
              <i class="pi pi-folder"></i>
              <div class="result-info">
                <h5>Categorie</h5>
                <span>{{ bulkResult.data.categories.imported || 0 }} importate</span>
                <span class="errors" v-if="bulkResult.data.categories.errors">{{ bulkResult.data.categories.errors }} errori</span>
              </div>
            </div>

            <div class="result-card" v-if="bulkResult.data?.shippingClasses">
              <i class="pi pi-truck"></i>
              <div class="result-info">
                <h5>Classi Spedizione</h5>
                <span>{{ bulkResult.data.shippingClasses.imported || 0 }} importate</span>
              </div>
            </div>

            <div class="result-card" v-if="bulkResult.data?.customers">
              <i class="pi pi-users"></i>
              <div class="result-info">
                <h5>Clienti</h5>
                <span>{{ bulkResult.data.customers.imported || 0 }} importati</span>
              </div>
            </div>

            <div class="result-card" v-if="bulkResult.data?.products">
              <i class="pi pi-box"></i>
              <div class="result-info">
                <h5>Prodotti</h5>
                <span>{{ bulkResult.data.products.imported || 0 }} importati</span>
                <span v-if="bulkResult.data.products.variations">{{ bulkResult.data.products.variations }} varianti</span>
                <span class="errors" v-if="bulkResult.data.products.errors">{{ bulkResult.data.products.errors }} errori</span>
              </div>
            </div>

            <div class="result-card" v-if="bulkResult.data?.orders">
              <i class="pi pi-shopping-cart"></i>
              <div class="result-info">
                <h5>Ordini</h5>
                <span>{{ bulkResult.data.orders.imported || 0 }} importati</span>
                <span class="errors" v-if="bulkResult.data.orders.errors">{{ bulkResult.data.orders.errors }} errori</span>
              </div>
            </div>

            <!-- Elementi Auto-Creati -->
            <div class="result-card auto-created" v-if="bulkResult.data?.autoCreated && (bulkResult.data.autoCreated.categories > 0 || bulkResult.data.autoCreated.customers > 0 || bulkResult.data.autoCreated.products > 0)">
              <i class="pi pi-sparkles"></i>
              <div class="result-info">
                <h5>Auto-Creati</h5>
                <span v-if="bulkResult.data.autoCreated.categories">{{ bulkResult.data.autoCreated.categories }} categorie</span>
                <span v-if="bulkResult.data.autoCreated.customers">{{ bulkResult.data.autoCreated.customers }} clienti</span>
                <span v-if="bulkResult.data.autoCreated.products">{{ bulkResult.data.autoCreated.products }} prodotti</span>
              </div>
            </div>
          </div>

          <!-- Full Import Results -->
          <div v-if="bulkDirection === 'import' && bulkResult.importType === 'full'" class="results-grid full-import-results">
            <div class="result-card" v-if="bulkResult.data?.categories">
              <i class="pi pi-folder"></i>
              <div class="result-info">
                <h5>Categorie</h5>
                <span>{{ bulkResult.data.categories.imported || 0 }} importate</span>
                <span class="errors" v-if="bulkResult.data.categories.errors">{{ bulkResult.data.categories.errors }} errori</span>
              </div>
            </div>

            <div class="result-card" v-if="bulkResult.data?.shippingClasses">
              <i class="pi pi-truck"></i>
              <div class="result-info">
                <h5>Classi Spedizione</h5>
                <span>{{ bulkResult.data.shippingClasses.imported || 0 }} importate</span>
                <span class="errors" v-if="bulkResult.data.shippingClasses.errors">{{ bulkResult.data.shippingClasses.errors }} errori</span>
              </div>
            </div>

            <div class="result-card" v-if="bulkResult.data?.products">
              <i class="pi pi-box"></i>
              <div class="result-info">
                <h5>Prodotti</h5>
                <span>{{ bulkResult.data.products.imported || 0 }} importati</span>
                <span v-if="bulkResult.data.products.variations">{{ bulkResult.data.products.variations }} varianti</span>
                <span class="errors" v-if="bulkResult.data.products.errors">{{ bulkResult.data.products.errors }} errori</span>
              </div>
            </div>

            <div class="result-card" v-if="bulkResult.data?.images">
              <i class="pi pi-image"></i>
              <div class="result-info">
                <h5>Immagini</h5>
                <span>{{ bulkResult.data.images || 0 }} importate</span>
              </div>
            </div>

            <div class="result-card" v-if="bulkResult.data?.inventory">
              <i class="pi pi-database"></i>
              <div class="result-info">
                <h5>Inventario</h5>
                <span>{{ bulkResult.data.inventory || 0 }} voci create</span>
              </div>
            </div>
          </div>

          <!-- Basic Import Results -->
          <div v-if="bulkDirection === 'import' && bulkResult.importType !== 'full'" class="results-grid">
            <div class="result-card" v-if="bulkOptions.importProducts">
              <i class="pi pi-box"></i>
              <div class="result-info">
                <h5>Prodotti</h5>
                <span>{{ bulkResult.data?.products?.imported || 0 }} importati</span>
                <span>{{ bulkResult.data?.products?.updated || 0 }} aggiornati</span>
                <span class="errors" v-if="bulkResult.data?.products?.errors">{{ bulkResult.data?.products?.errors }} errori</span>
              </div>
            </div>

            <div class="result-card" v-if="bulkOptions.importCustomers">
              <i class="pi pi-users"></i>
              <div class="result-info">
                <h5>Clienti</h5>
                <span>{{ bulkResult.data?.customers?.imported || 0 }} importati</span>
                <span>{{ bulkResult.data?.customers?.updated || 0 }} aggiornati</span>
                <span class="errors" v-if="bulkResult.data?.customers?.errors">{{ bulkResult.data?.customers?.errors }} errori</span>
              </div>
            </div>

            <div class="result-card" v-if="bulkOptions.importOrders">
              <i class="pi pi-shopping-cart"></i>
              <div class="result-info">
                <h5>Ordini</h5>
                <span>{{ bulkResult.data?.orders?.imported || 0 }} importati</span>
                <span>{{ bulkResult.data?.orders?.updated || 0 }} aggiornati</span>
                <span class="errors" v-if="bulkResult.data?.orders?.errors">{{ bulkResult.data?.orders?.errors }} errori</span>
              </div>
            </div>
          </div>

          <div v-if="bulkDirection === 'export'" class="results-grid">
            <div class="result-card">
              <i class="pi pi-box"></i>
              <div class="result-info">
                <h5>Prodotti</h5>
                <span>{{ bulkResult.data?.products?.synced || 0 }} sincronizzati</span>
                <span class="errors" v-if="bulkResult.data?.products?.errors">{{ bulkResult.data?.products?.errors }} errori</span>
              </div>
            </div>

            <div class="result-card" v-if="bulkResult.data?.inventory">
              <i class="pi pi-database"></i>
              <div class="result-info">
                <h5>Giacenze</h5>
                <span>{{ bulkResult.data?.inventory?.synced || 0 }} aggiornate</span>
                <span class="errors" v-if="bulkResult.data?.inventory?.errors">{{ bulkResult.data?.inventory?.errors }} errori</span>
              </div>
            </div>
          </div>

          <p v-if="bulkResult.duration" class="duration-info">
            Tempo impiegato: {{ Math.round(bulkResult.duration / 1000) }} secondi
          </p>
        </div>
      </div>

      <template #footer>
        <div class="wizard-footer">
          <Button
            v-if="wizardStep > 1 && !bulkOperationRunning"
            label="Indietro"
            icon="pi pi-arrow-left"
            class="p-button-text"
            @click="wizardStep--"
          />
          <div class="footer-spacer"></div>
          <Button
            v-if="wizardStep === 3 && !bulkOperationRunning"
            label="Chiudi"
            icon="pi pi-times"
            @click="closeBulkWizard"
          />
          <Button
            v-if="wizardStep === 1"
            label="Avanti"
            icon="pi pi-arrow-right"
            iconPos="right"
            :disabled="!bulkDirection"
            @click="wizardStep = 2"
          />
          <Button
            v-if="wizardStep === 2"
            :label="bulkDirection === 'import' ? 'Avvia Import' : 'Avvia Export'"
            :icon="bulkDirection === 'import' ? 'pi pi-cloud-download' : 'pi pi-cloud-upload'"
            :disabled="bulkDirection === 'import' && (
              bulkOptions.importType === 'full'
                ? !bulkOptions.importProducts && !bulkOptions.importCategories && !bulkOptions.importShippingClasses
                : !bulkOptions.importProducts && !bulkOptions.importCustomers && !bulkOptions.importOrders
            )"
            @click="executeBulkOperation"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, computed } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Dropdown from 'primevue/dropdown';
import Checkbox from 'primevue/checkbox';
import Divider from 'primevue/divider';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import { useToast } from 'primevue/usetoast';
import PageHeader from '../components/PageHeader.vue';
import WordPressImportProgress from '../components/WordPressImportProgress.vue';
import ImportJobHistory from '../components/ImportJobHistory.vue';
import api from '../services/api.service';

const toast = useToast();

// WooCommerce Configuration State
const wooConfig = reactive({
  url: '',
  consumerKey: '',
  consumerSecret: '',
  isConfigured: false,
  hasExistingKeys: false,
});
const testingConnection = ref(false);
const savingConfig = ref(false);
const connectionTestResult = ref<{
  success: boolean;
  message: string;
  details?: any;
} | null>(null);

// State
const syncStatus = ref<any>(null);
const credentials = ref<any[]>([]);
const syncLogs = ref<any[]>([]);
const loadingCredentials = ref(false);
const loadingLogs = ref(false);

const syncing = reactive({
  webProducts: false,
  inventory: false,
  import: false,
});

const lastSyncResult = ref<{ type: string; message: string } | null>(null);

// Dialogs
const showCreateCredentials = ref(false);
const showCredentialsResult = ref(false);
const creatingCredential = ref(false);
const newCredential = ref({ label: '' });
const createdCredentials = ref({ username: '', password: '' });

// Bulk Wizard State
const showBulkWizard = ref(false);
const wizardStep = ref(1);
const bulkDirection = ref<'import' | 'export' | null>(null);
const loadingPreview = ref(false);
const importPreview = ref<any>(null);
const bulkOperationRunning = ref(false);
const bulkResult = ref<any>(null);

const bulkOptions = reactive({
  importType: 'full' as 'full' | 'basic',
  importProducts: true,
  importCustomers: true,
  importOrders: false,
  importCategories: true,
  importShippingClasses: true,
  overwriteExisting: false,
  productStatus: 'publish' as 'publish' | 'draft' | 'any',
  orderStatus: '' as string, // Filtro stato ordini
  includeInventory: true,
  autoCreateDependencies: true, // Crea automaticamente dipendenze mancanti
});

const productStatusOptions = [
  { label: 'Solo pubblicati', value: 'publish' },
  { label: 'Solo bozze', value: 'draft' },
  { label: 'Tutti', value: 'any' },
];

// Step Import State
const stepImport = reactive({
  categories: {
    running: false,
    completed: false,
    result: null as { imported: number; updated: number; errors?: number } | null,
  },
  shippingClasses: {
    running: false,
    completed: false,
    result: null as { imported: number; updated: number } | null,
  },
  products: {
    running: false,
    completed: false,
    status: 'publish' as 'publish' | 'draft' | 'any',
    result: null as { imported: number; updated: number; errors?: number } | null,
  },
  customers: {
    running: false,
    completed: false,
    result: null as { imported: number; updated: number; errors?: number } | null,
  },
  orders: {
    running: false,
    completed: false,
    status: '' as string,
    result: null as { imported: number; updated: number; errors?: number } | null,
  },
  all: {
    running: false,
    currentStep: '',
  },
});

const isAnyStepRunning = computed(() => {
  return stepImport.categories.running ||
    stepImport.shippingClasses.running ||
    stepImport.products.running ||
    stepImport.customers.running ||
    stepImport.orders.running;
});

// Stato per importazione clienti asincrona
const customerImportJob = reactive({
  visible: false,
  jobId: null as string | null,
});

// Ref per componente storico importazioni
const importJobHistoryRef = ref<InstanceType<typeof ImportJobHistory> | null>(null);

const STORAGE_KEY = 'wp_customer_import_job';

// Salva jobId nel localStorage
const saveJobToStorage = (jobId: string) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ jobId, savedAt: new Date().toISOString() }));
};

// Rimuovi jobId dal localStorage
const clearJobFromStorage = () => {
  localStorage.removeItem(STORAGE_KEY);
};

// Recupera jobId dal localStorage
const getJobFromStorage = (): string | null => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const data = JSON.parse(stored);
      // Ignora se più vecchio di 24 ore
      const savedAt = new Date(data.savedAt).getTime();
      const now = Date.now();
      if (now - savedAt < 24 * 60 * 60 * 1000) {
        return data.jobId;
      }
      clearJobFromStorage();
    } catch (e) {
      clearJobFromStorage();
    }
  }
  return null;
};

// Controlla se ci sono job attivi all'avvio
const checkExistingJobs = async () => {
  try {
    const response = await api.get('/wordpress/import-customers-jobs');
    if (response.success && response.data) {
      // Se c'è un job attivo, mostralo
      if (response.data.active?.length > 0) {
        const activeJob = response.data.active[0];
        customerImportJob.jobId = activeJob.id;
        customerImportJob.visible = true;
        stepImport.customers.running = true;
        saveJobToStorage(activeJob.id);
        return;
      }

      // Se c'è un job in attesa, mostralo
      if (response.data.waiting?.length > 0) {
        const waitingJob = response.data.waiting[0];
        customerImportJob.jobId = waitingJob.id;
        customerImportJob.visible = true;
        stepImport.customers.running = true;
        saveJobToStorage(waitingJob.id);
        return;
      }
    }

    // Altrimenti controlla localStorage per job salvato
    const storedJobId = getJobFromStorage();
    if (storedJobId) {
      // Verifica se il job esiste ancora
      const statusResponse = await api.get(`/wordpress/import-customers-status/${storedJobId}`);
      if (statusResponse.success && statusResponse.data.status !== 'not_found') {
        if (statusResponse.data.status === 'active' || statusResponse.data.status === 'waiting') {
          customerImportJob.jobId = storedJobId;
          customerImportJob.visible = true;
          stepImport.customers.running = true;
        } else {
          // Job completato/fallito, pulisci storage
          clearJobFromStorage();
        }
      } else {
        clearJobFromStorage();
      }
    }
  } catch (error) {
    console.error('Errore controllo job esistenti:', error);
  }
};

const orderStatusOptions = [
  { label: 'Tutti gli stati', value: '' },
  { label: 'In attesa', value: 'pending' },
  { label: 'In lavorazione', value: 'processing' },
  { label: 'In sospeso', value: 'on-hold' },
  { label: 'Completato', value: 'completed' },
  { label: 'Cancellato', value: 'cancelled' },
  { label: 'Rimborsato', value: 'refunded' },
  { label: 'Fallito', value: 'failed' },
];

// Filters
const logsFilter = ref({
  entity: '',
  status: '',
});

const entityOptions = [
  { label: 'Tutte', value: '' },
  { label: 'Prodotti', value: 'PRODUCT' },
  { label: 'Ordini', value: 'ORDER' },
  { label: 'Clienti', value: 'CUSTOMER' },
  { label: 'Inventario', value: 'INVENTORY' },
];

const statusOptions = [
  { label: 'Tutti', value: '' },
  { label: 'Successo', value: 'SUCCESS' },
  { label: 'Fallito', value: 'FAILED' },
  { label: 'In attesa', value: 'PENDING' },
];

const entityLabels: Record<string, string> = {
  PRODUCT: 'Prodotto',
  ORDER: 'Ordine',
  CUSTOMER: 'Cliente',
  INVENTORY: 'Inventario',
};

// Load WooCommerce Settings
const loadWooSettings = async () => {
  try {
    const response = await api.get('/wordpress/settings');
    if (response.success && response.data) {
      wooConfig.url = response.data.url || '';
      // NON precompiliamo le chiavi - mostreremo solo placeholder
      wooConfig.consumerKey = '';
      wooConfig.consumerSecret = '';
      wooConfig.isConfigured = response.data.isConfigured || false;
      wooConfig.hasExistingKeys = response.data.isConfigured || false;
    }
  } catch (error) {
    console.error('Error loading WooCommerce settings:', error);
  }
};

// Test Connection
const testConnection = async () => {
  // Se non ha inserito le chiavi e non ci sono chiavi salvate, errore
  if (!wooConfig.consumerKey && !wooConfig.hasExistingKeys) {
    connectionTestResult.value = {
      success: false,
      message: 'Inserisci Consumer Key e Consumer Secret',
    };
    return;
  }

  testingConnection.value = true;
  connectionTestResult.value = null;

  try {
    // Se l'utente ha inserito nuove chiavi, usiamo quelle
    // Altrimenti il backend userà quelle salvate
    const payload: any = { url: wooConfig.url };

    if (wooConfig.consumerKey) {
      payload.consumerKey = wooConfig.consumerKey;
    }
    if (wooConfig.consumerSecret) {
      payload.consumerSecret = wooConfig.consumerSecret;
    }

    const response = await api.post('/wordpress/settings/test', payload);

    connectionTestResult.value = {
      success: response.success,
      message: response.message,
      details: response.data,
    };
  } catch (error: any) {
    connectionTestResult.value = {
      success: false,
      message: error.message || 'Errore durante il test',
    };
  } finally {
    testingConnection.value = false;
  }
};

// Save Configuration
const saveConfiguration = async () => {
  savingConfig.value = true;

  try {
    const payload: any = {
      url: wooConfig.url,
      consumerKey: wooConfig.consumerKey,
    };

    // Includi secret solo se inserito
    if (wooConfig.consumerSecret) {
      payload.consumerSecret = wooConfig.consumerSecret;
    }

    await api.put('/wordpress/settings', payload);

    toast.add({
      severity: 'success',
      summary: 'Salvato',
      detail: 'Configurazione WooCommerce salvata',
      life: 3000,
    });

    // Ricarica settings e status
    await loadWooSettings();
    await loadSyncStatus();

    wooConfig.isConfigured = true;
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore salvataggio configurazione',
      life: 5000,
    });
  } finally {
    savingConfig.value = false;
  }
};

// Load data
const loadSyncStatus = async () => {
  try {
    const response = await api.get('/wordpress/sync-status');
    if (response.success) {
      syncStatus.value = response.data;
    }
  } catch (error) {
    console.error('Error loading sync status:', error);
  }
};

const loadCredentials = async () => {
  loadingCredentials.value = true;
  try {
    const response = await api.get('/wordpress/credentials');
    if (response.success) {
      credentials.value = response.data;
    }
  } catch (error) {
    console.error('Error loading credentials:', error);
  } finally {
    loadingCredentials.value = false;
  }
};

const loadLogs = async () => {
  loadingLogs.value = true;
  try {
    const params = new URLSearchParams();
    if (logsFilter.value.entity) params.append('entity', logsFilter.value.entity);
    if (logsFilter.value.status) params.append('status', logsFilter.value.status);
    params.append('limit', '50');

    const response = await api.get(`/wordpress/sync-logs?${params.toString()}`);
    if (response.success) {
      syncLogs.value = response.data;
    }
  } catch (error) {
    console.error('Error loading logs:', error);
  } finally {
    loadingLogs.value = false;
  }
};

// Sync actions
const syncWebProducts = async () => {
  syncing.webProducts = true;
  lastSyncResult.value = null;
  try {
    const response = await api.post('/wordpress/sync-web-products', {});
    if (response.success) {
      const data = response.data;
      lastSyncResult.value = {
        type: 'success',
        message: `Sincronizzati ${data.synced} prodotti, ${data.errors} errori`,
      };
      loadSyncStatus();
      loadLogs();
    }
  } catch (error: any) {
    lastSyncResult.value = {
      type: 'error',
      message: error.message || 'Errore durante la sincronizzazione',
    };
  } finally {
    syncing.webProducts = false;
  }
};

const syncInventory = async () => {
  syncing.inventory = true;
  lastSyncResult.value = null;
  try {
    const response = await api.post('/wordpress/sync-inventory', {});
    if (response.success) {
      const data = response.data;
      lastSyncResult.value = {
        type: 'success',
        message: `Giacenze aggiornate: ${data.synced} prodotti`,
      };
      loadLogs();
    }
  } catch (error: any) {
    lastSyncResult.value = {
      type: 'error',
      message: error.message || 'Errore durante la sincronizzazione',
    };
  } finally {
    syncing.inventory = false;
  }
};

// Bulk Wizard Functions
const openBulkWizard = async () => {
  showBulkWizard.value = true;
  wizardStep.value = 1;
  bulkDirection.value = null;
  bulkResult.value = null;
  bulkOperationRunning.value = false;

  // Reset opzioni
  bulkOptions.importType = 'full';
  bulkOptions.importProducts = true;
  bulkOptions.importCustomers = true;
  bulkOptions.importOrders = false;
  bulkOptions.importCategories = true;
  bulkOptions.importShippingClasses = true;
  bulkOptions.overwriteExisting = false;
  bulkOptions.productStatus = 'publish';

  // Carica preview
  loadingPreview.value = true;
  try {
    const response = await api.get('/wordpress/import-preview');
    if (response.success) {
      importPreview.value = response.data;
    }
  } catch (error) {
    console.error('Error loading preview:', error);
  } finally {
    loadingPreview.value = false;
  }
};

const closeBulkWizard = () => {
  showBulkWizard.value = false;
  loadSyncStatus();
  loadLogs();
};

// Step-by-Step Import Functions
const importStepCategories = async () => {
  stepImport.categories.running = true;
  stepImport.categories.result = null;
  try {
    const response = await api.post('/wordpress/import-categories', {});
    if (response.success) {
      stepImport.categories.result = {
        imported: response.data?.imported || 0,
        updated: response.data?.updated || 0,
        errors: response.data?.errors || 0,
      };
      stepImport.categories.completed = true;
      toast.add({
        severity: 'success',
        summary: 'Categorie importate',
        detail: `${response.data?.imported || 0} categorie importate`,
        life: 3000,
      });
    }
  } catch (error: any) {
    stepImport.categories.result = { imported: 0, updated: 0, errors: 1 };
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore importazione categorie',
      life: 5000,
    });
  } finally {
    stepImport.categories.running = false;
  }
};

const importStepShippingClasses = async () => {
  stepImport.shippingClasses.running = true;
  stepImport.shippingClasses.result = null;
  try {
    const response = await api.post('/wordpress/import-shipping-classes', {});
    if (response.success) {
      stepImport.shippingClasses.result = {
        imported: response.data?.imported || 0,
        updated: response.data?.updated || 0,
      };
      stepImport.shippingClasses.completed = true;
      toast.add({
        severity: 'success',
        summary: 'Classi spedizione importate',
        detail: `${response.data?.imported || 0} classi importate`,
        life: 3000,
      });
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore importazione classi spedizione',
      life: 5000,
    });
  } finally {
    stepImport.shippingClasses.running = false;
  }
};

const importStepProducts = async () => {
  stepImport.products.running = true;
  stepImport.products.result = null;
  try {
    const response = await api.post('/wordpress/import-products', {
      status: stepImport.products.status,
    });
    if (response.success) {
      stepImport.products.result = {
        imported: response.data?.imported || 0,
        updated: response.data?.updated || 0,
        errors: response.data?.errors || 0,
      };
      stepImport.products.completed = true;
      toast.add({
        severity: 'success',
        summary: 'Prodotti importati',
        detail: `${response.data?.imported || 0} prodotti importati`,
        life: 3000,
      });
    }
  } catch (error: any) {
    stepImport.products.result = { imported: 0, updated: 0, errors: 1 };
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore importazione prodotti',
      life: 5000,
    });
  } finally {
    stepImport.products.running = false;
  }
};

const importStepCustomers = async () => {
  stepImport.customers.running = true;
  stepImport.customers.result = null;

  try {
    // Avvia importazione asincrona
    const response = await api.post('/wordpress/import-customers-async', {});

    if (response.success && response.data?.jobId) {
      // Mostra il componente di progresso
      customerImportJob.jobId = response.data.jobId;
      customerImportJob.visible = true;

      // Salva nel localStorage per recupero
      saveJobToStorage(response.data.jobId);

      toast.add({
        severity: response.data.existing ? 'warn' : 'info',
        summary: response.data.existing ? 'Job esistente' : 'Importazione avviata',
        detail: response.data.existing
          ? 'C\'è già un job di importazione in corso. Mostrando il progresso.'
          : 'L\'importazione clienti è in corso in background. Puoi monitorare il progresso.',
        life: 5000,
      });
    } else {
      throw new Error('Impossibile avviare importazione');
    }
  } catch (error: any) {
    stepImport.customers.result = { imported: 0, updated: 0, errors: 1 };
    stepImport.customers.running = false;
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore avvio importazione clienti',
      life: 5000,
    });
  }
};

const onCustomerImportCompleted = (result: any) => {
  stepImport.customers.result = {
    imported: result?.imported || 0,
    updated: result?.updated || 0,
    errors: result?.errors || 0,
  };
  stepImport.customers.completed = true;
  stepImport.customers.running = false;

  // Pulisci localStorage
  clearJobFromStorage();

  // Aggiorna storico importazioni
  importJobHistoryRef.value?.refresh();

  toast.add({
    severity: 'success',
    summary: 'Importazione completata',
    detail: `${result?.imported || 0} clienti importati, ${result?.updated || 0} aggiornati`,
    life: 5000,
  });
};

const onCustomerImportCancelled = () => {
  stepImport.customers.running = false;
  customerImportJob.visible = false;
  customerImportJob.jobId = null;

  // Pulisci localStorage
  clearJobFromStorage();

  // Aggiorna storico importazioni
  importJobHistoryRef.value?.refresh();

  toast.add({
    severity: 'warn',
    summary: 'Importazione annullata',
    detail: 'L\'importazione clienti è stata annullata',
    life: 3000,
  });
};

// Handler per ripresa job dallo storico
const onJobResumed = (job: any, result: { jobId: string; dbJobId: string }) => {
  // Attiva la progress bar per il job ripreso
  customerImportJob.jobId = result.jobId;
  customerImportJob.visible = true;
  stepImport.customers.running = true;

  // Salva nel localStorage
  saveJobToStorage(result.jobId);

  toast.add({
    severity: 'info',
    summary: 'Importazione ripresa',
    detail: `Ripresa importazione da pagina ${job.currentPage}`,
    life: 3000,
  });
};

const importStepOrders = async () => {
  stepImport.orders.running = true;
  stepImport.orders.result = null;
  try {
    const response = await api.post('/wordpress/import-orders', {
      status: stepImport.orders.status || undefined,
    });
    if (response.success) {
      stepImport.orders.result = {
        imported: response.data?.imported || 0,
        updated: response.data?.updated || 0,
        errors: response.data?.errors || 0,
      };
      stepImport.orders.completed = true;
      toast.add({
        severity: 'success',
        summary: 'Ordini importati',
        detail: `${response.data?.imported || 0} ordini importati`,
        life: 3000,
      });
    }
  } catch (error: any) {
    stepImport.orders.result = { imported: 0, updated: 0, errors: 1 };
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore importazione ordini',
      life: 5000,
    });
  } finally {
    stepImport.orders.running = false;
  }
};

const importAllSteps = async () => {
  stepImport.all.running = true;

  try {
    // Step 1: Categorie
    stepImport.all.currentStep = 'Importazione categorie...';
    await importStepCategories();

    // Step 2: Classi Spedizione
    stepImport.all.currentStep = 'Importazione classi spedizione...';
    await importStepShippingClasses();

    // Step 3: Prodotti
    stepImport.all.currentStep = 'Importazione prodotti...';
    await importStepProducts();

    // Step 4: Clienti
    stepImport.all.currentStep = 'Importazione clienti...';
    await importStepCustomers();

    // Step 5: Ordini
    stepImport.all.currentStep = 'Importazione ordini...';
    await importStepOrders();

    toast.add({
      severity: 'success',
      summary: 'Import completo',
      detail: 'Tutti i dati sono stati importati',
      life: 5000,
    });
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore durante l\'import completo',
      life: 5000,
    });
  } finally {
    stepImport.all.running = false;
    stepImport.all.currentStep = '';
    loadSyncStatus();
    loadLogs();
  }
};

const executeBulkOperation = async () => {
  wizardStep.value = 3;
  bulkOperationRunning.value = true;
  bulkResult.value = null;

  try {
    if (bulkDirection.value === 'import') {
      let response;

      // Se autoCreateDependencies è attivo, usa Smart Import
      if (bulkOptions.autoCreateDependencies) {
        // Smart Import - gestione automatica dipendenze
        // Rispetta le selezioni dell'utente in base al tipo di import
        response = await api.post('/wordpress/smart-import', {
          // Per Full Import: usa le selezioni specifiche
          // Per Basic Import: categorie/classi spedizione dipendono dai prodotti selezionati
          importCategories: bulkOptions.importType === 'full'
            ? bulkOptions.importCategories
            : bulkOptions.importProducts, // se importi prodotti in basic, servono le categorie
          importShippingClasses: bulkOptions.importType === 'full'
            ? bulkOptions.importShippingClasses
            : bulkOptions.importProducts, // se importi prodotti in basic, servono le classi spedizione
          importCustomers: bulkOptions.importType === 'basic'
            ? bulkOptions.importCustomers
            : false, // in full import non importiamo clienti separatamente
          importProducts: bulkOptions.importProducts,
          importOrders: bulkOptions.importType === 'basic'
            ? bulkOptions.importOrders
            : false, // in full import non importiamo ordini
          productStatus: bulkOptions.productStatus,
          orderStatus: bulkOptions.orderStatus || undefined,
          overwrite: bulkOptions.overwriteExisting,
        });

        bulkResult.value = {
          success: response.success,
          data: response.data,
          duration: response.duration,
          importType: 'smart',
          autoCreated: response.data?.autoCreated,
        };
      } else if (bulkOptions.importType === 'full') {
        // Full Import tradizionale - importa con tutte le relazioni
        response = await api.post('/wordpress/full-import', {
          importCategories: bulkOptions.importCategories,
          importShippingClasses: bulkOptions.importShippingClasses,
          importProducts: bulkOptions.importProducts,
          overwriteExisting: bulkOptions.overwriteExisting,
          productStatus: bulkOptions.productStatus,
        });

        bulkResult.value = {
          success: response.success,
          data: response.data,
          duration: response.duration,
          importType: bulkOptions.importType,
        };
      } else {
        // Basic Import tradizionale - import veloce legacy
        response = await api.post('/wordpress/bulk-import', {
          importProducts: bulkOptions.importProducts,
          importCustomers: bulkOptions.importCustomers,
          importOrders: bulkOptions.importOrders,
          overwriteExisting: bulkOptions.overwriteExisting,
          productStatus: bulkOptions.productStatus,
        });

        bulkResult.value = {
          success: response.success,
          data: response.data,
          duration: response.duration,
          importType: bulkOptions.importType,
        };
      }
    } else {
      const response = await api.post('/wordpress/bulk-export', {
        includeInventory: bulkOptions.includeInventory,
      });

      bulkResult.value = {
        success: response.success,
        data: response.data,
        duration: response.duration,
      };
    }
  } catch (error: any) {
    bulkResult.value = {
      success: false,
      error: error.message,
    };
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message,
      life: 5000,
    });
  } finally {
    bulkOperationRunning.value = false;
  }
};

// Credentials management
const createCredential = async () => {
  creatingCredential.value = true;
  try {
    const response = await api.post('/wordpress/credentials', {
      label: newCredential.value.label || undefined,
    });

    if (response.success) {
      createdCredentials.value = {
        username: response.data.username,
        password: response.data.password,
      };
      showCreateCredentials.value = false;
      showCredentialsResult.value = true;
      newCredential.value.label = '';
      loadCredentials();
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore creazione credenziali',
      life: 3000,
    });
  } finally {
    creatingCredential.value = false;
  }
};

const toggleCredential = async (credential: any) => {
  try {
    await api.put(`/wordpress/credentials/${credential.id}/toggle`, {
      active: !credential.isActive,
    });
    loadCredentials();
    toast.add({
      severity: 'success',
      summary: 'Successo',
      detail: credential.isActive ? 'Credenziali disattivate' : 'Credenziali attivate',
      life: 2000,
    });
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message,
      life: 3000,
    });
  }
};

const deleteCredential = async (credential: any) => {
  if (!confirm('Sei sicuro di voler eliminare queste credenziali?')) return;

  try {
    await api.delete(`/wordpress/credentials/${credential.id}`);
    loadCredentials();
    toast.add({
      severity: 'success',
      summary: 'Eliminato',
      detail: 'Credenziali eliminate',
      life: 2000,
    });
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message,
      life: 3000,
    });
  }
};

const closeCredentialsResult = () => {
  showCredentialsResult.value = false;
  createdCredentials.value = { username: '', password: '' };
};

const copyToClipboard = async (text: string) => {
  await navigator.clipboard.writeText(text);
  toast.add({
    severity: 'success',
    summary: 'Copiato',
    detail: 'Copiato negli appunti',
    life: 1500,
  });
};

// Formatters
const formatDate = (date: string) => {
  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'short',
  }).format(new Date(date));
};

const formatDateTime = (date: string) => {
  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(date));
};

const getStatusSeverity = (status: string) => {
  switch (status) {
    case 'SUCCESS': return 'success';
    case 'FAILED': return 'danger';
    case 'PENDING': return 'warning';
    default: return 'info';
  }
};

// Init
onMounted(() => {
  loadWooSettings();
  loadSyncStatus();
  loadCredentials();
  loadLogs();
  // Controlla se ci sono job di importazione attivi
  checkExistingJobs();
});
</script>

<style scoped>
.wordpress-settings {
  max-width: 1400px;
  margin: 0 auto;
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

/* Config Section */
.config-section {
  background: var(--bg-card);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--border-radius-lg);
  padding: var(--space-6);
}

.config-section .section-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.config-section .section-title i {
  color: var(--color-primary-600);
}

.config-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  margin-top: var(--space-5);
}

.config-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.config-row.two-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.field-hint {
  color: var(--color-gray-500);
  font-size: var(--font-size-xs);
  margin-top: var(--space-1);
}

.field-hint.success {
  color: var(--color-success);
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.field-hint.success i {
  font-size: 0.75rem;
}

.help-box {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--color-primary-50);
  border: 1px solid var(--color-primary-200);
  border-radius: var(--border-radius-md);
}

.help-box i {
  color: var(--color-primary-600);
  font-size: 1.25rem;
  flex-shrink: 0;
}

.help-box ol {
  margin: var(--space-2) 0 0;
  padding-left: var(--space-5);
  font-size: var(--font-size-sm);
  color: var(--color-gray-700);
}

.help-box li {
  margin-bottom: var(--space-1);
}

.config-actions {
  display: flex;
  gap: var(--space-3);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-color-light);
}

.test-result {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--border-radius-md);
}

.test-result.success {
  background: var(--color-success-light);
  border: 1px solid var(--color-success);
}

.test-result.success i {
  color: var(--color-success);
}

.test-result.error {
  background: var(--color-danger-light);
  border: 1px solid var(--color-danger);
}

.test-result.error i {
  color: var(--color-danger);
}

.test-result i {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.test-details {
  display: flex;
  gap: var(--space-4);
  margin-top: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

@media (max-width: 768px) {
  .config-row.two-cols {
    grid-template-columns: 1fr;
  }
}

/* Status Section */
.status-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-5);
}

.status-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5);
  background: var(--bg-card);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--border-radius-lg);
  transition: all var(--transition-fast);
}

.status-card.connected {
  border-color: var(--color-success);
  background: linear-gradient(135deg, #d1fae5 0%, #f0fdf4 100%);
}

.status-card.error {
  border-color: var(--color-danger);
  background: linear-gradient(135deg, #fee2e2 0%, #fef2f2 100%);
}

.status-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--border-radius-md);
  font-size: 1.5rem;
}

.status-card.connected .status-icon {
  background: var(--color-success);
  color: white;
}

.status-card:not(.connected):not(.stat) .status-icon {
  background: var(--color-gray-300);
  color: white;
}

.status-icon.blue {
  background: var(--color-primary-100);
  color: var(--color-primary-600);
}

.status-icon.green {
  background: var(--color-success-light);
  color: var(--color-success);
}

.status-icon.red {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.status-info h4 {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-gray-600);
}

.status-value {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-gray-900);
}

/* Section Styles */
.section-title {
  margin: 0 0 var(--space-4) 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-gray-800);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.section-description {
  margin: 0 0 var(--space-5) 0;
  color: var(--color-gray-600);
  font-size: var(--font-size-sm);
}

/* Actions Section */
.actions-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-5);
}

.action-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5);
  background: var(--bg-card);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--border-radius-lg);
}

.action-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-50);
  border-radius: var(--border-radius-md);
  color: var(--color-primary-600);
  font-size: 1.5rem;
}

.action-content h4 {
  margin: 0 0 var(--space-2) 0;
  font-weight: 600;
  color: var(--color-gray-900);
}

.action-content p {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

.sync-result {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--border-radius-md);
  margin-top: var(--space-4);
}

.sync-result.success {
  background: var(--color-success-light);
  color: var(--color-success-dark);
}

.sync-result.error {
  background: var(--color-danger-light);
  color: var(--color-danger-dark);
}

/* Credentials Section */
.credentials-table .username-code {
  font-family: monospace;
  background: var(--color-gray-100);
  padding: 2px 8px;
  border-radius: var(--border-radius-sm);
}

.action-buttons {
  display: flex;
  gap: var(--space-1);
}

/* Logs Section */
.logs-filters {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}

.filter-dropdown {
  width: 160px;
}

.error-text {
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

/* Dialog Styles */
.credentials-result {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.credential-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.credential-field label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-gray-600);
}

.credential-value {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.credential-value code {
  flex: 1;
  padding: var(--space-3);
  background: var(--color-gray-100);
  border-radius: var(--border-radius-md);
  font-family: monospace;
  font-size: var(--font-size-sm);
  word-break: break-all;
}

/* Responsive */
@media (max-width: 1024px) {
  .status-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .actions-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .status-grid,
  .actions-grid {
    grid-template-columns: 1fr;
  }

  .logs-filters {
    flex-wrap: wrap;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }
}

/* Wizard Styles */
.action-card.highlight {
  border-color: var(--color-success);
  background: linear-gradient(135deg, #d1fae5 0%, #f0fdf4 100%);
}

.action-icon.wizard {
  background: var(--color-success);
  color: white;
}

.wizard-step {
  padding: var(--space-4) 0;
}

.wizard-step h3 {
  margin: 0 0 var(--space-2) 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-gray-900);
}

.step-description {
  margin: 0 0 var(--space-6) 0;
  color: var(--color-gray-600);
}

.direction-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.direction-card {
  padding: var(--space-5);
  border: 2px solid var(--border-color);
  border-radius: var(--border-radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: center;
}

.direction-card:hover {
  border-color: var(--color-primary-300);
  background: var(--color-primary-50);
}

.direction-card.selected {
  border-color: var(--color-primary-600);
  background: var(--color-primary-50);
}

.direction-card i {
  font-size: 2.5rem;
  color: var(--color-primary-600);
  margin-bottom: var(--space-3);
}

.direction-card h4 {
  margin: 0 0 var(--space-2) 0;
  font-weight: 600;
  color: var(--color-gray-900);
}

.direction-card p {
  margin: 0 0 var(--space-4) 0;
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

.preview-counts {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
}

.preview-counts strong {
  color: var(--color-primary-600);
}

.loading-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-6);
  color: var(--color-gray-600);
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.option-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}

.option-item label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  cursor: pointer;
}

.option-hint {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
  font-weight: normal;
}

.operation-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  text-align: center;
}

.operation-progress p {
  margin: var(--space-4) 0 0;
  font-size: var(--font-size-lg);
  font-weight: 500;
  color: var(--color-gray-700);
}

.progress-hint {
  font-size: var(--font-size-sm) !important;
  color: var(--color-gray-500) !important;
  font-weight: normal !important;
}

.operation-results {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
}

.result-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--color-gray-50);
  border-radius: var(--border-radius-md);
}

.result-card i {
  font-size: 1.5rem;
  color: var(--color-primary-600);
}

.result-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.result-info h5 {
  margin: 0;
  font-weight: 600;
  color: var(--color-gray-800);
}

.result-info span {
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

.result-info .errors {
  color: var(--color-danger);
}

.duration-info {
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
}

.wizard-footer {
  display: flex;
  align-items: center;
  width: 100%;
}

.footer-spacer {
  flex: 1;
}

.mt-2 {
  margin-top: var(--space-2);
}

.mt-4 {
  margin-top: var(--space-4);
}

.w-full {
  width: 100%;
}

@media (max-width: 600px) {
  .direction-cards {
    grid-template-columns: 1fr;
  }

  .results-grid {
    grid-template-columns: 1fr;
  }
}

/* Import Type Selection Styles */
.import-type-selection {
  margin-bottom: var(--space-4);
}

.import-type-selection > label {
  display: block;
  margin-bottom: var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-gray-700);
}

.import-type-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.import-type-card {
  padding: var(--space-4);
  border: 2px solid var(--border-color);
  border-radius: var(--border-radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.import-type-card:hover {
  border-color: var(--color-primary-300);
  background: var(--color-primary-50);
}

.import-type-card.selected {
  border-color: var(--color-primary-600);
  background: var(--color-primary-50);
}

.import-type-card i {
  font-size: 1.5rem;
  color: var(--color-primary-600);
  margin-bottom: var(--space-2);
}

.import-type-card h5 {
  margin: 0 0 var(--space-2) 0;
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--color-gray-900);
}

.import-type-card p {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-gray-600);
  line-height: 1.4;
}

.full-import-options,
.basic-import-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.full-import-results,
.smart-import-results {
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}

/* Result card auto-created style */
.result-card.auto-created {
  background: linear-gradient(135deg, #fef3c7 0%, #fef9c3 100%);
  border: 1px solid #fbbf24;
}

.result-card.auto-created i {
  color: #d97706 !important;
}

/* Highlight option */
.option-item.highlight-option {
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
  border: 1px solid var(--color-success);
  border-radius: var(--border-radius-md);
  padding: var(--space-4);
  margin-top: var(--space-2);
}

.option-item.highlight-option label strong {
  color: var(--color-success-dark);
}

/* Sub option indent */
.option-item.sub-option {
  margin-left: var(--space-6);
  padding-left: var(--space-4);
  border-left: 2px solid var(--color-primary-200);
}

@media (max-width: 600px) {
  .import-type-cards {
    grid-template-columns: 1fr;
  }
}

/* Step Import Section Styles */
.step-import-section {
  background: var(--bg-card);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--border-radius-lg);
  padding: var(--space-6);
}

.step-import-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
}

.step-import-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5);
  background: var(--color-gray-50);
  border: 2px solid var(--border-color);
  border-radius: var(--border-radius-lg);
  transition: all var(--transition-fast);
  position: relative;
}

.step-import-card.running {
  border-color: var(--color-primary-400);
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
}

.step-import-card.completed {
  border-color: var(--color-success);
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
}

.step-import-card.full-import {
  grid-column: span 3;
  flex-direction: row;
  align-items: center;
  background: linear-gradient(135deg, #fef3c7 0%, #fef9c3 100%);
  border-color: #fbbf24;
}

.step-import-card.full-import .step-number {
  background: #f59e0b;
}

.step-import-card.full-import .step-content {
  flex: 1;
}

.step-number {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-600);
  color: white;
  border-radius: 50%;
  font-weight: 700;
  font-size: var(--font-size-sm);
  flex-shrink: 0;
}

.step-import-card.completed .step-number {
  background: var(--color-success);
}

.step-content h4 {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-gray-900);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.step-content h4 i {
  color: var(--color-primary-600);
}

.step-content p {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

.step-options {
  margin-top: var(--space-2);
}

.step-result {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
  font-size: var(--font-size-xs);
}

.step-result span {
  padding: 2px 8px;
  background: white;
  border-radius: var(--border-radius-sm);
  color: var(--color-gray-600);
}

.step-result span.success {
  background: var(--color-success-light);
  color: var(--color-success-dark);
}

.step-result span.error {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.step-progress {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-primary-600);
}

@media (max-width: 1024px) {
  .step-import-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .step-import-card.full-import {
    grid-column: span 2;
  }
}

@media (max-width: 768px) {
  .step-import-grid {
    grid-template-columns: 1fr;
  }

  .step-import-card.full-import {
    grid-column: span 1;
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
