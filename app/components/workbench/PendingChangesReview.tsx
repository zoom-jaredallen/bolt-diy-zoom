import { memo, useMemo } from 'react';
import { useStore } from '@nanostores/react';
import { motion } from 'framer-motion';
import {
  pendingChangesStore,
  pendingChangesCount,
  approveChange,
  rejectChange,
  approveAll,
  rejectAll,
  closeReviewModal,
  selectChange,
  setViewMode,
  toggleAutoApprove,
} from '~/lib/stores/pendingChanges';
import type { PendingFileChange } from '~/types/actions';
import { classNames } from '~/utils/classNames';
import { diffLines } from 'diff';

/**
 * PendingChangesReview
 *
 * Modal for reviewing and approving/rejecting file changes before they are applied.
 * Provides safety and transparency for AI-generated modifications.
 */

export const PendingChangesReview = memo(() => {
  const state = useStore(pendingChangesStore);
  const pendingCount = useStore(pendingChangesCount);

  if (!state.isReviewModalOpen) {
    return null;
  }

  const selectedChange = state.changes.find((c) => c.id === state.selectedChangeId);
  const pendingChanges = state.changes.filter((c) => c.status === 'pending');

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeReviewModal}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-[90vw] max-w-6xl h-[85vh] bg-bolt-elements-background-depth-1 rounded-xl border border-bolt-elements-borderColor shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-2">
          <div className="flex items-center gap-3">
            <div className="i-ph:git-diff text-xl text-bolt-elements-textPrimary" />
            <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">Review Changes</h2>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-500/20 text-yellow-400">
                {pendingCount} pending
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Auto-approve toggle */}
            <label className="flex items-center gap-2 text-sm text-bolt-elements-textSecondary cursor-pointer">
              <input
                type="checkbox"
                checked={state.autoApprove}
                onChange={toggleAutoApprove}
                className="w-4 h-4 rounded border-bolt-elements-borderColor"
              />
              Auto-approve
            </label>

            {/* View mode toggle */}
            <div className="flex items-center bg-bolt-elements-background-depth-3 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setViewMode('inline')}
                className={classNames(
                  'px-2 py-1 text-xs rounded transition-colors',
                  state.viewMode === 'inline'
                    ? 'bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text'
                    : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
                )}
              >
                Inline
              </button>
              <button
                type="button"
                onClick={() => setViewMode('side-by-side')}
                className={classNames(
                  'px-2 py-1 text-xs rounded transition-colors',
                  state.viewMode === 'side-by-side'
                    ? 'bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text'
                    : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
                )}
              >
                Side by Side
              </button>
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={closeReviewModal}
              className="p-1.5 rounded-lg hover:bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
            >
              <div className="i-ph:x text-xl" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* File list sidebar */}
          <div className="w-64 border-r border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 flex flex-col">
            <div className="p-2 border-b border-bolt-elements-borderColor">
              <span className="text-xs font-medium text-bolt-elements-textSecondary uppercase">Changed Files</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {state.changes.map((change) => (
                <FileListItem
                  key={change.id}
                  change={change}
                  isSelected={change.id === state.selectedChangeId}
                  onSelect={() => selectChange(change.id)}
                />
              ))}
            </div>
          </div>

          {/* Diff view */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedChange ? (
              <FileDiffView change={selectedChange} viewMode={state.viewMode} />
            ) : (
              <div className="flex-1 flex items-center justify-center text-bolt-elements-textSecondary">
                Select a file to view changes
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-bolt-elements-borderColor bg-bolt-elements-background-depth-2">
          <div className="text-sm text-bolt-elements-textSecondary">
            {pendingChanges.length} file{pendingChanges.length !== 1 ? 's' : ''} pending review
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={rejectAll}
              disabled={pendingCount === 0}
              className={classNames(
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                pendingCount > 0
                  ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                  : 'bg-gray-500/10 text-gray-500 cursor-not-allowed',
              )}
            >
              Reject All
            </button>
            <button
              type="button"
              onClick={approveAll}
              disabled={pendingCount === 0}
              className={classNames(
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                pendingCount > 0
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  : 'bg-gray-500/10 text-gray-500 cursor-not-allowed',
              )}
            >
              Approve All
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
});

interface FileListItemProps {
  change: PendingFileChange;
  isSelected: boolean;
  onSelect: () => void;
}

const FileListItem = memo(({ change, isSelected, onSelect }: FileListItemProps) => {
  const fileName = change.filePath.split('/').pop() || change.filePath;
  const directory = change.filePath.split('/').slice(0, -1).join('/');

  const statusColors = {
    pending: 'text-yellow-400',
    approved: 'text-green-400',
    rejected: 'text-red-400',
    applied: 'text-blue-400',
  };

  const actionIcons = {
    create: 'i-ph:plus-circle',
    modify: 'i-ph:pencil-simple',
    delete: 'i-ph:trash',
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      className={classNames(
        'w-full px-3 py-2 text-left flex items-center gap-2 transition-colors',
        isSelected ? 'bg-bolt-elements-item-backgroundAccent' : 'hover:bg-bolt-elements-background-depth-3',
      )}
    >
      <div className={classNames(actionIcons[change.action], 'flex-shrink-0', statusColors[change.status])} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-bolt-elements-textPrimary truncate">{fileName}</div>
        {directory && <div className="text-xs text-bolt-elements-textTertiary truncate">{directory}</div>}
      </div>
      <div className="flex items-center gap-1 text-xs flex-shrink-0">
        {(change.additions ?? 0) > 0 && <span className="text-green-400">+{change.additions}</span>}
        {(change.deletions ?? 0) > 0 && <span className="text-red-400">-{change.deletions}</span>}
      </div>
    </button>
  );
});

interface FileDiffViewProps {
  change: PendingFileChange;
  viewMode: 'inline' | 'side-by-side';
}

const FileDiffView = memo(({ change, viewMode }: FileDiffViewProps) => {
  const diffBlocks = useMemo(() => {
    const changes = diffLines(change.originalContent, change.newContent);
    let oldLineNum = 1;
    let newLineNum = 1;

    return changes.map((diffChange) => {
      const lines = diffChange.value
        .split('\n')
        .filter((_line, i, arr) => i < arr.length - 1 || diffChange.value.slice(-1) !== '\n');
      const startOld = oldLineNum;
      const startNew = newLineNum;

      if (diffChange.added) {
        newLineNum += lines.length;
        return { ...diffChange, lines, type: 'added' as const, startLine: startNew };
      }

      if (diffChange.removed) {
        oldLineNum += lines.length;
        return { ...diffChange, lines, type: 'removed' as const, startLine: startOld };
      }

      oldLineNum += lines.length;
      newLineNum += lines.length;

      return { ...diffChange, lines, type: 'unchanged' as const, startLine: startNew };
    });
  }, [change.originalContent, change.newContent]);

  return (
    <div className="flex flex-col h-full">
      {/* File header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-3">
        <div className="flex items-center gap-2">
          <div className="i-ph:file-code text-bolt-elements-textSecondary" />
          <span className="text-sm font-medium text-bolt-elements-textPrimary">{change.filePath}</span>
          <span
            className={classNames(
              'px-2 py-0.5 text-xs font-medium rounded-full',
              change.action === 'create' && 'bg-green-500/20 text-green-400',
              change.action === 'modify' && 'bg-yellow-500/20 text-yellow-400',
              change.action === 'delete' && 'bg-red-500/20 text-red-400',
            )}
          >
            {change.action}
          </span>
        </div>
        {change.status === 'pending' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => rejectChange(change.id)}
              className="px-3 py-1 text-sm font-medium rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => approveChange(change.id)}
              className="px-3 py-1 text-sm font-medium rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
            >
              Approve
            </button>
          </div>
        )}
        {change.status !== 'pending' && (
          <span
            className={classNames(
              'px-2 py-0.5 text-xs font-medium rounded-full',
              change.status === 'approved' && 'bg-green-500/20 text-green-400',
              change.status === 'rejected' && 'bg-red-500/20 text-red-400',
              change.status === 'applied' && 'bg-blue-500/20 text-blue-400',
            )}
          >
            {change.status}
          </span>
        )}
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-auto font-mono text-sm p-4">
        {viewMode === 'inline' ? (
          <InlineDiff diffBlocks={diffBlocks} />
        ) : (
          <SideBySideDiff diffBlocks={diffBlocks} change={change} />
        )}
      </div>
    </div>
  );
});

interface DiffBlock {
  value: string;
  lines: string[];
  type: 'added' | 'removed' | 'unchanged';
  startLine: number;
  added?: boolean;
  removed?: boolean;
}

const InlineDiff = memo(({ diffBlocks }: { diffBlocks: DiffBlock[] }) => {
  return (
    <div className="min-w-full">
      {diffBlocks.map((block, blockIndex) => (
        <div key={blockIndex}>
          {block.lines.map((line, lineIndex) => (
            <div
              key={`${blockIndex}-${lineIndex}`}
              className={classNames(
                'flex group min-w-fit',
                block.type === 'added' && 'bg-green-500/10 border-l-4 border-green-500',
                block.type === 'removed' && 'bg-red-500/10 border-l-4 border-red-500',
              )}
            >
              <div className="w-12 shrink-0 pl-2 py-0.5 text-right font-mono text-bolt-elements-textTertiary border-r border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 select-none">
                {block.startLine + lineIndex}
              </div>
              <div className="px-4 py-0.5 whitespace-pre flex-1 text-bolt-elements-textPrimary">
                <span className="mr-2 text-bolt-elements-textTertiary">
                  {block.type === 'added' && <span className="text-green-500">+</span>}
                  {block.type === 'removed' && <span className="text-red-500">-</span>}
                  {block.type === 'unchanged' && ' '}
                </span>
                {line || ' '}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
});

const SideBySideDiff = memo(({ change }: { diffBlocks: DiffBlock[]; change: PendingFileChange }) => {
  const oldLines = change.originalContent.split('\n');
  const newLines = change.newContent.split('\n');

  return (
    <div className="flex gap-4">
      {/* Before */}
      <div className="flex-1">
        <div className="text-xs font-medium text-bolt-elements-textSecondary mb-2 uppercase">Before</div>
        <div className="border border-bolt-elements-borderColor rounded-lg overflow-hidden">
          {oldLines.map((line, index) => (
            <div key={index} className="flex group min-w-fit">
              <div className="w-10 shrink-0 pl-2 py-0.5 text-right font-mono text-bolt-elements-textTertiary border-r border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 select-none">
                {index + 1}
              </div>
              <div className="px-2 py-0.5 whitespace-pre flex-1 text-bolt-elements-textPrimary bg-bolt-elements-background-depth-2">
                {line || ' '}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* After */}
      <div className="flex-1">
        <div className="text-xs font-medium text-bolt-elements-textSecondary mb-2 uppercase">After</div>
        <div className="border border-bolt-elements-borderColor rounded-lg overflow-hidden">
          {newLines.map((line, index) => (
            <div key={index} className="flex group min-w-fit">
              <div className="w-10 shrink-0 pl-2 py-0.5 text-right font-mono text-bolt-elements-textTertiary border-r border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 select-none">
                {index + 1}
              </div>
              <div className="px-2 py-0.5 whitespace-pre flex-1 text-bolt-elements-textPrimary bg-bolt-elements-background-depth-2">
                {line || ' '}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export default PendingChangesReview;
