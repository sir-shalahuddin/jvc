import React, { useState } from 'react';
import { Sparkles, Upload, Send, X } from 'lucide-react';
import { Modal } from '../../common/Modal';
import { searchGiphy, uploadMedia } from '../../../services/sessionApi';
import { useToast } from '../../common/Toast';

interface SubmitCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicTitle: string;
  onSubmit: (text: string, gifUrl?: string) => Promise<void>;
  assignedAlias: string;
}

const QUICK_GIF_CHIPS = [
  { label: '👏 Kudos', query: 'kudos celebration' },
  { label: '🔥 Lit', query: 'fire lit' },
  { label: '🚀 Rocket', query: 'rocket launch' },
  { label: '☕ Coffee', query: 'need coffee tired' },
  { label: '🤯 Mindblown', query: 'mind blown' },
  { label: '🤦 Oops', query: 'facepalm oops' },
  { label: '🎉 Party', query: 'party dance' },
];

export const SubmitCardModal: React.FC<SubmitCardModalProps> = ({
  isOpen,
  onClose,
  topicTitle,
  onSubmit,
  assignedAlias,
}) => {
  const { showToast } = useToast();
  const [text, setText] = useState('');
  const [selectedGif, setSelectedGif] = useState('');
  const [gifSearchQuery, setGifSearchQuery] = useState('');
  const [gifResults, setGifResults] = useState<Array<{ id: string; url: string; previewUrl: string }>>([]);
  const [isSearchingGifs, setIsSearchingGifs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSearchGifs = async (q: string) => {
    setGifSearchQuery(q);
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
      showToast('Uploading media...', 'info');
      const url = await uploadMedia(file);
      setSelectedGif(url);
      showToast('Media uploaded!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to upload image', 'error');
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (text.trim().length < 2) {
      showToast('Please type your reflection before posting', 'error');
      return;
    }
    try {
      setIsSubmitting(true);
      await onSubmit(text.trim(), selectedGif);
      setText('');
      setSelectedGif('');
      setGifResults([]);
      setGifSearchQuery('');
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to post reflection', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Post Feedback: ${topicTitle}`}
      maxWidth="640px"
      footer={
        <>
          <button onClick={onClose} className="btn btn-secondary" disabled={isSubmitting}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="btn btn-primary"
            disabled={isSubmitting || text.trim().length < 2}
          >
            <Send size={14} />
            <span>{isSubmitting ? 'Posting...' : 'Post to Board'}</span>
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Anonymous Alias Badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            POSTING ANONYMOUSLY AS:
          </span>
          <span className="badge badge-primary">🎭 {assignedAlias || 'Anonymous Guest'}</span>
        </div>

        {/* Reflection Content Textarea */}
        <div className="form-group">
          <label className="form-label" htmlFor="reflection-textarea">
            <span>Your Reflection</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {text.length} chars
            </span>
          </label>
          <textarea
            id="reflection-textarea"
            className="form-input"
            rows={4}
            placeholder="Share your honest reflection, observations, or ideas for the team..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
            required
          />
          <div className="form-hint">
            <span>Be candid and constructive. Your alias keeps your feedback anonymous.</span>
          </div>
        </div>

        {/* Attached GIF / Image Preview */}
        {selectedGif && (
          <div className="card-attached-preview">
            <img
              src={selectedGif}
              alt="Selected GIF"
              style={{ width: '100%', height: '140px', objectFit: 'contain', background: '#000' }}
            />
            <button
              type="button"
              onClick={() => setSelectedGif('')}
              className="btn btn-danger btn-sm"
              style={{ position: 'absolute', top: '8px', right: '8px', padding: '4px 8px' }}
              title="Remove GIF"
            >
              <X size={14} />
              <span>Remove</span>
            </button>
          </div>
        )}

        {/* Reaction GIPHY Picker Container */}
        <div className="form-media-picker">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
            <span className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sparkles size={14} color="var(--primary)" />
              <span>Attach Reaction GIF / Meme</span>
            </span>
            <label
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <Upload size={13} />
              <span>Upload Image</span>
              <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
          </div>

          {/* Quick Preset Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {QUICK_GIF_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                className={`quick-chip ${gifSearchQuery === chip.query ? 'selected' : ''}`}
                onClick={() => handleSearchGifs(chip.query)}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <input
            type="search"
            className="form-input"
            placeholder="Search memes & reaction GIFs on Giphy..."
            value={gifSearchQuery}
            onChange={(e) => handleSearchGifs(e.target.value)}
          />

          {/* Giphy Results Grid */}
          {isSearchingGifs ? (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Searching GIPHY...</span>
          ) : gifResults.length > 0 ? (
            <div className="giphy-grid">
              {gifResults.map((gif) => (
                <img
                  key={gif.id}
                  src={gif.previewUrl}
                  alt="GIF"
                  className={`giphy-thumbnail ${selectedGif === gif.url ? 'selected' : ''}`}
                  onClick={() => setSelectedGif(gif.url)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </form>
    </Modal>
  );
};
