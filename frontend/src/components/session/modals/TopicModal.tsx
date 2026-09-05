import React, { useState, useEffect } from 'react';
import { Upload, X } from 'lucide-react';
import { Modal } from '../../common/Modal';
import { searchGiphy, uploadMedia } from '../../../services/sessionApi';
import { useToast } from '../../common/Toast';
import type { Question } from '../../../types/session';

interface TopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionToEdit?: Question | null;
  onSave: (text: string, gifUrl: string) => Promise<void>;
}

const QUICK_TOPIC_GIFS = [
  { label: '🎉 Celebration', query: 'celebrate team win' },
  { label: '🤔 Questioning', query: 'thinking retro question' },
  { label: '🔥 Improvements', query: 'fire work hard' },
  { label: '🚀 Goals', query: 'rocket future goal' },
];

export const TopicModal: React.FC<TopicModalProps> = ({
  isOpen,
  onClose,
  questionToEdit,
  onSave,
}) => {
  const { showToast } = useToast();
  const [text, setText] = useState('');
  const [gifUrl, setGifUrl] = useState('');
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState<Array<{ id: string; url: string; previewUrl: string }>>([]);
  const [isSearchingGifs, setIsSearchingGifs] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (questionToEdit) {
      setText(questionToEdit.text);
      setGifUrl(questionToEdit.gif_url || '');
    } else {
      setText('');
      setGifUrl('');
    }
    setGifQuery('');
    setGifResults([]);
  }, [questionToEdit, isOpen]);

  const handleSearchGifs = async (q: string) => {
    setGifQuery(q);
    if (q.trim().length < 2) {
      setGifResults([]);
      return;
    }
    try {
      setIsSearchingGifs(true);
      const results = await searchGiphy(q);
      setGifResults(results);
    } catch (_) {
    } finally {
      setIsSearchingGifs(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      showToast('Uploading cover image...', 'info');
      const url = await uploadMedia(file);
      setGifUrl(url);
      showToast('Cover image uploaded!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      showToast('Please enter a topic prompt or question', 'error');
      return;
    }

    try {
      setIsSaving(true);
      await onSave(text.trim(), gifUrl);
      showToast(questionToEdit ? 'Topic updated!' : 'New topic created!', 'success');
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to save topic', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={questionToEdit ? 'Edit Retrospective Topic' : 'Add Retrospective Topic'}
      maxWidth="560px"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem' }}>
            Topic Prompt or Question *
          </label>
          <input
            type="text"
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. What went well this sprint?"
            required
            autoFocus
          />
        </div>

        {/* Cover Media Picker */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem' }}>
            Topic Cover GIF or Image (Optional)
          </label>

          {gifUrl ? (
            <div style={{ position: 'relative', width: '100%', height: '140px', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-card)', marginBottom: '0.75rem' }}>
              <img src={gifUrl} alt="Cover preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                type="button"
                onClick={() => setGifUrl('')}
                className="btn btn-ghost btn-sm"
                style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px' }}
                title="Remove cover media"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {QUICK_TOPIC_GIFS.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    className="filter-pill"
                    onClick={() => handleSearchGifs(chip.query)}
                  >
                    <span>{chip.label}</span>
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  className="input"
                  value={gifQuery}
                  onChange={(e) => handleSearchGifs(e.target.value)}
                  placeholder="Search GIPHY for cover reaction..."
                  style={{ flex: 1, fontSize: '0.85rem' }}
                />
                <label className="btn btn-ghost" style={{ cursor: 'pointer', padding: '0.5rem 0.8rem' }} title="Upload custom file">
                  <Upload size={16} />
                  <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>
              </div>

              {isSearchingGifs && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Searching GIPHY...</div>
              )}

              {gifResults.length > 0 && (
                <div className="giphy-grid">
                  {gifResults.map((gif) => (
                    <img
                      key={gif.id}
                      src={gif.previewUrl}
                      alt="reaction"
                      className="giphy-thumbnail"
                      onClick={() => setGifUrl(gif.url)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button type="button" onClick={onClose} className="btn btn-ghost" disabled={isSaving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? 'Saving...' : questionToEdit ? 'Save Changes' : 'Create Topic'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
