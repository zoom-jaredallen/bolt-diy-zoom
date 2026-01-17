/**
 * Plan → Act Mode Loop Types
 *
 * Defines the structure for planning phase before execution.
 */

export type PlanMode = 'plan' | 'act';

export type PlanStepStatus = 'pending' | 'in-progress' | 'complete' | 'failed' | 'skipped';

export interface PlanStep {
  id: string;
  order: number;
  title: string;
  description: string;
  status: PlanStepStatus;
  estimatedTokens?: number;
  actualTokens?: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  substeps?: PlanSubstep[];
}

export interface PlanSubstep {
  id: string;
  title: string;
  status: PlanStepStatus;
}

export interface Plan {
  id: string;
  chatId: string;
  title: string;
  summary: string;
  steps: PlanStep[];
  createdAt: number;
  approvedAt?: number;
  completedAt?: number;
  status: 'draft' | 'approved' | 'executing' | 'completed' | 'failed' | 'cancelled';
  currentStepIndex: number;
  totalEstimatedTokens?: number;
  totalActualTokens?: number;
}

export interface PlanState {
  mode: PlanMode;
  currentPlan: Plan | null;
  isGeneratingPlan: boolean;
  isPlanApproved: boolean;
  autoExecute: boolean;
  maxAutoSteps: number;
}

export interface PlanGenerationRequest {
  messages: any[];
  chatId: string;
  userGoal: string;
}

export interface PlanApprovalAction {
  type: 'approve' | 'reject' | 'modify';
  modifications?: Partial<Plan>;
}

export interface PlanExecutionResult {
  stepId: string;
  success: boolean;
  output?: string;
  error?: string;
  tokensUsed?: number;
}

// Annotations for streaming plan data
export interface PlanAnnotation {
  type: 'plan';
  plan: Plan;
}

export interface PlanStepAnnotation {
  type: 'planStep';
  stepId: string;
  status: PlanStepStatus;
  output?: string;
}
