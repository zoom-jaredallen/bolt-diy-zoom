import { atom, map } from 'nanostores';
import type { FileDiff } from '~/components/workbench/DiffViewer';

/**
 * Diff Store
 *
 * Manages pending file changes for review before applying.
 * Enables the File Diff Preview safety feature.
 */

export interface DiffState {
  isEnabled: boolean;
  showDiffModal: boolean;
  autoApproveSmallChanges: boolean;
  smallChangeThreshold: number; // Lines changed to auto-approve
}

export const diffState = map<DiffState>({
  isEnabled: false, // Disabled by default - can be enabled in settings
  showDiffModal: false,
  autoApproveSmallChanges: false,
  smallChangeThreshold: 10,
});

// Queue of pending diffs waiting for review
export const pendingDiffs = atom<FileDiff[]>([]);

// Current diff being reviewed
export const currentDiff = atom<FileDiff | null>(null);

// Callbacks for approval/rejection
type DiffCallback = (approved: boolean) => void;

const pendingCallbacks = new Map<string, DiffCallback>();

/**
 * Queue a file change for review
 */
export function queueDiff(diff: FileDiff): Promise<boolean> {
  return new Promise((resolve) => {
    const state = diffState.get();

    // If diff preview is disabled, auto-approve
    if (!state.isEnabled) {
      resolve(true);

      return;
    }

    // Calculate change size
    const originalLines = diff.originalContent.split('\n').length;
    const newLines = diff.newContent.split('\n').length;
    const changeSize = Math.abs(newLines - originalLines);

    // Auto-approve small changes if enabled
    if (state.autoApproveSmallChanges && changeSize <= state.smallChangeThreshold && !diff.isDeleted) {
      resolve(true);

      return;
    }

    // Add to queue
    const currentPending = pendingDiffs.get();
    pendingDiffs.set([...currentPending, diff]);

    // Store callback
    pendingCallbacks.set(diff.filePath, resolve);

    // Show modal if not already showing
    if (!currentDiff.get()) {
      showNextDiff();
    }
  });
}

/**
 * Show the next pending diff
 */
function showNextDiff() {
  const pending = pendingDiffs.get();

  if (pending.length > 0) {
    const next = pending[0];
    currentDiff.set(next);
    diffState.setKey('showDiffModal', true);
  } else {
    currentDiff.set(null);
    diffState.setKey('showDiffModal', false);
  }
}

/**
 * Approve the current diff
 */
export function approveDiff() {
  const diff = currentDiff.get();

  if (!diff) {
    return;
  }

  // Call the callback
  const callback = pendingCallbacks.get(diff.filePath);

  if (callback) {
    callback(true);
    pendingCallbacks.delete(diff.filePath);
  }

  // Remove from pending
  const pending = pendingDiffs.get();
  pendingDiffs.set(pending.filter((d) => d.filePath !== diff.filePath));

  // Show next diff
  showNextDiff();
}

/**
 * Reject the current diff
 */
export function rejectDiff() {
  const diff = currentDiff.get();

  if (!diff) {
    return;
  }

  // Call the callback
  const callback = pendingCallbacks.get(diff.filePath);

  if (callback) {
    callback(false);
    pendingCallbacks.delete(diff.filePath);
  }

  // Remove from pending
  const pending = pendingDiffs.get();
  pendingDiffs.set(pending.filter((d) => d.filePath !== diff.filePath));

  // Show next diff
  showNextDiff();
}

/**
 * Approve all pending diffs
 */
export function approveAllDiffs() {
  const pending = pendingDiffs.get();

  pending.forEach((diff) => {
    const callback = pendingCallbacks.get(diff.filePath);

    if (callback) {
      callback(true);
      pendingCallbacks.delete(diff.filePath);
    }
  });

  pendingDiffs.set([]);
  currentDiff.set(null);
  diffState.setKey('showDiffModal', false);
}

/**
 * Reject all pending diffs
 */
export function rejectAllDiffs() {
  const pending = pendingDiffs.get();

  pending.forEach((diff) => {
    const callback = pendingCallbacks.get(diff.filePath);

    if (callback) {
      callback(false);
      pendingCallbacks.delete(diff.filePath);
    }
  });

  pendingDiffs.set([]);
  currentDiff.set(null);
  diffState.setKey('showDiffModal', false);
}

/**
 * Close the diff modal without making a decision
 */
export function closeDiffModal() {
  diffState.setKey('showDiffModal', false);
}

/**
 * Enable or disable diff preview
 */
export function setDiffPreviewEnabled(enabled: boolean) {
  diffState.setKey('isEnabled', enabled);
}

/**
 * Set auto-approve for small changes
 */
export function setAutoApproveSmallChanges(enabled: boolean, threshold?: number) {
  diffState.setKey('autoApproveSmallChanges', enabled);

  if (threshold !== undefined) {
    diffState.setKey('smallChangeThreshold', threshold);
  }
}

/**
 * Get the number of pending diffs
 */
export function getPendingDiffCount(): number {
  return pendingDiffs.get().length;
}

/**
 * Clear all pending diffs (used when chat is reset)
 */
export function clearPendingDiffs() {
  // Reject all pending to clean up callbacks
  rejectAllDiffs();
}
