import { createScopedLogger } from '~/utils/logger';
import type { Plan, PlanStep, PlanStepStatus } from '~/types/plan';
import { generateId } from 'ai';
import { PLAN_MODE_SYSTEM_PROMPT, PLAN_STEP_EXECUTION_PROMPT } from '~/lib/common/prompts/plan-prompt';

const logger = createScopedLogger('plan-service');

/**
 * Plan Service
 *
 * Handles plan generation, validation, and step management for the Plan → Act mode loop.
 */

export interface PlanGenerationOptions {
  userGoal: string;
  existingFiles?: string[];
  contextSummary?: string;
}

export interface StepExecutionContext {
  plan: Plan;
  stepIndex: number;
  previousStepOutputs: string[];
}

/**
 * Generates a system prompt for plan mode based on context
 */
export function getPlanModeSystemPrompt(options?: { existingFiles?: string[] }): string {
  let prompt = PLAN_MODE_SYSTEM_PROMPT;

  if (options?.existingFiles && options.existingFiles.length > 0) {
    prompt += `\n\nEXISTING PROJECT FILES:\n${options.existingFiles.slice(0, 50).join('\n')}${options.existingFiles.length > 50 ? `\n... and ${options.existingFiles.length - 50} more files` : ''}`;
  }

  return prompt;
}

/**
 * Generates a prompt for executing a specific step
 */
export function getStepExecutionPrompt(context: StepExecutionContext): string {
  const { plan, stepIndex, previousStepOutputs } = context;
  const step = plan.steps[stepIndex];
  const totalSteps = plan.steps.length;

  let prompt = PLAN_STEP_EXECUTION_PROMPT(step, stepIndex, totalSteps);

  // Add context from previous steps if available
  if (previousStepOutputs.length > 0) {
    prompt += `\n\nPREVIOUS STEP OUTPUTS:\n${previousStepOutputs.map((output, i) => `Step ${i + 1}: ${output}`).join('\n\n')}`;
  }

  // Add context about remaining steps
  const remainingSteps = plan.steps.slice(stepIndex + 1);

  if (remainingSteps.length > 0) {
    prompt += `\n\nUPCOMING STEPS (for context only):\n${remainingSteps.map((s, i) => `${stepIndex + 2 + i}. ${s.title}`).join('\n')}`;
  }

  return prompt;
}

/**
 * Parses a plan from LLM response text
 */
export function parsePlanFromText(text: string, chatId: string): Plan | null {
  try {
    // Look for JSON plan in response
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);

    if (jsonMatch) {
      const planData = JSON.parse(jsonMatch[1]);

      if (planData.title && planData.steps && Array.isArray(planData.steps)) {
        const steps: PlanStep[] = planData.steps.map((step: any, index: number) => ({
          id: generateId(),
          order: index + 1,
          title: step.title || step.name || `Step ${index + 1}`,
          description: step.description || step.details || '',
          status: 'pending' as PlanStepStatus,
          estimatedTokens: step.estimatedTokens,
          substeps: step.substeps?.map((sub: any) => ({
            id: generateId(),
            title: typeof sub === 'string' ? sub : sub.title || sub.name,
            status: 'pending' as PlanStepStatus,
          })),
        }));

        const plan: Plan = {
          id: generateId(),
          chatId,
          title: planData.title,
          summary: planData.summary || '',
          steps,
          createdAt: Date.now(),
          status: 'draft',
          currentStepIndex: 0,
          totalEstimatedTokens:
            planData.estimatedTotalTokens || steps.reduce((sum, s) => sum + (s.estimatedTokens || 0), 0),
        };

        logger.debug('Parsed plan from JSON:', plan.title);

        return plan;
      }
    }

    // Fallback: Parse markdown-style plan
    return parseMarkdownPlan(text, chatId);
  } catch (error) {
    logger.error('Failed to parse plan from text:', error);
    return null;
  }
}

/**
 * Parses a markdown-formatted plan
 */
function parseMarkdownPlan(text: string, chatId: string): Plan | null {
  const lines = text.split('\n');
  const steps: PlanStep[] = [];
  let title = '';
  let summary = '';
  let currentStep: Partial<PlanStep> | null = null;

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
      if (currentStep && currentStep.title) {
        steps.push({
          id: generateId(),
          order: steps.length + 1,
          title: currentStep.title,
          description: currentStep.description || '',
          status: 'pending',
          estimatedTokens: currentStep.estimatedTokens,
          substeps: currentStep.substeps,
        });
      }

      currentStep = {
        title: stepMatch[2].replace(/\*\*/g, '').trim(),
        description: '',
      };
      continue;
    }

    // Look for checkbox steps
    const checkboxMatch = trimmed.match(/^-\s+\[[ x]\]\s+(.+)$/i);

    if (checkboxMatch) {
      if (currentStep && currentStep.title) {
        steps.push({
          id: generateId(),
          order: steps.length + 1,
          title: currentStep.title,
          description: currentStep.description || '',
          status: 'pending',
          estimatedTokens: currentStep.estimatedTokens,
          substeps: currentStep.substeps,
        });
      }

      currentStep = {
        title: checkboxMatch[1].trim(),
        description: '',
      };
      continue;
    }

    // Add description to current step
    if (currentStep && trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-')) {
      currentStep.description = (currentStep.description || '') + (currentStep.description ? ' ' : '') + trimmed;
    }

    // Collect summary (text before first step)
    if (!currentStep && !stepMatch && trimmed && !trimmed.startsWith('#')) {
      summary += (summary ? ' ' : '') + trimmed;
    }
  }

  // Don't forget the last step
  if (currentStep && currentStep.title) {
    steps.push({
      id: generateId(),
      order: steps.length + 1,
      title: currentStep.title,
      description: currentStep.description || '',
      status: 'pending',
      estimatedTokens: currentStep.estimatedTokens,
      substeps: currentStep.substeps,
    });
  }

  if (steps.length > 0) {
    const plan: Plan = {
      id: generateId(),
      chatId,
      title: title || 'Execution Plan',
      summary,
      steps,
      createdAt: Date.now(),
      status: 'draft',
      currentStepIndex: 0,
    };

    logger.debug('Parsed plan from markdown:', plan.title, `(${steps.length} steps)`);

    return plan;
  }

  logger.warn('Could not parse plan from text');

  return null;
}

/**
 * Detects if user input is a plan approval command
 */
export function detectPlanApproval(input: string): 'approve' | 'reject' | 'modify' | null {
  const lowercaseInput = input.toLowerCase().trim();

  // Approval patterns
  if (
    lowercaseInput === 'approve' ||
    lowercaseInput === 'yes' ||
    lowercaseInput === 'ok' ||
    lowercaseInput === 'lgtm' ||
    lowercaseInput === 'looks good' ||
    lowercaseInput.startsWith('approve') ||
    lowercaseInput.includes('start execution') ||
    lowercaseInput.includes('begin execution')
  ) {
    return 'approve';
  }

  // Rejection patterns
  if (
    lowercaseInput === 'reject' ||
    lowercaseInput === 'no' ||
    lowercaseInput === 'cancel' ||
    lowercaseInput.startsWith('reject')
  ) {
    return 'reject';
  }

  // Modification patterns
  if (
    lowercaseInput.startsWith('modify') ||
    lowercaseInput.startsWith('change') ||
    lowercaseInput.startsWith('update') ||
    lowercaseInput.startsWith('add step') ||
    lowercaseInput.startsWith('remove step')
  ) {
    return 'modify';
  }

  return null;
}

/**
 * Detects [STEP_COMPLETE] marker in response
 */
export function detectStepCompletion(response: string): { completed: boolean; summary: string } {
  const marker = '[STEP_COMPLETE]';
  const markerIndex = response.indexOf(marker);

  if (markerIndex !== -1) {
    const summary = response.slice(markerIndex + marker.length).trim();
    return { completed: true, summary };
  }

  return { completed: false, summary: '' };
}

/**
 * Validates a plan structure
 */
export function validatePlan(plan: Plan): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!plan.title || plan.title.trim().length === 0) {
    errors.push('Plan must have a title');
  }

  if (!plan.steps || plan.steps.length === 0) {
    errors.push('Plan must have at least one step');
  }

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];

    if (!step.title || step.title.trim().length === 0) {
      errors.push(`Step ${i + 1} must have a title`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Estimates token usage for a plan based on step complexity
 */
export function estimatePlanTokens(plan: Plan): number {
  const baseTokensPerStep = 500;
  const tokenMultiplier: Record<string, number> = {
    setup: 0.5,
    configuration: 0.7,
    implementation: 1.5,
    testing: 0.8,
    deployment: 0.6,
  };

  let totalTokens = 0;

  for (const step of plan.steps) {
    let multiplier = 1;

    // Try to detect step type from title
    const lowerTitle = step.title.toLowerCase();

    for (const [type, mult] of Object.entries(tokenMultiplier)) {
      if (lowerTitle.includes(type)) {
        multiplier = mult;
        break;
      }
    }

    // Factor in substeps
    const substepBonus = step.substeps ? step.substeps.length * 100 : 0;

    totalTokens += step.estimatedTokens || Math.round(baseTokensPerStep * multiplier) + substepBonus;
  }

  return totalTokens;
}
