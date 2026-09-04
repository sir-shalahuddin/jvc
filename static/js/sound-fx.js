// ==========================================
// Modern Tactile UI Sound FX Engine (Web Audio API)
// ==========================================
const SoundFX = {
            audioCtx: null,
            muted: localStorage.getItem('retro_sound_muted') === 'true',
            init() {
                if (!this.audioCtx && (window.AudioContext || window.webkitAudioContext)) {
                    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                }
            },
            toggle() {
                this.muted = !this.muted;
                localStorage.setItem('retro_sound_muted', this.muted);
                updateSoundIcon();
                if (!this.muted) this.playVote();
            },
            // High-quality tactile card flip / pop
            playFlip() {
                if (this.muted) return;
                this.init();
                if (!this.audioCtx) return;
                if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
                try {
                    const ctx = this.audioCtx;
                    const now = ctx.currentTime;
                    
                    // Main frequency pitch-drop pop
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    const filter = ctx.createBiquadFilter();
                    
                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(1800, now);
                    filter.frequency.exponentialRampToValueAtTime(300, now + 0.08);

                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(580, now);
                    osc.frequency.exponentialRampToValueAtTime(140, now + 0.08);

                    gain.gain.setValueAtTime(0.18, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

                    osc.connect(filter);
                    filter.connect(gain);
                    gain.connect(ctx.destination);

                    osc.start(now);
                    osc.stop(now + 0.08);

                    // Wooden tactile sub-click
                    const clickOsc = ctx.createOscillator();
                    const clickGain = ctx.createGain();
                    clickOsc.type = 'triangle';
                    clickOsc.frequency.setValueAtTime(240, now);
                    clickOsc.frequency.exponentialRampToValueAtTime(60, now + 0.04);
                    clickGain.gain.setValueAtTime(0.12, now);
                    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
                    clickOsc.connect(clickGain);
                    clickGain.connect(ctx.destination);
                    clickOsc.start(now);
                    clickOsc.stop(now + 0.04);
                } catch(e) {}
            },
            // Snappy tactical UI pop / spotlight beacon
            playPop() {
                if (this.muted) return;
                this.init();
                if (!this.audioCtx) return;
                if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
                try {
                    const ctx = this.audioCtx;
                    const now = ctx.currentTime;
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(640, now);
                    osc.frequency.exponentialRampToValueAtTime(180, now + 0.06);
                    gain.gain.setValueAtTime(0.15, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now);
                    osc.stop(now + 0.06);
                } catch(e) {}
            },
            // Satisfying crystal joycon / waterdrop chime
            playVote() {
                if (this.muted) return;
                this.init();
                if (!this.audioCtx) return;
                if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
                try {
                    const ctx = this.audioCtx;
                    const now = ctx.currentTime;
                    
                    // Fundamental chime
                    const osc1 = ctx.createOscillator();
                    const gain1 = ctx.createGain();
                    osc1.type = 'sine';
                    osc1.frequency.setValueAtTime(880, now); // A5
                    gain1.gain.setValueAtTime(0.15, now);
                    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
                    osc1.connect(gain1);
                    gain1.connect(ctx.destination);
                    osc1.start(now);
                    osc1.stop(now + 0.18);

                    // Overtone shimmer
                    const osc2 = ctx.createOscillator();
                    const gain2 = ctx.createGain();
                    osc2.type = 'sine';
                    osc2.frequency.setValueAtTime(1760, now); // A6
                    gain2.gain.setValueAtTime(0.07, now);
                    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
                    osc2.connect(gain2);
                    gain2.connect(ctx.destination);
                    osc2.start(now);
                    osc2.stop(now + 0.12);
                } catch(e) {}
            },
            // Modern warm level-up chord (Slack / Discord message pop)
            playPost() {
                if (this.muted) return;
                this.init();
                if (!this.audioCtx) return;
                if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
                try {
                    const ctx = this.audioCtx;
                    const now = ctx.currentTime;
                    const notes = [523.25, 659.25, 783.99, 1046.50]; // C Major
                    notes.forEach((freq, idx) => {
                        const noteTime = now + (idx * 0.045);
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(freq, noteTime);
                        gain.gain.setValueAtTime(0.12, noteTime);
                        gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.22);
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.start(noteTime);
                        osc.stop(noteTime + 0.22);
                    });
                } catch(e) {}
            },
            // Ambient meeting bell / Tibetan gong for timer finish
            playAlarm() {
                if (this.muted) return;
                this.init();
                if (!this.audioCtx) return;
                if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
                try {
                    const ctx = this.audioCtx;
                    const now = ctx.currentTime;
                    const chord = [392.00, 587.33, 783.99, 1174.66]; // G Major pentatonic
                    chord.forEach((freq, idx) => {
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(freq, now + (idx * 0.08));
                        gain.gain.setValueAtTime(0.14, now + (idx * 0.08));
                        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.start(now + (idx * 0.08));
                        osc.stop(now + 1.2);
                    });
                } catch(e) {}
            },
            // Tension tick / heartbeat for countdown panic mode (<= 10s)
            playTick(isUrgent = false) {
                if (this.muted) return;
                this.init();
                if (!this.audioCtx) return;
                if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
                try {
                    const ctx = this.audioCtx;
                    const now = ctx.currentTime;
                    const freq = isUrgent ? 880 : 520;
                    
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = isUrgent ? 'sawtooth' : 'triangle';
                    osc.frequency.setValueAtTime(freq, now);
                    osc.frequency.exponentialRampToValueAtTime(160, now + 0.05);
                    gain.gain.setValueAtTime(isUrgent ? 0.16 : 0.09, now);
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now);
                    osc.stop(now + 0.05);

                    if (isUrgent) {
                        // Heartbeat sub-thump
                        const subOsc = ctx.createOscillator();
                        const subGain = ctx.createGain();
                        subOsc.type = 'sine';
                        subOsc.frequency.setValueAtTime(140, now);
                        subOsc.frequency.exponentialRampToValueAtTime(40, now + 0.08);
                        subGain.gain.setValueAtTime(0.2, now);
                        subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
                        subOsc.connect(subGain);
                        subGain.connect(ctx.destination);
                        subOsc.start(now);
                        subOsc.stop(now + 0.08);
                    }
                } catch(e) {}
            },
            // Cascading fairy sparkle for Reveal All
            playRevealCascade(count = 6) {
                if (this.muted) return;
                this.init();
                if (!this.audioCtx) return;
                if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
                try {
                    const ctx = this.audioCtx;
                    const now = ctx.currentTime;
                    const scale = [440, 493.88, 554.37, 659.25, 739.99, 880, 987.77, 1108.73];
                    for (let i = 0; i < count; i++) {
                        const noteTime = now + (i * 0.07);
                        const freq = scale[i % scale.length];
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(freq, noteTime);
                        gain.gain.setValueAtTime(0.09, noteTime);
                        gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.18);
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.start(noteTime);
                        osc.stop(noteTime + 0.18);
                    }
                } catch(e) {}
            },
            // High-pitched chime for Action Item completion
            playDing() {
                if (this.muted) return;
                this.init();
                if (!this.audioCtx) return;
                if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
                try {
                    const ctx = this.audioCtx;
                    const now = ctx.currentTime;
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(880, now);
                    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.15);
                    gain.gain.setValueAtTime(0.12, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now);
                    osc.stop(now + 0.35);
                } catch(e) {}
            }
        };

        function updateSoundIcon() {
            const btn = document.getElementById('soundToggleBtn');
            if (btn) {
                btn.innerText = SoundFX.muted ? '🔇' : '🔊';
                btn.classList.toggle('muted', SoundFX.muted);
                btn.title = SoundFX.muted ? 'Unmute Sound FX' : 'Mute Sound FX';
            }
        }