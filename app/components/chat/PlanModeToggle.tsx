import { useStore } from '@nanostores/react';
import { motion } from 'framer-motion';
import { planStore, setMode } from '~/lib/stores/plan';
import type { PlanMode } from '~/types/plan';
import { classNames } from '~/utils/classNames';

interface PlanModeToggleProps {
  disabled?: boolean;
  className?: string;
}

export function PlanModeToggle({ disabled = false, className }: PlanModeToggleProps) {
  const { mode, isGeneratingPlan, currentPlan } = useStore(planStore);

  const handleModeChange = (newMode: PlanMode) => {
    if (!disabled && mode !== newMode) {
      setMode(newMode);
    }
  };

  const isPlanMode = mode === 'plan';
  const isActMode = mode === 'act';

  return (
    <div className={classNames('flex items-center gap-2', className)}>
      <div className="relative flex items-center bg-bolt-elements-background-depth-2 rounded-lg p-1 border border-bolt-elements-borderColor">
        {/* Sliding background indicator */}
        <motion.div
          className="absolute top-1 bottom-1 rounded-md bg-bolt-elements-button-primary-background"
          layout
          initial={false}
          animate={{
            left: isPlanMode ? '4px' : '50%',
            right: isActMode ? '4px' : '50%',
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />

        {/* Plan Mode Button */}
        <button
          type="button"
          disabled={disabled || isGeneratingPlan}
          onClick={() => handleModeChange('plan')}
          className={classNames(
            'relative z-10 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
            'flex items-center gap-1.5',
            isPlanMode
              ? 'text-bolt-elements-textPrimary'
              : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
            (disabled || isGeneratingPlan) && 'opacity-50 cursor-not-allowed',
          )}
        >
          <PlanIcon className="w-4 h-4" />
          <span>Plan</span>
        </button>

        {/* Act Mode Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleModeChange('act')}
          className={classNames(
            'relative z-10 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
            'flex items-center gap-1.5',
            isActMode
              ? 'text-bolt-elements-textPrimary'
              : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          <ActIcon className="w-4 h-4" />
          <span>Act</span>
        </button>
      </div>

      {/* Status indicator */}
      {currentPlan && (
        <div className="flex items-center gap-1.5 text-xs">
          <StatusDot status={currentPlan.status} />
          <span className="text-bolt-elements-textSecondary">
            {currentPlan.status === 'draft' && 'Plan ready for review'}
            {currentPlan.status === 'approved' && 'Plan approved'}
            {currentPlan.status === 'executing' && `Executing step ${currentPlan.currentStepIndex + 1}`}
            {currentPlan.status === 'completed' && 'Plan completed'}
            {currentPlan.status === 'failed' && 'Execution failed'}
            {currentPlan.status === 'cancelled' && 'Plan cancelled'}
          </span>
        </div>
      )}

      {isGeneratingPlan && (
        <div className="flex items-center gap-1.5 text-xs text-bolt-elements-textSecondary">
          <LoadingSpinner className="w-3 h-3" />
          <span>Generating plan...</span>
        </div>
      )}
    </div>
  );
}

function PlanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  );
}

function ActIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function StatusDot({ status }: { status: string }) {
  const colorClass =
    {
      draft: 'bg-yellow-500',
      approved: 'bg-blue-500',
      executing: 'bg-blue-500 animate-pulse',
      completed: 'bg-green-500',
      failed: 'bg-red-500',
      cancelled: 'bg-gray-500',
    }[status] || 'bg-gray-500';

  return <span className={classNames('w-2 h-2 rounded-full', colorClass)} />;
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg className={classNames('animate-spin', className)} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export default PlanModeToggle;
