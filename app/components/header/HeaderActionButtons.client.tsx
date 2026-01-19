import { useState, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';
import { DeployButton } from '~/components/deploy/DeployButton';
import { chatId, db } from '~/lib/persistence';
import { setSnapshot } from '~/lib/persistence/db';
import type { Snapshot } from '~/lib/persistence/types';

interface HeaderActionButtonsProps {
  chatStarted: boolean;
}

export function HeaderActionButtons({ chatStarted }: HeaderActionButtonsProps) {
  const [activePreviewIndex] = useState(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const previews = useStore(workbenchStore.previews);
  const files = useStore(workbenchStore.files);
  const activePreview = previews[activePreviewIndex];

  const shouldShowButtons = activePreview;
  const hasFiles = Object.keys(files).length > 0;
  const shouldShowSnapshotButton = chatStarted || hasFiles;

  const handleSaveSnapshot = useCallback(async () => {
    const currentChatId = chatId.get();

    if (!currentChatId) {
      toast.error('Cannot save snapshot: No chat ID. Start a conversation first.');
      return;
    }

    if (!db) {
      toast.error('Cannot save snapshot: Database not available.');
      return;
    }

    const files = workbenchStore.files.get();

    if (Object.keys(files).length === 0) {
      toast.error('Cannot save snapshot: No files in project.');
      return;
    }

    setIsSavingSnapshot(true);

    try {
      const snapshot: Snapshot = {
        chatIndex: '', // Will be updated on next message
        files,
      };

      await setSnapshot(db, currentChatId, snapshot);
      toast.success(`Snapshot saved! ${Object.keys(files).length} files saved for this project.`);
      console.log('[SaveSnapshot] SUCCESS - saved', Object.keys(files).length, 'files for chat:', currentChatId);
    } catch (error) {
      console.error('[SaveSnapshot] FAILED:', error);
      toast.error('Failed to save snapshot.');
    } finally {
      setIsSavingSnapshot(false);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);

    try {
      const response = await fetch('/api/logout', {
        method: 'POST',
      });

      if (response.ok) {
        window.location.href = '/login';
      } else {
        console.error('Logout failed');
        setIsLoggingOut(false);
      }
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  }, []);

  return (
    <div className="flex items-center gap-2">
      {/* Deploy Button */}
      {shouldShowButtons && <DeployButton />}

      {/* Debug Tools */}
      {shouldShowButtons && (
        <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden text-sm">
          <button
            onClick={() =>
              window.open(
                'https://github.com/zoom-jaredallen/bolt-diy-zoom/issues/new?template=bug_report.yml',
                '_blank',
              )
            }
            className="rounded-l-md items-center justify-center [&:is(:disabled,.disabled)]:cursor-not-allowed [&:is(:disabled,.disabled)]:opacity-60 px-3 py-1.5 text-xs bg-accent-500 text-white hover:text-bolt-elements-item-contentAccent [&:not(:disabled,.disabled)]:hover:bg-bolt-elements-button-primary-backgroundHover outline-accent-500 flex gap-1.5"
            title="Report Bug"
          >
            <div className="i-ph:bug" />
            <span>Report Bug</span>
          </button>
          <div className="w-px bg-bolt-elements-borderColor" />
          <button
            onClick={async () => {
              try {
                const { downloadDebugLog } = await import('~/utils/debugLogger');
                await downloadDebugLog();
              } catch (error) {
                console.error('Failed to download debug log:', error);
              }
            }}
            className="rounded-r-md items-center justify-center [&:is(:disabled,.disabled)]:cursor-not-allowed [&:is(:disabled,.disabled)]:opacity-60 px-3 py-1.5 text-xs bg-accent-500 text-white hover:text-bolt-elements-item-contentAccent [&:not(:disabled,.disabled)]:hover:bg-bolt-elements-button-primary-backgroundHover outline-accent-500 flex gap-1.5"
            title="Download Debug Log"
          >
            <div className="i-ph:download" />
            <span>Debug Log</span>
          </button>
        </div>
      )}

      {/* Save Snapshot Button - shows when chat started or files exist (even without preview) */}
      {shouldShowSnapshotButton && (
        <button
          onClick={handleSaveSnapshot}
          disabled={isSavingSnapshot}
          className="flex items-center justify-center px-3 py-1.5 text-xs border border-bolt-elements-borderColor rounded-md bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3 hover:text-bolt-elements-textPrimary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Save project snapshot for restoring later"
        >
          <div className="i-ph:camera mr-1.5" />
          <span>{isSavingSnapshot ? 'Saving...' : 'Save Snapshot'}</span>
        </button>
      )}

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="flex items-center justify-center px-3 py-1.5 text-xs border border-bolt-elements-borderColor rounded-md bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3 hover:text-bolt-elements-textPrimary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Logout"
      >
        <div className="i-ph:sign-out mr-1.5" />
        <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
      </button>
    </div>
  );
}
