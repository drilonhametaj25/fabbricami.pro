<?php
/**
 * FabbricaMi Admin
 *
 * Pagina impostazioni e interfaccia admin
 *
 * @package FabbricaMi
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Classe Admin
 */
class FabbricaMi_Admin {

    /**
     * Costruttore
     */
    public function __construct() {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_assets'));

        // AJAX handlers
        add_action('wp_ajax_fabbricami_run_sync', array($this, 'ajax_run_sync'));
        add_action('wp_ajax_fabbricami_clear_logs', array($this, 'ajax_clear_logs'));
        add_action('wp_ajax_fabbricami_retry_failed', array($this, 'ajax_retry_failed'));
        add_action('wp_ajax_fabbricami_resolve_conflict', array($this, 'ajax_resolve_conflict'));
        add_action('wp_ajax_fabbricami_export_logs', array($this, 'ajax_export_logs'));
    }

    /**
     * Aggiungi menu admin
     */
    public function add_admin_menu() {
        // Menu principale
        add_menu_page(
            __('FabbricaMi ERP', 'fabbricami'),
            __('FabbricaMi ERP', 'fabbricami'),
            'manage_woocommerce',
            'fabbricami-settings',
            array($this, 'render_settings_page'),
            'dashicons-admin-links',
            56
        );

        // Sottomenu: Dashboard
        add_submenu_page(
            'fabbricami-settings',
            __('Dashboard', 'fabbricami'),
            __('Dashboard', 'fabbricami'),
            'manage_woocommerce',
            'fabbricami-settings',
            array($this, 'render_settings_page')
        );

        // Sottomenu: Impostazioni
        add_submenu_page(
            'fabbricami-settings',
            __('Impostazioni', 'fabbricami'),
            __('Impostazioni', 'fabbricami'),
            'manage_woocommerce',
            'fabbricami-config',
            array($this, 'render_config_page')
        );

        // Sottomenu: Log
        add_submenu_page(
            'fabbricami-settings',
            __('Log Sync', 'fabbricami'),
            __('Log Sync', 'fabbricami'),
            'manage_woocommerce',
            'fabbricami-logs',
            array($this, 'render_logs_page')
        );

        // Sottomenu: Coda
        add_submenu_page(
            'fabbricami-settings',
            __('Coda Sync', 'fabbricami'),
            __('Coda Sync', 'fabbricami'),
            'manage_woocommerce',
            'fabbricami-queue',
            array($this, 'render_queue_page')
        );

        // Sottomenu: Conflitti
        add_submenu_page(
            'fabbricami-settings',
            __('Conflitti', 'fabbricami'),
            __('Conflitti', 'fabbricami'),
            'manage_woocommerce',
            'fabbricami-conflicts',
            array($this, 'render_conflicts_page')
        );
    }

    /**
     * Registra settings
     */
    public function register_settings() {
        // Connection settings
        register_setting('fabbricami_connection', 'fabbricami_erp_url');
        register_setting('fabbricami_connection', 'fabbricami_erp_username');
        register_setting('fabbricami_connection', 'fabbricami_erp_password');

        // Sync settings
        register_setting('fabbricami_sync', 'fabbricami_sync_enabled');
        register_setting('fabbricami_sync', 'fabbricami_sync_products');
        register_setting('fabbricami_sync', 'fabbricami_sync_stock');
        register_setting('fabbricami_sync', 'fabbricami_sync_orders');
        register_setting('fabbricami_sync', 'fabbricami_sync_customers');
        register_setting('fabbricami_sync', 'fabbricami_sync_interval');
        register_setting('fabbricami_sync', 'fabbricami_stock_sync_interval');
        register_setting('fabbricami_sync', 'fabbricami_conflict_strategy');

        // Queue settings
        register_setting('fabbricami_queue', 'fabbricami_queue_max_attempts');
        register_setting('fabbricami_queue', 'fabbricami_queue_retry_delay');
        register_setting('fabbricami_queue', 'fabbricami_queue_batch_size');

        // Log settings
        register_setting('fabbricami_logs', 'fabbricami_log_level');
        register_setting('fabbricami_logs', 'fabbricami_log_retention_days');
    }

    /**
     * Carica assets admin
     */
    public function enqueue_assets($hook) {
        if (strpos($hook, 'fabbricami') === false) {
            return;
        }

        wp_enqueue_style(
            'fabbricami-admin',
            FABBRICAMI_PLUGIN_URL . 'assets/css/admin.css',
            array(),
            FABBRICAMI_VERSION
        );

        wp_enqueue_script(
            'fabbricami-admin',
            FABBRICAMI_PLUGIN_URL . 'assets/js/admin.js',
            array('jquery', 'wp-util'),
            FABBRICAMI_VERSION,
            true
        );

        wp_localize_script('fabbricami-admin', 'fabbricamiAdmin', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('fabbricami_admin'),
            'strings' => array(
                'confirm_clear_logs' => __('Sei sicuro di voler eliminare tutti i log?', 'fabbricami'),
                'confirm_retry_all' => __('Ritentare tutti i job falliti?', 'fabbricami'),
                'syncing' => __('Sincronizzazione in corso...', 'fabbricami'),
                'sync_complete' => __('Sincronizzazione completata', 'fabbricami'),
                'error' => __('Errore', 'fabbricami')
            )
        ));
    }

    /**
     * Render pagina settings (dashboard)
     */
    public function render_settings_page() {
        $stats = fabbricami()->get_stats();
        $health = get_option('fabbricami_health_status', array());
        $cron_status = fabbricami()->cron->get_cron_status();
        $is_configured = fabbricami()->auth->is_erp_configured();
        $wizard_completed = fabbricami()->is_wizard_completed();

        // Notice se wizard completato
        if (isset($_GET['wizard']) && $_GET['wizard'] === 'completed') {
            add_settings_error('fabbricami_messages', 'wizard_complete', __('Setup completato con successo! La sincronizzazione e ora attiva.', 'fabbricami'), 'success');
        }

        ?>
        <div class="wrap fabbricami-admin">
            <h1>
                <span class="dashicons dashicons-admin-links"></span>
                <?php esc_html_e('FabbricaMi ERP Connector', 'fabbricami'); ?>
            </h1>

            <?php settings_errors('fabbricami_messages'); ?>

            <?php if (!$wizard_completed): ?>
                <div class="notice notice-warning">
                    <p>
                        <strong><?php esc_html_e('Setup non completato', 'fabbricami'); ?></strong>
                        <a href="<?php echo esc_url(admin_url('admin.php?page=fabbricami-wizard')); ?>" class="button button-primary" style="margin-left: 10px;">
                            <?php esc_html_e('Completa Setup', 'fabbricami'); ?>
                        </a>
                    </p>
                </div>
            <?php endif; ?>

            <!-- Status Cards -->
            <div class="fabbricami-dashboard-cards">
                <!-- Connection Status -->
                <div class="fabbricami-card">
                    <div class="card-header">
                        <span class="dashicons dashicons-admin-site"></span>
                        <h3><?php esc_html_e('Connessione', 'fabbricami'); ?></h3>
                    </div>
                    <div class="card-body">
                        <?php if ($is_configured): ?>
                            <div class="status-indicator <?php echo isset($health['status']) && $health['status'] === 'healthy' ? 'status-ok' : 'status-warning'; ?>">
                                <span class="status-dot"></span>
                                <?php
                                $status_text = isset($health['status']) ? $health['status'] : 'unknown';
                                echo esc_html(ucfirst($status_text));
                                ?>
                            </div>
                            <p class="status-url"><?php echo esc_html(fabbricami()->get_erp_url()); ?></p>
                        <?php else: ?>
                            <div class="status-indicator status-error">
                                <span class="status-dot"></span>
                                <?php esc_html_e('Non configurato', 'fabbricami'); ?>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>

                <!-- Sync Today -->
                <div class="fabbricami-card">
                    <div class="card-header">
                        <span class="dashicons dashicons-update"></span>
                        <h3><?php esc_html_e('Sync Oggi', 'fabbricami'); ?></h3>
                    </div>
                    <div class="card-body">
                        <div class="sync-stats">
                            <div class="stat stat-success">
                                <span class="stat-value"><?php echo esc_html($stats['sync_today']['success']); ?></span>
                                <span class="stat-label"><?php esc_html_e('Successo', 'fabbricami'); ?></span>
                            </div>
                            <div class="stat stat-error">
                                <span class="stat-value"><?php echo esc_html($stats['sync_today']['error']); ?></span>
                                <span class="stat-label"><?php esc_html_e('Errori', 'fabbricami'); ?></span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Queue Status -->
                <div class="fabbricami-card">
                    <div class="card-header">
                        <span class="dashicons dashicons-list-view"></span>
                        <h3><?php esc_html_e('Coda', 'fabbricami'); ?></h3>
                    </div>
                    <div class="card-body">
                        <div class="queue-stats">
                            <div class="stat">
                                <span class="stat-value"><?php echo esc_html($stats['queue']['pending']); ?></span>
                                <span class="stat-label"><?php esc_html_e('In attesa', 'fabbricami'); ?></span>
                            </div>
                            <div class="stat">
                                <span class="stat-value"><?php echo esc_html($stats['queue']['processing']); ?></span>
                                <span class="stat-label"><?php esc_html_e('In corso', 'fabbricami'); ?></span>
                            </div>
                            <div class="stat stat-error">
                                <span class="stat-value"><?php echo esc_html($stats['queue']['failed']); ?></span>
                                <span class="stat-label"><?php esc_html_e('Falliti', 'fabbricami'); ?></span>
                            </div>
                        </div>
                        <?php if ($stats['queue']['failed'] > 0): ?>
                            <a href="<?php echo esc_url(admin_url('admin.php?page=fabbricami-queue&status=failed')); ?>" class="view-link">
                                <?php esc_html_e('Vedi falliti', 'fabbricami'); ?> &rarr;
                            </a>
                        <?php endif; ?>
                    </div>
                </div>

                <!-- Conflicts -->
                <div class="fabbricami-card <?php echo $stats['conflicts']['pending'] > 0 ? 'has-issues' : ''; ?>">
                    <div class="card-header">
                        <span class="dashicons dashicons-warning"></span>
                        <h3><?php esc_html_e('Conflitti', 'fabbricami'); ?></h3>
                    </div>
                    <div class="card-body">
                        <div class="conflict-stats">
                            <div class="stat <?php echo $stats['conflicts']['pending'] > 0 ? 'stat-warning' : ''; ?>">
                                <span class="stat-value"><?php echo esc_html($stats['conflicts']['pending']); ?></span>
                                <span class="stat-label"><?php esc_html_e('Da risolvere', 'fabbricami'); ?></span>
                            </div>
                        </div>
                        <?php if ($stats['conflicts']['pending'] > 0): ?>
                            <a href="<?php echo esc_url(admin_url('admin.php?page=fabbricami-conflicts')); ?>" class="view-link">
                                <?php esc_html_e('Risolvi conflitti', 'fabbricami'); ?> &rarr;
                            </a>
                        <?php endif; ?>
                    </div>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="fabbricami-quick-actions">
                <h2><?php esc_html_e('Azioni Rapide', 'fabbricami'); ?></h2>
                <div class="actions-row">
                    <button type="button" class="button button-primary" id="run-sync-now" <?php disabled(!$is_configured); ?>>
                        <span class="dashicons dashicons-update"></span>
                        <?php esc_html_e('Esegui Sync Ora', 'fabbricami'); ?>
                    </button>
                    <button type="button" class="button" id="run-stock-sync" <?php disabled(!$is_configured); ?>>
                        <span class="dashicons dashicons-archive"></span>
                        <?php esc_html_e('Sync Stock', 'fabbricami'); ?>
                    </button>
                    <button type="button" class="button" id="run-health-check">
                        <span class="dashicons dashicons-heart"></span>
                        <?php esc_html_e('Health Check', 'fabbricami'); ?>
                    </button>
                </div>
                <div id="sync-result" class="sync-result"></div>
            </div>

            <!-- Cron Status -->
            <div class="fabbricami-cron-status">
                <h2><?php esc_html_e('Prossime Esecuzioni', 'fabbricami'); ?></h2>
                <table class="widefat">
                    <thead>
                        <tr>
                            <th><?php esc_html_e('Job', 'fabbricami'); ?></th>
                            <th><?php esc_html_e('Prossima esecuzione', 'fabbricami'); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><?php esc_html_e('Sync Completo', 'fabbricami'); ?></td>
                            <td><?php echo $cron_status['scheduled_sync'] ? esc_html($cron_status['scheduled_sync']['datetime']) : '-'; ?></td>
                        </tr>
                        <tr>
                            <td><?php esc_html_e('Sync Stock', 'fabbricami'); ?></td>
                            <td><?php echo $cron_status['stock_sync'] ? esc_html($cron_status['stock_sync']['datetime']) : '-'; ?></td>
                        </tr>
                        <tr>
                            <td><?php esc_html_e('Processamento Coda', 'fabbricami'); ?></td>
                            <td><?php echo $cron_status['queue_process'] ? esc_html($cron_status['queue_process']['datetime']) : '-'; ?></td>
                        </tr>
                        <tr>
                            <td><?php esc_html_e('Health Check', 'fabbricami'); ?></td>
                            <td><?php echo $cron_status['health_check'] ? esc_html($cron_status['health_check']['datetime']) : '-'; ?></td>
                        </tr>
                    </tbody>
                </table>
                <p class="last-sync">
                    <?php esc_html_e('Ultimo sync:', 'fabbricami'); ?>
                    <strong><?php echo esc_html($cron_status['last_sync']); ?></strong>
                </p>
            </div>
        </div>
        <?php
    }

    /**
     * Render pagina configurazione
     */
    public function render_config_page() {
        $active_tab = isset($_GET['tab']) ? sanitize_text_field($_GET['tab']) : 'connection';
        ?>
        <div class="wrap fabbricami-admin">
            <h1><?php esc_html_e('Impostazioni FabbricaMi', 'fabbricami'); ?></h1>

            <nav class="nav-tab-wrapper">
                <a href="?page=fabbricami-config&tab=connection" class="nav-tab <?php echo $active_tab === 'connection' ? 'nav-tab-active' : ''; ?>">
                    <?php esc_html_e('Connessione', 'fabbricami'); ?>
                </a>
                <a href="?page=fabbricami-config&tab=sync" class="nav-tab <?php echo $active_tab === 'sync' ? 'nav-tab-active' : ''; ?>">
                    <?php esc_html_e('Sincronizzazione', 'fabbricami'); ?>
                </a>
                <a href="?page=fabbricami-config&tab=queue" class="nav-tab <?php echo $active_tab === 'queue' ? 'nav-tab-active' : ''; ?>">
                    <?php esc_html_e('Coda', 'fabbricami'); ?>
                </a>
                <a href="?page=fabbricami-config&tab=logs" class="nav-tab <?php echo $active_tab === 'logs' ? 'nav-tab-active' : ''; ?>">
                    <?php esc_html_e('Log', 'fabbricami'); ?>
                </a>
            </nav>

            <form method="post" action="options.php">
                <?php
                switch ($active_tab) {
                    case 'connection':
                        settings_fields('fabbricami_connection');
                        $this->render_connection_settings();
                        break;
                    case 'sync':
                        settings_fields('fabbricami_sync');
                        $this->render_sync_settings();
                        break;
                    case 'queue':
                        settings_fields('fabbricami_queue');
                        $this->render_queue_settings();
                        break;
                    case 'logs':
                        settings_fields('fabbricami_logs');
                        $this->render_log_settings();
                        break;
                }

                submit_button();
                ?>
            </form>
        </div>
        <?php
    }

    /**
     * Settings: Connessione
     */
    private function render_connection_settings() {
        ?>
        <table class="form-table">
            <tr>
                <th scope="row"><label for="fabbricami_erp_url"><?php esc_html_e('URL ERP', 'fabbricami'); ?></label></th>
                <td>
                    <input type="url" name="fabbricami_erp_url" id="fabbricami_erp_url"
                           value="<?php echo esc_attr(get_option('fabbricami_erp_url')); ?>" class="regular-text">
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="fabbricami_erp_username"><?php esc_html_e('Username', 'fabbricami'); ?></label></th>
                <td>
                    <input type="text" name="fabbricami_erp_username" id="fabbricami_erp_username"
                           value="<?php echo esc_attr(get_option('fabbricami_erp_username')); ?>" class="regular-text">
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="fabbricami_erp_password"><?php esc_html_e('Password', 'fabbricami'); ?></label></th>
                <td>
                    <input type="password" name="fabbricami_erp_password" id="fabbricami_erp_password"
                           value="<?php echo esc_attr(get_option('fabbricami_erp_password')); ?>" class="regular-text">
                </td>
            </tr>
            <tr>
                <th scope="row"><?php esc_html_e('API Key', 'fabbricami'); ?></th>
                <td>
                    <code><?php echo esc_html(get_option('fabbricami_api_key')); ?></code>
                    <p class="description"><?php esc_html_e('Usa questa chiave per le richieste dall\'ERP verso WordPress', 'fabbricami'); ?></p>
                </td>
            </tr>
        </table>
        <?php
    }

    /**
     * Settings: Sync
     */
    private function render_sync_settings() {
        ?>
        <table class="form-table">
            <tr>
                <th scope="row"><?php esc_html_e('Sincronizzazione', 'fabbricami'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="fabbricami_sync_enabled" value="1"
                               <?php checked(get_option('fabbricami_sync_enabled'), '1'); ?>>
                        <?php esc_html_e('Abilita sincronizzazione', 'fabbricami'); ?>
                    </label>
                </td>
            </tr>
            <tr>
                <th scope="row"><?php esc_html_e('Entita da sincronizzare', 'fabbricami'); ?></th>
                <td>
                    <fieldset>
                        <label>
                            <input type="checkbox" name="fabbricami_sync_products" value="1"
                                   <?php checked(get_option('fabbricami_sync_products'), '1'); ?>>
                            <?php esc_html_e('Prodotti', 'fabbricami'); ?>
                        </label><br>
                        <label>
                            <input type="checkbox" name="fabbricami_sync_stock" value="1"
                                   <?php checked(get_option('fabbricami_sync_stock'), '1'); ?>>
                            <?php esc_html_e('Stock', 'fabbricami'); ?>
                        </label><br>
                        <label>
                            <input type="checkbox" name="fabbricami_sync_orders" value="1"
                                   <?php checked(get_option('fabbricami_sync_orders'), '1'); ?>>
                            <?php esc_html_e('Ordini', 'fabbricami'); ?>
                        </label><br>
                        <label>
                            <input type="checkbox" name="fabbricami_sync_customers" value="1"
                                   <?php checked(get_option('fabbricami_sync_customers'), '1'); ?>>
                            <?php esc_html_e('Clienti', 'fabbricami'); ?>
                        </label>
                    </fieldset>
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="fabbricami_sync_interval"><?php esc_html_e('Intervallo Sync', 'fabbricami'); ?></label></th>
                <td>
                    <select name="fabbricami_sync_interval" id="fabbricami_sync_interval">
                        <option value="fabbricami_15min" <?php selected(get_option('fabbricami_sync_interval'), 'fabbricami_15min'); ?>>
                            <?php esc_html_e('Ogni 15 minuti', 'fabbricami'); ?>
                        </option>
                        <option value="hourly" <?php selected(get_option('fabbricami_sync_interval'), 'hourly'); ?>>
                            <?php esc_html_e('Ogni ora', 'fabbricami'); ?>
                        </option>
                        <option value="twicedaily" <?php selected(get_option('fabbricami_sync_interval'), 'twicedaily'); ?>>
                            <?php esc_html_e('Due volte al giorno', 'fabbricami'); ?>
                        </option>
                    </select>
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="fabbricami_stock_sync_interval"><?php esc_html_e('Intervallo Sync Stock', 'fabbricami'); ?></label></th>
                <td>
                    <select name="fabbricami_stock_sync_interval" id="fabbricami_stock_sync_interval">
                        <option value="fabbricami_5min" <?php selected(get_option('fabbricami_stock_sync_interval'), 'fabbricami_5min'); ?>>
                            <?php esc_html_e('Ogni 5 minuti', 'fabbricami'); ?>
                        </option>
                        <option value="fabbricami_15min" <?php selected(get_option('fabbricami_stock_sync_interval'), 'fabbricami_15min'); ?>>
                            <?php esc_html_e('Ogni 15 minuti', 'fabbricami'); ?>
                        </option>
                        <option value="hourly" <?php selected(get_option('fabbricami_stock_sync_interval'), 'hourly'); ?>>
                            <?php esc_html_e('Ogni ora', 'fabbricami'); ?>
                        </option>
                    </select>
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="fabbricami_conflict_strategy"><?php esc_html_e('Strategia Conflitti', 'fabbricami'); ?></label></th>
                <td>
                    <select name="fabbricami_conflict_strategy" id="fabbricami_conflict_strategy">
                        <option value="erp_wins" <?php selected(get_option('fabbricami_conflict_strategy'), 'erp_wins'); ?>>
                            <?php esc_html_e('ERP vince', 'fabbricami'); ?>
                        </option>
                        <option value="wp_wins" <?php selected(get_option('fabbricami_conflict_strategy'), 'wp_wins'); ?>>
                            <?php esc_html_e('WordPress vince', 'fabbricami'); ?>
                        </option>
                        <option value="newest_wins" <?php selected(get_option('fabbricami_conflict_strategy'), 'newest_wins'); ?>>
                            <?php esc_html_e('Piu recente vince', 'fabbricami'); ?>
                        </option>
                        <option value="manual" <?php selected(get_option('fabbricami_conflict_strategy'), 'manual'); ?>>
                            <?php esc_html_e('Revisione manuale', 'fabbricami'); ?>
                        </option>
                    </select>
                </td>
            </tr>
        </table>
        <?php
    }

    /**
     * Settings: Coda
     */
    private function render_queue_settings() {
        ?>
        <table class="form-table">
            <tr>
                <th scope="row"><label for="fabbricami_queue_max_attempts"><?php esc_html_e('Max Tentativi', 'fabbricami'); ?></label></th>
                <td>
                    <input type="number" name="fabbricami_queue_max_attempts" id="fabbricami_queue_max_attempts"
                           value="<?php echo esc_attr(get_option('fabbricami_queue_max_attempts', 5)); ?>" min="1" max="10">
                    <p class="description"><?php esc_html_e('Numero massimo di tentativi prima di marcare come fallito', 'fabbricami'); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="fabbricami_queue_retry_delay"><?php esc_html_e('Delay Retry (sec)', 'fabbricami'); ?></label></th>
                <td>
                    <input type="number" name="fabbricami_queue_retry_delay" id="fabbricami_queue_retry_delay"
                           value="<?php echo esc_attr(get_option('fabbricami_queue_retry_delay', 300)); ?>" min="60" max="3600">
                    <p class="description"><?php esc_html_e('Delay base tra i tentativi (backoff esponenziale)', 'fabbricami'); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="fabbricami_queue_batch_size"><?php esc_html_e('Batch Size', 'fabbricami'); ?></label></th>
                <td>
                    <input type="number" name="fabbricami_queue_batch_size" id="fabbricami_queue_batch_size"
                           value="<?php echo esc_attr(get_option('fabbricami_queue_batch_size', 50)); ?>" min="10" max="200">
                    <p class="description"><?php esc_html_e('Numero di job da processare per ogni esecuzione', 'fabbricami'); ?></p>
                </td>
            </tr>
        </table>
        <?php
    }

    /**
     * Settings: Log
     */
    private function render_log_settings() {
        ?>
        <table class="form-table">
            <tr>
                <th scope="row"><label for="fabbricami_log_level"><?php esc_html_e('Livello Log', 'fabbricami'); ?></label></th>
                <td>
                    <select name="fabbricami_log_level" id="fabbricami_log_level">
                        <option value="debug" <?php selected(get_option('fabbricami_log_level'), 'debug'); ?>>Debug</option>
                        <option value="info" <?php selected(get_option('fabbricami_log_level'), 'info'); ?>>Info</option>
                        <option value="warning" <?php selected(get_option('fabbricami_log_level'), 'warning'); ?>>Warning</option>
                        <option value="error" <?php selected(get_option('fabbricami_log_level'), 'error'); ?>>Error</option>
                    </select>
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="fabbricami_log_retention_days"><?php esc_html_e('Retention (giorni)', 'fabbricami'); ?></label></th>
                <td>
                    <input type="number" name="fabbricami_log_retention_days" id="fabbricami_log_retention_days"
                           value="<?php echo esc_attr(get_option('fabbricami_log_retention_days', 30)); ?>" min="7" max="365">
                </td>
            </tr>
        </table>
        <?php
    }

    /**
     * Render pagina logs
     */
    public function render_logs_page() {
        $page = isset($_GET['paged']) ? intval($_GET['paged']) : 1;
        $level = isset($_GET['level']) ? sanitize_text_field($_GET['level']) : '';
        $entity = isset($_GET['entity']) ? sanitize_text_field($_GET['entity']) : '';

        $logs = fabbricami()->logger->get_logs(array(
            'level' => $level,
            'entity' => $entity,
            'page' => $page,
            'per_page' => 50
        ));
        ?>
        <div class="wrap fabbricami-admin">
            <h1><?php esc_html_e('Log Sincronizzazione', 'fabbricami'); ?></h1>

            <div class="tablenav top">
                <div class="alignleft actions">
                    <form method="get">
                        <input type="hidden" name="page" value="fabbricami-logs">
                        <select name="level">
                            <option value=""><?php esc_html_e('Tutti i livelli', 'fabbricami'); ?></option>
                            <option value="debug" <?php selected($level, 'debug'); ?>>Debug</option>
                            <option value="info" <?php selected($level, 'info'); ?>>Info</option>
                            <option value="warning" <?php selected($level, 'warning'); ?>>Warning</option>
                            <option value="error" <?php selected($level, 'error'); ?>>Error</option>
                        </select>
                        <select name="entity">
                            <option value=""><?php esc_html_e('Tutte le entita', 'fabbricami'); ?></option>
                            <option value="product" <?php selected($entity, 'product'); ?>>Prodotti</option>
                            <option value="order" <?php selected($entity, 'order'); ?>>Ordini</option>
                            <option value="stock" <?php selected($entity, 'stock'); ?>>Stock</option>
                            <option value="customer" <?php selected($entity, 'customer'); ?>>Clienti</option>
                            <option value="system" <?php selected($entity, 'system'); ?>>Sistema</option>
                        </select>
                        <input type="submit" class="button" value="<?php esc_attr_e('Filtra', 'fabbricami'); ?>">
                    </form>
                </div>
                <div class="alignright actions">
                    <button type="button" class="button" id="export-logs">
                        <span class="dashicons dashicons-download"></span>
                        <?php esc_html_e('Esporta CSV', 'fabbricami'); ?>
                    </button>
                    <button type="button" class="button" id="clear-logs">
                        <span class="dashicons dashicons-trash"></span>
                        <?php esc_html_e('Svuota Log', 'fabbricami'); ?>
                    </button>
                </div>
            </div>

            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th style="width: 140px;"><?php esc_html_e('Data', 'fabbricami'); ?></th>
                        <th style="width: 70px;"><?php esc_html_e('Livello', 'fabbricami'); ?></th>
                        <th style="width: 80px;"><?php esc_html_e('Direzione', 'fabbricami'); ?></th>
                        <th style="width: 80px;"><?php esc_html_e('Entita', 'fabbricami'); ?></th>
                        <th style="width: 100px;"><?php esc_html_e('Azione', 'fabbricami'); ?></th>
                        <th><?php esc_html_e('Messaggio', 'fabbricami'); ?></th>
                        <th style="width: 60px;"><?php esc_html_e('ms', 'fabbricami'); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($logs['items'])): ?>
                        <tr><td colspan="7"><?php esc_html_e('Nessun log trovato', 'fabbricami'); ?></td></tr>
                    <?php else: ?>
                        <?php foreach ($logs['items'] as $log): ?>
                            <tr>
                                <td><?php echo esc_html($log->created_at); ?></td>
                                <td><span class="log-level log-<?php echo esc_attr($log->level); ?>"><?php echo esc_html($log->level); ?></span></td>
                                <td><?php echo esc_html($log->direction); ?></td>
                                <td><?php echo esc_html($log->entity); ?></td>
                                <td><?php echo esc_html($log->action); ?></td>
                                <td><?php echo esc_html($log->message); ?></td>
                                <td><?php echo $log->duration_ms ? esc_html($log->duration_ms) : '-'; ?></td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>

            <?php if ($logs['pages'] > 1): ?>
                <div class="tablenav bottom">
                    <div class="tablenav-pages">
                        <?php
                        echo paginate_links(array(
                            'base' => add_query_arg('paged', '%#%'),
                            'format' => '',
                            'prev_text' => '&laquo;',
                            'next_text' => '&raquo;',
                            'total' => $logs['pages'],
                            'current' => $page
                        ));
                        ?>
                    </div>
                </div>
            <?php endif; ?>
        </div>
        <?php
    }

    /**
     * Render pagina coda
     */
    public function render_queue_page() {
        $status = isset($_GET['status']) ? sanitize_text_field($_GET['status']) : '';
        $page = isset($_GET['paged']) ? intval($_GET['paged']) : 1;

        $queue = fabbricami()->sync_queue->get_jobs(array(
            'status' => $status,
            'page' => $page,
            'per_page' => 50
        ));
        ?>
        <div class="wrap fabbricami-admin">
            <h1><?php esc_html_e('Coda Sincronizzazione', 'fabbricami'); ?></h1>

            <ul class="subsubsub">
                <li><a href="?page=fabbricami-queue" <?php echo empty($status) ? 'class="current"' : ''; ?>><?php esc_html_e('Tutti', 'fabbricami'); ?></a> |</li>
                <li><a href="?page=fabbricami-queue&status=pending" <?php echo $status === 'pending' ? 'class="current"' : ''; ?>><?php esc_html_e('In attesa', 'fabbricami'); ?></a> |</li>
                <li><a href="?page=fabbricami-queue&status=processing" <?php echo $status === 'processing' ? 'class="current"' : ''; ?>><?php esc_html_e('In corso', 'fabbricami'); ?></a> |</li>
                <li><a href="?page=fabbricami-queue&status=failed" <?php echo $status === 'failed' ? 'class="current"' : ''; ?>><?php esc_html_e('Falliti', 'fabbricami'); ?></a></li>
            </ul>

            <?php if ($status === 'failed' && !empty($queue['items'])): ?>
                <div class="tablenav top">
                    <button type="button" class="button" id="retry-all-failed">
                        <?php esc_html_e('Ritenta Tutti', 'fabbricami'); ?>
                    </button>
                </div>
            <?php endif; ?>

            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th><?php esc_html_e('ID', 'fabbricami'); ?></th>
                        <th><?php esc_html_e('Entita', 'fabbricami'); ?></th>
                        <th><?php esc_html_e('Azione', 'fabbricami'); ?></th>
                        <th><?php esc_html_e('Stato', 'fabbricami'); ?></th>
                        <th><?php esc_html_e('Tentativi', 'fabbricami'); ?></th>
                        <th><?php esc_html_e('Errore', 'fabbricami'); ?></th>
                        <th><?php esc_html_e('Creato', 'fabbricami'); ?></th>
                        <th><?php esc_html_e('Azioni', 'fabbricami'); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($queue['items'] as $job): ?>
                        <tr>
                            <td><?php echo esc_html($job->id); ?></td>
                            <td><?php echo esc_html($job->entity_type . ' #' . $job->entity_id); ?></td>
                            <td><?php echo esc_html($job->action); ?></td>
                            <td><span class="queue-status status-<?php echo esc_attr($job->status); ?>"><?php echo esc_html($job->status); ?></span></td>
                            <td><?php echo esc_html($job->attempts . '/' . $job->max_attempts); ?></td>
                            <td><?php echo $job->last_error ? esc_html(substr($job->last_error, 0, 50)) : '-'; ?></td>
                            <td><?php echo esc_html($job->created_at); ?></td>
                            <td>
                                <?php if ($job->status === 'failed'): ?>
                                    <button type="button" class="button button-small retry-job" data-id="<?php echo esc_attr($job->id); ?>">
                                        <?php esc_html_e('Ritenta', 'fabbricami'); ?>
                                    </button>
                                <?php endif; ?>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <?php
    }

    /**
     * Render pagina conflitti
     */
    public function render_conflicts_page() {
        $conflicts = fabbricami()->conflict_resolver->get_conflicts(array(
            'status' => 'pending',
            'page' => 1,
            'per_page' => 50
        ));
        ?>
        <div class="wrap fabbricami-admin">
            <h1><?php esc_html_e('Conflitti da Risolvere', 'fabbricami'); ?></h1>

            <?php if (empty($conflicts['items'])): ?>
                <p class="no-conflicts"><?php esc_html_e('Nessun conflitto da risolvere.', 'fabbricami'); ?></p>
            <?php else: ?>
                <table class="wp-list-table widefat fixed striped">
                    <thead>
                        <tr>
                            <th><?php esc_html_e('Entita', 'fabbricami'); ?></th>
                            <th><?php esc_html_e('Campi in conflitto', 'fabbricami'); ?></th>
                            <th><?php esc_html_e('Data', 'fabbricami'); ?></th>
                            <th><?php esc_html_e('Azioni', 'fabbricami'); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($conflicts['items'] as $conflict): ?>
                            <tr>
                                <td><?php echo esc_html($conflict->entity_type . ' #' . $conflict->entity_id); ?></td>
                                <td>
                                    <?php
                                    $fields = is_array($conflict->field_conflicts) ? array_keys($conflict->field_conflicts) : array();
                                    echo esc_html(implode(', ', $fields));
                                    ?>
                                </td>
                                <td><?php echo esc_html($conflict->created_at); ?></td>
                                <td>
                                    <button type="button" class="button button-small resolve-conflict" data-id="<?php echo esc_attr($conflict->id); ?>" data-strategy="erp_wins">
                                        <?php esc_html_e('Usa ERP', 'fabbricami'); ?>
                                    </button>
                                    <button type="button" class="button button-small resolve-conflict" data-id="<?php echo esc_attr($conflict->id); ?>" data-strategy="wp_wins">
                                        <?php esc_html_e('Usa WP', 'fabbricami'); ?>
                                    </button>
                                    <button type="button" class="button button-small ignore-conflict" data-id="<?php echo esc_attr($conflict->id); ?>">
                                        <?php esc_html_e('Ignora', 'fabbricami'); ?>
                                    </button>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>
        </div>
        <?php
    }

    // AJAX Handlers

    public function ajax_run_sync() {
        check_ajax_referer('fabbricami_admin', 'nonce');

        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error('Permessi insufficienti');
        }

        $type = isset($_POST['type']) ? sanitize_text_field($_POST['type']) : 'full';

        switch ($type) {
            case 'stock':
                fabbricami()->cron->run_stock_sync();
                break;
            case 'health':
                $result = fabbricami()->cron->run_health_check();
                wp_send_json_success(array('health' => $result));
                return;
            default:
                fabbricami()->cron->run_scheduled_sync();
        }

        wp_send_json_success();
    }

    public function ajax_clear_logs() {
        check_ajax_referer('fabbricami_admin', 'nonce');

        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error('Permessi insufficienti');
        }

        fabbricami()->logger->truncate();
        wp_send_json_success();
    }

    public function ajax_retry_failed() {
        check_ajax_referer('fabbricami_admin', 'nonce');

        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error('Permessi insufficienti');
        }

        $job_id = isset($_POST['job_id']) ? intval($_POST['job_id']) : 0;

        if ($job_id) {
            fabbricami()->sync_queue->retry($job_id);
        }

        wp_send_json_success();
    }

    public function ajax_resolve_conflict() {
        check_ajax_referer('fabbricami_admin', 'nonce');

        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error('Permessi insufficienti');
        }

        $conflict_id = isset($_POST['conflict_id']) ? intval($_POST['conflict_id']) : 0;
        $strategy = isset($_POST['strategy']) ? sanitize_text_field($_POST['strategy']) : 'erp_wins';

        if ($strategy === 'ignore') {
            fabbricami()->conflict_resolver->ignore($conflict_id);
        } else {
            fabbricami()->conflict_resolver->resolve($conflict_id, $strategy);
        }

        wp_send_json_success();
    }

    public function ajax_export_logs() {
        check_ajax_referer('fabbricami_admin', 'nonce');

        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error('Permessi insufficienti');
        }

        $csv = fabbricami()->logger->export_csv();

        header('Content-Type: text/csv');
        header('Content-Disposition: attachment; filename="fabbricami-logs-' . date('Y-m-d') . '.csv"');
        echo $csv;
        exit;
    }
}
