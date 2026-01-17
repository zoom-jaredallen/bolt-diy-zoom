import { map, computed } from 'nanostores';
import type { PendingFileChange, PendingChangesState, PendingChangeAction } from '~/types/actions';
import { generateId } from 'ai';
import { diffLines } from 'diff';

/**
 * Pending Changes Store
 *
 * Manages file changes that require user review before being applied.
 * Provides safety and transparency for AI-generated file modifications.
 */

// Core pending changes state
export const pendingChangesStore = map<PendingChangesState>({
  changes: [],
  isReviewModalOpen: false,
  autoApprove: false,
  selectedChangeId: null,
  viewMode: 'inline',
});

// Derived states
export const pendingChangesCount = computed(
  pendingChangesStore,
  (state) => state.changes.filter((c) => c.status === 'pending').length,
);

export const hasPendingChanges = computed(pendingChangesStore, (state) =>
  state.changes.some((c) => c.status === 'pending'),
);

export const approvedChanges = computed(pendingChangesStore, (state) =>
  state.changes.filter((c) => c.status === 'approved'),
);

export const rejectedChanges = computed(pendingChangesStore, (state) =>
  state.changes.filter((c) => c.status === 'rejected'),
);

// Actions
export function addPendingChange(
  filePath: string,
  originalContent: string,
  newContent: string,
  action: PendingChangeAction,
  messageId?: string,
): PendingFileChange {
  const state = pendingChangesStore.get();

  // Calculate additions and deletions
  const changes = diffLines(originalContent, newContent);
  let additions = 0;
  let deletions = 0;

  for (const change of changes) {
    const lineCount = change.value.split('\n').length - 1;

    if (change.added) {
      additions += lineCount || 1;
    }

    if (change.removed) {
      deletions += lineCount || 1;
    }
  }

  const pendingChange: PendingFileChange = {
    id: generateId(),
    filePath,
    originalContent,
    newContent,
    action,
    status: 'pending',
    timestamp: Date.now(),
    messageId,
    additions,
    deletions,
  };

  // Check if auto-approve is enabled
  if (state.autoApprove) {
    pendingChange.status = 'approved';
  }

  // Add to changes list
  pendingChangesStore.setKey('changes', [...state.changes, pendingChange]);

  // Open review modal if not auto-approving
  if (!state.autoApprove) {
    pendingChangesStore.setKey('isReviewModalOpen', true);
    pendingChangesStore.setKey('selectedChangeId', pendingChange.id);
  }

  return pendingChange;
}

export function approveChange(changeId: string) {
  const state = pendingChangesStore.get();
  const updatedChanges = state.changes.map((change) =>
    change.id === changeId ? { ...change, status: 'approved' as const } : change,
  );
  pendingChangesStore.setKey('changes', updatedChanges);

  // Select next pending change
  const nextPending = updatedChanges.find((c) => c.status === 'pending');

  if (nextPending) {
    pendingChangesStore.setKey('selectedChangeId', nextPending.id);
  } else {
    pendingChangesStore.setKey('selectedChangeId', null);
  }
}

export function rejectChange(changeId: string) {
  const state = pendingChangesStore.get();
  const updatedChanges = state.changes.map((change) =>
    change.id === changeId ? { ...change, status: 'rejected' as const } : change,
  );
  pendingChangesStore.setKey('changes', updatedChanges);

  // Select next pending change
  const nextPending = updatedChanges.find((c) => c.status === 'pending');

  if (nextPending) {
    pendingChangesStore.setKey('selectedChangeId', nextPending.id);
  } else {
    pendingChangesStore.setKey('selectedChangeId', null);
  }
}

export function approveAll() {
  const state = pendingChangesStore.get();
  const updatedChanges = state.changes.map((change) =>
    change.status === 'pending' ? { ...change, status: 'approved' as const } : change,
  );
  pendingChangesStore.setKey('changes', updatedChanges);
  pendingChangesStore.setKey('selectedChangeId', null);
}

export function rejectAll() {
  const state = pendingChangesStore.get();
  const updatedChanges = state.changes.map((change) =>
    change.status === 'pending' ? { ...change, status: 'rejected' as const } : change,
  );
  pendingChangesStore.setKey('changes', updatedChanges);
  pendingChangesStore.setKey('selectedChangeId', null);
}

export function markAsApplied(changeId: string) {
  const state = pendingChangesStore.get();
  const updatedChanges = state.changes.map((change) =>
    change.id === changeId ? { ...change, status: 'applied' as const } : change,
  );
  pendingChangesStore.setKey('changes', updatedChanges);
}

export function removeChange(changeId: string) {
  const state = pendingChangesStore.get();
  const updatedChanges = state.changes.filter((change) => change.id !== changeId);
  pendingChangesStore.setKey('changes', updatedChanges);
}

export function clearAllChanges() {
  pendingChangesStore.setKey('changes', []);
  pendingChangesStore.setKey('selectedChangeId', null);
}

export function clearAppliedChanges() {
  const state = pendingChangesStore.get();
  const remainingChanges = state.changes.filter((change) => change.status !== 'applied');
  pendingChangesStore.setKey('changes', remainingChanges);
}

export function openReviewModal() {
  const state = pendingChangesStore.get();
  pendingChangesStore.setKey('isReviewModalOpen', true);

  // Select first pending change if none selected
  if (!state.selectedChangeId) {
    const firstPending = state.changes.find((c) => c.status === 'pending');

    if (firstPending) {
      pendingChangesStore.setKey('selectedChangeId', firstPending.id);
    }
  }
}

export function closeReviewModal() {
  pendingChangesStore.setKey('isReviewModalOpen', false);
}

export function selectChange(changeId: string | null) {
  pendingChangesStore.setKey('selectedChangeId', changeId);
}

export function setViewMode(mode: 'inline' | 'side-by-side') {
  pendingChangesStore.setKey('viewMode', mode);
}

export function toggleAutoApprove() {
  const state = pendingChangesStore.get();
  pendingChangesStore.setKey('autoApprove', !state.autoApprove);
}

export function setAutoApprove(enabled: boolean) {
  pendingChangesStore.setKey('autoApprove', enabled);
}

export function updateChangeContent(changeId: string, newContent: string) {
  const state = pendingChangesStore.get();
  const updatedChanges = state.changes.map((change) => {
    if (change.id === changeId) {
      // Recalculate diff
      const changes = diffLines(change.originalContent, newContent);
      let additions = 0;
      let deletions = 0;

      for (const diffChange of changes) {
        const lineCount = diffChange.value.split('\n').length - 1;

        if (diffChange.added) {
          additions += lineCount || 1;
        }

        if (diffChange.removed) {
          deletions += lineCount || 1;
        }
      }

      return { ...change, newContent, additions, deletions };
    }

    return change;
  });
  pendingChangesStore.setKey('changes', updatedChanges);
}

// Get a specific change by ID
export function getChange(changeId: string): PendingFileChange | undefined {
  const state = pendingChangesStore.get();

  return state.changes.find((c) => c.id === changeId);
}

// Get approved changes and clear them from the store
export function consumeApprovedChanges(): PendingFileChange[] {
  const state = pendingChangesStore.get();
  const approved = state.changes.filter((c) => c.status === 'approved');

  // Mark as applied
  const updatedChanges = state.changes.map((change) =>
    change.status === 'approved' ? { ...change, status: 'applied' as const } : change,
  );
  pendingChangesStore.setKey('changes', updatedChanges);

  return approved;
}
