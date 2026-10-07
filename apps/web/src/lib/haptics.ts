/**
 * Accessible progressive tactile haptics & audio micro-feedback.
 * Adheres to user preferences (prefers-reduced-motion) and browser capabilities.
 */

export type HapticStrength = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning';

class HapticEngine {
  private audioCtx: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    if (typeof window !== 'undefined') {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.enabled = !prefersReduced;
    }
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    return this.audioCtx;
  }

  /**
   * Triggers progressive tactile vibration and subtle acoustic click
   */
  public trigger(strength: HapticStrength = 'light') {
    if (!this.enabled || typeof window === 'undefined') return;

    // 1. Hardware Vibration API
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        switch (strength) {
          case 'selection':
          case 'light':
            navigator.vibrate(8);
            break;
          case 'medium':
            navigator.vibrate(18);
            break;
          case 'heavy':
            navigator.vibrate([30, 40, 30]);
            break;
          case 'success':
            navigator.vibrate([12, 30, 15]);
            break;
          case 'warning':
            navigator.vibrate([25, 50, 25]);
            break;
        }
      } catch {
        // Silently catch unsupported vibration environments
      }
    }

    // 2. Subtle Micro-Acoustic Feedback via Web Audio API
    try {
      const ctx = this.getAudioContext();
      if (ctx && ctx.state === 'running') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        const freq = strength === 'heavy' ? 220 : strength === 'medium' ? 330 : 540;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        const volume = strength === 'heavy' ? 0.04 : 0.02;
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.04);
      }
    } catch {
      // Audio feedback is non-blocking and optional
    }
  }
}

export const haptics = new HapticEngine();
