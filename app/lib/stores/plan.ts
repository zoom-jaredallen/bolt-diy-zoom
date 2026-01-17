import { atom, map, computed } from 'nanostores';
import type { Plan, PlanMode, PlanStep, PlanStepStatus, PlanState } from '~/types/plan';
import { generateId } from 'ai';

/**
 * Plan Store
 *
 * Manages the Plan → Act mode loop state for multi-step execution.
 */

// Core plan state
export const planStore = map<PlanState>({
  mode: 'act',
  currentPlan: null,
  isGeneratingPlan: false,
  isPlanApproved: false,
  autoExecute: false,
  maxAutoSteps: 10,
});

// Derived states
export const isPlanMode = computed(planStore, (state) => state.mode === 'plan');
export const isActMode = computed(planStore, (state) => state.mode === 'act');
export const hasActivePlan = computed(planStore, (state) => state.currentPlan !== null);
export const canExecute = computed(
  planStore,
  (state) => state.mode === 'act' && state.currentPlan !== null && state.isPlanApproved,
);

// Plan execution tracking
export const currentStepIndex = atom<number>(-1);
export const executionPaused = atom<boolean>(false);

// Actions
export function toggleMode() {
  const current = planStore.get();
  planStore.setKey('mode', current.mode === 'plan' ? 'act' : 'plan');
}

export function setMode(mode: PlanMode) {
  planStore.setKey('mode', mode);
}

export function setGeneratingPlan(generating: boolean) {
  planStore.setKey('isGeneratingPlan', generating);
}

export function createPlan(chatId: string, title: string, summary: string, steps: Omit<PlanStep, 'id'>[]): Plan {
  const plan: Plan = {
    id: generateId(),
    chatId,
    title,
    summary,
    steps: steps.map((step, index) => ({
      ...step,
      id: generateId(),
      order: index + 1,
      status: 'pending' as PlanStepStatus,
    })),
    createdAt: Date.now(),
    status: 'draft',
    currentStepIndex: 0,
  };

  planStore.setKey('currentPlan', plan);
  planStore.setKey('isPlanApproved', false);

  return plan;
}

export function setPlan(plan: Plan) {
  planStore.setKey('currentPlan', plan);
  planStore.setKey('isPlanApproved', plan.status === 'approved' || plan.status === 'executing');
}

export function approvePlan() {
  const current = planStore.get();

  if (!current.currentPlan) {
    return;
  }

  const updatedPlan: Plan = {
    ...current.currentPlan,
    status: 'approved',
    approvedAt: Date.now(),
  };

  planStore.setKey('currentPlan', updatedPlan);
  planStore.setKey('isPlanApproved', true);
  planStore.setKey('mode', 'act');
}

export function rejectPlan() {
  const current = planStore.get();

  if (!current.currentPlan) {
    return;
  }

  const updatedPlan: Plan = {
    ...current.currentPlan,
    status: 'cancelled',
  };

  planStore.setKey('currentPlan', updatedPlan);
  planStore.setKey('isPlanApproved', false);
}

export function clearPlan() {
  planStore.setKey('currentPlan', null);
  planStore.setKey('isPlanApproved', false);
  planStore.setKey('isGeneratingPlan', false);
  currentStepIndex.set(-1);
}

export function updateStepStatus(stepId: string, status: PlanStepStatus, error?: string) {
  const current = planStore.get();

  if (!current.currentPlan) {
    return;
  }

  const updatedSteps = current.currentPlan.steps.map((step) => {
    if (step.id === stepId) {
      return {
        ...step,
        status,
        error,
        startedAt: status === 'in-progress' ? Date.now() : step.startedAt,
        completedAt: status === 'complete' || status === 'failed' ? Date.now() : step.completedAt,
      };
    }

    return step;
  });

  const updatedPlan: Plan = {
    ...current.currentPlan,
    steps: updatedSteps,
  };

  // Check if all steps are complete
  const allComplete = updatedSteps.every((s) => s.status === 'complete' || s.status === 'skipped');
  const anyFailed = updatedSteps.some((s) => s.status === 'failed');

  if (allComplete) {
    updatedPlan.status = 'completed';
    updatedPlan.completedAt = Date.now();
  } else if (anyFailed) {
    updatedPlan.status = 'failed';
  }

  planStore.setKey('currentPlan', updatedPlan);
}

export function startStep(stepIndex: number) {
  const current = planStore.get();

  if (!current.currentPlan || stepIndex >= current.currentPlan.steps.length) {
    return;
  }

  const step = current.currentPlan.steps[stepIndex];
  updateStepStatus(step.id, 'in-progress');
  currentStepIndex.set(stepIndex);

  const updatedPlan: Plan = {
    ...current.currentPlan,
    status: 'executing',
    currentStepIndex: stepIndex,
  };

  planStore.setKey('currentPlan', updatedPlan);
}

export function completeStep(stepIndex: number, tokensUsed?: number) {
  const current = planStore.get();

  if (!current.currentPlan || stepIndex >= current.currentPlan.steps.length) {
    return;
  }

  const updatedSteps = current.currentPlan.steps.map((s, i) => {
    if (i === stepIndex) {
      return {
        ...s,
        status: 'complete' as PlanStepStatus,
        completedAt: Date.now(),
        actualTokens: tokensUsed,
      };
    }

    return s;
  });

  const allComplete = updatedSteps.every((s) => s.status === 'complete' || s.status === 'skipped');

  const updatedPlan: Plan = {
    ...current.currentPlan,
    steps: updatedSteps,
    status: allComplete ? 'completed' : 'executing',
    completedAt: allComplete ? Date.now() : undefined,
    totalActualTokens: (current.currentPlan.totalActualTokens || 0) + (tokensUsed || 0),
  };

  planStore.setKey('currentPlan', updatedPlan);
}

export function failStep(stepIndex: number, error: string) {
  const current = planStore.get();

  if (!current.currentPlan || stepIndex >= current.currentPlan.steps.length) {
    return;
  }

  const stepToFail = current.currentPlan.steps[stepIndex];
  updateStepStatus(stepToFail.id, 'failed', error);
  executionPaused.set(true);
}

export function skipStep(stepIndex: number) {
  const current = planStore.get();

  if (!current.currentPlan || stepIndex >= current.currentPlan.steps.length) {
    return;
  }

  const step = current.currentPlan.steps[stepIndex];
  updateStepStatus(step.id, 'skipped');
}

export function pauseExecution() {
  executionPaused.set(true);
}

export function resumeExecution() {
  executionPaused.set(false);
}

export function setAutoExecute(enabled: boolean) {
  planStore.setKey('autoExecute', enabled);
}

export function setMaxAutoSteps(max: number) {
  planStore.setKey('maxAutoSteps', max);
}

// Helper to get next pending step
export function getNextPendingStep(): PlanStep | null {
  const current = planStore.get();

  if (!current.currentPlan) {
    return null;
  }

  return current.currentPlan.steps.find((step) => step.status === 'pending') || null;
}

// Helper to get current step
export function getCurrentStep(): PlanStep | null {
  const current = planStore.get();

  if (!current.currentPlan) {
    return null;
  }

  return current.currentPlan.steps.find((step) => step.status === 'in-progress') || null;
}

// Helper to calculate progress percentage
export function getPlanProgress(): number {
  const current = planStore.get();

  if (!current.currentPlan || current.currentPlan.steps.length === 0) {
    return 0;
  }

  const completedSteps = current.currentPlan.steps.filter(
    (s) => s.status === 'complete' || s.status === 'skipped',
  ).length;

  return Math.round((completedSteps / current.currentPlan.steps.length) * 100);
}

// Parse plan response from LLM
export function parsePlanFromResponse(response: string, chatId: string): Plan | null {
  try {
    // Look for JSON plan in response
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);

    if (jsonMatch) {
      const planData = JSON.parse(jsonMatch[1]);

      if (planData.title && planData.steps && Array.isArray(planData.steps)) {
        return createPlan(
          chatId,
          planData.title,
          planData.summary || '',
          planData.steps.map((step: any, index: number) => ({
            order: index + 1,
            title: step.title || step.name || `Step ${index + 1}`,
            description: step.description || step.details || '',
            status: 'pending' as PlanStepStatus,
            estimatedTokens: step.estimatedTokens,
            substeps: step.substeps?.map((sub: any) => ({
              id: generateId(),
              title: sub.title || sub,
              status: 'pending' as PlanStepStatus,
            })),
          })),
        );
      }
    }

    // Fallback: Parse markdown-style plan
    const lines = response.split('\n');
    const steps: Omit<PlanStep, 'id'>[] = [];
    let title = '';
    let summary = '';
    let currentStep: Omit<PlanStep, 'id'> | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Look for title (# heading)
      if (trimmed.startsWith('# ') && !title) {
        title = trimmed.slice(2).trim();
        continue;
      }

      // Look for numbered steps
      const stepMatch = trimmed.match(/^(\d+)\.\s+\*?\*?(.+?)\*?\*?\s*$/);

      if (stepMatch) {
        if (currentStep) {
          steps.push(currentStep);
        }

        currentStep = {
          order: parseInt(stepMatch[1]),
          title: stepMatch[2].replace(/\*\*/g, '').trim(),
          description: '',
          status: 'pending',
        };
        continue;
      }

      // Look for checkbox steps
      const checkboxMatch = trimmed.match(/^-\s+\[[ x]\]\s+(.+)$/i);

      if (checkboxMatch) {
        if (currentStep) {
          steps.push(currentStep);
        }

        currentStep = {
          order: steps.length + 1,
          title: checkboxMatch[1].trim(),
          description: '',
          status: 'pending',
        };
        continue;
      }

      // Add description to current step
      if (currentStep && trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-')) {
        currentStep.description += (currentStep.description ? ' ' : '') + trimmed;
      }

      // Collect summary (text before first step)
      if (!currentStep && !stepMatch && trimmed && !trimmed.startsWith('#')) {
        summary += (summary ? ' ' : '') + trimmed;
      }
    }

    if (currentStep) {
      steps.push(currentStep);
    }

    if (steps.length > 0) {
      return createPlan(chatId, title || 'Execution Plan', summary, steps);
    }

    return null;
  } catch (error) {
    console.error('Failed to parse plan from response:', error);
    return null;
  }
}
