import { memo, useState, useMemo } from 'react';
import { classNames } from '~/utils/classNames';
import { diffLines, type Change } from 'diff';

/**
 * File Diff Viewer
 *
 * Shows a side-by-side or unified diff view of file changes
 * with approve/reject functionality for safety review.
 */

export interface FileDiff {
  filePath: string;
  originalContent: string;
  newContent: string;
  isNew: boolean;
  isDeleted: boolean;
}

interface DiffViewerProps {
  diff: FileDiff;
  pendingCount?: number;
  onApprove: () => void;
  onReject: () => void;
  onApproveAll?: () => void;
  onClose: () => void;
  className?: string;
}

type ViewMode = 'unified' | 'split';

export const DiffViewer = memo(
  ({ diff, pendingCount, onApprove, onReject, onApproveAll, onClose, className }: DiffViewerProps) => {
    const [viewMode, setViewMode] = useState<ViewMode>('unified');

    const changes = useMemo(() => {
      return diffLines(diff.originalContent, diff.newContent);
    }, [diff.originalContent, diff.newContent]);

    const stats = useMemo(() => {
      let additions = 0;
      let deletions = 0;

      changes.forEach((change) => {
        if (change.added) {
          additions += change.count || 0;
        } else if (change.removed) {
          deletions += change.count || 0;
        }
      });

      return { additions, deletions };
    }, [changes]);

    return (
      <div className={classNames('diff-viewer fixed inset-0 z-50 flex items-center justify-center', className)}>
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-bolt-elements-background-depth-1 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-bolt-elements-borderColor">
            <div className="flex items-center gap-3">
              <div
                className={classNames('i-ph:file-text w-5 h-5', {
                  'text-green-500': diff.isNew,
                  'text-red-500': diff.isDeleted,
                  'text-yellow-500': !diff.isNew && !diff.isDeleted,
                })}
              />
              <div>
                <h3 className="font-medium text-bolt-elements-textPrimary">
                  {diff.isNew ? 'New File' : diff.isDeleted ? 'Delete File' : 'Modified File'}
                </h3>
                <p className="text-sm text-bolt-elements-textSecondary font-mono">{diff.filePath}</p>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('unified')}
                className={classNames('px-3 py-1 text-xs rounded', {
                  'bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text':
                    viewMode === 'unified',
                  'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary': viewMode !== 'unified',
                })}
              >
                Unified
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={classNames('px-3 py-1 text-xs rounded', {
                  'bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text':
                    viewMode === 'split',
                  'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary': viewMode !== 'split',
                })}
              >
                Split
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-4 px-4 py-2 bg-bolt-elements-background-depth-2 text-xs">
            <span className="text-green-500">+{stats.additions} additions</span>
            <span className="text-red-500">-{stats.deletions} deletions</span>
          </div>

          {/* Diff Content */}
          <div className="flex-1 overflow-auto p-2">
            {viewMode === 'unified' ? (
              <UnifiedDiff changes={changes} />
            ) : (
              <SplitDiff originalContent={diff.originalContent} newContent={diff.newContent} changes={changes} />
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between p-4 border-t border-bolt-elements-borderColor">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
            >
              Cancel
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={onReject}
                className="px-4 py-2 text-sm bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded flex items-center gap-2"
              >
                <div className="i-ph:x-circle w-4 h-4" />
                Reject
              </button>
              <button
                onClick={onApprove}
                className="px-4 py-2 text-sm bg-green-500 text-white hover:bg-green-600 rounded flex items-center gap-2"
              >
                <div className="i-ph:check-circle w-4 h-4" />
                Approve
              </button>
              {pendingCount && pendingCount > 1 && onApproveAll && (
                <button
                  onClick={onApproveAll}
                  className="px-4 py-2 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded flex items-center gap-2"
                >
                  <div className="i-ph:checks w-4 h-4" />
                  Approve All ({pendingCount})
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  },
);

DiffViewer.displayName = 'DiffViewer';

// Unified Diff View
const UnifiedDiff = memo(({ changes }: { changes: Change[] }) => {
  let lineNumber = 0;

  return (
    <div className="font-mono text-xs">
      {changes.map((change, index) => {
        const lines = change.value.split('\n').filter((line, i, arr) => !(i === arr.length - 1 && line === ''));

        return lines.map((line, lineIndex) => {
          if (!change.added && !change.removed) {
            lineNumber++;
          }

          const isAddition = !!change.added;
          const isDeletion = !!change.removed;
          const currentLineNum = isAddition || isDeletion ? '' : lineNumber;

          return (
            <div
              key={`${index}-${lineIndex}`}
              className={classNames('flex whitespace-pre', {
                'bg-green-500/10': isAddition,
                'bg-red-500/10': isDeletion,
              })}
            >
              <span className="w-12 text-right px-2 text-bolt-elements-textTertiary border-r border-bolt-elements-borderColor select-none">
                {currentLineNum}
              </span>
              <span
                className={classNames('w-4 text-center select-none', {
                  'text-green-500': isAddition,
                  'text-red-500': isDeletion,
                  'text-bolt-elements-textTertiary': !isAddition && !isDeletion,
                })}
              >
                {isAddition ? '+' : isDeletion ? '-' : ' '}
              </span>
              <span
                className={classNames('flex-1 px-2', {
                  'text-green-400': isAddition,
                  'text-red-400': isDeletion,
                  'text-bolt-elements-textPrimary': !isAddition && !isDeletion,
                })}
              >
                {line || ' '}
              </span>
            </div>
          );
        });
      })}
    </div>
  );
});

UnifiedDiff.displayName = 'UnifiedDiff';

// Split Diff View
const SplitDiff = memo(
  ({ originalContent, newContent }: { originalContent: string; newContent: string; changes: Change[] }) => {
    const originalLines = originalContent.split('\n');
    const newLines = newContent.split('\n');
    const maxLines = Math.max(originalLines.length, newLines.length);

    return (
      <div className="font-mono text-xs flex">
        {/* Original Side */}
        <div className="flex-1 border-r border-bolt-elements-borderColor">
          <div className="px-2 py-1 bg-red-500/10 text-red-500 font-medium sticky top-0">Original</div>
          {Array.from({ length: maxLines }).map((_, index) => {
            const line = originalLines[index];
            const hasLine = index < originalLines.length;
            const isRemoved = hasLine && !newLines.includes(line);

            return (
              <div
                key={`orig-${index}`}
                className={classNames('flex whitespace-pre', {
                  'bg-red-500/10': isRemoved,
                })}
              >
                <span className="w-10 text-right px-2 text-bolt-elements-textTertiary border-r border-bolt-elements-borderColor select-none">
                  {hasLine ? index + 1 : ''}
                </span>
                <span className={classNames('flex-1 px-2', { 'text-red-400': isRemoved })}>{line ?? ''}</span>
              </div>
            );
          })}
        </div>

        {/* New Side */}
        <div className="flex-1">
          <div className="px-2 py-1 bg-green-500/10 text-green-500 font-medium sticky top-0">Modified</div>
          {Array.from({ length: maxLines }).map((_, index) => {
            const line = newLines[index];
            const hasLine = index < newLines.length;
            const isAdded = hasLine && !originalLines.includes(line);

            return (
              <div
                key={`new-${index}`}
                className={classNames('flex whitespace-pre', {
                  'bg-green-500/10': isAdded,
                })}
              >
                <span className="w-10 text-right px-2 text-bolt-elements-textTertiary border-r border-bolt-elements-borderColor select-none">
                  {hasLine ? index + 1 : ''}
                </span>
                <span className={classNames('flex-1 px-2', { 'text-green-400': isAdded })}>{line ?? ''}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);

SplitDiff.displayName = 'SplitDiff';

export default DiffViewer;
