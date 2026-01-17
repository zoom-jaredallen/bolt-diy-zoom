import { useStore } from '@nanostores/react';
import { useCallback, useEffect, useRef } from 'react';
import {
  autoExecutionState,
  autoExecutionConfig,
  executionHistory,
  startAutoExecution,
  pauseExecution,
  resumeExecution,
  stopAutoExecution,
  resetAutoExecution,
  updateAutoExecutionConfig,
  getExecutionStats,
  registerStepExecutor,
  registerProgressCallback,
  registerConfirmationCallback,
  type AutoExecutionConfig,
  type AutoExecutionState,
  type ExecutionHistoryEntry,
  type PauseReason,
} from '~/lib/services/autoExecutionService';
import { planStore } from '~/lib/stores/plan';
import type { PlanStep } from '~/types/plan';

/**
 * Hook for Auto-Execution UI Integration
 *
 * Provides reactive state and controls for the autonomous
 * multi-turn execution feature.
 */

export interface UseAutoExecutionOptions {
  // Called to execute a step (sends to LLM)
  onExecuteStep?: (
    step: PlanStep,
    index: number,
  ) => Promise<{
    tokensUsed: number;
    success: boolean;
    error?: string;
  }>;

  // Called when execution state changes
  onProgressUpdate?: (state: AutoExecutionState, currentStep: PlanStep | null) => void;

  // Called when a step needs confirmation (returns true to continue)
  onConfirmationNeeded?: (step: PlanStep, reason: string) => Promise<boolean>;
}

export interface UseAutoExecutionReturn {
  // State
  state: AutoExecutionState;
  config: AutoExecutionConfig;
  history: ExecutionHistoryEntry[];
  stats: ReturnType<typeof getExecutionStats>;
  isEnabled: boolean;
  canStart: boolean;

  // Actions
  start: () => Promise<void>;
  pause: () => void;
  resume: () => Promise<void>;
  stop: () => void;
  reset: () => void;

  // Configuration
  updateConfig: (updates: Partial<AutoExecutionConfig>) => void;
  setMaxSteps: (max: number) => void;
  setTokenBudget: (budget: number) => void;
  setAutoApprove: (enabled: boolean) => void;

  // Helpers
  getPauseReasonMessage: (reason: PauseReason | null) => string;
  getProgressPercent: () => number;
  getTokenUsagePercent: () => number;
}

export function useAutoExecution(options: UseAutoExecutionOptions = {}): UseAutoExecutionReturn {
  const state = useStore(autoExecutionState);
  const config = useStore(autoExecutionConfig);
  const history = useStore(executionHistory);
  const planState = useStore(planStore);

  // Store refs to avoid stale closures
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Register callbacks on mount
  useEffect(() => {
    if (optionsRef.current.onExecuteStep) {
      registerStepExecutor(optionsRef.current.onExecuteStep);
    }

    if (optionsRef.current.onProgressUpdate) {
      registerProgressCallback(optionsRef.current.onProgressUpdate);
    }

    if (optionsRef.current.onConfirmationNeeded) {
      registerConfirmationCallback(optionsRef.current.onConfirmationNeeded);
    }
  }, []);

  // Computed values
  const isEnabled = planState.autoExecute;
  const canStart = planState.currentPlan !== null && planState.isPlanApproved && !state.isAutoExecuting && isEnabled;

  // Actions
  const start = useCallback(async () => {
    if (canStart) {
      await startAutoExecution();
    }
  }, [canStart]);

  const pause = useCallback(() => {
    pauseExecution('user_requested');
  }, []);

  const resume = useCallback(async () => {
    await resumeExecution();
  }, []);

  const stop = useCallback(() => {
    stopAutoExecution();
  }, []);

  const reset = useCallback(() => {
    resetAutoExecution();
  }, []);

  // Configuration
  const updateConfig = useCallback((updates: Partial<AutoExecutionConfig>) => {
    updateAutoExecutionConfig(updates);
  }, []);

  const setMaxSteps = useCallback((max: number) => {
    updateAutoExecutionConfig({ maxSteps: max });
  }, []);

  const setTokenBudget = useCallback((budget: number) => {
    updateAutoExecutionConfig({ maxTotalTokens: budget });
  }, []);

  const setAutoApprove = useCallback((enabled: boolean) => {
    updateAutoExecutionConfig({ pauseOnDangerousActions: !enabled });
  }, []);

  // Helpers
  const getPauseReasonMessage = useCallback((reason: PauseReason | null): string => {
    if (!reason) {
      return '';
    }

    const messages: Record<PauseReason, string> = {
      user_requested: 'Execution paused by user',
      token_budget_reached: 'Token budget limit reached',
      max_steps_reached: 'Maximum steps limit reached',
      error_threshold: 'Too many consecutive errors',
      step_timeout: 'Step execution timed out',
      dangerous_action: 'Dangerous action detected - confirmation needed',
      plan_complete: 'Plan execution completed',
    };

    return messages[reason] || 'Unknown pause reason';
  }, []);

  const getProgressPercent = useCallback(() => {
    const totalSteps = planState.currentPlan?.steps.length || 0;

    if (totalSteps === 0) {
      return 0;
    }

    return Math.round((state.stepsExecuted / totalSteps) * 100);
  }, [planState.currentPlan, state.stepsExecuted]);

  const getTokenUsagePercent = useCallback(() => {
    if (config.maxTotalTokens === 0) {
      return 0;
    }

    return Math.round((state.totalTokensUsed / config.maxTotalTokens) * 100);
  }, [config.maxTotalTokens, state.totalTokensUsed]);

  return {
    // State
    state,
    config,
    history,
    stats: getExecutionStats(),
    isEnabled,
    canStart,

    // Actions
    start,
    pause,
    resume,
    stop,
    reset,

    // Configuration
    updateConfig,
    setMaxSteps,
    setTokenBudget,
    setAutoApprove,

    // Helpers
    getPauseReasonMessage,
    getProgressPercent,
    getTokenUsagePercent,
  };
}

export default useAutoExecution;
