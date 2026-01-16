import ignore from 'ignore';
import type { ProviderInfo } from '~/types/model';
import type { Template } from '~/types/template';
import { STARTER_TEMPLATES } from './constants';
import type { ZoomAppCreateResult } from '~/types/zoom';

export interface TemplateHookResult {
  hookType: string;
  success: boolean;
  message: string;
  data?: ZoomAppCreateResult;
  envContent?: string;
}

export interface GetTemplatesResult {
  assistantMessage: string;
  userMessage: string;
  hookResult?: TemplateHookResult;
}

const starterTemplateSelectionPrompt = (templates: Template[]) => `
You are an experienced developer who helps people choose the best starter template for their projects.
IMPORTANT: Vite is preferred
IMPORTANT: Only choose shadcn templates if the user explicitly asks for shadcn.

Available templates:
<template>
  <name>blank</name>
  <description>Empty starter for simple scripts and trivial tasks that don't require a full template setup</description>
  <tags>basic, script</tags>
</template>
${templates
  .map(
    (template) => `
<template>
  <name>${template.name}</name>
  <description>${template.description}</description>
  ${template.tags ? `<tags>${template.tags.join(', ')}</tags>` : ''}
</template>
`,
  )
  .join('\n')}

Response Format:
<selection>
  <templateName>{selected template name}</templateName>
  <title>{a proper title for the project}</title>
</selection>

Examples:

<example>
User: I need to build a todo app
Response:
<selection>
  <templateName>react-basic-starter</templateName>
  <title>Simple React todo application</title>
</selection>
</example>

<example>
User: Write a script to generate numbers from 1 to 100
Response:
<selection>
  <templateName>blank</templateName>
  <title>script to generate numbers from 1 to 100</title>
</selection>
</example>

Instructions:
1. For trivial tasks and simple scripts, always recommend the blank template
2. For more complex projects, recommend templates from the provided list
3. Follow the exact XML format
4. Consider both technical requirements and tags
5. If no perfect match exists, recommend the closest option

Important: Provide only the selection tags in your response, no additional text.
MOST IMPORTANT: YOU DONT HAVE TIME TO THINK JUST START RESPONDING BASED ON HUNCH 
`;

const templates: Template[] = STARTER_TEMPLATES.filter((t) => !t.name.includes('shadcn'));

const parseSelectedTemplate = (llmOutput: string): { template: string; title: string } | null => {
  try {
    // Extract content between <templateName> tags
    const templateNameMatch = llmOutput.match(/<templateName>(.*?)<\/templateName>/);
    const titleMatch = llmOutput.match(/<title>(.*?)<\/title>/);

    if (!templateNameMatch) {
      return null;
    }

    return { template: templateNameMatch[1].trim(), title: titleMatch?.[1].trim() || 'Untitled Project' };
  } catch (error) {
    console.error('Error parsing template selection:', error);
    return null;
  }
};

export const selectStarterTemplate = async (options: { message: string; model: string; provider: ProviderInfo }) => {
  const { message, model, provider } = options;
  const requestBody = {
    message,
    model,
    provider,
    system: starterTemplateSelectionPrompt(templates),
  };
  const response = await fetch('/api/llmcall', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });
  const respJson: { text: string } = await response.json();
  console.log(respJson);

  const { text } = respJson;
  const selectedTemplate = parseSelectedTemplate(text);

  if (selectedTemplate) {
    return selectedTemplate;
  } else {
    console.log('No template selected, using blank template');

    return {
      template: 'blank',
      title: '',
    };
  }
};

const getGitHubRepoContent = async (repoName: string): Promise<{ name: string; path: string; content: string }[]> => {
  try {
    // Instead of directly fetching from GitHub, use our own API endpoint as a proxy
    const response = await fetch(`/api/github-template?repo=${encodeURIComponent(repoName)}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Our API will return the files in the format we need
    const files = (await response.json()) as any;

    return files;
  } catch (error) {
    console.error('Error fetching release contents:', error);
    throw error;
  }
};

export async function getTemplates(templateName: string, title?: string) {
  const template = STARTER_TEMPLATES.find((t) => t.name == templateName);

  if (!template) {
    return null;
  }

  const githubRepo = template.githubRepo;
  const files = await getGitHubRepoContent(githubRepo);

  let filteredFiles = files;

  /*
   * ignoring common unwanted files
   * exclude    .git
   */
  filteredFiles = filteredFiles.filter((x) => x.path.startsWith('.git') == false);

  /*
   * exclude    lock files
   * WE NOW INCLUDE LOCK FILES FOR IMPROVED INSTALL TIMES
   */
  {
    /*
     *const comminLockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
     *filteredFiles = filteredFiles.filter((x) => comminLockFiles.includes(x.name) == false);
     */
  }

  // exclude    .bolt
  filteredFiles = filteredFiles.filter((x) => x.path.startsWith('.bolt') == false);

  // check for ignore file in .bolt folder
  const templateIgnoreFile = files.find((x) => x.path.startsWith('.bolt') && x.name == 'ignore');

  const filesToImport = {
    files: filteredFiles,
    ignoreFile: [] as typeof filteredFiles,
  };

  if (templateIgnoreFile) {
    // redacting files specified in ignore file
    const ignorepatterns = templateIgnoreFile.content.split('\n').map((x) => x.trim());
    const ig = ignore().add(ignorepatterns);

    // filteredFiles = filteredFiles.filter(x => !ig.ignores(x.path))
    const ignoredFiles = filteredFiles.filter((x) => ig.ignores(x.path));

    filesToImport.files = filteredFiles;
    filesToImport.ignoreFile = ignoredFiles;
  }

  const assistantMessage = `
Bolt is initializing your project with the required files using the ${template.name} template.
<boltArtifact id="imported-files" title="${title || 'Create initial files'}" type="bundled">
${filesToImport.files
  .map(
    (file) =>
      `<boltAction type="file" filePath="${file.path}">
${file.content}
</boltAction>`,
  )
  .join('\n')}
</boltArtifact>
`;
  let userMessage = ``;
  const templatePromptFile = files.filter((x) => x.path.startsWith('.bolt')).find((x) => x.name == 'prompt');

  if (templatePromptFile) {
    userMessage = `
TEMPLATE INSTRUCTIONS:
${templatePromptFile.content}

---
`;
  }

  if (filesToImport.ignoreFile.length > 0) {
    userMessage =
      userMessage +
      `
STRICT FILE ACCESS RULES - READ CAREFULLY:

The following files are READ-ONLY and must never be modified:
${filesToImport.ignoreFile.map((file) => `- ${file.path}`).join('\n')}

Permitted actions:
✓ Import these files as dependencies
✓ Read from these files
✓ Reference these files

Strictly forbidden actions:
❌ Modify any content within these files
❌ Delete these files
❌ Rename these files
❌ Move these files
❌ Create new versions of these files
❌ Suggest changes to these files

Any attempt to modify these protected files will result in immediate termination of the operation.

If you need to make changes to functionality, create new files instead of modifying the protected ones listed above.
---
`;
  }

  userMessage += `
---
template import is done, and you can now use the imported files,
edit only the files that need to be changed, and you can create new files as needed.
NO NOT EDIT/WRITE ANY FILES THAT ALREADY EXIST IN THE PROJECT AND DOES NOT NEED TO BE MODIFIED
---
Now that the Template is imported please continue with my original request

IMPORTANT: Dont Forget to install the dependencies before running the app by using \`npm install && npm run dev\`
`;

  // Execute post-create hook if template has one (e.g., Zoom App creation)
  let hookResult: TemplateHookResult | undefined;

  if (template.postCreateHook) {
    console.log('[getTemplates] Template has post-create hook:', template.postCreateHook.type);

    try {
      hookResult = await executePostCreateHook(template, title || template.name);
    } catch (error) {
      console.error('[getTemplates] Post-create hook error:', error);

      // Non-fatal: return hook error but still provide template files
      hookResult = {
        hookType: template.postCreateHook.type,
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error executing post-create hook',
      };
    }
  }

  return {
    assistantMessage,
    userMessage,
    hookResult,
  } as GetTemplatesResult;
}

/**
 * Execute the post-create hook for a template
 */
async function executePostCreateHook(template: Template, projectName: string): Promise<TemplateHookResult> {
  const hook = template.postCreateHook;

  if (!hook) {
    throw new Error('No post-create hook defined');
  }

  console.log(`[executePostCreateHook] Executing hook type: ${hook.type} for project: ${projectName}`);

  switch (hook.type) {
    case 'zoom-app-create':
      return executeZoomAppCreateHook(projectName);
    default:
      console.warn(`[executePostCreateHook] Unknown hook type: ${hook.type}`);

      return {
        hookType: hook.type,
        success: false,
        message: `Unknown hook type: ${hook.type}`,
      };
  }
}

/**
 * Execute the Zoom App creation hook
 */
async function executeZoomAppCreateHook(projectName: string): Promise<TemplateHookResult> {
  console.log(`[executeZoomAppCreateHook] Creating Zoom App: ${projectName}`);

  // First check if the API is configured
  const statusResponse = await fetch('/api/zoom-app-create');
  const status = (await statusResponse.json()) as { configured: boolean; credentials: Record<string, string> };

  console.log('[executeZoomAppCreateHook] API status:', status);

  if (!status.configured) {
    console.warn('[executeZoomAppCreateHook] Zoom API not configured');

    return {
      hookType: 'zoom-app-create',
      success: false,
      message:
        'Zoom S2S OAuth credentials not configured. You can manually create the app at marketplace.zoom.us and update .env with the credentials.',
    };
  }

  // Call the Zoom App creation API
  console.log('[executeZoomAppCreateHook] Calling /api/zoom-app-create...');

  const response = await fetch('/api/zoom-app-create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      appName: projectName,
      description: `${projectName} - Zoom App`,
    }),
  });

  console.log('[executeZoomAppCreateHook] API response status:', response.status);

  const result = (await response.json()) as { success?: boolean; error?: string; code?: string } & Partial<
    ZoomAppCreateResult & { envContent?: string }
  >;

  console.log('[executeZoomAppCreateHook] API response:', JSON.stringify(result, null, 2));

  if (!response.ok || !result.success) {
    const errorResult = result;

    return {
      hookType: 'zoom-app-create',
      success: false,
      message: `Failed to create Zoom App: ${errorResult.error || 'Unknown error'}`,
    };
  }

  const successResult = result as ZoomAppCreateResult & { envContent?: string };

  return {
    hookType: 'zoom-app-create',
    success: true,
    message: `Zoom App "${successResult.appName}" created successfully!`,
    data: successResult,
    envContent: successResult.envContent,
  };
}
