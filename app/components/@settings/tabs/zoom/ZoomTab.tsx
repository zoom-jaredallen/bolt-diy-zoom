import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '@nanostores/react';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import { Button } from '~/components/ui/Button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '~/components/ui/Collapsible';
import { Badge } from '~/components/ui/Badge';
import { formatDistanceToNow } from 'date-fns';
import {
  zoomConnection,
  initializeZoomConnection,
  refreshZoomData,
  isFetchingStats,
  isCheckingConfig,
  addZoomApp,
  removeZoomApp,
  type ZoomApp,
} from '~/lib/stores/zoom';
import { ZoomConnection } from './components/ZoomConnection';
import { ZoomAppCard } from './components/ZoomAppCard';
import { ZoomStats } from './components/ZoomStats';
import { ZoomCredentialsModal } from './components/ZoomCredentialsModal';
import { WebhookEventLog } from './components/WebhookEventLog';
import type { ZoomAppCredentials } from '~/types/zoom';

// API response type
interface ZoomAppCreateResponse {
  success: boolean;
  appId?: string;
  appName?: string;
  appType?: string;
  createdAt?: string;
  scopes?: string[];
  credentials?: {
    development: ZoomAppCredentials;
    production: ZoomAppCredentials;
  };
  error?: string;
}

// Zoom logo SVG component
const ZoomLogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path
      fill="currentColor"
      d="M4.585 11.416a2.49 2.49 0 0 1 2.49-2.49h5.032c1.375 0 2.49 1.115 2.49 2.49v5.033a2.49 2.49 0 0 1-2.49 2.49H7.075a2.49 2.49 0 0 1-2.49-2.49v-5.033Zm11.622 2.19 3.503-2.626a.933.933 0 0 1 1.466.767v4.503a.933.933 0 0 1-1.466.767l-3.503-2.626v-.785Z"
    />
  </svg>
);

export default function ZoomTab() {
  const connection = useStore(zoomConnection);
  const fetchingStats = useStore(isFetchingStats);
  const checkingConfig = useStore(isCheckingConfig);
  const [isStatsOpen, setIsStatsOpen] = useState(true);
  const [isAppsExpanded, setIsAppsExpanded] = useState(true);
  const [isWebhooksExpanded, setIsWebhooksExpanded] = useState(false);
  const [selectedApp, setSelectedApp] = useState<ZoomApp | null>(null);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newAppName, setNewAppName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    initializeZoomConnection();
  }, []);

  const handleCreateApp = async () => {
    if (!newAppName.trim()) {
      toast.error('Please enter an app name');
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch('/api/zoom-app-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appName: newAppName.trim(),
        }),
      });

      const result = (await response.json()) as ZoomAppCreateResponse;

      if (result.success && result.appId && result.credentials) {
        // Add the app to the store
        const newApp: ZoomApp = {
          appId: result.appId,
          appName: result.appName || newAppName.trim(),
          appType: result.appType || 'general',
          status: 'draft',
          createdAt: result.createdAt || new Date().toISOString(),
          scopes: result.scopes || [],
          credentials: result.credentials,
        };

        addZoomApp(newApp);
        toast.success(`Zoom App "${result.appName || newAppName}" created successfully!`);
        setNewAppName('');
        setShowCreateForm(false);

        // Show credentials modal
        setSelectedApp(newApp);
        setShowCredentialsModal(true);
      } else {
        toast.error(result.error || 'Failed to create Zoom App');
      }
    } catch (error) {
      console.error('Error creating Zoom App:', error);
      toast.error('Failed to create Zoom App');
    } finally {
      setIsCreating(false);
    }
  };

  const handleViewCredentials = (app: ZoomApp) => {
    setSelectedApp(app);
    setShowCredentialsModal(true);
  };

  const handleDeleteApp = (appId: string) => {
    if (
      confirm('Are you sure you want to remove this app from your list? This does not delete it from Zoom Marketplace.')
    ) {
      removeZoomApp(appId);
    }
  };

  const handleOpenMarketplace = (app: ZoomApp) => {
    window.open(`https://marketplace.zoom.us/develop/apps/${app.appId}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between gap-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-2">
          <div className="text-[#2D8CFF]">
            <ZoomLogo />
          </div>
          <h2 className="text-lg font-medium text-bolt-elements-textPrimary">Zoom Marketplace Integration</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => refreshZoomData()}
            disabled={fetchingStats || checkingConfig}
            variant="outline"
            className="flex items-center gap-2 hover:bg-bolt-elements-item-backgroundActive/10"
          >
            {fetchingStats || checkingConfig ? (
              <>
                <div className="i-ph:spinner-gap w-4 h-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <div className="i-ph:arrows-clockwise w-4 h-4" />
                Refresh
              </>
            )}
          </Button>
        </div>
      </motion.div>

      <p className="text-sm text-bolt-elements-textSecondary">
        Create and manage Zoom Apps directly from bolt.diy. Monitor webhook events and access credentials.
      </p>

      {/* Configuration Status */}
      <ZoomConnection />

      {/* Stats Overview */}
      {connection.isConfigured && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Collapsible open={isStatsOpen} onOpenChange={setIsStatsOpen}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-4 rounded-lg bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive/70 transition-all duration-200 cursor-pointer">
                <div className="flex items-center gap-2">
                  <div className="i-ph:chart-bar w-4 h-4 text-bolt-elements-item-contentAccent" />
                  <span className="text-sm font-medium text-bolt-elements-textPrimary">Dashboard Overview</span>
                </div>
                <div
                  className={classNames(
                    'i-ph:caret-down w-4 h-4 transform transition-transform duration-200 text-bolt-elements-textSecondary',
                    isStatsOpen ? 'rotate-180' : '',
                  )}
                />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden">
              <div className="mt-4">
                <ZoomStats />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </motion.div>
      )}

      {/* Apps List */}
      {connection.isConfigured && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="bg-bolt-elements-background border border-bolt-elements-borderColor rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <h4 className="text-sm font-medium flex items-center gap-2 text-bolt-elements-textPrimary">
                  <div className="i-ph:app-window w-4 h-4 text-bolt-elements-item-contentAccent" />
                  Your Zoom Apps ({connection.apps.length})
                </h4>
                {connection.apps.length > 5 && (
                  <button
                    onClick={() => setIsAppsExpanded(!isAppsExpanded)}
                    className="text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
                  >
                    {isAppsExpanded ? 'Show Less' : `Show All ${connection.apps.length}`}
                  </button>
                )}
              </div>
              <Button
                onClick={() => setShowCreateForm(!showCreateForm)}
                variant="default"
                className="flex items-center gap-2"
              >
                <div className="i-ph:plus w-4 h-4" />
                Create App
              </Button>
            </div>

            {/* Create App Form */}
            {showCreateForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 p-4 bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor"
              >
                <h5 className="text-sm font-medium text-bolt-elements-textPrimary mb-3">Create New Zoom App</h5>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newAppName}
                    onChange={(e) => setNewAppName(e.target.value)}
                    placeholder="Enter app name"
                    className={classNames(
                      'flex-1 px-3 py-2 rounded-lg text-sm',
                      'bg-bolt-elements-background-depth-2',
                      'border border-bolt-elements-borderColor',
                      'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                      'focus:outline-none focus:ring-1 focus:ring-bolt-elements-borderColorActive',
                    )}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateApp();
                      }
                    }}
                  />
                  <Button onClick={handleCreateApp} disabled={isCreating || !newAppName.trim()} variant="default">
                    {isCreating ? (
                      <>
                        <div className="i-ph:spinner-gap w-4 h-4 animate-spin mr-2" />
                        Creating...
                      </>
                    ) : (
                      'Create'
                    )}
                  </Button>
                  <Button onClick={() => setShowCreateForm(false)} variant="outline">
                    Cancel
                  </Button>
                </div>
                <p className="mt-2 text-xs text-bolt-elements-textSecondary">
                  This will create a new Zoom App via the Marketplace API using your configured S2S OAuth credentials.
                </p>
              </motion.div>
            )}

            {/* Apps List */}
            {connection.apps.length === 0 ? (
              <div className="text-center py-8 text-bolt-elements-textSecondary">
                <div className="i-ph:app-window w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No Zoom Apps created yet</p>
                <p className="text-xs mt-1">Click "Create App" to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(isAppsExpanded ? connection.apps : connection.apps.slice(0, 5)).map((app) => (
                  <ZoomAppCard
                    key={app.appId}
                    app={app}
                    onViewCredentials={() => handleViewCredentials(app)}
                    onDelete={() => handleDeleteApp(app.appId)}
                    onOpenMarketplace={() => handleOpenMarketplace(app)}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Webhook Events */}
      {connection.isConfigured && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Collapsible open={isWebhooksExpanded} onOpenChange={setIsWebhooksExpanded}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-4 rounded-lg bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive/70 transition-all duration-200 cursor-pointer">
                <div className="flex items-center gap-2">
                  <div className="i-ph:webhook w-4 h-4 text-bolt-elements-item-contentAccent" />
                  <span className="text-sm font-medium text-bolt-elements-textPrimary">Webhook Events</span>
                  {connection.recentEvents.length > 0 && (
                    <Badge variant="outline" className="ml-2">
                      {connection.recentEvents.length}
                    </Badge>
                  )}
                </div>
                <div
                  className={classNames(
                    'i-ph:caret-down w-4 h-4 transform transition-transform duration-200 text-bolt-elements-textSecondary',
                    isWebhooksExpanded ? 'rotate-180' : '',
                  )}
                />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden">
              <div className="mt-4">
                <WebhookEventLog />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </motion.div>
      )}

      {/* Last Updated */}
      {connection.lastRefreshed && (
        <div className="text-xs text-bolt-elements-textSecondary text-center">
          Last updated {formatDistanceToNow(new Date(connection.lastRefreshed))} ago
        </div>
      )}

      {/* Credentials Modal */}
      {showCredentialsModal && selectedApp && (
        <ZoomCredentialsModal app={selectedApp} onClose={() => setShowCredentialsModal(false)} />
      )}
    </div>
  );
}
