import { memo, useState } from 'react';
import { useAutoExecution } from '~/lib/hooks/useAutoExecution';
import { classNames } from '~/utils/classNames';
import type { PlanStep } from '~/types/plan';
import type { AutoExecutionState } from '~/lib/services/autoExecutionService';

/**
 * Auto-Execution Controls
 *
 * UI component for controlling autonomous multi-turn execution.
 * Provides start/pause/resume controls, progress visualization,
 * and configuration options.
 */

interface AutoExecutionControlsProps {
  onExecuteStep: (
    step: PlanStep,
    index: number,
  ) => Promise<{
    tokensUsed: number;
    success: boolean;
    error?: string;
  }>;
  onConfirmationNeeded?: (step: PlanStep, reason: string) => Promise<boolean>;
  className?: string;
}

export const AutoExecutionControls = memo(
  ({ onExecuteStep, onConfirmationNeeded, className }: AutoExecutionControlsProps) => {
    const [showSettings, setShowSettings] = useState(false);

    const {
      state,
      config,
      stats,
      isEnabled,
      canStart,
      start,
      pause,
      resume,
      stop,
      setMaxSteps,
      setTokenBudget,
      setAutoApprove,
      getPauseReasonMessage,
      getProgressPercent,
      getTokenUsagePercent,
    } = useAutoExecution({
      onExecuteStep,
      onConfirmationNeeded,
      onProgressUpdate: (newState: AutoExecutionState, _step: PlanStep | null) => {
        console.log('Auto-execution progress:', newState);
      },
    });

    if (!isEnabled) {
      return null;
    }

    const progressPercent = getProgressPercent();
    const tokenUsagePercent = getTokenUsagePercent();
    const isRunning = state.isAutoExecuting && !state.isPaused;
    const isPaused = state.isPaused;

    return (
      <div className={classNames('auto-execution-controls', className)}>
        {/* Main Control Bar */}
        <div className="flex items-center gap-2 p-2 bg-bolt-elements-background-depth-2 rounded-lg border border-bolt-elements-borderColor">
          {/* Status Indicator */}
          <div className="flex items-center gap-2">
            <div
              className={classNames('w-2 h-2 rounded-full', {
                'bg-green-500 animate-pulse': isRunning,
                'bg-yellow-500': isPaused,
                'bg-gray-400': !state.isAutoExecuting,
              })}
            />
            <span className="text-xs text-bolt-elements-textSecondary">
              {isRunning ? 'Auto-executing' : isPaused ? 'Paused' : stats.stepsExecuted > 0 ? 'Completed' : 'Ready'}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="flex-1 mx-2">
            <div className="h-1.5 bg-bolt-elements-background-depth-3 rounded-full overflow-hidden">
              <div
                className={classNames('h-full transition-all duration-300', {
                  'bg-green-500': !state.lastError,
                  'bg-red-500': !!state.lastError,
                })}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between mt-0.5 text-[10px] text-bolt-elements-textTertiary">
              <span>
                {stats.stepsExecuted}/{stats.stepsExecuted + stats.stepsRemaining} steps
              </span>
              <span>{stats.totalTokensUsed.toLocaleString()} tokens</span>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center gap-1">
            {!state.isAutoExecuting && canStart && (
              <button
                onClick={start}
                className="p-1.5 rounded hover:bg-bolt-elements-background-depth-3 text-green-500"
                title="Start Auto-Execution"
              >
                <div className="i-ph:play-fill w-4 h-4" />
              </button>
            )}

            {isRunning && (
              <button
                onClick={pause}
                className="p-1.5 rounded hover:bg-bolt-elements-background-depth-3 text-yellow-500"
                title="Pause Execution"
              >
                <div className="i-ph:pause-fill w-4 h-4" />
              </button>
            )}

            {isPaused && (
              <button
                onClick={resume}
                className="p-1.5 rounded hover:bg-bolt-elements-background-depth-3 text-green-500"
                title="Resume Execution"
              >
                <div className="i-ph:play-fill w-4 h-4" />
              </button>
            )}

            {state.isAutoExecuting && (
              <button
                onClick={stop}
                className="p-1.5 rounded hover:bg-bolt-elements-background-depth-3 text-red-500"
                title="Stop Execution"
              >
                <div className="i-ph:stop-fill w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => setShowSettings(!showSettings)}
              className={classNames('p-1.5 rounded hover:bg-bolt-elements-background-depth-3', {
                'text-bolt-elements-textPrimary': showSettings,
                'text-bolt-elements-textSecondary': !showSettings,
              })}
              title="Settings"
            >
              <div className="i-ph:gear-six w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Pause Reason Message */}
        {isPaused && state.pauseReason && (
          <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-600 dark:text-yellow-400">
            <div className="flex items-center gap-2">
              <div className="i-ph:warning w-4 h-4" />
              <span>{getPauseReasonMessage(state.pauseReason)}</span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {state.lastError && (
          <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-600 dark:text-red-400">
            <div className="flex items-center gap-2">
              <div className="i-ph:x-circle w-4 h-4" />
              <span>{state.lastError}</span>
            </div>
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-2 p-3 bg-bolt-elements-background-depth-2 rounded-lg border border-bolt-elements-borderColor">
            <h4 className="text-xs font-medium text-bolt-elements-textPrimary mb-3">Auto-Execution Settings</h4>

            {/* Max Steps */}
            <div className="mb-3">
              <label className="flex items-center justify-between text-xs text-bolt-elements-textSecondary mb-1">
                <span>Max Steps</span>
                <span className="text-bolt-elements-textPrimary">{config.maxSteps}</span>
              </label>
              <input
                type="range"
                min="1"
                max="50"
                value={config.maxSteps}
                onChange={(e) => setMaxSteps(parseInt(e.target.value))}
                className="w-full h-1 bg-bolt-elements-background-depth-3 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Token Budget */}
            <div className="mb-3">
              <label className="flex items-center justify-between text-xs text-bolt-elements-textSecondary mb-1">
                <span>Token Budget</span>
                <span className="text-bolt-elements-textPrimary">{config.maxTotalTokens.toLocaleString()}</span>
              </label>
              <input
                type="range"
                min="10000"
                max="500000"
                step="10000"
                value={config.maxTotalTokens}
                onChange={(e) => setTokenBudget(parseInt(e.target.value))}
                className="w-full h-1 bg-bolt-elements-background-depth-3 rounded-lg appearance-none cursor-pointer"
              />

              {/* Token Usage Bar */}
              <div className="mt-1 h-1 bg-bolt-elements-background-depth-3 rounded-full overflow-hidden">
                <div
                  className={classNames('h-full transition-all', {
                    'bg-green-500': tokenUsagePercent < 50,
                    'bg-yellow-500': tokenUsagePercent >= 50 && tokenUsagePercent < 80,
                    'bg-red-500': tokenUsagePercent >= 80,
                  })}
                  style={{ width: `${tokenUsagePercent}%` }}
                />
              </div>
            </div>

            {/* Auto-Approve Dangerous Actions */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-bolt-elements-textSecondary">Auto-approve dangerous actions</span>
              <button
                onClick={() => setAutoApprove(!config.pauseOnDangerousActions)}
                className={classNames('w-10 h-5 rounded-full transition-colors relative', {
                  'bg-green-500': !config.pauseOnDangerousActions,
                  'bg-bolt-elements-background-depth-3': config.pauseOnDangerousActions,
                })}
              >
                <div
                  className={classNames(
                    'absolute w-4 h-4 bg-white rounded-full top-0.5 transition-transform',
                    !config.pauseOnDangerousActions ? 'translate-x-5' : 'translate-x-0.5',
                  )}
                />
              </button>
            </div>

            {/* Stats */}
            <div className="mt-3 pt-3 border-t border-bolt-elements-borderColor">
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="text-bolt-elements-textTertiary">Success Rate:</span>
                  <span className="ml-1 text-bolt-elements-textPrimary">{Math.round(stats.successRate * 100)}%</span>
                </div>
                <div>
                  <span className="text-bolt-elements-textTertiary">Avg Time/Step:</span>
                  <span className="ml-1 text-bolt-elements-textPrimary">
                    {Math.round(stats.avgTimePerStep / 1000)}s
                  </span>
                </div>
                <div>
                  <span className="text-bolt-elements-textTertiary">Errors:</span>
                  <span className="ml-1 text-bolt-elements-textPrimary">{stats.consecutiveErrors}</span>
                </div>
                <div>
                  <span className="text-bolt-elements-textTertiary">Remaining:</span>
                  <span className="ml-1 text-bolt-elements-textPrimary">{stats.stepsRemaining}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
);

AutoExecutionControls.displayName = 'AutoExecutionControls';

export default AutoExecutionControls;
