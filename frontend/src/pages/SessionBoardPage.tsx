import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  SessionDetail,
  Question,
  Answer,
  ActionItem,
  PresenceUser,
  TimerState,
  SpotlightState,
  VoterStatus,
  SortMode,
  MoodFilter,
} from '../types/session';
import {
  fetchSessionDetails,
  fetchQuestions,
  fetchAnswers,
  submitAnswer,
  voteAnswer,
  fetchVoterStatus,
  fetchTimer,
  timerAction,
  fetchSpotlight,
  spotlightAction,
  syncPresenceApi,
  leavePresenceApi,
  fetchActionItems,
  addActionItemApi,
  toggleActionItemApi,
  deleteActionItemApi,
  clusterCardApi,
  fetchSessionClusters,
  addQuestion,
  updateQuestion,
  deleteQuestion,
} from '../services/sessionApi';
import { SoundFX } from '../services/soundEngine';
import { getRetroEmoticonData } from '../services/sentimentEngine';
import { useToast } from '../components/common/Toast';
import { SessionTopbar } from '../components/session/SessionTopbar';
import { SpotlightBanner } from '../components/session/SpotlightBanner';
import { QuestionHeader } from '../components/session/QuestionHeader';
import { AnswersGrid } from '../components/session/AnswersGrid';
import { TopicNavigation } from '../components/session/TopicNavigation';
import { SubmitCardModal } from '../components/session/modals/SubmitCardModal';
import { TopicModal } from '../components/session/modals/TopicModal';
import { ActionItemsModal } from '../components/session/modals/ActionItemsModal';
import { ShortcutsModal } from '../components/session/modals/ShortcutsModal';
import { ClusterModal } from '../components/session/modals/ClusterModal';

const ALIAS_ANIMALS = [
  'Panda', 'Koala', 'Falcon', 'Cheetah', 'Otter', 'Badger',
  'Fox', 'Wolf', 'Owl', 'Dolphin', 'Tiger', 'Bear', 'Eagle'
];
const ALIAS_ADJECTIVES = [
  'Swift', 'Clever', 'Brave', 'Quiet', 'Cosmic', 'Hyper',
  'Gentle', 'Wired', 'Noble', 'Retro', 'Epic', 'Zen'
];

function getOrCreateUserAlias(): string {
  let alias = sessionStorage.getItem('retro_user_alias');
  if (!alias) {
    const adj = ALIAS_ADJECTIVES[Math.floor(Math.random() * ALIAS_ADJECTIVES.length)];
    const animal = ALIAS_ANIMALS[Math.floor(Math.random() * ALIAS_ANIMALS.length)];
    alias = `${adj} ${animal}`;
    sessionStorage.setItem('retro_user_alias', alias);
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

export const SessionBoardPage: React.FC = () => {
  const { showToast } = useToast();

  // URL Parameters
  const { sessionId, urlRole } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    let id = params.get('id') || params.get('session_id') || '';
    if (!id) {
      const parts = window.location.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && parts[0] === 'session' && parts[1] !== 'index.html') {
        id = parts[1];
      }
    }
    const role = params.get('role') || 'guest';
    return { sessionId: id, urlRole: role };
  }, []);

  // Client Identity
  const clientId = useMemo(() => getOrCreateClientId(), []);
  const userAlias = useMemo(() => getOrCreateUserAlias(), []);

  // Core Data State
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeTopicIndex, setActiveTopicIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [clusters, setClusters] = useState<string[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [voterStatus, setVoterStatus] = useState<VoterStatus>({
    voter_id: clientId,
    total_votes: 0,
    remaining_votes: 5,
    voted_answers: [],
  });

  // Real-time Presence & Sync State
  const [participants, setParticipants] = useState<PresenceUser[]>([]);
  const [presenceCount, setPresenceCount] = useState(1);
  const [timer, setTimer] = useState<TimerState>({ running: false, end_time_unix_ms: 0, remaining_seconds: 300 });
  const [spotlight, setSpotlight] = useState<SpotlightState>({ active: false, question_id: '', answer_id: '', updated_at_ms: 0 });

  // View Filtering & Sorting State
  const [sortMode, setSortMode] = useState<SortMode>('votes');
  const [moodFilter, setMoodFilter] = useState<MoodFilter>('all');
  const [selectedCluster, setSelectedCluster] = useState('all');

  // Modals Visibility
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isActionItemsModalOpen, setIsActionItemsModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isClusterModalOpen, setIsClusterModalOpen] = useState(false);
  const [clusteringAnswerId, setClusteringAnswerId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determine Moderator Role
  const isModerator = useMemo(() => {
    return urlRole === 'sm' || session?.is_owner === true;
  }, [urlRole, session]);

  const activeQuestion = questions[activeTopicIndex] || null;

  // Jump to focus helper
  const handleJumpToFocus = useCallback(() => {
    if (!spotlight.active) return;
    if (spotlight.question_id && activeQuestion && spotlight.question_id !== activeQuestion.id) {
      const qIndex = questions.findIndex((q) => q.id === spotlight.question_id);
      if (qIndex !== -1) setActiveTopicIndex(qIndex);
    }
    if (spotlight.answer_id) {
      setTimeout(() => {
        const el = document.getElementById(`card-${spotlight.answer_id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('spotlight-pulse');
          setTimeout(() => el.classList.remove('spotlight-pulse'), 2500);
        }
      }, 200);
    }
  }, [spotlight, activeQuestion, questions]);

  // Initial Data Load
  useEffect(() => {
    if (!sessionId) {
      setError('Invalid session link: Missing session ID');
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function initSession() {
      try {
        setIsLoading(true);
        const [sessionData, qList, voterData, timerData, spotData, clusterList] = await Promise.all([
          fetchSessionDetails(sessionId, urlRole),
          fetchQuestions(sessionId),
          fetchVoterStatus(sessionId),
          fetchTimer(sessionId),
          fetchSpotlight(sessionId),
          fetchSessionClusters(sessionId),
        ]);

        if (!isMounted) return;
        setSession(sessionData);
        setQuestions(qList);
        setVoterStatus(voterData);
        setTimer(timerData);
        setSpotlight(spotData);
        setClusters(clusterList);

        if (qList.length > 0) {
          const ans = await fetchAnswers(sessionId, qList[0].id);
          if (isMounted) setAnswers(ans);
        }

        // Sync initial presence
        const pres = await syncPresenceApi({
          sessionId,
          clientId,
          name: userAlias,
          role: urlRole === 'sm' || sessionData.is_owner ? 'moderator' : 'participant',
        });
        if (isMounted) {
          setParticipants(pres.participants || []);
          setPresenceCount(pres.count || 1);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to load session');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    initSession();

    return () => {
      isMounted = false;
      leavePresenceApi(sessionId, clientId);
    };
  }, [sessionId, urlRole, clientId, userAlias]);

  // When active topic changes, load its answers
  useEffect(() => {
    if (!activeQuestion) {
      setAnswers([]);
      return;
    }

    let isMounted = true;
    fetchAnswers(sessionId, activeQuestion.id).then((ans) => {
      if (isMounted) setAnswers(ans);
    });

    return () => {
      isMounted = false;
    };
  }, [activeQuestion?.id]);

  // Local Timer Countdown Interval (Every 1000ms)
  useEffect(() => {
    if (!timer.running) return;

    const interval = setInterval(() => {
      setTimer((prev) => {
        if (!prev.running) return prev;
        const nextSec = prev.remaining_seconds - 1;

        if (nextSec <= 0) {
          SoundFX.playAlarm();
          showToast('⏰ Time is up for this retrospective topic!', 'info');
          return { ...prev, running: false, remaining_seconds: 0 };
        }

        if (nextSec <= 10) {
          SoundFX.playTick();
        }

        return { ...prev, remaining_seconds: nextSec };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timer.running, showToast]);

  // Periodic Background Polling (Every 3 seconds)
  useEffect(() => {
    if (!sessionId || !session) return;

    const interval = setInterval(async () => {
      try {
        // Poll Presence
        const pres = await syncPresenceApi({
          sessionId,
          clientId,
          name: userAlias,
          role: isModerator ? 'moderator' : 'participant',
        });
        setParticipants(pres.participants || []);
        setPresenceCount(pres.count || 1);

        // Poll Timer
        const serverTimer = await fetchTimer(sessionId);
        setTimer(serverTimer);

        // Poll Spotlight
        const spot = await fetchSpotlight(sessionId);
        setSpotlight(spot);

        // Poll Answers for Active Question
        if (activeQuestion) {
          const freshAnswers = await fetchAnswers(sessionId, activeQuestion.id);
          setAnswers(freshAnswers);
        }

        // Poll Clusters
        const freshClusters = await fetchSessionClusters(sessionId);
        setClusters(freshClusters);
      } catch (_) {
        // Silent recovery on temporary connection blips
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [sessionId, session, clientId, userAlias, isModerator, activeQuestion]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in form controls
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setIsSubmitModalOpen(true);
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        setIsActionItemsModalOpen((prev) => !prev);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleJumpToFocus();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (activeTopicIndex > 0) setActiveTopicIndex((i) => i - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (activeTopicIndex < questions.length - 1) setActiveTopicIndex((i) => i + 1);
      } else if (e.key === 't' || e.key === 'T') {
        if (isModerator) {
          e.preventDefault();
          if (timer.running) {
            timerAction(sessionId, 'reset');
          } else {
            timerAction(sessionId, 'start', timer.remaining_seconds || 300);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeTopicIndex,
    questions.length,
    isModerator,
    timer.running,
    timer.remaining_seconds,
    sessionId,
    handleJumpToFocus,
  ]);

  // Handlers for Questions CRUD
  const handleSaveTopic = async (text: string, gifUrl: string) => {
    if (editingQuestion) {
      await updateQuestion(editingQuestion.id, text, gifUrl);
      const qList = await fetchQuestions(sessionId);
      setQuestions(qList);
      setEditingQuestion(null);
    } else {
      const { id } = await addQuestion(sessionId, text, gifUrl);
      const qList = await fetchQuestions(sessionId);
      setQuestions(qList);
      const newIdx = qList.findIndex((q) => q.id === id);
      if (newIdx !== -1) setActiveTopicIndex(newIdx);
    }
  };

  const handleDeleteTopic = async () => {
    if (!activeQuestion) return;
    if (!window.confirm(`Are you sure you want to delete topic "${activeQuestion.text}"? All reflections in it will be lost.`)) {
      return;
    }
    try {
      await deleteQuestion(activeQuestion.id);
      showToast('Topic deleted', 'info');
      const qList = await fetchQuestions(sessionId);
      setQuestions(qList);
      setActiveTopicIndex((prev) => Math.max(0, Math.min(prev, qList.length - 1)));
    } catch (err: any) {
      showToast(err.message || 'Failed to delete topic', 'error');
    }
  };

  // Handler for Submitting Reflection Card
  const handleSubmitCard = async (text: string, gifUrl?: string) => {
    if (!activeQuestion) return;
    await submitAnswer({
      sessionId,
      questionId: activeQuestion.id,
      text,
      gifUrl,
    });
    SoundFX.playSuccess();
    const [freshAnswers, status] = await Promise.all([
      fetchAnswers(activeQuestion.id),
      fetchVoterStatus(sessionId),
    ]);
    setAnswers(freshAnswers);
    setVoterStatus(status);
  };

  // Handler for Voting
  const handleVote = async (answerId: string) => {
    const hasVoted = voterStatus.voted_answers.includes(answerId);
    const action = hasVoted ? 'unvote' : 'vote';

    if (action === 'vote' && voterStatus.remaining_votes <= 0) {
      showToast('You have used all 5 of your voting budget for this session!', 'error');
      return;
    }

    // Optimistic UI update
    setAnswers((prev) =>
      prev.map((a) => (a.id === answerId ? { ...a, votes: Math.max(0, a.votes + (action === 'vote' ? 1 : -1)) } : a))
    );
    setVoterStatus((prev) => ({
      ...prev,
      remaining_votes: prev.remaining_votes + (action === 'vote' ? -1 : 1),
      voted_answers: action === 'vote'
        ? [...prev.voted_answers, answerId]
        : prev.voted_answers.filter((id) => id !== answerId),
    }));

    try {
      const res = await voteAnswer({ sessionId, answerId, action });
      if (!res.ok && res.message) {
        showToast(res.message, 'error');
        // Rollback
        const freshAnswers = await fetchAnswers(activeQuestion!.id);
        const freshStatus = await fetchVoterStatus(sessionId);
        setAnswers(freshAnswers);
        setVoterStatus(freshStatus);
      }
    } catch (err: any) {
      showToast(err.message || 'Vote failed', 'error');
    }
  };

  // Handler for Facilitator Spotlight Focus
  const handleSpotlight = async (answerId: string) => {
    if (!isModerator || !activeQuestion) return;
    try {
      SoundFX.playClick();
      const updated = await spotlightAction({
        sessionId,
        action: 'focus',
        questionId: activeQuestion.id,
        answerId,
      });
      setSpotlight(updated);
      showToast('Facilitator spotlight broadcasted to all participants!', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to spotlight card', 'error');
    }
  };

  const handleClearSpotlight = async () => {
    if (!isModerator) return;
    try {
      const updated = await spotlightAction({ sessionId, action: 'clear' });
      setSpotlight(updated);
      showToast('Facilitator spotlight cleared', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to clear spotlight', 'error');
    }
  };

  // Handlers for Timer Controls
  const handleStartTimer = async (seconds: number) => {
    if (!isModerator) return;
    await timerAction(sessionId, 'start', seconds);
    setTimer({ running: true, end_time_unix_ms: Date.now() + seconds * 1000, remaining_seconds: seconds });
    SoundFX.playSuccess();
    showToast(`Timer started: ${Math.floor(seconds / 60)} minutes`, 'success');
  };

  const handleResetTimer = async () => {
    if (!isModerator) return;
    await timerAction(sessionId, 'reset');
    setTimer({ running: false, end_time_unix_ms: 0, remaining_seconds: 300 });
    SoundFX.playClick();
    showToast('Timer reset', 'info');
  };

  // Handler for Exporting PDF
  const handleExportPdf = () => {
    showToast('Generating PDF retrospective summary report...', 'info');
    window.open(`/api/session/report?session_id=${encodeURIComponent(sessionId)}`, '_blank');
  };

  // Handlers for Action Items Modal
  const handleOpenActionItems = async () => {
    try {
      const items = await fetchActionItems(sessionId);
      setActionItems(items);
      setIsActionItemsModalOpen(true);
    } catch (err: any) {
      showToast(err.message || 'Failed to load action items', 'error');
    }
  };

  const handleAddActionItem = async (text: string, assignee?: string, dueDate?: string) => {
    const newItem = await addActionItemApi({ sessionId, text, assignee, dueDate });
    setActionItems((prev) => [newItem, ...prev]);
  };

  const handleToggleActionItem = async (id: string, completed: boolean) => {
    await toggleActionItemApi(id, completed);
    setActionItems((prev) => prev.map((item) => (item.id === id ? { ...item, completed } : item)));
  };

  const handleDeleteActionItem = async (id: string) => {
    await deleteActionItemApi(id);
    setActionItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Handlers for Card Clustering
  const handleOpenClusterModal = (answerId: string) => {
    setClusteringAnswerId(answerId);
    setIsClusterModalOpen(true);
  };

  const handleSaveCluster = async (answerId: string, tag: string) => {
    await clusterCardApi(sessionId, answerId, tag);
    setAnswers((prev) => prev.map((a) => (a.id === answerId ? { ...a, cluster_tag: tag } : a)));
    const freshClusters = await fetchSessionClusters(sessionId);
    setClusters(freshClusters);
  };

  // In-Memory Filter & Sort Logic
  const filteredAndSortedAnswers = useMemo(() => {
    let result = [...answers];

    // Filter by Cluster
    if (selectedCluster !== 'all') {
      result = result.filter((a) => (a.cluster_tag || '').toLowerCase() === selectedCluster.toLowerCase());
    }

    // Filter by Mood
    if (moodFilter !== 'all') {
      result = result.filter((a) => {
        const emo = getRetroEmoticonData(a.sentiment_emoji, a.sentiment_emotion, a.id);
        if (moodFilter === 'positive') return ['fight', 'party', 'love', 'joy'].includes(emo.type);
        if (moodFilter === 'negative') return ['panic', 'exhausted', 'crying'].includes(emo.type);
        if (moodFilter === 'ideas') return emo.type === 'mindblown';
        if (moodFilter === 'action') return emo.type === 'fight' || emo.type === 'party';
        return true;
      });
    }

    // Sort
    result.sort((a, b) => {
      const timeB = new Date(b.created_at || 0).getTime() || 0;
      const timeA = new Date(a.created_at || 0).getTime() || 0;
      if (sortMode === 'votes') {
        if (b.votes !== a.votes) return b.votes - a.votes;
        return timeB - timeA;
      }
      if (sortMode === 'newest') {
        return timeB - timeA;
      }
      if (sortMode === 'oldest') {
        return timeA - timeB;
      }
      return 0;
    });

    return result;
  }, [answers, selectedCluster, moodFilter, sortMode]);

  const votedAnswerSet = useMemo(() => {
    return new Set(voterStatus.voted_answers || []);
  }, [voterStatus.voted_answers]);

  const currentCardForCluster = useMemo(() => {
    if (!clusteringAnswerId) return null;
    return answers.find((a) => a.id === clusteringAnswerId) || null;
  }, [answers, clusteringAnswerId]);

  if (isLoading) {
    return (
      <div className="session-page" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div className="pulse-dot" style={{ width: '20px', height: '20px', background: 'var(--primary)' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Connecting to Retrospective Room...</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Setting up audio synthesizer, voting budget, and live sync.</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="session-page" style={{ alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="content-card" style={{ maxWidth: '480px', width: '100%', textAlign: 'center', padding: '2.5rem 2rem' }}>
          <h2 style={{ color: 'var(--danger)', marginBottom: '0.5rem', fontSize: '1.35rem' }}>Unable to Open Session</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem', lineHeight: 1.5 }}>
            {error || 'This retrospective board could not be found or has expired.'}
          </p>
          <a href="/dashboard" className="btn btn-primary" style={{ display: 'inline-flex', margin: '0 auto' }}>
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="session-page">
      {/* Topbar: Title, Timer, Presence, Budget, Tools, Invite */}
      <SessionTopbar
        sessionName={session.name}
        isModerator={isModerator}
        participants={participants}
        presenceCount={presenceCount}
        timerSeconds={timer.remaining_seconds}
        timerRunning={timer.running}
        onStartTimer={handleStartTimer}
        onResetTimer={handleResetTimer}
        remainingVotes={voterStatus.remaining_votes}
        onOpenActionItems={handleOpenActionItems}
        onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
        onExportPdf={handleExportPdf}
        sessionId={sessionId}
      />

      {/* Facilitator Spotlight Beacon Broadcast */}
      <SpotlightBanner
        spotlight={spotlight}
        isModerator={isModerator}
        onJumpToFocus={handleJumpToFocus}
        onClearSpotlight={handleClearSpotlight}
      />

      {/* Main Board Content Area */}
      <main className="session-content-area">
        <QuestionHeader
          question={activeQuestion}
          topicIndex={activeTopicIndex}
          totalTopics={questions.length}
          answersCount={answers.length}
          isModerator={isModerator}
          sortMode={sortMode}
          onChangeSortMode={setSortMode}
          moodFilter={moodFilter}
          onChangeMoodFilter={setMoodFilter}
          clusters={clusters}
          selectedCluster={selectedCluster}
          onSelectCluster={setSelectedCluster}
          onOpenSubmitModal={() => setIsSubmitModalOpen(true)}
          onEditTopic={() => {
            setEditingQuestion(activeQuestion);
            setIsTopicModalOpen(true);
          }}
          onDeleteTopic={handleDeleteTopic}
        />

        <div style={{ width: '100%', marginTop: '1.5rem', marginBottom: '6rem' }}>
          <AnswersGrid
            answers={filteredAndSortedAnswers}
            isModerator={isModerator}
            spotlightedAnswerId={spotlight.answer_id}
            votedAnswerIds={votedAnswerSet}
            onVote={handleVote}
            onSpotlight={isModerator ? handleSpotlight : undefined}
            onOpenClusterModal={handleOpenClusterModal}
            onOpenSubmitModal={() => setIsSubmitModalOpen(true)}
          />
        </div>
      </main>

      {/* Floating Bottom Topic Navigation Dock */}
      <TopicNavigation
        questions={questions}
        activeIndex={activeTopicIndex}
        onSelectTopic={setActiveTopicIndex}
        isModerator={isModerator}
        onAddNewTopic={() => {
          setEditingQuestion(null);
          setIsTopicModalOpen(true);
        }}
      />

      {/* Modals */}
      <SubmitCardModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        topicTitle={activeQuestion?.text || 'Current Topic'}
        onSubmit={handleSubmitCard}
        assignedAlias={userAlias}
      />

      <TopicModal
        isOpen={isTopicModalOpen}
        onClose={() => {
          setIsTopicModalOpen(false);
          setEditingQuestion(null);
        }}
        questionToEdit={editingQuestion}
        onSave={handleSaveTopic}
      />

      <ActionItemsModal
        isOpen={isActionItemsModalOpen}
        onClose={() => setIsActionItemsModalOpen(false)}
        actionItems={actionItems}
        onAddActionItem={handleAddActionItem}
        onToggleActionItem={handleToggleActionItem}
        onDeleteActionItem={handleDeleteActionItem}
      />

      <ShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      <ClusterModal
        isOpen={isClusterModalOpen}
        onClose={() => {
          setIsClusterModalOpen(false);
          setClusteringAnswerId(null);
        }}
        answerId={clusteringAnswerId}
        currentTag={currentCardForCluster?.cluster_tag || ''}
        existingClusters={clusters}
        onSaveCluster={handleSaveCluster}
      />
    </div>
  );
};
