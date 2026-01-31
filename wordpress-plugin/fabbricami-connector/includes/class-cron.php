<?php
/**
 * FabbricaMi Cron
 *
 * Gestione sync schedulato e job periodici
 *
 * @package FabbricaMi
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Classe Cron
 */
class FabbricaMi_Cron {

    /**
     * Ultimo sync timestamp
     */
    private $last_sync_option = 'fabbricami_last_sync';

    /**
     * Costruttore
     */
    public function __construct() {
        // Registra hooks cron
        add_action('fabbricami_scheduled_sync', array($this, 'run_scheduled_sync'));
        add_action('fabbricami_stock_sync', array($this, 'run_stock_sync'));
        add_action('fabbricami_health_check', array($this, 'run_health_check'));
        add_action('fabbricami_cleanup', array($this, 'run_cleanup'));

        // Registra intervalli custom su init
        add_filter('cron_schedules', array($this, 'add_cron_intervals'));
    }

    /**
     * Aggiungi intervalli cron custom
     */
    public function add_cron_intervals($schedules) {
        $schedules['fabbricami_1min'] = array(
            'interval' => 60,
            'display' => __('Ogni minuto', 'fabbricami')
        );

        $schedules['fabbricami_5min'] = array(
            'interval' => 300,
            'display' => __('Ogni 5 minuti', 'fabbricami')
        );

        $schedules['fabbricami_15min'] = array(
            'interval' => 900,
            'display' => __('Ogni 15 minuti', 'fabbricami')
        );

        return $schedules;
    }

    /**
     * Esegui sync schedulato principale
     */
    public function run_scheduled_sync() {
        if (!fabbricami()->is_sync_enabled()) {
            return;
        }

        $start_time = microtime(true);

        fabbricami()->logger->info(
            'internal',
            'system',
            '0',
            'scheduled_sync_start',
            'Avvio sync schedulato'
        );

        $results = array(
            'products' => 0,
            'orders' => 0,
            'customers' => 0,
            'errors' => 0
        );

        // Sync prodotti da ERP a WooCommerce
        if (get_option('fabbricami_sync_products', '1') === '1') {
            $products_result = $this->sync_products_from_erp();
            $results['products'] = $products_result['synced'];
            $results['errors'] += $products_result['errors'];
        }

        // Sync ordini pendenti a ERP
        if (get_option('fabbricami_sync_orders', '1') === '1') {
            $orders_result = $this->sync_pending_orders();
            $results['orders'] = $orders_result['synced'];
            $results['errors'] += $orders_result['errors'];
        }

        // Sync clienti modificati
        if (get_option('fabbricami_sync_customers', '1') === '1') {
            $customers_result = $this->sync_modified_customers();
            $results['customers'] = $customers_result['synced'];
            $results['errors'] += $customers_result['errors'];
        }

        $duration_ms = round((microtime(true) - $start_time) * 1000);

        // Salva timestamp ultimo sync
        update_option($this->last_sync_option, current_time('mysql'));

        fabbricami()->logger->info(
            'internal',
            'system',
            '0',
            'scheduled_sync_complete',
            sprintf(
                'Sync completato: %d prodotti, %d ordini, %d clienti, %d errori',
                $results['products'],
                $results['orders'],
                $results['customers'],
                $results['errors']
            ),
            $results,
            $duration_ms
        );

        return $results;
    }

    /**
     * Sync prodotti da ERP
     */
    private function sync_products_from_erp() {
        $result = array('synced' => 0, 'errors' => 0);

        // Ottieni prodotti modificati da ERP
        $last_sync = get_option($this->last_sync_option, '');
        $endpoint = '/api/v1/wordpress/products/modified';

        if (!empty($last_sync)) {
            $endpoint .= '?since=' . urlencode($last_sync);
        }

        $response = fabbricami()->send_to_erp($endpoint, array(), 'GET');

        if (is_wp_error($response)) {
            $result['errors']++;
            fabbricami()->logger->error('sync_products_fetch_failed', array(
                'error' => $response->get_error_message()
            ));
            return $result;
        }

        $products = isset($response['data']) ? $response['data'] : array();

        foreach ($products as $erp_product) {
            try {
                $sync_result = $this->sync_single_product($erp_product);
                if ($sync_result) {
                    $result['synced']++;
                } else {
                    $result['errors']++;
                }
            } catch (Exception $e) {
                $result['errors']++;
                fabbricami()->logger->error('sync_product_failed', array(
                    'erp_product_id' => isset($erp_product['id']) ? $erp_product['id'] : 'unknown',
                    'error' => $e->getMessage()
                ));
            }
        }

        return $result;
    }

    /**
     * Sincronizza singolo prodotto da ERP a WooCommerce
     */
    private function sync_single_product($erp_product) {
        $sku = isset($erp_product['sku']) ? $erp_product['sku'] : '';

        if (empty($sku)) {
            return false;
        }

        // Cerca prodotto per SKU
        $product_id = wc_get_product_id_by_sku($sku);
        $product = $product_id ? wc_get_product($product_id) : null;

        // Verifica conflitti se prodotto esiste
        if ($product) {
            $wp_data = array(
                'name' => $product->get_name(),
                'sku' => $product->get_sku(),
                'regular_price' => $product->get_regular_price(),
                'sale_price' => $product->get_sale_price(),
                'stock_quantity' => $product->get_stock_quantity(),
                'date_modified' => $product->get_date_modified() ? $product->get_date_modified()->format('c') : null
            );

            $has_conflict = fabbricami()->conflict_resolver->detect(
                'product',
                $product_id,
                $wp_data,
                $erp_product
            );

            if ($has_conflict) {
                // Risolvi automaticamente o registra per review manuale
                fabbricami()->conflict_resolver->auto_resolve(
                    'product',
                    $product_id,
                    $wp_data,
                    $erp_product
                );
                return true;
            }
        }

        // Aggiorna o crea prodotto
        if (!$product) {
            $product = new WC_Product_Simple();
        }

        // Disabilita hooks temporaneamente
        remove_action('woocommerce_update_product', array(fabbricami()->hooks, 'on_product_update'));

        // Imposta dati
        if (isset($erp_product['name'])) $product->set_name($erp_product['name']);
        if (isset($erp_product['sku'])) $product->set_sku($erp_product['sku']);
        if (isset($erp_product['regular_price'])) $product->set_regular_price($erp_product['regular_price']);
        if (isset($erp_product['sale_price'])) $product->set_sale_price($erp_product['sale_price']);
        if (isset($erp_product['description'])) $product->set_description($erp_product['description']);
        if (isset($erp_product['short_description'])) $product->set_short_description($erp_product['short_description']);
        if (isset($erp_product['weight'])) $product->set_weight($erp_product['weight']);

        // Gestione stock
        if (isset($erp_product['manage_stock'])) {
            $product->set_manage_stock($erp_product['manage_stock']);
        }
        if (isset($erp_product['stock_quantity'])) {
            $product->set_stock_quantity($erp_product['stock_quantity']);
        }

        // Meta ERP ID
        $product->update_meta_data('_erp_product_id', isset($erp_product['id']) ? $erp_product['id'] : '');
        $product->update_meta_data('_erp_last_sync', current_time('mysql'));

        $product->save();

        // Riabilita hooks
        add_action('woocommerce_update_product', array(fabbricami()->hooks, 'on_product_update'));

        fabbricami()->logger->sync(
            'incoming',
            'product',
            $product->get_id(),
            'sync_from_erp',
            'success',
            'Prodotto sincronizzato da ERP'
        );

        return true;
    }

    /**
     * Sync ordini pendenti verso ERP
     */
    private function sync_pending_orders() {
        $result = array('synced' => 0, 'errors' => 0);

        // Trova ordini non ancora sincronizzati
        $args = array(
            'limit' => 50,
            'status' => array('processing', 'completed', 'on-hold'),
            'meta_query' => array(
                'relation' => 'OR',
                array(
                    'key' => '_erp_synced',
                    'compare' => 'NOT EXISTS'
                ),
                array(
                    'key' => '_erp_synced',
                    'value' => '0',
                    'compare' => '='
                )
            )
        );

        $orders = wc_get_orders($args);

        foreach ($orders as $order) {
            // Aggiungi alla coda sync
            $job_id = fabbricami()->sync_queue->add(
                'order',
                $order->get_id(),
                'sync',
                array(),
                FabbricaMi_Sync_Queue::PRIORITY_HIGH
            );

            if ($job_id) {
                // Marca come in sync
                $order->update_meta_data('_erp_sync_queued', current_time('mysql'));
                $order->save();
                $result['synced']++;
            } else {
                $result['errors']++;
            }
        }

        return $result;
    }

    /**
     * Sync clienti modificati
     */
    private function sync_modified_customers() {
        $result = array('synced' => 0, 'errors' => 0);

        // Query clienti modificati di recente
        $last_sync = get_option($this->last_sync_option, '');
        $last_sync_time = !empty($last_sync) ? strtotime($last_sync) : strtotime('-1 day');

        $args = array(
            'role' => 'customer',
            'meta_query' => array(
                array(
                    'key' => 'last_update',
                    'value' => date('Y-m-d H:i:s', $last_sync_time),
                    'compare' => '>',
                    'type' => 'DATETIME'
                )
            ),
            'number' => 50
        );

        $customers = get_users($args);

        foreach ($customers as $user) {
            $customer = new WC_Customer($user->ID);

            // Aggiungi alla coda
            $job_id = fabbricami()->sync_queue->add(
                'customer',
                $user->ID,
                'sync',
                array(),
                FabbricaMi_Sync_Queue::PRIORITY_NORMAL
            );

            if ($job_id) {
                $result['synced']++;
            } else {
                $result['errors']++;
            }
        }

        return $result;
    }

    /**
     * Sync stock frequente
     */
    public function run_stock_sync() {
        if (!fabbricami()->is_sync_enabled()) {
            return;
        }

        if (get_option('fabbricami_sync_stock', '1') !== '1') {
            return;
        }

        $start_time = microtime(true);

        // Ottieni stock aggiornato da ERP
        $response = fabbricami()->send_to_erp('/api/v1/wordpress/stock/updates', array(), 'GET');

        if (is_wp_error($response)) {
            fabbricami()->logger->error('stock_sync_failed', array(
                'error' => $response->get_error_message()
            ));
            return;
        }

        $stock_updates = isset($response['data']) ? $response['data'] : array();
        $updated = 0;
        $errors = 0;

        foreach ($stock_updates as $update) {
            $sku = isset($update['sku']) ? $update['sku'] : '';
            $quantity = isset($update['stock_quantity']) ? intval($update['stock_quantity']) : null;

            if (empty($sku) || is_null($quantity)) {
                continue;
            }

            $product_id = wc_get_product_id_by_sku($sku);
            if (!$product_id) {
                $errors++;
                continue;
            }

            $product = wc_get_product($product_id);
            if (!$product) {
                $errors++;
                continue;
            }

            // Verifica se c'e differenza
            if ($product->get_stock_quantity() == $quantity) {
                continue;
            }

            // Aggiorna stock
            remove_action('woocommerce_product_set_stock', array(fabbricami()->hooks, 'on_stock_change'));

            wc_update_product_stock($product_id, $quantity, 'set');

            add_action('woocommerce_product_set_stock', array(fabbricami()->hooks, 'on_stock_change'));

            $updated++;

            fabbricami()->logger->sync(
                'incoming',
                'stock',
                $product_id,
                'stock_update',
                'success',
                sprintf('Stock aggiornato: %d', $quantity),
                array('sku' => $sku, 'old_qty' => $product->get_stock_quantity(), 'new_qty' => $quantity)
            );
        }

        $duration_ms = round((microtime(true) - $start_time) * 1000);

        if ($updated > 0 || $errors > 0) {
            fabbricami()->logger->info(
                'internal',
                'system',
                '0',
                'stock_sync_complete',
                sprintf('Stock sync: %d aggiornati, %d errori', $updated, $errors),
                array('updated' => $updated, 'errors' => $errors),
                $duration_ms
            );
        }
    }

    /**
     * Health check periodico
     */
    public function run_health_check() {
        $health = array(
            'timestamp' => current_time('mysql'),
            'status' => 'healthy',
            'issues' => array()
        );

        // Test connessione ERP
        if (fabbricami()->auth->is_erp_configured()) {
            $response = fabbricami()->send_to_erp('/api/v1/wordpress/verify', array(), 'GET');

            if (is_wp_error($response)) {
                $health['status'] = 'degraded';
                $health['issues'][] = array(
                    'type' => 'connection',
                    'message' => 'Impossibile connettersi all\'ERP: ' . $response->get_error_message()
                );
            }
        } else {
            $health['status'] = 'unconfigured';
            $health['issues'][] = array(
                'type' => 'configuration',
                'message' => 'Configurazione ERP incompleta'
            );
        }

        // Verifica coda
        $queue_stats = fabbricami()->sync_queue->get_stats();
        if ($queue_stats['failed'] > 10) {
            $health['status'] = 'degraded';
            $health['issues'][] = array(
                'type' => 'queue',
                'message' => sprintf('%d job falliti in coda', $queue_stats['failed'])
            );
        }

        // Verifica conflitti
        $conflict_stats = fabbricami()->conflict_resolver->get_stats();
        if ($conflict_stats['pending'] > 20) {
            $health['status'] = 'warning';
            $health['issues'][] = array(
                'type' => 'conflicts',
                'message' => sprintf('%d conflitti da risolvere', $conflict_stats['pending'])
            );
        }

        // Salva stato
        update_option('fabbricami_health_status', $health);

        // Log se ci sono problemi
        if ($health['status'] !== 'healthy') {
            fabbricami()->logger->warning(
                'internal',
                'system',
                '0',
                'health_check',
                sprintf('Health check: %s - %d problemi', $health['status'], count($health['issues'])),
                $health['issues']
            );
        }

        return $health;
    }

    /**
     * Cleanup periodico
     */
    public function run_cleanup() {
        // Pulisci log vecchi
        $logs_deleted = fabbricami()->logger->cleanup_old_logs();

        // Pulisci job completati
        $jobs_deleted = fabbricami()->sync_queue->cleanup_completed(7);

        fabbricami()->logger->info(
            'internal',
            'system',
            '0',
            'cleanup_complete',
            sprintf('Cleanup: %d log eliminati, %d job eliminati', $logs_deleted, $jobs_deleted)
        );
    }

    /**
     * Ottieni prossima esecuzione schedulata
     */
    public function get_next_scheduled($hook) {
        $timestamp = wp_next_scheduled($hook);
        if (!$timestamp) {
            return null;
        }

        return array(
            'timestamp' => $timestamp,
            'datetime' => date('Y-m-d H:i:s', $timestamp),
            'in_seconds' => $timestamp - time()
        );
    }

    /**
     * Ottieni stato di tutti i cron jobs
     */
    public function get_cron_status() {
        return array(
            'scheduled_sync' => $this->get_next_scheduled('fabbricami_scheduled_sync'),
            'stock_sync' => $this->get_next_scheduled('fabbricami_stock_sync'),
            'health_check' => $this->get_next_scheduled('fabbricami_health_check'),
            'queue_process' => $this->get_next_scheduled('fabbricami_queue_process'),
            'cleanup' => $this->get_next_scheduled('fabbricami_cleanup'),
            'last_sync' => get_option($this->last_sync_option, 'Mai')
        );
    }

    /**
     * Forza esecuzione immediata di un cron
     */
    public function run_now($hook) {
        $allowed_hooks = array(
            'fabbricami_scheduled_sync',
            'fabbricami_stock_sync',
            'fabbricami_health_check',
            'fabbricami_cleanup'
        );

        if (!in_array($hook, $allowed_hooks)) {
            return false;
        }

        do_action($hook);
        return true;
    }

    /**
     * Rischedula tutti i cron jobs
     */
    public function reschedule_all() {
        // Rimuovi tutti
        wp_clear_scheduled_hook('fabbricami_scheduled_sync');
        wp_clear_scheduled_hook('fabbricami_stock_sync');
        wp_clear_scheduled_hook('fabbricami_health_check');
        wp_clear_scheduled_hook('fabbricami_queue_process');
        wp_clear_scheduled_hook('fabbricami_cleanup');

        // Rischedula
        $sync_interval = get_option('fabbricami_sync_interval', 'hourly');
        $stock_interval = get_option('fabbricami_stock_sync_interval', 'fabbricami_15min');

        wp_schedule_event(time(), $sync_interval, 'fabbricami_scheduled_sync');
        wp_schedule_event(time(), $stock_interval, 'fabbricami_stock_sync');
        wp_schedule_event(time(), 'hourly', 'fabbricami_health_check');
        wp_schedule_event(time(), 'fabbricami_1min', 'fabbricami_queue_process');
        wp_schedule_event(time(), 'daily', 'fabbricami_cleanup');

        return true;
    }
}
