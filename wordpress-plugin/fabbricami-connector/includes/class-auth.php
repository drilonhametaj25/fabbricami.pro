<?php
/**
 * FabbricaMi Auth
 *
 * Gestione autenticazione bidirezionale ERP <-> WordPress
 *
 * @package FabbricaMi
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Classe Auth
 */
class FabbricaMi_Auth {

    /**
     * API Key per richieste in ingresso dall'ERP
     */
    private $api_key;

    /**
     * Costruttore
     */
    public function __construct() {
        $this->api_key = get_option('fabbricami_api_key', '');

        // Hooks
        add_filter('determine_current_user', array($this, 'authenticate_api_request'), 20);
        add_action('rest_api_init', array($this, 'register_auth_endpoints'));
    }

    /**
     * Registra endpoints di autenticazione
     */
    public function register_auth_endpoints() {
        register_rest_route('fabbricami/v1', '/auth/verify', array(
            'methods' => 'GET',
            'callback' => array($this, 'verify_connection'),
            'permission_callback' => array($this, 'check_api_key')
        ));

        register_rest_route('fabbricami/v1', '/auth/test', array(
            'methods' => 'POST',
            'callback' => array($this, 'test_erp_connection'),
            'permission_callback' => array($this, 'check_admin_permission')
        ));

        register_rest_route('fabbricami/v1', '/auth/regenerate-key', array(
            'methods' => 'POST',
            'callback' => array($this, 'regenerate_api_key'),
            'permission_callback' => array($this, 'check_admin_permission')
        ));
    }

    /**
     * Autentica richieste API in ingresso
     */
    public function authenticate_api_request($user_id) {
        // Solo per richieste REST API
        if (!defined('REST_REQUEST') || !REST_REQUEST) {
            return $user_id;
        }

        // Solo per namespace fabbricami
        $request_uri = isset($_SERVER['REQUEST_URI']) ? sanitize_text_field($_SERVER['REQUEST_URI']) : '';
        if (strpos($request_uri, '/fabbricami/v1/') === false) {
            return $user_id;
        }

        // Se gia autenticato, usa quello
        if (!empty($user_id)) {
            return $user_id;
        }

        // Verifica API Key
        if ($this->verify_api_key_from_request()) {
            // Usa un utente admin per le operazioni API
            $admin_id = $this->get_api_admin_user();
            if ($admin_id) {
                return $admin_id;
            }
        }

        return $user_id;
    }

    /**
     * Verifica API key dalla richiesta
     */
    private function verify_api_key_from_request() {
        $api_key = '';

        // Check header
        if (isset($_SERVER['HTTP_X_FABBRICAMI_API_KEY'])) {
            $api_key = sanitize_text_field($_SERVER['HTTP_X_FABBRICAMI_API_KEY']);
        }
        // Check Authorization Bearer
        elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $auth_header = sanitize_text_field($_SERVER['HTTP_AUTHORIZATION']);
            if (preg_match('/Bearer\s+(.*)$/i', $auth_header, $matches)) {
                $api_key = $matches[1];
            }
        }
        // Check query param (meno sicuro, ma utile per testing)
        elseif (isset($_GET['api_key'])) {
            $api_key = sanitize_text_field($_GET['api_key']);
        }

        if (empty($api_key)) {
            return false;
        }

        return $this->verify_api_key($api_key);
    }

    /**
     * Verifica API key
     */
    public function verify_api_key($key) {
        if (empty($this->api_key)) {
            return false;
        }

        return hash_equals($this->api_key, $key);
    }

    /**
     * Callback permesso per verificare API key
     */
    public function check_api_key() {
        return $this->verify_api_key_from_request();
    }

    /**
     * Callback permesso per admin
     */
    public function check_admin_permission() {
        return current_user_can('manage_woocommerce');
    }

    /**
     * Ottieni ID utente admin per operazioni API
     */
    private function get_api_admin_user() {
        // Prima prova utente specifico per API
        $api_user_id = get_option('fabbricami_api_user_id', 0);
        if ($api_user_id && get_user_by('id', $api_user_id)) {
            return $api_user_id;
        }

        // Altrimenti usa il primo admin
        $admins = get_users(array(
            'role' => 'administrator',
            'number' => 1,
            'orderby' => 'ID',
            'order' => 'ASC'
        ));

        if (!empty($admins)) {
            return $admins[0]->ID;
        }

        return false;
    }

    /**
     * Endpoint: Verifica connessione
     */
    public function verify_connection($request) {
        return array(
            'success' => true,
            'site_url' => get_site_url(),
            'site_name' => get_bloginfo('name'),
            'woocommerce_version' => defined('WC_VERSION') ? WC_VERSION : 'N/A',
            'plugin_version' => FABBRICAMI_VERSION,
            'php_version' => PHP_VERSION,
            'wordpress_version' => get_bloginfo('version'),
            'timezone' => wp_timezone_string(),
            'timestamp' => current_time('mysql')
        );
    }

    /**
     * Endpoint: Test connessione ERP
     */
    public function test_erp_connection($request) {
        $params = $request->get_json_params();

        $url = isset($params['url']) ? sanitize_url($params['url']) : get_option('fabbricami_erp_url', '');
        $username = isset($params['username']) ? sanitize_text_field($params['username']) : get_option('fabbricami_erp_username', '');
        $password = isset($params['password']) ? $params['password'] : get_option('fabbricami_erp_password', '');

        if (empty($url) || empty($username) || empty($password)) {
            return new WP_Error('missing_params', __('Parametri connessione mancanti', 'fabbricami'), array('status' => 400));
        }

        // Test endpoint
        $test_url = rtrim($url, '/') . '/api/v1/wordpress/verify';

        $response = wp_remote_get($test_url, array(
            'timeout' => 15,
            'headers' => array(
                'Authorization' => 'Basic ' . base64_encode($username . ':' . $password),
                'Content-Type' => 'application/json',
                'X-FabbricaMi-Version' => FABBRICAMI_VERSION
            )
        ));

        if (is_wp_error($response)) {
            fabbricami()->logger->error('connection_test', array(
                'url' => $url,
                'error' => $response->get_error_message()
            ));

            return new WP_Error(
                'connection_failed',
                sprintf(__('Impossibile connettersi all\'ERP: %s', 'fabbricami'), $response->get_error_message()),
                array('status' => 503)
            );
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);

        if ($code === 401) {
            return new WP_Error('auth_failed', __('Credenziali non valide', 'fabbricami'), array('status' => 401));
        }

        if ($code !== 200) {
            return new WP_Error('erp_error', sprintf(__('Errore ERP: %s', 'fabbricami'), isset($data['error']) ? $data['error'] : 'Unknown'), array('status' => $code));
        }

        fabbricami()->logger->info(
            'outgoing',
            'system',
            '0',
            'connection_test',
            'Test connessione ERP riuscito'
        );

        return array(
            'success' => true,
            'erp_info' => $data
        );
    }

    /**
     * Endpoint: Rigenera API key
     */
    public function regenerate_api_key($request) {
        $new_key = wp_generate_password(32, false);
        update_option('fabbricami_api_key', $new_key);

        $this->api_key = $new_key;

        fabbricami()->logger->info(
            'internal',
            'system',
            '0',
            'api_key_regenerated',
            'API key rigenerata'
        );

        return array(
            'success' => true,
            'api_key' => $new_key
        );
    }

    /**
     * Ottieni API key corrente
     */
    public function get_api_key() {
        return $this->api_key;
    }

    /**
     * Genera token JWT per richieste interne (opzionale, per uso futuro)
     */
    public function generate_jwt_token($user_id, $expiration = 3600) {
        $header = base64_encode(wp_json_encode(array('typ' => 'JWT', 'alg' => 'HS256')));

        $payload = base64_encode(wp_json_encode(array(
            'iss' => get_site_url(),
            'iat' => time(),
            'exp' => time() + $expiration,
            'user_id' => $user_id
        )));

        $signature = base64_encode(hash_hmac('sha256', $header . '.' . $payload, wp_salt('auth'), true));

        return $header . '.' . $payload . '.' . $signature;
    }

    /**
     * Verifica token JWT
     */
    public function verify_jwt_token($token) {
        $parts = explode('.', $token);

        if (count($parts) !== 3) {
            return false;
        }

        list($header, $payload, $signature) = $parts;

        // Verifica firma
        $expected_signature = base64_encode(hash_hmac('sha256', $header . '.' . $payload, wp_salt('auth'), true));

        if (!hash_equals($expected_signature, $signature)) {
            return false;
        }

        // Decodifica payload
        $data = json_decode(base64_decode($payload), true);

        // Verifica scadenza
        if (!isset($data['exp']) || $data['exp'] < time()) {
            return false;
        }

        // Verifica issuer
        if (!isset($data['iss']) || $data['iss'] !== get_site_url()) {
            return false;
        }

        return $data;
    }

    /**
     * Ottieni header autorizzazione per richieste verso ERP
     */
    public function get_erp_auth_header() {
        $username = get_option('fabbricami_erp_username', '');
        $password = get_option('fabbricami_erp_password', '');

        return 'Basic ' . base64_encode($username . ':' . $password);
    }

    /**
     * Verifica se le credenziali ERP sono configurate
     */
    public function is_erp_configured() {
        $url = get_option('fabbricami_erp_url', '');
        $username = get_option('fabbricami_erp_username', '');
        $password = get_option('fabbricami_erp_password', '');

        return !empty($url) && !empty($username) && !empty($password);
    }

    /**
     * Maschera password per visualizzazione
     */
    public function mask_password($password) {
        if (empty($password)) {
            return '';
        }

        $length = strlen($password);
        if ($length <= 4) {
            return str_repeat('*', $length);
        }

        return substr($password, 0, 2) . str_repeat('*', $length - 4) . substr($password, -2);
    }
}
