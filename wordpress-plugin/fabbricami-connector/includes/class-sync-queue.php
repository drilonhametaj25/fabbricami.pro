<?php
/**
 * FabbricaMi Sync Queue
 *
 * Sistema di coda con retry automatico e backoff esponenziale
 *
 * @package FabbricaMi
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Classe Sync Queue
 */
class FabbricaMi_Sync_Queue {

    /**
     * Stati della coda
     */
    const STATUS_PENDING = 'pending';
    const STATUS_PROCESSING = 'processing';
    const STATUS_COMPLETED = 'completed';
    const STATUS_FAILED = 'failed';
    const STATUS_CANCELLED = 'cancelled';

    /**
     * Priorita
     */
    const PRIORITY_CRITICAL = 1;
    const PRIORITY_HIGH = 3;
    const PRIORITY_NORMAL = 5;
    const PRIORITY_LOW = 7;
    const PRIORITY_BACKGROUND = 10;

    /**
     * Nome tabella
     */
    private $table_name;

    /**
     * Max attempts
     */
    private $max_attempts;

    /**
     * Base delay per retry (secondi)
     */
    private $base_retry_delay;

    /**
     * Batch size
     */
    private $batch_size;

    /**
     * Lock timeout (secondi)
     */
    private $lock_timeout = 300; // 5 minuti

    /**
     * Process ID corrente
     */
    private $process_id;

    /**
     * Costruttore
     */
    public function __construct() {
        global $wpdb;
        $this->table_name = $wpdb->prefix . 'fabbricami_sync_queue';
        $this->max_attempts = intval(get_option('fabbricami_queue_max_attempts', 5));
        $this->base_retry_delay = intval(get_option('fabbricami_queue_retry_delay', 300));
        $this->batch_size = intval(get_option('fabbricami_queue_batch_size', 50));
        $this->process_id = uniqid('proc_', true);

        // Hook per processamento coda
        add_action('fabbricami_queue_process', array($this, 'process_queue'));
    }

    /**
     * Aggiungi item alla coda
     *
     * @param string $entity_type Tipo entita (product, order, stock, customer)
     * @param string $entity_id ID entita
     * @param string $action Azione (create, update, delete, sync)
     * @param array $payload Dati da sincronizzare
     * @param int $priority Priorita (1-10, 1 = massima)
     * @return int|false ID del job inserito o false
     */
    public function add($entity_type, $entity_id, $action, $payload = array(), $priority = self::PRIORITY_NORMAL) {
        global $wpdb;

        // Verifica se esiste gia un job pending per questa entita/azione
        $existing = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$this->table_name}
             WHERE entity_type = %s
             AND entity_id = %s
             AND action = %s
             AND status IN ('pending', 'processing')
             LIMIT 1",
            $entity_type,
            $entity_id,
            $action
        ));

        if ($existing) {
            // Aggiorna payload del job esistente
            $wpdb->update(
                $this->table_name,
                array(
                    'payload' => wp_json_encode($payload),
                    'updated_at' => current_time('mysql')
                ),
                array('id' => $existing),
                array('%s', '%s'),
                array('%d')
            );

            return intval($existing);
        }

        // Inserisci nuovo job
        $result = $wpdb->insert(
            $this->table_name,
            array(
                'entity_type' => $entity_type,
                'entity_id' => strval($entity_id),
                'action' => $action,
                'payload' => wp_json_encode($payload),
                'priority' => $priority,
                'attempts' => 0,
                'max_attempts' => $this->max_attempts,
                'status' => self::STATUS_PENDING,
                'created_at' => current_time('mysql'),
                'updated_at' => current_time('mysql')
            ),
            array('%s', '%s', '%s', '%s', '%d', '%d', '%d', '%s', '%s', '%s')
        );

        if ($result === false) {
            fabbricami()->logger->error('queue_add_failed', array(
                'entity_type' => $entity_type,
                'entity_id' => $entity_id,
                'action' => $action,
                'error' => $wpdb->last_error
            ));
            return false;
        }

        $job_id = $wpdb->insert_id;

        fabbricami()->logger->debug('queue_item_added', array(
            'job_id' => $job_id,
            'entity_type' => $entity_type,
            'entity_id' => $entity_id,
            'action' => $action,
            'priority' => $priority
        ));

        return $job_id;
    }

    /**
     * Aggiungi job ad alta priorita (per operazioni immediate)
     */
    public function add_urgent($entity_type, $entity_id, $action, $payload = array()) {
        return $this->add($entity_type, $entity_id, $action, $payload, self::PRIORITY_CRITICAL);
    }

    /**
     * Processa la coda
     */
    public function process_queue() {
        if (!fabbricami()->is_sync_enabled()) {
            return;
        }

        // Rilascia lock scaduti
        $this->release_stale_locks();

        // Ottieni batch di job da processare
        $jobs = $this->get_pending_jobs($this->batch_size);

        if (empty($jobs)) {
            return;
        }

        foreach ($jobs as $job) {
            $this->process_job($job);
        }
    }

    /**
     * Ottieni job pending
     */
    private function get_pending_jobs($limit) {
        global $wpdb;

        // Seleziona job pending o con retry scaduto
        $jobs = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$this->table_name}
             WHERE (status = 'pending' AND (next_retry_at IS NULL OR next_retry_at <= NOW()))
             OR (status = 'processing' AND locked_at < DATE_SUB(NOW(), INTERVAL %d SECOND))
             ORDER BY priority ASC, created_at ASC
             LIMIT %d",
            $this->lock_timeout,
            $limit
        ));

        return $jobs;
    }

    /**
     * Processa singolo job
     */
    private function process_job($job) {
        global $wpdb;

        // Acquisci lock
        $locked = $wpdb->update(
            $this->table_name,
            array(
                'status' => self::STATUS_PROCESSING,
                'locked_at' => current_time('mysql'),
                'locked_by' => $this->process_id,
                'attempts' => $job->attempts + 1,
                'updated_at' => current_time('mysql')
            ),
            array('id' => $job->id, 'status' => $job->status),
            array('%s', '%s', '%s', '%d', '%s'),
            array('%d', '%s')
        );

        if ($locked === 0) {
            // Job gia preso da altro processo
            return;
        }

        $start_time = microtime(true);
        $payload = json_decode($job->payload, true);

        try {
            // Esegui sync in base al tipo
            $result = $this->execute_sync($job->entity_type, $job->entity_id, $job->action, $payload);

            $duration_ms = round((microtime(true) - $start_time) * 1000);

            if (is_wp_error($result)) {
                throw new Exception($result->get_error_message());
            }

            // Successo
            $wpdb->update(
                $this->table_name,
                array(
                    'status' => self::STATUS_COMPLETED,
                    'completed_at' => current_time('mysql'),
                    'locked_at' => null,
                    'locked_by' => null,
                    'updated_at' => current_time('mysql')
                ),
                array('id' => $job->id),
                array('%s', '%s', null, null, '%s'),
                array('%d')
            );

            fabbricami()->logger->sync(
                'outgoing',
                $job->entity_type,
                $job->entity_id,
                $job->action,
                'success',
                'Sync completato',
                array('attempt' => $job->attempts + 1),
                $duration_ms
            );

        } catch (Exception $e) {
            $duration_ms = round((microtime(true) - $start_time) * 1000);
            $this->handle_job_failure($job, $e->getMessage(), $duration_ms);
        }
    }

    /**
     * Esegui sync verso ERP
     */
    private function execute_sync($entity_type, $entity_id, $action, $payload) {
        $endpoint = '';
        $method = 'POST';
        $data = $payload;

        switch ($entity_type) {
            case 'order':
                $endpoint = '/api/v1/wordpress/webhook/order';
                $data = $this->prepare_order_data($entity_id, $action, $payload);
                break;

            case 'customer':
                $endpoint = '/api/v1/wordpress/webhook/customer';
                $data = $this->prepare_customer_data($entity_id, $action, $payload);
                break;

            case 'product':
                if ($action === 'delete') {
                    $endpoint = '/api/v1/wordpress/products/' . $entity_id;
                    $method = 'DELETE';
                    $data = array();
                } else {
                    $endpoint = '/api/v1/wordpress/products';
                    $data = $this->prepare_product_data($entity_id, $action, $payload);
                }
                break;

            case 'stock':
                $endpoint = '/api/v1/wordpress/stock';
                $data = $this->prepare_stock_data($entity_id, $payload);
                break;

            default:
                return new WP_Error('unknown_entity', 'Tipo entita non supportato: ' . $entity_type);
        }

        return fabbricami()->send_to_erp($endpoint, $data, $method);
    }

    /**
     * Prepara dati ordine per sync
     */
    private function prepare_order_data($order_id, $action, $payload) {
        $order = wc_get_order($order_id);
        if (!$order) {
            return $payload;
        }

        return array_merge($payload, array(
            'action' => $action,
            'wc_order_id' => $order_id,
            'order_number' => $order->get_order_number(),
            'status' => $order->get_status(),
            'total' => $order->get_total(),
            'currency' => $order->get_currency(),
            'customer_id' => $order->get_customer_id(),
            'billing' => $order->get_address('billing'),
            'shipping' => $order->get_address('shipping'),
            'items' => array_map(function($item) {
                return array(
                    'product_id' => $item->get_product_id(),
                    'variation_id' => $item->get_variation_id(),
                    'sku' => $item->get_product() ? $item->get_product()->get_sku() : '',
                    'quantity' => $item->get_quantity(),
                    'total' => $item->get_total()
                );
            }, $order->get_items()),
            'date_created' => $order->get_date_created() ? $order->get_date_created()->format('c') : null,
            'date_modified' => $order->get_date_modified() ? $order->get_date_modified()->format('c') : null
        ));
    }

    /**
     * Prepara dati cliente per sync
     */
    private function prepare_customer_data($customer_id, $action, $payload) {
        $customer = new WC_Customer($customer_id);
        if (!$customer->get_id()) {
            return $payload;
        }

        return array_merge($payload, array(
            'action' => $action,
            'wc_customer_id' => $customer_id,
            'email' => $customer->get_email(),
            'first_name' => $customer->get_first_name(),
            'last_name' => $customer->get_last_name(),
            'billing' => array(
                'first_name' => $customer->get_billing_first_name(),
                'last_name' => $customer->get_billing_last_name(),
                'company' => $customer->get_billing_company(),
                'address_1' => $customer->get_billing_address_1(),
                'address_2' => $customer->get_billing_address_2(),
                'city' => $customer->get_billing_city(),
                'state' => $customer->get_billing_state(),
                'postcode' => $customer->get_billing_postcode(),
                'country' => $customer->get_billing_country(),
                'phone' => $customer->get_billing_phone(),
                'email' => $customer->get_billing_email()
            ),
            'shipping' => array(
                'first_name' => $customer->get_shipping_first_name(),
                'last_name' => $customer->get_shipping_last_name(),
                'company' => $customer->get_shipping_company(),
                'address_1' => $customer->get_shipping_address_1(),
                'address_2' => $customer->get_shipping_address_2(),
                'city' => $customer->get_shipping_city(),
                'state' => $customer->get_shipping_state(),
                'postcode' => $customer->get_shipping_postcode(),
                'country' => $customer->get_shipping_country()
            ),
            'date_created' => $customer->get_date_created() ? $customer->get_date_created()->format('c') : null
        ));
    }

    /**
     * Prepara dati prodotto per sync
     */
    private function prepare_product_data($product_id, $action, $payload) {
        $product = wc_get_product($product_id);
        if (!$product) {
            return $payload;
        }

        $data = array_merge($payload, array(
            'action' => $action,
            'wc_product_id' => $product_id,
            'type' => $product->get_type(),
            'sku' => $product->get_sku(),
            'name' => $product->get_name(),
            'slug' => $product->get_slug(),
            'status' => $product->get_status(),
            'price' => $product->get_price(),
            'regular_price' => $product->get_regular_price(),
            'sale_price' => $product->get_sale_price(),
            'stock_quantity' => $product->get_stock_quantity(),
            'stock_status' => $product->get_stock_status(),
            'manage_stock' => $product->get_manage_stock(),
            'weight' => $product->get_weight(),
            'categories' => wp_get_post_terms($product_id, 'product_cat', array('fields' => 'names'))
        ));

        // Aggiungi varianti se prodotto variabile
        if ($product->is_type('variable')) {
            $data['variations'] = array();
            foreach ($product->get_children() as $variation_id) {
                $variation = wc_get_product($variation_id);
                if ($variation) {
                    $data['variations'][] = array(
                        'wc_variation_id' => $variation_id,
                        'sku' => $variation->get_sku(),
                        'price' => $variation->get_price(),
                        'regular_price' => $variation->get_regular_price(),
                        'stock_quantity' => $variation->get_stock_quantity(),
                        'attributes' => $variation->get_attributes()
                    );
                }
            }
        }

        return $data;
    }

    /**
     * Prepara dati stock per sync
     */
    private function prepare_stock_data($product_id, $payload) {
        $product = wc_get_product($product_id);
        if (!$product) {
            return $payload;
        }

        return array_merge($payload, array(
            'wc_product_id' => $product_id,
            'sku' => $product->get_sku(),
            'stock_quantity' => $product->get_stock_quantity(),
            'stock_status' => $product->get_stock_status()
        ));
    }

    /**
     * Gestisci fallimento job
     */
    private function handle_job_failure($job, $error_message, $duration_ms) {
        global $wpdb;

        $new_attempts = $job->attempts + 1;

        if ($new_attempts >= $job->max_attempts) {
            // Max tentativi raggiunti
            $wpdb->update(
                $this->table_name,
                array(
                    'status' => self::STATUS_FAILED,
                    'last_error' => $error_message,
                    'locked_at' => null,
                    'locked_by' => null,
                    'updated_at' => current_time('mysql')
                ),
                array('id' => $job->id),
                array('%s', '%s', null, null, '%s'),
                array('%d')
            );

            fabbricami()->logger->error('queue_job_failed_permanently', array(
                'job_id' => $job->id,
                'entity_type' => $job->entity_type,
                'entity_id' => $job->entity_id,
                'action' => $job->action,
                'attempts' => $new_attempts,
                'error' => $error_message
            ));

        } else {
            // Schedula retry con backoff esponenziale
            $delay = $this->calculate_retry_delay($new_attempts);
            $next_retry = date('Y-m-d H:i:s', time() + $delay);

            $wpdb->update(
                $this->table_name,
                array(
                    'status' => self::STATUS_PENDING,
                    'last_error' => $error_message,
                    'next_retry_at' => $next_retry,
                    'locked_at' => null,
                    'locked_by' => null,
                    'updated_at' => current_time('mysql')
                ),
                array('id' => $job->id),
                array('%s', '%s', '%s', null, null, '%s'),
                array('%d')
            );

            fabbricami()->logger->warning(
                'outgoing',
                $job->entity_type,
                $job->entity_id,
                $job->action,
                sprintf('Retry schedulato tra %d secondi (tentativo %d/%d)', $delay, $new_attempts, $job->max_attempts),
                array('error' => $error_message, 'next_retry' => $next_retry)
            );
        }
    }

    /**
     * Calcola delay per retry con backoff esponenziale
     */
    private function calculate_retry_delay($attempt) {
        // Backoff esponenziale: base_delay * 2^(attempt-1)
        // Con jitter casuale per evitare thundering herd
        $delay = $this->base_retry_delay * pow(2, $attempt - 1);
        $jitter = rand(0, min(60, $delay * 0.1)); // Max 10% jitter, max 60 secondi

        return min($delay + $jitter, 86400); // Max 24 ore
    }

    /**
     * Rilascia lock scaduti
     */
    private function release_stale_locks() {
        global $wpdb;

        $wpdb->query($wpdb->prepare(
            "UPDATE {$this->table_name}
             SET status = 'pending', locked_at = NULL, locked_by = NULL
             WHERE status = 'processing'
             AND locked_at < DATE_SUB(NOW(), INTERVAL %d SECOND)",
            $this->lock_timeout
        ));
    }

    /**
     * Ottieni job per ID
     */
    public function get($job_id) {
        global $wpdb;

        $job = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$this->table_name} WHERE id = %d",
            $job_id
        ));

        if ($job && !empty($job->payload)) {
            $job->payload = json_decode($job->payload, true);
        }

        return $job;
    }

    /**
     * Ottieni jobs con filtri
     */
    public function get_jobs($args = array()) {
        global $wpdb;

        $defaults = array(
            'status' => '',
            'entity_type' => '',
            'page' => 1,
            'per_page' => 50,
            'orderby' => 'created_at',
            'order' => 'DESC'
        );

        $args = wp_parse_args($args, $defaults);

        $where = array('1=1');
        $values = array();

        if (!empty($args['status'])) {
            $where[] = 'status = %s';
            $values[] = $args['status'];
        }

        if (!empty($args['entity_type'])) {
            $where[] = 'entity_type = %s';
            $values[] = $args['entity_type'];
        }

        $where_clause = implode(' AND ', $where);

        // Sanitizza orderby e order
        $allowed_orderby = array('id', 'entity_type', 'priority', 'status', 'attempts', 'created_at');
        $orderby = in_array($args['orderby'], $allowed_orderby) ? $args['orderby'] : 'created_at';
        $order = strtoupper($args['order']) === 'ASC' ? 'ASC' : 'DESC';

        // Count totale
        $count_sql = "SELECT COUNT(*) FROM {$this->table_name} WHERE {$where_clause}";
        if (!empty($values)) {
            $count_sql = $wpdb->prepare($count_sql, $values);
        }
        $total = intval($wpdb->get_var($count_sql));

        // Query paginata
        $offset = ($args['page'] - 1) * $args['per_page'];
        $limit = intval($args['per_page']);

        $sql = "SELECT * FROM {$this->table_name} WHERE {$where_clause} ORDER BY {$orderby} {$order} LIMIT {$offset}, {$limit}";
        if (!empty($values)) {
            $sql = $wpdb->prepare($sql, $values);
        }

        $jobs = $wpdb->get_results($sql);

        return array(
            'items' => $jobs,
            'total' => $total,
            'pages' => ceil($total / $args['per_page']),
            'page' => $args['page'],
            'per_page' => $args['per_page']
        );
    }

    /**
     * Retry manuale di un job fallito
     */
    public function retry($job_id) {
        global $wpdb;

        return $wpdb->update(
            $this->table_name,
            array(
                'status' => self::STATUS_PENDING,
                'attempts' => 0,
                'next_retry_at' => null,
                'last_error' => null,
                'updated_at' => current_time('mysql')
            ),
            array('id' => $job_id, 'status' => self::STATUS_FAILED),
            array('%s', '%d', null, null, '%s'),
            array('%d', '%s')
        );
    }

    /**
     * Cancella job
     */
    public function cancel($job_id) {
        global $wpdb;

        return $wpdb->update(
            $this->table_name,
            array(
                'status' => self::STATUS_CANCELLED,
                'updated_at' => current_time('mysql')
            ),
            array('id' => $job_id),
            array('%s', '%s'),
            array('%d')
        );
    }

    /**
     * Elimina job
     */
    public function delete($job_id) {
        global $wpdb;
        return $wpdb->delete($this->table_name, array('id' => $job_id), array('%d'));
    }

    /**
     * Pulisci job completati vecchi
     */
    public function cleanup_completed($days = 7) {
        global $wpdb;

        $cutoff = date('Y-m-d H:i:s', strtotime("-{$days} days"));

        return $wpdb->query($wpdb->prepare(
            "DELETE FROM {$this->table_name}
             WHERE status IN ('completed', 'cancelled')
             AND completed_at < %s",
            $cutoff
        ));
    }

    /**
     * Ottieni statistiche coda
     */
    public function get_stats() {
        global $wpdb;

        return array(
            'pending' => intval($wpdb->get_var("SELECT COUNT(*) FROM {$this->table_name} WHERE status = 'pending'")),
            'processing' => intval($wpdb->get_var("SELECT COUNT(*) FROM {$this->table_name} WHERE status = 'processing'")),
            'completed' => intval($wpdb->get_var("SELECT COUNT(*) FROM {$this->table_name} WHERE status = 'completed'")),
            'failed' => intval($wpdb->get_var("SELECT COUNT(*) FROM {$this->table_name} WHERE status = 'failed'")),
            'by_entity' => $wpdb->get_results(
                "SELECT entity_type, status, COUNT(*) as count
                 FROM {$this->table_name}
                 GROUP BY entity_type, status",
                ARRAY_A
            )
        );
    }

    /**
     * Svuota coda (emergenza)
     */
    public function truncate() {
        global $wpdb;
        return $wpdb->query("TRUNCATE TABLE {$this->table_name}");
    }
}
