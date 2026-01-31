/**
 * PegasoWorld ERP Connector - Admin JavaScript
 */

(function($) {
    'use strict';

    // Test connessione
    $('#test-connection').on('click', function() {
        var $btn = $(this);
        var $status = $('#connection-status');
        var $icon = $status.find('.status-icon');
        var $text = $status.find('.status-text');

        $btn.prop('disabled', true).text(pegasoworldErp.strings.testing);
        $icon.removeClass('status-unknown status-success status-error').addClass('status-unknown');
        $text.text(pegasoworldErp.strings.testing);

        $.ajax({
            url: pegasoworldErp.ajax_url,
            type: 'POST',
            data: {
                action: 'pegasoworld_test_connection',
                nonce: pegasoworldErp.nonce
            },
            success: function(response) {
                if (response.success) {
                    $icon.removeClass('status-unknown').addClass('status-success');
                    $text.text(pegasoworldErp.strings.success);
                } else {
                    $icon.removeClass('status-unknown').addClass('status-error');
                    $text.text(pegasoworldErp.strings.error + ': ' + (response.data || 'Errore sconosciuto'));
                }
            },
            error: function(xhr, status, error) {
                $icon.removeClass('status-unknown').addClass('status-error');
                $text.text(pegasoworldErp.strings.error + ': ' + error);
            },
            complete: function() {
                $btn.prop('disabled', false).text('Test Connessione');
            }
        });
    });

    // Copia API Key
    $('#copy-api-key').on('click', function() {
        var $field = $('.api-key-field');
        $field.select();
        document.execCommand('copy');

        var $btn = $(this);
        var originalHtml = $btn.html();
        $btn.html('<span class="dashicons dashicons-yes"></span>');

        setTimeout(function() {
            $btn.html(originalHtml);
        }, 1500);
    });

    // Rigenera API Key
    $('#regenerate-api-key').on('click', function() {
        if (!confirm(pegasoworldErp.strings.confirm_regenerate)) {
            return;
        }

        var $btn = $(this);
        $btn.prop('disabled', true);

        $.ajax({
            url: pegasoworldErp.ajax_url,
            type: 'POST',
            data: {
                action: 'pegasoworld_regenerate_api_key',
                nonce: pegasoworldErp.nonce
            },
            success: function(response) {
                if (response.success && response.data.api_key) {
                    $('.api-key-field').val(response.data.api_key);
                    alert('API Key rigenerata con successo!');
                } else {
                    alert('Errore nella rigenerazione della API Key');
                }
            },
            error: function() {
                alert('Errore di comunicazione');
            },
            complete: function() {
                $btn.prop('disabled', false);
            }
        });
    });

    // Svuota log
    $('#clear-logs').on('click', function() {
        if (!confirm(pegasoworldErp.strings.confirm_clear)) {
            return;
        }

        var $btn = $(this);
        $btn.prop('disabled', true);

        $.ajax({
            url: pegasoworldErp.ajax_url,
            type: 'POST',
            data: {
                action: 'pegasoworld_clear_logs',
                nonce: pegasoworldErp.nonce
            },
            success: function(response) {
                if (response.success) {
                    location.reload();
                } else {
                    alert('Errore nella cancellazione dei log');
                }
            },
            error: function() {
                alert('Errore di comunicazione');
            },
            complete: function() {
                $btn.prop('disabled', false);
            }
        });
    });

})(jQuery);
