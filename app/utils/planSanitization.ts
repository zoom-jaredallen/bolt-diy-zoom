/**
 * Plan Sanitization Utilities
 *
 * Functions to clean and format plan content for user-friendly display
 * and to sanitize shell commands before execution.
 */

/**
 * Removes boltArtifact, boltAction, and other HTML/XML tags from content
 */
export function stripBoltTags(content: string): string {
  if (!content) {
    return '';
  }

  // Remove boltArtifact blocks entirely (including content)
  let cleaned = content.replace(/<boltArtifact[^>]*>[\s\S]*?<\/boltArtifact>/gi, '');

  // Remove any remaining boltAction tags
  cleaned = cleaned.replace(/<boltAction[^>]*>[\s\S]*?<\/boltAction>/gi, '');

  // Remove parameter/invoke XML tags (from tool invocations)
  cleaned = cleaned.replace(/<parameter[^>]*>[\s\S]*?<\/parameter>/gi, '');
  cleaned = cleaned.replace(/<invoke[^>]*>[\s\S]*?<\/invoke>/gi, '');
  cleaned = cleaned.replace(/<\/invoke>/gi, '');
  cleaned = cleaned.replace(/<[^>]*>[\s\S]*?<\/antml:[^>]*>/gi, '');

  // Remove HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, '');

  // Clean up excess whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Extracts a clean, user-friendly summary from LLM plan output
 */
export function sanitizePlanSummary(rawSummary: string): string {
  if (!rawSummary) {
    return '';
  }

  // First, strip all bolt/HTML tags
  let summary = stripBoltTags(rawSummary);

  // Remove TypeScript/JavaScript code patterns
  summary = summary.replace(/^import\s+.*$/gm, '');
  summary = summary.replace(/^export\s+.*$/gm, '');
  summary = summary.replace(/^interface\s+\w+\s*{[\s\S]*?^}/gm, '');
  summary = summary.replace(/^type\s+\w+\s*=.*$/gm, '');
  summary = summary.replace(/^const\s+\w+\s*[:=][\s\S]*?^[}\]];?$/gm, '');
  summary = summary.replace(/^function\s+\w+\s*\([\s\S]*?^}/gm, '');

  // Remove code blocks
  summary = summary.replace(/```[\s\S]*?```/g, '');

  // Remove file paths that look like code
  summary = summary.replace(/filePath="[^"]*"/g, '');

  // Remove JSON-like content
  summary = summary.replace(/\{[\s\S]*?"[^"]*"[\s\S]*?\}/g, '');

  // Clean up any remaining special characters from code
  summary = summary.replace(/[{}()\[\];]/g, '');

  // Remove very long lines (likely code remnants)
  const lines = summary.split('\n').filter((line) => line.length < 200);
  summary = lines.join('\n');

  // Clean up excess whitespace
  summary = summary.replace(/\n{3,}/g, '\n\n');
  summary = summary.trim();

  // If summary is too short or empty after cleaning, provide a default
  if (summary.length < 10) {
    return 'Review the execution plan below to see the steps that will be taken.';
  }

  return summary;
}

/**
 * Converts a plan into user-friendly bullet points
 */
export function formatPlanAsBulletPoints(plan: {
  title: string;
  summary: string;
  steps: Array<{ title: string; description: string }>;
}): string {
  const lines: string[] = [];

  if (plan.title) {
    lines.push(`## ${plan.title}`);
    lines.push('');
  }

  if (plan.summary) {
    const cleanSummary = sanitizePlanSummary(plan.summary);

    if (cleanSummary) {
      lines.push(cleanSummary);
      lines.push('');
    }
  }

  if (plan.steps && plan.steps.length > 0) {
    lines.push('### Steps:');
    plan.steps.forEach((step, index) => {
      const cleanTitle = stripBoltTags(step.title);
      const cleanDesc = sanitizePlanSummary(step.description);
      lines.push(`${index + 1}. **${cleanTitle}**`);

      if (cleanDesc) {
        lines.push(`   ${cleanDesc}`);
      }
    });
  }

  return lines.join('\n');
}

/**
 * Sanitizes a shell command by removing XML/HTML tags and extracting the actual command
 */
export function sanitizeShellCommand(command: string): string {
  if (!command) {
    return '';
  }

  let cleaned = command.trim();

  // Check if the command contains XML-style parameter tags
  const parameterMatch = cleaned.match(/<parameter[^>]*name="command"[^>]*>([^<]+)<\/parameter>/i);

  if (parameterMatch) {
    // Extract just the command from within the parameter tags
    cleaned = parameterMatch[1].trim();
  }

  // Also check for generic content within parameter tags
  const genericParamMatch = cleaned.match(/<parameter[^>]*>([^<]+)<\/parameter>/i);

  if (genericParamMatch && !parameterMatch) {
    cleaned = genericParamMatch[1].trim();
  }

  // Remove any remaining XML/HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, '');

  // Remove invoke/antml tags
  cleaned = cleaned.replace(/<\/invoke>/gi, '');
  cleaned = cleaned.replace(/<invoke[^>]*>/gi, '');

  // Clean up any XML entity encoding
  cleaned = cleaned.replace(/&lt;/g, '<');
  cleaned = cleaned.replace(/&gt;/g, '>');
  cleaned = cleaned.replace(/&amp;/g, '&');
  cleaned = cleaned.replace(/&quot;/g, '"');

  // Trim whitespace and newlines
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Validates if a command appears to be a valid shell command
 * Returns true if valid, false if it contains XML-like patterns
 */
export function isValidShellCommand(command: string): boolean {
  if (!command || command.trim().length === 0) {
    return false;
  }

  const trimmed = command.trim();

  // Check for XML-like patterns that indicate malformed command
  const xmlPatterns = [
    /^<\/?[a-zA-Z]/, // Starts with XML tag
    /<parameter/i, // Contains parameter tags
    /<\/parameter>/i,
    /<invoke/i, // Contains invoke tags
    /<\/invoke>/i,
    /</i, // Contains antml tags
    /^\s*<[^>]+>\s*$/, // Is just an XML tag
  ];

  for (const pattern of xmlPatterns) {
    if (pattern.test(trimmed)) {
      return false;
    }
  }

  return true;
}

/**
 * Extracts clean text from LLM response that may contain tool invocations
 */
export function extractCleanTextFromResponse(response: string): string {
  if (!response) {
    return '';
  }

  // Remove all XML/HTML-like tags and their content
  let text = response;

  // Remove boltArtifact blocks
  text = text.replace(/<boltArtifact[^>]*>[\s\S]*?<\/boltArtifact>/gi, '');

  // Remove tool invocation blocks
  text = text.replace(/<function_calls>[\s\S]*?<\/antml:function_calls>/gi, '');
  text = text.replace(/<invoke[^>]*>[\s\S]*?<\/antml:invoke>/gi, '');

  // Remove any remaining tags
  text = text.replace(/<[^>]+>/g, '');

  // Clean up whitespace
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

  return text;
}
