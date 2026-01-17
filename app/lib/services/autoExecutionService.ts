import { atom, map } from 'nanostores';
import {
  planStore,
  startStep,
  completeStep,
  failStep,
  getNextPendingStep,
  executionPaused,
  currentStepIndex,
} from '~/lib/stores/plan';
import type { PlanStep } from '~/types/plan';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('AutoExecution');

/**
 * Auto-Execution Service
 *
 * Enables autonomous multi-turn execution of plan steps without
 * requiring user approval for each step. Includes safety controls
 * and budget management.
 */

// Configuration types
export interface AutoExecutionConfig {
  maxSteps: number; // Maximum steps to execute automatically
  maxTotalTokens: number; // Total token budget
  pauseOnDangerousActions: boolean; // Pause before dangerous operations
  errorThreshold: number; // Pause after N consecutive errors
  stepTimeout: number; // Max milliseconds per step
  requireConfirmationFor: DangerousActionType[]; // Actions needing manual approval
}

export type DangerousActionType =
  | 'file_delete'
  | 'git_push'
  | 'package_publish'
  | 'env_change'
  | 'external_api'
  | 'database_write';

// Execution state
export interface AutoExecutionState {
  isAutoExecuting: boolean;
  isPaused: boolean;
  currentStepStartTime: number | null;
  totalTokensUsed: number;
  stepsExecuted: number;
  consecutiveErrors: number;
  lastError: string | null;
  pauseReason: PauseReason | null;
}

export type PauseReason =
  | 'user_requested'
  | 'token_budget_reached'
  | 'max_steps_reached'
  | 'error_threshold'
  | 'step_timeout'
  | 'dangerous_action'
  | 'plan_complete';

// Execution history entry
export interface ExecutionHistoryEntry {
  stepId: string;
  stepIndex: number;
  stepTitle: string;
  startTime: number;
  endTime: number | null;
  tokensUsed: number;
  status: 'running' | 'success' | 'error' | 'skipped' | 'paused';
  error?: string;
}

// Default configuration
export const DEFAULT_AUTO_EXECUTION_CONFIG: AutoExecutionConfig = {
  maxSteps: 10,
  maxTotalTokens: 100000,
  pauseOnDangerousActions: true,
  errorThreshold: 2,
  stepTimeout: 120000, // 2 minutes
  requireConfirmationFor: ['file_delete', 'git_push', 'package_publish'],
};

// Stores
export const autoExecutionConfig = map<AutoExecutionConfig>(DEFAULT_AUTO_EXECUTION_CONFIG);

export const autoExecutionState = map<AutoExecutionState>({
  isAutoExecuting: false,
  isPaused: false,
  currentStepStartTime: null,
  totalTokensUsed: 0,
  stepsExecuted: 0,
  consecutiveErrors: 0,
  lastError: null,
  pauseReason: null,
});

export const executionHistory = atom<ExecutionHistoryEntry[]>([]);

// Callbacks for UI integration
type StepCallback = (
  step: PlanStep,
  index: number,
) => Promise<{ tokensUsed: number; success: boolean; error?: string }>;
type ProgressCallback = (state: AutoExecutionState, step: PlanStep | null) => void;
type ConfirmationCallback = (step: PlanStep, reason: string) => Promise<boolean>;

let executeStepCallback: StepCallback | null = null;
let progressCallback: ProgressCallback | null = null;
let confirmationCallback: ConfirmationCallback | null = null;

// Register callbacks
export function registerStepExecutor(callback: StepCallback) {
  executeStepCallback = callback;
}

export function registerProgressCallback(callback: ProgressCallback) {
  progressCallback = callback;
}

export function registerConfirmationCallback(callback: ConfirmationCallback) {
  confirmationCallback = callback;
}

// Dangerous action patterns
const DANGEROUS_PATTERNS: Record<DangerousActionType, RegExp[]> = {
  file_delete: [/rm\s+-rf/, /unlink\(/, /fs\.rm/, /deleteFile/, /removeSync/],
  git_push: [/git\s+push/, /git\s+push\s+--force/, /git\s+push\s+-f/],
  package_publish: [/npm\s+publish/, /pnpm\s+publish/, /yarn\s+publish/],
  env_change: [/process\.env/, /\.env/, /setEnv/],
  external_api: [/fetch\(.*https?:\/\/(?!localhost)/, /axios\./, /http\.request/],
  database_write: [/INSERT\s+INTO/, /UPDATE\s+/, /DELETE\s+FROM/, /DROP\s+TABLE/],
};

// Detect dangerous actions in step content
export function detectDangerousActions(stepDescription: string): DangerousActionType[] {
  const detected: DangerousActionType[] = [];

  for (const [actionType, patterns] of Object.entries(DANGEROUS_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(stepDescription)) {
        detected.push(actionType as DangerousActionType);
        break;
      }
    }
  }

  return detected;
}

// Check if step requires confirmation
export function requiresConfirmation(step: PlanStep): { required: boolean; reasons: string[] } {
  const config = autoExecutionConfig.get();
  const reasons: string[] = [];

  // Check for dangerous actions
  const dangerousActions = detectDangerousActions(step.description);
  const needsConfirmation = dangerousActions.filter((a) => config.requireConfirmationFor.includes(a));

  if (needsConfirmation.length > 0 && config.pauseOnDangerousActions) {
    reasons.push(`Contains dangerous operations: ${needsConfirmation.join(', ')}`);
  }

  // Check for high token estimate
  if (step.estimatedTokens && step.estimatedTokens > 5000) {
    reasons.push(`High token estimate: ${step.estimatedTokens} tokens`);
  }

  return {
    required: reasons.length > 0,
    reasons,
  };
}

// Start auto-execution
export async function startAutoExecution(): Promise<void> {
  const state = autoExecutionState.get();

  if (state.isAutoExecuting) {
    logger.warn('Auto-execution already in progress');

    return;
  }

  const plan = planStore.get().currentPlan;

  if (!plan) {
    logger.error('No plan available for auto-execution');

    return;
  }

  if (!planStore.get().isPlanApproved) {
    logger.error('Plan must be approved before auto-execution');

    return;
  }

  logger.info('Starting auto-execution', { planId: plan.id, steps: plan.steps.length });

  autoExecutionState.setKey('isAutoExecuting', true);
  autoExecutionState.setKey('isPaused', false);
  autoExecutionState.setKey('pauseReason', null);
  autoExecutionState.setKey('stepsExecuted', 0);
  autoExecutionState.setKey('totalTokensUsed', 0);
  autoExecutionState.setKey('consecutiveErrors', 0);
  executionHistory.set([]);

  await executeNextStep();
}

// Execute the next pending step
async function executeNextStep(): Promise<void> {
  const state = autoExecutionState.get();
  const config = autoExecutionConfig.get();
  const plan = planStore.get().currentPlan;

  // Check termination conditions
  if (!state.isAutoExecuting || state.isPaused || !plan) {
    return;
  }

  // Check max steps limit
  if (state.stepsExecuted >= config.maxSteps) {
    pauseExecution('max_steps_reached');
    logger.info('Max steps reached', { executed: state.stepsExecuted, max: config.maxSteps });

    return;
  }

  // Check token budget
  if (state.totalTokensUsed >= config.maxTotalTokens) {
    pauseExecution('token_budget_reached');
    logger.info('Token budget reached', { used: state.totalTokensUsed, budget: config.maxTotalTokens });

    return;
  }

  // Get next pending step
  const nextStep = getNextPendingStep();

  if (!nextStep) {
    pauseExecution('plan_complete');
    logger.info('Plan execution complete');

    return;
  }

  const stepIndex = plan.steps.findIndex((s) => s.id === nextStep.id);

  // Check if step requires confirmation
  const confirmation = requiresConfirmation(nextStep);

  if (confirmation.required && confirmationCallback) {
    const confirmed = await confirmationCallback(nextStep, confirmation.reasons.join('; '));

    if (!confirmed) {
      pauseExecution('dangerous_action');
      logger.info('Step requires confirmation', { step: nextStep.title, reasons: confirmation.reasons });

      return;
    }
  }

  // Update progress
  progressCallback?.(autoExecutionState.get(), nextStep);

  // Execute the step
  await executeStep(nextStep, stepIndex);
}

// Execute a single step
async function executeStep(step: PlanStep, stepIndex: number): Promise<void> {
  const config = autoExecutionConfig.get();

  if (!executeStepCallback) {
    logger.error('No step executor registered');
    pauseExecution('user_requested');

    return;
  }

  logger.info('Executing step', { index: stepIndex, title: step.title });

  // Record start
  const startTime = Date.now();
  autoExecutionState.setKey('currentStepStartTime', startTime);
  startStep(stepIndex);
  currentStepIndex.set(stepIndex);

  // Add to history
  const historyEntry: ExecutionHistoryEntry = {
    stepId: step.id,
    stepIndex,
    stepTitle: step.title,
    startTime,
    endTime: null,
    tokensUsed: 0,
    status: 'running',
  };
  executionHistory.set([...executionHistory.get(), historyEntry]);

  // Set up timeout
  const timeoutPromise = new Promise<{ tokensUsed: number; success: boolean; error: string }>((resolve) => {
    setTimeout(() => {
      resolve({ tokensUsed: 0, success: false, error: 'Step execution timeout' });
    }, config.stepTimeout);
  });

  try {
    // Execute with timeout
    const result = await Promise.race([executeStepCallback(step, stepIndex), timeoutPromise]);

    const endTime = Date.now();

    // Update history
    const history = executionHistory.get();
    const entryIndex = history.findIndex((e) => e.stepId === step.id);

    if (entryIndex >= 0) {
      history[entryIndex] = {
        ...history[entryIndex],
        endTime,
        tokensUsed: result.tokensUsed,
        status: result.success ? 'success' : 'error',
        error: result.error,
      };
      executionHistory.set([...history]);
    }

    // Update state
    autoExecutionState.setKey('currentStepStartTime', null);

    const currentState = autoExecutionState.get();

    if (result.success) {
      completeStep(stepIndex, result.tokensUsed);
      autoExecutionState.setKey('stepsExecuted', currentState.stepsExecuted + 1);
      autoExecutionState.setKey('totalTokensUsed', currentState.totalTokensUsed + result.tokensUsed);
      autoExecutionState.setKey('consecutiveErrors', 0);
      autoExecutionState.setKey('lastError', null);

      logger.info('Step completed successfully', { step: step.title, tokens: result.tokensUsed });

      // Continue to next step
      progressCallback?.(autoExecutionState.get(), null);
      await executeNextStep();
    } else {
      failStep(stepIndex, result.error || 'Unknown error');
      autoExecutionState.setKey('consecutiveErrors', currentState.consecutiveErrors + 1);
      autoExecutionState.setKey('lastError', result.error || 'Unknown error');

      logger.error('Step failed', { step: step.title, error: result.error });

      // Check error threshold
      if (currentState.consecutiveErrors + 1 >= config.errorThreshold) {
        pauseExecution('error_threshold');
        logger.warn('Error threshold reached', { errors: currentState.consecutiveErrors + 1 });
      } else {
        // Try next step (optional: could also retry or pause)
        progressCallback?.(autoExecutionState.get(), null);
        await executeNextStep();
      }
    }
  } catch (error: any) {
    logger.error('Step execution threw exception', error);
    failStep(stepIndex, error.message);
    autoExecutionState.setKey('consecutiveErrors', autoExecutionState.get().consecutiveErrors + 1);
    autoExecutionState.setKey('lastError', error.message);
    pauseExecution('error_threshold');
  }
}

// Pause execution
export function pauseExecution(reason: PauseReason = 'user_requested'): void {
  logger.info('Pausing auto-execution', { reason });

  autoExecutionState.setKey('isPaused', true);
  autoExecutionState.setKey('pauseReason', reason);

  if (reason === 'plan_complete' || reason === 'max_steps_reached' || reason === 'token_budget_reached') {
    autoExecutionState.setKey('isAutoExecuting', false);
  }

  executionPaused.set(true);
  progressCallback?.(autoExecutionState.get(), null);
}

// Resume execution
export async function resumeExecution(): Promise<void> {
  const state = autoExecutionState.get();

  if (!state.isPaused) {
    logger.warn('Execution not paused');

    return;
  }

  logger.info('Resuming auto-execution');

  autoExecutionState.setKey('isPaused', false);
  autoExecutionState.setKey('pauseReason', null);
  executionPaused.set(false);

  if (!state.isAutoExecuting) {
    autoExecutionState.setKey('isAutoExecuting', true);
  }

  await executeNextStep();
}

// Stop execution completely
export function stopAutoExecution(): void {
  logger.info('Stopping auto-execution');

  autoExecutionState.set({
    isAutoExecuting: false,
    isPaused: false,
    currentStepStartTime: null,
    totalTokensUsed: autoExecutionState.get().totalTokensUsed,
    stepsExecuted: autoExecutionState.get().stepsExecuted,
    consecutiveErrors: 0,
    lastError: null,
    pauseReason: null,
  });

  executionPaused.set(false);
  progressCallback?.(autoExecutionState.get(), null);
}

// Reset execution state (for new plan)
export function resetAutoExecution(): void {
  autoExecutionState.set({
    isAutoExecuting: false,
    isPaused: false,
    currentStepStartTime: null,
    totalTokensUsed: 0,
    stepsExecuted: 0,
    consecutiveErrors: 0,
    lastError: null,
    pauseReason: null,
  });

  executionHistory.set([]);
}

// Update configuration
export function updateAutoExecutionConfig(updates: Partial<AutoExecutionConfig>): void {
  const current = autoExecutionConfig.get();
  autoExecutionConfig.set({ ...current, ...updates });
}

// Get execution statistics
export function getExecutionStats() {
  const state = autoExecutionState.get();
  const history = executionHistory.get();
  const config = autoExecutionConfig.get();

  const successfulSteps = history.filter((e) => e.status === 'success').length;
  const failedStepsCount = history.filter((e) => e.status === 'error').length;
  const totalTime = history.reduce((sum, e) => sum + ((e.endTime || Date.now()) - e.startTime), 0);
  const avgTimePerStep = successfulSteps > 0 ? totalTime / successfulSteps : 0;

  return {
    stepsExecuted: state.stepsExecuted,
    stepsRemaining: (planStore.get().currentPlan?.steps.length || 0) - state.stepsExecuted,
    successRate: state.stepsExecuted > 0 ? successfulSteps / state.stepsExecuted : 0,
    failedSteps: failedStepsCount,
    totalTokensUsed: state.totalTokensUsed,
    tokenBudgetRemaining: config.maxTotalTokens - state.totalTokensUsed,
    tokenBudgetPercent: (state.totalTokensUsed / config.maxTotalTokens) * 100,
    avgTimePerStep,
    consecutiveErrors: state.consecutiveErrors,
    lastError: state.lastError,
    isRunning: state.isAutoExecuting && !state.isPaused,
    isPaused: state.isPaused,
    pauseReason: state.pauseReason,
  };
}
