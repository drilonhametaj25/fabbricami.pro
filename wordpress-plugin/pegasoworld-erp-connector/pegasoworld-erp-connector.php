<?php
/**
 * Plugin Name: PegasoWorld ERP Connector
 * Plugin URI: https://pegasoworld.com
 * Description: Connettore bidirezionale tra WooCommerce e PegasoWorld ERP
 * Version: 1.0.0
 * Author: PegasoWorld
 * Author URI: https://pegasoworld.com
 * License: GPL-2.0+
 * License URI: http://www.gnu.org/licenses/gpl-2.0.txt
 * Text Domain: pegasoworld-erp
 * Domain Path: /languages
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * WC requires at least: 5.0
 * WC tested up to: 8.0
 */

// Impedisci accesso diretto
if (!defined('ABSPATH')) {
    exit;
}

// Costanti del plugin
define('PEGASOWORLD_ERP_VERSION', '1.0.0');
define('PEGASOWORLD_ERP_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('PEGASOWORLD_ERP_PLUGIN_URL', plugin_dir_url(__FILE__));
define('PEGASOWORLD_ERP_PLUGIN_BASENAME', plugin_basename(__FILE__));

/**
 * Classe principale del plugin
 */
final class PegasoWorld_ERP_Connector {

    /**
     * Istanza singleton
     */
    private static $instance = null;

    /**
     * Componenti del plugin
     */
    public $admin;
    public $api;
    public $hooks;
    public $auth;

    /**
     * Ottieni l'istanza singleton
     */
    public static function instance() {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Costruttore
     */
    private function __construct() {
        $this->check_requirements();
        $this->includes();
        $this->init_hooks();
    }

    /**
     * Verifica requisiti
     */
    private function check_requirements() {
        // Verifica WooCommerce
        add_action('admin_init', function() {
            if (!class_exists('WooCommerce')) {
                add_action('admin_notices', function() {
                    echo '<div class="notice notice-error"><p>';
                    echo esc_html__('PegasoWorld ERP Connector richiede WooCommerce attivo.', 'pegasoworld-erp');
                    echo '</p></div>';
                });
            }
        });
    }

    /**
     * Include i file necessari
     */
    private function includes() {
        require_once PEGASOWORLD_ERP_PLUGIN_DIR . 'includes/class-auth.php';
        require_once PEGASOWORLD_ERP_PLUGIN_DIR . 'includes/class-admin.php';
        require_once PEGASOWORLD_ERP_PLUGIN_DIR . 'includes/class-api.php';
        require_once PEGASOWORLD_ERP_PLUGIN_DIR . 'includes/class-hooks.php';
    }

    /**
     * Inizializza hooks
     */
    private function init_hooks() {
        // Activation/Deactivation
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));

        // Init
        add_action('plugins_loaded', array($this, 'init'), 20);

        // Carica traduzioni
        add_action('init', function() {
            load_plugin_textdomain('pegasoworld-erp', false, dirname(PEGASOWORLD_ERP_PLUGIN_BASENAME) . '/languages');
        });
    }

    /**
     * Inizializza il plugin
     */
    public function init() {
        // Verifica WooCommerce
        if (!class_exists('WooCommerce')) {
            return;
        }

        // Inizializza componenti
        $this->auth = new PegasoWorld_ERP_Auth();
        $this->admin = new PegasoWorld_ERP_Admin();
        $this->api = new PegasoWorld_ERP_API();
        $this->hooks = new PegasoWorld_ERP_Hooks();
    }

    /**
     * Attivazione plugin
     */
    public function activate() {
        // Crea tabella log se necessario
        global $wpdb;
        $charset_collate = $wpdb->get_charset_collate();
        $table_name = $wpdb->prefix . 'pegasoworld_erp_log';

        $sql = "CREATE TABLE IF NOT EXISTS $table_name (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            direction varchar(10) NOT NULL,
            entity varchar(50) NOT NULL,
            entity_id varchar(100) NOT NULL,
            action varchar(50) NOT NULL,
            status varchar(20) NOT NULL,
            message text,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY direction (direction),
            KEY entity (entity),
            KEY status (status),
            KEY created_at (created_at)
        ) $charset_collate;";

        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);

        // Imposta opzioni default
        add_option('pegasoworld_erp_url', '');
        add_option('pegasoworld_erp_username', '');
        add_option('pegasoworld_erp_password', '');
        add_option('pegasoworld_erp_sync_enabled', '0');
        add_option('pegasoworld_erp_sync_orders', '1');
        add_option('pegasoworld_erp_sync_customers', '1');
        add_option('pegasoworld_erp_sync_stock', '1');

        // Flush rewrite rules
        flush_rewrite_rules();
    }

    /**
     * Disattivazione plugin
     */
    public function deactivate() {
        flush_rewrite_rules();
    }

    /**
     * Ottieni URL ERP
     */
    public function get_erp_url() {
        return rtrim(get_option('pegasoworld_erp_url', ''), '/');
    }

    /**
     * Verifica se sync è abilitato
     */
    public function is_sync_enabled() {
        return get_option('pegasoworld_erp_sync_enabled', '0') === '1';
    }

    /**
     * Log operazione
     */
    public function log($direction, $entity, $entity_id, $action, $status, $message = '') {
        global $wpdb;
        $table_name = $wpdb->prefix . 'pegasoworld_erp_log';

        $wpdb->insert($table_name, array(
            'direction' => $direction,
            'entity' => $entity,
            'entity_id' => strval($entity_id),
            'action' => $action,
            'status' => $status,
            'message' => $message,
            'created_at' => current_time('mysql')
        ), array('%s', '%s', '%s', '%s', '%s', '%s', '%s'));
    }

    /**
     * Invia richiesta all'ERP
     */
    public function send_to_erp($endpoint, $data, $method = 'POST') {
        $url = $this->get_erp_url() . $endpoint;
        $username = get_option('pegasoworld_erp_username', '');
        $password = get_option('pegasoworld_erp_password', '');

        if (empty($url) || empty($username) || empty($password)) {
            return new WP_Error('config_error', 'Configurazione ERP incompleta');
        }

        $args = array(
            'method' => $method,
            'timeout' => 30,
            'headers' => array(
                'Content-Type' => 'application/json',
                'Authorization' => 'Basic ' . base64_encode($username . ':' . $password)
            ),
            'body' => $method !== 'GET' ? wp_json_encode($data) : null
        );

        $response = wp_remote_request($url, $args);

        if (is_wp_error($response)) {
            return $response;
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $decoded = json_decode($body, true);

        if ($code >= 400) {
            $error_msg = isset($decoded['error']) ? $decoded['error'] : 'Errore HTTP ' . $code;
            return new WP_Error('api_error', $error_msg, array('status' => $code, 'body' => $decoded));
        }

        return $decoded;
    }
}

/**
 * Funzione globale per accedere al plugin
 */
function pegasoworld_erp() {
    return PegasoWorld_ERP_Connector::instance();
}

// Inizializza
pegasoworld_erp();
