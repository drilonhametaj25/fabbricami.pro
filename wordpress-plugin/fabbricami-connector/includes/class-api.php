<?php
/**
 * FabbricaMi API
 *
 * REST API endpoints per comunicazione bidirezionale con ERP
 *
 * @package FabbricaMi
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Classe API
 */
class FabbricaMi_API {

    /**
     * Namespace API
     */
    const API_NAMESPACE = 'fabbricami/v1';

    /**
     * Costruttore
     */
    public function __construct() {
        add_action('rest_api_init', array($this, 'register_routes'));
    }

    /**
     * Registra tutti gli endpoints REST
     */
    public function register_routes() {
        // === PRODOTTI ===
        register_rest_route(self::API_NAMESPACE, '/products', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_products'),
            'permission_callback' => array($this, 'check_permission')
        ));

        register_rest_route(self::API_NAMESPACE, '/products', array(
            'methods' => 'POST',
            'callback' => array($this, 'create_product'),
            'permission_callback' => array($this, 'check_permission')
        ));

        register_rest_route(self::API_NAMESPACE, '/products/(?P<id>\d+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_product'),
            'permission_callback' => array($this, 'check_permission')
        ));

        register_rest_route(self::API_NAMESPACE, '/products/(?P<id>\d+)', array(
            'methods' => 'PUT',
            'callback' => array($this, 'update_product'),
            'permission_callback' => array($this, 'check_permission')
        ));

        register_rest_route(self::API_NAMESPACE, '/products/(?P<id>\d+)', array(
            'methods' => 'DELETE',
            'callback' => array($this, 'delete_product'),
            'permission_callback' => array($this, 'check_permission')
        ));

        register_rest_route(self::API_NAMESPACE, '/products/by-sku/(?P<sku>[^/]+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_product_by_sku'),
            'permission_callback' => array($this, 'check_permission')
        ));

        // === VARIANTI ===
        register_rest_route(self::API_NAMESPACE, '/products/(?P<product_id>\d+)/variations', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_variations'),
            'permission_callback' => array($this, 'check_permission')
        ));

        register_rest_route(self::API_NAMESPACE, '/products/(?P<product_id>\d+)/variations', array(
            'methods' => 'POST',
            'callback' => array($this, 'create_variation'),
            'permission_callback' => array($this, 'check_permission')
        ));

        register_rest_route(self::API_NAMESPACE, '/variations/(?P<id>\d+)', array(
            'methods' => 'PUT',
            'callback' => array($this, 'update_variation'),
            'permission_callback' => array($this, 'check_permission')
        ));

        // === STOCK ===
        register_rest_route(self::API_NAMESPACE, '/stock', array(
            'methods' => 'POST',
            'callback' => array($this, 'update_stock_bulk'),
            'permission_callback' => array($this, 'check_permission')
        ));

        register_rest_route(self::API_NAMESPACE, '/stock/(?P<id>\d+)', array(
            'methods' => 'PUT',
            'callback' => array($this, 'update_stock'),
            'permission_callback' => array($this, 'check_permission')
        ));

        register_rest_route(self::API_NAMESPACE, '/stock/by-sku/(?P<sku>[^/]+)', array(
            'methods' => 'PUT',
            'callback' => array($this, 'update_stock_by_sku'),
            'permission_callback' => array($this, 'check_permission')
        ));

        // === ORDINI ===
        register_rest_route(self::API_NAMESPACE, '/orders', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_orders'),
            'permission_callback' => array($this, 'check_permission')
        ));

        register_rest_route(self::API_NAMESPACE, '/orders/(?P<id>\d+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_order'),
            'permission_callback' => array($this, 'check_permission')
        ));

        register_rest_route(self::API_NAMESPACE, '/orders/(?P<id>\d+)/status', array(
            'methods' => 'PUT',
            'callback' => array($this, 'update_order_status'),
            'permission_callback' => array($this, 'check_permission')
        ));

        register_rest_route(self::API_NAMESPACE, '/orders/(?P<id>\d+)/tracking', array(
            'methods' => 'PUT',
            'callback' => array($this, 'update_order_tracking'),
            'permission_callback' => array($this, 'check_permission')
        ));

        // === CLIENTI ===
        register_rest_route(self::API_NAMESPACE, '/customers', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_customers'),
            'permission_callback' => array($this, 'check_permission')
        ));

        register_rest_route(self::API_NAMESPACE, '/customers/(?P<id>\d+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_customer'),
            'permission_callback' => array($this, 'check_permission')
        ));

        // === CATEGORIE ===
        register_rest_route(self::API_NAMESPACE, '/categories', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_categories'),
            'permission_callback' => array($this, 'check_permission')
        ));

        // === STATISTICHE E STATUS ===
        register_rest_route(self::API_NAMESPACE, '/stats', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_stats'),
            'permission_callback' => array($this, 'check_permission')
        ));

        register_rest_route(self::API_NAMESPACE, '/health', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_health'),
            'permission_callback' => array($this, 'check_permission')
        ));

        // === SYNC QUEUE ===
        register_rest_route(self::API_NAMESPACE, '/queue', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_queue'),
            'permission_callback' => array($this, 'check_permission')
        ));

        register_rest_route(self::API_NAMESPACE, '/queue/(?P<id>\d+)/retry', array(
            'methods' => 'POST',
            'callback' => array($this, 'retry_queue_item'),
            'permission_callback' => array($this, 'check_permission')
        ));

        // === CONFLITTI ===
        register_rest_route(self::API_NAMESPACE, '/conflicts', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_conflicts'),
            'permission_callback' => array($this, 'check_permission')
        ));

        register_rest_route(self::API_NAMESPACE, '/conflicts/(?P<id>\d+)/resolve', array(
            'methods' => 'POST',
            'callback' => array($this, 'resolve_conflict'),
            'permission_callback' => array($this, 'check_permission')
        ));

        // === LOG ===
        register_rest_route(self::API_NAMESPACE, '/logs', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_logs'),
            'permission_callback' => array($this, 'check_permission')
        ));
    }

    /**
     * Verifica permessi API
     */
    public function check_permission($request) {
        return fabbricami()->auth->check_api_key();
    }

    // ==========================================
    // PRODOTTI
    // ==========================================

    /**
     * GET /products - Lista prodotti
     */
    public function get_products($request) {
        $args = array(
            'status' => 'publish',
            'limit' => $request->get_param('per_page') ?: 50,
            'page' => $request->get_param('page') ?: 1,
            'orderby' => 'date',
            'order' => 'DESC'
        );

        // Filtro per data modifica
        if ($request->get_param('modified_after')) {
            $args['date_modified'] = '>' . $request->get_param('modified_after');
        }

        $products = wc_get_products($args);
        $data = array();

        foreach ($products as $product) {
            $data[] = $this->format_product($product);
        }

        return rest_ensure_response(array(
            'success' => true,
            'data' => $data,
            'total' => count($data),
            'page' => $args['page']
        ));
    }

    /**
     * GET /products/{id} - Singolo prodotto
     */
    public function get_product($request) {
        $product = wc_get_product($request->get_param('id'));

        if (!$product) {
            return new WP_Error('not_found', 'Prodotto non trovato', array('status' => 404));
        }

        return rest_ensure_response(array(
            'success' => true,
            'data' => $this->format_product($product, true)
        ));
    }

    /**
     * GET /products/by-sku/{sku}
     */
    public function get_product_by_sku($request) {
        $sku = $request->get_param('sku');
        $product_id = wc_get_product_id_by_sku($sku);

        if (!$product_id) {
            return new WP_Error('not_found', 'Prodotto non trovato per SKU: ' . $sku, array('status' => 404));
        }

        $product = wc_get_product($product_id);
        return rest_ensure_response(array(
            'success' => true,
            'data' => $this->format_product($product, true)
        ));
    }

    /**
     * POST /products - Crea prodotto
     */
    public function create_product($request) {
        $data = $request->get_json_params();

        // Verifica SKU unico
        if (!empty($data['sku'])) {
            $existing = wc_get_product_id_by_sku($data['sku']);
            if ($existing) {
                return new WP_Error('duplicate_sku', 'SKU gia esistente', array('status' => 400));
            }
        }

        // Disabilita hooks per evitare loop
        fabbricami()->hooks->disable_hooks();

        try {
            $product_type = isset($data['type']) ? $data['type'] : 'simple';

            if ($product_type === 'variable') {
                $product = new WC_Product_Variable();
            } else {
                $product = new WC_Product_Simple();
            }

            $this->set_product_data($product, $data);
            $product->update_meta_data('_erp_product_id', isset($data['erp_id']) ? $data['erp_id'] : '');
            $product->update_meta_data('_erp_imported', current_time('mysql'));
            $product->save();

            fabbricami()->hooks->enable_hooks();

            fabbricami()->logger->sync(
                'incoming',
                'product',
                $product->get_id(),
                'create',
                'success',
                'Prodotto creato da ERP'
            );

            return rest_ensure_response(array(
                'success' => true,
                'data' => $this->format_product($product),
                'message' => 'Prodotto creato'
            ));

        } catch (Exception $e) {
            fabbricami()->hooks->enable_hooks();
            return new WP_Error('create_failed', $e->getMessage(), array('status' => 500));
        }
    }

    /**
     * PUT /products/{id} - Aggiorna prodotto
     */
    public function update_product($request) {
        $product = wc_get_product($request->get_param('id'));

        if (!$product) {
            return new WP_Error('not_found', 'Prodotto non trovato', array('status' => 404));
        }

        $data = $request->get_json_params();

        fabbricami()->hooks->disable_hooks();

        try {
            $this->set_product_data($product, $data);
            $product->update_meta_data('_erp_last_sync', current_time('mysql'));
            $product->save();

            fabbricami()->hooks->enable_hooks();

            fabbricami()->logger->sync(
                'incoming',
                'product',
                $product->get_id(),
                'update',
                'success',
                'Prodotto aggiornato da ERP'
            );

            return rest_ensure_response(array(
                'success' => true,
                'data' => $this->format_product($product),
                'message' => 'Prodotto aggiornato'
            ));

        } catch (Exception $e) {
            fabbricami()->hooks->enable_hooks();
            return new WP_Error('update_failed', $e->getMessage(), array('status' => 500));
        }
    }

    /**
     * DELETE /products/{id}
     */
    public function delete_product($request) {
        $product = wc_get_product($request->get_param('id'));

        if (!$product) {
            return new WP_Error('not_found', 'Prodotto non trovato', array('status' => 404));
        }

        fabbricami()->hooks->disable_hooks();

        $product->delete(true);

        fabbricami()->hooks->enable_hooks();

        fabbricami()->logger->sync(
            'incoming',
            'product',
            $request->get_param('id'),
            'delete',
            'success',
            'Prodotto eliminato da ERP'
        );

        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Prodotto eliminato'
        ));
    }

    /**
     * Imposta dati prodotto
     */
    private function set_product_data($product, $data) {
        if (isset($data['name'])) $product->set_name($data['name']);
        if (isset($data['sku'])) $product->set_sku($data['sku']);
        if (isset($data['regular_price'])) $product->set_regular_price($data['regular_price']);
        if (isset($data['sale_price'])) $product->set_sale_price($data['sale_price']);
        if (isset($data['description'])) $product->set_description($data['description']);
        if (isset($data['short_description'])) $product->set_short_description($data['short_description']);
        if (isset($data['weight'])) $product->set_weight($data['weight']);
        if (isset($data['status'])) $product->set_status($data['status']);

        // Stock
        if (isset($data['manage_stock'])) {
            $product->set_manage_stock($data['manage_stock']);
        }
        if (isset($data['stock_quantity'])) {
            $product->set_stock_quantity($data['stock_quantity']);
        }
        if (isset($data['stock_status'])) {
            $product->set_stock_status($data['stock_status']);
        }

        // Categorie
        if (isset($data['categories']) && is_array($data['categories'])) {
            $cat_ids = array();
            foreach ($data['categories'] as $cat_name) {
                $term = get_term_by('name', $cat_name, 'product_cat');
                if ($term) {
                    $cat_ids[] = $term->term_id;
                }
            }
            if (!empty($cat_ids)) {
                $product->set_category_ids($cat_ids);
            }
        }
    }

    /**
     * Formatta prodotto per output
     */
    private function format_product($product, $include_variations = false) {
        $data = array(
            'id' => $product->get_id(),
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
            'permalink' => $product->get_permalink(),
            'image_url' => wp_get_attachment_url($product->get_image_id()),
            'categories' => wp_get_post_terms($product->get_id(), 'product_cat', array('fields' => 'names')),
            'erp_product_id' => $product->get_meta('_erp_product_id'),
            'erp_last_sync' => $product->get_meta('_erp_last_sync'),
            'date_created' => $product->get_date_created() ? $product->get_date_created()->format('c') : null,
            'date_modified' => $product->get_date_modified() ? $product->get_date_modified()->format('c') : null
        );

        if ($include_variations && $product->is_type('variable')) {
            $data['variations'] = array();
            foreach ($product->get_children() as $variation_id) {
                $variation = wc_get_product($variation_id);
                if ($variation) {
                    $data['variations'][] = array(
                        'id' => $variation_id,
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

    // ==========================================
    // STOCK
    // ==========================================

    /**
     * PUT /stock/{id} - Aggiorna stock singolo prodotto
     */
    public function update_stock($request) {
        $product = wc_get_product($request->get_param('id'));

        if (!$product) {
            return new WP_Error('not_found', 'Prodotto non trovato', array('status' => 404));
        }

        $data = $request->get_json_params();
        $quantity = isset($data['stock_quantity']) ? intval($data['stock_quantity']) : null;

        if (is_null($quantity)) {
            return new WP_Error('missing_quantity', 'stock_quantity richiesto', array('status' => 400));
        }

        fabbricami()->hooks->disable_hooks();

        $old_quantity = $product->get_stock_quantity();
        wc_update_product_stock($product, $quantity, 'set');

        fabbricami()->hooks->enable_hooks();

        fabbricami()->logger->sync(
            'incoming',
            'stock',
            $product->get_id(),
            'update',
            'success',
            sprintf('Stock: %d -> %d', $old_quantity, $quantity)
        );

        return rest_ensure_response(array(
            'success' => true,
            'data' => array(
                'id' => $product->get_id(),
                'sku' => $product->get_sku(),
                'old_quantity' => $old_quantity,
                'new_quantity' => $quantity
            )
        ));
    }

    /**
     * PUT /stock/by-sku/{sku}
     */
    public function update_stock_by_sku($request) {
        $sku = $request->get_param('sku');
        $product_id = wc_get_product_id_by_sku($sku);

        if (!$product_id) {
            return new WP_Error('not_found', 'Prodotto non trovato per SKU: ' . $sku, array('status' => 404));
        }

        $request->set_param('id', $product_id);
        return $this->update_stock($request);
    }

    /**
     * POST /stock - Aggiornamento bulk stock
     */
    public function update_stock_bulk($request) {
        $data = $request->get_json_params();
        $items = isset($data['items']) ? $data['items'] : array();

        if (empty($items)) {
            return new WP_Error('empty_items', 'Nessun item da aggiornare', array('status' => 400));
        }

        fabbricami()->hooks->disable_hooks();

        $results = array(
            'updated' => 0,
            'errors' => 0,
            'details' => array()
        );

        foreach ($items as $item) {
            $sku = isset($item['sku']) ? $item['sku'] : '';
            $product_id = isset($item['product_id']) ? $item['product_id'] : null;
            $quantity = isset($item['stock_quantity']) ? intval($item['stock_quantity']) : null;

            if (!$product_id && !empty($sku)) {
                $product_id = wc_get_product_id_by_sku($sku);
            }

            if (!$product_id || is_null($quantity)) {
                $results['errors']++;
                $results['details'][] = array(
                    'sku' => $sku,
                    'status' => 'error',
                    'message' => 'Prodotto non trovato o quantita mancante'
                );
                continue;
            }

            wc_update_product_stock($product_id, $quantity, 'set');
            $results['updated']++;
            $results['details'][] = array(
                'sku' => $sku,
                'product_id' => $product_id,
                'quantity' => $quantity,
                'status' => 'success'
            );
        }

        fabbricami()->hooks->enable_hooks();

        fabbricami()->logger->sync(
            'incoming',
            'stock',
            '0',
            'bulk_update',
            $results['errors'] > 0 ? 'partial' : 'success',
            sprintf('Bulk stock: %d aggiornati, %d errori', $results['updated'], $results['errors'])
        );

        return rest_ensure_response(array(
            'success' => true,
            'data' => $results
        ));
    }

    // ==========================================
    // ORDINI
    // ==========================================

    /**
     * GET /orders
     */
    public function get_orders($request) {
        $args = array(
            'limit' => $request->get_param('per_page') ?: 50,
            'page' => $request->get_param('page') ?: 1,
            'orderby' => 'date',
            'order' => 'DESC'
        );

        if ($request->get_param('status')) {
            $args['status'] = $request->get_param('status');
        }

        if ($request->get_param('modified_after')) {
            $args['date_modified'] = '>' . $request->get_param('modified_after');
        }

        $orders = wc_get_orders($args);
        $data = array();

        foreach ($orders as $order) {
            $data[] = $this->format_order($order);
        }

        return rest_ensure_response(array(
            'success' => true,
            'data' => $data,
            'total' => count($data)
        ));
    }

    /**
     * GET /orders/{id}
     */
    public function get_order($request) {
        $order = wc_get_order($request->get_param('id'));

        if (!$order) {
            return new WP_Error('not_found', 'Ordine non trovato', array('status' => 404));
        }

        return rest_ensure_response(array(
            'success' => true,
            'data' => $this->format_order($order, true)
        ));
    }

    /**
     * PUT /orders/{id}/status
     */
    public function update_order_status($request) {
        $order = wc_get_order($request->get_param('id'));

        if (!$order) {
            return new WP_Error('not_found', 'Ordine non trovato', array('status' => 404));
        }

        $data = $request->get_json_params();
        $new_status = isset($data['status']) ? $data['status'] : '';

        if (empty($new_status)) {
            return new WP_Error('missing_status', 'status richiesto', array('status' => 400));
        }

        fabbricami()->hooks->disable_hooks();

        $old_status = $order->get_status();
        $order->set_status($new_status, isset($data['note']) ? $data['note'] : '');
        $order->update_meta_data('_erp_last_sync', current_time('mysql'));
        $order->save();

        fabbricami()->hooks->enable_hooks();

        fabbricami()->logger->sync(
            'incoming',
            'order',
            $order->get_id(),
            'status_update',
            'success',
            sprintf('Status: %s -> %s', $old_status, $new_status)
        );

        return rest_ensure_response(array(
            'success' => true,
            'data' => array(
                'id' => $order->get_id(),
                'old_status' => $old_status,
                'new_status' => $new_status
            )
        ));
    }

    /**
     * PUT /orders/{id}/tracking
     */
    public function update_order_tracking($request) {
        $order = wc_get_order($request->get_param('id'));

        if (!$order) {
            return new WP_Error('not_found', 'Ordine non trovato', array('status' => 404));
        }

        $data = $request->get_json_params();

        $order->update_meta_data('_tracking_number', isset($data['tracking_number']) ? $data['tracking_number'] : '');
        $order->update_meta_data('_tracking_carrier', isset($data['carrier']) ? $data['carrier'] : '');
        $order->update_meta_data('_tracking_url', isset($data['tracking_url']) ? $data['tracking_url'] : '');
        $order->update_meta_data('_shipped_date', isset($data['shipped_date']) ? $data['shipped_date'] : current_time('mysql'));

        // Aggiungi nota ordine
        if (!empty($data['tracking_number'])) {
            $note = sprintf(
                'Spedizione tracciata: %s%s',
                $data['tracking_number'],
                !empty($data['carrier']) ? ' via ' . $data['carrier'] : ''
            );
            $order->add_order_note($note, true); // true = nota visibile al cliente
        }

        $order->save();

        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Tracking aggiornato'
        ));
    }

    /**
     * Formatta ordine per output
     */
    private function format_order($order, $include_items = false) {
        $data = array(
            'id' => $order->get_id(),
            'order_number' => $order->get_order_number(),
            'status' => $order->get_status(),
            'currency' => $order->get_currency(),
            'total' => $order->get_total(),
            'subtotal' => $order->get_subtotal(),
            'shipping_total' => $order->get_shipping_total(),
            'discount_total' => $order->get_discount_total(),
            'tax_total' => $order->get_total_tax(),
            'customer_id' => $order->get_customer_id(),
            'customer_email' => $order->get_billing_email(),
            'billing' => $order->get_address('billing'),
            'shipping' => $order->get_address('shipping'),
            'payment_method' => $order->get_payment_method(),
            'payment_method_title' => $order->get_payment_method_title(),
            'erp_order_id' => $order->get_meta('_erp_order_id'),
            'date_created' => $order->get_date_created() ? $order->get_date_created()->format('c') : null,
            'date_modified' => $order->get_date_modified() ? $order->get_date_modified()->format('c') : null,
            'date_paid' => $order->get_date_paid() ? $order->get_date_paid()->format('c') : null
        );

        if ($include_items) {
            $data['items'] = array();
            foreach ($order->get_items() as $item) {
                $product = $item->get_product();
                $data['items'][] = array(
                    'product_id' => $item->get_product_id(),
                    'variation_id' => $item->get_variation_id(),
                    'sku' => $product ? $product->get_sku() : '',
                    'name' => $item->get_name(),
                    'quantity' => $item->get_quantity(),
                    'subtotal' => $item->get_subtotal(),
                    'total' => $item->get_total(),
                    'tax' => $item->get_total_tax()
                );
            }
        }

        return $data;
    }

    // ==========================================
    // UTILITY ENDPOINTS
    // ==========================================

    /**
     * GET /stats
     */
    public function get_stats($request) {
        return rest_ensure_response(array(
            'success' => true,
            'data' => fabbricami()->get_stats()
        ));
    }

    /**
     * GET /health
     */
    public function get_health($request) {
        $health = get_option('fabbricami_health_status', array());
        return rest_ensure_response(array(
            'success' => true,
            'data' => $health
        ));
    }

    /**
     * GET /queue
     */
    public function get_queue($request) {
        $queue = fabbricami()->sync_queue->get_jobs(array(
            'status' => $request->get_param('status') ?: '',
            'page' => $request->get_param('page') ?: 1,
            'per_page' => $request->get_param('per_page') ?: 50
        ));

        return rest_ensure_response(array(
            'success' => true,
            'data' => $queue
        ));
    }

    /**
     * POST /queue/{id}/retry
     */
    public function retry_queue_item($request) {
        $result = fabbricami()->sync_queue->retry($request->get_param('id'));

        if ($result === false) {
            return new WP_Error('retry_failed', 'Impossibile eseguire retry', array('status' => 400));
        }

        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Job rischedulato per retry'
        ));
    }

    /**
     * GET /conflicts
     */
    public function get_conflicts($request) {
        $conflicts = fabbricami()->conflict_resolver->get_conflicts(array(
            'status' => $request->get_param('status') ?: 'pending',
            'page' => $request->get_param('page') ?: 1,
            'per_page' => $request->get_param('per_page') ?: 50
        ));

        return rest_ensure_response(array(
            'success' => true,
            'data' => $conflicts
        ));
    }

    /**
     * POST /conflicts/{id}/resolve
     */
    public function resolve_conflict($request) {
        $data = $request->get_json_params();
        $strategy = isset($data['strategy']) ? $data['strategy'] : null;
        $manual_data = isset($data['data']) ? $data['data'] : array();

        $result = fabbricami()->conflict_resolver->resolve(
            $request->get_param('id'),
            $strategy,
            $manual_data
        );

        if (is_wp_error($result)) {
            return $result;
        }

        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Conflitto risolto'
        ));
    }

    /**
     * GET /logs
     */
    public function get_logs($request) {
        $logs = fabbricami()->logger->get_logs(array(
            'level' => $request->get_param('level') ?: '',
            'entity' => $request->get_param('entity') ?: '',
            'status' => $request->get_param('status') ?: '',
            'page' => $request->get_param('page') ?: 1,
            'per_page' => $request->get_param('per_page') ?: 50
        ));

        return rest_ensure_response(array(
            'success' => true,
            'data' => $logs
        ));
    }

    /**
     * GET /categories
     */
    public function get_categories($request) {
        $terms = get_terms(array(
            'taxonomy' => 'product_cat',
            'hide_empty' => false
        ));

        $data = array();
        foreach ($terms as $term) {
            $data[] = array(
                'id' => $term->term_id,
                'name' => $term->name,
                'slug' => $term->slug,
                'parent' => $term->parent,
                'count' => $term->count
            );
        }

        return rest_ensure_response(array(
            'success' => true,
            'data' => $data
        ));
    }

    /**
     * GET /customers
     */
    public function get_customers($request) {
        $args = array(
            'role' => 'customer',
            'number' => $request->get_param('per_page') ?: 50,
            'paged' => $request->get_param('page') ?: 1,
            'orderby' => 'registered',
            'order' => 'DESC'
        );

        $users = get_users($args);
        $data = array();

        foreach ($users as $user) {
            $customer = new WC_Customer($user->ID);
            $data[] = $this->format_customer($customer);
        }

        return rest_ensure_response(array(
            'success' => true,
            'data' => $data
        ));
    }

    /**
     * GET /customers/{id}
     */
    public function get_customer($request) {
        $customer = new WC_Customer($request->get_param('id'));

        if (!$customer->get_id()) {
            return new WP_Error('not_found', 'Cliente non trovato', array('status' => 404));
        }

        return rest_ensure_response(array(
            'success' => true,
            'data' => $this->format_customer($customer)
        ));
    }

    /**
     * Formatta cliente per output
     */
    private function format_customer($customer) {
        return array(
            'id' => $customer->get_id(),
            'email' => $customer->get_email(),
            'first_name' => $customer->get_first_name(),
            'last_name' => $customer->get_last_name(),
            'username' => $customer->get_username(),
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
            'orders_count' => $customer->get_order_count(),
            'total_spent' => $customer->get_total_spent(),
            'date_created' => $customer->get_date_created() ? $customer->get_date_created()->format('c') : null
        );
    }

    // ==========================================
    // VARIANTI
    // ==========================================

    /**
     * GET /products/{id}/variations
     */
    public function get_variations($request) {
        $product = wc_get_product($request->get_param('product_id'));

        if (!$product || !$product->is_type('variable')) {
            return new WP_Error('not_found', 'Prodotto variabile non trovato', array('status' => 404));
        }

        $variations = array();
        foreach ($product->get_children() as $variation_id) {
            $variation = wc_get_product($variation_id);
            if ($variation) {
                $variations[] = array(
                    'id' => $variation_id,
                    'sku' => $variation->get_sku(),
                    'price' => $variation->get_price(),
                    'regular_price' => $variation->get_regular_price(),
                    'sale_price' => $variation->get_sale_price(),
                    'stock_quantity' => $variation->get_stock_quantity(),
                    'stock_status' => $variation->get_stock_status(),
                    'attributes' => $variation->get_attributes()
                );
            }
        }

        return rest_ensure_response(array(
            'success' => true,
            'data' => $variations
        ));
    }

    /**
     * POST /products/{id}/variations
     */
    public function create_variation($request) {
        $product = wc_get_product($request->get_param('product_id'));

        if (!$product || !$product->is_type('variable')) {
            return new WP_Error('not_found', 'Prodotto variabile non trovato', array('status' => 404));
        }

        $data = $request->get_json_params();

        fabbricami()->hooks->disable_hooks();

        $variation = new WC_Product_Variation();
        $variation->set_parent_id($product->get_id());

        if (isset($data['sku'])) $variation->set_sku($data['sku']);
        if (isset($data['regular_price'])) $variation->set_regular_price($data['regular_price']);
        if (isset($data['sale_price'])) $variation->set_sale_price($data['sale_price']);
        if (isset($data['stock_quantity'])) $variation->set_stock_quantity($data['stock_quantity']);
        if (isset($data['manage_stock'])) $variation->set_manage_stock($data['manage_stock']);
        if (isset($data['attributes'])) $variation->set_attributes($data['attributes']);

        $variation->save();

        fabbricami()->hooks->enable_hooks();

        return rest_ensure_response(array(
            'success' => true,
            'data' => array(
                'id' => $variation->get_id(),
                'sku' => $variation->get_sku()
            )
        ));
    }

    /**
     * PUT /variations/{id}
     */
    public function update_variation($request) {
        $variation = wc_get_product($request->get_param('id'));

        if (!$variation || !$variation->is_type('variation')) {
            return new WP_Error('not_found', 'Variante non trovata', array('status' => 404));
        }

        $data = $request->get_json_params();

        fabbricami()->hooks->disable_hooks();

        if (isset($data['sku'])) $variation->set_sku($data['sku']);
        if (isset($data['regular_price'])) $variation->set_regular_price($data['regular_price']);
        if (isset($data['sale_price'])) $variation->set_sale_price($data['sale_price']);
        if (isset($data['stock_quantity'])) $variation->set_stock_quantity($data['stock_quantity']);

        $variation->save();

        fabbricami()->hooks->enable_hooks();

        return rest_ensure_response(array(
            'success' => true,
            'message' => 'Variante aggiornata'
        ));
    }
}
