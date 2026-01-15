import React, { useState } from 'react';
import { useStore } from '@nanostores/react';
import { classNames } from '~/utils/classNames';
import { Button } from '~/components/ui/Button';
import { Badge } from '~/components/ui/Badge';
import { formatDistanceToNow } from 'date-fns';
import { zoomConnection, clearWebhookEvents, type ZoomWebhookEvent } from '~/lib/stores/zoom';

const getEventTypeConfig = (eventType: string) => {
  if (eventType.includes('started')) {
    return { icon: 'i-ph:play-circle', color: 'text-green-500' };
  }

  if (eventType.includes('ended')) {
    return { icon: 'i-ph:stop-circle', color: 'text-red-500' };
  }

  if (eventType.includes('joined') || eventType.includes('participant')) {
    return { icon: 'i-ph:user-plus', color: 'text-blue-500' };
  }

  if (eventType.includes('left')) {
    return { icon: 'i-ph:user-minus', color: 'text-orange-500' };
  }

  if (eventType.includes('recording')) {
    return { icon: 'i-ph:record', color: 'text-purple-500' };
  }

  return { icon: 'i-ph:bell', color: 'text-bolt-elements-textSecondary' };
};

interface EventItemProps {
  event: ZoomWebhookEvent;
  onExpand: () => void;
  isExpanded: boolean;
}

function EventItem({ event, onExpand, isExpanded }: EventItemProps) {
  const config = getEventTypeConfig(event.eventType);

  return (
    <div
      className={classNames(
        'p-3 rounded-lg border transition-all cursor-pointer',
        'bg-bolt-elements-background-depth-1',
        isExpanded
          ? 'border-bolt-elements-item-contentAccent'
          : 'border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive/70',
      )}
      onClick={onExpand}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={classNames(config.icon, 'w-4 h-4', config.color)} />
          <div>
            <span className="text-sm font-medium text-bolt-elements-textPrimary">{event.eventType}</span>
            <div className="text-xs text-bolt-elements-textSecondary">
              {formatDistanceToNow(new Date(event.timestamp))} ago
            </div>
          </div>
        </div>
        <Badge variant="outline" className="text-xs">
          {event.id.slice(0, 8)}...
        </Badge>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-bolt-elements-borderColor">
          <div className="text-xs font-medium text-bolt-elements-textSecondary mb-2">Payload</div>
          <pre
            className={classNames(
              'text-xs p-2 rounded overflow-auto max-h-48',
              'bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor',
              'text-bolt-elements-textPrimary',
            )}
          >
            {JSON.stringify(event.payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export function WebhookEventLog() {
  const connection = useStore(zoomConnection);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('');

  const filteredEvents = connection.recentEvents.filter((event) =>
    filter ? event.eventType.toLowerCase().includes(filter.toLowerCase()) : true,
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter events..."
            className={classNames(
              'px-3 py-1.5 rounded-lg text-sm w-48',
              'bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor',
              'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
              'focus:outline-none focus:ring-1 focus:ring-bolt-elements-borderColorActive',
            )}
          />
          <span className="text-xs text-bolt-elements-textSecondary">{filteredEvents.length} events</span>
        </div>
        {connection.recentEvents.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => clearWebhookEvents()}
            className="flex items-center gap-1"
          >
            <div className="i-ph:trash w-4 h-4" />
            Clear
          </Button>
        )}
      </div>

      {/* Events List */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-8 text-bolt-elements-textSecondary">
          <div className="i-ph:webhook w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No webhook events received yet</p>
          <p className="text-xs mt-1">Events will appear here when your Zoom Apps send webhooks</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredEvents.map((event) => (
            <EventItem
              key={event.id}
              event={event}
              isExpanded={expandedEventId === event.id}
              onExpand={() => setExpandedEventId(expandedEventId === event.id ? null : event.id)}
            />
          ))}
        </div>
      )}

      {/* Webhook URL Info */}
      <div className="p-3 bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor">
        <div className="flex items-start gap-2">
          <div className="i-ph:info w-4 h-4 text-bolt-elements-item-contentAccent mt-0.5" />
          <div className="text-xs text-bolt-elements-textSecondary">
            <p className="font-medium text-bolt-elements-textPrimary">Webhook Proxy</p>
            <p className="mt-1">
              Use the bolt.diy webhook proxy URL in your Zoom App settings to receive events during development:
            </p>
            <code className="block mt-2 px-2 py-1 bg-bolt-elements-background-depth-2 rounded text-bolt-elements-textPrimary break-all">
              https://zoomvibes.j4red4llen.com/api/webhook/proxy/{'<session-id>'}
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
