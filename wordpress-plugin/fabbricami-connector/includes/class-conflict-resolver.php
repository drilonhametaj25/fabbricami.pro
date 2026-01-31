<?php
/**
 * FabbricaMi Conflict Resolver
 *
 * Sistema di risoluzione conflitti tra dati WooCommerce e ERP
 *
 * @package FabbricaMi
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Classe Conflict Resolver
 */
class FabbricaMi_Conflict_Resolver {

    /**
     * Strategie di risoluzione
     */
    const STRATEGY_ERP_WINS = 'erp_wins';
    const STRATEGY_WP_WINS = 'wp_wins';
    const STRATEGY_NEWEST_WINS = 'newest_wins';
    const STRATEGY_MANUAL = 'manual';

    /**
     * Stati conflitto
     */
    const STATUS_PENDING = 'pending';
    const STATUS_RESOLVED = 'resolved';
    const STATUS_IGNORED = 'ignored';

    /**
     * Nome tabella
     */
    private $table_name;

    /**
     * Strategia default
     */
    private $default_strategy;

    /**
     * Campi da ignorare nel confronto
     */
    private $ignored_fields = array(
        'date_modified',
        'updated_at',
        '_edit_last',
        '_edit_lock'
    );

    /**
     * Costruttore
     */
    public function __construct() {
        global $wpdb;
        $this->table_name = $wpdb->prefix . 'fabbricami_conflicts';
        $this->default_strategy = get_option('fabbricami_conflict_strategy', self::STRATEGY_ERP_WINS);
    }

    /**
     * Rileva conflitti tra dati WP e ERP
     *
     * @param string $entity_type Tipo entita
     * @param string $entity_id ID entita
     * @param array $wp_data Dati da WooCommerce
     * @param array $erp_data Dati da ERP
     * @return array|false Conflitti trovati o false se nessuno
     */
    public function detect($entity_type, $entity_id, $wp_data, $erp_data) {
        $conflicts = array();

        // Campi da confrontare in base al tipo entita
        $fields_to_compare = $this->get_comparable_fields($entity_type);

        foreach ($fields_to_compare as $field) {
            if (in_array($field, $this->ignored_fields)) {
                continue;
            }

            $wp_value = isset($wp_data[$field]) ? $wp_data[$field] : null;
            $erp_value = isset($erp_data[$field]) ? $erp_data[$field] : null;

            // Normalizza valori per confronto
            $wp_normalized = $this->normalize_value($wp_value);
            $erp_normalized = $this->normalize_value($erp_value);

            if ($wp_normalized !== $erp_normalized) {
                $conflicts[$field] = array(
                    'wp_value' => $wp_value,
                    'erp_value' => $erp_value,
                    'wp_modified' => isset($wp_data['date_modified']) ? $wp_data['date_modified'] : null,
                    'erp_modified' => isset($erp_data['updated_at']) ? $erp_data['updated_at'] : null
                );
            }
        }

        if (empty($conflicts)) {
            return false;
        }

        return $conflicts;
    }

    /**
     * Registra conflitto nel database
     */
    public function register($entity_type, $entity_id, $wp_data, $erp_data, $field_conflicts) {
        global $wpdb;

        // Verifica se esiste gia un conflitto pending per questa entita
        $existing = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$this->table_name}
             WHERE entity_type = %s AND entity_id = %s AND status = 'pending'",
            $entity_type,
            $entity_id
        ));

        $data = array(
            'entity_type' => $entity_type,
            'entity_id' => strval($entity_id),
            'wp_data' => wp_json_encode($wp_data),
            'erp_data' => wp_json_encode($erp_data),
            'field_conflicts' => wp_json_encode($field_conflicts),
            'status' => self::STATUS_PENDING
        );

        if ($existing) {
            // Aggiorna conflitto esistente
            $wpdb->update(
                $this->table_name,
                $data,
                array('id' => $existing),
                array('%s', '%s', '%s', '%s', '%s', '%s'),
                array('%d')
            );
            return intval($existing);
        } else {
            // Inserisci nuovo conflitto
            $data['created_at'] = current_time('mysql');
            $wpdb->insert(
                $this->table_name,
                $data,
                array('%s', '%s', '%s', '%s', '%s', '%s', '%s')
            );
            return $wpdb->insert_id;
        }
    }

    /**
     * Risolvi conflitto con strategia specificata
     *
     * @param int $conflict_id ID conflitto
     * @param string $strategy Strategia (erp_wins, wp_wins, manual)
     * @param array $manual_data Dati manuali (solo per strategy=manual)
     * @param int $user_id ID utente che risolve
     * @return bool|WP_Error
     */
    public function resolve($conflict_id, $strategy = null, $manual_data = array(), $user_id = null) {
        global $wpdb;

        $conflict = $this->get($conflict_id);
        if (!$conflict) {
            return new WP_Error('not_found', 'Conflitto non trovato');
        }

        if ($conflict->status !== self::STATUS_PENDING) {
            return new WP_Error('already_resolved', 'Conflitto gia risolto');
        }

        $strategy = $strategy ?: $this->default_strategy;
        $user_id = $user_id ?: get_current_user_id();

        $wp_data = json_decode($conflict->wp_data, true);
        $erp_data = json_decode($conflict->erp_data, true);

        // Determina dati da applicare
        switch ($strategy) {
            case self::STRATEGY_ERP_WINS:
                $final_data = $erp_data;
                $apply_to = 'wp'; // Aggiorna WordPress
                break;

            case self::STRATEGY_WP_WINS:
                $final_data = $wp_data;
                $apply_to = 'erp'; // Aggiorna ERP
                break;

            case self::STRATEGY_NEWEST_WINS:
                $wp_modified = isset($wp_data['date_modified']) ? strtotime($wp_data['date_modified']) : 0;
                $erp_modified = isset($erp_data['updated_at']) ? strtotime($erp_data['updated_at']) : 0;

                if ($erp_modified >= $wp_modified) {
                    $final_data = $erp_data;
                    $apply_to = 'wp';
                } else {
                    $final_data = $wp_data;
                    $apply_to = 'erp';
                }
                break;

            case self::STRATEGY_MANUAL:
                if (empty($manual_data)) {
                    return new WP_Error('missing_data', 'Dati manuali richiesti per risoluzione manual');
                }
                $final_data = $manual_data;
                $apply_to = 'both';
                break;

            default:
                return new WP_Error('invalid_strategy', 'Strategia non valida');
        }

        // Applica risoluzione
        $result = $this->apply_resolution(
            $conflict->entity_type,
            $conflict->entity_id,
            $final_data,
            $apply_to
        );

        if (is_wp_error($result)) {
            return $result;
        }

        // Aggiorna stato conflitto
        $wpdb->update(
            $this->table_name,
            array(
                'status' => self::STATUS_RESOLVED,
                'resolution_strategy' => $strategy,
                'resolved_by' => $user_id,
                'resolved_at' => current_time('mysql'),
                'resolution_notes' => sprintf('Applicato a: %s', $apply_to)
            ),
            array('id' => $conflict_id),
            array('%s', '%s', '%d', '%s', '%s'),
            array('%d')
        );

        fabbricami()->logger->info(
            'internal',
            $conflict->entity_type,
            $conflict->entity_id,
            'conflict_resolved',
            sprintf('Conflitto risolto con strategia: %s', $strategy)
        );

        return true;
    }

    /**
     * Applica risoluzione ai sistemi
     */
    private function apply_resolution($entity_type, $entity_id, $data, $apply_to) {
        switch ($entity_type) {
            case 'product':
                return $this->apply_product_resolution($entity_id, $data, $apply_to);

            case 'order':
                return $this->apply_order_resolution($entity_id, $data, $apply_to);

            case 'customer':
                return $this->apply_customer_resolution($entity_id, $data, $apply_to);

            case 'stock':
                return $this->apply_stock_resolution($entity_id, $data, $apply_to);

            default:
                return new WP_Error('unsupported_entity', 'Tipo entita non supportato');
        }
    }

    /**
     * Applica risoluzione prodotto
     */
    private function apply_product_resolution($product_id, $data, $apply_to) {
        if ($apply_to === 'wp' || $apply_to === 'both') {
            $product = wc_get_product($product_id);
            if (!$product) {
                return new WP_Error('product_not_found', 'Prodotto non trovato');
            }

            // Aggiorna campi prodotto
            if (isset($data['name'])) $product->set_name($data['name']);
            if (isset($data['sku'])) $product->set_sku($data['sku']);
            if (isset($data['regular_price'])) $product->set_regular_price($data['regular_price']);
            if (isset($data['sale_price'])) $product->set_sale_price($data['sale_price']);
            if (isset($data['stock_quantity'])) $product->set_stock_quantity($data['stock_quantity']);
            if (isset($data['description'])) $product->set_description($data['description']);
            if (isset($data['short_description'])) $product->set_short_description($data['short_description']);

            // Disabilita temporaneamente hooks per evitare loop
            remove_action('woocommerce_update_product', array(fabbricami()->hooks, 'on_product_update'));
            $product->save();
            add_action('woocommerce_update_product', array(fabbricami()->hooks, 'on_product_update'));
        }

        if ($apply_to === 'erp' || $apply_to === 'both') {
            // Invia aggiornamento all'ERP
            $result = fabbricami()->send_to_erp('/api/v1/wordpress/products/' . $product_id, $data, 'PUT');
            if (is_wp_error($result)) {
                return $result;
            }
        }

        return true;
    }

    /**
     * Applica risoluzione ordine
     */
    private function apply_order_resolution($order_id, $data, $apply_to) {
        if ($apply_to === 'wp' || $apply_to === 'both') {
            $order = wc_get_order($order_id);
            if (!$order) {
                return new WP_Error('order_not_found', 'Ordine non trovato');
            }

            // Gli ordini di solito non vengono modificati da ERP, solo lo stato
            if (isset($data['status'])) {
                remove_action('woocommerce_order_status_changed', array(fabbricami()->hooks, 'on_order_status_changed'));
                $order->set_status($data['status']);
                $order->save();
                add_action('woocommerce_order_status_changed', array(fabbricami()->hooks, 'on_order_status_changed'));
            }
        }

        if ($apply_to === 'erp' || $apply_to === 'both') {
            $result = fabbricami()->send_to_erp('/api/v1/wordpress/orders/' . $order_id, $data, 'PUT');
            if (is_wp_error($result)) {
                return $result;
            }
        }

        return true;
    }

    /**
     * Applica risoluzione cliente
     */
    private function apply_customer_resolution($customer_id, $data, $apply_to) {
        if ($apply_to === 'wp' || $apply_to === 'both') {
            $customer = new WC_Customer($customer_id);
            if (!$customer->get_id()) {
                return new WP_Error('customer_not_found', 'Cliente non trovato');
            }

            if (isset($data['first_name'])) $customer->set_first_name($data['first_name']);
            if (isset($data['last_name'])) $customer->set_last_name($data['last_name']);
            if (isset($data['email'])) $customer->set_email($data['email']);

            // Billing
            if (isset($data['billing'])) {
                $billing = $data['billing'];
                if (isset($billing['phone'])) $customer->set_billing_phone($billing['phone']);
                if (isset($billing['address_1'])) $customer->set_billing_address_1($billing['address_1']);
                if (isset($billing['city'])) $customer->set_billing_city($billing['city']);
                if (isset($billing['postcode'])) $customer->set_billing_postcode($billing['postcode']);
                if (isset($billing['country'])) $customer->set_billing_country($billing['country']);
            }

            $customer->save();
        }

        if ($apply_to === 'erp' || $apply_to === 'both') {
            $result = fabbricami()->send_to_erp('/api/v1/wordpress/customers/' . $customer_id, $data, 'PUT');
            if (is_wp_error($result)) {
                return $result;
            }
        }

        return true;
    }

    /**
     * Applica risoluzione stock
     */
    private function apply_stock_resolution($product_id, $data, $apply_to) {
        $quantity = isset($data['stock_quantity']) ? intval($data['stock_quantity']) : 0;

        if ($apply_to === 'wp' || $apply_to === 'both') {
            $product = wc_get_product($product_id);
            if (!$product) {
                return new WP_Error('product_not_found', 'Prodotto non trovato');
            }

            remove_action('woocommerce_product_set_stock', array(fabbricami()->hooks, 'on_stock_change'));
            $product->set_stock_quantity($quantity);
            $product->save();
            add_action('woocommerce_product_set_stock', array(fabbricami()->hooks, 'on_stock_change'));
        }

        if ($apply_to === 'erp' || $apply_to === 'both') {
            $result = fabbricami()->send_to_erp('/api/v1/wordpress/stock/' . $product_id, array(
                'stock_quantity' => $quantity
            ), 'PUT');

            if (is_wp_error($result)) {
                return $result;
            }
        }

        return true;
    }

    /**
     * Ignora conflitto
     */
    public function ignore($conflict_id, $user_id = null) {
        global $wpdb;

        $user_id = $user_id ?: get_current_user_id();

        return $wpdb->update(
            $this->table_name,
            array(
                'status' => self::STATUS_IGNORED,
                'resolved_by' => $user_id,
                'resolved_at' => current_time('mysql'),
                'resolution_notes' => 'Ignorato manualmente'
            ),
            array('id' => $conflict_id),
            array('%s', '%d', '%s', '%s'),
            array('%d')
        );
    }

    /**
     * Risolvi automaticamente con strategia default
     */
    public function auto_resolve($entity_type, $entity_id, $wp_data, $erp_data) {
        // Se strategia e MANUAL, registra per review
        if ($this->default_strategy === self::STRATEGY_MANUAL) {
            $field_conflicts = $this->detect($entity_type, $entity_id, $wp_data, $erp_data);
            if ($field_conflicts) {
                $this->register($entity_type, $entity_id, $wp_data, $erp_data, $field_conflicts);
            }
            return false;
        }

        // Altrimenti risolvi automaticamente
        $field_conflicts = $this->detect($entity_type, $entity_id, $wp_data, $erp_data);
        if (!$field_conflicts) {
            return true; // Nessun conflitto
        }

        // Registra e risolvi immediatamente
        $conflict_id = $this->register($entity_type, $entity_id, $wp_data, $erp_data, $field_conflicts);
        return $this->resolve($conflict_id, $this->default_strategy);
    }

    /**
     * Ottieni conflitto per ID
     */
    public function get($conflict_id) {
        global $wpdb;

        $conflict = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$this->table_name} WHERE id = %d",
            $conflict_id
        ));

        return $conflict;
    }

    /**
     * Ottieni lista conflitti con filtri
     */
    public function get_conflicts($args = array()) {
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

        // Count totale
        $count_sql = "SELECT COUNT(*) FROM {$this->table_name} WHERE {$where_clause}";
        if (!empty($values)) {
            $count_sql = $wpdb->prepare($count_sql, $values);
        }
        $total = intval($wpdb->get_var($count_sql));

        // Sanitizza orderby e order
        $allowed_orderby = array('id', 'entity_type', 'status', 'created_at', 'resolved_at');
        $orderby = in_array($args['orderby'], $allowed_orderby) ? $args['orderby'] : 'created_at';
        $order = strtoupper($args['order']) === 'ASC' ? 'ASC' : 'DESC';

        // Query paginata
        $offset = ($args['page'] - 1) * $args['per_page'];
        $limit = intval($args['per_page']);

        $sql = "SELECT * FROM {$this->table_name} WHERE {$where_clause} ORDER BY {$orderby} {$order} LIMIT {$offset}, {$limit}";
        if (!empty($values)) {
            $sql = $wpdb->prepare($sql, $values);
        }

        $conflicts = $wpdb->get_results($sql);

        // Decodifica JSON
        foreach ($conflicts as &$conflict) {
            $conflict->wp_data = json_decode($conflict->wp_data, true);
            $conflict->erp_data = json_decode($conflict->erp_data, true);
            $conflict->field_conflicts = json_decode($conflict->field_conflicts, true);
        }

        return array(
            'items' => $conflicts,
            'total' => $total,
            'pages' => ceil($total / $args['per_page']),
            'page' => $args['page'],
            'per_page' => $args['per_page']
        );
    }

    /**
     * Ottieni campi confrontabili per tipo entita
     */
    private function get_comparable_fields($entity_type) {
        $fields = array(
            'product' => array(
                'name', 'sku', 'regular_price', 'sale_price', 'stock_quantity',
                'description', 'short_description', 'weight', 'status'
            ),
            'order' => array(
                'status', 'total', 'shipping_total', 'discount_total'
            ),
            'customer' => array(
                'first_name', 'last_name', 'email', 'phone',
                'billing_address_1', 'billing_city', 'billing_postcode'
            ),
            'stock' => array(
                'stock_quantity', 'stock_status'
            )
        );

        return isset($fields[$entity_type]) ? $fields[$entity_type] : array();
    }

    /**
     * Normalizza valore per confronto
     */
    private function normalize_value($value) {
        if (is_null($value)) {
            return '';
        }

        if (is_bool($value)) {
            return $value ? '1' : '0';
        }

        if (is_numeric($value)) {
            return strval(floatval($value));
        }

        if (is_array($value)) {
            ksort($value);
            return wp_json_encode($value);
        }

        return strval($value);
    }

    /**
     * Elimina conflitto
     */
    public function delete($conflict_id) {
        global $wpdb;
        return $wpdb->delete($this->table_name, array('id' => $conflict_id), array('%d'));
    }

    /**
     * Ottieni statistiche conflitti
     */
    public function get_stats() {
        global $wpdb;

        return array(
            'pending' => intval($wpdb->get_var("SELECT COUNT(*) FROM {$this->table_name} WHERE status = 'pending'")),
            'resolved' => intval($wpdb->get_var("SELECT COUNT(*) FROM {$this->table_name} WHERE status = 'resolved'")),
            'ignored' => intval($wpdb->get_var("SELECT COUNT(*) FROM {$this->table_name} WHERE status = 'ignored'")),
            'by_entity' => $wpdb->get_results(
                "SELECT entity_type, status, COUNT(*) as count
                 FROM {$this->table_name}
                 GROUP BY entity_type, status",
                ARRAY_A
            )
        );
    }
}
