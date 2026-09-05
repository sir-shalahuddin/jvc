// Modern Tactile UI Sound FX Engine (Web Audio API)
class SoundService {
  private audioCtx: AudioContext | null = null;
  public muted: boolean;

  constructor() {
    this.muted = localStorage.getItem('retro_sound_muted') === 'true';
  }

  private init() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
  }

  public toggle(): boolean {
    this.muted = !this.muted;
    localStorage.setItem('retro_sound_muted', String(this.muted));
    if (!this.muted) {
      this.playVote();
    }
    return this.muted;
  }

  // Tactile card flip
  public playFlip() {
    if (this.muted) return;
    this.init();
    if (!this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

    try {
      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      // Pitch drop pop
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
    } catch (_) {}
  }

  // Tactical pop / spotlight beacon
  public playPop() {
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
    } catch (_) {}
  }

  // Satisfying crystal vote chime
  public playVote() {
    if (this.muted) return;
    this.init();
    if (!this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

    try {
      const ctx = this.audioCtx;
      const now = ctx.currentTime;

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
    } catch (_) {}
  }

  // Level-up chord when card is posted
  public playPost() {
    if (this.muted) return;
    this.init();
    if (!this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

    try {
      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C Major
      notes.forEach((freq, idx) => {
        const noteTime = now + idx * 0.045;
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
    } catch (_) {}
  }

  // Meeting bell / gong for timer finish
  public playAlarm() {
    if (this.muted) return;
    this.init();
    if (!this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

    try {
      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const chord = [392.0, 587.33, 783.99, 1174.66]; // G Major
      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.14, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + 1.2);
      });
    } catch (_) {}
  }

  // Tension tick for countdown panic mode (<= 10s)
  public playTick(isUrgent = false) {
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
    } catch (_) {}
  }

  // High-pitched chime for Action Item completion
  public playDing() {
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
    } catch (_) {}
  }

  public playClick() {
    this.playPop();
  }

  public playSuccess() {
    this.playPost();
  }
}

export const SoundFX = new SoundService();
