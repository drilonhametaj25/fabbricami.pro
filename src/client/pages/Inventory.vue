<template>
  <div class="inventory-page">
    <PageHeader
      title="Gestione Magazzino"
      subtitle="Monitora giacenze prodotti e materiali, previsioni e riordini"
      icon="pi pi-warehouse"
    >
      <template #actions>
        <Button
          label="Scansiona"
          icon="pi pi-camera"
          class="p-button-secondary"
          @click="openScannerDialog"
        />
        <Button
          label="Nuova Movimentazione"
          icon="pi pi-plus"
          @click="openMovementDialog"
        />
      </template>
    </PageHeader>

    <!-- Global Trend Chart Section with Multi-Scenario -->
    <section class="trend-section" v-if="globalTrend || forecast">
      <div class="trend-card">
        <div class="trend-header">
          <div class="trend-title">
            <i class="pi pi-chart-line"></i>
            <span>Andamento Valore Inventario</span>
            <Button
              icon="pi pi-info-circle"
              class="p-button-rounded p-button-text p-button-sm info-btn"
              @click="showTrendInfoDialog = true"
              v-tooltip.top="'Come viene calcolato'"
            />
          </div>
          <div class="trend-legend">
            <span class="legend-item legend-item--products"><span class="legend-dot"></span> Prodotti</span>
            <span class="legend-item legend-item--materials"><span class="legend-dot"></span> Materiali</span>
            <span class="legend-item legend-item--projected"><span class="legend-dot legend-dot--dashed"></span> Previsione</span>
          </div>
        </div>

        <!-- Trend Indicators -->
        <div class="trend-indicators" v-if="forecast?.trend">
          <div class="trend-badge" :class="getTrendClass(forecast.trend.products.direction)">
            <i :class="getTrendIcon(forecast.trend.products.direction)"></i>
            <span>Prodotti: {{ forecast.trend.products.weeklyGrowthRate > 0 ? '+' : '' }}{{ forecast.trend.products.weeklyGrowthRate }}%/sett</span>
          </div>
          <div class="trend-badge" :class="getTrendClass(forecast.trend.materials.direction)">
            <i :class="getTrendIcon(forecast.trend.materials.direction)"></i>
            <span>Materiali: {{ forecast.trend.materials.weeklyGrowthRate > 0 ? '+' : '' }}{{ forecast.trend.materials.weeklyGrowthRate }}%/sett</span>
          </div>
          <div class="trend-badge trend-badge--volatility" :class="'volatility-' + forecast.trend.products.volatility">
            <i class="pi pi-bolt"></i>
            <span>Volatilita: {{ forecast.trend.products.volatility === 'low' ? 'Bassa' : forecast.trend.products.volatility === 'medium' ? 'Media' : 'Alta' }}</span>
          </div>
        </div>

        <div class="trend-stats">
          <div class="trend-stat trend-stat--products">
            <span class="trend-stat__label">Prodotti (Costo)</span>
            <span class="trend-stat__value">{{ formatCurrency(forecast?.current?.productsCostValue || 0) }}</span>
          </div>
          <div class="trend-stat trend-stat--retail">
            <span class="trend-stat__label">Prodotti (Vendita)</span>
            <span class="trend-stat__value">{{ formatCurrency(forecast?.current?.productsRetailValue || 0) }}</span>
          </div>
          <div class="trend-stat trend-stat--margin">
            <span class="trend-stat__label">Margine Prodotti</span>
            <span class="trend-stat__value">
              {{ formatCurrency(forecast?.current?.productsMargin || 0) }}
              <span class="trend-stat__percent">({{ forecast?.current?.productsMarginPercent || 0 }}%)</span>
            </span>
          </div>
          <div class="trend-stat trend-stat--materials">
            <span class="trend-stat__label">Materiali</span>
            <span class="trend-stat__value">{{ formatCurrency(forecast?.current?.materialsValue || 0) }}</span>
          </div>
          <div class="trend-stat trend-stat--total">
            <span class="trend-stat__label">Totale (Costo)</span>
            <span class="trend-stat__value">{{ formatCurrency(forecast?.current?.totalCostValue || 0) }}</span>
          </div>
          <div class="trend-stat trend-stat--projected">
            <span class="trend-stat__label">Stima 60gg (Costo)</span>
            <span class="trend-stat__value">{{ formatCurrency((forecast?.scenarios?.baseline?.[forecast?.scenarios?.baseline?.length - 1]?.productsValue || 0) + (forecast?.scenarios?.baseline?.[forecast?.scenarios?.baseline?.length - 1]?.materialsValue || 0)) }}</span>
          </div>
        </div>
        <div class="trend-chart-container" v-if="!trendLoading">
          <Chart type="line" :data="globalTrendChartData" :options="globalTrendChartOptions" class="trend-chart" />
        </div>
        <div class="trend-loading" v-else>
          <i class="pi pi-spin pi-spinner"></i>
          <span>Caricamento...</span>
        </div>

        <!-- Timeline Legend compatta sotto il grafico -->
        <div class="timeline-legend" v-if="forecast?.timeline?.length">
          <div class="timeline-legend__header">
            <i class="pi pi-lightbulb"></i>
            <span>Azioni suggerite</span>
          </div>
          <div class="timeline-legend__items">
            <div
              v-for="event in forecast.timeline"
              :key="event.date"
              class="timeline-event"
              :class="'timeline-event--' + event.urgency"
              @click="openTimelineActionDialog(event)"
            >
              <span class="timeline-date">{{ event.label }}</span>
              <span class="timeline-summary">{{ formatTimelineSummary(event) }}</span>
              <i class="pi pi-chevron-right timeline-chevron"></i>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Dead Stock Alert Section -->
    <section class="dead-stock-section" v-if="forecast?.deadStock?.length">
      <div class="dead-stock-card">
        <div class="dead-stock-header">
          <div class="dead-stock-title">
            <i class="pi pi-exclamation-circle"></i>
            <span>Prodotti Fermi (Dead Stock)</span>
            <Badge :value="forecast.deadStock.length" severity="warning" />
          </div>
          <div class="dead-stock-subtitle">
            Prodotti con giacenza ma nessun ordine negli ultimi 90 giorni. Considera promozioni o sconti.
          </div>
        </div>
        <div class="dead-stock-list">
          <div
            v-for="item in forecast.deadStock.slice(0, showAllDeadStock ? undefined : 5)"
            :key="item.id"
            class="dead-stock-item"
          >
            <div class="dead-stock-item__info">
              <span class="dead-stock-item__sku">{{ item.sku }}</span>
              <span class="dead-stock-item__name">{{ item.name }}</span>
            </div>
            <div class="dead-stock-item__stats">
              <span class="dead-stock-item__qty">{{ item.quantity }} pz</span>
              <span class="dead-stock-item__value">{{ formatCurrency(item.value) }}</span>
              <Tag
                :value="item.daysSinceLastOrder ? `${item.daysSinceLastOrder}gg` : 'Mai venduto'"
                :severity="item.daysSinceLastOrder === null ? 'danger' : 'warning'"
                class="dead-stock-item__days"
              />
            </div>
          </div>
        </div>
        <div class="dead-stock-footer" v-if="forecast.deadStock.length > 5">
          <Button
            :label="showAllDeadStock ? 'Mostra meno' : `Mostra tutti (${forecast.deadStock.length})`"
            :icon="showAllDeadStock ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
            class="p-button-text p-button-sm"
            @click="showAllDeadStock = !showAllDeadStock"
          />
        </div>
        <div class="dead-stock-total">
          <span>Valore totale bloccato:</span>
          <strong>{{ formatCurrency(forecast.deadStock.reduce((sum: number, item: any) => sum + item.value, 0)) }}</strong>
        </div>
      </div>
    </section>

    <!-- Tabs Section -->
    <section class="tabs-section">
      <TabView v-model:activeIndex="activeTab" @tab-change="onTabChange">
        <!-- Products Tab -->
        <TabPanel>
          <template #header>
            <div class="tab-header">
              <i class="pi pi-box"></i>
              <span>Prodotti</span>
              <Badge :value="filterStats.totalItems" v-if="activeTab === 0" />
            </div>
          </template>

          <!-- Smart Filter Cards -->
          <div class="filter-cards-grid">
            <div
              class="filter-card"
              :class="{ 'filter-card--active': selectedStatusFilter === null }"
              @click="setStatusFilter(null)"
              v-tooltip.bottom="'Mostra tutti i prodotti'"
            >
              <div class="filter-card__icon filter-card__icon--all">
                <i class="pi pi-th-large"></i>
              </div>
              <div class="filter-card__content">
                <span class="filter-card__value">{{ filterStats.totalItems }}</span>
                <span class="filter-card__label">Tutti</span>
              </div>
            </div>

            <div
              class="filter-card"
              :class="{ 'filter-card--active': selectedStatusFilter === 'CRITICAL' }"
              @click="setStatusFilter('CRITICAL')"
              v-tooltip.bottom="'Esauriti o sotto scorta minima. Riordinare subito!'"
            >
              <div class="filter-card__icon filter-card__icon--critical">
                <i class="pi pi-exclamation-triangle"></i>
              </div>
              <div class="filter-card__content">
                <span class="filter-card__value">{{ filterStats.critical }}</span>
                <span class="filter-card__label">Critici</span>
              </div>
            </div>

            <div
              class="filter-card"
              :class="{ 'filter-card--active': selectedStatusFilter === 'LOW' }"
              @click="setStatusFilter('LOW')"
              v-tooltip.bottom="'Sotto il punto di riordino configurato'"
            >
              <div class="filter-card__icon filter-card__icon--low">
                <i class="pi pi-exclamation-circle"></i>
              </div>
              <div class="filter-card__content">
                <span class="filter-card__value">{{ filterStats.low }}</span>
                <span class="filter-card__label">Bassi</span>
              </div>
            </div>

            <div
              class="filter-card"
              :class="{ 'filter-card--active': selectedStatusFilter === 'REORDER_SOON' }"
              @click="setStatusFilter('REORDER_SOON')"
              v-tooltip.bottom="'Finiranno entro 30 giorni (basato su vendite storiche)'"
            >
              <div class="filter-card__icon filter-card__icon--reorder">
                <i class="pi pi-clock"></i>
              </div>
              <div class="filter-card__content">
                <span class="filter-card__value">{{ filterStats.reorderSoon }}</span>
                <span class="filter-card__label">Da riordinare</span>
              </div>
            </div>

            <div
              class="filter-card"
              :class="{ 'filter-card--active': selectedStatusFilter === 'OK' }"
              @click="setStatusFilter('OK')"
              v-tooltip.bottom="'Stock sufficiente, nessuna azione richiesta'"
            >
              <div class="filter-card__icon filter-card__icon--ok">
                <i class="pi pi-check-circle"></i>
              </div>
              <div class="filter-card__content">
                <span class="filter-card__value">{{ filterStats.ok }}</span>
                <span class="filter-card__label">OK</span>
              </div>
            </div>
          </div>

          <!-- Products Table -->
          <div class="table-card">
            <div class="table-toolbar">
              <div class="search-wrapper">
                <i class="pi pi-search search-icon"></i>
                <InputText
                  v-model="search"
                  placeholder="Cerca prodotto..."
                  @input="debouncedLoadData"
                  class="search-input"
                />
              </div>
              <div class="toolbar-filters">
                <Dropdown
                  v-model="selectedLocation"
                  :options="locations"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Tutte le location"
                  @change="loadData"
                  showClear
                  class="filter-dropdown"
                />
              </div>
            </div>

            <DataTable
              :value="inventory"
              :loading="loading"
              :lazy="true"
              :paginator="true"
              :rows="rowsPerPage"
              :totalRecords="totalRecords"
              :first="first"
              @page="onPage"
              responsiveLayout="scroll"
              class="custom-table"
              :rowHover="true"
              paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
              :rowsPerPageOptions="[20, 50, 100]"
            >
              <Column field="product.sku" header="SKU" style="min-width: 120px">
                <template #body="{ data }">
                  <span class="sku-badge">{{ data.product?.sku }}</span>
                </template>
              </Column>
              <Column field="product.name" header="Prodotto" style="min-width: 180px">
                <template #body="{ data }">
                  <span class="product-name">{{ data.product?.name }}</span>
                </template>
              </Column>
              <Column field="location" header="Location" style="min-width: 110px">
                <template #body="{ data }">
                  <Tag severity="info" class="location-tag">{{ getLocationLabel(data.location) }}</Tag>
                </template>
              </Column>
              <Column header="Disponibile" style="min-width: 100px">
                <template #body="{ data }">
                  <span class="available-qty" :class="{ 'available-qty--low': data.available <= 5 }">
                    {{ data.available }} pz
                  </span>
                </template>
              </Column>
              <Column header="Status" style="min-width: 120px">
                <template #body="{ data }">
                  <Tag :severity="getStatusSeverity(data.prediction?.status)" class="status-tag">
                    <i :class="getStatusIcon(data.prediction?.status)" class="status-icon"></i>
                    {{ getStatusLabel(data.prediction?.status) }}
                  </Tag>
                </template>
              </Column>
              <Column header="Previsione" style="min-width: 140px">
                <template #body="{ data }">
                  <div class="prediction-cell" v-if="data.prediction">
                    <template v-if="data.prediction.daysUntilOutOfStock !== null">
                      <span class="prediction-days" :class="getPredictionClass(data.prediction)">
                        ~{{ data.prediction.daysUntilOutOfStock }} giorni
                      </span>
                    </template>
                    <template v-else>
                      <span class="prediction-na">N/D</span>
                    </template>
                  </div>
                </template>
              </Column>
              <Column header="Azioni" style="min-width: 150px">
                <template #body="{ data }">
                  <div class="action-buttons">
                    <Button
                      icon="pi pi-history"
                      class="p-button-rounded p-button-text action-btn"
                      @click="viewMovementHistory(data)"
                      v-tooltip.top="'Storico Movimenti'"
                    />
                    <Button
                      icon="pi pi-arrows-h"
                      class="p-button-rounded p-button-text action-btn"
                      @click="transferStock(data)"
                      v-tooltip.top="'Trasferisci'"
                    />
                    <Button
                      icon="pi pi-chart-line"
                      class="p-button-rounded p-button-text action-btn action-btn--chart"
                      @click="viewPredictionDetails(data, 'PRODUCT')"
                      v-tooltip.top="'Previsione'"
                    />
                  </div>
                </template>
              </Column>
              <template #empty>
                <div class="empty-state">
                  <i class="pi pi-inbox empty-state__icon"></i>
                  <p class="empty-state__text">Nessun prodotto trovato</p>
                </div>
              </template>
            </DataTable>
          </div>
        </TabPanel>

        <!-- Materials Tab -->
        <TabPanel>
          <template #header>
            <div class="tab-header">
              <i class="pi pi-cog"></i>
              <span>Materiali</span>
              <Badge :value="materialStats.totalItems" v-if="activeTab === 1" />
            </div>
          </template>

          <!-- Smart Filter Cards for Materials -->
          <div class="filter-cards-grid">
            <div
              class="filter-card"
              :class="{ 'filter-card--active': selectedStatusFilter === null }"
              @click="setStatusFilter(null)"
            >
              <div class="filter-card__icon filter-card__icon--all">
                <i class="pi pi-th-large"></i>
              </div>
              <div class="filter-card__content">
                <span class="filter-card__value">{{ materialStats.totalItems }}</span>
                <span class="filter-card__label">Tutti</span>
              </div>
            </div>

            <div
              class="filter-card"
              :class="{ 'filter-card--active': selectedStatusFilter === 'CRITICAL' }"
              @click="setStatusFilter('CRITICAL')"
            >
              <div class="filter-card__icon filter-card__icon--critical">
                <i class="pi pi-exclamation-triangle"></i>
              </div>
              <div class="filter-card__content">
                <span class="filter-card__value">{{ materialStats.critical }}</span>
                <span class="filter-card__label">Critici</span>
              </div>
            </div>

            <div
              class="filter-card"
              :class="{ 'filter-card--active': selectedStatusFilter === 'LOW' }"
              @click="setStatusFilter('LOW')"
            >
              <div class="filter-card__icon filter-card__icon--low">
                <i class="pi pi-exclamation-circle"></i>
              </div>
              <div class="filter-card__content">
                <span class="filter-card__value">{{ materialStats.low }}</span>
                <span class="filter-card__label">Bassi</span>
              </div>
            </div>

            <div
              class="filter-card"
              :class="{ 'filter-card--active': selectedStatusFilter === 'REORDER_SOON' }"
              @click="setStatusFilter('REORDER_SOON')"
            >
              <div class="filter-card__icon filter-card__icon--reorder">
                <i class="pi pi-clock"></i>
              </div>
              <div class="filter-card__content">
                <span class="filter-card__value">{{ materialStats.reorderSoon }}</span>
                <span class="filter-card__label">Da riordinare</span>
              </div>
            </div>

            <div
              class="filter-card"
              :class="{ 'filter-card--active': selectedStatusFilter === 'OK' }"
              @click="setStatusFilter('OK')"
            >
              <div class="filter-card__icon filter-card__icon--ok">
                <i class="pi pi-check-circle"></i>
              </div>
              <div class="filter-card__content">
                <span class="filter-card__value">{{ materialStats.ok }}</span>
                <span class="filter-card__label">OK</span>
              </div>
            </div>
          </div>

          <!-- Materials Table -->
          <div class="table-card">
            <div class="table-toolbar">
              <div class="search-wrapper">
                <i class="pi pi-search search-icon"></i>
                <InputText
                  v-model="materialSearch"
                  placeholder="Cerca materiale..."
                  @input="debouncedLoadMaterials"
                  class="search-input"
                />
              </div>
              <div class="toolbar-filters">
                <Dropdown
                  v-model="selectedCategory"
                  :options="categories"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Tutte le categorie"
                  @change="loadMaterials"
                  showClear
                  class="filter-dropdown"
                />
              </div>
            </div>

            <DataTable
              :value="materials"
              :loading="materialsLoading"
              :lazy="true"
              :paginator="true"
              :rows="materialRowsPerPage"
              :totalRecords="materialTotalRecords"
              :first="materialFirst"
              @page="onMaterialPage"
              responsiveLayout="scroll"
              class="custom-table"
              :rowHover="true"
              paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
              :rowsPerPageOptions="[20, 50, 100]"
            >
              <Column field="sku" header="SKU" style="min-width: 120px">
                <template #body="{ data }">
                  <span class="sku-badge sku-badge--material">{{ data.sku }}</span>
                </template>
              </Column>
              <Column field="name" header="Materiale" style="min-width: 180px">
                <template #body="{ data }">
                  <span class="product-name">{{ data.name }}</span>
                </template>
              </Column>
              <Column field="category" header="Categoria" style="min-width: 110px">
                <template #body="{ data }">
                  <Tag severity="secondary" class="category-tag" v-if="data.category">{{ data.category }}</Tag>
                  <span v-else class="text-muted">-</span>
                </template>
              </Column>
              <Column header="Disponibile" style="min-width: 100px">
                <template #body="{ data }">
                  <span class="available-qty" :class="{ 'available-qty--low': data.available <= data.minStock }">
                    {{ data.available }} {{ data.unit }}
                  </span>
                </template>
              </Column>
              <Column header="Status" style="min-width: 120px">
                <template #body="{ data }">
                  <Tag :severity="getStatusSeverity(data.prediction?.status)" class="status-tag">
                    <i :class="getStatusIcon(data.prediction?.status)" class="status-icon"></i>
                    {{ getStatusLabel(data.prediction?.status) }}
                  </Tag>
                </template>
              </Column>
              <Column header="Previsione" style="min-width: 140px">
                <template #body="{ data }">
                  <div class="prediction-cell" v-if="data.prediction">
                    <template v-if="data.prediction.daysUntilOutOfStock !== null">
                      <span class="prediction-days" :class="getMaterialPredictionClass(data.prediction)">
                        ~{{ data.prediction.daysUntilOutOfStock }} giorni
                      </span>
                    </template>
                    <template v-else>
                      <span class="prediction-na">N/D</span>
                    </template>
                  </div>
                </template>
              </Column>
              <Column header="Azioni" style="min-width: 80px">
                <template #body="{ data }">
                  <div class="action-buttons">
                    <Button
                      icon="pi pi-chart-line"
                      class="p-button-rounded p-button-text action-btn action-btn--chart"
                      @click="viewPredictionDetails(data, 'MATERIAL')"
                      v-tooltip.top="'Previsione'"
                    />
                  </div>
                </template>
              </Column>
              <template #empty>
                <div class="empty-state">
                  <i class="pi pi-inbox empty-state__icon"></i>
                  <p class="empty-state__text">Nessun materiale trovato</p>
                </div>
              </template>
            </DataTable>
          </div>
        </TabPanel>
      </TabView>
    </section>

    <!-- Dialogs -->
    <MovementDialog v-model="showMovementDialog" @saved="onMovementSaved" />
    <TransferDialog v-model="showTransferDialog" :inventory-item="selectedItem" @saved="onMovementSaved" />
    <BarcodeScannerDialog v-model="showScannerDialog" @saved="onMovementSaved" />
    <MovementHistoryDialog v-model="showHistoryDialog" :inventory-item="selectedItemForHistory" />

    <!-- Prediction Detail Dialog -->
    <Dialog
      v-model:visible="showPredictionDialog"
      header="Andamento Stock e Previsione"
      :modal="true"
      :style="{ width: '900px', maxWidth: '95vw' }"
    >
      <div class="prediction-detail" v-if="selectedItem">
        <div class="prediction-product">
          <Tag :severity="selectedItemType === 'PRODUCT' ? 'info' : 'warning'" class="type-badge">
            {{ selectedItemType === 'PRODUCT' ? 'Prodotto' : 'Materiale' }}
          </Tag>
          <span class="prediction-product__sku">{{ selectedItem.sku || selectedItem.product?.sku }}</span>
          <span class="prediction-product__name">{{ selectedItem.name || selectedItem.product?.name }}</span>
        </div>

        <!-- Chart Section -->
        <div class="chart-section">
          <div class="chart-header">
            <span class="chart-title">Andamento Giacenza</span>
            <div class="chart-legend">
              <span class="legend-item legend-item--actual"><span class="legend-dot"></span> Storico</span>
              <span class="legend-item legend-item--projected"><span class="legend-dot"></span> Proiezione</span>
            </div>
          </div>
          <div class="chart-container" v-if="!chartLoading">
            <Chart type="line" :data="chartData" :options="chartOptions" class="stock-chart" />
          </div>
          <div class="chart-loading" v-else>
            <i class="pi pi-spin pi-spinner"></i>
            <span>Caricamento grafico...</span>
          </div>
        </div>

        <Divider />

        <!-- Stats Grid -->
        <div class="prediction-stats" v-if="selectedPrediction">
          <div class="prediction-stat">
            <span class="prediction-stat__label">Giacenza attuale</span>
            <span class="prediction-stat__value prediction-stat__value--large">
              {{ selectedItem.available }} {{ selectedItemType === 'MATERIAL' ? selectedItem.unit : 'pz' }}
            </span>
          </div>
          <div class="prediction-stat">
            <span class="prediction-stat__label">{{ selectedItemType === 'MATERIAL' ? 'Consumo' : 'Vendite' }} giornaliere</span>
            <span class="prediction-stat__value">{{ selectedPrediction.avgDailySales || selectedPrediction.avgDailyConsumption }}/giorno</span>
          </div>
          <div class="prediction-stat">
            <span class="prediction-stat__label">{{ selectedItemType === 'MATERIAL' ? 'Consumo' : 'Vendite' }} settimanali</span>
            <span class="prediction-stat__value">{{ selectedPrediction.avgWeeklySales || selectedPrediction.avgWeeklyConsumption }}/sett</span>
          </div>
          <div class="prediction-stat">
            <span class="prediction-stat__label">{{ selectedItemType === 'MATERIAL' ? 'Consumo' : 'Vendite' }} mensili</span>
            <span class="prediction-stat__value">{{ selectedPrediction.avgMonthlySales || selectedPrediction.avgMonthlyConsumption }}/mese</span>
          </div>
        </div>

        <!-- Forecast Info -->
        <div class="prediction-forecast" v-if="selectedPrediction">
          <div class="forecast-item forecast-item--warning" v-if="selectedPrediction.daysUntilOutOfStock !== null">
            <i class="pi pi-calendar-times forecast-icon"></i>
            <div class="forecast-content">
              <span class="forecast-label">Stima esaurimento</span>
              <span class="forecast-value">
                {{ formatDate(selectedPrediction.estimatedOutOfStockDate) }}
                <Tag :severity="selectedPrediction.daysUntilOutOfStock <= 30 ? 'danger' : 'warning'" class="forecast-tag">
                  ~{{ selectedPrediction.daysUntilOutOfStock }} giorni
                </Tag>
              </span>
            </div>
          </div>
          <div class="forecast-item forecast-item--success" v-if="selectedPrediction.suggestedReorderDate">
            <i class="pi pi-shopping-cart forecast-icon"></i>
            <div class="forecast-content">
              <span class="forecast-label">Data riordino suggerita</span>
              <span class="forecast-value forecast-value--highlight">
                {{ formatDate(selectedPrediction.suggestedReorderDate) }}
              </span>
            </div>
          </div>
        </div>

        <Message :severity="getStatusSeverity(selectedPrediction?.status)" class="prediction-message" v-if="selectedPrediction">
          {{ selectedPrediction.statusMessage }}
        </Message>
      </div>

      <template #footer>
        <Button label="Chiudi" icon="pi pi-times" class="p-button-text" @click="showPredictionDialog = false" />
      </template>
    </Dialog>

    <!-- Trend Info Dialog -->
    <Dialog
      v-model:visible="showTrendInfoDialog"
      header="Come viene calcolata la proiezione"
      :modal="true"
      :style="{ width: '500px', maxWidth: '95vw' }"
    >
      <div class="info-dialog-content">
        <div class="info-section">
          <h4><i class="pi pi-chart-line"></i> Storico (linee continue)</h4>
          <p>
            Le linee <strong style="color: rgb(59, 130, 246);">blu</strong> (prodotti) e
            <strong style="color: rgb(245, 158, 11);">arancione</strong> (materiali) mostrano
            l'andamento del valore del magazzino negli ultimi <strong>60 giorni</strong>.
          </p>
          <p>
            Il valore viene calcolato come: <code>quantita disponibile x costo unitario</code>
            per ogni prodotto/materiale.
          </p>
        </div>

        <Divider />

        <div class="info-section">
          <h4><i class="pi pi-forward"></i> Proiezione (linee tratteggiate)</h4>
          <p>
            Le linee <strong>tratteggiate</strong> mostrano la proiezione del valore per i
            prossimi <strong>60 giorni</strong>, separate per categoria:
          </p>
          <ul>
            <li><strong style="color: rgb(59, 130, 246);">Prodotti:</strong> basata sui movimenti di vendita (OUT)</li>
            <li><strong style="color: rgb(245, 158, 11);">Materiali:</strong> basata sul consumo in produzione</li>
          </ul>
          <p>
            Ogni linea continua dal suo valore storico, mostrando come scendera
            se non si interviene con riordini o produzioni.
          </p>
        </div>

        <Divider />

        <div class="info-section info-section--note">
          <h4><i class="pi pi-info-circle"></i> Nota</h4>
          <p>
            La proiezione assume che il tasso di consumo/vendita rimanga costante.
            Variazioni stagionali, promozioni o cambi di produzione non sono considerati.
          </p>
        </div>
      </div>

      <template #footer>
        <Button label="Ho capito" icon="pi pi-check" @click="showTrendInfoDialog = false" />
      </template>
    </Dialog>

    <!-- Timeline Action Detail Dialog -->
    <Dialog
      v-model:visible="showTimelineActionDialog"
      :header="selectedTimelineEvent ? `Azioni suggerite per il ${selectedTimelineEvent.label}` : 'Azioni suggerite'"
      :modal="true"
      :style="{ width: '550px', maxWidth: '95vw' }"
    >
      <div class="timeline-action-dialog" v-if="selectedTimelineEvent">
        <!-- Urgency badge -->
        <div class="timeline-action-urgency" :class="'timeline-action-urgency--' + selectedTimelineEvent.urgency">
          <i :class="getUrgencyIcon(selectedTimelineEvent.urgency)"></i>
          <span>{{ getUrgencyLabel(selectedTimelineEvent.urgency) }}</span>
        </div>

        <!-- Actions list -->
        <div class="timeline-action-groups">
          <div
            v-for="(action, actionIndex) in selectedTimelineEvent.actions"
            :key="actionIndex"
            class="timeline-action-group"
          >
            <div class="timeline-action-group__header">
              <i :class="action.type === 'REORDER' ? 'pi pi-shopping-cart' : 'pi pi-cog'"></i>
              <span>{{ action.type === 'REORDER' ? 'Da riordinare' : 'Da produrre' }}</span>
              <Badge :value="action.items?.length || 0" severity="info" />
            </div>
            <div class="timeline-action-items">
              <div
                v-for="item in action.items"
                :key="item.id"
                class="timeline-action-item"
              >
                <div class="timeline-action-item__info">
                  <span class="timeline-action-item__name">{{ item.name }}</span>
                </div>
                <div class="timeline-action-item__qty">
                  <strong>{{ item.quantity }}</strong> {{ item.unit || 'pz' }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <Button label="Chiudi" icon="pi pi-times" class="p-button-text" @click="showTimelineActionDialog = false" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Tag from 'primevue/tag';
import Badge from 'primevue/badge';
import Dialog from 'primevue/dialog';
import Divider from 'primevue/divider';
import Message from 'primevue/message';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import Chart from 'primevue/chart';
import { Chart as ChartJS } from 'chart.js';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';
import PageHeader from '../components/PageHeader.vue';
import MovementDialog from '../components/MovementDialog.vue';
import TransferDialog from '../components/TransferDialog.vue';
import BarcodeScannerDialog from '../components/BarcodeScannerDialog.vue';
import MovementHistoryDialog from '../components/MovementHistoryDialog.vue';

// Plugin custom per marker verticali timeline sul grafico
const timelineMarkersPlugin = {
  id: 'timelineMarkers',
  afterDatasetsDraw(chart: any) {
    const { ctx, scales, chartArea } = chart;
    const timeline = chart.options.plugins?.timelineMarkers?.data || [];

    if (!timeline.length || !scales.x) return;

    timeline.forEach((event: any) => {
      // Trova la posizione X per questa data (label)
      const labelIndex = chart.data.labels?.findIndex((l: string) => l === event.label);
      if (labelIndex === -1 || labelIndex === undefined) return;

      const xPos = scales.x.getPixelForValue(labelIndex);
      if (xPos < chartArea.left || xPos > chartArea.right) return;

      // Colore in base a urgency
      const colors: Record<string, string> = {
        critical: '#EF4444',
        warning: '#F59E0B',
        info: '#3B82F6'
      };
      const color = colors[event.urgency] || colors.info;

      // Linea verticale tratteggiata
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(xPos, chartArea.top);
      ctx.lineTo(xPos, chartArea.bottom);
      ctx.stroke();
      ctx.restore();

      // Marker punto in cima
      ctx.beginPath();
      ctx.arc(xPos, chartArea.top + 12, 8, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Numero azioni nel badge
      const totalActions = event.actions?.reduce((sum: number, a: any) => sum + (a.items?.length || 0), 0) || 0;
      ctx.fillStyle = 'white';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(totalActions), xPos, chartArea.top + 12);
    });
  }
};

// Registra il plugin
ChartJS.register(timelineMarkersPlugin);

const toast = useToast();

// Tab state
const activeTab = ref(0);

// Global Trend / Forecast
const globalTrend = ref<any>(null);
const forecast = ref<any>(null);
const trendLoading = ref(false);

// Products state
const loading = ref(false);
const inventory = ref<any[]>([]);
const search = ref('');
const selectedLocation = ref<string | null>(null);
const selectedStatusFilter = ref<string | null>(null);
const first = ref(0);
const rowsPerPage = ref(20);
const totalRecords = ref(0);
const filterStats = ref({ totalItems: 0, critical: 0, low: 0, ok: 0, overstocked: 0, reorderSoon: 0 });

// Materials state
const materialsLoading = ref(false);
const materials = ref<any[]>([]);
const materialSearch = ref('');
const selectedCategory = ref<string | null>(null);
const materialFirst = ref(0);
const materialRowsPerPage = ref(20);
const materialTotalRecords = ref(0);
const materialStats = ref({ totalItems: 0, critical: 0, low: 0, ok: 0, overstocked: 0, reorderSoon: 0 });
const categories = ref<Array<{ label: string; value: string }>>([]);

// Dialogs
const showMovementDialog = ref(false);
const showTransferDialog = ref(false);
const showScannerDialog = ref(false);
const showPredictionDialog = ref(false);
const showTrendInfoDialog = ref(false);
const showTimelineActionDialog = ref(false);
const showHistoryDialog = ref(false);
const selectedItem = ref<any>(null);
const selectedItemForHistory = ref<any>(null);
const selectedItemType = ref<'PRODUCT' | 'MATERIAL'>('PRODUCT');
const selectedPrediction = ref<any>(null);
const selectedTimelineEvent = ref<any>(null);
const showAllDeadStock = ref(false);

// Chart
const chartLoading = ref(false);
const stockHistory = ref<any[]>([]);

const locations = [
  { label: 'Magazzino Web', value: 'WEB' },
  { label: 'Magazzino B2B', value: 'B2B' },
  { label: 'Magazzino Eventi', value: 'EVENTI' },
  { label: 'In Transito', value: 'TRANSITO' },
];

// Helpers
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
};

const getLocationLabel = (value: string) => locations.find(l => l.value === value)?.label || value;

const getStatusSeverity = (status?: string) => {
  switch (status) {
    case 'CRITICAL': return 'danger';
    case 'LOW': return 'warning';
    case 'OK': return 'success';
    case 'OVERSTOCKED': return 'info';
    default: return 'secondary';
  }
};

const getStatusIcon = (status?: string) => {
  switch (status) {
    case 'CRITICAL': return 'pi pi-exclamation-triangle';
    case 'LOW': return 'pi pi-exclamation-circle';
    case 'OK': return 'pi pi-check-circle';
    case 'OVERSTOCKED': return 'pi pi-inbox';
    default: return 'pi pi-question-circle';
  }
};

const getStatusLabel = (status?: string) => {
  switch (status) {
    case 'CRITICAL': return 'Critico';
    case 'LOW': return 'Basso';
    case 'OK': return 'OK';
    case 'OVERSTOCKED': return 'Sovraccarico';
    default: return 'N/D';
  }
};

const getPredictionClass = (prediction: any) => {
  if (!prediction?.daysUntilOutOfStock) return '';
  if (prediction.daysUntilOutOfStock <= 14) return 'prediction-days--critical';
  if (prediction.daysUntilOutOfStock <= 30) return 'prediction-days--warning';
  return 'prediction-days--ok';
};

const getMaterialPredictionClass = getPredictionClass;

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return 'N/D';
  return new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
};

// Chart computed
const chartData = computed(() => {
  if (stockHistory.value.length === 0) return { labels: [], datasets: [] };

  const actualData = stockHistory.value.filter(h => h.type === 'actual');
  const projectedData = stockHistory.value.filter(h => h.type === 'projected');
  const sampleRate = Math.max(1, Math.floor(actualData.length / 30));
  const sampledActual = actualData.filter((_, i) => i % sampleRate === 0 || i === actualData.length - 1);
  const lastActual = actualData[actualData.length - 1];
  const allDates = [...sampledActual, ...projectedData];
  const labels = allDates.map(d => new Date(d.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }));
  const actualValues = sampledActual.map(d => d.quantity);
  const actualPadded = [...actualValues, ...new Array(projectedData.length).fill(null)];
  const projectedValues = projectedData.map(d => d.quantity);
  const projectedPadded = [...new Array(sampledActual.length - 1).fill(null), lastActual?.quantity, ...projectedValues];

  return {
    labels,
    datasets: [
      { label: 'Storico', data: actualPadded, fill: true, backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgb(59, 130, 246)', borderWidth: 2, tension: 0.3, pointRadius: 0 },
      { label: 'Proiezione', data: projectedPadded, fill: true, backgroundColor: 'rgba(249, 115, 22, 0.1)', borderColor: 'rgb(249, 115, 22)', borderWidth: 2, borderDash: [5, 5], tension: 0.3, pointRadius: 0 },
    ],
  };
});

const chartOptions = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(0,0,0,0.8)' } },
  scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } } },
};

// Global Trend Chart with Multi-Scenario
const globalTrendChartData = computed(() => {
  // Use forecast data if available, otherwise fallback to trend
  const historyData = forecast.value?.history || globalTrend.value?.history || [];
  const scenarios = forecast.value?.scenarios;

  if (!historyData.length) return { labels: [], datasets: [] };

  // Sample history data
  const sampleRate = Math.max(1, Math.floor(historyData.length / 25));
  const sampledHistory = historyData.filter((_: any, i: number) => i % sampleRate === 0 || i === historyData.length - 1);
  const lastHistory = historyData[historyData.length - 1];

  // Sample scenario data (baseline per proiezione separata)
  const baselineData = scenarios?.baseline || [];
  const scenarioSampleRate = Math.max(1, Math.floor(baselineData.length / 15));
  const sampledBaseline = baselineData.filter((_: any, i: number) => i % scenarioSampleRate === 0 || i === baselineData.length - 1);

  const allDates = [...sampledHistory, ...sampledBaseline];
  const labels = allDates.map((d: any) => new Date(d.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }));

  // Products values (history) - linea continua
  const productsHistory = sampledHistory.map((d: any) => d.productsValue);
  const productsHistoryPadded = [...productsHistory, ...new Array(sampledBaseline.length).fill(null)];

  // Materials values (history) - linea continua
  const materialsHistory = sampledHistory.map((d: any) => d.materialsValue);
  const materialsHistoryPadded = [...materialsHistory, ...new Array(sampledBaseline.length).fill(null)];

  // Products projection (baseline) - linea tratteggiata che continua da storico
  const productsProjection = sampledBaseline.map((d: any) => d.productsValue);
  const productsProjectionPadded = [...new Array(sampledHistory.length - 1).fill(null), lastHistory?.productsValue, ...productsProjection];

  // Materials projection (baseline) - linea tratteggiata che continua da storico
  const materialsProjection = sampledBaseline.map((d: any) => d.materialsValue);
  const materialsProjectionPadded = [...new Array(sampledHistory.length - 1).fill(null), lastHistory?.materialsValue, ...materialsProjection];

  return {
    labels,
    datasets: [
      // Storico Prodotti (blu, solido)
      {
        label: 'Prodotti',
        data: productsHistoryPadded,
        fill: true,
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 0,
      },
      // Proiezione Prodotti (blu, tratteggiato)
      {
        label: 'Prodotti (prev.)',
        data: productsProjectionPadded,
        fill: true,
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 2,
        borderDash: [6, 4],
        tension: 0.3,
        pointRadius: 0,
      },
      // Storico Materiali (arancione, solido)
      {
        label: 'Materiali',
        data: materialsHistoryPadded,
        fill: true,
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        borderColor: 'rgb(245, 158, 11)',
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 0,
      },
      // Proiezione Materiali (arancione, tratteggiato)
      {
        label: 'Materiali (prev.)',
        data: materialsProjectionPadded,
        fill: true,
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        borderColor: 'rgb(245, 158, 11)',
        borderWidth: 2,
        borderDash: [6, 4],
        tension: 0.3,
        pointRadius: 0,
      },
    ],
  };
});

const globalTrendChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: { display: false },
    // Passa i dati timeline al plugin custom per i marker verticali
    timelineMarkers: {
      data: forecast.value?.timeline || []
    },
    tooltip: {
      backgroundColor: 'rgba(0,0,0,0.9)',
      padding: 16,
      titleFont: { size: 14, weight: 'bold' as const },
      bodyFont: { size: 12 },
      callbacks: {
        label: (context: any) => {
          const value = context.raw;
          if (value === null) return '';
          return `${context.dataset.label}: ${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value)}`;
        },
        // Mostra le azioni timeline se la data corrisponde
        afterBody: (context: any) => {
          const label = context[0]?.label;
          if (!label || !forecast.value?.timeline) return '';

          const event = forecast.value.timeline.find((t: any) => t.label === label);
          if (!event) return '';

          const lines: string[] = ['', '─── AZIONI ───'];
          event.actions.forEach((action: any) => {
            lines.push(`${action.type === 'REORDER' ? '📦 Riordina:' : '🔨 Produci:'}`);
            action.items.slice(0, 3).forEach((item: any) => {
              lines.push(`  • ${item.name} (${item.quantity} ${item.unit || 'pz'})`);
            });
            if (action.items.length > 3) {
              lines.push(`  ... e altri ${action.items.length - 3}`);
            }
          });
          return lines;
        }
      },
    },
  },
  scales: {
    x: { grid: { display: false } },
    y: {
      beginAtZero: false,
      grid: { color: 'rgba(0,0,0,0.05)' },
      ticks: {
        callback: (value: number) => {
          if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
          return value;
        },
      },
    },
  },
}));

// Debounce
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
const debouncedLoadData = () => { if (searchTimeout) clearTimeout(searchTimeout); searchTimeout = setTimeout(() => { first.value = 0; loadData(); }, 300); };
const debouncedLoadMaterials = () => { if (searchTimeout) clearTimeout(searchTimeout); searchTimeout = setTimeout(() => { materialFirst.value = 0; loadMaterials(); }, 300); };

// Load functions
const loadGlobalTrend = async () => {
  try {
    trendLoading.value = true;
    // Load both trend and forecast data
    const [trendResponse, forecastResponse] = await Promise.all([
      api.get('/inventory/trend'),
      api.get('/inventory/forecast?daysHistory=90&daysProjection=60')
    ]);
    if (trendResponse.success) globalTrend.value = trendResponse.data;
    if (forecastResponse.success) forecast.value = forecastResponse.data;
  } catch (e) { console.error('Error loading trend/forecast', e); }
  finally { trendLoading.value = false; }
};

// Timeline helper: riassume le azioni raggruppate per una data
const formatTimelineSummary = (event: any) => {
  const parts: string[] = [];
  event.actions?.forEach((action: any) => {
    const count = action.items?.length || 0;
    if (action.type === 'REORDER') {
      parts.push(`Riordina ${count} mat.`);
    } else if (action.type === 'PRODUCE') {
      parts.push(`Produci ${count} prod.`);
    }
  });
  return parts.join(' + ');
};

// Timeline: apre il dialog con i dettagli delle azioni
const openTimelineActionDialog = (event: any) => {
  selectedTimelineEvent.value = event;
  showTimelineActionDialog.value = true;
};

// Timeline: icona per livello urgenza
const getUrgencyIcon = (urgency: string) => {
  if (urgency === 'critical') return 'pi pi-exclamation-triangle';
  if (urgency === 'warning') return 'pi pi-exclamation-circle';
  return 'pi pi-info-circle';
};

// Timeline: label per livello urgenza
const getUrgencyLabel = (urgency: string) => {
  if (urgency === 'critical') return 'Urgente - Azione immediata richiesta';
  if (urgency === 'warning') return 'Attenzione - Pianifica a breve';
  return 'Informativo - Da considerare';
};

const getTrendIcon = (direction: string) => {
  if (direction === 'increasing') return 'pi pi-arrow-up';
  if (direction === 'decreasing') return 'pi pi-arrow-down';
  return 'pi pi-minus';
};

const getTrendClass = (direction: string) => {
  if (direction === 'increasing') return 'trend-badge--increasing';
  if (direction === 'decreasing') return 'trend-badge--decreasing';
  return 'trend-badge--stable';
};

const formatShortDate = (dateStr: string) => {
  if (!dateStr) return 'N/D';
  return new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
};

const loadData = async () => {
  try {
    loading.value = true;
    const params = new URLSearchParams({ page: String(Math.floor(first.value / rowsPerPage.value) + 1), limit: String(rowsPerPage.value) });
    if (search.value) params.append('search', search.value);
    if (selectedLocation.value) params.append('locationId', selectedLocation.value);
    if (selectedStatusFilter.value) params.append('statusFilter', selectedStatusFilter.value);

    const response = await api.get(`/inventory?${params.toString()}`);
    if (response.success && response.data) {
      inventory.value = response.data.items || [];
      totalRecords.value = response.data.pagination?.total || 0;
      if (response.data.stats) filterStats.value = response.data.stats;
    }
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Errore', detail: error.message, life: 3000 });
  } finally {
    loading.value = false;
  }
};

const loadMaterials = async () => {
  try {
    materialsLoading.value = true;
    const params = new URLSearchParams({ page: String(Math.floor(materialFirst.value / materialRowsPerPage.value) + 1), limit: String(materialRowsPerPage.value) });
    if (materialSearch.value) params.append('search', materialSearch.value);
    if (selectedCategory.value) params.append('category', selectedCategory.value);
    if (selectedStatusFilter.value) params.append('statusFilter', selectedStatusFilter.value);

    const response = await api.get(`/inventory/materials?${params.toString()}`);
    if (response.success && response.data) {
      materials.value = response.data.items || [];
      materialTotalRecords.value = response.data.pagination?.total || 0;
      if (response.data.stats) materialStats.value = response.data.stats;
    }
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Errore', detail: error.message, life: 3000 });
  } finally {
    materialsLoading.value = false;
  }
};

const loadCategories = async () => {
  try {
    const response = await api.get('/materials/categories');
    if (response.success && response.data) {
      categories.value = response.data.map((c: string) => ({ label: c, value: c }));
    }
  } catch (e) { console.error('Error loading categories', e); }
};

// Event handlers
const onPage = (event: any) => { first.value = event.first; rowsPerPage.value = event.rows; loadData(); };
const onMaterialPage = (event: any) => { materialFirst.value = event.first; materialRowsPerPage.value = event.rows; loadMaterials(); };
const onTabChange = () => { selectedStatusFilter.value = null; if (activeTab.value === 0) loadData(); else loadMaterials(); };
const setStatusFilter = (filter: string | null) => { selectedStatusFilter.value = filter; first.value = 0; materialFirst.value = 0; if (activeTab.value === 0) loadData(); else loadMaterials(); };

const openMovementDialog = () => { showMovementDialog.value = true; };
const openScannerDialog = () => { showScannerDialog.value = true; };
const transferStock = (item: any) => { selectedItem.value = item; showTransferDialog.value = true; };
const viewMovementHistory = (item: any) => {
  // Prepara l'oggetto per il dialog storico movimenti
  selectedItemForHistory.value = {
    productId: item.productId || item.product?.id,
    location: item.location,
    product: item.product,
  };
  showHistoryDialog.value = true;
};
const onMovementSaved = () => { loadData(); loadMaterials(); loadGlobalTrend(); };

const viewPredictionDetails = async (item: any, type: 'PRODUCT' | 'MATERIAL') => {
  selectedItem.value = item;
  selectedItemType.value = type;
  selectedPrediction.value = item.prediction || null;
  stockHistory.value = [];
  showPredictionDialog.value = true;

  try {
    chartLoading.value = true;
    const endpoint = type === 'PRODUCT'
      ? `/inventory/history/${item.productId || item.id}`
      : `/inventory/materials/history/${item.id}`;
    const response = await api.get(endpoint);
    if (response.success && response.data) {
      stockHistory.value = response.data.history || [];
      if (response.data.prediction) selectedPrediction.value = response.data.prediction;
    }
  } catch (e) { console.error('Error loading history', e); }
  finally { chartLoading.value = false; }
};

onMounted(() => {
  loadGlobalTrend();
  loadData();
  loadCategories();
});
</script>

<style scoped>
.inventory-page { max-width: 1600px; margin: 0 auto; }

/* Trend Section */
.trend-section { margin-bottom: var(--space-5); }
.trend-card {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  padding: var(--space-4);
  border: var(--border-width) solid var(--border-color-light);
}
.trend-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}
.trend-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 600;
  font-size: var(--font-size-md);
  color: var(--color-gray-700);
}
.trend-title i { color: var(--color-primary-500); }
.trend-legend {
  display: flex;
  gap: var(--space-4);
}
.trend-legend .legend-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-xs);
  color: var(--color-gray-600);
}
.trend-legend .legend-dot {
  width: 12px;
  height: 3px;
  border-radius: 2px;
}
.legend-item--products .legend-dot { background: rgb(59, 130, 246); }
.legend-item--materials .legend-dot { background: rgb(245, 158, 11); }
.legend-item--projected .legend-dot { background: var(--color-gray-400); }
.legend-dot--dashed {
  background: linear-gradient(90deg, var(--color-gray-500) 50%, transparent 50%);
  background-size: 6px 3px;
}

/* Trend Indicators */
.trend-indicators {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}
.trend-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--border-radius-full);
  font-size: var(--font-size-xs);
  font-weight: 500;
  background: var(--color-gray-100);
  color: var(--color-gray-700);
}
.trend-badge i {
  font-size: 0.7rem;
}
.trend-badge--increasing {
  background: var(--color-success-100);
  color: var(--color-success-700);
}
.trend-badge--increasing i {
  color: var(--color-success);
}
.trend-badge--decreasing {
  background: var(--color-danger-100);
  color: var(--color-danger-700);
}
.trend-badge--decreasing i {
  color: var(--color-danger);
}
.trend-badge--stable {
  background: var(--color-gray-100);
  color: var(--color-gray-600);
}
.trend-badge--volatility {
  background: var(--color-info-50);
  color: var(--color-info-700);
}
.trend-badge--volatility.volatility-low {
  background: var(--color-success-50);
  color: var(--color-success-700);
}
.trend-badge--volatility.volatility-medium {
  background: var(--color-warning-50);
  color: var(--color-warning-700);
}
.trend-badge--volatility.volatility-high {
  background: var(--color-danger-50);
  color: var(--color-danger-700);
}

.trend-stats {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
  padding: var(--space-3);
  background: var(--color-gray-50);
  border-radius: var(--border-radius-md);
}
.trend-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.trend-stat__label {
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
}
.trend-stat__value {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-gray-800);
}
.trend-stat--products .trend-stat__value { color: rgb(59, 130, 246); }
.trend-stat--retail .trend-stat__value { color: rgb(16, 185, 129); }
.trend-stat--margin .trend-stat__value { color: rgb(34, 197, 94); }
.trend-stat--materials .trend-stat__value { color: rgb(245, 158, 11); }
.trend-stat--total .trend-stat__value { color: var(--color-gray-700); font-weight: 700; }
.trend-stat--projected .trend-stat__value { color: rgb(239, 68, 68); }
.trend-stat__percent {
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
  margin-left: 4px;
}
.trend-chart-container {
  height: 200px;
}
.trend-chart {
  height: 100% !important;
}
.trend-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  gap: var(--space-2);
  color: var(--color-gray-400);
}
.trend-loading i { font-size: 1.5rem; }
.info-btn {
  width: 28px !important;
  height: 28px !important;
  color: var(--color-gray-400) !important;
}
.info-btn:hover { color: var(--color-primary-500) !important; }

/* Info Dialog */
.info-dialog-content {
  font-size: var(--font-size-sm);
  line-height: 1.6;
}
.info-section h4 {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0 0 var(--space-2) 0;
  font-size: var(--font-size-md);
  color: var(--color-gray-800);
}
.info-section h4 i {
  color: var(--color-primary-500);
}
.info-section p {
  margin: 0 0 var(--space-2) 0;
  color: var(--color-gray-600);
}
.info-section ul {
  margin: var(--space-2) 0 0 0;
  padding-left: var(--space-5);
  color: var(--color-gray-600);
}
.info-section ul li {
  margin-bottom: var(--space-1);
}
.info-section code {
  background: var(--color-gray-100);
  padding: 2px 6px;
  border-radius: var(--border-radius-sm);
  font-size: var(--font-size-xs);
  color: var(--color-primary-700);
}
.info-section--note {
  background: var(--color-info-50);
  padding: var(--space-3);
  border-radius: var(--border-radius-md);
  border-left: 3px solid var(--color-info);
}
.info-section--note h4 i {
  color: var(--color-info);
}

/* Tabs */
.tabs-section { margin-top: var(--space-4); }
.tab-header { display: flex; align-items: center; gap: var(--space-2); }
.tab-header i { font-size: 1rem; }

/* Filter Cards */
.filter-cards-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--space-3); margin-bottom: var(--space-4); }
.filter-card { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3); background: var(--bg-card); border-radius: var(--border-radius-md); border: 2px solid transparent; cursor: pointer; transition: all 0.2s; }
.filter-card:hover { border-color: var(--color-primary-200); }
.filter-card--active { border-color: var(--color-primary-500); background: var(--color-primary-50); }
.filter-card__icon { width: 36px; height: 36px; border-radius: var(--border-radius-sm); display: flex; align-items: center; justify-content: center; }
.filter-card__icon--all { background: var(--color-gray-100); color: var(--color-gray-600); }
.filter-card__icon--critical { background: var(--color-danger-100); color: var(--color-danger); }
.filter-card__icon--low { background: var(--color-warning-100); color: var(--color-warning); }
.filter-card__icon--reorder { background: var(--color-info-100); color: var(--color-info); }
.filter-card__icon--ok { background: var(--color-success-100); color: var(--color-success); }
.filter-card__content { display: flex; flex-direction: column; }
.filter-card__value { font-size: var(--font-size-lg); font-weight: 700; }
.filter-card__label { font-size: var(--font-size-xs); color: var(--color-gray-500); }

/* Table */
.table-card { background: var(--bg-card); border-radius: var(--border-radius-lg); border: var(--border-width) solid var(--border-color-light); overflow: hidden; }
.table-toolbar { display: flex; justify-content: space-between; align-items: center; gap: var(--space-4); padding: var(--space-3) var(--space-4); background: var(--color-gray-50); border-bottom: var(--border-width) solid var(--border-color-light); }
.search-wrapper { position: relative; min-width: 250px; flex: 1; max-width: 350px; }
.search-icon { position: absolute; left: var(--space-3); top: 50%; transform: translateY(-50%); color: var(--color-gray-400); }
.search-input { width: 100%; padding-left: var(--space-9) !important; }
.toolbar-filters { display: flex; gap: var(--space-2); }
.filter-dropdown { min-width: 160px; }

.custom-table :deep(.p-datatable-thead > tr > th) { background: var(--color-gray-50); padding: var(--space-3); font-weight: 600; font-size: var(--font-size-sm); }
.custom-table :deep(.p-datatable-tbody > tr > td) { padding: var(--space-3); font-size: var(--font-size-sm); }
.custom-table :deep(.p-paginator) { padding: var(--space-2) var(--space-4); }

.sku-badge { font-family: var(--font-mono); font-size: var(--font-size-sm); font-weight: 600; color: var(--color-primary-700); background: var(--color-primary-50); padding: 2px 6px; border-radius: var(--border-radius-sm); }
.sku-badge--material { color: var(--color-warning-700); background: var(--color-warning-50); }
.product-name { font-weight: 500; }
.location-tag, .category-tag, .status-tag { font-size: var(--font-size-xs); }
.status-tag { display: inline-flex; align-items: center; gap: 4px; }
.status-icon { font-size: 0.7rem; }
.available-qty { font-weight: 600; }
.available-qty--low { color: var(--color-danger); }
.prediction-cell { display: flex; flex-direction: column; }
.prediction-days { font-weight: 600; font-size: var(--font-size-sm); }
.prediction-days--critical { color: var(--color-danger); }
.prediction-days--warning { color: var(--color-warning); }
.prediction-days--ok { color: var(--color-success); }
.prediction-na { color: var(--color-gray-400); }
.action-buttons { display: flex; gap: 2px; }
.action-btn { width: 30px !important; height: 30px !important; }
.action-btn--chart { color: var(--color-success) !important; }
.empty-state { display: flex; flex-direction: column; align-items: center; padding: var(--space-8); }
.empty-state__icon { font-size: 2.5rem; color: var(--color-gray-300); margin-bottom: var(--space-3); }
.empty-state__text { color: var(--color-gray-500); margin: 0; }

/* Prediction Dialog */
.prediction-detail { display: flex; flex-direction: column; gap: var(--space-4); }
.prediction-product { display: flex; align-items: center; gap: var(--space-3); padding-bottom: var(--space-3); border-bottom: 1px solid var(--border-color-light); }
.type-badge { font-size: var(--font-size-xs); }
.prediction-product__sku { font-family: var(--font-mono); font-weight: 600; color: var(--color-primary-700); background: var(--color-primary-50); padding: 2px 8px; border-radius: var(--border-radius-sm); }
.prediction-product__name { font-weight: 500; }

.chart-section { background: var(--color-gray-50); border-radius: var(--border-radius-lg); padding: var(--space-4); }
.chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3); }
.chart-title { font-weight: 600; font-size: var(--font-size-sm); color: var(--color-gray-700); }
.chart-legend { display: flex; gap: var(--space-4); }
.legend-item { display: flex; align-items: center; gap: var(--space-2); font-size: var(--font-size-xs); color: var(--color-gray-600); }
.legend-dot { width: 12px; height: 3px; border-radius: 2px; }
.legend-item--actual .legend-dot { background: rgb(59, 130, 246); }
.legend-item--projected .legend-dot { background: rgb(249, 115, 22); }
.chart-container { height: 220px; }
.stock-chart { height: 100% !important; }
.chart-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 220px; gap: var(--space-2); color: var(--color-gray-500); }
.chart-loading i { font-size: 1.5rem; }

.prediction-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-3); }
.prediction-stat { display: flex; flex-direction: column; gap: 2px; padding: var(--space-3); background: var(--color-gray-50); border-radius: var(--border-radius-md); }
.prediction-stat__label { font-size: var(--font-size-xs); color: var(--color-gray-500); }
.prediction-stat__value { font-weight: 600; }
.prediction-stat__value--large { font-size: var(--font-size-lg); color: var(--color-primary-600); }

.prediction-forecast { display: flex; flex-direction: column; gap: var(--space-3); }
.forecast-item { display: flex; align-items: flex-start; gap: var(--space-3); padding: var(--space-3); border-radius: var(--border-radius-md); border-left: 4px solid transparent; }
.forecast-item--warning { background: var(--color-warning-50); border-left-color: var(--color-warning); }
.forecast-item--success { background: var(--color-success-50); border-left-color: var(--color-success); }
.forecast-icon { font-size: 1.2rem; color: var(--color-gray-600); }
.forecast-content { display: flex; flex-direction: column; gap: 2px; }
.forecast-label { font-size: var(--font-size-sm); color: var(--color-gray-600); }
.forecast-value { font-weight: 600; }
.forecast-value--highlight { color: var(--color-primary-600); }
.forecast-tag { margin-left: var(--space-2); font-size: var(--font-size-xs); }
.prediction-message { margin-top: var(--space-2); }

/* Timeline Legend */
.timeline-legend {
  margin-top: var(--space-4);
  padding: var(--space-3);
  background: var(--color-gray-50);
  border-radius: var(--border-radius-md);
  border: 1px solid var(--border-color-light);
}
.timeline-legend__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--color-gray-700);
}
.timeline-legend__header i {
  color: var(--color-primary-500);
}
.timeline-legend__items {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.timeline-event {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--border-radius-full);
  font-size: var(--font-size-xs);
  border-left: 3px solid;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
}
.timeline-event:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}
.timeline-event--critical {
  border-left-color: var(--color-danger);
  color: var(--color-danger-700);
}
.timeline-event--critical:hover {
  background: var(--color-danger-50);
}
.timeline-event--warning {
  border-left-color: var(--color-warning);
  color: var(--color-warning-700);
}
.timeline-event--warning:hover {
  background: var(--color-warning-50);
}
.timeline-event--info {
  border-left-color: var(--color-info);
  color: var(--color-info-700);
}
.timeline-event--info:hover {
  background: var(--color-info-50);
}
.timeline-date {
  font-weight: 600;
}
.timeline-summary {
  color: var(--color-gray-600);
  flex: 1;
}
.timeline-chevron {
  font-size: 0.7rem;
  color: var(--color-gray-400);
  transition: transform 0.2s;
}
.timeline-event:hover .timeline-chevron {
  transform: translateX(2px);
  color: var(--color-gray-600);
}

/* Timeline Action Dialog */
.timeline-action-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.timeline-action-urgency {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--border-radius-md);
  font-size: var(--font-size-sm);
  font-weight: 500;
}
.timeline-action-urgency--critical {
  background: var(--color-danger-50);
  color: var(--color-danger-700);
}
.timeline-action-urgency--critical i {
  color: var(--color-danger);
}
.timeline-action-urgency--warning {
  background: var(--color-warning-50);
  color: var(--color-warning-700);
}
.timeline-action-urgency--warning i {
  color: var(--color-warning);
}
.timeline-action-urgency--info {
  background: var(--color-info-50);
  color: var(--color-info-700);
}
.timeline-action-urgency--info i {
  color: var(--color-info);
}
.timeline-action-groups {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.timeline-action-group {
  border: 1px solid var(--border-color-light);
  border-radius: var(--border-radius-md);
  overflow: hidden;
}
.timeline-action-group__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-gray-50);
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--color-gray-700);
  border-bottom: 1px solid var(--border-color-light);
}
.timeline-action-group__header i {
  color: var(--color-primary-500);
}
.timeline-action-items {
  max-height: 250px;
  overflow-y: auto;
}
.timeline-action-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3);
  border-bottom: 1px solid var(--border-color-light);
}
.timeline-action-item:last-child {
  border-bottom: none;
}
.timeline-action-item__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.timeline-action-item__name {
  font-weight: 500;
  color: var(--color-gray-800);
}
.timeline-action-item__qty {
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
  white-space: nowrap;
}
.timeline-action-item__qty strong {
  color: var(--color-primary-600);
  font-size: var(--font-size-md);
}

/* Dead Stock Section */
.dead-stock-section {
  margin-bottom: var(--space-6);
}

.dead-stock-card {
  background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
  border: 1px solid var(--color-warning-300);
  border-radius: var(--border-radius-lg);
  overflow: hidden;
}

.dead-stock-header {
  padding: var(--space-4);
  background: rgba(255, 255, 255, 0.5);
  border-bottom: 1px solid var(--color-warning-200);
}

.dead-stock-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-warning-800);
  margin-bottom: var(--space-1);
}

.dead-stock-title i {
  color: var(--color-warning-600);
}

.dead-stock-subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-warning-700);
}

.dead-stock-list {
  background: white;
}

.dead-stock-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-gray-100);
}

.dead-stock-item:last-child {
  border-bottom: none;
}

.dead-stock-item__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dead-stock-item__sku {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
}

.dead-stock-item__name {
  font-weight: 500;
  color: var(--color-gray-800);
}

.dead-stock-item__stats {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.dead-stock-item__qty {
  font-weight: 600;
  color: var(--color-gray-700);
}

.dead-stock-item__value {
  font-weight: 600;
  color: var(--color-warning-700);
}

.dead-stock-footer {
  display: flex;
  justify-content: center;
  padding: var(--space-2);
  background: white;
  border-top: 1px solid var(--color-gray-100);
}

.dead-stock-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: rgba(255, 255, 255, 0.7);
  border-top: 1px solid var(--color-warning-200);
  font-size: var(--font-size-sm);
  color: var(--color-warning-800);
}

.dead-stock-total strong {
  font-size: var(--font-size-lg);
  color: var(--color-warning-700);
}

/* Responsive */
@media (max-width: 1200px) {
  .filter-cards-grid { grid-template-columns: repeat(3, 1fr); }
  .trend-stats { flex-wrap: wrap; }
}
@media (max-width: 768px) {
  .filter-cards-grid { grid-template-columns: repeat(2, 1fr); }
  .table-toolbar { flex-direction: column; }
  .search-wrapper { min-width: 100%; max-width: 100%; }
  .prediction-stats { grid-template-columns: repeat(2, 1fr); }
  .trend-header { flex-direction: column; align-items: flex-start; gap: var(--space-2); }
  .trend-stats { gap: var(--space-2); }
  .trend-stat { flex: 1; min-width: 45%; }
  .trend-legend { flex-wrap: wrap; gap: var(--space-2); }
  .trend-indicators { gap: var(--space-1); }
  .trend-badge { padding: var(--space-1) var(--space-2); font-size: 0.65rem; }
  .timeline-legend__items { gap: var(--space-1); }
  .timeline-event { padding: var(--space-1) var(--space-2); font-size: 0.65rem; }
  .dead-stock-item { flex-direction: column; align-items: flex-start; gap: var(--space-2); }
  .dead-stock-item__stats { width: 100%; justify-content: space-between; }
}
</style>
