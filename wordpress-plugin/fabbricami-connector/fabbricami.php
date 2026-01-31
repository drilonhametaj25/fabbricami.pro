<?php
/**
 * Plugin Name: FabbricaMi ERP Connector
 * Plugin URI: https://fabbricami.com
 * Description: Connettore bidirezionale avanzato tra WooCommerce e FabbricaMi ERP con sync schedulato, retry automatico e risoluzione conflitti
 * Version: 2.0.0
 * Author: FabbricaMi
 * Author URI: https://fabbricami.com
 * License: GPL-2.0+
 * License URI: http://www.gnu.org/licenses/gpl-2.0.txt
 * Text Domain: fabbricami
 * Domain Path: /languages
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * WC requires at least: 5.0
 * WC tested up to: 8.5
 */

// Impedisci accesso diretto
if (!defined('ABSPATH')) {
    exit;
}

// Costanti del plugin
define('FABBRICAMI_VERSION', '2.0.0');
define('FABBRICAMI_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('FABBRICAMI_PLUGIN_URL', plugin_dir_url(__FILE__));
define('FABBRICAMI_PLUGIN_BASENAME', plugin_basename(__FILE__));
define('FABBRICAMI_DB_VERSION', '1.0.0');

/**
 * Classe principale del plugin FabbricaMi ERP Connector
 */
final class FabbricaMi_Connector {

    /**
     * Istanza singleton
     */
    private static $instance = null;

    /**
     * Componenti del plugin
     */
    public $logger;
    public $admin;
    public $api;
    public $hooks;
    public $auth;
    public $cron;
    public $sync_queue;
    public $conflict_resolver;
    public $wizard;
    public $health_dashboard;

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
        add_action('admin_init', function() {
            if (!class_exists('WooCommerce')) {
                add_action('admin_notices', function() {
                    echo '<div class="notice notice-error"><p>';
                    echo esc_html__('FabbricaMi ERP Connector richiede WooCommerce attivo.', 'fabbricami');
                    echo '</p></div>';
                });
            }
        });
    }

    /**
     * Include i file necessari
     */
    private function includes() {
        // Core classes
        require_once FABBRICAMI_PLUGIN_DIR . 'includes/class-logger.php';
        require_once FABBRICAMI_PLUGIN_DIR . 'includes/class-auth.php';
        require_once FABBRICAMI_PLUGIN_DIR . 'includes/class-sync-queue.php';
        require_once FABBRICAMI_PLUGIN_DIR . 'includes/class-conflict-resolver.php';
        require_once FABBRICAMI_PLUGIN_DIR . 'includes/class-cron.php';
        require_once FABBRICAMI_PLUGIN_DIR . 'includes/class-api.php';
        require_once FABBRICAMI_PLUGIN_DIR . 'includes/class-hooks.php';
        require_once FABBRICAMI_PLUGIN_DIR . 'includes/class-wizard.php';
        require_once FABBRICAMI_PLUGIN_DIR . 'includes/class-admin.php';
        require_once FABBRICAMI_PLUGIN_DIR . 'includes/class-health-dashboard.php';
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
            load_plugin_textdomain('fabbricami', false, dirname(FABBRICAMI_PLUGIN_BASENAME) . '/languages');
        });

        // Check database version
        add_action('plugins_loaded', array($this, 'check_db_version'));
    }

    /**
     * Inizializza il plugin
     */
    public function init() {
        // Verifica WooCommerce
        if (!class_exists('WooCommerce')) {
            return;
        }

        // Inizializza componenti (ordine importante)
        $this->logger = new FabbricaMi_Logger();
        $this->auth = new FabbricaMi_Auth();
        $this->sync_queue = new FabbricaMi_Sync_Queue();
        $this->conflict_resolver = new FabbricaMi_Conflict_Resolver();
        $this->cron = new FabbricaMi_Cron();
        $this->api = new FabbricaMi_API();
        $this->hooks = new FabbricaMi_Hooks();
        $this->wizard = new FabbricaMi_Wizard();
        $this->admin = new FabbricaMi_Admin();
        $this->health_dashboard = new FabbricaMi_Health_Dashboard();
    }

    /**
     * Attivazione plugin
     */
    public function activate() {
        $this->create_tables();
        $this->set_default_options();
        $this->schedule_cron_events();
        flush_rewrite_rules();
    }

    /**
     * Crea tabelle database
     */
    private function create_tables() {
        global $wpdb;
        $charset_collate = $wpdb->get_charset_collate();

        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');

        // Tabella Log Enhanced
        $table_log = $wpdb->prefix . 'fabbricami_log';
        $sql_log = "CREATE TABLE IF NOT EXISTS $table_log (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            level varchar(10) NOT NULL DEFAULT 'info',
            direction varchar(10) NOT NULL,
            entity varchar(50) NOT NULL,
            entity_id varchar(100) NOT NULL,
            action varchar(50) NOT NULL,
            status varchar(20) NOT NULL,
            message text,
            context longtext,
            duration_ms int(11) DEFAULT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY level (level),
            KEY direction (direction),
            KEY entity (entity),
            KEY status (status),
            KEY created_at (created_at)
        ) $charset_collate;";
        dbDelta($sql_log);

        // Tabella Sync Queue (retry mechanism)
        $table_queue = $wpdb->prefix . 'fabbricami_sync_queue';
        $sql_queue = "CREATE TABLE IF NOT EXISTS $table_queue (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            entity_type varchar(50) NOT NULL,
            entity_id varchar(100) NOT NULL,
            action varchar(50) NOT NULL,
            payload longtext NOT NULL,
            priority int(11) NOT NULL DEFAULT 5,
            attempts int(11) NOT NULL DEFAULT 0,
            max_attempts int(11) NOT NULL DEFAULT 5,
            status varchar(20) NOT NULL DEFAULT 'pending',
            last_error text,
            next_retry_at datetime DEFAULT NULL,
            locked_at datetime DEFAULT NULL,
            locked_by varchar(50) DEFAULT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            completed_at datetime DEFAULT NULL,
            PRIMARY KEY (id),
            KEY entity_type (entity_type),
            KEY entity_id (entity_id),
            KEY status (status),
            KEY priority (priority),
            KEY next_retry_at (next_retry_at),
            KEY locked_at (locked_at)
        ) $charset_collate;";
        dbDelta($sql_queue);

        // Tabella Conflitti
        $table_conflicts = $wpdb->prefix . 'fabbricami_conflicts';
        $sql_conflicts = "CREATE TABLE IF NOT EXISTS $table_conflicts (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            entity_type varchar(50) NOT NULL,
            entity_id varchar(100) NOT NULL,
            wp_data longtext NOT NULL,
            erp_data longtext NOT NULL,
            field_conflicts longtext,
            resolution_strategy varchar(20) DEFAULT NULL,
            status varchar(20) NOT NULL DEFAULT 'pending',
            resolved_by bigint(20) DEFAULT NULL,
            resolved_at datetime DEFAULT NULL,
            resolution_notes text,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY entity_type (entity_type),
            KEY entity_id (entity_id),
            KEY status (status),
            KEY created_at (created_at)
        ) $charset_collate;";
        dbDelta($sql_conflicts);

        // Salva versione DB
        update_option('fabbricami_db_version', FABBRICAMI_DB_VERSION);
    }

    /**
     * Imposta opzioni default
     */
    private function set_default_options() {
        // Connection settings
        add_option('fabbricami_erp_url', '');
        add_option('fabbricami_erp_username', '');
        add_option('fabbricami_erp_password', '');
        add_option('fabbricami_api_key', wp_generate_password(32, false));

        // Sync settings
        add_option('fabbricami_sync_enabled', '0');
        add_option('fabbricami_sync_orders', '1');
        add_option('fabbricami_sync_customers', '1');
        add_option('fabbricami_sync_products', '1');
        add_option('fabbricami_sync_stock', '1');

        // Sync intervals
        add_option('fabbricami_sync_interval', 'hourly');
        add_option('fabbricami_stock_sync_interval', '15min');

        // Conflict resolution
        add_option('fabbricami_conflict_strategy', 'erp_wins');

        // Queue settings
        add_option('fabbricami_queue_max_attempts', '5');
        add_option('fabbricami_queue_retry_delay', '300'); // 5 minutes
        add_option('fabbricami_queue_batch_size', '50');

        // Logging
        add_option('fabbricami_log_level', 'info');
        add_option('fabbricami_log_retention_days', '30');

        // Wizard
        add_option('fabbricami_wizard_completed', '0');
        add_option('fabbricami_wizard_step', '1');
    }

    /**
     * Schedula eventi cron
     */
    private function schedule_cron_events() {
        // Registra intervalli custom
        add_filter('cron_schedules', array($this, 'add_cron_intervals'));

        // Schedula eventi se non esistono
        if (!wp_next_scheduled('fabbricami_scheduled_sync')) {
            wp_schedule_event(time(), 'hourly', 'fabbricami_scheduled_sync');
        }

        if (!wp_next_scheduled('fabbricami_stock_sync')) {
            wp_schedule_event(time(), 'fabbricami_15min', 'fabbricami_stock_sync');
        }

        if (!wp_next_scheduled('fabbricami_health_check')) {
            wp_schedule_event(time(), 'hourly', 'fabbricami_health_check');
        }

        if (!wp_next_scheduled('fabbricami_queue_process')) {
            wp_schedule_event(time(), 'fabbricami_1min', 'fabbricami_queue_process');
        }

        if (!wp_next_scheduled('fabbricami_cleanup')) {
            wp_schedule_event(time(), 'daily', 'fabbricami_cleanup');
        }
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
     * Disattivazione plugin
     */
    public function deactivate() {
        // Rimuovi eventi cron
        wp_clear_scheduled_hook('fabbricami_scheduled_sync');
        wp_clear_scheduled_hook('fabbricami_stock_sync');
        wp_clear_scheduled_hook('fabbricami_health_check');
        wp_clear_scheduled_hook('fabbricami_queue_process');
        wp_clear_scheduled_hook('fabbricami_cleanup');

        flush_rewrite_rules();
    }

    /**
     * Check e aggiorna versione DB
     */
    public function check_db_version() {
        $installed_version = get_option('fabbricami_db_version', '0');

        if (version_compare($installed_version, FABBRICAMI_DB_VERSION, '<')) {
            $this->create_tables();
        }
    }

    /**
     * Ottieni URL ERP
     */
    public function get_erp_url() {
        return rtrim(get_option('fabbricami_erp_url', ''), '/');
    }

    /**
     * Verifica se sync e abilitato
     */
    public function is_sync_enabled() {
        return get_option('fabbricami_sync_enabled', '0') === '1';
    }

    /**
     * Verifica se wizard e completato
     */
    public function is_wizard_completed() {
        return get_option('fabbricami_wizard_completed', '0') === '1';
    }

    /**
     * Invia richiesta all'ERP
     */
    public function send_to_erp($endpoint, $data = array(), $method = 'POST') {
        $url = $this->get_erp_url() . $endpoint;
        $username = get_option('fabbricami_erp_username', '');
        $password = get_option('fabbricami_erp_password', '');

        if (empty($url) || empty($username) || empty($password)) {
            return new WP_Error('config_error', __('Configurazione ERP incompleta', 'fabbricami'));
        }

        $start_time = microtime(true);

        $args = array(
            'method' => $method,
            'timeout' => 30,
            'headers' => array(
                'Content-Type' => 'application/json',
                'Authorization' => 'Basic ' . base64_encode($username . ':' . $password),
                'X-FabbricaMi-Version' => FABBRICAMI_VERSION,
                'X-Site-URL' => get_site_url()
            ),
            'body' => $method !== 'GET' && !empty($data) ? wp_json_encode($data) : null
        );

        $response = wp_remote_request($url, $args);
        $duration_ms = round((microtime(true) - $start_time) * 1000);

        if (is_wp_error($response)) {
            $this->logger->error('api_request', array(
                'endpoint' => $endpoint,
                'method' => $method,
                'error' => $response->get_error_message(),
                'duration_ms' => $duration_ms
            ));
            return $response;
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $decoded = json_decode($body, true);

        if ($code >= 400) {
            $error_msg = isset($decoded['error']) ? $decoded['error'] : 'Errore HTTP ' . $code;
            $this->logger->error('api_response', array(
                'endpoint' => $endpoint,
                'method' => $method,
                'status' => $code,
                'error' => $error_msg,
                'duration_ms' => $duration_ms
            ));
            return new WP_Error('api_error', $error_msg, array('status' => $code, 'body' => $decoded));
        }

        $this->logger->debug('api_success', array(
            'endpoint' => $endpoint,
            'method' => $method,
            'status' => $code,
            'duration_ms' => $duration_ms
        ));

        return $decoded;
    }

    /**
     * Ottieni statistiche plugin
     */
    public function get_stats() {
        global $wpdb;

        $log_table = $wpdb->prefix . 'fabbricami_log';
        $queue_table = $wpdb->prefix . 'fabbricami_sync_queue';
        $conflicts_table = $wpdb->prefix . 'fabbricami_conflicts';

        $today = current_time('Y-m-d');

        return array(
            'sync_today' => array(
                'success' => intval($wpdb->get_var($wpdb->prepare(
                    "SELECT COUNT(*) FROM $log_table WHERE DATE(created_at) = %s AND status = 'success'",
                    $today
                ))),
                'error' => intval($wpdb->get_var($wpdb->prepare(
                    "SELECT COUNT(*) FROM $log_table WHERE DATE(created_at) = %s AND status = 'error'",
                    $today
                )))
            ),
            'queue' => array(
                'pending' => intval($wpdb->get_var("SELECT COUNT(*) FROM $queue_table WHERE status = 'pending'")),
                'processing' => intval($wpdb->get_var("SELECT COUNT(*) FROM $queue_table WHERE status = 'processing'")),
                'failed' => intval($wpdb->get_var("SELECT COUNT(*) FROM $queue_table WHERE status = 'failed'"))
            ),
            'conflicts' => array(
                'pending' => intval($wpdb->get_var("SELECT COUNT(*) FROM $conflicts_table WHERE status = 'pending'")),
                'resolved' => intval($wpdb->get_var("SELECT COUNT(*) FROM $conflicts_table WHERE status = 'resolved'"))
            )
        );
    }
}

/**
 * Funzione globale per accedere al plugin
 */
function fabbricami() {
    return FabbricaMi_Connector::instance();
}

// Inizializza
fabbricami();
