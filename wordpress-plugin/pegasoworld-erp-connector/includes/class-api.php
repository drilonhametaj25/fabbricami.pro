<?php
/**
 * REST API endpoints per ricevere dati dall'ERP
 */

if (!defined('ABSPATH')) {
    exit;
}

class PegasoWorld_ERP_API {

    /**
     * Namespace API
     */
    const API_NAMESPACE = 'pegasoworld/v1';

    /**
     * Costruttore
     */
    public function __construct() {
        add_action('rest_api_init', array($this, 'register_routes'));
    }

    /**
     * Registra routes
     */
    public function register_routes() {
        // Health check
        register_rest_route(self::API_NAMESPACE, '/health', array(
            'methods' => 'GET',
            'callback' => array($this, 'health_check'),
            'permission_callback' => '__return_true' // Pubblico per test connessione
        ));

        // Prodotti
        register_rest_route(self::API_NAMESPACE, '/products', array(
            'methods' => 'POST',
            'callback' => array($this, 'create_or_update_product'),
            'permission_callback' => array(pegasoworld_erp()->auth, 'permission_callback')
        ));

        register_rest_route(self::API_NAMESPACE, '/products/(?P<id>\d+)', array(
            'methods' => array('PUT', 'PATCH'),
            'callback' => array($this, 'update_product'),
            'permission_callback' => array(pegasoworld_erp()->auth, 'permission_callback')
        ));

        register_rest_route(self::API_NAMESPACE, '/products/(?P<id>\d+)/stock', array(
            'methods' => 'PUT',
            'callback' => array($this, 'update_stock'),
            'permission_callback' => array(pegasoworld_erp()->auth, 'permission_callback')
        ));

        register_rest_route(self::API_NAMESPACE, '/products/batch-stock', array(
            'methods' => 'POST',
            'callback' => array($this, 'batch_update_stock'),
            'permission_callback' => array(pegasoworld_erp()->auth, 'permission_callback')
        ));

        // Variazioni
        register_rest_route(self::API_NAMESPACE, '/products/(?P<product_id>\d+)/variations', array(
            'methods' => 'POST',
            'callback' => array($this, 'create_variation'),
            'permission_callback' => array(pegasoworld_erp()->auth, 'permission_callback')
        ));

        register_rest_route(self::API_NAMESPACE, '/variations/(?P<id>\d+)', array(
            'methods' => array('PUT', 'PATCH'),
            'callback' => array($this, 'update_variation'),
            'permission_callback' => array(pegasoworld_erp()->auth, 'permission_callback')
        ));

        // Ordini - aggiorna stato da ERP
        register_rest_route(self::API_NAMESPACE, '/orders/(?P<id>\d+)/status', array(
            'methods' => 'PUT',
            'callback' => array($this, 'update_order_status'),
            'permission_callback' => array(pegasoworld_erp()->auth, 'permission_callback')
        ));

        // Sync completo
        register_rest_route(self::API_NAMESPACE, '/sync/products', array(
            'methods' => 'POST',
            'callback' => array($this, 'sync_products'),
            'permission_callback' => array(pegasoworld_erp()->auth, 'permission_callback')
        ));
    }

    /**
     * Health check
     */
    public function health_check($request) {
        return rest_ensure_response(array(
            'success' => true,
            'status' => 'ok',
            'plugin_version' => PEGASOWORLD_ERP_VERSION,
            'woocommerce_version' => defined('WC_VERSION') ? WC_VERSION : 'N/A',
            'sync_enabled' => pegasoworld_erp()->is_sync_enabled(),
            'timestamp' => current_time('c')
        ));
    }

    /**
     * Crea o aggiorna prodotto
     */
    public function create_or_update_product($request) {
        $data = $request->get_json_params();

        try {
            // Verifica se esiste già per SKU o ID ERP
            $product_id = null;

            if (!empty($data['sku'])) {
                $product_id = wc_get_product_id_by_sku($data['sku']);
            }

            if (!$product_id && !empty($data['erpProductId'])) {
                $product_id = $this->get_product_by_erp_id($data['erpProductId']);
            }

            if ($product_id) {
                // Aggiorna esistente
                $product = wc_get_product($product_id);
            } else {
                // Crea nuovo
                $product_type = isset($data['type']) ? $data['type'] : 'simple';

                switch ($product_type) {
                    case 'variable':
                    case 'WITH_VARIANTS':
                        $product = new WC_Product_Variable();
                        break;
                    case 'digital':
                    case 'DIGITAL':
                        $product = new WC_Product();
                        $product->set_virtual(true);
                        $product->set_downloadable(true);
                        break;
                    default:
                        $product = new WC_Product();
                }
            }

            // Imposta dati base
            if (isset($data['name'])) {
                $product->set_name(sanitize_text_field($data['name']));
            }

            if (isset($data['sku'])) {
                $product->set_sku(sanitize_text_field($data['sku']));
            }

            if (isset($data['description'])) {
                $product->set_description(wp_kses_post($data['description']));
            }

            if (isset($data['shortDescription'])) {
                $product->set_short_description(wp_kses_post($data['shortDescription']));
            }

            if (isset($data['price'])) {
                $product->set_regular_price(floatval($data['price']));
            }

            if (isset($data['salePrice'])) {
                $product->set_sale_price(floatval($data['salePrice']));
            }

            // Status
            if (isset($data['status'])) {
                $status = $data['status'] === true || $data['status'] === 'publish' ? 'publish' : 'draft';
                $product->set_status($status);
            }

            // Stock
            if (isset($data['manageStock'])) {
                $product->set_manage_stock($data['manageStock']);
            }

            if (isset($data['stock'])) {
                $product->set_stock_quantity(intval($data['stock']));
            }

            if (isset($data['stockStatus'])) {
                $product->set_stock_status($data['stockStatus']);
            }

            // Peso e dimensioni
            if (isset($data['weight'])) {
                $product->set_weight(floatval($data['weight']));
            }

            if (isset($data['dimensions'])) {
                if (isset($data['dimensions']['width'])) {
                    $product->set_width(floatval($data['dimensions']['width']));
                }
                if (isset($data['dimensions']['height'])) {
                    $product->set_height(floatval($data['dimensions']['height']));
                }
                if (isset($data['dimensions']['depth'])) {
                    $product->set_length(floatval($data['dimensions']['depth']));
                }
            }

            // Tasse
            if (isset($data['taxStatus'])) {
                $product->set_tax_status($data['taxStatus']);
            }

            if (isset($data['taxClass'])) {
                $product->set_tax_class($data['taxClass']);
            }

            // Categoria
            if (!empty($data['category'])) {
                $term = get_term_by('name', $data['category'], 'product_cat');
                if (!$term) {
                    $term = wp_insert_term($data['category'], 'product_cat');
                    if (!is_wp_error($term)) {
                        $term = get_term($term['term_id'], 'product_cat');
                    }
                }
                if ($term && !is_wp_error($term)) {
                    $product->set_category_ids(array($term->term_id));
                }
            }

            // Attributi (per prodotti variabili)
            if (!empty($data['attributes']) && $product instanceof WC_Product_Variable) {
                $this->set_product_attributes($product, $data['attributes']);
            }

            // File scaricabili (per prodotti digitali)
            if (!empty($data['downloadFiles']) && $product->is_downloadable()) {
                $this->set_downloadable_files($product, $data['downloadFiles']);
            }

            // Immagini
            if (!empty($data['images'])) {
                $this->set_product_images($product, $data['images']);
            }

            // Salva ID ERP come meta
            if (!empty($data['erpProductId'])) {
                $product->update_meta_data('_pegasoworld_erp_product_id', $data['erpProductId']);
            }

            $product->save();

            pegasoworld_erp()->log('from_erp', 'product', $product->get_id(), $product_id ? 'update' : 'create', 'success', 'SKU: ' . $product->get_sku());

            return rest_ensure_response(array(
                'success' => true,
                'data' => array(
                    'id' => $product->get_id(),
                    'sku' => $product->get_sku(),
                    'permalink' => get_permalink($product->get_id())
                )
            ));

        } catch (Exception $e) {
            pegasoworld_erp()->log('from_erp', 'product', isset($data['sku']) ? $data['sku'] : 'unknown', 'error', 'error', $e->getMessage());

            return new WP_Error('product_error', $e->getMessage(), array('status' => 500));
        }
    }

    /**
     * Aggiorna prodotto esistente
     */
    public function update_product($request) {
        $product_id = intval($request->get_param('id'));
        $product = wc_get_product($product_id);

        if (!$product) {
            return new WP_Error('not_found', 'Prodotto non trovato', array('status' => 404));
        }

        // Simula richiesta POST con ID esistente
        $data = $request->get_json_params();
        $data['erpProductId'] = $product->get_meta('_pegasoworld_erp_product_id');

        $request->set_body(wp_json_encode($data));
        return $this->create_or_update_product($request);
    }

    /**
     * Aggiorna stock singolo prodotto
     */
    public function update_stock($request) {
        if (get_option('pegasoworld_erp_sync_stock', '1') !== '1') {
            return new WP_Error('sync_disabled', 'Sincronizzazione stock disabilitata', array('status' => 403));
        }

        $product_id = intval($request->get_param('id'));
        $data = $request->get_json_params();

        $product = wc_get_product($product_id);

        if (!$product) {
            return new WP_Error('not_found', 'Prodotto non trovato', array('status' => 404));
        }

        try {
            $old_stock = $product->get_stock_quantity();
            $new_stock = isset($data['quantity']) ? intval($data['quantity']) : 0;

            $product->set_stock_quantity($new_stock);

            // Imposta stato stock
            if ($new_stock > 0) {
                $product->set_stock_status('instock');
            } else {
                $product->set_stock_status('outofstock');
            }

            $product->save();

            pegasoworld_erp()->log('from_erp', 'stock', $product_id, 'update', 'success', "Stock: $old_stock → $new_stock");

            return rest_ensure_response(array(
                'success' => true,
                'data' => array(
                    'id' => $product_id,
                    'sku' => $product->get_sku(),
                    'oldStock' => $old_stock,
                    'newStock' => $new_stock
                )
            ));

        } catch (Exception $e) {
            pegasoworld_erp()->log('from_erp', 'stock', $product_id, 'update', 'error', $e->getMessage());
            return new WP_Error('stock_error', $e->getMessage(), array('status' => 500));
        }
    }

    /**
     * Aggiorna stock in batch
     */
    public function batch_update_stock($request) {
        if (get_option('pegasoworld_erp_sync_stock', '1') !== '1') {
            return new WP_Error('sync_disabled', 'Sincronizzazione stock disabilitata', array('status' => 403));
        }

        $data = $request->get_json_params();
        $items = isset($data['items']) ? $data['items'] : array();

        $results = array(
            'success' => array(),
            'errors' => array()
        );

        foreach ($items as $item) {
            $product_id = null;

            // Trova prodotto per ID WooCommerce, SKU o ID ERP
            if (!empty($item['woocommerceId'])) {
                $product_id = intval($item['woocommerceId']);
            } elseif (!empty($item['sku'])) {
                $product_id = wc_get_product_id_by_sku($item['sku']);
            } elseif (!empty($item['erpProductId'])) {
                $product_id = $this->get_product_by_erp_id($item['erpProductId']);
            }

            if (!$product_id) {
                $results['errors'][] = array(
                    'identifier' => $item['sku'] ?? $item['erpProductId'] ?? 'unknown',
                    'error' => 'Prodotto non trovato'
                );
                continue;
            }

            $product = wc_get_product($product_id);

            if (!$product) {
                $results['errors'][] = array(
                    'identifier' => $product_id,
                    'error' => 'Prodotto non valido'
                );
                continue;
            }

            try {
                $quantity = isset($item['quantity']) ? intval($item['quantity']) : 0;
                $product->set_stock_quantity($quantity);
                $product->set_stock_status($quantity > 0 ? 'instock' : 'outofstock');
                $product->save();

                $results['success'][] = array(
                    'id' => $product_id,
                    'sku' => $product->get_sku(),
                    'quantity' => $quantity
                );

            } catch (Exception $e) {
                $results['errors'][] = array(
                    'id' => $product_id,
                    'error' => $e->getMessage()
                );
            }
        }

        pegasoworld_erp()->log('from_erp', 'stock', 'batch', 'batch_update', 'success',
            sprintf('Updated: %d, Errors: %d', count($results['success']), count($results['errors']))
        );

        return rest_ensure_response(array(
            'success' => true,
            'data' => $results
        ));
    }

    /**
     * Crea variazione prodotto
     */
    public function create_variation($request) {
        $product_id = intval($request->get_param('product_id'));
        $data = $request->get_json_params();

        $product = wc_get_product($product_id);

        if (!$product || !$product->is_type('variable')) {
            return new WP_Error('invalid_product', 'Prodotto variabile non trovato', array('status' => 404));
        }

        try {
            $variation = new WC_Product_Variation();
            $variation->set_parent_id($product_id);

            if (isset($data['sku'])) {
                $variation->set_sku(sanitize_text_field($data['sku']));
            }

            if (isset($data['price'])) {
                $variation->set_regular_price(floatval($data['price']));
            }

            if (isset($data['stock'])) {
                $variation->set_manage_stock(true);
                $variation->set_stock_quantity(intval($data['stock']));
            }

            if (isset($data['attributes'])) {
                $variation->set_attributes($data['attributes']);
            }

            if (isset($data['status'])) {
                $status = $data['status'] === true || $data['status'] === 'publish' ? 'publish' : 'private';
                $variation->set_status($status);
            }

            if (!empty($data['erpVariantId'])) {
                $variation->update_meta_data('_pegasoworld_erp_variant_id', $data['erpVariantId']);
            }

            $variation->save();

            pegasoworld_erp()->log('from_erp', 'variation', $variation->get_id(), 'create', 'success', 'Parent: ' . $product_id);

            return rest_ensure_response(array(
                'success' => true,
                'data' => array(
                    'id' => $variation->get_id(),
                    'parentId' => $product_id,
                    'sku' => $variation->get_sku()
                )
            ));

        } catch (Exception $e) {
            pegasoworld_erp()->log('from_erp', 'variation', $product_id, 'create', 'error', $e->getMessage());
            return new WP_Error('variation_error', $e->getMessage(), array('status' => 500));
        }
    }

    /**
     * Aggiorna variazione
     */
    public function update_variation($request) {
        $variation_id = intval($request->get_param('id'));
        $data = $request->get_json_params();

        $variation = wc_get_product($variation_id);

        if (!$variation || !$variation->is_type('variation')) {
            return new WP_Error('not_found', 'Variazione non trovata', array('status' => 404));
        }

        try {
            if (isset($data['price'])) {
                $variation->set_regular_price(floatval($data['price']));
            }

            if (isset($data['stock'])) {
                $variation->set_stock_quantity(intval($data['stock']));
            }

            if (isset($data['status'])) {
                $status = $data['status'] === true || $data['status'] === 'publish' ? 'publish' : 'private';
                $variation->set_status($status);
            }

            $variation->save();

            pegasoworld_erp()->log('from_erp', 'variation', $variation_id, 'update', 'success', '');

            return rest_ensure_response(array(
                'success' => true,
                'data' => array(
                    'id' => $variation_id,
                    'sku' => $variation->get_sku()
                )
            ));

        } catch (Exception $e) {
            pegasoworld_erp()->log('from_erp', 'variation', $variation_id, 'update', 'error', $e->getMessage());
            return new WP_Error('variation_error', $e->getMessage(), array('status' => 500));
        }
    }

    /**
     * Aggiorna stato ordine da ERP
     */
    public function update_order_status($request) {
        $order_id = intval($request->get_param('id'));
        $data = $request->get_json_params();

        $order = wc_get_order($order_id);

        if (!$order) {
            return new WP_Error('not_found', 'Ordine non trovato', array('status' => 404));
        }

        try {
            // Mappa stati ERP → WooCommerce
            $status_map = array(
                'PENDING' => 'pending',
                'CONFIRMED' => 'processing',
                'PROCESSING' => 'processing',
                'READY' => 'processing',
                'SHIPPED' => 'completed',
                'DELIVERED' => 'completed',
                'CANCELLED' => 'cancelled',
                'REFUNDED' => 'refunded'
            );

            $erp_status = isset($data['status']) ? $data['status'] : '';
            $wc_status = isset($status_map[$erp_status]) ? $status_map[$erp_status] : '';

            if (empty($wc_status)) {
                return new WP_Error('invalid_status', 'Stato non valido: ' . $erp_status, array('status' => 400));
            }

            $old_status = $order->get_status();
            $order->set_status($wc_status, isset($data['note']) ? $data['note'] : '');
            $order->save();

            pegasoworld_erp()->log('from_erp', 'order', $order_id, 'status_change', 'success', "$old_status → $wc_status");

            return rest_ensure_response(array(
                'success' => true,
                'data' => array(
                    'id' => $order_id,
                    'oldStatus' => $old_status,
                    'newStatus' => $wc_status
                )
            ));

        } catch (Exception $e) {
            pegasoworld_erp()->log('from_erp', 'order', $order_id, 'status_change', 'error', $e->getMessage());
            return new WP_Error('order_error', $e->getMessage(), array('status' => 500));
        }
    }

    /**
     * Sync multipli prodotti
     */
    public function sync_products($request) {
        $data = $request->get_json_params();
        $products = isset($data['products']) ? $data['products'] : array();

        $results = array(
            'created' => 0,
            'updated' => 0,
            'errors' => array()
        );

        foreach ($products as $product_data) {
            // Crea richiesta fittizia
            $sub_request = new WP_REST_Request('POST');
            $sub_request->set_body(wp_json_encode($product_data));
            $sub_request->set_header('Content-Type', 'application/json');

            $response = $this->create_or_update_product($sub_request);

            if (is_wp_error($response)) {
                $results['errors'][] = array(
                    'sku' => isset($product_data['sku']) ? $product_data['sku'] : 'unknown',
                    'error' => $response->get_error_message()
                );
            } else {
                $resp_data = $response->get_data();
                if (isset($resp_data['data']['id'])) {
                    $results['updated']++;
                } else {
                    $results['created']++;
                }
            }
        }

        return rest_ensure_response(array(
            'success' => true,
            'data' => $results
        ));
    }

    // ==========================================
    // HELPER METHODS
    // ==========================================

    /**
     * Trova prodotto per ID ERP
     */
    private function get_product_by_erp_id($erp_id) {
        global $wpdb;

        $product_id = $wpdb->get_var($wpdb->prepare(
            "SELECT post_id FROM {$wpdb->postmeta}
             WHERE meta_key = '_pegasoworld_erp_product_id' AND meta_value = %s
             LIMIT 1",
            $erp_id
        ));

        return $product_id ? intval($product_id) : null;
    }

    /**
     * Imposta attributi prodotto
     */
    private function set_product_attributes($product, $attributes) {
        $product_attributes = array();

        foreach ($attributes as $attr) {
            $name = isset($attr['name']) ? wc_sanitize_taxonomy_name($attr['name']) : '';
            $options = isset($attr['options']) ? $attr['options'] : array();

            if (empty($name)) continue;

            // Crea attributo locale (non tassonomia)
            $attribute = new WC_Product_Attribute();
            $attribute->set_name($attr['name']);
            $attribute->set_options($options);
            $attribute->set_visible(true);
            $attribute->set_variation(true);

            $product_attributes[] = $attribute;
        }

        $product->set_attributes($product_attributes);
    }

    /**
     * Imposta file scaricabili
     */
    private function set_downloadable_files($product, $files) {
        $downloads = array();

        foreach ($files as $file) {
            $download = new WC_Product_Download();
            $download->set_name(isset($file['name']) ? $file['name'] : 'Download');
            $download->set_file(isset($file['url']) ? $file['url'] : '');

            if (!empty($file['id'])) {
                $download->set_id($file['id']);
            }

            $downloads[] = $download;
        }

        $product->set_downloads($downloads);

        // Imposta limite download e scadenza se specificati
        if (isset($files[0]['downloadLimit'])) {
            $product->set_download_limit(intval($files[0]['downloadLimit']));
        }

        if (isset($files[0]['downloadExpiry'])) {
            $product->set_download_expiry(intval($files[0]['downloadExpiry']));
        }
    }

    /**
     * Imposta immagini prodotto
     */
    private function set_product_images($product, $images) {
        if (empty($images)) return;

        $attachment_ids = array();

        foreach ($images as $index => $image_url) {
            $attachment_id = $this->upload_image_from_url($image_url);

            if ($attachment_id) {
                if ($index === 0) {
                    $product->set_image_id($attachment_id);
                } else {
                    $attachment_ids[] = $attachment_id;
                }
            }
        }

        if (!empty($attachment_ids)) {
            $product->set_gallery_image_ids($attachment_ids);
        }
    }

    /**
     * Upload immagine da URL
     */
    private function upload_image_from_url($url) {
        if (empty($url)) return null;

        require_once(ABSPATH . 'wp-admin/includes/file.php');
        require_once(ABSPATH . 'wp-admin/includes/media.php');
        require_once(ABSPATH . 'wp-admin/includes/image.php');

        // Scarica file temporaneo
        $tmp = download_url($url);

        if (is_wp_error($tmp)) {
            return null;
        }

        $filename = basename(parse_url($url, PHP_URL_PATH));
        $file_array = array(
            'name' => $filename,
            'tmp_name' => $tmp
        );

        // Upload come media
        $attachment_id = media_handle_sideload($file_array, 0);

        // Pulisci
        @unlink($tmp);

        if (is_wp_error($attachment_id)) {
            return null;
        }

        return $attachment_id;
    }
}
