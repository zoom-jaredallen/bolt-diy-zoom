import React, { useState } from 'react';
import { classNames } from '~/utils/classNames';
import { Badge } from '~/components/ui/Badge';
import { Button } from '~/components/ui/Button';
import { formatDistanceToNow } from 'date-fns';
import type { ZoomApp, ZoomAppStatus } from '~/lib/stores/zoom';

interface ZoomAppCardProps {
  app: ZoomApp;
  onViewCredentials: () => void;
  onDelete: () => void;
  onOpenMarketplace: () => void;
}

const getStatusConfig = (status: ZoomAppStatus) => {
  switch (status) {
    case 'published':
      return {
        label: 'Published',
        variant: 'default' as const,
        icon: 'i-ph:rocket-launch',
        color: 'text-green-500',
      };
    case 'approved':
      return {
        label: 'Approved',
        variant: 'default' as const,
        icon: 'i-ph:check-circle',
        color: 'text-blue-500',
      };
    case 'submitted':
      return {
        label: 'Submitted',
        variant: 'outline' as const,
        icon: 'i-ph:clock',
        color: 'text-yellow-500',
      };
    case 'rejected':
      return {
        label: 'Rejected',
        variant: 'destructive' as const,
        icon: 'i-ph:x-circle',
        color: 'text-red-500',
      };
    case 'draft':
    default:
      return {
        label: 'Draft',
        variant: 'outline' as const,
        icon: 'i-ph:pencil-simple',
        color: 'text-bolt-elements-textSecondary',
      };
  }
};

export function ZoomAppCard({ app, onViewCredentials, onDelete, onOpenMarketplace }: ZoomAppCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const statusConfig = getStatusConfig(app.status);

  return (
    <div
      className={classNames(
        'bg-bolt-elements-background-depth-1 border rounded-lg p-4 transition-all cursor-pointer',
        isExpanded
          ? 'border-bolt-elements-item-contentAccent bg-bolt-elements-item-backgroundActive/5'
          : 'border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive/70',
      )}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="i-ph:app-window w-5 h-5 text-bolt-elements-item-contentAccent" />
          <div>
            <span className="font-medium text-bolt-elements-textPrimary">{app.appName}</span>
            <div className="text-xs text-bolt-elements-textSecondary">ID: {app.appId}</div>
          </div>
        </div>
        <Badge variant={statusConfig.variant} className="flex items-center gap-1">
          <div className={classNames(statusConfig.icon, 'w-3 h-3', statusConfig.color)} />
          {statusConfig.label}
        </Badge>
      </div>

      {/* Meta info */}
      <div className="mt-3 flex items-center gap-4 text-xs text-bolt-elements-textSecondary">
        <div className="flex items-center gap-1">
          <div className="i-ph:cube w-3 h-3" />
          <span>{app.appType || 'General'}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="i-ph:clock w-3 h-3" />
          <span>Created {formatDistanceToNow(new Date(app.createdAt))} ago</span>
        </div>
        {app.scopes && app.scopes.length > 0 && (
          <div className="flex items-center gap-1">
            <div className="i-ph:key w-3 h-3" />
            <span>{app.scopes.length} scopes</span>
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-bolt-elements-borderColor">
          {/* Scopes */}
          {app.scopes && app.scopes.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-medium text-bolt-elements-textPrimary mb-2">OAuth Scopes</div>
              <div className="flex flex-wrap gap-2">
                {app.scopes.map((scope, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 text-xs bg-bolt-elements-background-depth-2 rounded border border-bolt-elements-borderColor text-bolt-elements-textSecondary"
                  >
                    {scope}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Button variant="outline" size="sm" onClick={onViewCredentials} className="flex items-center gap-1">
              <div className="i-ph:key w-4 h-4" />
              View Credentials
            </Button>
            <Button variant="outline" size="sm" onClick={onOpenMarketplace} className="flex items-center gap-1">
              <div className="i-ph:arrow-square-out w-4 h-4" />
              Marketplace
            </Button>
            <Button variant="destructive" size="sm" onClick={onDelete} className="flex items-center gap-1 ml-auto">
              <div className="i-ph:trash w-4 h-4" />
              Remove
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
