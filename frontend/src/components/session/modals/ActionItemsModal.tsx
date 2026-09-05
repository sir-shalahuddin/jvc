import React, { useState } from 'react';
import {
  CheckSquare,
  Square,
  Trash2,
  Plus,
  Calendar,
  User as UserIcon,
} from 'lucide-react';
import { Modal } from '../../common/Modal';
import { useToast } from '../../common/Toast';
import { SoundFX } from '../../../services/soundEngine';
import type { ActionItem } from '../../../types/session';

interface ActionItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionItems: ActionItem[];
  onAddActionItem: (text: string, assignee?: string, dueDate?: string) => Promise<void>;
  onToggleActionItem: (id: string, completed: boolean) => Promise<void>;
  onDeleteActionItem: (id: string) => Promise<void>;
  initialText?: string;
}

export const ActionItemsModal: React.FC<ActionItemsModalProps> = ({
  isOpen,
  onClose,
  actionItems,
  onAddActionItem,
  onToggleActionItem,
  onDeleteActionItem,
  initialText = '',
}) => {
  const { showToast } = useToast();
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [newText, setNewText] = useState(initialText);
  const [newAssignee, setNewAssignee] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (initialText) {
      setNewText(initialText);
    }
  }, [initialText]);

  const filteredItems = actionItems.filter((item) => {
    if (filter === 'pending') return !item.completed;
    if (filter === 'completed') return item.completed;
    return true;
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;

    try {
      setIsSubmitting(true);
      await onAddActionItem(newText.trim(), newAssignee.trim() || undefined, newDueDate.trim() || undefined);
      setNewText('');
      setNewAssignee('');
      setNewDueDate('');
      SoundFX.playClick();
      showToast('Action item added to sprint commitments!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to add action item', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (item: ActionItem) => {
    try {
      SoundFX.playClick();
      await onToggleActionItem(item.id, !item.completed);
    } catch (err: any) {
      showToast(err.message || 'Failed to update action item', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await onDeleteActionItem(id);
      showToast('Action item removed', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete action item', 'error');
    }
  };

  const pendingCount = actionItems.filter((i) => !i.completed).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Sprint Action Items & Commitments"
      maxWidth="640px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Form to Add New Action Item */}
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="action-item-text-input">
              <span>New Commitment / Action Item</span>
              <span className="form-label-required">*</span>
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                id="action-item-text-input"
                type="text"
                className="form-input"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="What concrete action will the team take?"
                required
                style={{ flex: 1 }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting || !newText.trim()}
                style={{ padding: '0 1.25rem' }}
              >
                <Plus size={16} />
                <span>Add</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <div className="input-icon-wrapper" style={{ flex: 1, minWidth: '180px' }}>
              <UserIcon size={14} className="input-icon" />
              <input
                type="text"
                className="form-input"
                value={newAssignee}
                onChange={(e) => setNewAssignee(e.target.value)}
                placeholder="Assignee (e.g. Alex, QA Team)"
              />
            </div>

            <div className="input-icon-wrapper" style={{ width: '180px' }}>
              <Calendar size={14} className="input-icon" />
              <input
                type="date"
                className="form-input"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
              />
            </div>
          </div>
        </form>

        {/* Filter Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-card)', paddingBottom: '0.6rem' }}>
          <div className="filter-pills-group">
            <button
              type="button"
              className={`filter-pill ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({actionItems.length})
            </button>
            <button
              type="button"
              className={`filter-pill ${filter === 'pending' ? 'active' : ''}`}
              onClick={() => setFilter('pending')}
            >
              Pending ({pendingCount})
            </button>
            <button
              type="button"
              className={`filter-pill ${filter === 'completed' ? 'active' : ''}`}
              onClick={() => setFilter('completed')}
            >
              Completed ({actionItems.length - pendingCount})
            </button>
          </div>

          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            {actionItems.length > 0 ? `${Math.round(((actionItems.length - pendingCount) / actionItems.length) * 100)}% done` : ''}
          </span>
        </div>

        {/* List of Action Items */}
        <div className="action-items-list">
          {filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {actionItems.length === 0
                ? 'No action items created yet. Turn your retrospective insights into commitments!'
                : 'No items matching the selected filter.'}
            </div>
          ) : (
            filteredItems.map((item) => (
              <div key={item.id} className={`action-item-row ${item.completed ? 'completed' : ''}`}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1 }}>
                  <button
                    type="button"
                    onClick={() => handleToggle(item)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginTop: '2px', color: item.completed ? 'var(--primary)' : 'var(--text-muted)' }}
                    title={item.completed ? 'Mark pending' : 'Mark completed'}
                  >
                    {item.completed ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                      {item.text}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                      {item.assignee && (
                        <span className="badge" style={{ fontSize: '0.7rem', background: 'var(--bg-subtle)' }}>
                          👤 {item.assignee}
                        </span>
                      )}
                      {item.due_date && (
                        <span className="badge" style={{ fontSize: '0.7rem', background: 'var(--bg-subtle)', fontFamily: 'var(--font-mono)' }}>
                          📅 {item.due_date}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--danger)', padding: '0.25rem' }}
                  title="Delete action item"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
};
