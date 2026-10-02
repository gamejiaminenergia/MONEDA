/**
 * Sintesis de tonos.
 *
 * Phaser sabe reproducir audio, pero no trae sonidos. En vez de meter assets
 * binarios al repo se generan aqui, en memoria y sin dependencias: la escena
 * los mete en su cache de audio como muestras y el gestor de sonido los
 * reproduce.
 */

export type ToneWave = 'sine' | 'square' | 'triangle' | 'sawtooth';

export interface ToneSpec {
  /** Frecuencia en hercios. */
  frequency: number;
  /** Duracion en segundos. */
  durationSec: number;
  wave?: ToneWave;
  /** Amplitud pico, de 0 a 1. */
  volume?: number;
  sampleRate?: number;
}

/** Cuanto tarda la envolvente en subir de cero al volumen pleno. */
const ATTACK_SEC = 0.004;

/** Valor de la onda en `t` segundos, normalizado a [-1, 1]. */
function oscillator(wave: ToneWave, t: number, frequency: number): number {
  const phase = (((t * frequency) % 1) + 1) % 1;
  switch (wave) {
    case 'sine':
      return Math.sin(phase * Math.PI * 2);
    case 'square':
      return phase < 0.5 ? 1 : -1;
    case 'triangle':
      return phase < 0.5 ? phase * 4 - 1 : 3 - phase * 4;
    case 'sawtooth':
      return phase * 2 - 1;
  }
}

/**
 * Muestras del tono, ya con la envolvente aplicada.
 *
 * La envolvente sube en `ATTACK_SEC` y baja linealmente hasta cero en el
 * ultimo instante: sin ella, cortar la onda en seco produce un chasquido.
 */
export function toneSamples({
  frequency,
  durationSec,
  wave = 'square',
  volume = 0.05,
  sampleRate = 44_100,
}: ToneSpec): Float32Array {
  const length = Math.max(1, Math.round(durationSec * sampleRate));
  const attack = Math.min(ATTACK_SEC, durationSec / 2);
  const release = Math.max(durationSec - attack, Number.EPSILON);
  const samples = new Float32Array(length);

  for (let index = 0; index < length; index += 1) {
    const t = index / sampleRate;
    const rise = attack > 0 ? Math.min(1, t / attack) : 1;
    const fall = Math.max(0, Math.min(1, (durationSec - t) / release));
    samples[index] = oscillator(wave, t, frequency) * rise * fall * volume;
  }

  return samples;
}
