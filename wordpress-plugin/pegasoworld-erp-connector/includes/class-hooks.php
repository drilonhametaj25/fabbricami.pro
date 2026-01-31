<?php
/**
 * Hook WooCommerce per sincronizzazione con ERP
 */

if (!defined('ABSPATH')) {
    exit;
}

class PegasoWorld_ERP_Hooks {

    /**
     * Costruttore
     */
    public function __construct() {
        // Ordini
        add_action('woocommerce_new_order', array($this, 'on_new_order'), 10, 2);
        add_action('woocommerce_order_status_changed', array($this, 'on_order_status_changed'), 10, 4);
        add_action('woocommerce_payment_complete', array($this, 'on_payment_complete'), 10, 1);

        // Clienti
        add_action('woocommerce_created_customer', array($this, 'on_customer_created'), 10, 3);
        add_action('woocommerce_update_customer', array($this, 'on_customer_updated'), 10, 2);

        // Stock (opzionale - per notificare cambi stock da WP)
        add_action('woocommerce_product_set_stock', array($this, 'on_stock_changed'), 10, 1);
        add_action('woocommerce_variation_set_stock', array($this, 'on_variation_stock_changed'), 10, 1);
    }

    /**
     * Nuovo ordine creato
     */
    public function on_new_order($order_id, $order = null) {
        if (!pegasoworld_erp()->is_sync_enabled()) {
            return;
        }

        if (get_option('pegasoworld_erp_sync_orders', '1') !== '1') {
            return;
        }

        if (!$order) {
            $order = wc_get_order($order_id);
        }

        if (!$order) {
            return;
        }

        // Previeni doppia sincronizzazione
        if ($order->get_meta('_pegasoworld_erp_synced')) {
            return;
        }

        // Prepara dati ordine
        $order_data = $this->prepare_order_data($order);

        // Invia all'ERP
        $response = pegasoworld_erp()->send_to_erp('/api/wordpress/plugin/order', $order_data);

        if (is_wp_error($response)) {
            pegasoworld_erp()->log('to_erp', 'order', $order_id, 'create', 'error', $response->get_error_message());
            return;
        }

        // Marca come sincronizzato
        $order->update_meta_data('_pegasoworld_erp_synced', '1');
        $order->update_meta_data('_pegasoworld_erp_id', isset($response['data']['id']) ? $response['data']['id'] : '');
        $order->save();

        pegasoworld_erp()->log('to_erp', 'order', $order_id, 'create', 'success', 'Ordine sincronizzato');
    }

    /**
     * Stato ordine cambiato
     */
    public function on_order_status_changed($order_id, $old_status, $new_status, $order) {
        if (!pegasoworld_erp()->is_sync_enabled()) {
            return;
        }

        if (get_option('pegasoworld_erp_sync_orders', '1') !== '1') {
            return;
        }

        $erp_id = $order->get_meta('_pegasoworld_erp_id');

        // Se non è stato ancora sincronizzato, sincronizza come nuovo
        if (empty($erp_id)) {
            $this->on_new_order($order_id, $order);
            return;
        }

        // Mappa stati WooCommerce → ERP
        $status_map = array(
            'pending' => 'PENDING',
            'on-hold' => 'PENDING',
            'processing' => 'CONFIRMED',
            'completed' => 'DELIVERED',
            'cancelled' => 'CANCELLED',
            'refunded' => 'REFUNDED',
            'failed' => 'CANCELLED'
        );

        $erp_status = isset($status_map[$new_status]) ? $status_map[$new_status] : 'PENDING';

        $data = array(
            'wordpressOrderId' => $order_id,
            'erpOrderId' => $erp_id,
            'oldStatus' => $old_status,
            'newStatus' => $new_status,
            'erpStatus' => $erp_status
        );

        $response = pegasoworld_erp()->send_to_erp('/api/wordpress/plugin/order-status', $data);

        if (is_wp_error($response)) {
            pegasoworld_erp()->log('to_erp', 'order', $order_id, 'status_change', 'error', $response->get_error_message());
            return;
        }

        pegasoworld_erp()->log('to_erp', 'order', $order_id, 'status_change', 'success', "Status: $old_status → $new_status");
    }

    /**
     * Pagamento completato
     */
    public function on_payment_complete($order_id) {
        if (!pegasoworld_erp()->is_sync_enabled()) {
            return;
        }

        $order = wc_get_order($order_id);
        if (!$order) {
            return;
        }

        $erp_id = $order->get_meta('_pegasoworld_erp_id');
        if (empty($erp_id)) {
            return;
        }

        $data = array(
            'wordpressOrderId' => $order_id,
            'erpOrderId' => $erp_id,
            'paymentStatus' => 'paid',
            'paymentMethod' => $order->get_payment_method(),
            'paymentDate' => current_time('c')
        );

        $response = pegasoworld_erp()->send_to_erp('/api/wordpress/plugin/order-payment', $data);

        if (is_wp_error($response)) {
            pegasoworld_erp()->log('to_erp', 'order', $order_id, 'payment', 'error', $response->get_error_message());
            return;
        }

        pegasoworld_erp()->log('to_erp', 'order', $order_id, 'payment', 'success', 'Pagamento notificato');
    }

    /**
     * Nuovo cliente creato
     */
    public function on_customer_created($customer_id, $new_customer_data, $password_generated) {
        if (!pegasoworld_erp()->is_sync_enabled()) {
            return;
        }

        if (get_option('pegasoworld_erp_sync_customers', '1') !== '1') {
            return;
        }

        $customer = new WC_Customer($customer_id);
        $customer_data = $this->prepare_customer_data($customer);

        $response = pegasoworld_erp()->send_to_erp('/api/wordpress/plugin/customer', $customer_data);

        if (is_wp_error($response)) {
            pegasoworld_erp()->log('to_erp', 'customer', $customer_id, 'create', 'error', $response->get_error_message());
            return;
        }

        // Salva ID ERP nel customer
        if (isset($response['data']['id'])) {
            update_user_meta($customer_id, '_pegasoworld_erp_customer_id', $response['data']['id']);
        }

        pegasoworld_erp()->log('to_erp', 'customer', $customer_id, 'create', 'success', 'Cliente sincronizzato');
    }

    /**
     * Cliente aggiornato
     */
    public function on_customer_updated($customer_id, $customer) {
        if (!pegasoworld_erp()->is_sync_enabled()) {
            return;
        }

        if (get_option('pegasoworld_erp_sync_customers', '1') !== '1') {
            return;
        }

        $erp_customer_id = get_user_meta($customer_id, '_pegasoworld_erp_customer_id', true);

        // Se non esiste nell'ERP, crealo
        if (empty($erp_customer_id)) {
            $this->on_customer_created($customer_id, array(), false);
            return;
        }

        $wc_customer = new WC_Customer($customer_id);
        $customer_data = $this->prepare_customer_data($wc_customer);
        $customer_data['erpCustomerId'] = $erp_customer_id;

        $response = pegasoworld_erp()->send_to_erp('/api/wordpress/plugin/customer', $customer_data, 'PUT');

        if (is_wp_error($response)) {
            pegasoworld_erp()->log('to_erp', 'customer', $customer_id, 'update', 'error', $response->get_error_message());
            return;
        }

        pegasoworld_erp()->log('to_erp', 'customer', $customer_id, 'update', 'success', 'Cliente aggiornato');
    }

    /**
     * Stock prodotto cambiato (opzionale)
     */
    public function on_stock_changed($product) {
        // Normalmente lo stock viene gestito dall'ERP
        // Questo hook è per casi speciali dove WP modifica lo stock
    }

    /**
     * Stock variazione cambiato
     */
    public function on_variation_stock_changed($variation) {
        // Normalmente lo stock viene gestito dall'ERP
    }

    // ==========================================
    // DATA PREPARATION
    // ==========================================

    /**
     * Prepara dati ordine per ERP
     */
    private function prepare_order_data($order) {
        $items = array();

        foreach ($order->get_items() as $item_id => $item) {
            $product = $item->get_product();
            $items[] = array(
                'productId' => $product ? $product->get_id() : null,
                'variationId' => $item->get_variation_id() ?: null,
                'sku' => $product ? $product->get_sku() : '',
                'name' => $item->get_name(),
                'quantity' => $item->get_quantity(),
                'unitPrice' => floatval($item->get_subtotal()) / max(1, $item->get_quantity()),
                'total' => floatval($item->get_total()),
                'tax' => floatval($item->get_total_tax())
            );
        }

        // Dati cliente
        $billing = array(
            'firstName' => $order->get_billing_first_name(),
            'lastName' => $order->get_billing_last_name(),
            'email' => $order->get_billing_email(),
            'phone' => $order->get_billing_phone(),
            'company' => $order->get_billing_company(),
            'address1' => $order->get_billing_address_1(),
            'address2' => $order->get_billing_address_2(),
            'city' => $order->get_billing_city(),
            'state' => $order->get_billing_state(),
            'postcode' => $order->get_billing_postcode(),
            'country' => $order->get_billing_country()
        );

        $shipping = array(
            'firstName' => $order->get_shipping_first_name(),
            'lastName' => $order->get_shipping_last_name(),
            'company' => $order->get_shipping_company(),
            'address1' => $order->get_shipping_address_1(),
            'address2' => $order->get_shipping_address_2(),
            'city' => $order->get_shipping_city(),
            'state' => $order->get_shipping_state(),
            'postcode' => $order->get_shipping_postcode(),
            'country' => $order->get_shipping_country()
        );

        // Metadati fiscali italiani (se disponibili)
        $vat_number = $order->get_meta('_billing_vat') ?: $order->get_meta('billing_vat_number');
        $fiscal_code = $order->get_meta('_billing_cf') ?: $order->get_meta('billing_fiscal_code');
        $pec = $order->get_meta('_billing_pec');
        $sdi = $order->get_meta('_billing_sdi');

        return array(
            'wordpressOrderId' => $order->get_id(),
            'orderNumber' => $order->get_order_number(),
            'status' => $order->get_status(),
            'customerId' => $order->get_customer_id(),
            'customerNote' => $order->get_customer_note(),
            'billing' => $billing,
            'shipping' => $shipping,
            'items' => $items,
            'subtotal' => floatval($order->get_subtotal()),
            'discount' => floatval($order->get_discount_total()),
            'shippingTotal' => floatval($order->get_shipping_total()),
            'tax' => floatval($order->get_total_tax()),
            'total' => floatval($order->get_total()),
            'paymentMethod' => $order->get_payment_method(),
            'paymentMethodTitle' => $order->get_payment_method_title(),
            'isPaid' => $order->is_paid(),
            'currency' => $order->get_currency(),
            'dateCreated' => $order->get_date_created() ? $order->get_date_created()->format('c') : null,
            // Dati fiscali italiani
            'vatNumber' => $vat_number,
            'fiscalCode' => $fiscal_code,
            'pec' => $pec,
            'sdiCode' => $sdi
        );
    }

    /**
     * Prepara dati cliente per ERP
     */
    private function prepare_customer_data($customer) {
        // Dati fiscali italiani (se disponibili)
        $vat_number = get_user_meta($customer->get_id(), 'billing_vat_number', true);
        $fiscal_code = get_user_meta($customer->get_id(), 'billing_fiscal_code', true);

        return array(
            'wordpressCustomerId' => $customer->get_id(),
            'email' => $customer->get_email(),
            'firstName' => $customer->get_first_name(),
            'lastName' => $customer->get_last_name(),
            'phone' => $customer->get_billing_phone(),
            'company' => $customer->get_billing_company(),
            'billing' => array(
                'address1' => $customer->get_billing_address_1(),
                'address2' => $customer->get_billing_address_2(),
                'city' => $customer->get_billing_city(),
                'state' => $customer->get_billing_state(),
                'postcode' => $customer->get_billing_postcode(),
                'country' => $customer->get_billing_country()
            ),
            'shipping' => array(
                'firstName' => $customer->get_shipping_first_name(),
                'lastName' => $customer->get_shipping_last_name(),
                'company' => $customer->get_shipping_company(),
                'address1' => $customer->get_shipping_address_1(),
                'address2' => $customer->get_shipping_address_2(),
                'city' => $customer->get_shipping_city(),
                'state' => $customer->get_shipping_state(),
                'postcode' => $customer->get_shipping_postcode(),
                'country' => $customer->get_shipping_country()
            ),
            'vatNumber' => $vat_number,
            'fiscalCode' => $fiscal_code,
            'dateCreated' => $customer->get_date_created() ? $customer->get_date_created()->format('c') : null,
            'ordersCount' => $customer->get_order_count(),
            'totalSpent' => floatval($customer->get_total_spent())
        );
    }
}
