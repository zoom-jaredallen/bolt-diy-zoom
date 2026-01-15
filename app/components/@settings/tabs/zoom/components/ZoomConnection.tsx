import React from 'react';
import { motion } from 'framer-motion';
import { useStore } from '@nanostores/react';
import { classNames } from '~/utils/classNames';
import { zoomConnection, isCheckingConfig } from '~/lib/stores/zoom';

export function ZoomConnection() {
  const connection = useStore(zoomConnection);
  const checkingConfig = useStore(isCheckingConfig);

  const getStatusColor = (configured: boolean) => {
    if (configured) {
      return 'text-green-500';
    }

    return 'text-red-500';
  };

  const getStatusIcon = (configured: boolean) => {
    if (configured) {
      return 'i-ph:check-circle';
    }

    return 'i-ph:x-circle';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="bg-bolt-elements-background border border-bolt-elements-borderColor rounded-lg p-4"
    >
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium flex items-center gap-2 text-bolt-elements-textPrimary">
          <div className="i-ph:gear w-4 h-4 text-bolt-elements-item-contentAccent" />
          S2S OAuth Configuration
        </h4>
        {checkingConfig && (
          <div className="flex items-center gap-2 text-xs text-bolt-elements-textSecondary">
            <div className="i-ph:spinner-gap w-3 h-3 animate-spin" />
            Checking...
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Client ID Status */}
        <div
          className={classNames(
            'flex items-center gap-3 p-3 rounded-lg',
            'bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor',
          )}
        >
          <div
            className={classNames(
              getStatusIcon(connection.hasClientId),
              'w-5 h-5',
              getStatusColor(connection.hasClientId),
            )}
          />
          <div>
            <div className="text-xs text-bolt-elements-textSecondary">ZOOM_CLIENT_ID</div>
            <div className={classNames('text-sm font-medium', getStatusColor(connection.hasClientId))}>
              {connection.hasClientId ? 'Configured' : 'Missing'}
            </div>
          </div>
        </div>

        {/* Client Secret Status */}
        <div
          className={classNames(
            'flex items-center gap-3 p-3 rounded-lg',
            'bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor',
          )}
        >
          <div
            className={classNames(
              getStatusIcon(connection.hasClientSecret),
              'w-5 h-5',
              getStatusColor(connection.hasClientSecret),
            )}
          />
          <div>
            <div className="text-xs text-bolt-elements-textSecondary">ZOOM_CLIENT_SECRET</div>
            <div className={classNames('text-sm font-medium', getStatusColor(connection.hasClientSecret))}>
              {connection.hasClientSecret ? 'Configured' : 'Missing'}
            </div>
          </div>
        </div>

        {/* Account ID Status */}
        <div
          className={classNames(
            'flex items-center gap-3 p-3 rounded-lg',
            'bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor',
          )}
        >
          <div
            className={classNames(
              getStatusIcon(connection.hasAccountId),
              'w-5 h-5',
              getStatusColor(connection.hasAccountId),
            )}
          />
          <div>
            <div className="text-xs text-bolt-elements-textSecondary">ZOOM_ACCOUNT_ID</div>
            <div className={classNames('text-sm font-medium', getStatusColor(connection.hasAccountId))}>
              {connection.hasAccountId ? 'Configured' : 'Missing'}
            </div>
          </div>
        </div>
      </div>

      {/* Setup Instructions */}
      {!connection.isConfigured && (
        <div className="mt-4 p-3 bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor">
          <div className="flex items-start gap-2">
            <div className="i-ph:info w-4 h-4 text-bolt-elements-item-contentAccent mt-0.5" />
            <div className="text-sm text-bolt-elements-textSecondary">
              <p className="font-medium text-bolt-elements-textPrimary mb-1">Setup Required</p>
              <p className="mb-2">
                To create Zoom Apps programmatically, you need a Server-to-Server OAuth app with Marketplace API access.
              </p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>
                  Go to{' '}
                  <a
                    href="https://marketplace.zoom.us/develop/create"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-bolt-elements-item-contentAccent hover:underline"
                  >
                    Zoom Marketplace Developer Console
                  </a>
                </li>
                <li>Create a "Server-to-Server OAuth" app</li>
                <li>Enable the "Zoom Marketplace API" scope</li>
                <li>
                  Add the credentials to your environment:
                  <ul className="list-disc list-inside ml-4 mt-1 text-bolt-elements-textTertiary">
                    <li>
                      <code className="px-1 bg-bolt-elements-background-depth-2 rounded">ZOOM_CLIENT_ID</code>
                    </li>
                    <li>
                      <code className="px-1 bg-bolt-elements-background-depth-2 rounded">ZOOM_CLIENT_SECRET</code>
                    </li>
                    <li>
                      <code className="px-1 bg-bolt-elements-background-depth-2 rounded">ZOOM_ACCOUNT_ID</code>
                    </li>
                  </ul>
                </li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Connected Status */}
      {connection.isConfigured && (
        <div className="mt-4 flex items-center gap-2 text-sm text-green-600">
          <div className="i-ph:check-circle w-4 h-4" />
          S2S OAuth configured. Ready to create Zoom Apps.
        </div>
      )}
    </motion.div>
  );
}
