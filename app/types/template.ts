/**
 * Post-creation hook types
 */
export type TemplateHookType = 'zoom-app-create';

/**
 * Post-creation hook configuration
 *
 * @property type - Type of hook to execute after template creation
 * @property required - Whether the hook is required (blocks on failure) or optional
 * @property config - Custom configuration for the hook
 */
export interface TemplateHook {
  type: TemplateHookType;
  required?: boolean;
  config?: Record<string, unknown>;
}

/**
 * Template definition for starter templates
 *
 * @property name - Unique name/identifier for the template
 * @property label - Display label shown in UI
 * @property description - Description of the template
 * @property githubRepo - GitHub repository (owner/repo format)
 * @property tags - Searchable tags
 * @property icon - Icon class name
 * @property postCreateHook - Post-creation hook to execute after template is scaffolded
 */
export interface Template {
  name: string;
  label: string;
  description: string;
  githubRepo: string;
  tags?: string[];
  icon?: string;
  postCreateHook?: TemplateHook;
}
