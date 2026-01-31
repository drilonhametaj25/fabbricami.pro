<?php
/**
 * FabbricaMi Wizard
 *
 * Setup wizard in 5 step per la configurazione iniziale
 *
 * @package FabbricaMi
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Classe Wizard
 */
class FabbricaMi_Wizard {

    /**
     * Steps del wizard
     */
    private $steps = array();

    /**
     * Step corrente
     */
    private $current_step = 1;

    /**
     * Costruttore
     */
    public function __construct() {
        $this->setup_steps();

        // Hook per pagina wizard
        add_action('admin_menu', array($this, 'add_wizard_page'));
        add_action('admin_init', array($this, 'handle_wizard_submission'));

        // Redirect a wizard al primo accesso
        add_action('admin_init', array($this, 'maybe_redirect_to_wizard'));

        // AJAX handlers
        add_action('wp_ajax_fabbricami_test_connection', array($this, 'ajax_test_connection'));
        add_action('wp_ajax_fabbricami_save_wizard_step', array($this, 'ajax_save_step'));
    }

    /**
     * Configura steps del wizard
     */
    private function setup_steps() {
        $this->steps = array(
            1 => array(
                'title' => __('Benvenuto', 'fabbricami'),
                'description' => __('Configurazione iniziale del connettore ERP', 'fabbricami'),
                'handler' => 'render_step_welcome'
            ),
            2 => array(
                'title' => __('Connessione ERP', 'fabbricami'),
                'description' => __('Configura la connessione al tuo sistema ERP', 'fabbricami'),
                'handler' => 'render_step_connection'
            ),
            3 => array(
                'title' => __('Prodotti', 'fabbricami'),
                'description' => __('Configura la sincronizzazione dei prodotti', 'fabbricami'),
                'handler' => 'render_step_products'
            ),
            4 => array(
                'title' => __('Ordini e Clienti', 'fabbricami'),
                'description' => __('Configura la sincronizzazione di ordini e clienti', 'fabbricami'),
                'handler' => 'render_step_orders'
            ),
            5 => array(
                'title' => __('Completamento', 'fabbricami'),
                'description' => __('Verifica e attiva la sincronizzazione', 'fabbricami'),
                'handler' => 'render_step_complete'
            )
        );
    }

    /**
     * Aggiungi pagina wizard (nascosta dal menu)
     */
    public function add_wizard_page() {
        add_submenu_page(
            null, // Nessun parent = nascosta
            __('Setup Wizard', 'fabbricami'),
            __('Setup Wizard', 'fabbricami'),
            'manage_woocommerce',
            'fabbricami-wizard',
            array($this, 'render_wizard')
        );
    }

    /**
     * Redirect automatico a wizard se non completato
     */
    public function maybe_redirect_to_wizard() {
        // Solo in admin
        if (!is_admin()) {
            return;
        }

        // Solo per utenti con permessi
        if (!current_user_can('manage_woocommerce')) {
            return;
        }

        // Non in AJAX
        if (wp_doing_ajax()) {
            return;
        }

        // Gia nella pagina wizard
        if (isset($_GET['page']) && $_GET['page'] === 'fabbricami-wizard') {
            return;
        }

        // Gia completato
        if (get_option('fabbricami_wizard_completed', '0') === '1') {
            return;
        }

        // Skip se e il primo install (mostra avviso invece di redirect)
        $show_wizard_notice = get_option('fabbricami_show_wizard_notice', '1');
        if ($show_wizard_notice === '1') {
            add_action('admin_notices', array($this, 'wizard_notice'));
            return;
        }
    }

    /**
     * Notice per completare il wizard
     */
    public function wizard_notice() {
        ?>
        <div class="notice notice-info is-dismissible fabbricami-wizard-notice">
            <p>
                <strong><?php esc_html_e('FabbricaMi ERP Connector', 'fabbricami'); ?></strong>
                <?php esc_html_e('richiede una configurazione iniziale.', 'fabbricami'); ?>
                <a href="<?php echo esc_url(admin_url('admin.php?page=fabbricami-wizard')); ?>" class="button button-primary" style="margin-left: 10px;">
                    <?php esc_html_e('Avvia Setup Wizard', 'fabbricami'); ?>
                </a>
            </p>
        </div>
        <?php
    }

    /**
     * Gestisce submission del form wizard
     */
    public function handle_wizard_submission() {
        if (!isset($_POST['fabbricami_wizard_nonce'])) {
            return;
        }

        if (!wp_verify_nonce($_POST['fabbricami_wizard_nonce'], 'fabbricami_wizard')) {
            return;
        }

        if (!current_user_can('manage_woocommerce')) {
            return;
        }

        $step = isset($_POST['wizard_step']) ? intval($_POST['wizard_step']) : 1;
        $action = isset($_POST['wizard_action']) ? sanitize_text_field($_POST['wizard_action']) : 'next';

        // Salva dati step
        $this->save_step_data($step, $_POST);

        // Determina prossimo step
        if ($action === 'next' && $step < 5) {
            $next_step = $step + 1;
        } elseif ($action === 'prev' && $step > 1) {
            $next_step = $step - 1;
        } elseif ($action === 'complete') {
            $this->complete_wizard();
            wp_redirect(admin_url('admin.php?page=fabbricami-settings&wizard=completed'));
            exit;
        } else {
            $next_step = $step;
        }

        update_option('fabbricami_wizard_step', $next_step);

        wp_redirect(admin_url('admin.php?page=fabbricami-wizard&step=' . $next_step));
        exit;
    }

    /**
     * Salva dati di uno step
     */
    private function save_step_data($step, $data) {
        switch ($step) {
            case 2: // Connection
                if (isset($data['erp_url'])) {
                    update_option('fabbricami_erp_url', sanitize_url($data['erp_url']));
                }
                if (isset($data['erp_username'])) {
                    update_option('fabbricami_erp_username', sanitize_text_field($data['erp_username']));
                }
                if (isset($data['erp_password']) && !empty($data['erp_password'])) {
                    update_option('fabbricami_erp_password', $data['erp_password']);
                }
                break;

            case 3: // Products
                update_option('fabbricami_sync_products', isset($data['sync_products']) ? '1' : '0');
                update_option('fabbricami_sync_stock', isset($data['sync_stock']) ? '1' : '0');
                if (isset($data['stock_sync_interval'])) {
                    update_option('fabbricami_stock_sync_interval', sanitize_text_field($data['stock_sync_interval']));
                }
                break;

            case 4: // Orders & Customers
                update_option('fabbricami_sync_orders', isset($data['sync_orders']) ? '1' : '0');
                update_option('fabbricami_sync_customers', isset($data['sync_customers']) ? '1' : '0');
                if (isset($data['conflict_strategy'])) {
                    update_option('fabbricami_conflict_strategy', sanitize_text_field($data['conflict_strategy']));
                }
                break;
        }
    }

    /**
     * Completa il wizard
     */
    private function complete_wizard() {
        update_option('fabbricami_wizard_completed', '1');
        update_option('fabbricami_sync_enabled', '1');
        update_option('fabbricami_show_wizard_notice', '0');

        // Rischedula cron con nuove impostazioni
        if (fabbricami()->cron) {
            fabbricami()->cron->reschedule_all();
        }

        fabbricami()->logger->info(
            'internal',
            'system',
            '0',
            'wizard_completed',
            'Setup wizard completato con successo'
        );
    }

    /**
     * Render principale wizard
     */
    public function render_wizard() {
        $this->current_step = isset($_GET['step']) ? intval($_GET['step']) : intval(get_option('fabbricami_wizard_step', 1));

        if ($this->current_step < 1) $this->current_step = 1;
        if ($this->current_step > 5) $this->current_step = 5;

        wp_enqueue_style('fabbricami-wizard', FABBRICAMI_PLUGIN_URL . 'assets/css/wizard.css', array(), FABBRICAMI_VERSION);
        wp_enqueue_script('fabbricami-wizard', FABBRICAMI_PLUGIN_URL . 'assets/js/wizard.js', array('jquery'), FABBRICAMI_VERSION, true);
        wp_localize_script('fabbricami-wizard', 'fabbricamiWizard', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('fabbricami_wizard'),
            'strings' => array(
                'testing' => __('Test in corso...', 'fabbricami'),
                'success' => __('Connessione riuscita!', 'fabbricami'),
                'error' => __('Errore di connessione', 'fabbricami')
            )
        ));

        ?>
        <div class="fabbricami-wizard-wrap">
            <div class="fabbricami-wizard">
                <!-- Header -->
                <div class="fabbricami-wizard-header">
                    <h1>
                        <span class="dashicons dashicons-admin-settings"></span>
                        <?php esc_html_e('FabbricaMi ERP Connector', 'fabbricami'); ?>
                    </h1>
                    <p class="fabbricami-wizard-subtitle"><?php esc_html_e('Setup Wizard', 'fabbricami'); ?></p>
                </div>

                <!-- Progress bar -->
                <div class="fabbricami-wizard-progress">
                    <?php foreach ($this->steps as $num => $step): ?>
                        <div class="fabbricami-wizard-step <?php echo $num < $this->current_step ? 'completed' : ($num === $this->current_step ? 'active' : ''); ?>">
                            <div class="step-number"><?php echo esc_html($num); ?></div>
                            <div class="step-title"><?php echo esc_html($step['title']); ?></div>
                        </div>
                        <?php if ($num < 5): ?>
                            <div class="step-connector <?php echo $num < $this->current_step ? 'completed' : ''; ?>"></div>
                        <?php endif; ?>
                    <?php endforeach; ?>
                </div>

                <!-- Content -->
                <div class="fabbricami-wizard-content">
                    <h2><?php echo esc_html($this->steps[$this->current_step]['title']); ?></h2>
                    <p class="step-description"><?php echo esc_html($this->steps[$this->current_step]['description']); ?></p>

                    <form method="post" class="fabbricami-wizard-form">
                        <?php wp_nonce_field('fabbricami_wizard', 'fabbricami_wizard_nonce'); ?>
                        <input type="hidden" name="wizard_step" value="<?php echo esc_attr($this->current_step); ?>">

                        <?php
                        $handler = $this->steps[$this->current_step]['handler'];
                        $this->$handler();
                        ?>

                        <div class="fabbricami-wizard-actions">
                            <?php if ($this->current_step > 1): ?>
                                <button type="submit" name="wizard_action" value="prev" class="button button-secondary">
                                    <span class="dashicons dashicons-arrow-left-alt"></span>
                                    <?php esc_html_e('Indietro', 'fabbricami'); ?>
                                </button>
                            <?php endif; ?>

                            <?php if ($this->current_step < 5): ?>
                                <button type="submit" name="wizard_action" value="next" class="button button-primary">
                                    <?php esc_html_e('Continua', 'fabbricami'); ?>
                                    <span class="dashicons dashicons-arrow-right-alt"></span>
                                </button>
                            <?php else: ?>
                                <button type="submit" name="wizard_action" value="complete" class="button button-primary button-hero">
                                    <span class="dashicons dashicons-yes"></span>
                                    <?php esc_html_e('Completa Setup', 'fabbricami'); ?>
                                </button>
                            <?php endif; ?>
                        </div>
                    </form>
                </div>

                <!-- Footer -->
                <div class="fabbricami-wizard-footer">
                    <a href="<?php echo esc_url(admin_url('admin.php?page=fabbricami-settings')); ?>" class="skip-wizard">
                        <?php esc_html_e('Salta wizard e configura manualmente', 'fabbricami'); ?>
                    </a>
                </div>
            </div>
        </div>
        <?php
    }

    /**
     * Step 1: Benvenuto
     */
    private function render_step_welcome() {
        ?>
        <div class="wizard-step-content welcome-step">
            <div class="welcome-icon">
                <span class="dashicons dashicons-admin-links"></span>
            </div>

            <p class="welcome-text">
                <?php esc_html_e('Questo wizard ti guidera nella configurazione del connettore tra WooCommerce e il tuo sistema ERP FabbricaMi.', 'fabbricami'); ?>
            </p>

            <div class="features-list">
                <h3><?php esc_html_e('Cosa potrai fare:', 'fabbricami'); ?></h3>
                <ul>
                    <li>
                        <span class="dashicons dashicons-yes-alt"></span>
                        <?php esc_html_e('Sincronizzare automaticamente prodotti e giacenze', 'fabbricami'); ?>
                    </li>
                    <li>
                        <span class="dashicons dashicons-yes-alt"></span>
                        <?php esc_html_e('Inviare ordini al gestionale in tempo reale', 'fabbricami'); ?>
                    </li>
                    <li>
                        <span class="dashicons dashicons-yes-alt"></span>
                        <?php esc_html_e('Gestire conflitti e retry automatici', 'fabbricami'); ?>
                    </li>
                    <li>
                        <span class="dashicons dashicons-yes-alt"></span>
                        <?php esc_html_e('Monitorare lo stato della sincronizzazione', 'fabbricami'); ?>
                    </li>
                </ul>
            </div>

            <div class="requirements-check">
                <h3><?php esc_html_e('Requisiti:', 'fabbricami'); ?></h3>
                <ul>
                    <li class="<?php echo class_exists('WooCommerce') ? 'ok' : 'error'; ?>">
                        <span class="dashicons <?php echo class_exists('WooCommerce') ? 'dashicons-yes' : 'dashicons-no'; ?>"></span>
                        WooCommerce <?php echo class_exists('WooCommerce') ? '(' . WC_VERSION . ')' : __('non installato', 'fabbricami'); ?>
                    </li>
                    <li class="ok">
                        <span class="dashicons dashicons-yes"></span>
                        PHP <?php echo PHP_VERSION; ?>
                    </li>
                    <li class="<?php echo extension_loaded('curl') ? 'ok' : 'error'; ?>">
                        <span class="dashicons <?php echo extension_loaded('curl') ? 'dashicons-yes' : 'dashicons-no'; ?>"></span>
                        cURL extension
                    </li>
                </ul>
            </div>
        </div>
        <?php
    }

    /**
     * Step 2: Connessione ERP
     */
    private function render_step_connection() {
        $erp_url = get_option('fabbricami_erp_url', '');
        $erp_username = get_option('fabbricami_erp_username', '');
        $erp_password = get_option('fabbricami_erp_password', '');
        ?>
        <div class="wizard-step-content connection-step">
            <table class="form-table">
                <tr>
                    <th scope="row">
                        <label for="erp_url"><?php esc_html_e('URL ERP', 'fabbricami'); ?></label>
                    </th>
                    <td>
                        <input type="url" id="erp_url" name="erp_url" value="<?php echo esc_attr($erp_url); ?>"
                               class="regular-text" placeholder="https://erp.tuodominio.com" required>
                        <p class="description"><?php esc_html_e('L\'indirizzo del tuo sistema ERP FabbricaMi', 'fabbricami'); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="erp_username"><?php esc_html_e('Username', 'fabbricami'); ?></label>
                    </th>
                    <td>
                        <input type="text" id="erp_username" name="erp_username" value="<?php echo esc_attr($erp_username); ?>"
                               class="regular-text" required>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="erp_password"><?php esc_html_e('Password', 'fabbricami'); ?></label>
                    </th>
                    <td>
                        <input type="password" id="erp_password" name="erp_password"
                               value="<?php echo esc_attr($erp_password); ?>" class="regular-text"
                               <?php echo empty($erp_password) ? 'required' : ''; ?>>
                        <?php if (!empty($erp_password)): ?>
                            <p class="description"><?php esc_html_e('Lascia vuoto per mantenere la password esistente', 'fabbricami'); ?></p>
                        <?php endif; ?>
                    </td>
                </tr>
                <tr>
                    <th scope="row"></th>
                    <td>
                        <button type="button" id="test-connection" class="button button-secondary">
                            <span class="dashicons dashicons-admin-site"></span>
                            <?php esc_html_e('Testa Connessione', 'fabbricami'); ?>
                        </button>
                        <span id="connection-result"></span>
                    </td>
                </tr>
            </table>

            <div class="api-key-info">
                <h4><?php esc_html_e('API Key per connessione in ingresso', 'fabbricami'); ?></h4>
                <p><?php esc_html_e('Questa API key deve essere configurata nel tuo ERP per permettere la sincronizzazione verso WordPress:', 'fabbricami'); ?></p>
                <code id="api-key-display"><?php echo esc_html(get_option('fabbricami_api_key', '')); ?></code>
                <button type="button" class="button button-small copy-api-key">
                    <span class="dashicons dashicons-clipboard"></span>
                    <?php esc_html_e('Copia', 'fabbricami'); ?>
                </button>
            </div>
        </div>
        <?php
    }

    /**
     * Step 3: Prodotti
     */
    private function render_step_products() {
        $sync_products = get_option('fabbricami_sync_products', '1');
        $sync_stock = get_option('fabbricami_sync_stock', '1');
        $stock_interval = get_option('fabbricami_stock_sync_interval', 'fabbricami_15min');
        ?>
        <div class="wizard-step-content products-step">
            <table class="form-table">
                <tr>
                    <th scope="row"><?php esc_html_e('Sincronizza Prodotti', 'fabbricami'); ?></th>
                    <td>
                        <label>
                            <input type="checkbox" name="sync_products" value="1" <?php checked($sync_products, '1'); ?>>
                            <?php esc_html_e('Abilita sincronizzazione prodotti', 'fabbricami'); ?>
                        </label>
                        <p class="description"><?php esc_html_e('I prodotti dall\'ERP verranno sincronizzati con WooCommerce', 'fabbricami'); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><?php esc_html_e('Sincronizza Stock', 'fabbricami'); ?></th>
                    <td>
                        <label>
                            <input type="checkbox" name="sync_stock" value="1" <?php checked($sync_stock, '1'); ?>>
                            <?php esc_html_e('Abilita sincronizzazione giacenze', 'fabbricami'); ?>
                        </label>
                        <p class="description"><?php esc_html_e('Le quantita in magazzino verranno aggiornate automaticamente', 'fabbricami'); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="stock_sync_interval"><?php esc_html_e('Frequenza Sync Stock', 'fabbricami'); ?></label>
                    </th>
                    <td>
                        <select name="stock_sync_interval" id="stock_sync_interval">
                            <option value="fabbricami_5min" <?php selected($stock_interval, 'fabbricami_5min'); ?>>
                                <?php esc_html_e('Ogni 5 minuti', 'fabbricami'); ?>
                            </option>
                            <option value="fabbricami_15min" <?php selected($stock_interval, 'fabbricami_15min'); ?>>
                                <?php esc_html_e('Ogni 15 minuti (consigliato)', 'fabbricami'); ?>
                            </option>
                            <option value="hourly" <?php selected($stock_interval, 'hourly'); ?>>
                                <?php esc_html_e('Ogni ora', 'fabbricami'); ?>
                            </option>
                        </select>
                        <p class="description"><?php esc_html_e('Intervalli piu frequenti garantiscono stock sempre aggiornato ma aumentano il carico server', 'fabbricami'); ?></p>
                    </td>
                </tr>
            </table>

            <div class="info-box">
                <span class="dashicons dashicons-info"></span>
                <p><?php esc_html_e('La sincronizzazione prodotti e bidirezionale: le modifiche fatte in WooCommerce vengono inviate all\'ERP e viceversa.', 'fabbricami'); ?></p>
            </div>
        </div>
        <?php
    }

    /**
     * Step 4: Ordini e Clienti
     */
    private function render_step_orders() {
        $sync_orders = get_option('fabbricami_sync_orders', '1');
        $sync_customers = get_option('fabbricami_sync_customers', '1');
        $conflict_strategy = get_option('fabbricami_conflict_strategy', 'erp_wins');
        ?>
        <div class="wizard-step-content orders-step">
            <table class="form-table">
                <tr>
                    <th scope="row"><?php esc_html_e('Sincronizza Ordini', 'fabbricami'); ?></th>
                    <td>
                        <label>
                            <input type="checkbox" name="sync_orders" value="1" <?php checked($sync_orders, '1'); ?>>
                            <?php esc_html_e('Invia ordini all\'ERP automaticamente', 'fabbricami'); ?>
                        </label>
                        <p class="description"><?php esc_html_e('Gli ordini ricevuti verranno inviati al gestionale per l\'evasione', 'fabbricami'); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><?php esc_html_e('Sincronizza Clienti', 'fabbricami'); ?></th>
                    <td>
                        <label>
                            <input type="checkbox" name="sync_customers" value="1" <?php checked($sync_customers, '1'); ?>>
                            <?php esc_html_e('Sincronizza anagrafica clienti', 'fabbricami'); ?>
                        </label>
                        <p class="description"><?php esc_html_e('I dati dei clienti verranno condivisi tra i due sistemi', 'fabbricami'); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="conflict_strategy"><?php esc_html_e('Risoluzione Conflitti', 'fabbricami'); ?></label>
                    </th>
                    <td>
                        <select name="conflict_strategy" id="conflict_strategy">
                            <option value="erp_wins" <?php selected($conflict_strategy, 'erp_wins'); ?>>
                                <?php esc_html_e('ERP vince (consigliato)', 'fabbricami'); ?>
                            </option>
                            <option value="wp_wins" <?php selected($conflict_strategy, 'wp_wins'); ?>>
                                <?php esc_html_e('WordPress vince', 'fabbricami'); ?>
                            </option>
                            <option value="newest_wins" <?php selected($conflict_strategy, 'newest_wins'); ?>>
                                <?php esc_html_e('Piu recente vince', 'fabbricami'); ?>
                            </option>
                            <option value="manual" <?php selected($conflict_strategy, 'manual'); ?>>
                                <?php esc_html_e('Revisione manuale', 'fabbricami'); ?>
                            </option>
                        </select>
                        <p class="description"><?php esc_html_e('Come gestire quando gli stessi dati vengono modificati in entrambi i sistemi', 'fabbricami'); ?></p>
                    </td>
                </tr>
            </table>

            <div class="strategy-explanation">
                <h4><?php esc_html_e('Spiegazione strategie:', 'fabbricami'); ?></h4>
                <ul>
                    <li><strong>ERP vince:</strong> <?php esc_html_e('I dati dell\'ERP sovrascrivono quelli di WordPress', 'fabbricami'); ?></li>
                    <li><strong>WordPress vince:</strong> <?php esc_html_e('I dati di WordPress sovrascrivono quelli dell\'ERP', 'fabbricami'); ?></li>
                    <li><strong>Piu recente vince:</strong> <?php esc_html_e('Viene mantenuto il dato modificato piu di recente', 'fabbricami'); ?></li>
                    <li><strong>Revisione manuale:</strong> <?php esc_html_e('I conflitti vengono salvati per revisione manuale', 'fabbricami'); ?></li>
                </ul>
            </div>
        </div>
        <?php
    }

    /**
     * Step 5: Completamento
     */
    private function render_step_complete() {
        ?>
        <div class="wizard-step-content complete-step">
            <div class="complete-icon">
                <span class="dashicons dashicons-yes-alt"></span>
            </div>

            <h3><?php esc_html_e('Riepilogo Configurazione', 'fabbricami'); ?></h3>

            <div class="config-summary">
                <table class="widefat">
                    <tr>
                        <th><?php esc_html_e('URL ERP', 'fabbricami'); ?></th>
                        <td><?php echo esc_html(get_option('fabbricami_erp_url', 'Non configurato')); ?></td>
                    </tr>
                    <tr>
                        <th><?php esc_html_e('Sync Prodotti', 'fabbricami'); ?></th>
                        <td><?php echo get_option('fabbricami_sync_products', '1') === '1' ? '&#10003; Abilitato' : '&#10005; Disabilitato'; ?></td>
                    </tr>
                    <tr>
                        <th><?php esc_html_e('Sync Stock', 'fabbricami'); ?></th>
                        <td><?php echo get_option('fabbricami_sync_stock', '1') === '1' ? '&#10003; Abilitato' : '&#10005; Disabilitato'; ?></td>
                    </tr>
                    <tr>
                        <th><?php esc_html_e('Sync Ordini', 'fabbricami'); ?></th>
                        <td><?php echo get_option('fabbricami_sync_orders', '1') === '1' ? '&#10003; Abilitato' : '&#10005; Disabilitato'; ?></td>
                    </tr>
                    <tr>
                        <th><?php esc_html_e('Sync Clienti', 'fabbricami'); ?></th>
                        <td><?php echo get_option('fabbricami_sync_customers', '1') === '1' ? '&#10003; Abilitato' : '&#10005; Disabilitato'; ?></td>
                    </tr>
                    <tr>
                        <th><?php esc_html_e('Strategia Conflitti', 'fabbricami'); ?></th>
                        <td><?php echo esc_html(get_option('fabbricami_conflict_strategy', 'erp_wins')); ?></td>
                    </tr>
                </table>
            </div>

            <div class="final-notice">
                <span class="dashicons dashicons-info"></span>
                <p>
                    <?php esc_html_e('Cliccando "Completa Setup" la sincronizzazione verra attivata immediatamente.', 'fabbricami'); ?>
                    <?php esc_html_e('Potrai modificare queste impostazioni in qualsiasi momento dalla pagina Impostazioni.', 'fabbricami'); ?>
                </p>
            </div>
        </div>
        <?php
    }

    /**
     * AJAX: Test connessione
     */
    public function ajax_test_connection() {
        check_ajax_referer('fabbricami_wizard', 'nonce');

        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error(array('message' => 'Permessi insufficienti'));
        }

        $url = isset($_POST['url']) ? sanitize_url($_POST['url']) : '';
        $username = isset($_POST['username']) ? sanitize_text_field($_POST['username']) : '';
        $password = isset($_POST['password']) ? $_POST['password'] : '';

        if (empty($url) || empty($username) || empty($password)) {
            wp_send_json_error(array('message' => __('Compila tutti i campi', 'fabbricami')));
        }

        // Test connessione
        $test_url = rtrim($url, '/') . '/api/v1/wordpress/verify';

        $response = wp_remote_get($test_url, array(
            'timeout' => 15,
            'headers' => array(
                'Authorization' => 'Basic ' . base64_encode($username . ':' . $password),
                'Content-Type' => 'application/json'
            )
        ));

        if (is_wp_error($response)) {
            wp_send_json_error(array('message' => $response->get_error_message()));
        }

        $code = wp_remote_retrieve_response_code($response);

        if ($code === 401) {
            wp_send_json_error(array('message' => __('Credenziali non valide', 'fabbricami')));
        }

        if ($code !== 200) {
            wp_send_json_error(array('message' => sprintf(__('Errore HTTP %d', 'fabbricami'), $code)));
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);

        wp_send_json_success(array(
            'message' => __('Connessione riuscita!', 'fabbricami'),
            'erp_info' => $body
        ));
    }

    /**
     * AJAX: Salva step
     */
    public function ajax_save_step() {
        check_ajax_referer('fabbricami_wizard', 'nonce');

        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error(array('message' => 'Permessi insufficienti'));
        }

        $step = isset($_POST['step']) ? intval($_POST['step']) : 0;
        $data = isset($_POST['data']) ? $_POST['data'] : array();

        if ($step > 0) {
            $this->save_step_data($step, $data);
            wp_send_json_success();
        }

        wp_send_json_error();
    }
}
