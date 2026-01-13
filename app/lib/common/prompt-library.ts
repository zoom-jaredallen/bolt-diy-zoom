import { getSystemPrompt } from './prompts/prompts';
import optimized from './prompts/optimized';
import { getFineTunedPrompt } from './prompts/new-prompt';
import type { DesignScheme } from '~/types/design-scheme';
import {
  type CustomPrompt,
  customPromptsStore,
  isCustomPromptId,
  getAllCustomPrompts,
} from '~/lib/stores/customPrompts';
import { processTemplate, type TemplateContext } from './prompts/template-processor';
import { mergeSections, buildPromptFromSections, DEFAULT_PROMPT_INTRO } from './prompts/sections';

export interface PromptOptions {
  cwd: string;
  allowedHtmlElements: string[];
  modificationTagName: string;
  designScheme?: DesignScheme;
  supabase?: {
    isConnected: boolean;
    hasSelectedProject: boolean;
    credentials?: {
      anonKey?: string;
      supabaseUrl?: string;
    };
  };
}

export interface PromptListItem {
  id: string;
  label: string;
  description: string;
  isCustom?: boolean;
  type?: 'full' | 'override';
}

/**
 * Built-in prompt definition
 */
interface BuiltInPrompt {
  label: string;
  description: string;
  get: (options: PromptOptions) => string;
}

export class PromptLibrary {
  /**
   * Built-in prompts library
   */
  static library: Record<string, BuiltInPrompt> = {
    default: {
      label: 'Default Prompt',
      description: 'A fine tuned prompt for better results and less token usage',
      get: (options) => getFineTunedPrompt(options.cwd, options.supabase, options.designScheme),
    },
    original: {
      label: 'Old Default Prompt',
      description: 'The OG battle tested default system Prompt',
      get: (options) => getSystemPrompt(options.cwd, options.supabase, options.designScheme),
    },
    optimized: {
      label: 'Optimized Prompt (experimental)',
      description: 'An Experimental version of the prompt for lower token usage',
      get: (options) => optimized(options),
    },
  };

  /**
   * Get the list of all available prompts (built-in + custom)
   */
  static getList(): PromptListItem[] {
    // Get built-in prompts
    const builtInPrompts: PromptListItem[] = Object.entries(this.library).map(([key, value]) => ({
      id: key,
      label: value.label,
      description: value.description,
      isCustom: false,
    }));

    // Get custom prompts
    const customPrompts: PromptListItem[] = getAllCustomPrompts().map((prompt) => ({
      id: prompt.id,
      label: prompt.name,
      description: prompt.description,
      isCustom: true,
      type: prompt.type,
    }));

    return [...builtInPrompts, ...customPrompts];
  }

  /**
   * Get list of built-in prompts only
   */
  static getBuiltInList(): PromptListItem[] {
    return Object.entries(this.library).map(([key, value]) => ({
      id: key,
      label: value.label,
      description: value.description,
      isCustom: false,
    }));
  }

  /**
   * Get list of custom prompts only
   */
  static getCustomList(): PromptListItem[] {
    return getAllCustomPrompts().map((prompt) => ({
      id: prompt.id,
      label: prompt.name,
      description: prompt.description,
      isCustom: true,
      type: prompt.type,
    }));
  }

  /**
   * Build template context from PromptOptions
   */
  private static _buildTemplateContext(options: PromptOptions): TemplateContext {
    return {
      cwd: options.cwd,
      supabase: options.supabase,
      designScheme: options.designScheme,
    };
  }

  /**
   * Process a custom prompt with template variables
   */
  private static _processCustomPrompt(customPrompt: CustomPrompt, options: PromptOptions): string {
    const templateContext = this._buildTemplateContext(options);

    if (customPrompt.type === 'full') {
      // Full prompt replacement - process template variables
      return processTemplate(customPrompt.content, templateContext);
    } else if (customPrompt.type === 'override') {
      /*
       * Section override - merge with base prompt sections
       * Note: basePromptId is stored for future use when we want to
       * inherit specific sections from different built-in prompts
       */
      const intro = DEFAULT_PROMPT_INTRO;

      // Merge custom sections with defaults
      const mergedSections = mergeSections(customPrompt.sections || {});

      // Build prompt from merged sections
      const rawPrompt = buildPromptFromSections(mergedSections, intro);

      // Process template variables
      return processTemplate(rawPrompt, templateContext);
    }

    // Fallback to default prompt
    return this.library.default.get(options);
  }

  /**
   * Get a prompt by ID (supports both built-in and custom prompts)
   */
  static getPropmtFromLibrary(promptId: string, options: PromptOptions): string {
    // Check if it's a custom prompt
    if (isCustomPromptId(promptId)) {
      const customPrompts = customPromptsStore.get();
      const customPrompt = customPrompts[promptId];

      if (customPrompt) {
        return this._processCustomPrompt(customPrompt, options);
      }

      // Custom prompt not found, fall back to default
      console.warn(`Custom prompt not found: ${promptId}, falling back to default`);

      return this.library.default.get(options);
    }

    // Built-in prompt
    const prompt = this.library[promptId];

    if (!prompt) {
      /*
       * Prompt not found, try to find a custom prompt with this ID
       * (in case someone saved a custom prompt without the custom_ prefix)
       */
      const customPrompts = customPromptsStore.get();
      const customPrompt = customPrompts[promptId];

      if (customPrompt) {
        return this._processCustomPrompt(customPrompt, options);
      }

      console.warn(`Prompt not found: ${promptId}, falling back to default`);

      return this.library.default.get(options);
    }

    return prompt.get(options);
  }

  /**
   * Check if a prompt ID exists (built-in or custom)
   */
  static hasPrompt(promptId: string): boolean {
    if (isCustomPromptId(promptId)) {
      const customPrompts = customPromptsStore.get();

      return promptId in customPrompts;
    }

    return promptId in this.library;
  }

  /**
   * Get a prompt's metadata by ID
   */
  static getPromptInfo(promptId: string): PromptListItem | null {
    if (isCustomPromptId(promptId)) {
      const customPrompts = customPromptsStore.get();
      const customPrompt = customPrompts[promptId];

      if (customPrompt) {
        return {
          id: customPrompt.id,
          label: customPrompt.name,
          description: customPrompt.description,
          isCustom: true,
          type: customPrompt.type,
        };
      }

      return null;
    }

    const prompt = this.library[promptId];

    if (prompt) {
      return {
        id: promptId,
        label: prompt.label,
        description: prompt.description,
        isCustom: false,
      };
    }

    return null;
  }

  /**
   * Get the raw content of a built-in prompt (for duplicating/editing)
   */
  static getBuiltInPromptContent(promptId: string, options: PromptOptions): string | null {
    const prompt = this.library[promptId];

    if (prompt) {
      return prompt.get(options);
    }

    return null;
  }

  /**
   * Preview a custom prompt with sample data
   */
  static previewCustomPrompt(customPrompt: CustomPrompt): string {
    const sampleOptions: PromptOptions = {
      cwd: '/home/project',
      allowedHtmlElements: ['strong', 'em', 'code', 'pre'],
      modificationTagName: 'boltModification',
      supabase: {
        isConnected: true,
        hasSelectedProject: true,
        credentials: {
          supabaseUrl: 'https://example.supabase.co',
          anonKey: 'sample-anon-key',
        },
      },
      designScheme: {
        font: ['sans-serif'],
        palette: {
          primary: '#9E7FFF',
          secondary: '#38bdf8',
          accent: '#f472b6',
          background: '#171717',
          surface: '#262626',
          text: '#FFFFFF',
          textSecondary: '#A3A3A3',
          border: '#2F2F2F',
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444',
        },
        features: ['rounded'],
      },
    };

    return this._processCustomPrompt(customPrompt, sampleOptions);
  }
}
