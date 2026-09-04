
        // ==========================================
        // Modern Tactile UI Sound FX Engine (Web Audio API)
        // ==========================================
        /* SoundFX engine extracted to static/js/sound-fx.js */

        // ==========================================
        // Real-Time Session Timer Synchronization (NN : NN)
        // ==========================================
        let timerSeconds = 300;
        let timerRunning = false;
        let timerEndTimeMs = 0;
        let alarmTriggered = false;
        let lastTickedSecond = -1;
        let isEditingTimer = false;

        function onTimerDigitFocus(input) {
            if (!isModerator) return;
            isEditingTimer = true;
            input.select();
        }

        async function onTimerDigitBlur() {
            if (!isModerator) return;
            isEditingTimer = false;
            const minEl = document.getElementById('timerMin');
            const secEl = document.getElementById('timerSec');
            if (!minEl || !secEl) return;
            
            let m = parseInt(minEl.value) || 0;
            let s = parseInt(secEl.value) || 0;
            
            if (m < 0) m = 0;
            if (m > 59) m = 59;
            if (s < 0) s = 0;
            if (s > 59) s = 59;
            
            minEl.value = String(m).padStart(2, '0');
            secEl.value = String(s).padStart(2, '0');
            
            timerSeconds = (m * 60) + s;
            if (timerSeconds <= 0) timerSeconds = 60;
            
            try {
                await fetch('/api/session/timer/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: sessionId, action: 'reset', seconds: timerSeconds })
                });
            } catch(e) {}
        }

        function onTimerDigitKeyDown(e, input) {
            if (!isModerator) return;
            // Navigation & control keys allowed
            if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                return;
            }
            if (e.key === 'Enter') {
                input.blur();
                startTimer();
                return;
            }
            // Only allow numbers 0-9
            if (!/^\d$/.test(e.key)) {
                e.preventDefault();
                return;
            }
            // Auto advance from minutes to seconds if 2 digits entered
            if (input.id === 'timerMin') {
                setTimeout(() => {
                    const secEl = document.getElementById('timerSec');
                    if (secEl && input.value.length >= 2) secEl.focus();
                }, 10);
            }
        }

        function updateTimerDisplay() {
            const minEl = document.getElementById('timerMin');
            const secEl = document.getElementById('timerSec');
            const colonEl = document.querySelector('.timer-colon');
            const widget = document.querySelector('.timer-widget');
            const resetBtn = document.getElementById('timerResetBtn');
            const playSubBtn = document.getElementById('timerPlaySubBtn');
            
            if (!minEl || !secEl) return;
            
            const m = Math.floor(Math.max(0, timerSeconds) / 60);
            const s = Math.max(0, timerSeconds) % 60;
            
            if (!isEditingTimer) {
                minEl.value = String(m).padStart(2, '0');
                secEl.value = String(s).padStart(2, '0');
            }

            // Play button: visible ONLY to SM when timer is NOT running
            const playBtn = document.getElementById('timerPlayBtn');
            if (playBtn) {
                if (isModerator && !timerRunning) {
                    playBtn.classList.remove('hidden');
                } else {
                    playBtn.classList.add('hidden');
                }
            }

            // Reset button: visible ONLY to SM when timer is running
            if (resetBtn) {
                if (isModerator && timerRunning) {
                    resetBtn.classList.remove('hidden');
                } else {
                    resetBtn.classList.add('hidden');
                }
            }
            
            // Panic Mode Thresholds
            const isPanic = timerSeconds <= 10 && timerSeconds > 0 && timerRunning;
            const isUrgent = timerSeconds <= 30 && timerSeconds > 0 && timerRunning;
            
            if (isPanic) {
                minEl.classList.add('panic-mode');
                secEl.classList.add('panic-mode');
                if (colonEl) colonEl.classList.add('panic-mode');
                if (widget) widget.classList.add('panic-mode');
                minEl.classList.remove('pulse-urgent');
                secEl.classList.remove('pulse-urgent');
            } else if (isUrgent) {
                minEl.classList.add('pulse-urgent');
                secEl.classList.add('pulse-urgent');
                if (colonEl) colonEl.classList.add('pulse-urgent');
                minEl.classList.remove('panic-mode');
                secEl.classList.remove('panic-mode');
                if (colonEl) colonEl.classList.remove('panic-mode');
                if (widget) widget.classList.remove('panic-mode');
            } else {
                minEl.classList.remove('pulse-urgent', 'panic-mode');
                secEl.classList.remove('pulse-urgent', 'panic-mode');
                if (colonEl) colonEl.classList.remove('pulse-urgent', 'panic-mode');
                if (widget) widget.classList.remove('panic-mode');
            }
        }

        // Local smooth 500ms tick for instant countdown
        setInterval(() => {
            if (timerRunning && timerEndTimeMs > 0) {
                const rem = Math.round((timerEndTimeMs - Date.now()) / 1000);
                timerSeconds = Math.max(0, rem);
                
                // Trigger Panic Ticks for last 10 seconds
                if (timerSeconds <= 10 && timerSeconds > 0 && timerSeconds !== lastTickedSecond) {
                    lastTickedSecond = timerSeconds;
                    SoundFX.playTick(timerSeconds <= 5);
                }
                
                updateTimerDisplay();
                if (timerSeconds === 0 && !alarmTriggered) {
                    alarmTriggered = true;
                    timerRunning = false;
                    SoundFX.playAlarm();
                    RetroConfetti.fire({ particleCount: 90, spread: 1.5 });
                    showToast("🚨 TIME'S UP! Wrap up your reflection cards!", "error");
                }
            }
        }, 500);

        // Backend Sync every 1.5s so all tabs stay 100% in sync
        async function syncTimer() {
            try {
                const res = await fetch(`/api/session/timer?session_id=${sessionId}`);
                const data = await res.json();
                
                timerRunning = data.running;
                timerEndTimeMs = data.end_time_unix_ms || 0;
                
                if (timerRunning && timerEndTimeMs > 0) {
                    timerSeconds = Math.max(0, Math.round((timerEndTimeMs - Date.now()) / 1000));
                    alarmTriggered = false;
                } else {
                    timerSeconds = data.remaining_seconds;
                    if (timerSeconds > 0) alarmTriggered = false;
                }
                
                updateTimerDisplay();
            } catch (e) {}
        }

        async function startTimer() {
            SoundFX.init();
            const minEl = document.getElementById('timerMin');
            const secEl = document.getElementById('timerSec');
            if (minEl) minEl.blur();
            if (secEl) secEl.blur();

            let m = parseInt(minEl ? minEl.value : '5') || 0;
            let s = parseInt(secEl ? secEl.value : '0') || 0;
            let sec = (m * 60) + s;
            if (sec <= 0) sec = 300;
            
            // Immediate optimistic start
            timerSeconds = sec;
            timerRunning = true;
            timerEndTimeMs = Date.now() + (sec * 1000);
            alarmTriggered = false;
            updateTimerDisplay();

            try {
                await fetch('/api/session/timer/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: sessionId, action: 'start', seconds: sec })
                });
                syncTimer();
            } catch (e) {}
        }

        async function resetTimer() {
            // Immediate optimistic reset
            timerRunning = false;
            timerEndTimeMs = 0;
            alarmTriggered = false;
            updateTimerDisplay();

            try {
                await fetch('/api/session/timer/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: sessionId, action: 'reset' })
                });
                syncTimer();
            } catch (e) {}
        }

        // ==========================================
        // App State & Main Logic
        // ==========================================
        let quill; let currentQuestions = []; let activeQuestionId = ''; let searchTimeout; let isModerator = false;
        let questionPagination = {}; let isLoadingMore = false;
        const sessionId = new URLSearchParams(window.location.search).get('id');
        let sessionOwnerEmail = '';
        let topicAnswerCounts = {};
        let presenceClientId = sessionStorage.getItem('retro_client_id');
        if (!presenceClientId) {
            presenceClientId = 'c_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
            sessionStorage.setItem('retro_client_id', presenceClientId);
        }
        let activeParticipants = [];
        let isPresenceDropdownOpen = false;
        let presenceSyncInterval = null;

        // ==========================================
        // Facilitator Spotlight & Live Focus Engine (Module 5)
        // ==========================================
        let currentSpotlight = {
            active: false,
            question_id: '',
            answer_id: '',
            updated_at_ms: 0
        };
        let lastObservedSpotlightMs = 0;

        async function syncSpotlight() {
            if (!sessionId) return;
            try {
                const res = await fetch(`/api/session/spotlight?session_id=${sessionId}`);
                if (!res.ok) return;
                const data = await res.json();
                applySpotlightState(data);
            } catch (e) {}
        }

        function applySpotlightState(data) {
            if (!data) return;
            try {
                const isNewUpdate = data.updated_at_ms > lastObservedSpotlightMs;
                const wasActive = currentSpotlight.active;
                currentSpotlight = data;
                lastObservedSpotlightMs = data.updated_at_ms;

                const banner = document.getElementById('spotlightBanner');
                const clearBtn = document.getElementById('spotlightClearBtn');
                const bannerMsg = document.getElementById('spotlightBannerMsg');

                if (data.active) {
                    if (banner) banner.classList.remove('hidden');
                    if (clearBtn) {
                        if (isModerator) clearBtn.classList.remove('hidden');
                        else clearBtn.classList.add('hidden');
                    }

                    // Remove previous spotlight classes
                    document.querySelectorAll('.answer-card.spotlight-active').forEach(el => {
                        if (el.dataset.id !== data.answer_id) el.classList.remove('spotlight-active');
                    });
                    document.querySelectorAll('.topic-container.spotlight-topic-active').forEach(el => {
                        if (el.id !== `q-${data.question_id}`) el.classList.remove('spotlight-topic-active');
                    });

                    if (data.answer_id) {
                        if (bannerMsg) bannerMsg.innerText = "FACILITATOR SPOTLIGHT: Reflection Card In Focus";
                        const card = document.querySelector(`.answer-card[data-id="${data.answer_id}"]`);
                        if (card) {
                            card.classList.add('spotlight-active');
                            if (!card.classList.contains('flipped')) {
                                card.classList.add('flipped');
                            }
                        }
                    } else if (data.question_id) {
                        const topic = document.getElementById(`q-${data.question_id}`);
                        if (topic) topic.classList.add('spotlight-topic-active');
                        const qObj = currentQuestions.find(q => q.id === data.question_id);
                        if (bannerMsg) bannerMsg.innerText = `FACILITATOR SPOTLIGHT: ${qObj ? qObj.text : 'Topic Focus'}`;
                    }

                    // If this is a newly triggered spotlight update, notify and auto-jump
                    if (isNewUpdate && (!wasActive || isNewUpdate)) {
                        SoundFX.playPop();
                        jumpToSpotlight(false);
                    }
                } else {
                    if (banner) banner.classList.add('hidden');
                    document.querySelectorAll('.answer-card.spotlight-active').forEach(el => el.classList.remove('spotlight-active'));
                    document.querySelectorAll('.topic-container.spotlight-topic-active').forEach(el => el.classList.remove('spotlight-topic-active'));
                }

                updateSpotlightButtonsUI();
            } catch (err) {
                console.error("Error in applySpotlightState:", err);
            }
        }

        function updateSpotlightButtonsUI() {
            document.querySelectorAll('[data-spotlight-card-id]').forEach(btn => {
                const cardId = btn.dataset.spotlightCardId;
                const isFocused = currentSpotlight.active && currentSpotlight.answer_id === cardId;
                btn.classList.toggle('active', isFocused);
                const span = btn.querySelector('span');
                if (span) span.innerText = isFocused ? '🔦 Remove Focus' : '🔦 Spotlight Focus';
            });
            document.querySelectorAll('.spotlight-card-btn').forEach(btn => {
                const cardId = btn.dataset.cardId;
                if (currentSpotlight.active && currentSpotlight.answer_id === cardId) {
                    btn.classList.add('active');
                    btn.innerHTML = '🔦 Focused';
                } else {
                    btn.classList.remove('active');
                    btn.innerHTML = '🔦 Spotlight';
                }
            });
            document.querySelectorAll('.spotlight-topic-btn').forEach(btn => {
                const qId = btn.dataset.qId;
                if (currentSpotlight.active && !currentSpotlight.answer_id && currentSpotlight.question_id === qId) {
                    btn.classList.add('active');
                    btn.innerText = '🔦 Topic Focused';
                } else {
                    btn.classList.remove('active');
                    btn.innerText = '🔦 Focus Topic';
                }
            });
        }

        async function toggleSpotlightCard(qId, aId) {
            if (!isModerator) return;
            const isCurrentlySpotlighted = currentSpotlight.active && currentSpotlight.answer_id === aId;
            const action = isCurrentlySpotlighted ? 'clear' : 'focus';

            try {
                const res = await fetch('/api/session/spotlight/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session_id: sessionId,
                        action: action,
                        question_id: qId,
                        answer_id: action === 'focus' ? aId : ''
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    applySpotlightState(data);
                    if (action === 'focus') {
                        showToast('🔦 Spotlight broadcasted to all participants!', 'success');
                    } else {
                        showToast('Spotlight cleared', 'info');
                    }
                } else {
                    const err = await res.text();
                    showToast(`Spotlight error: ${err}`, 'error');
                }
            } catch (e) {
                console.error("toggleSpotlightCard error:", e);
                showToast('Failed to update spotlight', 'error');
            }
        }

        async function toggleSpotlightTopic(qId) {
            if (!isModerator) return;
            const isCurrentlySpotlighted = currentSpotlight.active && !currentSpotlight.answer_id && currentSpotlight.question_id === qId;
            const action = isCurrentlySpotlighted ? 'clear' : 'focus';

            try {
                const res = await fetch('/api/session/spotlight/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session_id: sessionId,
                        action: action,
                        question_id: action === 'focus' ? qId : '',
                        answer_id: ''
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    applySpotlightState(data);
                    if (action === 'focus') {
                        showToast('🔦 Topic Spotlight broadcasted!', 'success');
                    } else {
                        showToast('Topic Spotlight cleared', 'info');
                    }
                } else {
                    const err = await res.text();
                    showToast(`Spotlight error: ${err}`, 'error');
                }
            } catch (e) {
                console.error("toggleSpotlightTopic error:", e);
                showToast('Failed to update spotlight', 'error');
            }
        }

        async function clearSpotlight() {
            if (!isModerator) return;
            try {
                const res = await fetch('/api/session/spotlight/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session_id: sessionId,
                        action: 'clear'
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    applySpotlightState(data);
                    showToast('Spotlight cleared', 'info');
                }
            } catch (e) {}
        }

        function jumpToSpotlight(userInitiated = true) {
            if (!currentSpotlight.active) return;

            if (currentSpotlight.question_id && activeQuestionId !== currentSpotlight.question_id) {
                showQuestion(currentSpotlight.question_id);
                setTimeout(() => {
                    scrollToTargetElement(currentSpotlight.answer_id, currentSpotlight.question_id);
                }, 350);
            } else {
                scrollToTargetElement(currentSpotlight.answer_id, currentSpotlight.question_id);
            }

            if (userInitiated) {
                SoundFX.playFlip();
            }
        }

        function scrollToTargetElement(answerId, questionId) {
            if (answerId) {
                const card = document.querySelector(`.answer-card[data-id="${answerId}"]`);
                if (card) {
                    if (!card.classList.contains('flipped')) {
                        card.classList.add('flipped');
                    }
                    card.classList.add('spotlight-active');
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    return;
                }
            }
            if (questionId) {
                const qHeader = document.querySelector(`#q-${questionId} .question-header`);
                if (qHeader) {
                    qHeader.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        }

        function updateThemeIcon() {
            const theme = document.documentElement.getAttribute('data-theme'); const icon = document.getElementById('theme-icon');
            if (theme === 'dark') { icon.innerHTML = '<path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1-8.313-12.454z"></path>'; }
            else { icon.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>'; }
        }

        // ==========================================
        // Real-Time Active Participants Presence & Topic Counters
        // ==========================================
        function updateTopicAnswerCount(qId, count) {
            if (typeof count !== 'number') return;
            topicAnswerCounts[qId] = count;
            const el = document.getElementById(`topic-count-${qId}`);
            if (el) {
                const prevText = el.innerText.trim();
                const newText = `(${count})`;
                if (prevText !== newText) {
                    el.innerText = newText;
                    el.classList.add('count-bump');
                    setTimeout(() => el.classList.remove('count-bump'), 300);
                }
            }
            const qIdx = currentQuestions.findIndex(q => q.id === qId);
            if (qIdx !== -1) {
                const dot = document.querySelector(`.nav-dot:nth-child(${qIdx + 1})`);
                if (dot) {
                    dot.title = `Topic ${qIdx + 1}: ${currentQuestions[qIdx].text} (${count})`;
                }
            }
        }

        async function syncPresence() {
            if (!sessionId) return;
            try {
                let clientName = '';
                if (isModerator) {
                    clientName = sessionOwnerEmail ? `Host (${sessionOwnerEmail.split('@')[0]})` : 'Host (Facilitator)';
                } else {
                    clientName = assignedGuestName || 'Participant';
                }
                const clientRole = isModerator ? 'moderator' : 'participant';

                const res = await fetch('/api/session/presence', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session_id: sessionId,
                        client_id: presenceClientId,
                        name: clientName,
                        role: clientRole
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    renderPresenceUI(data);
                    if (data.topic_counts) {
                        Object.keys(data.topic_counts).forEach(qId => {
                            updateTopicAnswerCount(qId, data.topic_counts[qId]);
                        });
                    }
                }
            } catch (e) {
                console.warn("Presence sync error:", e);
            }
        }

        function renderPresenceUI(data) {
            if (!data) return;
            activeParticipants = data.participants || [];
            const count = typeof data.count === 'number' ? data.count : activeParticipants.length;

            const countEl = document.getElementById('activeParticipantsCount');
            const dropdownCountEl = document.getElementById('presenceDropdownCount');
            if (countEl) countEl.innerText = String(count);
            if (dropdownCountEl) dropdownCountEl.innerText = `${count} Online`;

            const listEl = document.getElementById('presenceList');
            if (!listEl) return;

            if (activeParticipants.length === 0) {
                listEl.innerHTML = '<div class="presence-loading-msg">Connecting to room...</div>';
                return;
            }

            listEl.innerHTML = activeParticipants.map(p => {
                const isYou = p.id === presenceClientId;
                const isHost = p.role === 'moderator';
                const avatar = isHost ? '👑' : '🎭';

                return `
                <div class="presence-item" ${isYou ? 'style="border-color: var(--primary); background: rgba(255, 95, 31, 0.04);"' : ''}>
                    <div class="presence-user-left">
                        <span class="presence-user-avatar">${avatar}</span>
                        <span class="presence-user-name" title="${escapeText(p.name)}">${escapeText(p.name)}</span>
                    </div>
                    <div class="presence-tags">
                        ${isYou ? '<span class="presence-you-badge">YOU</span>' : ''}
                        <span class="presence-role-pill ${isHost ? 'host' : 'member'}">${isHost ? 'HOST' : 'MEMBER'}</span>
                    </div>
                </div>`;
            }).join('');
        }

        function togglePresenceDropdown(e) {
            if (e) e.stopPropagation();
            const panel = document.getElementById('presenceDropdownPanel');
            const btn = document.getElementById('presenceBtn');
            if (!panel || !btn) return;

            isPresenceDropdownOpen = !isPresenceDropdownOpen;
            panel.classList.toggle('hidden', !isPresenceDropdownOpen);
            btn.classList.toggle('active', isPresenceDropdownOpen);
            btn.setAttribute('aria-expanded', isPresenceDropdownOpen ? 'true' : 'false');

            if (isPresenceDropdownOpen) {
                SoundFX.playPop();
            }
        }

        function closePresenceDropdown() {
            const panel = document.getElementById('presenceDropdownPanel');
            const btn = document.getElementById('presenceBtn');
            if (!panel || !btn) return;
            isPresenceDropdownOpen = false;
            panel.classList.add('hidden');
            btn.classList.remove('active');
            btn.setAttribute('aria-expanded', 'false');
        }

        let isFacilitatorDropdownOpen = false;
        let isToolsDropdownOpen = false;

        function toggleFacilitatorDropdown(e) {
            if (e) e.stopPropagation();
            const panel = document.getElementById('facilitatorDropdownPanel');
            const btn = document.getElementById('facilitatorBtn');
            if (!panel || !btn) return;

            closePresenceDropdown();
            closeToolsDropdown();

            isFacilitatorDropdownOpen = !isFacilitatorDropdownOpen;
            panel.classList.toggle('hidden', !isFacilitatorDropdownOpen);
            btn.classList.toggle('active', isFacilitatorDropdownOpen);
            btn.setAttribute('aria-expanded', isFacilitatorDropdownOpen ? 'true' : 'false');

            if (isFacilitatorDropdownOpen) {
                SoundFX.playPop();
                const focusTitle = document.getElementById('facilitatorFocusItemTitle');
                if (focusTitle) {
                    const isFocused = currentSpotlight && currentSpotlight.active && !currentSpotlight.answer_id && currentSpotlight.question_id === activeQuestionId;
                    focusTitle.innerText = isFocused ? 'Unfocus Current Topic' : 'Focus Current Topic';
                }
            }
        }

        function closeFacilitatorDropdown() {
            const panel = document.getElementById('facilitatorDropdownPanel');
            const btn = document.getElementById('facilitatorBtn');
            if (!panel || !btn) return;
            isFacilitatorDropdownOpen = false;
            panel.classList.add('hidden');
            btn.classList.remove('active');
            btn.setAttribute('aria-expanded', 'false');
        }

        function toggleToolsDropdown(e) {
            if (e) e.stopPropagation();
            const panel = document.getElementById('toolsDropdownPanel');
            const btn = document.getElementById('toolsBtn');
            if (!panel || !btn) return;

            closePresenceDropdown();
            closeFacilitatorDropdown();

            isToolsDropdownOpen = !isToolsDropdownOpen;
            panel.classList.toggle('hidden', !isToolsDropdownOpen);
            btn.classList.toggle('active', isToolsDropdownOpen);
            btn.setAttribute('aria-expanded', isToolsDropdownOpen ? 'true' : 'false');

            if (isToolsDropdownOpen) {
                SoundFX.playPop();
                updateToolsSoundState();
            }
        }

        function closeToolsDropdown() {
            const panel = document.getElementById('toolsDropdownPanel');
            const btn = document.getElementById('toolsBtn');
            if (!panel || !btn) return;
            isToolsDropdownOpen = false;
            panel.classList.add('hidden');
            btn.classList.remove('active');
            btn.setAttribute('aria-expanded', 'false');
        }

        function updateToolsSoundState() {
            const icon = document.getElementById('toolsSoundIcon');
            const title = document.getElementById('toolsSoundTitle');
            if (icon) icon.innerText = SoundFX.muted ? '🔇' : '🔊';
            if (title) title.innerText = SoundFX.muted ? 'Sound Effects (Muted)' : 'Sound Effects (On)';
        }

        function toggleTopicDropdown(e, qId) {
            if (e) e.stopPropagation();
            const panel = document.getElementById(`topicDropdown-${qId}`);
            if (!panel) return;
            const isCurrentlyHidden = panel.classList.contains('hidden');
            closeTopicDropdowns();
            if (isCurrentlyHidden) {
                panel.classList.remove('hidden');
                SoundFX.playPop();
            }
        }

        function closeTopicDropdowns() {
            document.querySelectorAll('.topic-dropdown-panel').forEach(p => p.classList.add('hidden'));
        }

        function closeAllTopbarDropdowns() {
            closePresenceDropdown();
            closeFacilitatorDropdown();
            closeToolsDropdown();
            closeTopicDropdowns();
            closeAllToolbarDropdowns();
        }

        function editCurrentTopic() {
            const q = currentQuestions.find(item => item.id === activeQuestionId);
            if (q) {
                openQuestionModal(q.id, q.text, q.gif_url || '');
            } else {
                openQuestionModal();
            }
        }

        function spotlightCurrentTopic() {
            if (activeQuestionId) {
                toggleSpotlightTopic(activeQuestionId);
            }
        }

        // Send beacon on page exit to leave immediately
        window.addEventListener('beforeunload', () => {
            if (sessionId && presenceClientId) {
                const payload = JSON.stringify({ session_id: sessionId, client_id: presenceClientId });
                const blob = new Blob([payload], { type: 'application/json' });
                navigator.sendBeacon('/api/session/presence/leave', blob);
            }
        });

        // ==========================================
        // Security: Light DOM Sanitizer & Escaping
        // ==========================================
        function escapeText(str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        function sanitizeHTML(html) {
            if (!html) return '';
            const temp = document.createElement('div');
            temp.innerHTML = html;
            // Remove executable script and embed elements
            const blocked = temp.querySelectorAll('script, style, iframe, object, embed, applet');
            blocked.forEach(el => el.remove());
            // Strip inline event listeners and dangerous URIs
            const allElements = temp.querySelectorAll('*');
            allElements.forEach(el => {
                for (let i = el.attributes.length - 1; i >= 0; i--) {
                    const attr = el.attributes[i];
                    const name = attr.name.toLowerCase();
                    const val = attr.value.trim().toLowerCase();
                    if (name.startsWith('on') || val.startsWith('javascript:') || val.startsWith('data:text/html') || val.startsWith('vbscript:')) {
                        el.removeAttribute(attr.name);
                    }
                }
            });
            return temp.innerHTML;
        }

        function updateStickyOffset() {
            const topbar = document.querySelector('.app-topbar');
            if (topbar) {
                const height = topbar.getBoundingClientRect().height;
                document.documentElement.style.setProperty('--topbar-height', `${Math.round(height)}px`);
            }
        }
        window.addEventListener('resize', updateStickyOffset);

        // Mobile Touch Gesture Support (Swipe left/right to change questions)
        (function initTouchGestures() {
            let touchStartX = 0;
            let touchStartY = 0;
            document.addEventListener('touchstart', (e) => {
                if (e.touches.length === 1) {
                    touchStartX = e.touches[0].clientX;
                    touchStartY = e.touches[0].clientY;
                }
            }, { passive: true });

            document.addEventListener('touchend', (e) => {
                if (e.changedTouches.length === 1) {
                    const diffX = e.changedTouches[0].clientX - touchStartX;
                    const diffY = e.changedTouches[0].clientY - touchStartY;
                    // Detect deliberate horizontal swipe (>= 60px horizontal, >= 1.5x vertical)
                    if (Math.abs(diffX) >= 60 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
                        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
                        if (activeTag === 'input' || activeTag === 'textarea' || (document.activeElement && document.activeElement.isContentEditable)) {
                            return;
                        }
                        if (diffX < 0) {
                            nextQuestion();
                        } else {
                            prevQuestion();
                        }
                    }
                }
            }, { passive: true });
        })();

        // Background Tab Optimization (Save mobile CPU & battery when tab is hidden)
        let timerSyncInterval = null;
        let answersSyncInterval = null;

        function startBackgroundSync() {
            stopBackgroundSync();
            timerSyncInterval = setInterval(() => {
                syncTimer();
                syncSpotlight();
            }, 1500);
            answersSyncInterval = setInterval(loadAnswers, 4000);
            presenceSyncInterval = setInterval(syncPresence, 3500);
        }

        function stopBackgroundSync() {
            if (timerSyncInterval) { clearInterval(timerSyncInterval); timerSyncInterval = null; }
            if (answersSyncInterval) { clearInterval(answersSyncInterval); answersSyncInterval = null; }
            if (presenceSyncInterval) { clearInterval(presenceSyncInterval); presenceSyncInterval = null; }
        }

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                stopBackgroundSync();
            } else {
                syncTimer();
                syncSpotlight();
                syncPresence();
                loadAnswers();
                loadActionItems();
                startBackgroundSync();
            }
        });

        async function init() {
            if (!sessionId) return window.location.href = '/';
            document.getElementById('sessionIdDisplay').innerText = `SESSION: ${sessionId.slice(0,8)}...`;
            updateThemeIcon();
            updateSoundIcon();
            quill = new Quill('#editor-container', { theme: 'snow', placeholder: 'Share feedback...' });
            const role = new URLSearchParams(window.location.search).get('role') || 'guest';
            const res = await fetch(`/api/session/get?id=${sessionId}&role=${role}`); const session = await res.json();
            document.getElementById('sessionNameTitle').innerText = session.name;
            isModerator = session.is_owner;
            sessionOwnerEmail = session.owner_email || '';
            const roleBadge = document.getElementById('roleBadge');
            if (roleBadge) {
                if (isModerator) {
                    roleBadge.innerText = 'MODERATOR';
                    roleBadge.classList.add('badge-moderator');
                } else {
                    roleBadge.innerText = 'PARTICIPANT';
                    roleBadge.classList.remove('badge-moderator');
                }
            }
            if (isModerator) {
                document.getElementById('sm-controls').classList.remove('hidden');
                const minEl = document.getElementById('timerMin');
                const secEl = document.getElementById('timerSec');
                if (minEl) minEl.removeAttribute('readonly');
                if (secEl) secEl.removeAttribute('readonly');
            }
            updateStickyOffset();
            RetroConfetti.init();
            loadQuestions(); 
            syncTimer();
            syncSpotlight();
            syncVoterStatus();
            syncPresence();
            loadActionItems();
            refreshSessionClusterTags();
            startBackgroundSync();
        }

        function toggleTheme() {
            const html = document.documentElement; const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            html.setAttribute('data-theme', newTheme); localStorage.setItem('theme', newTheme); updateThemeIcon();
        }

        async function loadQuestions() {
            const res = await fetch(`/api/session/questions?session_id=${sessionId}`); currentQuestions = await res.json();
            currentQuestions.forEach(q => {
                if (!questionPagination[q.id]) {
                    questionPagination[q.id] = { limit: 12, hasMore: true };
                }
                if (typeof q.answer_count === 'number') {
                    topicAnswerCounts[q.id] = q.answer_count;
                }
            });
            const container = document.getElementById('questions-container'); const nav = document.getElementById('nav-questions');
            container.innerHTML = currentQuestions.map(q => {
                let mediaHtml = '';
                const aCount = typeof topicAnswerCounts[q.id] === 'number' ? topicAnswerCounts[q.id] : (q.answer_count || 0);
                if (q.gif_url) {
                    mediaHtml = `
                    <div style="display: flex; flex-direction: column; align-items: center; text-align: center; gap: 1rem; margin-bottom: 1.5rem;">
                        <div class="topic-media-container">
                            <img src="${q.gif_url}" style="width: 100%; height: 100%; object-fit: contain;">
                            ${isModerator ? `
                                <div class="topic-media-overlay" onclick="openQuestionModal('${q.id}', '${q.text.replace(/'/g, "\\'")}', '${q.gif_url}')">
                                    <span class="btn btn-primary" style="font-size: 0.85rem; padding: 0.5rem 1rem;">✏️ Change GIF / Media</span>
                                </div>` : ''}
                        </div>
                    </div>`;
                }

                return `
                <div id="q-${q.id}" class="topic-container">
                    ${mediaHtml}
                    <div class="sticky-wrapper">
                        <div class="question-header">
                            <h2 style="font-size: 2.5rem; margin:0; line-height: 1.1; color: var(--text-main); font-weight: 900; display: flex; align-items: center; justify-content: center; flex-wrap: wrap;">
                                <span>${escapeText(q.text)}</span> <span class="topic-answers-count" id="topic-count-${q.id}">(${aCount})</span>
                            </h2>
                            <div style="display: flex; gap: 0.75rem; justify-content: center; margin-top: 1.25rem; flex-wrap: wrap; align-items: center;">
                                <button onclick="openSubmitModal('${q.id}', '${q.text.replace(/'/g, "\\'")}')" class="btn btn-primary" title="Post reflection card with reaction GIF or meme">✍️ Post Card & GIF</button>
                                <button onclick="toggleBoardToolbar('${q.id}')" id="toggle-toolbar-${q.id}" class="btn btn-ghost toolbar-toggle-btn ${isToolbarCollapsed ? 'active' : ''}" title="Hide/show filters and sort controls (H)">
                                    <span>⚡ Filters & Sort</span> <span class="toolbar-toggle-arrow">${isToolbarCollapsed ? '▸' : '▾'}</span>
                                </button>
                                ${isModerator ? `
                                <div class="topic-dropdown-container">
                                    <button type="button" onclick="toggleTopicDropdown(event, '${q.id}')" class="btn btn-ghost topic-menu-btn" title="Topic Options & Facilitator Controls">
                                        <span>⚙️ Topic</span> <span class="topic-dropdown-caret">▾</span>
                                    </button>
                                    <div class="topic-dropdown-panel hidden" id="topicDropdown-${q.id}" role="menu">
                                        <button type="button" class="topic-dropdown-item" onclick="openQuestionModal('${q.id}', '${q.text.replace(/'/g, "\\'")}', '${q.gif_url || ''}'); closeTopicDropdowns();">
                                            <span>✏️ Edit Topic & GIF</span>
                                        </button>
                                        <button type="button" class="topic-dropdown-item" onclick="toggleSpotlightTopic('${q.id}'); closeTopicDropdowns();">
                                            <span>${currentSpotlight && currentSpotlight.active && !currentSpotlight.answer_id && currentSpotlight.question_id === q.id ? '🔦 Unfocus Topic' : '🔦 Focus Topic'}</span>
                                        </button>
                                        <button type="button" class="topic-dropdown-item" onclick="openQuestionModal(); closeTopicDropdowns();">
                                            <span>➕ Add New Topic</span>
                                        </button>
                                    </div>
                                </div>` : ''}
                            </div>
                            <div class="board-toolbar ${isToolbarCollapsed ? 'toolbar-collapsed' : ''}" id="board-toolbar-${q.id}">
                                <div class="toolbar-group">
                                    <!-- Sort Dropdown -->
                                    <div class="toolbar-dropdown-container">
                                        <button type="button" class="toolbar-dropdown-btn" id="sortDropdownBtn-${q.id}" onclick="toggleSortDropdown(event, '${q.id}')" title="Change sorting order" aria-haspopup="true">
                                            <span class="toolbar-btn-label">Sort:</span>
                                            <span class="toolbar-btn-val" id="sortLabel-${q.id}">${getSortLabel(currentSortMode)}</span>
                                            <span class="toolbar-dropdown-caret">▾</span>
                                        </button>
                                        <div class="toolbar-dropdown-panel hidden" id="sortDropdownPanel-${q.id}" role="menu">
                                            <button type="button" class="toolbar-dropdown-item ${currentSortMode === 'votes' ? 'active' : ''}" data-sort="votes" onclick="setSortMode('votes', '${q.id}')">
                                                <span class="item-check">${currentSortMode === 'votes' ? '✓' : ''}</span>
                                                <span>▲ Top Voted</span>
                                            </button>
                                            <button type="button" class="toolbar-dropdown-item ${currentSortMode === 'newest' ? 'active' : ''}" data-sort="newest" onclick="setSortMode('newest', '${q.id}')">
                                                <span class="item-check">${currentSortMode === 'newest' ? '✓' : ''}</span>
                                                <span>⏱️ Newest</span>
                                            </button>
                                            <button type="button" class="toolbar-dropdown-item ${currentSortMode === 'oldest' ? 'active' : ''}" data-sort="oldest" onclick="setSortMode('oldest', '${q.id}')">
                                                <span class="item-check">${currentSortMode === 'oldest' ? '✓' : ''}</span>
                                                <span>⏳ Oldest</span>
                                            </button>
                                        </div>
                                    </div>

                                    <!-- Mood Dropdown -->
                                    <div class="toolbar-dropdown-container">
                                        <button type="button" class="toolbar-dropdown-btn" id="moodDropdownBtn-${q.id}" onclick="toggleMoodDropdown(event, '${q.id}')" title="Filter by mood / sentiment" aria-haspopup="true">
                                            <span class="toolbar-btn-label">Mood:</span>
                                            <span class="toolbar-btn-val" id="moodLabel-${q.id}">${getMoodLabel(currentMoodFilter)}</span>
                                            <span class="toolbar-dropdown-caret">▾</span>
                                        </button>
                                        <div class="toolbar-dropdown-panel hidden" id="moodDropdownPanel-${q.id}" role="menu">
                                            <button type="button" class="toolbar-dropdown-item ${currentMoodFilter === 'all' ? 'active' : ''}" data-mood="all" onclick="setMoodFilter('all', '${q.id}')">
                                                <span class="item-check">${currentMoodFilter === 'all' ? '✓' : ''}</span>
                                                <span>All Moods</span>
                                            </button>
                                            <button type="button" class="toolbar-dropdown-item ${currentMoodFilter === 'wins' ? 'active' : ''}" data-mood="wins" onclick="setMoodFilter('wins', '${q.id}')">
                                                <span class="item-check">${currentMoodFilter === 'wins' ? '✓' : ''}</span>
                                                <span>🔥 Wins</span>
                                            </button>
                                            <button type="button" class="toolbar-dropdown-item ${currentMoodFilter === 'challenges' ? 'active' : ''}" data-mood="challenges" onclick="setMoodFilter('challenges', '${q.id}')">
                                                <span class="item-check">${currentMoodFilter === 'challenges' ? '✓' : ''}</span>
                                                <span>⚠️ Challenges</span>
                                            </button>
                                            <button type="button" class="toolbar-dropdown-item ${currentMoodFilter === 'ideas' ? 'active' : ''}" data-mood="ideas" onclick="setMoodFilter('ideas', '${q.id}')">
                                                <span class="item-check">${currentMoodFilter === 'ideas' ? '✓' : ''}</span>
                                                <span>💡 Ideas</span>
                                            </button>
                                        </div>
                                    </div>

                                    <!-- Flip Cards Toggle -->
                                    <button type="button" class="toolbar-pill flip-cards-btn" onclick="toggleFlipAllCards()" title="Flip all reflections">
                                        🎴 Flip Cards
                                    </button>
                                </div>
                                <div class="toolbar-group cluster-filter-group" id="cluster-filter-group-${q.id}" style="display: none;">
                                    <span class="toolbar-label">Tags:</span>
                                    <div class="cluster-pills-container" id="cluster-pills-${q.id}" style="display: inline-flex; gap: 0.35rem; flex-wrap: wrap;"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div id="answers-${q.id}" class="answers-grid"></div>
                    <div id="load-more-status-${q.id}" class="load-more-status" style="text-align: center; margin: 2rem 0; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; font-weight: 800; color: var(--text-sub);"></div>
                </div>`;
            }).join('');
            const dotsWrapper = document.getElementById('nav-dots-wrapper');
            const dotsHtml = currentQuestions.map((q, i) => {
                const aCount = typeof topicAnswerCounts[q.id] === 'number' ? topicAnswerCounts[q.id] : (q.answer_count || 0);
                return `<div class="nav-dot" onclick="showQuestion('${q.id}')" title="Topic ${i+1}: ${escapeText(q.text)} (${aCount})"></div>`;
            }).join('');
            if (dotsWrapper) {
                dotsWrapper.innerHTML = dotsHtml;
            } else if (nav) {
                nav.innerHTML = dotsHtml;
            }
            updateToolbarVisibility();
            if (currentQuestions.length > 0) showQuestion(currentQuestions[0].id);
        }

        function showQuestion(id) {
            const prev = document.querySelector('.topic-container.active');
            if (prev) {
                prev.classList.add('leaving');
                setTimeout(() => {
                    prev.classList.remove('active', 'leaving');
                    activateTopic(id);
                }, 300);
            } else {
                activateTopic(id);
            }
        }

        function activateTopic(id) {
            const current = document.getElementById(`q-${id}`);
            if (current) {
                current.classList.add('active');
                document.querySelectorAll('.nav-dot').forEach((dot, i) => { dot.classList.toggle('active', currentQuestions[i].id === id); });
                activeQuestionId = id; loadAnswers(); window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }

        function nextQuestion() { const idx = currentQuestions.findIndex(q => q.id === activeQuestionId); if (idx < currentQuestions.length - 1) showQuestion(currentQuestions[idx + 1].id); }
        function prevQuestion() { const idx = currentQuestions.findIndex(q => q.id === activeQuestionId); if (idx > 0) showQuestion(currentQuestions[idx - 1].id); }

        function getVariant(list, seed) {
            if (!list || list.length === 0) return "(._.)";
            let hash = 0;
            const str = String(seed || "");
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) - hash) + str.charCodeAt(i);
                hash |= 0;
            }
            return list[Math.abs(hash) % list.length];
        }

        function getRetroEmoticonData(emoji, emotion, seed) {
            const emotionLower = (emotion || "").toLowerCase();
            const emojiStr = emoji || "";

            // If it's already a text kaomoji/emoticon, keep it!
            if (emojiStr.includes("(") && emojiStr.includes(")")) {
                return { text: emojiStr, type: "neutral" };
            }

            // 1. Fight / Semangat / Determination / Push / Hustle / Strong
            if (emotionLower.includes("fight") || emotionLower.includes("semangat") || emotionLower.includes("challenge") || emotionLower.includes("determ") || emotionLower.includes("push") || emotionLower.includes("hustle") || emotionLower.includes("bisa") || emotionLower.includes("power") || emotionLower.includes("strong") || emotionLower.includes("effort")) {
                return { text: getVariant(["(ง'̀-'́)ง", "(ง •̀_•́)ง"], seed), type: "fight" };
            }

            // 2. Victory / Party / Celebration / Big Win
            if (emotionLower.includes("party") || emotionLower.includes("celebrat") || emotionLower.includes("win") || emotionLower.includes("victory") || emotionLower.includes("champion") || emotionLower.includes("awesome") || emotionLower.includes("cheer")) {
                return { text: getVariant(["＼(＾O＾)／", "(ﾉ◕ヮ◕)ﾉ", "(≧◡≦)"], seed), type: "party" };
            }

            // 3. Love / Appreciation / Grateful / Kudos / Support
            if (emotionLower.includes("love") || emotionLower.includes("gratitude") || emotionLower.includes("grateful") || emotionLower.includes("appreciat") || emotionLower.includes("kudos") || emotionLower.includes("thank") || emotionLower.includes("support")) {
                return { text: getVariant(["(♥‿♥)", "(人´∀｀)", "(◍•ᴗ•◍)"], seed), type: "love" };
            }

            // 4. Mindblown / Idea / Sparkle / Innovation / Genius
            if (emotionLower.includes("idea") || emotionLower.includes("sparkle") || emotionLower.includes("mindblown") || emotionLower.includes("genius") || emotionLower.includes("eureka") || emotionLower.includes("innovat") || emotionLower.includes("solut") || emotionLower.includes("smart") || emotionLower.includes("bright")) {
                return { text: getVariant(["( ✧Д✧)", "(★ω★)", "( ﾟヮﾟ)"], seed), type: "mindblown" };
            }

            // 5. Panic / Tableflip / Chaos / Incident / Blocker
            if (emotionLower.includes("panic") || emotionLower.includes("chaos") || emotionLower.includes("flip") || emotionLower.includes("incident") || emotionLower.includes("blocker") || emotionLower.includes("disaster") || emotionLower.includes("fire") || emotionLower.includes("emergency")) {
                return { text: getVariant(["(╯°□°)╯", "(ノಠ益ಠ)ノ", "(;￣Д￣)"], seed), type: "panic" };
            }

            // 6. Exhausted / Burnout / Overworked / Need Coffee
            if (emotionLower.includes("tired") || emotionLower.includes("exhaust") || emotionLower.includes("burnout") || emotionLower.includes("sleep") || emotionLower.includes("drained") || emotionLower.includes("overwork") || emotionLower.includes("heavy") || emotionLower.includes("ot")) {
                return { text: getVariant(["(×_×)", "(っ- ‸ -ς)", "(-.-)Zzz"], seed), type: "exhausted" };
            }

            // 7. Crying / Heartbroken / Deep Grief / Loss
            if (emotionLower.includes("cry") || emotionLower.includes("tear") || emotionLower.includes("broken") || emotionLower.includes("heartbreak") || emotionLower.includes("grief") || emotionLower.includes("regret") || emotionLower.includes("loss")) {
                return { text: getVariant(["ಥ_ಥ", "(T_T)", "( ; _ ; )"], seed), type: "crying" };
            }

            // 8. Nervous / Anxious / Sweating / Risky
            if (emotionLower.includes("nervous") || emotionLower.includes("anxious") || emotionLower.includes("sweat") || emotionLower.includes("worry") || emotionLower.includes("scare") || emotionLower.includes("afraid") || emotionLower.includes("risk")) {
                return { text: getVariant(["(・_・;)", "(￣▽￣;)", "(•᷄- •᷅ )"], seed), type: "nervous" };
            }

            // 9. Skeptical / Side-eye / Doubtful / Sinis
            if (emotionLower.includes("skeptic") || emotionLower.includes("doubt") || emotionLower.includes("suspic") || emotionLower.includes("side") || emotionLower.includes("sinis") || emotionLower.includes("cynic")) {
                return { text: getVariant(["(¬_¬)", "(¬‿¬)"], seed), type: "skeptical" };
            }

            // 10. Cool / Chill / Relaxed / Swag
            if (emotionLower.includes("cool") || emotionLower.includes("chill") || emotionLower.includes("relax") || emotionLower.includes("confiden") || emotionLower.includes("calm") || emotionLower.includes("smooth") || emotionLower.includes("swag")) {
                return { text: getVariant(["(⌐■_■)", "( •_•)>⌐■-■"], seed), type: "cool" };
            }

            // 11. Joy / Happy / Content
            if (emotionLower.includes("joy") || emotionLower.includes("happy") || emotionLower.includes("success") || emotionLower.includes("positive") || emotionLower.includes("excite") || emotionLower.includes("proud") || emotionLower.includes("good") || emotionLower.includes("great")) {
                return { text: getVariant(["(ᵔ◡ᵔ)", "(✿◠‿◠)", "(＾◡＾)"], seed), type: "joy" };
            }

            // 12. Angry / Rage / Frustrated
            if (emotionLower.includes("anger") || emotionLower.includes("angry") || emotionLower.includes("frustrat") || emotionLower.includes("bad") || emotionLower.includes("critical") || emotionLower.includes("negative") || emotionLower.includes("annoy") || emotionLower.includes("mad") || emotionLower.includes("hate") || emotionLower.includes("rage")) {
                return { text: getVariant(["(ಠ_ಠ)", "(｀Д´)", "(╬ಠ益ಠ)"], seed), type: "angry" };
            }

            // 13. Shock / Surprise / Sudden Alert
            if (emotionLower.includes("shock") || emotionLower.includes("surprise") || emotionLower.includes("alert") || emotionLower.includes("urgent") || emotionLower.includes("danger") || emotionLower.includes("alarm") || emotionLower.includes("warning")) {
                return { text: getVariant(["(°ロ°!)", "(⊙_⊙;)", "(ﾟOﾟ)"], seed), type: "shock" };
            }

            // 14. Curious / Confused / Thinking
            if (emotionLower.includes("confus") || emotionLower.includes("unclear") || emotionLower.includes("question") || emotionLower.includes("think") || emotionLower.includes("curious") || emotionLower.includes("wonder") || emotionLower.includes("ponder")) {
                return { text: getVariant(["(⊙_⊙)", "(・・?)", "(˘･_･˘)"], seed), type: "curious" };
            }

            // 15. Sad / Disappointed / Down
            if (emotionLower.includes("sad") || emotionLower.includes("disappoint") || emotionLower.includes("fail") || emotionLower.includes("down")) {
                return { text: getVariant(["(︶︹︶)", "(｡•́︿•̀｡)", "(◞‸◟)"], seed), type: "sad" };
            }

            // Graphic Emoji Fallback Mapping
            if (["💪","🥊","⚔️"].some(e => emojiStr.includes(e))) return { text: getVariant(["(ง'̀-'́)ง", "(ง •̀_•́)ง"], seed), type: "fight" };
            if (["🎉","🎊","🏆","🚀","🥳","💃","🕺"].some(e => emojiStr.includes(e))) return { text: getVariant(["＼(＾O＾)／", "(ﾉ◕ヮ◕)ﾉ", "(≧◡≦)"], seed), type: "party" };
            if (["❤️","💖","💕","🙏","🥰","😍","💐"].some(e => emojiStr.includes(e))) return { text: getVariant(["(♥‿♥)", "(人´∀｀)", "(◍•ᴗ•◍)"], seed), type: "love" };
            if (["💡","✨","⭐","🌟","💎","🧠","⚡"].some(e => emojiStr.includes(e))) return { text: getVariant(["( ✧Д✧)", "(★ω★)", "( ﾟヮﾟ)"], seed), type: "mindblown" };
            if (["💥","🚨","⚠️","💣","🧨","🔥"].some(e => emojiStr.includes(e))) return { text: getVariant(["(╯°□°)╯", "(ノಠ益ಠ)ノ"], seed), type: "panic" };
            if (["😴","🥱","☕","🛌","🔋"].some(e => emojiStr.includes(e))) return { text: getVariant(["(×_×)", "(っ- ‸ -ς)", "(-.-)Zzz"], seed), type: "exhausted" };
            if (["😭","😢","💔","🥀","🌧️"].some(e => emojiStr.includes(e))) return { text: getVariant(["ಥ_ಥ", "(T_T)"], seed), type: "crying" };
            if (["😰","😨","😥","😓","😬"].some(e => emojiStr.includes(e))) return { text: getVariant(["(・_・;)", "(￣▽￣;)"], seed), type: "nervous" };
            if (["🤨","🧐","👀"].some(e => emojiStr.includes(e))) return { text: getVariant(["(¬_¬)", "(¬‿¬)"], seed), type: "skeptical" };
            if (["😎","🕶️","🌴","🧘"].some(e => emojiStr.includes(e))) return { text: getVariant(["(⌐■_■)", "( •_•)>⌐■-■"], seed), type: "cool" };
            if (["😃","😊","👍","😀","😁","😆","😸"].some(e => emojiStr.includes(e))) return { text: getVariant(["(ᵔ◡ᵔ)", "(✿◠‿◠)"], seed), type: "joy" };
            if (["😡","😠","👿","👎","🤬","😤","💢","💀","☠️","💩"].some(e => emojiStr.includes(e))) return { text: getVariant(["(ಠ_ಠ)", "(｀Д´)"], seed), type: "angry" };
            if (["😱","😲","🤯","❗","‼️"].some(e => emojiStr.includes(e))) return { text: getVariant(["(°ロ°!)", "(⊙_⊙;)"], seed), type: "shock" };
            if (["😕","🤔","❓","❔","🤷","🛸"].some(e => emojiStr.includes(e))) return { text: getVariant(["(⊙_⊙)", "(・・?)"], seed), type: "curious" };
            if (["😞","🥺","😔","😩","😫"].some(e => emojiStr.includes(e))) return { text: getVariant(["(︶︹︶)", "(｡•́︿•̀｡)"], seed), type: "sad" };

            // Neutral Default
            return { text: getVariant(["( -_- )", "(._.)", "(・_・)"], seed), type: "neutral" };
        }

        function getRetroEmoticon(emoji, emotion, seed) {
            return getRetroEmoticonData(emoji, emotion, seed).text;
        }

        // ==========================================
        // Phase 1: Card Sorting, Mood Filtering, & Confetti
        // ==========================================
        let currentSortMode = 'votes'; // 'votes' | 'newest' | 'oldest'
        let currentMoodFilter = 'all';  // 'all' | 'wins' | 'challenges' | 'ideas'
        let allCardsFlipped = false;
        let isToolbarCollapsed = localStorage.getItem('retro_toolbar_collapsed') === 'true';

        /* RetroConfetti engine extracted to static/js/confetti.js */

        function getSortLabel(mode) {
            switch (mode) {
                case 'votes': return '▲ Top Voted';
                case 'newest': return '⏱️ Newest';
                case 'oldest': return '⏳ Oldest';
                default: return '▲ Top Voted';
            }
        }

        function getMoodLabel(mood) {
            switch (mood) {
                case 'all': return 'All Moods';
                case 'wins': return '🔥 Wins';
                case 'challenges': return '⚠️ Challenges';
                case 'ideas': return '💡 Ideas';
                default: return 'All Moods';
            }
        }

        function toggleSortDropdown(e, qId) {
            if (e) e.stopPropagation();
            const panel = document.getElementById(`sortDropdownPanel-${qId}`);
            if (!panel) return;
            const isHidden = panel.classList.contains('hidden');
            closeAllToolbarDropdowns();
            if (isHidden) {
                panel.classList.remove('hidden');
                SoundFX.playPop();
            }
        }

        function toggleMoodDropdown(e, qId) {
            if (e) e.stopPropagation();
            const panel = document.getElementById(`moodDropdownPanel-${qId}`);
            if (!panel) return;
            const isHidden = panel.classList.contains('hidden');
            closeAllToolbarDropdowns();
            if (isHidden) {
                panel.classList.remove('hidden');
                SoundFX.playPop();
            }
        }

        function closeAllToolbarDropdowns() {
            document.querySelectorAll('.toolbar-dropdown-panel').forEach(p => p.classList.add('hidden'));
        }

        function setSortMode(mode, qId) {
            currentSortMode = mode;
            closeAllToolbarDropdowns();
            document.querySelectorAll('[id^="sortLabel-"]').forEach(el => {
                el.innerText = getSortLabel(mode);
            });
            document.querySelectorAll('.toolbar-dropdown-item[data-sort]').forEach(btn => {
                const isActive = btn.dataset.sort === mode;
                btn.classList.toggle('active', isActive);
                const check = btn.querySelector('.item-check');
                if (check) check.innerText = isActive ? '✓' : '';
            });
            reorderCards();
        }

        function setMoodFilter(mood, qId) {
            currentMoodFilter = mood;
            closeAllToolbarDropdowns();
            document.querySelectorAll('[id^="moodLabel-"]').forEach(el => {
                el.innerText = getMoodLabel(mood);
            });
            document.querySelectorAll('.toolbar-dropdown-item[data-mood]').forEach(btn => {
                const isActive = btn.dataset.mood === mood;
                btn.classList.toggle('active', isActive);
                const check = btn.querySelector('.item-check');
                if (check) check.innerText = isActive ? '✓' : '';
            });
            applyMoodFilter();
        }

        function reorderCards() {
            const aContainer = document.getElementById(`answers-${activeQuestionId}`);
            if (!aContainer) return;
            const cards = Array.from(aContainer.querySelectorAll('.answer-card'));
            if (cards.length <= 1) return;

            cards.sort((a, b) => {
                if (currentSortMode === 'votes') {
                    const vA = parseInt(a.dataset.votes || '0', 10);
                    const vB = parseInt(b.dataset.votes || '0', 10);
                    if (vB !== vA) return vB - vA;
                    const cA = parseInt(a.dataset.created || '0', 10);
                    const cB = parseInt(b.dataset.created || '0', 10);
                    return cB - cA;
                } else if (currentSortMode === 'newest') {
                    const cA = parseInt(a.dataset.created || '0', 10);
                    const cB = parseInt(b.dataset.created || '0', 10);
                    return cB - cA;
                } else if (currentSortMode === 'oldest') {
                    const cA = parseInt(a.dataset.created || '0', 10);
                    const cB = parseInt(b.dataset.created || '0', 10);
                    return cA - cB;
                }
                return 0;
            });

            cards.forEach(card => aContainer.appendChild(card));
        }

        function applyMoodFilter() {
            const cards = document.querySelectorAll(`#answers-${activeQuestionId} .answer-card`);
            cards.forEach(card => {
                const matchesMood = (currentMoodFilter === 'all') || (card.dataset.moodGroup === currentMoodFilter);
                const matchesCluster = (currentClusterFilter === 'all') || (card.dataset.clusterTag === currentClusterFilter);
                card.style.display = (matchesMood && matchesCluster) ? '' : 'none';
            });
        }

        function toggleBoardToolbar(qId) {
            isToolbarCollapsed = !isToolbarCollapsed;
            localStorage.setItem('retro_toolbar_collapsed', isToolbarCollapsed ? 'true' : 'false');
            updateToolbarVisibility();
            showToast(isToolbarCollapsed ? 'Filters & sort hidden' : 'Filters & sort visible', 'info');
        }

        function updateToolbarVisibility() {
            document.querySelectorAll('.board-toolbar').forEach(tb => {
                if (isToolbarCollapsed) {
                    tb.classList.add('toolbar-collapsed');
                } else {
                    tb.classList.remove('toolbar-collapsed');
                }
            });
            document.querySelectorAll('.toolbar-toggle-btn').forEach(btn => {
                const arrow = btn.querySelector('.toolbar-toggle-arrow');
                if (arrow) {
                    arrow.textContent = isToolbarCollapsed ? '▸' : '▾';
                }
                if (isToolbarCollapsed) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }

        function toggleCardDropdown(cardId) {
            const menu = document.getElementById(`card-dropdown-${cardId}`);
            const btn = document.getElementById(`card-dropdown-btn-${cardId}`);
            const isShowing = menu && menu.classList.contains('show');
            
            closeAllCardDropdowns();
            
            if (!isShowing && menu && btn) {
                menu.classList.add('show');
                btn.classList.add('active');
                const arrow = btn.querySelector('.dropdown-arrow');
                if (arrow) arrow.textContent = '▴';
            }
        }

        function closeAllCardDropdowns() {
            document.querySelectorAll('.card-dropdown-menu.show').forEach(m => {
                m.classList.remove('show');
            });
            document.querySelectorAll('.card-dropdown-toggle.active').forEach(b => {
                b.classList.remove('active');
                const arrow = b.querySelector('.dropdown-arrow');
                if (arrow) arrow.textContent = '▾';
            });
        }

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.card-actions-dropdown')) {
                closeAllCardDropdowns();
            }
            if (!e.target.closest('.topbar-presence-container')) {
                closePresenceDropdown();
            }
            if (!e.target.closest('#sm-controls')) {
                closeFacilitatorDropdown();
            }
            if (!e.target.closest('#toolsDropdownContainer')) {
                closeToolsDropdown();
            }
            if (!e.target.closest('.topic-dropdown-container')) {
                closeTopicDropdowns();
            }
            if (!e.target.closest('.toolbar-dropdown-container')) {
                closeAllToolbarDropdowns();
            }
        });

        // ==========================================
        // Thematic Card Clustering & Duplicate Grouping (Module 6)
        // ==========================================
        let currentClusterFilter = 'all';
        let allSessionClusterTags = [];

        async function refreshSessionClusterTags() {
            if (!sessionId) return;
            try {
                const res = await fetch(`/api/session/clusters?session_id=${sessionId}`);
                if (res.ok) {
                    const data = await res.json();
                    allSessionClusterTags = (data || []).map(item => item.tag).filter(Boolean);
                }
            } catch (e) {}
        }

        function updateTopicClusterPills(qId, topicTags) {
            const group = document.getElementById(`cluster-filter-group-${qId}`);
            const container = document.getElementById(`cluster-pills-${qId}`);
            if (!group || !container) return;

            if (!topicTags || topicTags.length === 0) {
                group.style.display = 'none';
                return;
            }

            group.style.display = 'flex';
            let html = `<button class="toolbar-pill ${currentClusterFilter === 'all' ? 'active' : ''}" onclick="setClusterFilter('all', '${qId}')">#All</button>`;
            topicTags.forEach(tag => {
                const isActive = currentClusterFilter === tag;
                html += `<button class="toolbar-pill ${isActive ? 'active' : ''}" onclick="setClusterFilter('${escapeText(tag)}', '${qId}')">#${escapeText(tag)}</button>`;
            });
            container.innerHTML = html;
        }

        function setClusterFilter(tag, qId) {
            currentClusterFilter = tag;
            const targetQId = qId || activeQuestionId;
            const group = document.getElementById(`cluster-pills-${targetQId}`);
            if (group) {
                group.querySelectorAll('.toolbar-pill').forEach(pill => {
                    const pillText = pill.innerText.replace(/^#/, '');
                    pill.classList.toggle('active', (tag === 'all' && pillText === 'All') || pillText === tag);
                });
            }
            applyMoodFilter();
            showToast(`Cluster: ${tag === 'all' ? 'ALL' : '#' + tag}`, 'info');
        }

        function filterByClusterTag(tag, qId) {
            currentClusterFilter = tag;
            const targetQId = qId || activeQuestionId;
            currentMoodFilter = 'all';
            const moodGroup = document.getElementById(`board-toolbar-${targetQId}`);
            if (moodGroup) {
                moodGroup.querySelectorAll('[data-mood]').forEach(b => b.classList.toggle('active', b.dataset.mood === 'all'));
            }
            const clusterGroup = document.getElementById(`cluster-pills-${targetQId}`);
            if (clusterGroup) {
                clusterGroup.querySelectorAll('.toolbar-pill').forEach(pill => {
                    const pillText = pill.innerText.replace(/^#/, '');
                    pill.classList.toggle('active', pillText === tag);
                });
            }
            applyMoodFilter();
            showToast(`Filtered by Cluster: #${tag}`, 'info');
        }

        function openClusterModal(answerId, currentTag) {
            const modal = document.getElementById('clusterModal');
            if (!modal) return;

            document.getElementById('clusterAnswerId').value = answerId;
            const input = document.getElementById('clusterTagInput');
            if (input) {
                input.value = currentTag || '';
            }

            const section = document.getElementById('existingClustersSection');
            const cloud = document.getElementById('clusterTagsCloud');
            if (cloud && allSessionClusterTags.length > 0) {
                cloud.innerHTML = allSessionClusterTags.map(tag => `
                    <button type="button" class="cluster-chip" onclick="selectClusterChip('${escapeText(tag)}')">
                        🏷️ #${escapeText(tag)}
                    </button>
                `).join('');
                if (section) section.style.display = 'block';
            } else if (section) {
                section.style.display = 'none';
            }

            modal.classList.remove('hidden');
            SoundFX.playPop();
            if (input) setTimeout(() => input.focus(), 50);
        }

        function selectClusterChip(tag) {
            const input = document.getElementById('clusterTagInput');
            if (input) {
                input.value = tag;
                input.focus();
            }
        }

        function closeClusterModal() {
            const modal = document.getElementById('clusterModal');
            if (modal) {
                modal.classList.add('hidden');
            }
        }

        async function saveCardCluster() {
            const answerId = document.getElementById('clusterAnswerId').value;
            const tag = (document.getElementById('clusterTagInput').value || '').trim();

            if (!sessionId || !answerId) return;

            try {
                const res = await fetch('/api/answer/cluster', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session_id: sessionId,
                        answer_id: answerId,
                        cluster_tag: tag
                    })
                });

                if (res.ok) {
                    closeClusterModal();
                    SoundFX.playDing();
                    RetroConfetti.fire({ particleCount: 35, spread: 0.8 });
                    showToast(tag ? `Card clustered under #${tag}` : 'Cluster tag removed', 'success');
                    await loadAnswers();
                    await refreshSessionClusterTags();
                } else {
                    const err = await res.text();
                    showToast(`Cluster error: ${err}`, 'error');
                }
            } catch (e) {
                showToast('Failed to save cluster tag', 'error');
            }
        }

        async function removeCardCluster() {
            const input = document.getElementById('clusterTagInput');
            if (input) input.value = '';
            await saveCardCluster();
        }

        function toggleFlipAllCards() {
            const cards = document.querySelectorAll(`#answers-${activeQuestionId} .answer-card:not(.processing)`);
            if (cards.length === 0) return showToast("No cards to flip!", "info");
            allCardsFlipped = !allCardsFlipped;
            SoundFX.playRevealCascade(Math.min(cards.length, 8));
            cards.forEach((card, idx) => {
                setTimeout(() => {
                    card.classList.toggle('flipped', allCardsFlipped);
                }, idx * 40);
            });
        }

        function openShortcutsModal() {
            const modal = document.getElementById('shortcutsModal');
            if (modal) {
                modal.classList.remove('hidden');
                SoundFX.playPop();
            }
        }

        function closeShortcutsModal() {
            const modal = document.getElementById('shortcutsModal');
            if (modal) modal.classList.add('hidden');
        }

        // ==========================================
        // Action Items Tracker & Accountability (Module 4)
        // ==========================================
        let actionItemsList = [];
        let currentActionFilter = 'all'; // 'all' | 'pending' | 'completed'

        async function loadActionItems() {
            if (!sessionId) return;
            try {
                const res = await fetch(`/api/action-items/get?session_id=${sessionId}`);
                if (res.ok) {
                    actionItemsList = await res.json() || [];
                    renderActionItems();
                }
            } catch (e) {
                console.error("Error loading action items", e);
            }
        }

        function renderActionItems() {
            const container = document.getElementById('actionItemsListContainer');
            const badge = document.getElementById('actionItemsBadge');
            const statsText = document.getElementById('actionItemsStatsText');
            if (!container) return;

            const pendingCount = actionItemsList.filter(item => !item.completed).length;
            
            if (badge) {
                badge.innerText = String(pendingCount);
            }
            const toolsBadge = document.getElementById('toolsBadge');
            const toolsActionBadge = document.getElementById('toolsActionBadge');
            if (toolsActionBadge) {
                toolsActionBadge.innerText = String(pendingCount);
            }
            if (toolsBadge) {
                toolsBadge.innerText = String(pendingCount);
                toolsBadge.classList.toggle('hidden', pendingCount === 0);
            }
            if (statsText) {
                statsText.innerText = `${pendingCount} pending / ${actionItemsList.length} total`;
            }

            const filteredItems = actionItemsList.filter(item => {
                if (currentActionFilter === 'pending') return !item.completed;
                if (currentActionFilter === 'completed') return item.completed;
                return true;
            });

            if (filteredItems.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-sub); font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">
                        ${actionItemsList.length === 0 
                            ? "✨ No action items committed yet.<br>Click '⚡ Action Item' on any card or add one above!" 
                            : "No items match the selected filter."}
                    </div>`;
                return;
            }

            container.innerHTML = filteredItems.map(item => `
                <div class="action-item-card ${item.completed ? 'completed' : ''}" id="action-item-${item.id}">
                    <div class="action-item-left">
                        <input type="checkbox" class="action-checkbox" ${item.completed ? 'checked' : ''} onchange="toggleActionItem('${item.id}', ${item.completed})" title="Toggle status">
                        <span class="action-item-text">${escapeText(item.text)}</span>
                    </div>
                    <div class="action-item-meta">
                        <span class="action-badge-tag" title="Assignee">👤 ${escapeText(item.assignee || 'Unassigned')}</span>
                        <span class="action-badge-tag" title="Due Date">📅 ${escapeText(item.due_date || 'Next Sprint')}</span>
                        <button class="action-delete-btn" onclick="deleteActionItem('${item.id}')" title="Delete action item">🗑️</button>
                    </div>
                </div>
            `).join('');
        }

        function setActionFilter(filter) {
            currentActionFilter = filter;
            document.querySelectorAll('[data-action-filter]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.actionFilter === filter);
            });
            renderActionItems();
        }

        function openActionItemsModal() {
            const modal = document.getElementById('actionItemsModal');
            if (modal) {
                modal.classList.remove('hidden');
                SoundFX.playPop();
                loadActionItems();
            }
        }

        function closeActionItemsModal() {
            const modal = document.getElementById('actionItemsModal');
            if (modal) {
                modal.classList.add('hidden');
                const tInput = document.getElementById('actionItemTextInput');
                const aInput = document.getElementById('actionItemAnswerId');
                if (tInput) tInput.value = '';
                if (aInput) aInput.value = '';
            }
        }

        function convertCardToAction(cardId) {
            const card = document.querySelector(`.answer-card[data-id="${cardId}"]`);
            let text = "";
            if (card) {
                const body = card.querySelector('.card-content-body');
                if (body) text = body.innerText.trim();
            }
            openActionItemsModal();
            const textInput = document.getElementById('actionItemTextInput');
            const answerIdInput = document.getElementById('actionItemAnswerId');
            const assigneeInput = document.getElementById('actionItemAssigneeInput');
            if (textInput) textInput.value = text;
            if (answerIdInput) answerIdInput.value = cardId;
            if (assigneeInput && !assigneeInput.value) {
                assigneeInput.value = assignedGuestName || '';
            }
            if (textInput) textInput.focus();
        }

        async function submitActionItem() {
            const textEl = document.getElementById('actionItemTextInput');
            const assigneeEl = document.getElementById('actionItemAssigneeInput');
            const dueEl = document.getElementById('actionItemDueInput');
            const ansIdEl = document.getElementById('actionItemAnswerId');

            const text = (textEl ? textEl.value : '').trim();
            if (!text) {
                showToast("Please enter an action description!", "error");
                return;
            }

            const assignee = (assigneeEl ? assigneeEl.value : '').trim() || assignedGuestName || "Unassigned";
            const due = (dueEl ? dueEl.value : '').trim() || "Next Sprint";
            const ansId = ansIdEl ? ansIdEl.value : '';

            try {
                const res = await fetch('/api/action-items/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session_id: sessionId,
                        answer_id: ansId,
                        text: text,
                        assignee: assignee,
                        due_date: due
                    })
                });

                if (res.ok) {
                    const newItem = await res.json();
                    actionItemsList.unshift(newItem);
                    if (textEl) textEl.value = '';
                    if (ansIdEl) ansIdEl.value = '';
                    renderActionItems();
                    SoundFX.playPost();
                    showToast("✅ Action item committed!", "success");
                } else {
                    showToast("Failed to save action item", "error");
                }
            } catch (e) {
                showToast("Network error", "error");
            }
        }

        async function toggleActionItem(id, currentlyCompleted) {
            const newCompleted = !currentlyCompleted;
            try {
                const res = await fetch('/api/action-items/toggle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session_id: sessionId,
                        id: id,
                        completed: newCompleted
                    })
                });

                if (res.ok) {
                    const item = actionItemsList.find(it => it.id === id);
                    if (item) item.completed = newCompleted;
                    if (newCompleted) {
                        SoundFX.playDing();
                        RetroConfetti.fire({ particleCount: 40, spread: 0.9 });
                        showToast("🎉 Action item completed!", "success");
                    } else {
                        SoundFX.playPop();
                        showToast("Action item marked pending", "info");
                    }
                    renderActionItems();
                }
            } catch (e) {
                showToast("Error updating action item", "error");
            }
        }

        async function deleteActionItem(id) {
            if (!confirm("Delete this action item?")) return;
            try {
                const res = await fetch('/api/action-items/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session_id: sessionId,
                        id: id
                    })
                });

                if (res.ok) {
                    actionItemsList = actionItemsList.filter(it => it.id !== id);
                    renderActionItems();
                    showToast("Action item deleted", "info");
                }
            } catch (e) {
                showToast("Error deleting item", "error");
            }
        }

        async function loadAnswers() {
            if (!activeQuestionId) return;
            const activePage = questionPagination[activeQuestionId] || { limit: 12, hasMore: true };
            
            try {
                const res = await fetch(`/api/session/answers?session_id=${sessionId}&question_id=${activeQuestionId}&limit=${activePage.limit}`);
                const answers = await res.json();
                
                if (answers.length < activePage.limit) {
                    activePage.hasMore = false;
                } else {
                    activePage.hasMore = true;
                }

                if (!activePage.hasMore || answers.length > (topicAnswerCounts[activeQuestionId] || 0)) {
                    updateTopicAnswerCount(activeQuestionId, answers.length);
                }
                
                const q = currentQuestions.find(currQ => currQ.id === activeQuestionId);
                if (!q) return;
                
                const aContainer = document.getElementById(`answers-${q.id}`);
                if (!aContainer) return;
                
                const votedKeys = JSON.parse(localStorage.getItem('voted_cards') || '[]');
                const maxVotes = Math.max(0, ...answers.map(a => a.votes || 0));

                if (answers.length === 0) {
                    aContainer.innerHTML = `
                        <div class="empty-topic-state" onclick="openSubmitModal('${q.id}', '${q.text.replace(/'/g, "\\'")}')" style="grid-column: 1 / -1;">
                            <div class="empty-topic-icon">🎬 💭</div>
                            <div class="empty-topic-title">No reflections posted yet</div>
                            <div class="empty-topic-desc">Be the first to break the ice! Post what went well or what blocked you, along with an expressive reaction GIF or meme.</div>
                            <button class="btn btn-primary" style="margin-top: 1.25rem; font-size: 0.85rem;" onclick="event.stopPropagation(); openSubmitModal('${q.id}', '${q.text.replace(/'/g, "\\'")}')">✍️ Post First Card & GIF</button>
                        </div>`;
                } else {
                    const emptyEl = aContainer.querySelector('.empty-topic-state');
                    if (emptyEl) emptyEl.remove();
                }

                answers.forEach(a => {
                    const existingCard = document.querySelector(`.answer-card[data-id="${a.id}"]`);
                    const isProcessing = !a.sentiment_emoji || a.sentiment_emoji === '' || a.sentiment_emoji === '⏳' || a.sentiment_emotion === 'Analyzing...';
                    const color = a.sentiment_color || '#94a3b8';
                    const emotData = getRetroEmoticonData(a.sentiment_emoji, a.sentiment_emotion, a.id);
                    const displayEmot = emotData.text;
                    const emotType = emotData.type;
                    const votes = a.votes || 0;
                    const hasVoted = votedKeys.includes(a.id);
                    const isTopVoted = maxVotes > 0 && votes === maxVotes;

                    let moodGroup = 'all';
                    if (['party', 'love', 'joy', 'cool'].includes(emotType) || color === '#10b981') {
                        moodGroup = 'wins';
                    } else if (['fight', 'panic', 'exhausted', 'crying', 'nervous', 'angry', 'sad'].includes(emotType) || color === '#ef4444') {
                        moodGroup = 'challenges';
                    } else if (['mindblown', 'curious', 'skeptical'].includes(emotType) || color === '#8b5cf6' || color === '#f59e0b') {
                        moodGroup = 'ideas';
                    }
                    const createdAtTime = a.created_at ? new Date(a.created_at).getTime() : 0;
                    
                    const frontContent = isProcessing 
                        ? `<div class="ai-thinking"><div class="ai-loader-icon">✦</div><div class="ai-status">Thinking...</div></div>` 
                        : `<div class="emoji-main emot-${emotType}">${displayEmot}</div><div class="emoji-sub">${a.sentiment_emotion}</div>`;
                    
                    const cardHtml = `
                        <div class="card-face card-front">
                            ${isTopVoted ? `<div class="top-voted-badge">🔥 TOP VOTED</div>` : ''}
                            ${a.cluster_tag ? `<div class="card-cluster-badge" onclick="event.stopPropagation(); filterByClusterTag('${escapeText(a.cluster_tag)}', '${q.id}')">🏷️ #${escapeText(a.cluster_tag)}</div>` : ''}
                            ${frontContent}
                            ${a.sentiment_color === '#ef4444' ? `<div class="warning-overlay"><span>⚠️ Critical</span></div>` : ''}
                            <div style="position: absolute; bottom: 1rem; right: 1rem;">
                                <button class="card-vote-btn ${hasVoted ? 'has-voted' : ''}" onclick="event.stopPropagation(); voteCard('${a.id}')" title="Upvote feedback">
                                    ▲ <span>${votes}</span>
                                </button>
                            </div>
                        </div>
                        <div class="card-face card-back">
                            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
                                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                    <span style="font-weight: 800; font-size: 0.75rem; color: var(--accent-primary); text-transform: uppercase;">${escapeText(a.author_name || 'Anonymous')}</span>
                                    ${isTopVoted ? `<span class="top-voted-pill">🔥 Top</span>` : ''}
                                    ${a.cluster_tag ? `<span class="back-cluster-pill" onclick="event.stopPropagation(); filterByClusterTag('${escapeText(a.cluster_tag)}', '${q.id}')">🏷️ #${escapeText(a.cluster_tag)}</span>` : ''}
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <button class="card-vote-btn ${hasVoted ? 'has-voted' : ''}" onclick="event.stopPropagation(); voteCard('${a.id}')" title="Upvote feedback">
                                        ▲ <span>${votes}</span>
                                    </button>
                                    <span class="back-emot-pill">${displayEmot}</span>
                                    <div style="background: ${color}; width: 10px; height: 10px; border: 1px solid var(--border-color);"></div>
                                </div>
                            </div>
                            <div class="card-content-body">${sanitizeHTML(a.text)}</div>
                            ${a.gif_url ? `<div style="width: 100%; margin-top: 15px; border-radius: 0px; border: 3px solid var(--border-color); overflow: hidden; background: rgba(0,0,0,0.05);"><img src="${escapeText(a.gif_url)}" loading="lazy" style="width: 100%; max-height: 250px; object-fit: contain; display: block;"></div>` : ''}
                            <div class="card-actions-dropdown">
                                <button class="card-dropdown-toggle" id="card-dropdown-btn-${a.id}" onclick="event.stopPropagation(); toggleCardDropdown('${a.id}')" title="Actions menu">
                                    <span>⚡ Actions</span> <span class="dropdown-arrow">▾</span>
                                </button>
                                <div class="card-dropdown-menu" id="card-dropdown-${a.id}">
                                    <button class="card-dropdown-item" onclick="event.stopPropagation(); convertCardToAction('${a.id}'); closeAllCardDropdowns();" title="Turn this reflection into a commitment/action item">
                                        <span>⚡ Action Item</span>
                                    </button>
                                    ${isModerator ? `
                                        <button class="card-dropdown-item ${currentSpotlight && currentSpotlight.active && currentSpotlight.answer_id === a.id ? 'active' : ''}" data-spotlight-card-id="${a.id}" onclick="event.stopPropagation(); toggleSpotlightCard('${q.id}', '${a.id}'); closeAllCardDropdowns();" title="Spotlight focus this card for all participants">
                                            <span>${currentSpotlight && currentSpotlight.active && currentSpotlight.answer_id === a.id ? '🔦 Remove Focus' : '🔦 Spotlight Focus'}</span>
                                        </button>
                                        <button class="card-dropdown-item ${a.cluster_tag ? 'has-tag' : ''}" onclick="event.stopPropagation(); openClusterModal('${a.id}', '${escapeText(a.cluster_tag || '')}'); closeAllCardDropdowns();" title="Categorize or cluster this reflection">
                                            <span>🏷️ ${a.cluster_tag ? '#' + escapeText(a.cluster_tag) : 'Cluster'}</span>
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                        </div>`;
                    
                    const isCardSpotlighted = currentSpotlight && currentSpotlight.active && currentSpotlight.answer_id === a.id;

                    if (!existingCard) {
                        const card = document.createElement('div');
                        card.className = `answer-card ${isProcessing ? 'processing' : ''} ${isCardSpotlighted ? 'spotlight-active flipped' : ''}`;
                        card.tabIndex = 0;
                        card.dataset.id = a.id;
                        card.dataset.sentiment = color;
                        card.dataset.processing = isProcessing;
                        card.dataset.votes = String(votes);
                        card.dataset.topVoted = String(isTopVoted);
                        card.dataset.moodGroup = moodGroup;
                        card.dataset.clusterTag = a.cluster_tag || '';
                        card.dataset.created = String(createdAtTime);
                        card.style.setProperty('--mood-color', color);
                        card.onclick = () => { 
                            if (!card.classList.contains('processing')) {
                                SoundFX.playFlip();
                                card.classList.toggle('flipped'); 
                            }
                        };
                        card.innerHTML = cardHtml;
                        aContainer.appendChild(card);
                    } else {
                        existingCard.tabIndex = 0;
                        existingCard.dataset.votes = String(votes);
                        existingCard.dataset.topVoted = String(isTopVoted);
                        existingCard.dataset.moodGroup = moodGroup;
                        existingCard.dataset.clusterTag = a.cluster_tag || '';
                        existingCard.dataset.created = String(createdAtTime);
                        if (isCardSpotlighted) {
                            existingCard.classList.add('spotlight-active', 'flipped');
                        } else {
                            existingCard.classList.remove('spotlight-active');
                        }
                        if (existingCard.dataset.sentiment !== color || existingCard.dataset.processing !== String(isProcessing) || existingCard.dataset.votes !== String(votes) || existingCard.dataset.topVoted !== String(isTopVoted) || existingCard.dataset.clusterTag !== (a.cluster_tag || '')) {
                            existingCard.dataset.sentiment = color;
                            existingCard.dataset.processing = String(isProcessing);
                            existingCard.className = `answer-card ${isProcessing ? 'processing' : ''} ${existingCard.classList.contains('flipped') || isCardSpotlighted ? 'flipped' : ''} ${isCardSpotlighted ? 'spotlight-active' : ''}`;
                            existingCard.style.setProperty('--mood-color', color);
                            existingCard.innerHTML = cardHtml;
                            existingCard.onclick = () => { 
                                if (!existingCard.classList.contains('processing')) {
                                    SoundFX.playFlip();
                                    existingCard.classList.toggle('flipped'); 
                                }
                            };
                        }
                    }
                });
                
                const topicClusterTags = [...new Set(answers.map(ans => ans.cluster_tag).filter(Boolean))];
                updateTopicClusterPills(q.id, topicClusterTags);

                reorderCards();
                applyMoodFilter();
                updateVoteBudgetUI();

                const statusEl = document.getElementById(`load-more-status-${q.id}`);
                if (statusEl) {
                    if (!activePage.hasMore) {
                        statusEl.innerText = "✨ ALL REFLECTIONS LOADED FOR THIS TOPIC";
                    } else {
                        statusEl.innerText = "▼ SCROLL DOWN TO LOAD MORE";
                    }
                }
            } catch (e) {
                console.error("Error loading answers", e);
            }
        }

        // ==========================================
        // Multi-Layer Anti-Tamper Voting System
        // ==========================================
        let voterRemainingVotes = 5;
        let voterVotedCards = [];
        let assignedGuestName = "Anonymous Guest";

        /* getDeviceFingerprint extracted to static/js/fingerprint.js */

        async function syncVoterStatus() {
            try {
                const fp = getDeviceFingerprint();
                const res = await fetch(`/api/session/voter-status?session_id=${sessionId}&device_fingerprint=${fp}`, {
                    headers: { 'X-Device-Fingerprint': fp }
                });
                if (res.ok) {
                    const data = await res.json();
                    voterRemainingVotes = typeof data.remaining_votes === 'number' ? data.remaining_votes : 5;
                    voterVotedCards = data.voted_answers || [];
                    if (data.guest_name) {
                        assignedGuestName = data.guest_name;
                        const aliasEl = document.getElementById('assignedAliasDisplay');
                        if (aliasEl) aliasEl.innerText = assignedGuestName;
                    }
                    localStorage.setItem('voted_cards', JSON.stringify(voterVotedCards));
                    updateVoteBudgetUI();
                }
            } catch(e) {}
        }

        function updateVoteBudgetUI() {
            const badge = document.getElementById('voteBudgetBadge');
            const countEl = document.getElementById('voteBudgetCount');
            if (countEl) countEl.innerText = voterRemainingVotes;
            if (badge) {
                if (voterRemainingVotes === 0) {
                    badge.classList.add('exhausted');
                    badge.title = "All 5 dot votes have been used";
                } else {
                    badge.classList.remove('exhausted');
                    badge.title = `${voterRemainingVotes} dot votes remaining`;
                }
            }
            
            document.querySelectorAll('.card-vote-btn').forEach(btn => {
                const card = btn.closest('.answer-card');
                if (!card) return;
                const cardId = card.dataset.id;
                if (voterVotedCards.includes(cardId)) {
                    btn.classList.add('has-voted');
                    btn.classList.remove('disabled-quota');
                    btn.title = "You upvoted this card";
                } else if (voterRemainingVotes <= 0) {
                    btn.classList.add('disabled-quota');
                    btn.title = "All 5 dot votes have been used!";
                } else {
                    btn.classList.remove('disabled-quota');
                    btn.title = "Upvote feedback";
                }
            });
        }

        async function voteCard(id) {
            SoundFX.playVote();
            const fp = getDeviceFingerprint();
            
            if (voterVotedCards.includes(id)) {
                showToast("You've already upvoted this card!", "info");
                return;
            }
            
            if (voterRemainingVotes <= 0) {
                showToast("🎯 You've reached your 5-vote limit for this session!", "info");
                return;
            }

            // Optimistic UI updates
            voterVotedCards.push(id);
            voterRemainingVotes = Math.max(0, voterRemainingVotes - 1);
            localStorage.setItem('voted_cards', JSON.stringify(voterVotedCards));
            updateVoteBudgetUI();

            document.querySelectorAll(`.answer-card[data-id="${id}"] .card-vote-btn`).forEach(btn => {
                btn.classList.add('has-voted');
                const span = btn.querySelector('span');
                if (span) span.innerText = parseInt(span.innerText || '0') + 1;
            });
            
            try {
                const res = await fetch('/api/answer/vote', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Device-Fingerprint': fp
                    },
                    body: JSON.stringify({ 
                        session_id: sessionId, 
                        answer_id: id,
                        device_fingerprint: fp
                    })
                });
                
                const data = await res.json();
                if (res.ok) {
                    if (typeof data.remaining_votes === 'number') {
                        voterRemainingVotes = data.remaining_votes;
                    }
                    RetroConfetti.fire({ particleCount: 30, spread: 0.8 });
                    showToast(`👍 Vote counted! (${voterRemainingVotes} votes left)`, "success");
                    loadAnswers();
                } else {
                    showToast(data.message || "Could not record vote", "error");
                    syncVoterStatus();
                }
            } catch(e) {
                syncVoterStatus();
            }
        }

        function revealAllCards() {
            const cards = document.querySelectorAll(`#answers-${activeQuestionId} .answer-card`);
            if (cards.length === 0) return showToast("No cards to reveal yet!", "info");
            SoundFX.playRevealCascade(Math.min(cards.length, 8));
            RetroConfetti.fire({ particleCount: 80, spread: 1.2 });
            cards.forEach((card, idx) => {
                setTimeout(() => {
                    card.classList.add('flipped');
                }, idx * 90);
            });
            showToast("🪄 All cards revealed!", "success");
        }

        async function loadMoreAnswers() {
            if (isLoadingMore) return;
            const page = questionPagination[activeQuestionId];
            if (!page || !page.hasMore) return;
            
            isLoadingMore = true;
            page.limit += 12;
            await loadAnswers();
            isLoadingMore = false;
        }

        window.addEventListener('scroll', () => {
            if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 150) {
                loadMoreAnswers();
            }
        });

        // Common Logic (Gifs, Upload, PDF, CRUD)
        function debouncedSearch(resultId, inputId, previewId) { 
            clearTimeout(searchTimeout); 
            searchTimeout = setTimeout(() => searchGifs(resultId, inputId, previewId), 500); 
        }
        async function searchGifs(resultId, inputId, previewId) { 
            const searchInput = (resultId === 'q-gif-results' ? document.getElementById('qGifSearch') : document.getElementById('gifSearchQuery'));
            const query = (searchInput ? searchInput.value : '').trim(); 
            if (query.length < 2) return; 
            const resContainer = document.getElementById(resultId);
            if (resContainer) resContainer.innerHTML = '<div style="padding: 0.5rem; font-family: monospace; font-size: 0.75rem; color: var(--text-sub);">Searching GIFs...</div>';
            try {
                const res = await fetch(`/api/gifs/search?q=${encodeURIComponent(query)}`); 
                const data = await res.json(); 
                if (data && data.data && resContainer) {
                    resContainer.innerHTML = data.data.map(g => `<img src="${g.images.fixed_height_small.url}" class="gif-item" onclick="selectGif('${g.images.fixed_height.url}', this, '${resultId}', '${inputId}', '${previewId}')">`).join(''); 
                }
            } catch (err) {
                if (resContainer) resContainer.innerHTML = '<div style="padding: 0.5rem; font-size: 0.75rem; color: var(--accent-danger);">Error fetching GIFs</div>';
            }
        }
        async function quickSearchGif(keyword, resultId, inputId, previewId, searchInputId) {
            const input = document.getElementById(searchInputId);
            if (input) input.value = keyword;
            const resContainer = document.getElementById(resultId);
            if (resContainer) resContainer.innerHTML = '<div style="padding: 0.5rem; font-family: monospace; font-size: 0.75rem; color: var(--text-sub);">Searching GIFs...</div>';
            try {
                const res = await fetch(`/api/gifs/search?q=${encodeURIComponent(keyword)}`);
                const data = await res.json();
                if (data && data.data && resContainer) {
                    resContainer.innerHTML = data.data.map(g => `<img src="${g.images.fixed_height_small.url}" class="gif-item" onclick="selectGif('${g.images.fixed_height.url}', this, '${resultId}', '${inputId}', '${previewId}')">`).join('');
                }
            } catch (e) {
                if (resContainer) resContainer.innerHTML = '<div style="padding: 0.5rem; font-size: 0.75rem; color: var(--accent-danger);">Error fetching GIFs</div>';
            }
        }
        function selectGif(url, el, resultId, inputId, previewId) { 
            const targetInput = document.getElementById(inputId);
            if (targetInput) targetInput.value = url; 
            document.querySelectorAll(`#${resultId} .gif-item`).forEach(i => i.classList.remove('selected')); 
            if (el) el.classList.add('selected'); 
            const targetPreview = document.getElementById(previewId || (resultId === 'q-gif-results' ? 'q-preview' : 'submit-gif-preview')); 
            if (targetPreview) {
                targetPreview.innerHTML = `
                    <div class="media-preview-inner">
                        <img src="${url}" class="media-preview-img">
                        <button type="button" class="remove-media-btn" onclick="clearSelectedMedia('${inputId}', '${previewId || (resultId === 'q-gif-results' ? 'q-preview' : 'submit-gif-preview')}', '${resultId}')">✕ Remove</button>
                    </div>`;
            }
        }
        function clearSelectedMedia(inputId, previewId, resultId) {
            const input = document.getElementById(inputId);
            if (input) input.value = '';
            const preview = document.getElementById(previewId);
            if (preview) preview.innerHTML = '';
            if (resultId) {
                document.querySelectorAll(`#${resultId} .gif-item`).forEach(i => i.classList.remove('selected'));
            }
        }
        async function handleFileUpload(input, targetInputId, previewId) { 
            const file = input.files[0]; 
            if (!file) return; 
            const fd = new FormData(); 
            fd.append('image', file); 
            try { 
                const res = await fetch('/api/upload', { method: 'POST', body: fd }); 
                const data = await res.json(); 
                if (data.url) { 
                    const targetInput = document.getElementById(targetInputId);
                    if (targetInput) targetInput.value = data.url; 
                    const prevEl = document.getElementById(previewId || (targetInputId === 'qModalGif' ? 'q-preview' : 'submit-gif-preview')); 
                    if (prevEl) {
                        prevEl.innerHTML = `
                            <div class="media-preview-inner">
                                <img src="${data.url}" class="media-preview-img">
                                <button type="button" class="remove-media-btn" onclick="clearSelectedMedia('${targetInputId}', '${previewId || (targetInputId === 'qModalGif' ? 'q-preview' : 'submit-gif-preview')}')">✕ Remove</button>
                            </div>`;
                    }
                    showToast("Uploaded!", "success"); 
                } else {
                    showToast("Upload failed", "error");
                }
            } catch (e) { 
                showToast("Failed to upload image", "error"); 
            } 
        }
        function openQuestionModal(id = '', text = '', gif = '') { 
            document.getElementById('editQId').value = id; 
            document.getElementById('qModalText').value = text; 
            document.getElementById('qModalGif').value = gif; 
            document.getElementById('qModalTitle').innerText = id ? 'Edit Topic' : 'Add Topic'; 
            const searchInput = document.getElementById('qGifSearch');
            if (searchInput) searchInput.value = '';
            const results = document.getElementById('q-gif-results');
            if (results) results.innerHTML = '';
            const previewEl = document.getElementById('q-preview');
            if (previewEl) {
                previewEl.innerHTML = gif ? `
                    <div class="media-preview-inner">
                        <img src="${gif}" class="media-preview-img">
                        <button type="button" class="remove-media-btn" onclick="clearSelectedMedia('qModalGif', 'q-preview', 'q-gif-results')">✕ Remove</button>
                    </div>` : ''; 
            }
            document.getElementById('deleteQBtn').style.display = id ? 'block' : 'none'; 
            document.getElementById('questionModal').classList.remove('hidden'); 
        }
        function closeQuestionModal() { document.getElementById('questionModal').classList.add('hidden'); }
        async function saveQuestion() { const id = document.getElementById('editQId').value; const t = document.getElementById('qModalText').value; const g = document.getElementById('qModalGif').value; const res = await fetch(id ? '/api/question/update' : '/api/question/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionId, id: id || undefined, text: t, gif_url: g }) }); if (res.ok) { closeQuestionModal(); loadQuestions(); showToast("Saved", "success"); } }
        async function deleteQuestion() { const id = document.getElementById('editQId').value; if (!confirm("Delete?")) return; const res = await fetch('/api/question/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionId, id: id }) }); if (res.ok) { closeQuestionModal(); loadQuestions(); showToast("Deleted", "error"); } }
        function openSubmitModal(id, text) { 
            activeQuestionId = id; 
            document.getElementById('modalQuestionTitle').innerText = text; 
            const aliasEl = document.getElementById('assignedAliasDisplay');
            if (aliasEl) aliasEl.innerText = assignedGuestName;
            document.getElementById('submitModal').classList.remove('hidden'); 
            quill.setContents([]); 
            document.getElementById('selectedGifUrl').value = ''; 
            const searchInput = document.getElementById('gifSearchQuery');
            if (searchInput) searchInput.value = '';
            const results = document.getElementById('gif-results');
            if (results) results.innerHTML = '';
            const preview = document.getElementById('submit-gif-preview');
            if (preview) preview.innerHTML = '';
        }
        function closeSubmitModal() { document.getElementById('submitModal').classList.add('hidden'); }
        document.getElementById('sendAnswerBtn').onclick = async () => { 
            const t = quill.root.innerHTML; 
            const g = document.getElementById('selectedGifUrl').value; 
            const fp = getDeviceFingerprint();
            if (quill.getText().trim().length < 2) return showToast("Empty", "error"); 
            try { 
                const res = await fetch('/api/answer/submit', { 
                    method: 'POST', 
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Device-Fingerprint': fp
                    }, 
                    body: JSON.stringify({ 
                        session_id: sessionId, 
                        question_id: activeQuestionId, 
                        text: t, 
                        gif_url: g,
                        device_fingerprint: fp
                    }) 
                }); 
                if (res.ok) { 
                    const data = await res.json();
                    if (data.author_name) {
                        assignedGuestName = data.author_name;
                    }
                    const newCount = (topicAnswerCounts[activeQuestionId] || 0) + 1;
                    updateTopicAnswerCount(activeQuestionId, newCount);
                    SoundFX.playPost();
                    closeSubmitModal(); 
                    loadAnswers(); 
                    syncPresence();
                    showToast(`Posted as 🎭 ${assignedGuestName}!`, "success"); 
                } 
            } finally {} 
        };
        function downloadReport() { window.open(`/api/session/report?session_id=${sessionId}`, '_blank'); }
        function copyInvite() { navigator.clipboard.writeText(window.location.origin + "/session/?id=" + sessionId); showToast("Copied!", "success"); }
        function showToast(m, t) { const c = document.getElementById('toast-container'); const toast = document.createElement('div'); toast.style.cssText = `background: var(--bg-card); color: var(--text); padding: 1rem 1.5rem; border-radius: 0px; border: 3px solid var(--border-color); margin-bottom: 0.75rem; animation: fadeUp 0.4s; box-shadow: var(--glass-shadow); font-weight: 800; font-family: 'JetBrains Mono', monospace;`; toast.innerHTML = `<span>${m}</span>`; c.appendChild(toast); setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 3500); }

        // ==========================================
        // Keyboard Shortcuts Handler (Module 2)
        // ==========================================
        window.addEventListener('keydown', (e) => {
            // Check if active element is text input or editor
            const target = e.target;
            const isInput = target && (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable ||
                target.classList.contains('ql-editor') ||
                (target.closest && target.closest('.ql-editor'))
            );

            // Escape always closes open modals
            if (e.key === 'Escape') {
                closeSubmitModal();
                closeQuestionModal();
                closeShortcutsModal();
                closeActionItemsModal();
                closeClusterModal();
                closePresenceDropdown();
                return;
            }

            if (isInput) return;

            // Never intercept browser combos with modifier keys (e.g. Ctrl+Shift+R, Ctrl+R, Cmd+R, Alt+..., Ctrl+C, Ctrl+V, etc.)
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            // ? opens shortcuts cheat sheet
            if (e.key === '?' || (e.shiftKey && e.key === '/')) {
                e.preventDefault();
                openShortcutsModal();
                return;
            }

            // A opens Action Items modal
            if (e.key === 'a' || e.key === 'A') {
                e.preventDefault();
                openActionItemsModal();
                return;
            }

            // C opens Add Feedback modal
            if (e.key === 'c' || e.key === 'C') {
                e.preventDefault();
                const activeQ = currentQuestions.find(q => q.id === activeQuestionId);
                if (activeQ) openSubmitModal(activeQ.id, activeQ.text);
                return;
            }

            // ArrowLeft or J goes to previous question
            if (e.key === 'ArrowLeft' || e.key === 'j' || e.key === 'J') {
                e.preventDefault();
                prevQuestion();
                return;
            }

            // ArrowRight or K goes to next question
            if (e.key === 'ArrowRight' || e.key === 'k' || e.key === 'K') {
                e.preventDefault();
                nextQuestion();
                return;
            }

            // V cycles sort mode
            if (e.key === 'v' || e.key === 'V') {
                e.preventDefault();
                const modes = ['votes', 'newest', 'oldest'];
                const nextIdx = (modes.indexOf(currentSortMode) + 1) % modes.length;
                setSortMode(modes[nextIdx]);
                showToast(`Sort: ${modes[nextIdx].toUpperCase()}`, 'info');
                return;
            }

            // R reveals all cards
            if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                revealAllCards();
                return;
            }

            // T toggles or starts timer if moderator
            if (e.key === 't' || e.key === 'T') {
                e.preventDefault();
                if (isModerator) {
                    const playBtn = document.getElementById('timerPlayBtn');
                    if (playBtn && !playBtn.classList.contains('hidden')) {
                        startTimer();
                    }
                }
                return;
            }

            // F jumps to live spotlight/focus
            if (e.key === 'f' || e.key === 'F') {
                e.preventDefault();
                jumpToSpotlight();
                return;
            }

            // H toggles board filters & sort toolbar
            if (e.key === 'h' || e.key === 'H') {
                e.preventDefault();
                toggleBoardToolbar();
                return;
            }

            // Space or Enter on focused answer card flips it
            if (e.key === ' ' || e.key === 'Enter') {
                const focusedCard = document.activeElement && document.activeElement.closest('.answer-card');
                if (focusedCard && !focusedCard.classList.contains('processing')) {
                    e.preventDefault();
                    SoundFX.playFlip();
                    focusedCard.classList.toggle('flipped');
                } else if (!focusedCard && e.key === ' ') {
                    e.preventDefault();
                    toggleFlipAllCards();
                }
            }
        });

        window.addEventListener('DOMContentLoaded', init);
    