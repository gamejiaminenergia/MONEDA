type Wave = 'square' | 'sine' | 'triangle' | 'sawtooth';

/** Efectos de sonido generados con WebAudio: cero assets, cero dependencias. */
export class SoundBoard {
  private ctx: AudioContext | null = null;
  private muted: boolean;

  constructor(muted = false) {
    this.muted = muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  /** Debe llamarse desde un gesto del usuario (los navegadores lo exigen). */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  beep(freq: number, duration = 0.07, wave: Wave = 'square', volume = 0.05): void {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.start();
    osc.stop(now + duration);
  }
}
