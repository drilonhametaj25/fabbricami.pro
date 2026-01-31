/**
 * FabbricaMi Setup Wizard JavaScript
 */

(function($) {
    'use strict';

    var FabbricaMiWizard = {
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
            // Test connection button
            $('#test-connection').on('click', this.testConnection.bind(this));

            // Copy API key
            $('.copy-api-key').on('click', this.copyApiKey.bind(this));

            // Auto-save on field change (optional)
            // $('input, select').on('change', this.autoSave.bind(this));
        },

        /**
         * Test ERP connection
         */
        testConnection: function(e) {
            e.preventDefault();

            var $button = $(e.currentTarget);
            var $result = $('#connection-result');

            var url = $('#erp_url').val();
            var username = $('#erp_username').val();
            var password = $('#erp_password').val();

            if (!url || !username || !password) {
                $result.removeClass('success loading').addClass('error').text('Compila tutti i campi');
                return;
            }

            $button.prop('disabled', true);
            $result.removeClass('success error').addClass('loading').text(fabbricamiWizard.strings.testing);

            $.ajax({
                url: fabbricamiWizard.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'fabbricami_test_connection',
                    nonce: fabbricamiWizard.nonce,
                    url: url,
                    username: username,
                    password: password
                },
                success: function(response) {
                    $button.prop('disabled', false);

                    if (response.success) {
                        $result.removeClass('loading error').addClass('success').text(fabbricamiWizard.strings.success);

                        // Show ERP info if available
                        if (response.data && response.data.erp_info) {
                            var info = response.data.erp_info;
                            if (info.version) {
                                $result.text(fabbricamiWizard.strings.success + ' (ERP v' + info.version + ')');
                            }
                        }
                    } else {
                        var errorMsg = response.data && response.data.message ? response.data.message : fabbricamiWizard.strings.error;
                        $result.removeClass('loading success').addClass('error').text(errorMsg);
                    }
                },
                error: function(xhr, status, error) {
                    $button.prop('disabled', false);
                    $result.removeClass('loading success').addClass('error').text(fabbricamiWizard.strings.error + ': ' + error);
                }
            });
        },

        /**
         * Copy API key to clipboard
         */
        copyApiKey: function(e) {
            e.preventDefault();

            var apiKey = $('#api-key-display').text();
            var $button = $(e.currentTarget);

            // Create temporary textarea
            var $temp = $('<textarea>');
            $('body').append($temp);
            $temp.val(apiKey).select();

            try {
                document.execCommand('copy');
                $button.text('Copiato!');
                setTimeout(function() {
                    $button.html('<span class="dashicons dashicons-clipboard"></span> Copia');
                }, 2000);
            } catch (err) {
                // Fallback for modern browsers
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(apiKey).then(function() {
                        $button.text('Copiato!');
                        setTimeout(function() {
                            $button.html('<span class="dashicons dashicons-clipboard"></span> Copia');
                        }, 2000);
                    });
                } else {
                    alert('API Key: ' + apiKey);
                }
            }

            $temp.remove();
        },

        /**
         * Auto-save step data (optional, for better UX)
         */
        autoSave: function(e) {
            var $form = $(e.target).closest('form');
            var step = $form.find('input[name="wizard_step"]').val();

            // Collect form data
            var data = {
                action: 'fabbricami_save_wizard_step',
                nonce: fabbricamiWizard.nonce,
                step: step,
                data: {}
            };

            $form.find('input, select, textarea').each(function() {
                var $field = $(this);
                var name = $field.attr('name');
                if (name && name !== 'fabbricami_wizard_nonce' && name !== 'wizard_step' && name !== 'wizard_action') {
                    if ($field.attr('type') === 'checkbox') {
                        data.data[name] = $field.is(':checked') ? '1' : '0';
                    } else {
                        data.data[name] = $field.val();
                    }
                }
            });

            // Save via AJAX (silent)
            $.ajax({
                url: fabbricamiWizard.ajaxUrl,
                type: 'POST',
                data: data
            });
        }
    };

    // Initialize on document ready
    $(document).ready(function() {
        FabbricaMiWizard.init();
    });

})(jQuery);
