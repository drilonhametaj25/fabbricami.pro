<?php
/**
 * Gestione autenticazione per comunicazione ERP → WordPress
 */

if (!defined('ABSPATH')) {
    exit;
}

class PegasoWorld_ERP_Auth {

    /**
     * API Key per validazione richieste dall'ERP
     */
    private $api_key;

    /**
     * Costruttore
     */
    public function __construct() {
        $this->api_key = get_option('pegasoworld_erp_api_key', '');

        // Genera API key se non esiste
        if (empty($this->api_key)) {
            $this->regenerate_api_key();
        }
    }

    /**
     * Rigenera API key
     */
    public function regenerate_api_key() {
        $this->api_key = wp_generate_password(32, false, false);
        update_option('pegasoworld_erp_api_key', $this->api_key);
        return $this->api_key;
    }

    /**
     * Ottieni API key
     */
    public function get_api_key() {
        return $this->api_key;
    }

    /**
     * Valida richiesta dall'ERP
     * Supporta sia API Key che Basic Auth
     */
    public function validate_request($request) {
        // Metodo 1: API Key nell'header
        $api_key = $request->get_header('X-PegasoWorld-API-Key');
        if (!empty($api_key)) {
            return $this->validate_api_key($api_key);
        }

        // Metodo 2: Basic Auth
        $auth_header = $request->get_header('Authorization');
        if (!empty($auth_header) && strpos($auth_header, 'Basic ') === 0) {
            return $this->validate_basic_auth($auth_header);
        }

        return false;
    }

    /**
     * Valida API Key
     */
    private function validate_api_key($key) {
        return hash_equals($this->api_key, $key);
    }

    /**
     * Valida Basic Auth
     */
    private function validate_basic_auth($auth_header) {
        $encoded = substr($auth_header, 6);
        $decoded = base64_decode($encoded);

        if (!$decoded) {
            return false;
        }

        list($username, $password) = array_pad(explode(':', $decoded, 2), 2, '');

        // Verifica credenziali ERP salvate
        $stored_username = get_option('pegasoworld_erp_api_username', '');
        $stored_password = get_option('pegasoworld_erp_api_password', '');

        if (empty($stored_username) || empty($stored_password)) {
            return false;
        }

        return hash_equals($stored_username, $username) && hash_equals($stored_password, $password);
    }

    /**
     * Imposta credenziali API per richieste dall'ERP
     */
    public function set_api_credentials($username, $password) {
        update_option('pegasoworld_erp_api_username', $username);
        update_option('pegasoworld_erp_api_password', $password);
    }

    /**
     * Permission callback per REST API
     */
    public function permission_callback($request) {
        if ($this->validate_request($request)) {
            return true;
        }

        return new WP_Error(
            'rest_forbidden',
            __('Autenticazione richiesta', 'pegasoworld-erp'),
            array('status' => 401)
        );
    }

    /**
     * Genera firma HMAC per webhook
     */
    public function generate_signature($payload) {
        $secret = get_option('pegasoworld_erp_webhook_secret', '');
        if (empty($secret)) {
            $secret = wp_generate_password(32, false, false);
            update_option('pegasoworld_erp_webhook_secret', $secret);
        }

        return hash_hmac('sha256', $payload, $secret);
    }
}
