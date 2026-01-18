import { useSearchParams } from '@remix-run/react';
import { generateId, type Message } from 'ai';
import ignore from 'ignore';
import { useEffect, useState } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { useGit } from '~/lib/hooks/useGit';
import { useTemplateHook } from '~/lib/hooks/useTemplateHook';
import { useChatHistory } from '~/lib/persistence';
import { webcontainer } from '~/lib/webcontainer';
import { createCommandsMessage, detectProjectCommands, escapeBoltTags } from '~/utils/projectCommands';
import { LoadingOverlay } from '~/components/ui/LoadingOverlay';
import { toast } from 'react-toastify';
import { setAutoApprove } from '~/lib/stores/pendingChanges';

const IGNORE_PATTERNS = [
  'node_modules/**',
  '.git/**',
  '.github/**',
  '.vscode/**',
  '**/*.jpg',
  '**/*.jpeg',
  '**/*.png',
  'dist/**',
  'build/**',
  '.next/**',
  'coverage/**',
  '.cache/**',
  '.vscode/**',
  '.idea/**',
  '**/*.log',
  '**/.DS_Store',
  '**/npm-debug.log*',
  '**/yarn-debug.log*',
  '**/yarn-error.log*',

  // Include this so npm install runs much faster '**/*lock.json',
  '**/*lock.yaml',
];

export function GitUrlImport() {
  const [searchParams] = useSearchParams();
  const { ready: historyReady, importChat } = useChatHistory();
  const { ready: gitReady, gitClone } = useGit();
  const { executeHook, isExecuting: isHookExecuting, progress: hookProgress } = useTemplateHook();
  const [imported, setImported] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Please wait while we clone the repository...');

  const importRepo = async (repoUrl?: string) => {
    if (!gitReady && !historyReady) {
      return;
    }

    if (repoUrl) {
      const ig = ignore().add(IGNORE_PATTERNS);

      // Enable auto-approve for template imports to avoid multiple approval dialogs
      setAutoApprove(true);

      try {
        const { workdir, data } = await gitClone(repoUrl);

        /*
         * Execute post-create hook if template has one (e.g., Zoom App creation)
         */

        try {
          setLoadingMessage('Checking for template hooks...');

          const wc = await webcontainer;
          const hookResult = await executeHook({ gitUrl: repoUrl, webcontainer: wc });

          if (hookResult) {
            if (hookResult.success) {
              toast.success(hookResult.message);
            } else {
              // Non-fatal: show warning but continue with import
              toast.warning(hookResult.message);
            }
          }
        } catch (hookError) {
          console.warn('[GitUrlImport] Template hook failed:', hookError);

          // Non-fatal: continue with import
        }

        setLoadingMessage('Importing project files...');

        if (importChat) {
          const filePaths = Object.keys(data).filter((filePath) => !ig.ignores(filePath));
          const textDecoder = new TextDecoder('utf-8');

          const fileContents = filePaths
            .map((filePath) => {
              const { data: content, encoding } = data[filePath];
              return {
                path: filePath,
                content:
                  encoding === 'utf8' ? content : content instanceof Uint8Array ? textDecoder.decode(content) : '',
              };
            })
            .filter((f) => f.content);

          const commands = await detectProjectCommands(fileContents);
          const commandsMessage = createCommandsMessage(commands);

          const filesMessage: Message = {
            role: 'assistant',
            content: `Cloning the repo ${repoUrl} into ${workdir}
<boltArtifact id="imported-files" title="Git Cloned Files"  type="bundled">
${fileContents
  .map(
    (file) =>
      `<boltAction type="file" filePath="${file.path}">
${escapeBoltTags(file.content)}
</boltAction>`,
  )
  .join('\n')}
</boltArtifact>`,
            id: generateId(),
            createdAt: new Date(),
          };

          const messages = [filesMessage];

          if (commandsMessage) {
            messages.push({
              role: 'user',
              id: generateId(),
              content: 'Setup the codebase and Start the application',
            });
            messages.push(commandsMessage);
          }

          await importChat(`Git Project:${repoUrl.split('/').slice(-1)[0]}`, messages, { gitUrl: repoUrl });

          // Reset auto-approve after successful import
          setAutoApprove(false);
        }
      } catch (error) {
        console.error('Error during import:', error);
        toast.error('Failed to import repository');
        setLoading(false);

        // Reset auto-approve on error
        setAutoApprove(false);
        window.location.href = '/';

        return;
      }
    }
  };

  useEffect(() => {
    if (!historyReady || !gitReady || imported) {
      return;
    }

    const url = searchParams.get('url');

    if (!url) {
      window.location.href = '/';
      return;
    }

    importRepo(url).catch((error) => {
      console.error('Error importing repo:', error);
      toast.error('Failed to import repository');
      setLoading(false);
      window.location.href = '/';
    });
    setImported(true);
  }, [searchParams, historyReady, gitReady, imported]);

  // Update loading message when hook is executing
  useEffect(() => {
    if (isHookExecuting && hookProgress) {
      setLoadingMessage(hookProgress);
    }
  }, [isHookExecuting, hookProgress]);

  return (
    <ClientOnly fallback={<BaseChat />}>
      {() => (
        <>
          <Chat />
          {(loading || isHookExecuting) && <LoadingOverlay message={loadingMessage} />}
        </>
      )}
    </ClientOnly>
  );
}
