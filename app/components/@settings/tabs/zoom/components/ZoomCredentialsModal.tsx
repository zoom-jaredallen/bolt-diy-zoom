import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import { Button } from '~/components/ui/Button';
import type { ZoomApp } from '~/lib/stores/zoom';

interface ZoomCredentialsModalProps {
  app: ZoomApp;
  onClose: () => void;
}

export function ZoomCredentialsModal({ app, onClose }: ZoomCredentialsModalProps) {
  const [showSecrets, setShowSecrets] = useState(false);
  const [activeEnv, setActiveEnv] = useState<'development' | 'production'>('development');

  const credentials = app.credentials[activeEnv];

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const handleCopyEnvFile = () => {
    const envContent = `# Zoom App: ${app.appName}
# Environment: ${activeEnv}
# Created: ${new Date(app.createdAt).toISOString()}

ZOOM_CLIENT_ID=${credentials.clientId}
ZOOM_CLIENT_SECRET=${credentials.clientSecret}

# Scopes: ${app.scopes?.join(', ') || 'None'}
`;
    navigator.clipboard.writeText(envContent);
    toast.success('.env content copied to clipboard');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className={classNames(
            'relative z-10 w-full max-w-lg mx-4',
            'bg-bolt-elements-background border border-bolt-elements-borderColor rounded-lg shadow-xl',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-bolt-elements-borderColor">
            <div>
              <h3 className="text-lg font-medium text-bolt-elements-textPrimary">{app.appName}</h3>
              <p className="text-xs text-bolt-elements-textSecondary">App ID: {app.appId}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-bolt-elements-background-depth-2 rounded transition-colors"
            >
              <div className="i-ph:x w-5 h-5 text-bolt-elements-textSecondary" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {/* Environment Tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveEnv('development')}
                className={classNames(
                  'px-3 py-1.5 text-sm rounded-lg transition-colors',
                  activeEnv === 'development'
                    ? 'bg-bolt-elements-item-contentAccent text-white'
                    : 'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
                )}
              >
                Development
              </button>
              <button
                onClick={() => setActiveEnv('production')}
                className={classNames(
                  'px-3 py-1.5 text-sm rounded-lg transition-colors',
                  activeEnv === 'production'
                    ? 'bg-bolt-elements-item-contentAccent text-white'
                    : 'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
                )}
              >
                Production
              </button>
            </div>

            {/* Credentials */}
            <div className="space-y-4">
              {/* Client ID */}
              <div>
                <label className="block text-xs text-bolt-elements-textSecondary mb-1">Client ID</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={credentials.clientId}
                    readOnly
                    className={classNames(
                      'flex-1 px-3 py-2 rounded-lg text-sm font-mono',
                      'bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor',
                      'text-bolt-elements-textPrimary',
                    )}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(credentials.clientId, 'Client ID')}
                    className="flex items-center gap-1"
                  >
                    <div className="i-ph:copy w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Client Secret */}
              <div>
                <label className="block text-xs text-bolt-elements-textSecondary mb-1">Client Secret</label>
                <div className="flex items-center gap-2">
                  <input
                    type={showSecrets ? 'text' : 'password'}
                    value={credentials.clientSecret}
                    readOnly
                    className={classNames(
                      'flex-1 px-3 py-2 rounded-lg text-sm font-mono',
                      'bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor',
                      'text-bolt-elements-textPrimary',
                    )}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSecrets(!showSecrets)}
                    className="flex items-center gap-1"
                  >
                    <div className={showSecrets ? 'i-ph:eye-slash w-4 h-4' : 'i-ph:eye w-4 h-4'} />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(credentials.clientSecret, 'Client Secret')}
                    className="flex items-center gap-1"
                  >
                    <div className="i-ph:copy w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Warning */}
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-start gap-2">
                <div className="i-ph:warning w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div className="text-xs text-yellow-800 dark:text-yellow-200">
                  <p className="font-medium">Keep your credentials secure!</p>
                  <p className="mt-1">
                    Never expose these credentials in client-side code or public repositories. Use environment
                    variables.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-bolt-elements-borderColor">
            <Button variant="outline" onClick={handleCopyEnvFile} className="flex items-center gap-2">
              <div className="i-ph:file-text w-4 h-4" />
              Copy as .env
            </Button>
            <Button variant="default" onClick={onClose}>
              Done
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
