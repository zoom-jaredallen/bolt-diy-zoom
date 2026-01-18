import { useStore } from '@nanostores/react';
import { motion, AnimatePresence } from 'framer-motion';
import React from 'react';
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
import { sanitizePlanSummary, stripBoltTags } from '~/utils/planSanitization';

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
        'bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor',
        'overflow-hidden shadow-lg',
        className,
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <PlanIcon className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-lg">{stripBoltTags(currentPlan.title)}</h3>
              <p className="text-xs text-gray-400">{currentPlan.steps.length} steps to complete</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isExecuting && (
              <button
                type="button"
                onClick={isPaused ? resumeExecution : pauseExecution}
                className={classNames(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  isPaused
                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30',
                )}
              >
                {isPaused ? '▶ Resume' : '⏸ Pause'}
              </button>
            )}
            {!isExecuting && !isCompleted && (
              <button
                type="button"
                onClick={clearPlan}
                className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
                title="Clear plan"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {currentPlan.summary && (
          <p className="mt-3 text-sm text-gray-300 leading-relaxed">{sanitizePlanSummary(currentPlan.summary)}</p>
        )}

        {/* Progress bar */}
        {(isExecuting || isCompleted) && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-gray-400 font-medium">Progress</span>
              <span className="text-white font-semibold">{progress}%</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className={classNames(
                  'h-full rounded-full',
                  isCompleted ? 'bg-green-500' : isFailed ? 'bg-red-500' : 'bg-purple-500',
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
      <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
        <AnimatePresence>
          {currentPlan.steps.map((step, index) => (
            <StepItem
              key={step.id}
              step={step}
              index={index}
              totalSteps={currentPlan.steps.length}
              isActive={step.status === 'in-progress'}
              canSkip={isDraft || (isExecuting && step.status === 'pending')}
              onSkip={() => skipStep(index)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Actions */}
      {isDraft && mode === 'plan' && (
        <div className="px-4 py-4 border-t border-bolt-elements-borderColor bg-bolt-elements-background-depth-2">
          <p className="text-sm text-gray-400 mb-3">Review this plan and approve to begin execution</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleReject}
              className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >
              ✕ Reject
            </button>
            <button
              type="button"
              onClick={handleApprove}
              className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-500 transition-colors"
            >
              ✓ Approve & Execute
            </button>
          </div>
        </div>
      )}

      {/* Completion summary */}
      {isCompleted && (
        <div className="px-4 py-4 border-t border-green-500/30 bg-green-500/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-green-500/20">
              <CheckIcon className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="font-semibold text-green-400">Plan completed successfully!</p>
              {currentPlan.totalActualTokens && (
                <p className="text-sm text-gray-400">
                  Total tokens used: {currentPlan.totalActualTokens.toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Failed state */}
      {isFailed && (
        <div className="px-4 py-4 border-t border-red-500/30 bg-red-500/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-red-500/20">
              <ErrorIcon className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="font-semibold text-red-400">Execution failed</p>
              <p className="text-sm text-gray-400">Check the failed step for details. You can retry or skip it.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface StepItemProps {
  step: PlanStep;
  index: number;
  totalSteps: number;
  isActive: boolean;
  canSkip: boolean;
  onSkip: () => void;
}

function StepItem({ step, index, totalSteps, isActive, canSkip, onSkip }: StepItemProps) {
  const [isExpanded, setIsExpanded] = React.useState(isActive);

  React.useEffect(() => {
    if (isActive) {
      setIsExpanded(true);
    }
  }, [isActive]);

  const cleanTitle = stripBoltTags(step.title);
  const cleanDescription = sanitizePlanSummary(step.description);

  // Generate helpful description if none provided
  const getStepDetails = () => {
    if (cleanDescription && cleanDescription.length > 10) {
      return cleanDescription;
    }

    // Generate context based on common step patterns
    if (cleanTitle.toLowerCase().includes('setup') || cleanTitle.toLowerCase().includes('install')) {
      return 'This step will set up the project dependencies and configuration files needed for the application.';
    }

    if (cleanTitle.toLowerCase().includes('create') || cleanTitle.toLowerCase().includes('build')) {
      return 'This step will create the necessary components, files, or structures for the feature.';
    }

    if (cleanTitle.toLowerCase().includes('style') || cleanTitle.toLowerCase().includes('design')) {
      return 'This step will add styling and visual design elements to enhance the user interface.';
    }

    if (cleanTitle.toLowerCase().includes('test') || cleanTitle.toLowerCase().includes('verify')) {
      return 'This step will verify that everything is working correctly and fix any issues found.';
    }

    return 'This step will implement the required functionality as described in the plan.';
  };

  const getStatusColor = () => {
    if (isActive) {
      return 'border-purple-500/50 bg-purple-500/10';
    }

    switch (step.status) {
      case 'complete':
        return 'border-green-500/30 bg-green-500/5';
      case 'failed':
        return 'border-red-500/30 bg-red-500/5';
      case 'skipped':
        return 'border-gray-600/30 bg-gray-600/5';
      default:
        return 'border-gray-700 bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className={classNames('rounded-lg border transition-all duration-200', getStatusColor())}
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center gap-4 text-left"
      >
        {/* Step number badge */}
        <div
          className={classNames(
            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
            isActive
              ? 'bg-purple-500 text-white'
              : step.status === 'complete'
                ? 'bg-green-500 text-white'
                : step.status === 'failed'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-700 text-gray-300',
          )}
        >
          {step.status === 'complete' ? (
            <CheckIcon className="w-4 h-4" />
          ) : step.status === 'failed' ? (
            <CloseIcon className="w-4 h-4" />
          ) : (
            index + 1
          )}
        </div>

        {/* Step title */}
        <div className="flex-1 min-w-0">
          <p
            className={classNames(
              'font-medium text-sm leading-tight',
              isActive || step.status === 'pending' ? 'text-white' : 'text-gray-300',
            )}
          >
            {cleanTitle}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Step {index + 1} of {totalSteps}
            {step.estimatedTokens && ` • ~${step.estimatedTokens.toLocaleString()} tokens`}
          </p>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          {isActive && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-500/20 text-purple-400">
              In Progress
            </span>
          )}
          <ChevronIcon
            className={classNames(
              'w-5 h-5 text-gray-500 transition-transform duration-200',
              isExpanded && 'rotate-180',
            )}
          />
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 ml-12 border-t border-gray-700/50">
              {/* Description */}
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">What this step does</p>
                <p className="text-sm text-gray-300 leading-relaxed">{getStepDetails()}</p>
              </div>

              {/* Substeps */}
              {step.substeps && step.substeps.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Subtasks</p>
                  <ul className="space-y-1.5">
                    {step.substeps.map((substep) => (
                      <li key={substep.id} className="flex items-center gap-2 text-sm">
                        <SubstepStatusIcon status={substep.status} />
                        <span className="text-gray-300">{stripBoltTags(substep.title)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Error message */}
              {step.error && (
                <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-xs font-medium text-red-400 uppercase tracking-wide mb-1">Error</p>
                  <p className="text-sm text-red-300">{step.error}</p>
                </div>
              )}

              {/* Token usage */}
              {step.actualTokens && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500">
                    Tokens used: <span className="text-gray-400 font-medium">{step.actualTokens.toLocaleString()}</span>
                  </p>
                </div>
              )}

              {/* Skip action */}
              {canSkip && step.status === 'pending' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSkip();
                  }}
                  className="text-xs font-medium text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Skip this step →
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
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
          className="w-3 h-3 rounded-full bg-purple-500"
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      );
    default:
      return <div className="w-3 h-3 rounded-full border border-gray-600" />;
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

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export default PlanSteps;
