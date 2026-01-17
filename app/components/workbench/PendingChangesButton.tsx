import { memo } from 'react';
import { useStore } from '@nanostores/react';
import { motion, AnimatePresence } from 'framer-motion';
import { pendingChangesCount, hasPendingChanges, openReviewModal } from '~/lib/stores/pendingChanges';
import { classNames } from '~/utils/classNames';

/**
 * PendingChangesButton
 *
 * Button that appears when there are pending file changes to review.
 * Shows a badge with the count of pending changes.
 */

interface PendingChangesButtonProps {
  className?: string;
}

export const PendingChangesButton = memo(({ className }: PendingChangesButtonProps) => {
  const count = useStore(pendingChangesCount);
  const hasChanges = useStore(hasPendingChanges);

  return (
    <AnimatePresence>
      {hasChanges && (
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          type="button"
          onClick={openReviewModal}
          className={classNames(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg',
            'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30',
            'border border-yellow-500/30',
            'transition-colors duration-200',
            className,
          )}
          title="Review pending changes"
        >
          <div className="i-ph:git-diff text-lg" />
          <span className="text-sm font-medium">Review Changes</span>
          <span className="flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-bold rounded-full bg-yellow-500 text-yellow-900">
            {count}
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
});

export default PendingChangesButton;
