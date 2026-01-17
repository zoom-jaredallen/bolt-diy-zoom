import { atom, computed } from 'nanostores';
import type { TaskProgress, TaskProgressItem } from '~/types/plan';
import { generateId } from 'ai';

/**
 * Task Progress Store
 *
 * Tracks real-time progress during AI task execution.
 * Similar to Cline's task_progress checklist feature.
 */

// Core task progress state
export const taskProgressStore = atom<TaskProgress>({
  items: [],
  lastUpdated: Date.now(),
});

// Derived states
export const hasTaskProgress = computed(taskProgressStore, (state) => state.items.length > 0);

export const completedItemsCount = computed(
  taskProgressStore,
  (state) => state.items.filter((item) => item.completed).length,
);

export const totalItemsCount = computed(taskProgressStore, (state) => state.items.length);

export const progressPercentage = computed(taskProgressStore, (state) => {
  if (state.items.length === 0) {
    return 0;
  }

  const completed = state.items.filter((item) => item.completed).length;

  return Math.round((completed / state.items.length) * 100);
});

// Actions
export function setTaskProgress(progress: TaskProgress) {
  taskProgressStore.set({
    ...progress,
    lastUpdated: Date.now(),
  });
}

export function updateTaskProgress(items: TaskProgressItem[]) {
  const current = taskProgressStore.get();
  taskProgressStore.set({
    ...current,
    items,
    lastUpdated: Date.now(),
  });
}

export function clearTaskProgress() {
  taskProgressStore.set({
    items: [],
    lastUpdated: Date.now(),
  });
}

export function markItemComplete(itemId: string) {
  const current = taskProgressStore.get();
  const updatedItems = current.items.map((item) => (item.id === itemId ? { ...item, completed: true } : item));

  taskProgressStore.set({
    ...current,
    items: updatedItems,
    lastUpdated: Date.now(),
  });
}

export function markItemIncomplete(itemId: string) {
  const current = taskProgressStore.get();
  const updatedItems = current.items.map((item) => (item.id === itemId ? { ...item, completed: false } : item));

  taskProgressStore.set({
    ...current,
    items: updatedItems,
    lastUpdated: Date.now(),
  });
}

/**
 * Parse task progress from markdown checklist format
 * Supports:
 * - [x] Completed item
 * - [ ] Pending item
 */
export function parseTaskProgressFromMarkdown(markdown: string): TaskProgressItem[] {
  const lines = markdown.split('\n');
  const items: TaskProgressItem[] = [];
  let order = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Match checkbox pattern: - [x] or - [ ]
    const checkboxMatch = trimmed.match(/^-\s+\[([ xX])\]\s+(.+)$/);

    if (checkboxMatch) {
      const completed = checkboxMatch[1].toLowerCase() === 'x';
      const title = checkboxMatch[2].trim();

      items.push({
        id: generateId(),
        title,
        completed,
        order: order++,
      });
    }
  }

  return items;
}

/**
 * Parse task progress from AI response that includes task_progress section
 */
export function parseTaskProgressFromResponse(response: string): TaskProgressItem[] | null {
  // Look for task_progress in various formats

  // Format 1: JSON block
  const jsonMatch = response.match(/```(?:json)?\s*\n?\s*\{[\s\S]*?"task_progress"[\s\S]*?\}\s*\n?```/);

  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[0].replace(/```json?\n?/g, '').replace(/```/g, ''));

      if (data.task_progress && Array.isArray(data.task_progress)) {
        return data.task_progress.map((item: any, index: number) => ({
          id: item.id || generateId(),
          title: item.title || item.text || item.name || String(item),
          completed: item.completed ?? item.done ?? false,
          order: item.order ?? index,
        }));
      }
    } catch {
      // Continue to other patterns
    }
  }

  // Format 2: Markdown checklist after "task_progress" header/label
  const taskProgressSection = response.match(
    /(?:task_progress|Task Progress|# Progress|## Progress)[\s:]*\n((?:- \[[ xX]\].+\n?)+)/i,
  );

  if (taskProgressSection) {
    return parseTaskProgressFromMarkdown(taskProgressSection[1]);
  }

  // Format 3: Any markdown checklist in the response
  const checklistMatch = response.match(/((?:- \[[ xX]\].+\n?){2,})/);

  if (checklistMatch) {
    return parseTaskProgressFromMarkdown(checklistMatch[1]);
  }

  return null;
}

/**
 * Update task progress from streaming response
 */
export function updateTaskProgressFromStream(chunk: string) {
  const items = parseTaskProgressFromResponse(chunk);

  if (items && items.length > 0) {
    updateTaskProgress(items);
  }
}
