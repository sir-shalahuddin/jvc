import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { Modal } from '../../common/Modal';
import { useToast } from '../../common/Toast';

interface ClusterModalProps {
  isOpen: boolean;
  onClose: () => void;
  answerId: string | null;
  currentTag: string;
  existingClusters: string[];
  onSaveCluster: (answerId: string, tag: string) => Promise<void>;
}

export const ClusterModal: React.FC<ClusterModalProps> = ({
  isOpen,
  onClose,
  answerId,
  currentTag,
  existingClusters,
  onSaveCluster,
}) => {
  const { showToast } = useToast();
  const [tag, setTag] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setTag(currentTag || '');
  }, [currentTag, isOpen]);

  const handleSave = async (selectedTag: string) => {
    if (!answerId) return;
    try {
      setIsSaving(true);
      await onSaveCluster(answerId, selectedTag.trim());
      showToast(selectedTag ? `Card tagged as #${selectedTag}` : 'Tag removed', 'success');
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to update cluster tag', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Thematic Card Clustering" maxWidth="480px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
          Group related ideas and reflections under a common theme or tag (e.g. #deployments, #teamwork, #tooling).
        </p>

        {/* Custom Tag Input */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div className="input-icon-wrapper" style={{ flex: 1 }}>
            <span className="input-icon" style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.1rem' }}>
              #
            </span>
            <input
              type="text"
              className="form-input"
              value={tag}
              onChange={(e) => setTag(e.target.value.replace(/^#/, ''))}
              placeholder="e.g. communication"
              autoFocus
            />
          </div>
          <button
            type="button"
            onClick={() => handleSave(tag)}
            className="btn btn-primary"
            disabled={isSaving}
          >
            <Check size={16} />
            <span>Apply</span>
          </button>
        </div>

        {/* Existing Cluster Tag Suggestions */}
        {existingClusters.length > 0 && (
          <div>
            <label className="form-label" style={{ marginBottom: '0.5rem' }}>
              <span>Existing Themes in this Session:</span>
            </label>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {existingClusters.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setTag(c);
                    handleSave(c);
                  }}
                  className={`quick-chip ${c.toLowerCase() === tag.toLowerCase() ? 'selected' : ''}`}
                >
                  🏷️ #{c}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Remove Cluster Option */}
        {currentTag && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => handleSave('')}
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--danger)' }}
              disabled={isSaving}
            >
              <X size={14} />
              <span>Remove Current Tag (#{currentTag})</span>
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};
