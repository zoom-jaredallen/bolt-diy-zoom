import { useStore } from '@nanostores/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  planStore,
  approvePlan,
  rejectPlan,
  clearPlan,
  skipStep,
  getPlanProgress,
  pauseExecution,
  resumeExecution,
  executionPaused,
} from '~/lib/stores/plan';
import type { PlanStep, PlanStepStatus } from '~/types/plan';
import { classNames } from '~/utils/classNames';

interface PlanStepsProps {
  onExecute?: () => void;
  className?: string;
}

export function PlanSteps({ onExecute, className }: PlanStepsProps) {
  const { currentPlan, mode } = useStore(planStore);
  const isPaused = useStore(executionPaused);

  if (!currentPlan) {
    return null;
  }

  const progress = getPlanProgress();
  const isExecuting = currentPlan.status === 'executing';
  const isCompleted = currentPlan.status === 'completed';
  const isFailed = currentPlan.status === 'failed';
  const isDraft = currentPlan.status === 'draft';

  const handleApprove = () => {
    approvePlan();
    onExecute?.();
  };

  const handleReject = () => {
    rejectPlan();
    clearPlan();
  };

  return (
    <div
      className={classNames(
        'bg-bolt-elements-background-depth-2 rounded-lg border border-bolt-elements-borderColor',
        'overflow-hidden',
        className,
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlanIcon className="w-5 h-5 text-bolt-elements-textSecondary" />
            <h3 className="font-medium text-bolt-elements-textPrimary">{currentPlan.title}</h3>
          </div>
          <div className="flex items-center gap-2">
            {isExecuting && (
              <button
                type="button"
                onClick={isPaused ? resumeExecution : pauseExecution}
                className={classNames(
                  'px-2 py-1 text-xs rounded transition-colors',
                  isPaused
                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30',
                )}
              >
                {isPaused ? 'Resume' : 'Pause'}
              </button>
            )}
            {!isExecuting && !isCompleted && (
              <button
                type="button"
                onClick={clearPlan}
                className="p-1 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
                title="Clear plan"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {currentPlan.summary && <p className="mt-1 text-sm text-bolt-elements-textSecondary">{currentPlan.summary}</p>}

        {/* Progress bar */}
        {(isExecuting || isCompleted) && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-bolt-elements-textSecondary mb-1">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 bg-bolt-elements-background-depth-1 rounded-full overflow-hidden">
              <motion.div
                className={classNames(
                  'h-full rounded-full',
                  isCompleted ? 'bg-green-500' : isFailed ? 'bg-red-500' : 'bg-blue-500',
                )}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Steps list */}
      <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
        <AnimatePresence>
          {currentPlan.steps.map((step, index) => (
            <StepItem
              key={step.id}
              step={step}
              index={index}
              isActive={step.status === 'in-progress'}
              canSkip={isDraft || (isExecuting && step.status === 'pending')}
              onSkip={() => skipStep(index)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Actions */}
      {isDraft && mode === 'plan' && (
        <div className="px-4 py-3 border-t border-bolt-elements-borderColor bg-bolt-elements-background-depth-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-bolt-elements-textSecondary">Review this plan and approve to begin execution</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReject}
                className={classNames(
                  'px-3 py-1.5 text-sm rounded-md transition-colors',
                  'bg-red-500/10 text-red-400 hover:bg-red-500/20',
                )}
              >
                Reject
              </button>
              <button
                type="button"
                onClick={handleApprove}
                className={classNames(
                  'px-3 py-1.5 text-sm rounded-md transition-colors',
                  'bg-green-500/20 text-green-400 hover:bg-green-500/30',
                )}
              >
                Approve & Execute
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completion summary */}
      {isCompleted && (
        <div className="px-4 py-3 border-t border-bolt-elements-borderColor bg-green-500/5">
          <div className="flex items-center gap-2 text-green-400">
            <CheckIcon className="w-5 h-5" />
            <span className="font-medium">Plan completed successfully!</span>
          </div>
          {currentPlan.totalActualTokens && (
            <p className="mt-1 text-sm text-bolt-elements-textSecondary">
              Total tokens used: {currentPlan.totalActualTokens.toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Failed state */}
      {isFailed && (
        <div className="px-4 py-3 border-t border-bolt-elements-borderColor bg-red-500/5">
          <div className="flex items-center gap-2 text-red-400">
            <ErrorIcon className="w-5 h-5" />
            <span className="font-medium">Execution failed</span>
          </div>
          <p className="mt-1 text-sm text-bolt-elements-textSecondary">
            Check the failed step for details. You can retry or skip the failed step.
          </p>
        </div>
      )}
    </div>
  );
}

interface StepItemProps {
  step: PlanStep;
  index: number;
  isActive: boolean;
  canSkip: boolean;
  onSkip: () => void;
}

function StepItem({ step, index, isActive, canSkip, onSkip }: StepItemProps) {
  const [isExpanded, setIsExpanded] = React.useState(isActive);

  React.useEffect(() => {
    if (isActive) {
      setIsExpanded(true);
    }
  }, [isActive]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className={classNames(
        'rounded-lg border transition-colors',
        isActive
          ? 'border-blue-500/50 bg-blue-500/5'
          : step.status === 'complete'
            ? 'border-green-500/30 bg-green-500/5'
            : step.status === 'failed'
              ? 'border-red-500/30 bg-red-500/5'
              : step.status === 'skipped'
                ? 'border-gray-500/30 bg-gray-500/5'
                : 'border-bolt-elements-borderColor',
      )}
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center gap-3 text-left"
      >
        <StepStatusIcon status={step.status} isActive={isActive} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-bolt-elements-textSecondary">Step {index + 1}</span>
            <span className="font-medium text-bolt-elements-textPrimary truncate">{step.title}</span>
          </div>
        </div>
        <ChevronIcon className={classNames('w-4 h-4 transition-transform', isExpanded && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pl-10">
              <p className="text-sm text-bolt-elements-textSecondary">{step.description}</p>

              {step.substeps && step.substeps.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {step.substeps.map((substep) => (
                    <li key={substep.id} className="flex items-center gap-2 text-sm">
                      <SubstepStatusIcon status={substep.status} />
                      <span className="text-bolt-elements-textSecondary">{substep.title}</span>
                    </li>
                  ))}
                </ul>
              )}

              {step.error && <div className="mt-2 p-2 bg-red-500/10 rounded text-sm text-red-400">{step.error}</div>}

              {step.actualTokens && (
                <p className="mt-2 text-xs text-bolt-elements-textSecondary">
                  Tokens used: {step.actualTokens.toLocaleString()}
                </p>
              )}

              {canSkip && step.status === 'pending' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSkip();
                  }}
                  className="mt-2 text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
                >
                  Skip this step
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

import React from 'react';

function StepStatusIcon({ status, isActive }: { status: PlanStepStatus; isActive: boolean }) {
  if (isActive) {
    return (
      <div className="w-5 h-5 rounded-full border-2 border-blue-500 flex items-center justify-center">
        <motion.div
          className="w-2 h-2 bg-blue-500 rounded-full"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      </div>
    );
  }

  switch (status) {
    case 'complete':
      return (
        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
          <CheckIcon className="w-3 h-3 text-white" />
        </div>
      );
    case 'failed':
      return (
        <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
          <CloseIcon className="w-3 h-3 text-white" />
        </div>
      );
    case 'skipped':
      return (
        <div className="w-5 h-5 rounded-full bg-gray-500 flex items-center justify-center">
          <SkipIcon className="w-3 h-3 text-white" />
        </div>
      );
    default:
      return <div className="w-5 h-5 rounded-full border-2 border-bolt-elements-borderColor" />;
  }
}

function SubstepStatusIcon({ status }: { status: PlanStepStatus }) {
  switch (status) {
    case 'complete':
      return <CheckIcon className="w-3 h-3 text-green-500" />;
    case 'failed':
      return <CloseIcon className="w-3 h-3 text-red-500" />;
    case 'in-progress':
      return (
        <motion.div
          className="w-3 h-3 rounded-full bg-blue-500"
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      );
    default:
      return <div className="w-3 h-3 rounded-full border border-bolt-elements-borderColor" />;
  }
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M20 6L9 17l-5-5" />
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

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

function SkipIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 4l10 8-10 8V4zM19 5v14" />
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

export default PlanSteps;
