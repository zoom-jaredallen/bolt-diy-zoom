import { map, computed } from 'nanostores';

/**
 * Token Usage Store
 *
 * Tracks real LLM token usage for budget management
 * and auto-execution cost awareness.
 */

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface TokenUsageState {
  // Last response usage
  lastResponse: TokenUsage;

  // Session totals
  sessionPromptTokens: number;
  sessionCompletionTokens: number;
  sessionTotalTokens: number;

  // Timestamp of last update
  lastUpdated: number;

  // Response count
  responseCount: number;
}

// Main store
export const tokenUsageStore = map<TokenUsageState>({
  lastResponse: {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  },
  sessionPromptTokens: 0,
  sessionCompletionTokens: 0,
  sessionTotalTokens: 0,
  lastUpdated: 0,
  responseCount: 0,
});

// Derived values
export const lastResponseTokens = computed(tokenUsageStore, (state) => state.lastResponse.totalTokens);

export const sessionTotalTokens = computed(tokenUsageStore, (state) => state.sessionTotalTokens);

export const averageTokensPerResponse = computed(tokenUsageStore, (state) => {
  if (state.responseCount === 0) {
    return 0;
  }

  return Math.round(state.sessionTotalTokens / state.responseCount);
});

/**
 * Record token usage from an LLM response
 */
export function recordTokenUsage(usage: Partial<TokenUsage>): void {
  const promptTokens = usage.promptTokens || 0;
  const completionTokens = usage.completionTokens || 0;
  const totalTokens = usage.totalTokens || promptTokens + completionTokens;

  const current = tokenUsageStore.get();

  tokenUsageStore.set({
    lastResponse: {
      promptTokens,
      completionTokens,
      totalTokens,
    },
    sessionPromptTokens: current.sessionPromptTokens + promptTokens,
    sessionCompletionTokens: current.sessionCompletionTokens + completionTokens,
    sessionTotalTokens: current.sessionTotalTokens + totalTokens,
    lastUpdated: Date.now(),
    responseCount: current.responseCount + 1,
  });
}

/**
 * Get the most recent response's token count
 * Useful for auto-execution step tracking
 */
export function getLastResponseTokens(): number {
  return tokenUsageStore.get().lastResponse.totalTokens;
}

/**
 * Get session totals
 */
export function getSessionTokens(): TokenUsage {
  const state = tokenUsageStore.get();

  return {
    promptTokens: state.sessionPromptTokens,
    completionTokens: state.sessionCompletionTokens,
    totalTokens: state.sessionTotalTokens,
  };
}

/**
 * Reset session token tracking (e.g., when starting new chat)
 */
export function resetSessionTokens(): void {
  tokenUsageStore.set({
    lastResponse: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    },
    sessionPromptTokens: 0,
    sessionCompletionTokens: 0,
    sessionTotalTokens: 0,
    lastUpdated: 0,
    responseCount: 0,
  });
}

/**
 * Estimate cost based on token usage (for display purposes)
 * Using approximate GPT-4 pricing as reference
 */
export function estimateCost(
  usage: TokenUsage,
  inputPricePer1K: number = 0.03,
  outputPricePer1K: number = 0.06,
): number {
  const inputCost = (usage.promptTokens / 1000) * inputPricePer1K;
  const outputCost = (usage.completionTokens / 1000) * outputPricePer1K;

  return inputCost + outputCost;
}

/**
 * Format token count for display
 */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) {
    return tokens.toString();
  }

  if (tokens < 1000000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }

  return `${(tokens / 1000000).toFixed(2)}M`;
}
