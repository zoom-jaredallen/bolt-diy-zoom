import { map } from 'nanostores';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('customPrompts');

// Storage key for localStorage
const CUSTOM_PROMPTS_KEY = 'bolt_custom_prompts';

/**
 * Defines the sections of a prompt that can be individually overridden
 */
export interface PromptSections {
  systemConstraints?: string;
  databaseInstructions?: string;
  codeFormattingInfo?: string;
  artifactInstructions?: string;
  designInstructions?: string;
  mobileAppInstructions?: string;
  chainOfThought?: string;
}

/**
 * Metadata about each prompt section for UI display
 */
export const PROMPT_SECTION_META: Record<keyof PromptSections, { label: string; description: string }> = {
  systemConstraints: {
    label: 'System Constraints',
    description: 'WebContainer limitations, available shell commands, and environment restrictions',
  },
  databaseInstructions: {
    label: 'Database Instructions',
    description: 'Supabase/database handling, migrations, RLS policies',
  },
  codeFormattingInfo: {
    label: 'Code Formatting',
    description: 'Indentation, style rules, and code organization',
  },
  artifactInstructions: {
    label: 'Artifact Instructions',
    description: 'How to structure boltArtifact output, file actions, shell commands',
  },
  designInstructions: {
    label: 'Design Instructions',
    description: 'UI/UX guidelines, color schemes, typography, layout principles',
  },
  mobileAppInstructions: {
    label: 'Mobile App Instructions',
    description: 'React Native/Expo rules, mobile-specific guidelines',
  },
  chainOfThought: {
    label: 'Chain of Thought',
    description: 'Instructions for reasoning and step-by-step thinking',
  },
};

/**
 * Custom prompt definition
 */
export interface CustomPrompt {
  id: string;
  name: string;
  description: string;
  type: 'full' | 'override';
  content: string; // For 'full' type - the entire prompt
  sections?: PromptSections; // For 'override' type - only the sections to override
  basePromptId?: string; // For 'override' type - which built-in prompt to extend
  createdAt: number;
  updatedAt: number;
}

/**
 * Store type for custom prompts
 */
export type CustomPromptsMap = Record<string, CustomPrompt>;

// Check if we're in browser environment
const isBrowser = typeof window !== 'undefined';

/**
 * Generate a unique ID for custom prompts
 */
export const generateCustomPromptId = (): string => {
  return `custom_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Load custom prompts from localStorage
 */
const loadCustomPrompts = (): CustomPromptsMap => {
  if (!isBrowser) {
    return {};
  }

  try {
    const stored = localStorage.getItem(CUSTOM_PROMPTS_KEY);

    if (!stored) {
      return {};
    }

    const parsed = JSON.parse(stored) as CustomPromptsMap;
    logger.debug(`Loaded ${Object.keys(parsed).length} custom prompts from storage`);

    return parsed;
  } catch (error) {
    logger.error('Error loading custom prompts from storage:', error);
    return {};
  }
};

/**
 * Save custom prompts to localStorage
 */
const saveCustomPrompts = (prompts: CustomPromptsMap): void => {
  if (!isBrowser) {
    return;
  }

  try {
    localStorage.setItem(CUSTOM_PROMPTS_KEY, JSON.stringify(prompts));
    logger.debug(`Saved ${Object.keys(prompts).length} custom prompts to storage`);
  } catch (error) {
    logger.error('Error saving custom prompts to storage:', error);
  }
};

/**
 * Nanostores map for custom prompts
 */
export const customPromptsStore = map<CustomPromptsMap>(loadCustomPrompts());

/**
 * Create a new custom prompt
 */
export const createCustomPrompt = (prompt: Omit<CustomPrompt, 'id' | 'createdAt' | 'updatedAt'>): CustomPrompt => {
  const now = Date.now();
  const newPrompt: CustomPrompt = {
    ...prompt,
    id: generateCustomPromptId(),
    createdAt: now,
    updatedAt: now,
  };

  const currentPrompts = customPromptsStore.get();
  const updatedPrompts = {
    ...currentPrompts,
    [newPrompt.id]: newPrompt,
  };

  customPromptsStore.set(updatedPrompts);
  saveCustomPrompts(updatedPrompts);

  logger.info(`Created custom prompt: ${newPrompt.name} (${newPrompt.id})`);

  return newPrompt;
};

/**
 * Update an existing custom prompt
 */
export const updateCustomPrompt = (
  id: string,
  updates: Partial<Omit<CustomPrompt, 'id' | 'createdAt'>>,
): CustomPrompt | null => {
  const currentPrompts = customPromptsStore.get();
  const existingPrompt = currentPrompts[id];

  if (!existingPrompt) {
    logger.warn(`Cannot update: Custom prompt not found: ${id}`);
    return null;
  }

  const updatedPrompt: CustomPrompt = {
    ...existingPrompt,
    ...updates,
    updatedAt: Date.now(),
  };

  const updatedPrompts = {
    ...currentPrompts,
    [id]: updatedPrompt,
  };

  customPromptsStore.set(updatedPrompts);
  saveCustomPrompts(updatedPrompts);

  logger.info(`Updated custom prompt: ${updatedPrompt.name} (${id})`);

  return updatedPrompt;
};

/**
 * Delete a custom prompt
 */
export const deleteCustomPrompt = (id: string): boolean => {
  const currentPrompts = customPromptsStore.get();

  if (!currentPrompts[id]) {
    logger.warn(`Cannot delete: Custom prompt not found: ${id}`);
    return false;
  }

  const { [id]: deleted, ...remainingPrompts } = currentPrompts;

  customPromptsStore.set(remainingPrompts);
  saveCustomPrompts(remainingPrompts);

  logger.info(`Deleted custom prompt: ${deleted.name} (${id})`);

  return true;
};

/**
 * Get a custom prompt by ID
 */
export const getCustomPrompt = (id: string): CustomPrompt | undefined => {
  return customPromptsStore.get()[id];
};

/**
 * Get all custom prompts as an array
 */
export const getAllCustomPrompts = (): CustomPrompt[] => {
  return Object.values(customPromptsStore.get());
};

/**
 * Check if a prompt ID is a custom prompt
 */
export const isCustomPromptId = (id: string): boolean => {
  return id.startsWith('custom_');
};

/**
 * Duplicate an existing custom prompt
 */
export const duplicateCustomPrompt = (id: string, newName?: string): CustomPrompt | null => {
  const existingPrompt = getCustomPrompt(id);

  if (!existingPrompt) {
    logger.warn(`Cannot duplicate: Custom prompt not found: ${id}`);
    return null;
  }

  return createCustomPrompt({
    name: newName || `${existingPrompt.name} (Copy)`,
    description: existingPrompt.description,
    type: existingPrompt.type,
    content: existingPrompt.content,
    sections: existingPrompt.sections ? { ...existingPrompt.sections } : undefined,
    basePromptId: existingPrompt.basePromptId,
  });
};

/**
 * Export custom prompts for backup
 */
export const exportCustomPrompts = (): string => {
  const prompts = customPromptsStore.get();
  return JSON.stringify(prompts, null, 2);
};

/**
 * Import custom prompts from backup
 */
export const importCustomPrompts = (
  jsonData: string,
  mode: 'replace' | 'merge' = 'merge',
): { imported: number; errors: string[] } => {
  const errors: string[] = [];
  let imported = 0;

  try {
    const parsed = JSON.parse(jsonData) as CustomPromptsMap;
    const currentPrompts = mode === 'replace' ? {} : customPromptsStore.get();
    const newPrompts: CustomPromptsMap = { ...currentPrompts };

    for (const [id, prompt] of Object.entries(parsed)) {
      // Validate prompt structure
      if (!prompt.name || !prompt.type || (!prompt.content && !prompt.sections)) {
        errors.push(`Invalid prompt structure for: ${id}`);
        continue;
      }

      // Generate new ID if merging and ID exists
      const finalId = mode === 'merge' && currentPrompts[id] ? generateCustomPromptId() : id;

      newPrompts[finalId] = {
        ...prompt,
        id: finalId,
        updatedAt: Date.now(),
      };
      imported++;
    }

    customPromptsStore.set(newPrompts);
    saveCustomPrompts(newPrompts);

    logger.info(`Imported ${imported} custom prompts (mode: ${mode})`);
  } catch (error) {
    errors.push(`JSON parsing error: ${error}`);
  }

  return { imported, errors };
};
