<?php
/**
 * Pagina amministrazione plugin
 */

if (!defined('ABSPATH')) {
    exit;
}

class PegasoWorld_ERP_Admin {

    /**
     * Costruttore
     */
    public function __construct() {
        add_action('admin_menu', array($this, 'add_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_assets'));
        add_action('wp_ajax_pegasoworld_test_connection', array($this, 'ajax_test_connection'));
        add_action('wp_ajax_pegasoworld_regenerate_api_key', array($this, 'ajax_regenerate_api_key'));
        add_action('wp_ajax_pegasoworld_clear_logs', array($this, 'ajax_clear_logs'));
    }

    /**
     * Aggiungi menu admin
     */
    public function add_menu() {
        add_menu_page(
            __('PegasoWorld ERP', 'pegasoworld-erp'),
            __('PegasoWorld ERP', 'pegasoworld-erp'),
            'manage_woocommerce',
            'pegasoworld-erp',
            array($this, 'render_settings_page'),
            'dashicons-networking',
            56
        );

        add_submenu_page(
            'pegasoworld-erp',
            __('Impostazioni', 'pegasoworld-erp'),
            __('Impostazioni', 'pegasoworld-erp'),
            'manage_woocommerce',
            'pegasoworld-erp',
            array($this, 'render_settings_page')
        );

        add_submenu_page(
            'pegasoworld-erp',
            __('Log Sincronizzazione', 'pegasoworld-erp'),
            __('Log', 'pegasoworld-erp'),
            'manage_woocommerce',
            'pegasoworld-erp-logs',
            array($this, 'render_logs_page')
        );
    }

    /**
     * Registra settings
     */
    public function register_settings() {
        // Sezione Connessione
        add_settings_section(
            'pegasoworld_erp_connection',
            __('Connessione ERP', 'pegasoworld-erp'),
            array($this, 'render_section_connection'),
            'pegasoworld-erp'
        );

        // URL ERP
        register_setting('pegasoworld-erp', 'pegasoworld_erp_url', array(
            'type' => 'string',
            'sanitize_callback' => 'esc_url_raw'
        ));
        add_settings_field(
            'pegasoworld_erp_url',
            __('URL ERP', 'pegasoworld-erp'),
            array($this, 'render_field_url'),
            'pegasoworld-erp',
            'pegasoworld_erp_connection'
        );

        // Username
        register_setting('pegasoworld-erp', 'pegasoworld_erp_username', array(
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field'
        ));
        add_settings_field(
            'pegasoworld_erp_username',
            __('Username', 'pegasoworld-erp'),
            array($this, 'render_field_username'),
            'pegasoworld-erp',
            'pegasoworld_erp_connection'
        );

        // Password
        register_setting('pegasoworld-erp', 'pegasoworld_erp_password', array(
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field'
        ));
        add_settings_field(
            'pegasoworld_erp_password',
            __('Password', 'pegasoworld-erp'),
            array($this, 'render_field_password'),
            'pegasoworld-erp',
            'pegasoworld_erp_connection'
        );

        // Sezione Sincronizzazione
        add_settings_section(
            'pegasoworld_erp_sync',
            __('Sincronizzazione', 'pegasoworld-erp'),
            array($this, 'render_section_sync'),
            'pegasoworld-erp'
        );

        // Abilita Sync
        register_setting('pegasoworld-erp', 'pegasoworld_erp_sync_enabled', array(
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field'
        ));
        add_settings_field(
            'pegasoworld_erp_sync_enabled',
            __('Abilita Sincronizzazione', 'pegasoworld-erp'),
            array($this, 'render_field_sync_enabled'),
            'pegasoworld-erp',
            'pegasoworld_erp_sync'
        );

        // Sync Ordini
        register_setting('pegasoworld-erp', 'pegasoworld_erp_sync_orders', array(
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field'
        ));
        add_settings_field(
            'pegasoworld_erp_sync_orders',
            __('Sincronizza Ordini', 'pegasoworld-erp'),
            array($this, 'render_field_sync_orders'),
            'pegasoworld-erp',
            'pegasoworld_erp_sync'
        );

        // Sync Clienti
        register_setting('pegasoworld-erp', 'pegasoworld_erp_sync_customers', array(
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field'
        ));
        add_settings_field(
            'pegasoworld_erp_sync_customers',
            __('Sincronizza Clienti', 'pegasoworld-erp'),
            array($this, 'render_field_sync_customers'),
            'pegasoworld-erp',
            'pegasoworld_erp_sync'
        );

        // Sync Stock
        register_setting('pegasoworld-erp', 'pegasoworld_erp_sync_stock', array(
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field'
        ));
        add_settings_field(
            'pegasoworld_erp_sync_stock',
            __('Ricevi Aggiornamenti Stock', 'pegasoworld-erp'),
            array($this, 'render_field_sync_stock'),
            'pegasoworld-erp',
            'pegasoworld_erp_sync'
        );
    }

    /**
     * Carica assets admin
     */
    public function enqueue_assets($hook) {
        if (strpos($hook, 'pegasoworld-erp') === false) {
            return;
        }

        wp_enqueue_style(
            'pegasoworld-erp-admin',
            PEGASOWORLD_ERP_PLUGIN_URL . 'assets/css/admin.css',
            array(),
            PEGASOWORLD_ERP_VERSION
        );

        wp_enqueue_script(
            'pegasoworld-erp-admin',
            PEGASOWORLD_ERP_PLUGIN_URL . 'assets/js/admin.js',
            array('jquery'),
            PEGASOWORLD_ERP_VERSION,
            true
        );

        wp_localize_script('pegasoworld-erp-admin', 'pegasoworldErp', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('pegasoworld_erp_nonce'),
            'strings' => array(
                'testing' => __('Test in corso...', 'pegasoworld-erp'),
                'success' => __('Connessione riuscita!', 'pegasoworld-erp'),
                'error' => __('Errore di connessione', 'pegasoworld-erp'),
                'confirm_clear' => __('Sei sicuro di voler cancellare tutti i log?', 'pegasoworld-erp'),
                'confirm_regenerate' => __('Rigenerare la API Key? Le configurazioni esistenti dovranno essere aggiornate.', 'pegasoworld-erp')
            )
        ));
    }

    /**
     * Render pagina settings
     */
    public function render_settings_page() {
        if (!current_user_can('manage_woocommerce')) {
            wp_die(__('Permessi insufficienti', 'pegasoworld-erp'));
        }

        $api_key = pegasoworld_erp()->auth->get_api_key();
        ?>
        <div class="wrap pegasoworld-erp-settings">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>

            <div class="pegasoworld-erp-cards">
                <!-- Card Stato Connessione -->
                <div class="pegasoworld-card">
                    <div class="pegasoworld-card-header">
                        <h2><?php esc_html_e('Stato Connessione', 'pegasoworld-erp'); ?></h2>
                    </div>
                    <div class="pegasoworld-card-body">
                        <div class="connection-status" id="connection-status">
                            <span class="status-icon status-unknown">&#9679;</span>
                            <span class="status-text"><?php esc_html_e('Non verificato', 'pegasoworld-erp'); ?></span>
                        </div>
                        <button type="button" class="button button-secondary" id="test-connection">
                            <?php esc_html_e('Test Connessione', 'pegasoworld-erp'); ?>
                        </button>
                    </div>
                </div>

                <!-- Card API Key -->
                <div class="pegasoworld-card">
                    <div class="pegasoworld-card-header">
                        <h2><?php esc_html_e('API Key (per ERP)', 'pegasoworld-erp'); ?></h2>
                    </div>
                    <div class="pegasoworld-card-body">
                        <p class="description">
                            <?php esc_html_e('Usa questa chiave nell\'ERP per autenticare le richieste verso WordPress.', 'pegasoworld-erp'); ?>
                        </p>
                        <div class="api-key-wrapper">
                            <input type="text" class="api-key-field" value="<?php echo esc_attr($api_key); ?>" readonly />
                            <button type="button" class="button" id="copy-api-key" title="<?php esc_attr_e('Copia', 'pegasoworld-erp'); ?>">
                                <span class="dashicons dashicons-clipboard"></span>
                            </button>
                        </div>
                        <button type="button" class="button button-link-delete" id="regenerate-api-key">
                            <?php esc_html_e('Rigenera API Key', 'pegasoworld-erp'); ?>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Form Settings -->
            <form method="post" action="options.php">
                <?php
                settings_fields('pegasoworld-erp');
                do_settings_sections('pegasoworld-erp');
                submit_button();
                ?>
            </form>

            <!-- Statistiche rapide -->
            <div class="pegasoworld-stats">
                <h2><?php esc_html_e('Statistiche Sincronizzazione', 'pegasoworld-erp'); ?></h2>
                <?php $this->render_stats(); ?>
            </div>
        </div>
        <?php
    }

    /**
     * Render pagina log
     */
    public function render_logs_page() {
        if (!current_user_can('manage_woocommerce')) {
            wp_die(__('Permessi insufficienti', 'pegasoworld-erp'));
        }

        global $wpdb;
        $table_name = $wpdb->prefix . 'pegasoworld_erp_log';

        // Paginazione
        $per_page = 50;
        $current_page = isset($_GET['paged']) ? max(1, intval($_GET['paged'])) : 1;
        $offset = ($current_page - 1) * $per_page;

        // Filtri
        $where = '1=1';
        $entity_filter = isset($_GET['entity']) ? sanitize_text_field($_GET['entity']) : '';
        $status_filter = isset($_GET['status']) ? sanitize_text_field($_GET['status']) : '';

        if (!empty($entity_filter)) {
            $where .= $wpdb->prepare(' AND entity = %s', $entity_filter);
        }
        if (!empty($status_filter)) {
            $where .= $wpdb->prepare(' AND status = %s', $status_filter);
        }

        // Query
        $total = $wpdb->get_var("SELECT COUNT(*) FROM $table_name WHERE $where");
        $logs = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM $table_name WHERE $where ORDER BY created_at DESC LIMIT %d OFFSET %d",
            $per_page,
            $offset
        ));

        $total_pages = ceil($total / $per_page);
        ?>
        <div class="wrap pegasoworld-erp-logs">
            <h1>
                <?php esc_html_e('Log Sincronizzazione', 'pegasoworld-erp'); ?>
                <button type="button" class="button button-link-delete" id="clear-logs" style="margin-left: 20px;">
                    <?php esc_html_e('Svuota Log', 'pegasoworld-erp'); ?>
                </button>
            </h1>

            <!-- Filtri -->
            <div class="tablenav top">
                <form method="get" class="alignleft">
                    <input type="hidden" name="page" value="pegasoworld-erp-logs" />
                    <select name="entity">
                        <option value=""><?php esc_html_e('Tutte le entità', 'pegasoworld-erp'); ?></option>
                        <option value="order" <?php selected($entity_filter, 'order'); ?>><?php esc_html_e('Ordini', 'pegasoworld-erp'); ?></option>
                        <option value="customer" <?php selected($entity_filter, 'customer'); ?>><?php esc_html_e('Clienti', 'pegasoworld-erp'); ?></option>
                        <option value="product" <?php selected($entity_filter, 'product'); ?>><?php esc_html_e('Prodotti', 'pegasoworld-erp'); ?></option>
                        <option value="stock" <?php selected($entity_filter, 'stock'); ?>><?php esc_html_e('Stock', 'pegasoworld-erp'); ?></option>
                    </select>
                    <select name="status">
                        <option value=""><?php esc_html_e('Tutti gli stati', 'pegasoworld-erp'); ?></option>
                        <option value="success" <?php selected($status_filter, 'success'); ?>><?php esc_html_e('Successo', 'pegasoworld-erp'); ?></option>
                        <option value="error" <?php selected($status_filter, 'error'); ?>><?php esc_html_e('Errore', 'pegasoworld-erp'); ?></option>
                    </select>
                    <input type="submit" class="button" value="<?php esc_attr_e('Filtra', 'pegasoworld-erp'); ?>" />
                </form>
            </div>

            <!-- Tabella Log -->
            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th style="width: 150px;"><?php esc_html_e('Data', 'pegasoworld-erp'); ?></th>
                        <th style="width: 80px;"><?php esc_html_e('Direzione', 'pegasoworld-erp'); ?></th>
                        <th style="width: 100px;"><?php esc_html_e('Entità', 'pegasoworld-erp'); ?></th>
                        <th style="width: 120px;"><?php esc_html_e('ID', 'pegasoworld-erp'); ?></th>
                        <th style="width: 100px;"><?php esc_html_e('Azione', 'pegasoworld-erp'); ?></th>
                        <th style="width: 80px;"><?php esc_html_e('Stato', 'pegasoworld-erp'); ?></th>
                        <th><?php esc_html_e('Messaggio', 'pegasoworld-erp'); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($logs)) : ?>
                        <tr>
                            <td colspan="7"><?php esc_html_e('Nessun log trovato.', 'pegasoworld-erp'); ?></td>
                        </tr>
                    <?php else : ?>
                        <?php foreach ($logs as $log) : ?>
                            <tr>
                                <td><?php echo esc_html(wp_date('d/m/Y H:i:s', strtotime($log->created_at))); ?></td>
                                <td>
                                    <span class="direction-badge direction-<?php echo esc_attr($log->direction); ?>">
                                        <?php echo $log->direction === 'to_erp' ? '→ ERP' : '← ERP'; ?>
                                    </span>
                                </td>
                                <td><?php echo esc_html(ucfirst($log->entity)); ?></td>
                                <td><code><?php echo esc_html($log->entity_id); ?></code></td>
                                <td><?php echo esc_html($log->action); ?></td>
                                <td>
                                    <span class="status-badge status-<?php echo esc_attr($log->status); ?>">
                                        <?php echo esc_html(ucfirst($log->status)); ?>
                                    </span>
                                </td>
                                <td><?php echo esc_html($log->message); ?></td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>

            <!-- Paginazione -->
            <?php if ($total_pages > 1) : ?>
                <div class="tablenav bottom">
                    <div class="tablenav-pages">
                        <?php
                        echo paginate_links(array(
                            'base' => add_query_arg('paged', '%#%'),
                            'format' => '',
                            'prev_text' => '&laquo;',
                            'next_text' => '&raquo;',
                            'total' => $total_pages,
                            'current' => $current_page
                        ));
                        ?>
                    </div>
                </div>
            <?php endif; ?>
        </div>
        <?php
    }

    /**
     * Render statistiche
     */
    private function render_stats() {
        global $wpdb;
        $table_name = $wpdb->prefix . 'pegasoworld_erp_log';

        $today = current_time('Y-m-d');
        $stats = $wpdb->get_results($wpdb->prepare(
            "SELECT entity, status, COUNT(*) as count
             FROM $table_name
             WHERE DATE(created_at) = %s
             GROUP BY entity, status",
            $today
        ));

        $summary = array(
            'orders' => array('success' => 0, 'error' => 0),
            'customers' => array('success' => 0, 'error' => 0),
            'products' => array('success' => 0, 'error' => 0),
            'stock' => array('success' => 0, 'error' => 0)
        );

        foreach ($stats as $stat) {
            $key = $stat->entity . 's';
            if ($stat->entity === 'stock') $key = 'stock';
            if (isset($summary[$key][$stat->status])) {
                $summary[$key][$stat->status] = intval($stat->count);
            }
        }
        ?>
        <div class="pegasoworld-stats-grid">
            <?php foreach ($summary as $entity => $counts) : ?>
                <div class="stat-card">
                    <h4><?php echo esc_html(ucfirst($entity)); ?></h4>
                    <div class="stat-numbers">
                        <span class="stat-success"><?php echo intval($counts['success']); ?> ok</span>
                        <span class="stat-error"><?php echo intval($counts['error']); ?> err</span>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
        <p class="description"><?php esc_html_e('Statistiche di oggi', 'pegasoworld-erp'); ?></p>
        <?php
    }

    // ==========================================
    // RENDER FIELDS
    // ==========================================

    public function render_section_connection() {
        echo '<p>' . esc_html__('Configura la connessione al tuo ERP PegasoWorld.', 'pegasoworld-erp') . '</p>';
    }

    public function render_section_sync() {
        echo '<p>' . esc_html__('Configura quali dati sincronizzare automaticamente.', 'pegasoworld-erp') . '</p>';
    }

    public function render_field_url() {
        $value = get_option('pegasoworld_erp_url', '');
        ?>
        <input type="url" name="pegasoworld_erp_url" value="<?php echo esc_attr($value); ?>"
               class="regular-text" placeholder="https://erp.example.com" />
        <p class="description"><?php esc_html_e('URL base del tuo ERP (es. https://erp.pegasoworld.com)', 'pegasoworld-erp'); ?></p>
        <?php
    }

    public function render_field_username() {
        $value = get_option('pegasoworld_erp_username', '');
        ?>
        <input type="text" name="pegasoworld_erp_username" value="<?php echo esc_attr($value); ?>"
               class="regular-text" autocomplete="off" />
        <p class="description"><?php esc_html_e('Username per autenticazione Basic Auth', 'pegasoworld-erp'); ?></p>
        <?php
    }

    public function render_field_password() {
        $value = get_option('pegasoworld_erp_password', '');
        ?>
        <input type="password" name="pegasoworld_erp_password" value="<?php echo esc_attr($value); ?>"
               class="regular-text" autocomplete="new-password" />
        <p class="description"><?php esc_html_e('Password per autenticazione Basic Auth', 'pegasoworld-erp'); ?></p>
        <?php
    }

    public function render_field_sync_enabled() {
        $value = get_option('pegasoworld_erp_sync_enabled', '0');
        ?>
        <label class="pegasoworld-toggle">
            <input type="checkbox" name="pegasoworld_erp_sync_enabled" value="1" <?php checked($value, '1'); ?> />
            <span class="slider"></span>
        </label>
        <p class="description"><?php esc_html_e('Abilita/disabilita la sincronizzazione automatica con l\'ERP', 'pegasoworld-erp'); ?></p>
        <?php
    }

    public function render_field_sync_orders() {
        $value = get_option('pegasoworld_erp_sync_orders', '1');
        ?>
        <label class="pegasoworld-toggle">
            <input type="checkbox" name="pegasoworld_erp_sync_orders" value="1" <?php checked($value, '1'); ?> />
            <span class="slider"></span>
        </label>
        <p class="description"><?php esc_html_e('Invia automaticamente i nuovi ordini all\'ERP', 'pegasoworld-erp'); ?></p>
        <?php
    }

    public function render_field_sync_customers() {
        $value = get_option('pegasoworld_erp_sync_customers', '1');
        ?>
        <label class="pegasoworld-toggle">
            <input type="checkbox" name="pegasoworld_erp_sync_customers" value="1" <?php checked($value, '1'); ?> />
            <span class="slider"></span>
        </label>
        <p class="description"><?php esc_html_e('Invia automaticamente i nuovi clienti all\'ERP', 'pegasoworld-erp'); ?></p>
        <?php
    }

    public function render_field_sync_stock() {
        $value = get_option('pegasoworld_erp_sync_stock', '1');
        ?>
        <label class="pegasoworld-toggle">
            <input type="checkbox" name="pegasoworld_erp_sync_stock" value="1" <?php checked($value, '1'); ?> />
            <span class="slider"></span>
        </label>
        <p class="description"><?php esc_html_e('Accetta aggiornamenti stock dall\'ERP', 'pegasoworld-erp'); ?></p>
        <?php
    }

    // ==========================================
    // AJAX HANDLERS
    // ==========================================

    public function ajax_test_connection() {
        check_ajax_referer('pegasoworld_erp_nonce', 'nonce');

        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error(__('Permessi insufficienti', 'pegasoworld-erp'));
        }

        $response = pegasoworld_erp()->send_to_erp('/api/wordpress/plugin/health', array(), 'GET');

        if (is_wp_error($response)) {
            wp_send_json_error($response->get_error_message());
        }

        wp_send_json_success($response);
    }

    public function ajax_regenerate_api_key() {
        check_ajax_referer('pegasoworld_erp_nonce', 'nonce');

        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error(__('Permessi insufficienti', 'pegasoworld-erp'));
        }

        $new_key = pegasoworld_erp()->auth->regenerate_api_key();
        wp_send_json_success(array('api_key' => $new_key));
    }

    public function ajax_clear_logs() {
        check_ajax_referer('pegasoworld_erp_nonce', 'nonce');

        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error(__('Permessi insufficienti', 'pegasoworld-erp'));
        }

        global $wpdb;
        $table_name = $wpdb->prefix . 'pegasoworld_erp_log';
        $wpdb->query("TRUNCATE TABLE $table_name");

        wp_send_json_success();
    }
}
