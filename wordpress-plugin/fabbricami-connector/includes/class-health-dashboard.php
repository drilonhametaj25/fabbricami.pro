<?php
/**
 * FabbricaMi Health Dashboard
 *
 * Widget dashboard WordPress per monitoraggio stato sync
 *
 * @package FabbricaMi
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Classe Health Dashboard
 */
class FabbricaMi_Health_Dashboard {

    /**
     * Costruttore
     */
    public function __construct() {
        add_action('wp_dashboard_setup', array($this, 'add_dashboard_widget'));
    }

    /**
     * Aggiungi widget alla dashboard WordPress
     */
    public function add_dashboard_widget() {
        if (!current_user_can('manage_woocommerce')) {
            return;
        }

        wp_add_dashboard_widget(
            'fabbricami_health_widget',
            __('FabbricaMi ERP - Stato Sync', 'fabbricami'),
            array($this, 'render_widget'),
            null,
            null,
            'normal',
            'high'
        );
    }

    /**
     * Render widget
     */
    public function render_widget() {
        $stats = fabbricami()->get_stats();
        $health = get_option('fabbricami_health_status', array());
        $is_configured = fabbricami()->auth->is_erp_configured();
        $is_enabled = fabbricami()->is_sync_enabled();
        $wizard_completed = fabbricami()->is_wizard_completed();

        // Stile inline per il widget
        ?>
        <style>
            .fabbricami-widget { font-size: 13px; }
            .fabbricami-widget .widget-status {
                display: flex;
                align-items: center;
                padding: 10px;
                margin-bottom: 15px;
                border-radius: 4px;
                font-weight: 500;
            }
            .fabbricami-widget .status-healthy { background: #d4edda; color: #155724; }
            .fabbricami-widget .status-warning { background: #fff3cd; color: #856404; }
            .fabbricami-widget .status-error { background: #f8d7da; color: #721c24; }
            .fabbricami-widget .status-unconfigured { background: #e2e3e5; color: #383d41; }
            .fabbricami-widget .widget-status .dashicons { margin-right: 8px; font-size: 18px; }
            .fabbricami-widget .stats-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 10px;
                margin-bottom: 15px;
            }
            .fabbricami-widget .stat-box {
                background: #f8f9fa;
                padding: 10px;
                border-radius: 4px;
                text-align: center;
            }
            .fabbricami-widget .stat-box .stat-value {
                font-size: 24px;
                font-weight: 700;
                line-height: 1;
            }
            .fabbricami-widget .stat-box .stat-label {
                font-size: 11px;
                color: #666;
                margin-top: 5px;
            }
            .fabbricami-widget .stat-success .stat-value { color: #28a745; }
            .fabbricami-widget .stat-error .stat-value { color: #dc3545; }
            .fabbricami-widget .stat-warning .stat-value { color: #ffc107; }
            .fabbricami-widget .issues-list {
                margin: 10px 0;
                padding: 0;
                list-style: none;
            }
            .fabbricami-widget .issues-list li {
                padding: 5px 0;
                border-bottom: 1px solid #eee;
                display: flex;
                align-items: center;
            }
            .fabbricami-widget .issues-list li:last-child { border-bottom: none; }
            .fabbricami-widget .issues-list .dashicons { margin-right: 5px; color: #dc3545; }
            .fabbricami-widget .widget-actions { margin-top: 15px; }
            .fabbricami-widget .widget-actions a { margin-right: 10px; }
        </style>

        <div class="fabbricami-widget">
            <?php if (!$wizard_completed): ?>
                <div class="widget-status status-unconfigured">
                    <span class="dashicons dashicons-admin-settings"></span>
                    <?php esc_html_e('Setup non completato', 'fabbricami'); ?>
                </div>
                <p><?php esc_html_e('Completa il setup wizard per iniziare la sincronizzazione.', 'fabbricami'); ?></p>
                <a href="<?php echo esc_url(admin_url('admin.php?page=fabbricami-wizard')); ?>" class="button button-primary">
                    <?php esc_html_e('Avvia Setup', 'fabbricami'); ?>
                </a>

            <?php elseif (!$is_configured): ?>
                <div class="widget-status status-error">
                    <span class="dashicons dashicons-warning"></span>
                    <?php esc_html_e('Non Configurato', 'fabbricami'); ?>
                </div>
                <p><?php esc_html_e('Configura la connessione ERP nelle impostazioni.', 'fabbricami'); ?></p>
                <a href="<?php echo esc_url(admin_url('admin.php?page=fabbricami-config')); ?>" class="button button-primary">
                    <?php esc_html_e('Configura', 'fabbricami'); ?>
                </a>

            <?php else: ?>
                <?php
                $status_class = 'status-healthy';
                $status_text = __('Sistema OK', 'fabbricami');
                $status_icon = 'yes-alt';

                if (isset($health['status'])) {
                    if ($health['status'] === 'degraded') {
                        $status_class = 'status-warning';
                        $status_text = __('Alcuni problemi', 'fabbricami');
                        $status_icon = 'warning';
                    } elseif ($health['status'] === 'unconfigured' || $health['status'] === 'error') {
                        $status_class = 'status-error';
                        $status_text = __('Errori', 'fabbricami');
                        $status_icon = 'dismiss';
                    }
                }

                if (!$is_enabled) {
                    $status_class = 'status-warning';
                    $status_text = __('Sync Disabilitato', 'fabbricami');
                    $status_icon = 'controls-pause';
                }
                ?>

                <div class="widget-status <?php echo esc_attr($status_class); ?>">
                    <span class="dashicons dashicons-<?php echo esc_attr($status_icon); ?>"></span>
                    <?php echo esc_html($status_text); ?>
                </div>

                <div class="stats-grid">
                    <div class="stat-box stat-success">
                        <div class="stat-value"><?php echo esc_html($stats['sync_today']['success']); ?></div>
                        <div class="stat-label"><?php esc_html_e('Sync Oggi', 'fabbricami'); ?></div>
                    </div>
                    <div class="stat-box stat-error">
                        <div class="stat-value"><?php echo esc_html($stats['sync_today']['error']); ?></div>
                        <div class="stat-label"><?php esc_html_e('Errori Oggi', 'fabbricami'); ?></div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value"><?php echo esc_html($stats['queue']['pending']); ?></div>
                        <div class="stat-label"><?php esc_html_e('In Coda', 'fabbricami'); ?></div>
                    </div>
                    <div class="stat-box <?php echo $stats['conflicts']['pending'] > 0 ? 'stat-warning' : ''; ?>">
                        <div class="stat-value"><?php echo esc_html($stats['conflicts']['pending']); ?></div>
                        <div class="stat-label"><?php esc_html_e('Conflitti', 'fabbricami'); ?></div>
                    </div>
                </div>

                <?php if (!empty($health['issues'])): ?>
                    <h4 style="margin: 15px 0 5px;"><?php esc_html_e('Problemi Rilevati:', 'fabbricami'); ?></h4>
                    <ul class="issues-list">
                        <?php foreach (array_slice($health['issues'], 0, 3) as $issue): ?>
                            <li>
                                <span class="dashicons dashicons-warning"></span>
                                <?php echo esc_html($issue['message']); ?>
                            </li>
                        <?php endforeach; ?>
                    </ul>
                <?php endif; ?>

                <?php if ($stats['queue']['failed'] > 0): ?>
                    <p style="color: #dc3545;">
                        <span class="dashicons dashicons-warning"></span>
                        <?php printf(esc_html__('%d job falliti in coda', 'fabbricami'), $stats['queue']['failed']); ?>
                    </p>
                <?php endif; ?>

                <div class="widget-actions">
                    <a href="<?php echo esc_url(admin_url('admin.php?page=fabbricami-settings')); ?>" class="button button-primary">
                        <?php esc_html_e('Dashboard', 'fabbricami'); ?>
                    </a>
                    <?php if ($stats['conflicts']['pending'] > 0): ?>
                        <a href="<?php echo esc_url(admin_url('admin.php?page=fabbricami-conflicts')); ?>" class="button">
                            <?php esc_html_e('Risolvi Conflitti', 'fabbricami'); ?>
                        </a>
                    <?php endif; ?>
                    <?php if ($stats['queue']['failed'] > 0): ?>
                        <a href="<?php echo esc_url(admin_url('admin.php?page=fabbricami-queue&status=failed')); ?>" class="button">
                            <?php esc_html_e('Vedi Falliti', 'fabbricami'); ?>
                        </a>
                    <?php endif; ?>
                </div>

            <?php endif; ?>
        </div>
        <?php
    }
}
