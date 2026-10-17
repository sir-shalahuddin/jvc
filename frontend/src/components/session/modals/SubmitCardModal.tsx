import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '../../common/Modal';
import { searchGiphy, uploadMedia } from '../../../services/sessionApi';
import { useToast } from '../../common/Toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  topicTitle: string;
  alias: string;
  canUpload: boolean;
  onSubmit: (text: string, gifUrl: string) => Promise<boolean>;
}

const GIF_CHIPS = [
  { label: 'Kudos', query: 'kudos celebration' },
  { label: 'Mantap', query: 'fire lit' },
  { label: 'Meluncur', query: 'rocket launch' },
  { label: 'Butuh kopi', query: 'need coffee tired' },
  { label: 'Takjub', query: 'mind blown' },
  { label: 'Ups', query: 'facepalm oops' },
  { label: 'Pesta', query: 'party dance' },
];

export const SubmitCardModal: React.FC<Props> = ({ isOpen, onClose, topicTitle, alias, canUpload, onSubmit }) => {
  const { showToast } = useToast();
  const [text, setText] = useState('');
  const [gif, setGif] = useState('');
  const [gifOpen, setGifOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id: string; url: string; previewUrl: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const searchSeq = useRef(0);

  useEffect(() => {
    if (!isOpen) return;
    setGifOpen(false);
    setQuery('');
    setResults([]);
  }, [isOpen]);

  const search = async (q: string) => {
    setQuery(q);
    const seq = ++searchSeq.current;
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const r = await searchGiphy(q);
      if (seq === searchSeq.current) setResults(r);
    } catch (e: any) {
      if (seq === searchSeq.current) showToast(e.message || 'Gagal mencari GIF', 'error');
    } finally {
      if (seq === searchSeq.current) setSearching(false);
    }
  };

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      setGif(await uploadMedia(file));
    } catch (err: any) {
      showToast(err.message || 'Gagal mengunggah gambar', 'error');
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    const ok = await onSubmit(text.trim(), gif);
    setSending(false);
    if (ok) {
      setText('');
      setGif('');
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Tulis kartu: ${topicTitle}`}
      maxWidth="560px"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={sending}>
            Batal
          </button>
          <button type="button" className="btn primary" onClick={() => void submit()} disabled={sending || !text.trim()}>
            {sending ? 'Mengirim…' : 'Kirim'}
          </button>
        </>
      }
    >
      <form onSubmit={submit}>
        <textarea
          className="inp"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Tulis satu hal per kartu."
          aria-label="Isi kartu"
          maxLength={2000}
          data-autofocus
        />
        <p className="help">
          Tampil sebagai <b>{alias}</b>. Orang lain baru bisa membaca kartumu di fase berikutnya. Ctrl + Enter untuk kirim.
        </p>

        {gif && (
          <div className="gif-picked">
            <img src={gif} alt="GIF terpilih" />
            <button type="button" className="link-btn danger" onClick={() => setGif('')}>
              Hapus GIF
            </button>
          </div>
        )}

        {!gif && !gifOpen && (
          <p className="gif-toggle">
            <button type="button" className="link-btn" onClick={() => setGifOpen(true)}>
              + Tambah GIF
            </button>
          </p>
        )}

        {!gif && gifOpen && (
          <div className="gif-box">
            <div className="chips">
              {GIF_CHIPS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  className="chip"
                  aria-pressed={query === c.query}
                  onClick={() => void search(c.query)}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="gif-search">
              <input
                type="search"
                className="inp"
                value={query}
                onChange={(e) => void search(e.target.value)}
                placeholder="Cari GIF"
                aria-label="Cari GIF"
              />
              {canUpload && (
                <label className="btn" aria-disabled={uploading}>
                  {uploading ? 'Mengunggah…' : 'Unggah gambar'}
                  <input type="file" accept="image/*" onChange={upload} className="sr-only" disabled={uploading} />
                </label>
              )}
            </div>
            {searching && <p className="help">Mencari…</p>}
            {!searching && query.trim().length >= 2 && results.length === 0 && <p className="help">Tidak ada hasil.</p>}
            {results.length > 0 && (
              <div className="gif-grid">
                {results.map((g) => (
                  <button key={g.id} type="button" className="gif-opt" onClick={() => setGif(g.url)} aria-label="Pilih GIF ini">
                    <img src={g.previewUrl} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
};
