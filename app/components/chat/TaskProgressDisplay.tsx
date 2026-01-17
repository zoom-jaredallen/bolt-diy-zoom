import { useStore } from '@nanostores/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  taskProgressStore,
  hasTaskProgress,
  progressPercentage,
  completedItemsCount,
  totalItemsCount,
  clearTaskProgress,
} from '~/lib/stores/taskProgress';
import { classNames } from '~/utils/classNames';

interface TaskProgressDisplayProps {
  className?: string;
  showHeader?: boolean;
  collapsible?: boolean;
}

export function TaskProgressDisplay({ className, showHeader = true, collapsible = true }: TaskProgressDisplayProps) {
  const taskProgress = useStore(taskProgressStore);
  const hasProgress = useStore(hasTaskProgress);
  const percentage = useStore(progressPercentage);
  const completed = useStore(completedItemsCount);
  const total = useStore(totalItemsCount);

  const [isCollapsed, setIsCollapsed] = React.useState(false);

  if (!hasProgress) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={classNames(
        'bg-bolt-elements-background-depth-2 rounded-lg border border-bolt-elements-borderColor',
        'overflow-hidden shadow-sm',
        className,
      )}
    >
      {/* Header */}
      {showHeader && (
        <div className="px-3 py-2 border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {collapsible && (
              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-0.5 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
              >
                <ChevronIcon className={classNames('w-4 h-4 transition-transform', isCollapsed && '-rotate-90')} />
              </button>
            )}
            <TaskIcon className="w-4 h-4 text-bolt-elements-textSecondary" />
            <span className="text-sm font-medium text-bolt-elements-textPrimary">Task Progress</span>
            <span className="text-xs text-bolt-elements-textSecondary">
              ({completed}/{total})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-bolt-elements-textSecondary">{percentage}%</span>
            <button
              type="button"
              onClick={clearTaskProgress}
              className="p-1 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
              title="Clear progress"
            >
              <CloseIcon className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="h-1 bg-bolt-elements-background-depth-1">
        <motion.div
          className={classNames('h-full', percentage === 100 ? 'bg-green-500' : 'bg-blue-500')}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {/* Items list */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <ul className="p-2 space-y-1 max-h-48 overflow-y-auto">
              {taskProgress.items
                .sort((a, b) => a.order - b.order)
                .map((item) => (
                  <TaskProgressItem key={item.id} item={item} />
                ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface TaskProgressItemProps {
  item: { id: string; title: string; completed: boolean };
}

function TaskProgressItem({ item }: TaskProgressItemProps) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-2 text-sm"
    >
      <span className="flex-shrink-0 mt-0.5">
        {item.completed ? (
          <CheckCircleIcon className="w-4 h-4 text-green-500" />
        ) : (
          <CircleIcon className="w-4 h-4 text-bolt-elements-textSecondary" />
        )}
      </span>
      <span
        className={classNames(
          'break-words',
          item.completed ? 'text-bolt-elements-textSecondary line-through' : 'text-bolt-elements-textPrimary',
        )}
      >
        {item.title}
      </span>
    </motion.li>
  );
}

import React from 'react';

function TaskIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  );
}

function CircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export default TaskProgressDisplay;
