import type { Message } from 'ai';
import { useCallback, useState } from 'react';
import { EnhancedStreamingMessageParser } from '~/lib/runtime/enhanced-message-parser';
import { workbenchStore } from '~/lib/stores/workbench';
import { planStore } from '~/lib/stores/plan';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('useMessageParser');

/**
 * Check if action execution is allowed based on Plan mode state
 * In Plan mode, actions should NOT execute until the plan is approved
 */
function canExecuteAction(): boolean {
  const { mode, isPlanApproved, currentPlan } = planStore.get();

  // If in Plan mode without approval, block execution
  if (mode === 'plan' && !isPlanApproved) {
    logger.debug('Action execution blocked: Plan mode active, awaiting approval');
    return false;
  }

  // If in Act mode with a plan, only allow if plan is approved
  if (mode === 'act' && currentPlan && !isPlanApproved) {
    logger.debug('Action execution blocked: Plan not yet approved');
    return false;
  }

  return true;
}

const messageParser = new EnhancedStreamingMessageParser({
  callbacks: {
    onArtifactOpen: (data) => {
      logger.trace('onArtifactOpen', data);

      /*
       * Always show workbench and add artifact (for display purposes)
       * But don't execute any actions until plan is approved
       */
      workbenchStore.showWorkbench.set(true);
      workbenchStore.addArtifact(data);
    },
    onArtifactClose: (data) => {
      logger.trace('onArtifactClose');

      workbenchStore.updateArtifact(data, { closed: true });
    },
    onActionOpen: (data) => {
      logger.trace('onActionOpen', data.action);

      /*
       * File actions are streamed, so we add them immediately to show progress
       * Shell actions are complete when created by enhanced parser, so we wait for close
       *
       * In Plan mode: we still add actions to show the plan, but don't execute them
       */
      if (data.action.type === 'file') {
        workbenchStore.addAction(data);
      }
    },
    onActionClose: (data) => {
      logger.trace('onActionClose', data.action);

      /*
       * Add non-file actions (shell, build, start, etc.) when they close
       * Enhanced parser creates complete shell actions, so they're ready to execute
       */
      if (data.action.type !== 'file') {
        workbenchStore.addAction(data);
      }

      // CRITICAL: Check Plan mode before executing actions
      if (canExecuteAction()) {
        workbenchStore.runAction(data);
      } else {
        logger.info(`Action queued but not executed (Plan mode active): ${data.action.type}`);
      }
    },
    onActionStream: (data) => {
      logger.trace('onActionStream', data.action);

      // CRITICAL: Check Plan mode before streaming action execution
      if (canExecuteAction()) {
        workbenchStore.runAction(data, true);
      }
    },
  },
});
const extractTextContent = (message: Message) =>
  Array.isArray(message.content)
    ? (message.content.find((item) => item.type === 'text')?.text as string) || ''
    : message.content;

export function useMessageParser() {
  const [parsedMessages, setParsedMessages] = useState<{ [key: number]: string }>({});

  const parseMessages = useCallback((messages: Message[], isLoading: boolean) => {
    let reset = false;

    if (import.meta.env.DEV && !isLoading) {
      reset = true;
      messageParser.reset();
    }

    for (const [index, message] of messages.entries()) {
      if (message.role === 'assistant' || message.role === 'user') {
        const newParsedContent = messageParser.parse(message.id, extractTextContent(message));
        setParsedMessages((prevParsed) => ({
          ...prevParsed,
          [index]: !reset ? (prevParsed[index] || '') + newParsedContent : newParsedContent,
        }));
      }
    }
  }, []);

  return { parsedMessages, parseMessages };
}
