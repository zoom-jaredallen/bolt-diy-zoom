import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { classNames } from '~/utils/classNames';
import {
  customPromptsStore,
  createCustomPrompt,
  updateCustomPrompt,
  deleteCustomPrompt,
  duplicateCustomPrompt,
  type CustomPrompt,
  type PromptSections,
  PROMPT_SECTION_META,
} from '~/lib/stores/customPrompts';
import { PromptLibrary } from '~/lib/common/prompt-library';
import { getAllDefaultSections } from '~/lib/common/prompts/sections';
import { TEMPLATE_VARIABLES } from '~/lib/common/prompts/template-processor';
import { useSettings } from '~/lib/hooks/useSettings';

type ViewMode = 'list' | 'edit' | 'create';
type PromptType = 'full' | 'override';

interface EditingPrompt {
  id?: string;
  name: string;
  description: string;
  type: PromptType;
  content: string;
  sections: PromptSections;
  basePromptId: string;
}

const defaultEditingPrompt: EditingPrompt = {
  name: '',
  description: '',
  type: 'full',
  content: '',
  sections: {},
  basePromptId: 'default',
};

export default function PromptsTab() {
  const customPrompts = useStore(customPromptsStore);
  const { promptId, setPromptId } = useSettings();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingPrompt, setEditingPrompt] = useState<EditingPrompt>(defaultEditingPrompt);
  const [showPreview, setShowPreview] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const builtInPrompts = useMemo(() => PromptLibrary.getBuiltInList(), []);
  const customPromptsList = useMemo(() => Object.values(customPrompts), [customPrompts]);
  const defaultSections = useMemo(() => getAllDefaultSections(), []);

  const handleCreateNew = useCallback(() => {
    setEditingPrompt(defaultEditingPrompt);
    setViewMode('create');
    setExpandedSections(new Set());
  }, []);

  const handleEdit = useCallback((prompt: CustomPrompt) => {
    setEditingPrompt({
      id: prompt.id,
      name: prompt.name,
      description: prompt.description,
      type: prompt.type,
      content: prompt.content || '',
      sections: prompt.sections || {},
      basePromptId: prompt.basePromptId || 'default',
    });
    setViewMode('edit');
    setExpandedSections(new Set(Object.keys(prompt.sections || {})));
  }, []);

  const handleDuplicate = useCallback((prompt: CustomPrompt) => {
    const newPrompt = duplicateCustomPrompt(prompt.id);

    if (newPrompt) {
      toast.success(`Duplicated prompt: ${newPrompt.name}`);
    } else {
      toast.error('Failed to duplicate prompt');
    }
  }, []);

  const handleDelete = useCallback(
    (prompt: CustomPrompt) => {
      if (confirm(`Are you sure you want to delete "${prompt.name}"?`)) {
        const success = deleteCustomPrompt(prompt.id);

        if (success) {
          toast.success(`Deleted prompt: ${prompt.name}`);

          if (promptId === prompt.id) {
            setPromptId('default');
          }
        } else {
          toast.error('Failed to delete prompt');
        }
      }
    },
    [promptId, setPromptId],
  );

  const handleSave = useCallback(() => {
    if (!editingPrompt.name.trim()) {
      toast.error('Please enter a prompt name');
      return;
    }

    if (editingPrompt.type === 'full' && !editingPrompt.content.trim()) {
      toast.error('Please enter prompt content');
      return;
    }

    const promptData = {
      name: editingPrompt.name.trim(),
      description: editingPrompt.description.trim(),
      type: editingPrompt.type,
      content: editingPrompt.type === 'full' ? editingPrompt.content : '',
      sections: editingPrompt.type === 'override' ? editingPrompt.sections : undefined,
      basePromptId: editingPrompt.type === 'override' ? editingPrompt.basePromptId : undefined,
    };

    if (viewMode === 'edit' && editingPrompt.id) {
      const updated = updateCustomPrompt(editingPrompt.id, promptData);

      if (updated) {
        toast.success('Prompt updated successfully');
        setViewMode('list');
      } else {
        toast.error('Failed to update prompt');
      }
    } else {
      const created = createCustomPrompt(promptData);
      toast.success(`Created prompt: ${created.name}`);
      setViewMode('list');
    }
  }, [editingPrompt, viewMode]);

  const handleCancel = useCallback(() => {
    setViewMode('list');
    setEditingPrompt(defaultEditingPrompt);
    setExpandedSections(new Set());
  }, []);

  const toggleSection = useCallback(
    (sectionKey: string) => {
      setExpandedSections((prev) => {
        const next = new Set(prev);

        if (next.has(sectionKey)) {
          next.delete(sectionKey);
          setEditingPrompt((p) => {
            const newSections = { ...p.sections };
            delete newSections[sectionKey as keyof PromptSections];

            return { ...p, sections: newSections };
          });
        } else {
          next.add(sectionKey);
          setEditingPrompt((p) => ({
            ...p,
            sections: {
              ...p.sections,
              [sectionKey]: defaultSections[sectionKey as keyof typeof defaultSections] || '',
            },
          }));
        }

        return next;
      });
    },
    [defaultSections],
  );

  const handleSelectPrompt = useCallback(
    (id: string) => {
      setPromptId(id);
      toast.success('Prompt selected');
    },
    [setPromptId],
  );

  if (viewMode === 'list') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-bolt-elements-textPrimary">Prompt Library</h3>
            <p className="text-sm text-bolt-elements-textSecondary mt-1">
              Manage system prompts for AI-assisted coding
            </p>
          </div>
          <button
            onClick={handleCreateNew}
            className={classNames(
              'flex items-center gap-2 px-4 py-2 rounded-lg',
              'bg-purple-500 hover:bg-purple-600 text-white',
              'transition-colors duration-200',
            )}
          >
            <div className="i-ph:plus-bold w-4 h-4" />
            Create Custom Prompt
          </button>
        </div>

        <motion.div className="space-y-3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h4 className="text-sm font-medium text-bolt-elements-textSecondary flex items-center gap-2">
            <div className="i-ph:package w-4 h-4" />
            Built-in Prompts
          </h4>
          <div className="grid gap-3">
            {builtInPrompts.map((prompt) => (
              <div
                key={prompt.id}
                className={classNames(
                  'p-4 rounded-lg border transition-all duration-200',
                  promptId === prompt.id
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 hover:border-purple-500/50',
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-bolt-elements-textPrimary">{prompt.label}</span>
                      {promptId === prompt.id && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-400">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-bolt-elements-textSecondary mt-1">{prompt.description}</p>
                  </div>
                  <button
                    onClick={() => handleSelectPrompt(prompt.id)}
                    disabled={promptId === prompt.id}
                    className={classNames(
                      'px-3 py-1.5 text-sm rounded-lg transition-colors',
                      promptId === prompt.id
                        ? 'bg-purple-500/20 text-purple-400 cursor-default'
                        : 'bg-bolt-elements-background-depth-3 hover:bg-purple-500/20 text-bolt-elements-textSecondary hover:text-purple-400',
                    )}
                  >
                    {promptId === prompt.id ? 'Selected' : 'Select'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="space-y-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h4 className="text-sm font-medium text-bolt-elements-textSecondary flex items-center gap-2">
            <div className="i-ph:pencil-simple w-4 h-4" />
            Custom Prompts
            {customPromptsList.length > 0 && (
              <span className="text-xs text-bolt-elements-textTertiary">({customPromptsList.length})</span>
            )}
          </h4>

          {customPromptsList.length === 0 ? (
            <div className="p-8 text-center rounded-lg border border-dashed border-bolt-elements-borderColor">
              <div className="i-ph:note-pencil w-12 h-12 mx-auto text-bolt-elements-textTertiary mb-3" />
              <p className="text-bolt-elements-textSecondary">No custom prompts yet</p>
              <p className="text-sm text-bolt-elements-textTertiary mt-1">
                Create a custom prompt to personalize the AI behavior
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {customPromptsList.map((prompt) => (
                <div
                  key={prompt.id}
                  className={classNames(
                    'p-4 rounded-lg border transition-all duration-200',
                    promptId === prompt.id
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 hover:border-purple-500/50',
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-bolt-elements-textPrimary">{prompt.name}</span>
                        <span
                          className={classNames(
                            'px-2 py-0.5 text-xs rounded-full',
                            prompt.type === 'full' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400',
                          )}
                        >
                          {prompt.type === 'full' ? 'Full' : 'Override'}
                        </span>
                        {promptId === prompt.id && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-400">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-bolt-elements-textSecondary mt-1">
                        {prompt.description || 'No description'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(prompt)}
                        className="p-2 rounded-lg hover:bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
                        title="Edit"
                      >
                        <div className="i-ph:pencil w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDuplicate(prompt)}
                        className="p-2 rounded-lg hover:bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
                        title="Duplicate"
                      >
                        <div className="i-ph:copy w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(prompt)}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-bolt-elements-textSecondary hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <div className="i-ph:trash w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleSelectPrompt(prompt.id)}
                        disabled={promptId === prompt.id}
                        className={classNames(
                          'px-3 py-1.5 text-sm rounded-lg transition-colors',
                          promptId === prompt.id
                            ? 'bg-purple-500/20 text-purple-400 cursor-default'
                            : 'bg-bolt-elements-background-depth-3 hover:bg-purple-500/20 text-bolt-elements-textSecondary hover:text-purple-400',
                        )}
                      >
                        {promptId === prompt.id ? 'Selected' : 'Select'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div
          className="space-y-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h4 className="text-sm font-medium text-bolt-elements-textSecondary flex items-center gap-2">
            <div className="i-ph:code w-4 h-4" />
            Template Variables Reference
          </h4>
          <div className="p-4 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2">
            <p className="text-sm text-bolt-elements-textSecondary mb-3">
              Use these variables in your custom prompts. They will be replaced with actual values at runtime.
            </p>
            <div className="grid gap-2 text-sm">
              {Object.entries(TEMPLATE_VARIABLES).map(([variable, info]) => (
                <div key={variable} className="flex items-start gap-3">
                  <code className="px-2 py-0.5 rounded bg-bolt-elements-background-depth-3 text-purple-400 font-mono text-xs">
                    {variable}
                  </code>
                  <span className="text-bolt-elements-textSecondary flex-1">{info.description}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleCancel}
            className="p-2 rounded-lg hover:bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
          >
            <div className="i-ph:arrow-left w-5 h-5" />
          </button>
          <div>
            <h3 className="text-lg font-medium text-bolt-elements-textPrimary">
              {viewMode === 'create' ? 'Create Custom Prompt' : 'Edit Prompt'}
            </h3>
            <p className="text-sm text-bolt-elements-textSecondary">
              {viewMode === 'create' ? 'Create a new custom prompt' : `Editing: ${editingPrompt.name}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={classNames(
              'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
              showPreview
                ? 'bg-purple-500/20 text-purple-400'
                : 'bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
            )}
          >
            <div className="i-ph:eye w-4 h-4" />
            Preview
          </button>
          <button
            onClick={handleCancel}
            className="px-4 py-2 rounded-lg bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white transition-colors"
          >
            <div className="i-ph:check-bold w-4 h-4" />
            Save
          </button>
        </div>
      </div>

      <div className={classNames('grid gap-6', showPreview ? 'grid-cols-2' : 'grid-cols-1')}>
        <div className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-bolt-elements-textSecondary mb-1">Name</label>
              <input
                type="text"
                value={editingPrompt.name}
                onChange={(e) => setEditingPrompt((p) => ({ ...p, name: e.target.value }))}
                placeholder="My Custom Prompt"
                className={classNames(
                  'w-full px-3 py-2 rounded-lg text-sm',
                  'bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor',
                  'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                  'focus:outline-none focus:ring-2 focus:ring-purple-500/30',
                )}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-bolt-elements-textSecondary mb-1">Description</label>
              <input
                type="text"
                value={editingPrompt.description}
                onChange={(e) => setEditingPrompt((p) => ({ ...p, description: e.target.value }))}
                placeholder="A brief description of this prompt"
                className={classNames(
                  'w-full px-3 py-2 rounded-lg text-sm',
                  'bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor',
                  'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                  'focus:outline-none focus:ring-2 focus:ring-purple-500/30',
                )}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-bolt-elements-textSecondary mb-2">Prompt Type</label>
            <div className="flex gap-3">
              <button
                onClick={() => setEditingPrompt((p) => ({ ...p, type: 'full' }))}
                className={classNames(
                  'flex-1 p-3 rounded-lg border transition-all',
                  editingPrompt.type === 'full'
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-bolt-elements-borderColor hover:border-purple-500/50',
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="i-ph:file-text w-4 h-4 text-purple-400" />
                  <span className="font-medium text-bolt-elements-textPrimary">Full Prompt</span>
                </div>
                <p className="text-xs text-bolt-elements-textSecondary">Replace the entire system prompt</p>
              </button>
              <button
                onClick={() => setEditingPrompt((p) => ({ ...p, type: 'override' }))}
                className={classNames(
                  'flex-1 p-3 rounded-lg border transition-all',
                  editingPrompt.type === 'override'
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-bolt-elements-borderColor hover:border-purple-500/50',
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="i-ph:puzzle-piece w-4 h-4 text-green-400" />
                  <span className="font-medium text-bolt-elements-textPrimary">Section Override</span>
                </div>
                <p className="text-xs text-bolt-elements-textSecondary">Override specific sections only</p>
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {editingPrompt.type === 'full' ? (
              <motion.div
                key="full"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <label className="block text-sm font-medium text-bolt-elements-textSecondary mb-1">
                  Prompt Content
                </label>
                <textarea
                  value={editingPrompt.content}
                  onChange={(e) => setEditingPrompt((p) => ({ ...p, content: e.target.value }))}
                  placeholder="Enter your full system prompt here..."
                  rows={20}
                  className={classNames(
                    'w-full px-3 py-2 rounded-lg text-sm font-mono',
                    'bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor',
                    'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                    'focus:outline-none focus:ring-2 focus:ring-purple-500/30',
                    'resize-y',
                  )}
                />
              </motion.div>
            ) : (
              <motion.div
                key="override"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                <label className="block text-sm font-medium text-bolt-elements-textSecondary">
                  Select Sections to Override
                </label>
                <div className="space-y-2">
                  {Object.entries(PROMPT_SECTION_META).map(([key, meta]) => {
                    const isExpanded = expandedSections.has(key);
                    const sectionKey = key as keyof PromptSections;

                    return (
                      <div
                        key={key}
                        className={classNames(
                          'rounded-lg border transition-all',
                          isExpanded ? 'border-purple-500/50 bg-purple-500/5' : 'border-bolt-elements-borderColor',
                        )}
                      >
                        <button
                          onClick={() => toggleSection(key)}
                          className="w-full p-3 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={classNames(
                                'w-5 h-5 rounded border flex items-center justify-center transition-colors',
                                isExpanded ? 'bg-purple-500 border-purple-500' : 'border-bolt-elements-borderColor',
                              )}
                            >
                              {isExpanded && <div className="i-ph:check-bold w-3 h-3 text-white" />}
                            </div>
                            <div className="text-left">
                              <div className="font-medium text-bolt-elements-textPrimary">{meta.label}</div>
                              <div className="text-xs text-bolt-elements-textSecondary">{meta.description}</div>
                            </div>
                          </div>
                          <div
                            className={classNames(
                              'i-ph:caret-down w-4 h-4 text-bolt-elements-textSecondary transition-transform',
                              isExpanded && 'rotate-180',
                            )}
                          />
                        </button>
                        {isExpanded && (
                          <div className="px-3 pb-3">
                            <textarea
                              value={editingPrompt.sections[sectionKey] || ''}
                              onChange={(e) =>
                                setEditingPrompt((p) => ({
                                  ...p,
                                  sections: { ...p.sections, [key]: e.target.value },
                                }))
                              }
                              rows={10}
                              className={classNames(
                                'w-full px-3 py-2 rounded-lg text-sm font-mono',
                                'bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor',
                                'text-bolt-elements-textPrimary',
                                'focus:outline-none focus:ring-2 focus:ring-purple-500/30',
                                'resize-y',
                              )}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {showPreview && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-bolt-elements-textSecondary">Preview</label>
            <div
              className={classNames(
                'p-4 rounded-lg h-[600px] overflow-auto',
                'bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor',
              )}
            >
              <pre className="text-xs font-mono text-bolt-elements-textSecondary whitespace-pre-wrap">
                {editingPrompt.type === 'full'
                  ? editingPrompt.content || 'Enter prompt content to see preview...'
                  : Object.entries(editingPrompt.sections)
                      .map(
                        ([key, value]) =>
                          `[${PROMPT_SECTION_META[key as keyof typeof PROMPT_SECTION_META]?.label || key}]\n${value}`,
                      )
                      .join('\n\n') || 'Select sections to override...'}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
