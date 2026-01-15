import React from 'react';
import { useStore } from '@nanostores/react';
import { zoomConnection } from '~/lib/stores/zoom';

export function ZoomStats() {
  const connection = useStore(zoomConnection);
  const { stats } = connection;

  const statItems = [
    {
      label: 'Total Apps',
      value: stats.totalApps,
      icon: 'i-ph:app-window',
      color: 'text-blue-500',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
    },
    {
      label: 'Published',
      value: stats.publishedApps,
      icon: 'i-ph:rocket-launch',
      color: 'text-green-500',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
    },
    {
      label: 'Drafts',
      value: stats.draftApps,
      icon: 'i-ph:pencil-simple',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
    },
    {
      label: 'Webhook Events',
      value: stats.totalWebhookEvents,
      icon: 'i-ph:webhook',
      color: 'text-purple-500',
      bgColor: 'bg-purple-100 dark:bg-purple-900/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statItems.map((item, index) => (
        <div
          key={index}
          className={`flex flex-col p-4 rounded-lg border border-bolt-elements-borderColor ${item.bgColor}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`${item.icon} w-5 h-5 ${item.color}`} />
            <span className="text-xs text-bolt-elements-textSecondary">{item.label}</span>
          </div>
          <span className="text-2xl font-bold text-bolt-elements-textPrimary">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
