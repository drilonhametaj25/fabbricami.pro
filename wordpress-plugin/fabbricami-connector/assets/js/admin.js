/**
 * FabbricaMi Admin JavaScript
 */

(function($) {
    'use strict';

    var FabbricaMiAdmin = {
        /**
         * Initialize
         */
        init: function() {
            this.bindEvents();
        },

        /**
         * Bind event handlers
         */
        bindEvents: function() {
            // Sync buttons
            $('#run-sync-now').on('click', this.runSync.bind(this, 'full'));
            $('#run-stock-sync').on('click', this.runSync.bind(this, 'stock'));
            $('#run-health-check').on('click', this.runSync.bind(this, 'health'));

            // Log actions
            $('#clear-logs').on('click', this.clearLogs.bind(this));
            $('#export-logs').on('click', this.exportLogs.bind(this));

            // Queue actions
            $('.retry-job').on('click', this.retryJob.bind(this));
            $('#retry-all-failed').on('click', this.retryAllFailed.bind(this));

            // Conflict actions
            $('.resolve-conflict').on('click', this.resolveConflict.bind(this));
            $('.ignore-conflict').on('click', this.ignoreConflict.bind(this));
        },

        /**
         * Run sync
         */
        runSync: function(type, e) {
            e.preventDefault();

            var $button = $(e.currentTarget);
            var $result = $('#sync-result');

            $button.prop('disabled', true);
            $result.removeClass('success error').addClass('loading').text(fabbricamiAdmin.strings.syncing).show();

            $.ajax({
                url: fabbricamiAdmin.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'fabbricami_run_sync',
                    nonce: fabbricamiAdmin.nonce,
                    type: type
                },
                success: function(response) {
                    $button.prop('disabled', false);

                    if (response.success) {
                        $result.removeClass('loading').addClass('success').text(fabbricamiAdmin.strings.sync_complete);

                        if (type === 'health' && response.data && response.data.health) {
                            $result.text('Health: ' + response.data.health.status);
                        }

                        // Reload page after 2 seconds
                        setTimeout(function() {
                            window.location.reload();
                        }, 2000);
                    } else {
                        $result.removeClass('loading').addClass('error').text(response.data || fabbricamiAdmin.strings.error);
                    }
                },
                error: function() {
                    $button.prop('disabled', false);
                    $result.removeClass('loading').addClass('error').text(fabbricamiAdmin.strings.error);
                }
            });
        },

        /**
         * Clear logs
         */
        clearLogs: function(e) {
            e.preventDefault();

            if (!confirm(fabbricamiAdmin.strings.confirm_clear_logs)) {
                return;
            }

            $.ajax({
                url: fabbricamiAdmin.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'fabbricami_clear_logs',
                    nonce: fabbricamiAdmin.nonce
                },
                success: function(response) {
                    if (response.success) {
                        window.location.reload();
                    } else {
                        alert(fabbricamiAdmin.strings.error);
                    }
                }
            });
        },

        /**
         * Export logs
         */
        exportLogs: function(e) {
            e.preventDefault();

            // Create form and submit
            var $form = $('<form>', {
                method: 'POST',
                action: fabbricamiAdmin.ajaxUrl
            });

            $form.append($('<input>', { type: 'hidden', name: 'action', value: 'fabbricami_export_logs' }));
            $form.append($('<input>', { type: 'hidden', name: 'nonce', value: fabbricamiAdmin.nonce }));

            $('body').append($form);
            $form.submit();
            $form.remove();
        },

        /**
         * Retry single job
         */
        retryJob: function(e) {
            e.preventDefault();

            var $button = $(e.currentTarget);
            var jobId = $button.data('id');

            $button.prop('disabled', true).text('...');

            $.ajax({
                url: fabbricamiAdmin.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'fabbricami_retry_failed',
                    nonce: fabbricamiAdmin.nonce,
                    job_id: jobId
                },
                success: function(response) {
                    if (response.success) {
                        $button.closest('tr').fadeOut(function() {
                            $(this).remove();
                        });
                    } else {
                        $button.prop('disabled', false).text('Ritenta');
                        alert(fabbricamiAdmin.strings.error);
                    }
                }
            });
        },

        /**
         * Retry all failed jobs
         */
        retryAllFailed: function(e) {
            e.preventDefault();

            if (!confirm(fabbricamiAdmin.strings.confirm_retry_all)) {
                return;
            }

            var $button = $(e.currentTarget);
            $button.prop('disabled', true);

            // Collect all failed job IDs
            var jobIds = [];
            $('.retry-job').each(function() {
                jobIds.push($(this).data('id'));
            });

            // Retry each job
            var completed = 0;
            jobIds.forEach(function(jobId) {
                $.ajax({
                    url: fabbricamiAdmin.ajaxUrl,
                    type: 'POST',
                    data: {
                        action: 'fabbricami_retry_failed',
                        nonce: fabbricamiAdmin.nonce,
                        job_id: jobId
                    },
                    complete: function() {
                        completed++;
                        if (completed === jobIds.length) {
                            window.location.reload();
                        }
                    }
                });
            });
        },

        /**
         * Resolve conflict
         */
        resolveConflict: function(e) {
            e.preventDefault();

            var $button = $(e.currentTarget);
            var conflictId = $button.data('id');
            var strategy = $button.data('strategy');

            $button.prop('disabled', true);

            $.ajax({
                url: fabbricamiAdmin.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'fabbricami_resolve_conflict',
                    nonce: fabbricamiAdmin.nonce,
                    conflict_id: conflictId,
                    strategy: strategy
                },
                success: function(response) {
                    if (response.success) {
                        $button.closest('tr').fadeOut(function() {
                            $(this).remove();
                        });
                    } else {
                        $button.prop('disabled', false);
                        alert(fabbricamiAdmin.strings.error);
                    }
                }
            });
        },

        /**
         * Ignore conflict
         */
        ignoreConflict: function(e) {
            e.preventDefault();

            var $button = $(e.currentTarget);
            var conflictId = $button.data('id');

            $button.prop('disabled', true);

            $.ajax({
                url: fabbricamiAdmin.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'fabbricami_resolve_conflict',
                    nonce: fabbricamiAdmin.nonce,
                    conflict_id: conflictId,
                    strategy: 'ignore'
                },
                success: function(response) {
                    if (response.success) {
                        $button.closest('tr').fadeOut(function() {
                            $(this).remove();
                        });
                    } else {
                        $button.prop('disabled', false);
                        alert(fabbricamiAdmin.strings.error);
                    }
                }
            });
        }
    };

    // Initialize on document ready
    $(document).ready(function() {
        FabbricaMiAdmin.init();
    });

})(jQuery);
