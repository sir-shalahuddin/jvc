import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addActionItemApi,
  addQuestion,
  clusterCardApi,
  deleteActionItemApi,
  deleteQuestion,
  fetchActionItems,
  fetchPreviousActions,
  getVoterId,
  setPhaseApi,
  spotlightAction,
  submitAnswer,
  timerAction,
  toggleActionItemApi,
  updateQuestion,
  voteAnswer,
} from '../services/sessionApi';
import { cardPlainText } from '../lib/cardHtml';
import { fetchCurrentUser } from '../services/api';
import { copyText, resolveInviteUrl } from '../services/links';
import { useToast } from '../components/common/Toast';
import { Modal } from '../components/common/Modal';
import { ChevronRight } from 'lucide-react';
import { useBoardState } from '../components/session/useBoardState';
import { PresenceList, SessionHeader } from '../components/session/SessionHeader';
import { useTimerSeconds } from '../components/session/SessionTimer';
import { Board, type BoardView } from '../components/session/Board';
import { SpotlightBanner } from '../components/session/SpotlightBanner';
import { PreviousActions, openPromises } from '../components/session/PreviousActions';
import { ActionPanel, type ActionDraft } from '../components/session/ActionPanel';
import { SubmitCardModal } from '../components/session/modals/SubmitCardModal';
import { TopicModal } from '../components/session/modals/TopicModal';
import { ShortcutsModal } from '../components/session/modals/ShortcutsModal';
import {
  PHASE_LABEL,
  normalizePhase,
  isHidden,
  type ActionItem,
  type Answer,
  type Phase,
  type PreviousActions as Prev,
  type Question,
} from '../types/session';

// ---------- identity helpers ----------

const ALIAS_ANIMALS = ['Panda', 'Koala', 'Elang', 'Cheetah', 'Berang', 'Rubah', 'Serigala', 'Burung Hantu', 'Lumba', 'Harimau', 'Beruang', 'Kancil', 'Merak'];
const ALIAS_ADJ = ['Cepat', 'Cerdik', 'Berani', 'Tenang', 'Ceria', 'Jeli', 'Lembut', 'Sigap', 'Santai', 'Teliti', 'Riang', 'Tekun'];

function getOrCreateUserAlias(): string {
  let alias = sessionStorage.getItem('retro_user_alias_id');
  if (!alias) {
    const a = ALIAS_ANIMALS[Math.floor(Math.random() * ALIAS_ANIMALS.length)];
    const b = ALIAS_ADJ[Math.floor(Math.random() * ALIAS_ADJ.length)];
    alias = `${a} ${b}`;
    sessionStorage.setItem('retro_user_alias_id', alias);
  }
  return alias;
}

function getOrCreateClientId(): string {
  let cid = sessionStorage.getItem('retro_client_id');
  if (!cid) {
    cid = 'c_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
    sessionStorage.setItem('retro_client_id', cid);
  }
  return cid;
}

function readSessionId(): string {
  const params = new URLSearchParams(window.location.search);
  let id = params.get('id') || params.get('session_id') || '';
  if (!id) {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && parts[0] === 'session' && parts[1] !== 'index.html' && parts[1] !== 'summary') id = parts[1];
  }
  // ?role=... is ignored on purpose: owner status comes only from the server (is_owner).
  return id;
}

function useMediaQuery(q: string): boolean {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}

const ASIDE_KEY = 'retro_aside_open';
function readAside(): boolean {
  try {
    // Closed by default; opens only after the user chose to open it.
    return localStorage.getItem(ASIDE_KEY) === '1';
  } catch {
    return false;
  }
}

const VIEW_KEY = 'retro_board_view';
function readView(): BoardView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'columns' ? 'columns' : 'focus';
  } catch {
    return 'focus';
  }
}

const msg = (e: unknown, fallback: string) => (e instanceof Error && e.message) || fallback;

// ---------- page ----------

export const SessionBoardPage: React.FC = () => {
  const { showToast } = useToast();
  const sessionId = useMemo(readSessionId, []);
  const clientId = useMemo(getOrCreateClientId, []);
  const localAlias = useMemo(getOrCreateUserAlias, []);
  const isMobile = useMediaQuery('(max-width: 600px)');
  const wide = useMediaQuery('(min-width: 1200px)');
  const [actFoldOpen, setActFoldOpen] = useState(false);
  const [asideOpen, setAsideOpen] = useState(readAside);
  const toggleAside = (open: boolean) => {
    setAsideOpen(open);
    try {
      localStorage.setItem(ASIDE_KEY, open ? '1' : '0');
    } catch {
      /* private mode */
    }
  };

  const [guestName, setGuestName] = useState('');
  const alias = guestName || localAlias;
  const { data, error, offline, clockOffset, refresh } = useBoardState(sessionId, clientId, alias);

  const [myVoterId, setMyVoterId] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewPref, setViewPref] = useState<BoardView>(readView);
  const view: BoardView = isMobile ? 'focus' : viewPref;
  const changeView = (v: BoardView) => {
    setViewPref(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* private mode: keep the choice for this page only */
    }
  };
  const [clusterFilter, setClusterFilter] = useState('');
  const [phaseBusy, setPhaseBusy] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [actionsLoaded, setActionsLoaded] = useState(false);
  const [actionDraft, setActionDraft] = useState<ActionDraft | null>(null);
  const [prev, setPrev] = useState<Prev | null>(null);
  const [prevOpen, setPrevOpen] = useState(false);

  const [submitTopic, setSubmitTopic] = useState<Question | null>(null);
  const [topicModal, setTopicModal] = useState<{ open: boolean; edit: Question | null }>({ open: false, edit: null });
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [presenceOpen, setPresenceOpen] = useState(false);
  const shareUrlRef = useRef<string | null>(null);

  const session = data?.session;
  const phase: Phase = normalizePhase(session?.phase);
  const isOwner = session?.is_owner === true;
  const questions = useMemo(() => data?.questions || [], [data]);
  const answers = useMemo(() => data?.answers || [], [data]);
  const timer = data?.timer || { running: false, remaining_seconds: 300, end_time_unix_ms: 0 };
  const timerSeconds = useTimerSeconds(timer, clockOffset);
  const voter = data?.voter_status;
  const [sortTick, setSortTick] = useState(0);
  const budget = data?.vote_budget || voter?.max_votes || 0;
  const votesLeft = voter ? voter.remaining_votes : 0;
  const votedIds = useMemo(() => new Set(voter?.voted_answers || []), [voter?.voted_answers]);
  const clusterNames = useMemo(() => (data?.clusters || []).map((c) => c.tag).filter(Boolean), [data?.clusters]);

  // One-time lookups: own voter id (to recognise own cards), login (upload), previous promises.
  useEffect(() => {
    void getVoterId().then(setMyVoterId);
    fetchCurrentUser()
      .then((u) => setLoggedIn(!!u.authenticated))
      .catch(() => setLoggedIn(false));
  }, []);

  useEffect(() => {
    if (voter?.guest_name && voter.guest_name !== guestName) setGuestName(voter.guest_name);
  }, [voter?.guest_name, guestName]);

  const sessionLoaded = !!session;
  useEffect(() => {
    if (!sessionLoaded) return;
    fetchPreviousActions(sessionId)
      .then(setPrev)
      .catch(() => setPrev(null)); // optional section: no toast if it fails
  }, [sessionLoaded, sessionId]);

  // Keep the active topic in range when topics change.
  useEffect(() => {
    if (activeIndex > 0 && activeIndex >= questions.length) setActiveIndex(Math.max(0, questions.length - 1));
  }, [questions.length, activeIndex]);

  // Drop a cluster filter that no longer exists.
  useEffect(() => {
    if (clusterFilter && !clusterNames.includes(clusterFilter)) setClusterFilter('');
  }, [clusterNames, clusterFilter]);

  // Action items are not in the state response; load them while they matter.
  const showActions = phase !== 'write';
  const loadActions = useCallback(async () => {
    try {
      setActionItems(await fetchActionItems(sessionId));
      setActionsLoaded(true);
    } catch (e) {
      setActionsLoaded(true);
      throw e;
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionLoaded || !showActions) return;
    let stop = false;
    let failedOnce = false;
    const tick = async () => {
      try {
        await loadActions();
        failedOnce = false;
      } catch (e) {
        if (!failedOnce) showToast(msg(e, 'Gagal memuat aksi'), 'error');
        failedOnce = true;
      }
    };
    void tick();
    // Participants follow along read-only; owners edit and refresh on each change.
    const id = window.setInterval(() => !stop && !document.hidden && void tick(), isOwner ? 15000 : 5000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [sessionLoaded, showActions, isOwner, loadActions, showToast]);

  const markBusy = (id: string, on: boolean) =>
    setBusyIds((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  // ---------- handlers (no optimistic changes: act, then re-read the server) ----------

  const changePhase = async (p: Phase) => {
    if (!isOwner || p === phase) return;
    setPhaseBusy(true);
    try {
      await setPhaseApi(sessionId, p);
      await refresh();
      showToast(`Fase sekarang: ${PHASE_LABEL[p]}`, 'success');
    } catch (e) {
      showToast(msg(e, 'Gagal mengganti fase'), 'error');
    } finally {
      setPhaseBusy(false);
    }
  };

  const startTimer = async (seconds: number) => {
    try {
      await timerAction(sessionId, 'start', seconds);
      await refresh();
    } catch (e) {
      showToast(msg(e, 'Gagal memulai timer'), 'error');
    }
  };
  const stopTimer = async () => {
    try {
      await timerAction(sessionId, 'reset');
      await refresh();
    } catch (e) {
      showToast(msg(e, 'Gagal menghentikan timer'), 'error');
    }
  };

  const invite = async () => {
    let url = shareUrlRef.current;
    if (!url) {
      url = await resolveInviteUrl(sessionId);
      shareUrlRef.current = url;
    }
    if (await copyText(url)) showToast(`Link undangan tersalin: ${url}`, 'success');
    else showToast('Gagal menyalin link. Salin dari address bar.', 'error');
  };

  const summaryUrl = `${window.location.origin}/session/summary?id=${encodeURIComponent(sessionId)}`;
  const shareSummary = async () => {
    if (await copyText(summaryUrl)) showToast('Link ringkasan tersalin', 'success');
    else showToast('Gagal menyalin link ringkasan', 'error');
  };

  const exportPdf = () => {
    window.open(`/api/session/report?session_id=${encodeURIComponent(sessionId)}`, '_blank', 'noopener');
  };

  const submitCard = async (text: string, gifUrl: string): Promise<boolean> => {
    if (!submitTopic) return false;
    try {
      await submitAnswer({ sessionId, questionId: submitTopic.id, text, gifUrl });
    } catch (e) {
      showToast(msg(e, 'Gagal mengirim kartu'), 'error');
      return false;
    }
    showToast('Kartu terkirim', 'success');
    void refresh();
    return true;
  };

  const vote = async (a: Answer) => {
    if (votesLeft <= 0) {
      showToast('Vote kamu sudah habis', 'error');
      return;
    }
    markBusy(a.id, true);
    try {
      await voteAnswer(sessionId, a.id);
      await refresh();
    } catch (e) {
      showToast(msg(e, 'Gagal memberi vote'), 'error');
      void refresh();
    } finally {
      markBusy(a.id, false);
    }
  };

  const setCluster = async (a: Answer, tag: string): Promise<boolean> => {
    markBusy(a.id, true);
    try {
      await clusterCardApi(sessionId, a.id, tag);
      await refresh();
      return true;
    } catch (e) {
      showToast(msg(e, 'Gagal menyimpan kelompok'), 'error');
      return false;
    } finally {
      markBusy(a.id, false);
    }
  };

  const spotlight = data?.spotlight;
  const spotlightId = spotlight?.active ? spotlight.answer_id : '';
  const toggleSpotlight = async (a: Answer) => {
    markBusy(a.id, true);
    try {
      if (spotlightId === a.id) await spotlightAction({ sessionId, action: 'clear' });
      else await spotlightAction({ sessionId, action: 'focus', questionId: a.question_id, answerId: a.id });
      await refresh();
    } catch (e) {
      showToast(msg(e, 'Gagal mengubah sorotan'), 'error');
    } finally {
      markBusy(a.id, false);
    }
  };
  const clearSpotlight = async () => {
    try {
      await spotlightAction({ sessionId, action: 'clear' });
      await refresh();
    } catch (e) {
      showToast(msg(e, 'Gagal melepas sorotan'), 'error');
    }
  };

  const spotCard = useMemo(() => {
    if (!spotlightId) return null;
    const a = answers.find((x) => x.id === spotlightId);
    return a && !isHidden(a) ? a : null;
  }, [answers, spotlightId]);
  const spotTopic = spotCard ? questions.find((q) => q.id === spotCard.question_id) || null : null;

  const jumpToSpotlight = useCallback(() => {
    if (!spotCard) return;
    const qi = questions.findIndex((q) => q.id === spotCard.question_id);
    if (qi >= 0) setActiveIndex(qi);
    if (clusterFilter && spotCard.cluster_tag !== clusterFilter) setClusterFilter('');
    window.setTimeout(() => {
      const el = document.getElementById(`card-${spotCard.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        (el.querySelector('[data-face="on"]') as HTMLElement | null)?.focus({ preventScroll: true });
      }
    }, 90);
  }, [spotCard, questions, clusterFilter]);

  const saveTopic = async (text: string): Promise<boolean> => {
    const edit = topicModal.edit;
    try {
      if (edit) {
        await updateQuestion(sessionId, edit.id, text, edit.gif_url || '');
      } else {
        await addQuestion(sessionId, text);
      }
    } catch (e) {
      showToast(msg(e, 'Gagal menyimpan topik'), 'error');
      return false;
    }
    showToast(edit ? 'Topik diubah' : 'Topik ditambah', 'success');
    await refresh();
    if (!edit) setActiveIndex(questions.length); // the new topic is appended
    return true;
  };

  const removeTopic = async (q: Question) => {
    const n = q.answer_count || 0;
    const warn = n > 0 ? ` ${n} kartu di dalamnya ikut terhapus.` : '';
    if (!window.confirm(`Hapus topik "${q.text}"?${warn}`)) return;
    try {
      await deleteQuestion(sessionId, q.id);
      showToast('Topik dihapus', 'success');
      await refresh();
    } catch (e) {
      showToast(msg(e, 'Gagal menghapus topik'), 'error');
    }
  };

  const addAction = async (text: string, assignee: string, due: string, answerId?: string): Promise<boolean> => {
    try {
      await addActionItemApi({ sessionId, text, assignee, dueDate: due, answerId });
    } catch (e) {
      showToast(msg(e, 'Gagal menambah aksi'), 'error');
      return false;
    }
    try {
      await loadActions();
    } catch (_) {
      showToast('Aksi tersimpan, tetapi daftar gagal dimuat ulang', 'error');
    }
    return true;
  };
  const toggleAction = async (item: ActionItem, completed: boolean) => {
    try {
      await toggleActionItemApi(sessionId, item.id, completed);
    } catch (e) {
      showToast(msg(e, 'Gagal memperbarui aksi'), 'error');
    }
    await loadActions().catch(() => {});
  };
  const removeAction = async (item: ActionItem) => {
    try {
      await deleteActionItemApi(sessionId, item.id);
    } catch (e) {
      showToast(msg(e, 'Gagal menghapus aksi'), 'error');
    }
    await loadActions().catch(() => {});
  };
  const makeAction = (a: Answer) => {
    setActFoldOpen(true);
    setAsideOpen(true);
    setActionDraft({ text: cardPlainText(a.text), answerId: a.id, nonce: Date.now() });
  };

  // Ticking a promise from last time updates the OLD session's item.
  const togglePrev = async (item: ActionItem, completed: boolean): Promise<boolean> => {
    try {
      await toggleActionItemApi(item.session_id || prev?.session?.id || '', item.id, completed);
      setPrev((d) => (d ? { ...d, items: d.items.map((i) => (i.id === item.id ? { ...i, completed } : i)) } : d));
      return true;
    } catch (e) {
      showToast(msg(e, 'Gagal memperbarui janji'), 'error');
      return false;
    }
  };

  // ---------- keyboard ----------
  const keyState = useRef({ phase, isOwner, questions, activeIndex, timerRunning: timer.running, jumpToSpotlight });
  keyState.current = { phase, isOwner, questions, activeIndex, timerRunning: timer.running, jumpToSpotlight };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      // A dialog or menu is open: it owns the keyboard (Esc closes it).
      if (document.querySelector('.modal, .menu')) return;
      const s = keyState.current;
      const k = e.key;
      if (k === '?') {
        e.preventDefault();
        setShortcutsOpen(true);
      } else if ((k === 'c' || k === 'C') && s.phase === 'write' && s.questions[s.activeIndex]) {
        e.preventDefault();
        setSubmitTopic(s.questions[s.activeIndex]);
      } else if (k === 'ArrowLeft' && s.activeIndex > 0) {
        e.preventDefault();
        setActiveIndex(s.activeIndex - 1);
      } else if (k === 'ArrowRight' && s.activeIndex < s.questions.length - 1) {
        e.preventDefault();
        setActiveIndex(s.activeIndex + 1);
      } else if (k === 'f' || k === 'F') {
        e.preventDefault();
        s.jumpToSpotlight();
      } else if ((k === 't' || k === 'T') && s.isOwner) {
        e.preventDefault();
        void (s.timerRunning ? stopTimer() : startTimer(300));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (session?.name) document.title = `${session.name} | Retro`;
  }, [session?.name]);

  // ---------- render ----------

  if (error && (!data || error.status === 404)) {
    const notFound = error.status === 404;
    return (
      <main className="state-screen">
        <img src="/static/images/logo.svg" alt="" width={28} height={28} />
        <h1>{notFound ? 'Sesi tidak ditemukan' : 'Sesi gagal dimuat'}</h1>
        <p className="muted">
          {notFound ? 'Link mungkin salah, atau sesi sudah dihapus.' : error.message}
        </p>
        <p className="state-links">
          {!notFound && (
            <button type="button" className="link-btn" onClick={() => window.location.reload()}>
              Coba lagi
            </button>
          )}
          <a href="/dashboard">Ke dashboard</a>
        </p>
      </main>
    );
  }

  if (!data || !session) {
    return (
      <main className="state-screen" aria-busy="true">
        <p className="muted">Memuat sesi…</p>
      </main>
    );
  }

  const hint = phaseHint(phase);
  const summaryHref = `/session/summary?id=${encodeURIComponent(sessionId)}`;
  return (
    <div className="sb">
      <SessionHeader
        isMobile={isMobile}
        title={session.name || 'Sesi tanpa nama'}
        phase={phase}
        isOwner={isOwner}
        phaseBusy={phaseBusy}
        onPhase={changePhase}
        timer={timer}
        timerSeconds={timerSeconds}
        onTimerStart={startTimer}
        onTimerStop={stopTimer}
        presence={data.presence || { count: 1, participants: [] }}
        onOpenPresence={() => setPresenceOpen(true)}
        onInvite={invite}
        canExport={isOwner && phase !== 'write'}
        onExport={exportPdf}
        summaryHref={phase !== 'write' ? summaryHref : null}
        onShortcuts={() => setShortcutsOpen(true)}
        offline={offline}
      />

      <main className={`sb-main ${view === 'focus' ? 'is-focus-view' : ''}`}>
        <SpotlightBanner card={spotCard} topic={spotTopic} isOwner={isOwner} onJump={jumpToSpotlight} onClear={clearSpotlight} />

        <div className={showActions && wide ? `sb-split has-aside ${asideOpen ? '' : 'aside-closed'}` : 'sb-split'}>
          <div className="sb-board">
          <Board
            view={view}
            setView={changeView}
            isMobile={isMobile}
            questions={questions}
            answers={answers}
            phase={phase}
            isOwner={isOwner}
            myVoterId={myVoterId}
            activeIndex={Math.min(activeIndex, Math.max(0, questions.length - 1))}
            setActiveIndex={setActiveIndex}
            clusterFilter={clusterFilter}
            setClusterFilter={setClusterFilter}
            clusterCounts={phase === 'write' ? [] : (data.clusters || []).filter((c) => c.tag)}
            votedIds={votedIds}
            votesLeft={votesLeft}
            budget={budget}
            sessionId={sessionId}
            sortTick={sortTick}
            onSort={() => setSortTick((n) => n + 1)}
            spotlightId={spotlightId}
            busyIds={busyIds}
            onAddCard={(q) => setSubmitTopic(q)}
            onAddTopic={() => setTopicModal({ open: true, edit: null })}
            onEditTopic={(q) => setTopicModal({ open: true, edit: q })}
            onDeleteTopic={removeTopic}
            onVote={vote}
            onSetCluster={setCluster}
            onSpotlight={toggleSpotlight}
            onMakeAction={makeAction}
            hint={hint}
            prevOpen={openPromises(prev)}
            onOpenPrev={() => setPrevOpen(true)}
            summaryHref={phase === 'done' ? summaryHref : null}
            onShareSummary={shareSummary}
            onExport={exportPdf}
          />
          </div>
          {showActions && wide && asideOpen && (
            <aside className="sb-aside" aria-label="Aksi">
              <button type="button" className="aside-hide link-btn" onClick={() => toggleAside(false)} aria-label="Sembunyikan panel aksi" title="Sembunyikan panel aksi">
                Sembunyikan <ChevronRight size={14} aria-hidden="true" />
              </button>
              <ActionPanel
                items={actionItems}
                loaded={actionsLoaded}
                canEdit={isOwner && phase === 'discuss'}
                draft={actionDraft}
                onAdd={addAction}
                onToggle={toggleAction}
                onDelete={removeAction}
              />
            </aside>
          )}
          {showActions && wide && !asideOpen && (
            <button type="button" className="aside-tab" onClick={() => toggleAside(true)} aria-label={`Buka panel aksi, ${actionItems.length} aksi`} aria-expanded="false" title="Buka panel aksi">
              <span>Aksi ({actionItems.length})</span>
            </button>
          )}
          {showActions && !wide && (
            <section className="act-fold">
              <button
                type="button"
                className="act-fold-btn"
                aria-expanded={actFoldOpen}
                aria-controls="act-fold-body"
                onClick={() => setActFoldOpen((o) => !o)}
              >
                <span>Aksi</span>
                <span className="muted num">
                  {actionsLoaded ? `${actionItems.filter((i) => !i.completed).length} terbuka dari ${actionItems.length}` : ''}
                </span>
                <span aria-hidden="true" className="act-fold-ch">{actFoldOpen ? '−' : '+'}</span>
              </button>
              <div id="act-fold-body" hidden={!actFoldOpen}>
                <ActionPanel
              items={actionItems}
              loaded={actionsLoaded}
              canEdit={isOwner && phase === 'discuss'}
              draft={actionDraft}
              onAdd={addAction}
              onToggle={toggleAction}
              onDelete={removeAction}
            />
              </div>
            </section>
          )}
        </div>
      </main>

      <SubmitCardModal
        isOpen={!!submitTopic}
        onClose={() => setSubmitTopic(null)}
        topicTitle={submitTopic?.text || ''}
        alias={alias}
        canUpload={loggedIn}
        onSubmit={submitCard}
      />
      <TopicModal
        isOpen={topicModal.open}
        onClose={() => setTopicModal({ open: false, edit: null })}
        questionToEdit={topicModal.edit}
        onSave={saveTopic}
      />
      {prev && <PreviousActions data={prev} canEdit={isOwner} onToggle={togglePrev} isOpen={prevOpen} onClose={() => setPrevOpen(false)} />}
      <ShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} isOwner={isOwner} />
      <Modal isOpen={presenceOpen} onClose={() => setPresenceOpen(false)} title="Peserta" maxWidth="400px">
        <PresenceList presence={data.presence || { count: 1, participants: [] }} />
      </Modal>
    </div>
  );
};

function phaseHint(phase: Phase): string {
  switch (phase) {
    case 'write':
      return 'Kartu orang lain terbuka bersamaan saat fasilitator pindah ke Bahas. Klik kartumu untuk membaliknya.';
    case 'discuss':
      return 'Klik kartu untuk membaliknya. Vote, lalu bahas kartu teratas dan catat aksinya.';
    case 'done':
      return 'Sesi selesai. Papan hanya bisa dibaca.';
  }
}
