<?php
/**
 * FabbricaMi Logger
 *
 * Sistema di logging avanzato con livelli, durata, context e cleanup automatico
 *
 * @package FabbricaMi
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Classe Logger
 */
class FabbricaMi_Logger {

    /**
     * Livelli di log supportati
     */
    const LEVEL_DEBUG = 'debug';
    const LEVEL_INFO = 'info';
    const LEVEL_WARNING = 'warning';
    const LEVEL_ERROR = 'error';
    const LEVEL_CRITICAL = 'critical';

    /**
     * Priorita livelli (numero piu alto = piu importante)
     */
    private $level_priority = array(
        'debug' => 0,
        'info' => 1,
        'warning' => 2,
        'error' => 3,
        'critical' => 4
    );

    /**
     * Nome tabella
     */
    private $table_name;

    /**
     * Livello minimo di log
     */
    private $min_level;

    /**
     * Costruttore
     */
    public function __construct() {
        global $wpdb;
        $this->table_name = $wpdb->prefix . 'fabbricami_log';
        $this->min_level = get_option('fabbricami_log_level', 'info');

        // Hook per cleanup automatico
        add_action('fabbricami_cleanup', array($this, 'cleanup_old_logs'));
    }

    /**
     * Verifica se il livello dovrebbe essere loggato
     */
    private function should_log($level) {
        $min_priority = isset($this->level_priority[$this->min_level])
            ? $this->level_priority[$this->min_level]
            : 1;
        $log_priority = isset($this->level_priority[$level])
            ? $this->level_priority[$level]
            : 1;

        return $log_priority >= $min_priority;
    }

    /**
     * Log generico
     *
     * @param string $level Livello log
     * @param string $direction 'incoming' o 'outgoing'
     * @param string $entity Tipo entita (product, order, stock, etc.)
     * @param string $entity_id ID entita
     * @param string $action Azione eseguita
     * @param string $status Stato (success, error, pending)
     * @param string $message Messaggio descrittivo
     * @param array $context Dati aggiuntivi
     * @param int|null $duration_ms Durata operazione in ms
     */
    public function log($level, $direction, $entity, $entity_id, $action, $status, $message = '', $context = array(), $duration_ms = null) {
        if (!$this->should_log($level)) {
            return false;
        }

        global $wpdb;

        $data = array(
            'level' => $level,
            'direction' => $direction,
            'entity' => $entity,
            'entity_id' => strval($entity_id),
            'action' => $action,
            'status' => $status,
            'message' => $message,
            'context' => !empty($context) ? wp_json_encode($context) : null,
            'duration_ms' => $duration_ms,
            'created_at' => current_time('mysql')
        );

        $result = $wpdb->insert($this->table_name, $data);

        // In caso di errore critico, scrivi anche su error_log
        if ($level === self::LEVEL_CRITICAL || $level === self::LEVEL_ERROR) {
            error_log(sprintf(
                '[FabbricaMi %s] %s - %s/%s: %s - %s',
                strtoupper($level),
                $direction,
                $entity,
                $entity_id,
                $action,
                $message
            ));
        }

        return $result !== false;
    }

    /**
     * Shortcut: Log Debug
     */
    public function debug($action, $context = array(), $message = '') {
        return $this->log(
            self::LEVEL_DEBUG,
            'internal',
            'system',
            '0',
            $action,
            'info',
            $message,
            $context
        );
    }

    /**
     * Shortcut: Log Info
     */
    public function info($direction, $entity, $entity_id, $action, $message = '', $context = array()) {
        return $this->log(
            self::LEVEL_INFO,
            $direction,
            $entity,
            $entity_id,
            $action,
            'success',
            $message,
            $context
        );
    }

    /**
     * Shortcut: Log Warning
     */
    public function warning($direction, $entity, $entity_id, $action, $message = '', $context = array()) {
        return $this->log(
            self::LEVEL_WARNING,
            $direction,
            $entity,
            $entity_id,
            $action,
            'warning',
            $message,
            $context
        );
    }

    /**
     * Shortcut: Log Error
     */
    public function error($action, $context = array(), $message = '') {
        $entity = isset($context['entity']) ? $context['entity'] : 'system';
        $entity_id = isset($context['entity_id']) ? $context['entity_id'] : '0';
        $direction = isset($context['direction']) ? $context['direction'] : 'internal';

        return $this->log(
            self::LEVEL_ERROR,
            $direction,
            $entity,
            $entity_id,
            $action,
            'error',
            $message,
            $context
        );
    }

    /**
     * Shortcut: Log Critical
     */
    public function critical($action, $context = array(), $message = '') {
        $entity = isset($context['entity']) ? $context['entity'] : 'system';
        $entity_id = isset($context['entity_id']) ? $context['entity_id'] : '0';
        $direction = isset($context['direction']) ? $context['direction'] : 'internal';

        return $this->log(
            self::LEVEL_CRITICAL,
            $direction,
            $entity,
            $entity_id,
            $action,
            'error',
            $message,
            $context
        );
    }

    /**
     * Log sync operation (comodo per le operazioni di sync)
     */
    public function sync($direction, $entity, $entity_id, $action, $status, $message = '', $context = array(), $duration_ms = null) {
        $level = $status === 'error' ? self::LEVEL_ERROR : self::LEVEL_INFO;

        return $this->log(
            $level,
            $direction,
            $entity,
            $entity_id,
            $action,
            $status,
            $message,
            $context,
            $duration_ms
        );
    }

    /**
     * Ottieni log con paginazione e filtri
     *
     * @param array $args Argomenti di filtro
     * @return array
     */
    public function get_logs($args = array()) {
        global $wpdb;

        $defaults = array(
            'level' => '',
            'direction' => '',
            'entity' => '',
            'entity_id' => '',
            'status' => '',
            'search' => '',
            'date_from' => '',
            'date_to' => '',
            'page' => 1,
            'per_page' => 50,
            'orderby' => 'created_at',
            'order' => 'DESC'
        );

        $args = wp_parse_args($args, $defaults);

        $where = array('1=1');
        $values = array();

        if (!empty($args['level'])) {
            $where[] = 'level = %s';
            $values[] = $args['level'];
        }

        if (!empty($args['direction'])) {
            $where[] = 'direction = %s';
            $values[] = $args['direction'];
        }

        if (!empty($args['entity'])) {
            $where[] = 'entity = %s';
            $values[] = $args['entity'];
        }

        if (!empty($args['entity_id'])) {
            $where[] = 'entity_id = %s';
            $values[] = $args['entity_id'];
        }

        if (!empty($args['status'])) {
            $where[] = 'status = %s';
            $values[] = $args['status'];
        }

        if (!empty($args['search'])) {
            $where[] = '(message LIKE %s OR action LIKE %s)';
            $search_term = '%' . $wpdb->esc_like($args['search']) . '%';
            $values[] = $search_term;
            $values[] = $search_term;
        }

        if (!empty($args['date_from'])) {
            $where[] = 'DATE(created_at) >= %s';
            $values[] = $args['date_from'];
        }

        if (!empty($args['date_to'])) {
            $where[] = 'DATE(created_at) <= %s';
            $values[] = $args['date_to'];
        }

        $where_clause = implode(' AND ', $where);

        // Sanitizza orderby e order
        $allowed_orderby = array('id', 'level', 'direction', 'entity', 'status', 'created_at', 'duration_ms');
        $orderby = in_array($args['orderby'], $allowed_orderby) ? $args['orderby'] : 'created_at';
        $order = strtoupper($args['order']) === 'ASC' ? 'ASC' : 'DESC';

        // Count totale
        $count_sql = "SELECT COUNT(*) FROM {$this->table_name} WHERE {$where_clause}";
        if (!empty($values)) {
            $count_sql = $wpdb->prepare($count_sql, $values);
        }
        $total = intval($wpdb->get_var($count_sql));

        // Query paginata
        $offset = ($args['page'] - 1) * $args['per_page'];
        $limit = intval($args['per_page']);

        $sql = "SELECT * FROM {$this->table_name} WHERE {$where_clause} ORDER BY {$orderby} {$order} LIMIT {$offset}, {$limit}";
        if (!empty($values)) {
            $sql = $wpdb->prepare($sql, $values);
        }
        $logs = $wpdb->get_results($sql);

        // Decodifica context JSON
        foreach ($logs as &$log) {
            if (!empty($log->context)) {
                $log->context = json_decode($log->context, true);
            }
        }

        return array(
            'items' => $logs,
            'total' => $total,
            'pages' => ceil($total / $args['per_page']),
            'page' => $args['page'],
            'per_page' => $args['per_page']
        );
    }

    /**
     * Ottieni statistiche log
     */
    public function get_stats($days = 7) {
        global $wpdb;

        $date_limit = date('Y-m-d', strtotime("-{$days} days"));

        // Count per livello
        $by_level = $wpdb->get_results($wpdb->prepare(
            "SELECT level, COUNT(*) as count
             FROM {$this->table_name}
             WHERE DATE(created_at) >= %s
             GROUP BY level",
            $date_limit
        ), ARRAY_A);

        // Count per status
        $by_status = $wpdb->get_results($wpdb->prepare(
            "SELECT status, COUNT(*) as count
             FROM {$this->table_name}
             WHERE DATE(created_at) >= %s
             GROUP BY status",
            $date_limit
        ), ARRAY_A);

        // Count per entity
        $by_entity = $wpdb->get_results($wpdb->prepare(
            "SELECT entity, COUNT(*) as count
             FROM {$this->table_name}
             WHERE DATE(created_at) >= %s
             GROUP BY entity
             ORDER BY count DESC
             LIMIT 10",
            $date_limit
        ), ARRAY_A);

        // Media durata per entity
        $avg_duration = $wpdb->get_results($wpdb->prepare(
            "SELECT entity, AVG(duration_ms) as avg_ms
             FROM {$this->table_name}
             WHERE DATE(created_at) >= %s AND duration_ms IS NOT NULL
             GROUP BY entity",
            $date_limit
        ), ARRAY_A);

        // Trend giornaliero
        $daily_trend = $wpdb->get_results($wpdb->prepare(
            "SELECT DATE(created_at) as date,
                    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
                    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count
             FROM {$this->table_name}
             WHERE DATE(created_at) >= %s
             GROUP BY DATE(created_at)
             ORDER BY date",
            $date_limit
        ), ARRAY_A);

        return array(
            'by_level' => $this->array_to_keyed($by_level, 'level', 'count'),
            'by_status' => $this->array_to_keyed($by_status, 'status', 'count'),
            'by_entity' => $by_entity,
            'avg_duration' => $this->array_to_keyed($avg_duration, 'entity', 'avg_ms'),
            'daily_trend' => $daily_trend
        );
    }

    /**
     * Helper: Converte array in array associativo
     */
    private function array_to_keyed($array, $key_field, $value_field) {
        $result = array();
        foreach ($array as $item) {
            $result[$item[$key_field]] = $item[$value_field];
        }
        return $result;
    }

    /**
     * Elimina singolo log
     */
    public function delete($id) {
        global $wpdb;
        return $wpdb->delete($this->table_name, array('id' => $id), array('%d'));
    }

    /**
     * Elimina log in bulk
     */
    public function delete_bulk($ids) {
        global $wpdb;

        if (empty($ids)) {
            return 0;
        }

        $ids = array_map('intval', $ids);
        $placeholders = implode(',', array_fill(0, count($ids), '%d'));

        return $wpdb->query($wpdb->prepare(
            "DELETE FROM {$this->table_name} WHERE id IN ({$placeholders})",
            $ids
        ));
    }

    /**
     * Pulisci log vecchi
     */
    public function cleanup_old_logs() {
        global $wpdb;

        $retention_days = intval(get_option('fabbricami_log_retention_days', 30));
        $cutoff_date = date('Y-m-d H:i:s', strtotime("-{$retention_days} days"));

        $deleted = $wpdb->query($wpdb->prepare(
            "DELETE FROM {$this->table_name} WHERE created_at < %s",
            $cutoff_date
        ));

        if ($deleted > 0) {
            $this->info(
                'internal',
                'system',
                '0',
                'cleanup_logs',
                sprintf('Eliminati %d log piu vecchi di %d giorni', $deleted, $retention_days)
            );
        }

        return $deleted;
    }

    /**
     * Svuota tutti i log
     */
    public function truncate() {
        global $wpdb;
        return $wpdb->query("TRUNCATE TABLE {$this->table_name}");
    }

    /**
     * Esporta log in CSV
     */
    public function export_csv($args = array()) {
        $args['per_page'] = 10000; // Max export
        $logs = $this->get_logs($args);

        $output = fopen('php://temp', 'r+');

        // Header
        fputcsv($output, array(
            'ID', 'Livello', 'Direzione', 'Entita', 'ID Entita',
            'Azione', 'Stato', 'Messaggio', 'Durata (ms)', 'Data'
        ));

        // Rows
        foreach ($logs['items'] as $log) {
            fputcsv($output, array(
                $log->id,
                $log->level,
                $log->direction,
                $log->entity,
                $log->entity_id,
                $log->action,
                $log->status,
                $log->message,
                $log->duration_ms,
                $log->created_at
            ));
        }

        rewind($output);
        $csv = stream_get_contents($output);
        fclose($output);

        return $csv;
    }
}
