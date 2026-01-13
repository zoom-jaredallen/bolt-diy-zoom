/* eslint-disable */
/**
 * Bolt.diy Proxy SDK
 *
 * This SDK provides OAuth and Webhook proxy functionality for apps
 * running inside bolt.diy's WebContainer environment.
 *
 * Usage in WebContainer apps:
 *
 * 1. Include this script:
 *    <script src="/proxy-sdk.js"></script>
 *
 * 2. Use OAuth:
 *    const tokens = await BoltProxy.oauth.authorize('zoom', ['meeting:read']);
 *
 * 3. Use Webhooks:
 *    const session = await BoltProxy.webhooks.createSession();
 *    console.log('Webhook URL:', session.webhookUrl);
 *    const events = await BoltProxy.webhooks.poll(session.id);
 */

(function (global) {
  'use strict';

  const BoltProxy = {
    /**
     * OAuth Proxy Methods
     */
    oauth: {
      /**
       * Start OAuth authorization flow
       * Opens a popup window to the OAuth provider
       *
       * @param {string} provider - OAuth provider (zoom, github, gitlab, google)
       * @param {string[]} scopes - Array of OAuth scopes to request
       * @returns {Promise<object>} - Resolves with tokens on success
       */
      authorize: function (provider, scopes) {
        return new Promise(function (resolve, reject) {
          const scopeString = Array.isArray(scopes) ? scopes.join(',') : scopes || '';
          const url = '/api/oauth/proxy/start?provider=' + encodeURIComponent(provider) +
            '&scopes=' + encodeURIComponent(scopeString);

          // Open popup window
          const width = 500;
          const height = 600;
          const left = (window.screen.width - width) / 2;
          const top = (window.screen.height - height) / 2;
          const popup = window.open(
            url,
            'oauth_popup',
            'width=' + width + ',height=' + height + ',left=' + left + ',top=' + top + ',scrollbars=yes'
          );

          if (!popup) {
            reject(new Error('Failed to open popup window. Please allow popups for this site.'));
            return;
          }

          // Listen for postMessage from callback page
          function handleMessage(event) {
            if (event.data && event.data.type === 'oauth-response') {
              window.removeEventListener('message', handleMessage);
              clearInterval(checkClosed);

              if (event.data.success) {
                resolve(event.data.tokens);
              } else {
                reject(new Error(event.data.error + ': ' + (event.data.errorDescription || 'Unknown error')));
              }
            }
          }

          window.addEventListener('message', handleMessage);

          // Also listen via BroadcastChannel
          var channel;
          if (typeof BroadcastChannel !== 'undefined') {
            channel = new BroadcastChannel('oauth-proxy');
            channel.onmessage = function (event) {
              if (event.data && event.data.type === 'oauth-response') {
                channel.close();
                window.removeEventListener('message', handleMessage);
                clearInterval(checkClosed);

                if (event.data.success) {
                  resolve(event.data.tokens);
                } else {
                  reject(new Error(event.data.error + ': ' + (event.data.errorDescription || 'Unknown error')));
                }
              }
            };
          }

          // Check if popup was closed without completing
          var checkClosed = setInterval(function () {
            if (popup.closed) {
              clearInterval(checkClosed);
              window.removeEventListener('message', handleMessage);
              if (channel) channel.close();
              reject(new Error('OAuth popup was closed before completing authorization'));
            }
          }, 500);
        });
      },

      /**
       * Get supported OAuth providers
       * @returns {string[]} - Array of provider names
       */
      getSupportedProviders: function () {
        return ['zoom', 'github', 'gitlab', 'google'];
      }
    },

    /**
     * Webhook Proxy Methods
     */
    webhooks: {
      /**
       * Create a new webhook session
       *
       * @param {object} options - Session options
       * @param {string} options.description - Optional description
       * @returns {Promise<object>} - Session info including webhookUrl
       */
      createSession: function (options) {
        options = options || {};
        return fetch('/api/webhook/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: options.description
          })
        })
          .then(function (response) {
            if (!response.ok) {
              throw new Error('Failed to create webhook session');
            }
            return response.json();
          })
          .then(function (data) {
            return data.session;
          });
      },

      /**
       * Poll for webhook events
       *
       * @param {string} sessionId - Session ID
       * @param {number} limit - Maximum number of events to retrieve
       * @returns {Promise<object[]>} - Array of webhook events
       */
      poll: function (sessionId, limit) {
        var url = '/api/webhook/poll/' + encodeURIComponent(sessionId);
        if (limit) {
          url += '?limit=' + limit;
        }

        return fetch(url)
          .then(function (response) {
            if (!response.ok) {
              throw new Error('Failed to poll webhooks');
            }
            return response.json();
          })
          .then(function (data) {
            return data.events;
          });
      },

      /**
       * Get session info
       *
       * @param {string} sessionId - Session ID
       * @returns {Promise<object>} - Session info
       */
      getSession: function (sessionId) {
        return fetch('/api/webhook/session?sessionId=' + encodeURIComponent(sessionId))
          .then(function (response) {
            if (!response.ok) {
              throw new Error('Failed to get session');
            }
            return response.json();
          })
          .then(function (data) {
            return data.session;
          });
      },

      /**
       * Delete a webhook session
       *
       * @param {string} sessionId - Session ID
       * @returns {Promise<void>}
       */
      deleteSession: function (sessionId) {
        return fetch('/api/webhook/session?sessionId=' + encodeURIComponent(sessionId), {
          method: 'DELETE'
        })
          .then(function (response) {
            if (!response.ok) {
              throw new Error('Failed to delete session');
            }
          });
      },

      /**
       * Start automatic polling
       *
       * @param {string} sessionId - Session ID
       * @param {function} callback - Called with each batch of events
       * @param {number} interval - Polling interval in ms (default: 2000)
       * @returns {object} - Controller with stop() method
       */
      startPolling: function (sessionId, callback, interval) {
        interval = interval || 2000;
        var running = true;

        function poll() {
          if (!running) return;

          BoltProxy.webhooks.poll(sessionId)
            .then(function (events) {
              if (events && events.length > 0) {
                callback(events);
              }
            })
            .catch(function (error) {
              console.error('Webhook polling error:', error);
            })
            .finally(function () {
              if (running) {
                setTimeout(poll, interval);
              }
            });
        }

        poll();

        return {
          stop: function () {
            running = false;
          }
        };
      }
    },

    /**
     * Utility Methods
     */
    utils: {
      /**
       * Get the public URL of the bolt.diy instance
       * @returns {string}
       */
      getPublicUrl: function () {
        return window.location.origin;
      },

      /**
       * Check if running inside WebContainer
       * @returns {boolean}
       */
      isWebContainer: function () {
        return window.location.hostname.includes('webcontainer-api.io') ||
          window.parent !== window;
      }
    }
  };

  // Export to global scope
  global.BoltProxy = BoltProxy;

  // Also export as ES module if supported
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BoltProxy;
  }

})(typeof window !== 'undefined' ? window : this);
