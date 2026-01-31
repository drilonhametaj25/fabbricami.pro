<?php
/**
 * FabbricaMi Hooks
 *
 * Hooks WooCommerce per catturare eventi e sincronizzare con ERP
 *
 * @package FabbricaMi
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Classe Hooks
 */
class FabbricaMi_Hooks {

    /**
     * Flag per prevenire loop di sync
     */
    private $syncing = false;

    /**
     * Costruttore
     */
    public function __construct() {
        if (!class_exists('WooCommerce')) {
            return;
        }

        $this->init_hooks();
    }

    /**
     * Inizializza tutti gli hooks
     */
    private function init_hooks() {
        // === ORDINI ===
        add_action('woocommerce_new_order', array($this, 'on_new_order'), 10, 2);
        add_action('woocommerce_order_status_changed', array($this, 'on_order_status_changed'), 10, 4);
        add_action('woocommerce_update_order', array($this, 'on_order_update'), 10, 2);
        add_action('woocommerce_order_refunded', array($this, 'on_order_refunded'), 10, 2);

        // === PRODOTTI ===
        add_action('woocommerce_update_product', array($this, 'on_product_update'), 10, 2);
        add_action('woocommerce_new_product', array($this, 'on_new_product'), 10, 2);
        add_action('before_delete_post', array($this, 'on_product_delete'), 10, 1);
        add_action('woocommerce_update_product_variation', array($this, 'on_variation_update'), 10, 2);

        // === STOCK ===
        add_action('woocommerce_product_set_stock', array($this, 'on_stock_change'), 10, 1);
        add_action('woocommerce_variation_set_stock', array($this, 'on_variation_stock_change'), 10, 1);

        // === CLIENTI ===
        add_action('woocommerce_created_customer', array($this, 'on_customer_created'), 10, 3);
        add_action('woocommerce_update_customer', array($this, 'on_customer_update'), 10, 2);
        add_action('profile_update', array($this, 'on_profile_update'), 10, 2);

        // === CHECKOUT ===
        add_action('woocommerce_checkout_order_processed', array($this, 'on_checkout_complete'), 10, 3);
        add_action('woocommerce_payment_complete', array($this, 'on_payment_complete'), 10, 1);

        // === HOOK REST API per import da ERP ===
        add_filter('woocommerce_rest_pre_insert_product_object', array($this, 'mark_erp_import'), 10, 3);
    }

    /**
     * Verifica se sync e abilitato
     */
    private function should_sync() {
        if ($this->syncing) {
            return false;
        }

        if (!fabbricami()->is_sync_enabled()) {
            return false;
        }

        if (!fabbricami()->is_wizard_completed()) {
            return false;
        }

        return true;
    }

    /**
     * Imposta flag syncing (per prevenire loop)
     */
    public function set_syncing($syncing) {
        $this->syncing = $syncing;
    }

    // ==========================================
    // ORDINI
    // ==========================================

    /**
     * Nuovo ordine creato
     */
    public function on_new_order($order_id, $order = null) {
        if (!$this->should_sync()) {
            return;
        }

        if (get_option('fabbricami_sync_orders', '1') !== '1') {
            return;
        }

        if (!$order) {
            $order = wc_get_order($order_id);
        }

        if (!$order) {
            return;
        }

        // Skip ordini da admin (potrebbero essere importati)
        if ($order->get_created_via() === 'admin' && $order->get_meta('_erp_imported')) {
            return;
        }

        fabbricami()->sync_queue->add_urgent(
            'order',
            $order_id,
            'create',
            array(
                'order_number' => $order->get_order_number(),
                'status' => $order->get_status(),
                'total' => $order->get_total()
            )
        );

        fabbricami()->logger->sync(
            'outgoing',
            'order',
            $order_id,
            'new_order',
            'queued',
            'Nuovo ordine in coda per sync'
        );
    }

    /**
     * Cambio stato ordine
     */
    public function on_order_status_changed($order_id, $old_status, $new_status, $order) {
        if (!$this->should_sync()) {
            return;
        }

        if (get_option('fabbricami_sync_orders', '1') !== '1') {
            return;
        }

        // Mappa stati WC a stati ERP
        $status_map = array(
            'pending' => 'PENDING',
            'processing' => 'CONFIRMED',
            'on-hold' => 'ON_HOLD',
            'completed' => 'DELIVERED',
            'cancelled' => 'CANCELLED',
            'refunded' => 'REFUNDED',
            'failed' => 'FAILED'
        );

        $erp_status = isset($status_map[$new_status]) ? $status_map[$new_status] : strtoupper($new_status);

        fabbricami()->sync_queue->add(
            'order',
            $order_id,
            'status_change',
            array(
                'old_status' => $old_status,
                'new_status' => $new_status,
                'erp_status' => $erp_status
            ),
            FabbricaMi_Sync_Queue::PRIORITY_HIGH
        );

        fabbricami()->logger->sync(
            'outgoing',
            'order',
            $order_id,
            'status_changed',
            'queued',
            sprintf('Stato cambiato: %s -> %s', $old_status, $new_status)
        );
    }

    /**
     * Ordine aggiornato
     */
    public function on_order_update($order_id, $order) {
        if (!$this->should_sync()) {
            return;
        }

        // Evita duplicati per cambio status (gestito separatamente)
        if (did_action('woocommerce_order_status_changed')) {
            return;
        }

        fabbricami()->sync_queue->add(
            'order',
            $order_id,
            'update',
            array(),
            FabbricaMi_Sync_Queue::PRIORITY_NORMAL
        );
    }

    /**
     * Ordine rimborsato
     */
    public function on_order_refunded($order_id, $refund_id) {
        if (!$this->should_sync()) {
            return;
        }

        $order = wc_get_order($order_id);
        $refund = wc_get_order($refund_id);

        if (!$order || !$refund) {
            return;
        }

        fabbricami()->sync_queue->add_urgent(
            'order',
            $order_id,
            'refund',
            array(
                'refund_id' => $refund_id,
                'refund_amount' => $refund->get_amount(),
                'refund_reason' => $refund->get_reason()
            )
        );

        fabbricami()->logger->sync(
            'outgoing',
            'order',
            $order_id,
            'refunded',
            'queued',
            sprintf('Rimborso: %s', wc_price($refund->get_amount()))
        );
    }

    // ==========================================
    // PRODOTTI
    // ==========================================

    /**
     * Prodotto aggiornato
     */
    public function on_product_update($product_id, $product = null) {
        if (!$this->should_sync()) {
            return;
        }

        if (get_option('fabbricami_sync_products', '1') !== '1') {
            return;
        }

        if (!$product) {
            $product = wc_get_product($product_id);
        }

        if (!$product) {
            return;
        }

        // Skip se importato da ERP (evita loop)
        if ($product->get_meta('_erp_importing')) {
            $product->delete_meta_data('_erp_importing');
            $product->save();
            return;
        }

        fabbricami()->sync_queue->add(
            'product',
            $product_id,
            'update',
            array(
                'sku' => $product->get_sku(),
                'name' => $product->get_name()
            ),
            FabbricaMi_Sync_Queue::PRIORITY_NORMAL
        );

        fabbricami()->logger->sync(
            'outgoing',
            'product',
            $product_id,
            'product_updated',
            'queued',
            sprintf('Prodotto aggiornato: %s', $product->get_name())
        );
    }

    /**
     * Nuovo prodotto creato
     */
    public function on_new_product($product_id, $product = null) {
        if (!$this->should_sync()) {
            return;
        }

        if (get_option('fabbricami_sync_products', '1') !== '1') {
            return;
        }

        if (!$product) {
            $product = wc_get_product($product_id);
        }

        if (!$product) {
            return;
        }

        fabbricami()->sync_queue->add(
            'product',
            $product_id,
            'create',
            array(
                'sku' => $product->get_sku(),
                'name' => $product->get_name()
            ),
            FabbricaMi_Sync_Queue::PRIORITY_NORMAL
        );

        fabbricami()->logger->sync(
            'outgoing',
            'product',
            $product_id,
            'product_created',
            'queued',
            sprintf('Nuovo prodotto: %s', $product->get_name())
        );
    }

    /**
     * Prodotto eliminato
     */
    public function on_product_delete($post_id) {
        if (!$this->should_sync()) {
            return;
        }

        if (get_post_type($post_id) !== 'product') {
            return;
        }

        $product = wc_get_product($post_id);
        if (!$product) {
            return;
        }

        fabbricami()->sync_queue->add(
            'product',
            $post_id,
            'delete',
            array(
                'sku' => $product->get_sku(),
                'name' => $product->get_name()
            ),
            FabbricaMi_Sync_Queue::PRIORITY_HIGH
        );

        fabbricami()->logger->sync(
            'outgoing',
            'product',
            $post_id,
            'product_deleted',
            'queued',
            sprintf('Prodotto eliminato: %s', $product->get_name())
        );
    }

    /**
     * Variante prodotto aggiornata
     */
    public function on_variation_update($variation_id, $product_id = null) {
        if (!$this->should_sync()) {
            return;
        }

        $variation = wc_get_product($variation_id);
        if (!$variation) {
            return;
        }

        $parent_id = $variation->get_parent_id();

        fabbricami()->sync_queue->add(
            'product',
            $parent_id,
            'update',
            array(
                'variation_id' => $variation_id,
                'variation_sku' => $variation->get_sku()
            ),
            FabbricaMi_Sync_Queue::PRIORITY_NORMAL
        );
    }

    // ==========================================
    // STOCK
    // ==========================================

    /**
     * Stock prodotto cambiato
     */
    public function on_stock_change($product) {
        if (!$this->should_sync()) {
            return;
        }

        if (get_option('fabbricami_sync_stock', '1') !== '1') {
            return;
        }

        if (!$product) {
            return;
        }

        fabbricami()->sync_queue->add(
            'stock',
            $product->get_id(),
            'update',
            array(
                'sku' => $product->get_sku(),
                'stock_quantity' => $product->get_stock_quantity(),
                'stock_status' => $product->get_stock_status()
            ),
            FabbricaMi_Sync_Queue::PRIORITY_HIGH
        );

        fabbricami()->logger->sync(
            'outgoing',
            'stock',
            $product->get_id(),
            'stock_changed',
            'queued',
            sprintf('Stock: %d', $product->get_stock_quantity())
        );
    }

    /**
     * Stock variante cambiato
     */
    public function on_variation_stock_change($variation) {
        $this->on_stock_change($variation);
    }

    // ==========================================
    // CLIENTI
    // ==========================================

    /**
     * Nuovo cliente creato
     */
    public function on_customer_created($customer_id, $new_customer_data, $password_generated) {
        if (!$this->should_sync()) {
            return;
        }

        if (get_option('fabbricami_sync_customers', '1') !== '1') {
            return;
        }

        fabbricami()->sync_queue->add(
            'customer',
            $customer_id,
            'create',
            array(
                'email' => isset($new_customer_data['user_email']) ? $new_customer_data['user_email'] : ''
            ),
            FabbricaMi_Sync_Queue::PRIORITY_NORMAL
        );

        fabbricami()->logger->sync(
            'outgoing',
            'customer',
            $customer_id,
            'customer_created',
            'queued',
            'Nuovo cliente in coda'
        );
    }

    /**
     * Cliente aggiornato (WooCommerce)
     */
    public function on_customer_update($customer_id, $customer = null) {
        if (!$this->should_sync()) {
            return;
        }

        if (get_option('fabbricami_sync_customers', '1') !== '1') {
            return;
        }

        fabbricami()->sync_queue->add(
            'customer',
            $customer_id,
            'update',
            array(),
            FabbricaMi_Sync_Queue::PRIORITY_LOW
        );
    }

    /**
     * Profilo utente aggiornato (WordPress)
     */
    public function on_profile_update($user_id, $old_user_data) {
        // Solo per clienti WooCommerce
        $user = get_user_by('id', $user_id);
        if (!$user || !in_array('customer', $user->roles)) {
            return;
        }

        $this->on_customer_update($user_id);
    }

    // ==========================================
    // CHECKOUT
    // ==========================================

    /**
     * Checkout completato
     */
    public function on_checkout_complete($order_id, $posted_data, $order) {
        // Ordine gia gestito da on_new_order
        // Qui possiamo aggiungere logica extra se necessario

        // Esempio: tag cliente come "ha_ordinato"
        $customer_id = $order->get_customer_id();
        if ($customer_id) {
            update_user_meta($customer_id, '_has_ordered', '1');
            update_user_meta($customer_id, '_last_order_date', current_time('mysql'));
        }
    }

    /**
     * Pagamento completato
     */
    public function on_payment_complete($order_id) {
        if (!$this->should_sync()) {
            return;
        }

        $order = wc_get_order($order_id);
        if (!$order) {
            return;
        }

        // Notifica ERP del pagamento
        fabbricami()->sync_queue->add_urgent(
            'order',
            $order_id,
            'payment_complete',
            array(
                'payment_method' => $order->get_payment_method(),
                'payment_method_title' => $order->get_payment_method_title(),
                'total_paid' => $order->get_total()
            )
        );

        fabbricami()->logger->sync(
            'outgoing',
            'order',
            $order_id,
            'payment_complete',
            'queued',
            sprintf('Pagamento: %s via %s', wc_price($order->get_total()), $order->get_payment_method_title())
        );
    }

    // ==========================================
    // UTILITY
    // ==========================================

    /**
     * Marca prodotto come importato da ERP (per evitare loop)
     */
    public function mark_erp_import($product, $request, $creating) {
        // Se la richiesta viene dall'API ERP
        $api_key = $request->get_header('X-Fabbricami-Api-Key');

        if (!empty($api_key) && fabbricami()->auth->verify_api_key($api_key)) {
            $product->update_meta_data('_erp_importing', '1');
            $product->update_meta_data('_erp_imported', current_time('mysql'));
        }

        return $product;
    }

    /**
     * Disabilita temporaneamente tutti gli hooks
     */
    public function disable_hooks() {
        $this->syncing = true;
    }

    /**
     * Riabilita hooks
     */
    public function enable_hooks() {
        $this->syncing = false;
    }
}
