import type * as Phaser from 'phaser';

import { BALL_R, CENTER, DANGER_R, H, PAD, RUNNER_R, W } from '@/lib/game/constants';
import type { GameEngine } from '@/lib/game/engine';
import { MOVE_VEC } from '@/lib/game/moves';
import { distance } from '@/lib/game/physics';
import { PLAYERS, PLAYER_COLOR, PLAYER_RING_R, type Player } from '@/lib/game/players';
import type { GameEvent, PlayerRecord } from '@/lib/game/types';

import { dashedCircle, pointerSegment } from './geometry';
import { BOARD_PALETTES, type BoardPalette, type BoardTheme } from './palette';
import { toneSamples, type ToneWave } from './tone';

/**
 * La mesa dibujada con Phaser 4.
 *
 * Phaser es la capa de presentacion: escenas, sprites, particulas, tweens,
 * camara, input y audio. La simulacion sigue viviendo en `GameEngine`, que es
 * determinista y se prueba sin navegador. La escena solo avanza el motor,
 * reacciona a sus eventos y sincroniza los objetos con `engine.view()`.
 */

export interface BoardOptions {
  /** Elemento donde Phaser inserta su canvas. */
  parent: HTMLElement;
  engine: GameEngine;
  muted?: boolean;
  /** Tema visual del lienzo; por defecto, claro. */
  theme?: BoardTheme;
  /** Se llama por cada evento del motor, en orden, antes de pintar el frame. */
  onEvent?: (event: GameEvent) => void;
}

export interface BoardHandle {
  readonly game: Phaser.Game;
  setMuted(muted: boolean): void;
  setTheme(theme: BoardTheme): void;
  destroy(): void;
}

const DOT_TEXTURE = 'nimble-dot';

/** Ningun frame simula mas de esto: un pestaneo no debe teletransportar la bola. */
const MAX_STEP_MS = 50;

/** Radio del destello que acompana a una muerte, en pixeles. */
const RING_R = 10;

interface ToneSpec {
  frequency: number;
  durationSec: number;
  wave: ToneWave;
  volume: number;
}

/** Efectos de sonido, sintetizados en memoria: el repo no guarda binarios. */
const TONES = {
  wall: { frequency: 300, durationSec: 0.03, wave: 'square', volume: 0.02 },
  kill: { frequency: 180, durationSec: 0.2, wave: 'sawtooth', volume: 0.06 },
  death: { frequency: 90, durationSec: 0.5, wave: 'sawtooth', volume: 0.06 },
  serve: { frequency: 520, durationSec: 0.05, wave: 'triangle', volume: 0.04 },
  over: { frequency: 660, durationSec: 0.12, wave: 'sine', volume: 0.06 },
  overEcho: { frequency: 880, durationSec: 0.18, wave: 'sine', volume: 0.06 },
} as const satisfies Record<string, ToneSpec>;

type GameView = ReturnType<GameEngine['view']>;

export async function createBoard(options: BoardOptions): Promise<BoardHandle> {
  // Phaser toca `window` y `document` al cargarse, asi que se importa dentro de
  // un efecto del cliente: en el servidor este modulo no existe.
  const phaser = (await import('phaser')).default;

  class BoardScene extends phaser.Scene {
    private readonly engine = options.engine;

    private ball!: Phaser.GameObjects.Arc;
    private ballGlow!: Phaser.GameObjects.Arc;
    private runners!: PlayerRecord<Phaser.GameObjects.Container>;
    private wasAlive!: PlayerRecord<boolean>;

    private table!: Phaser.GameObjects.Graphics;
    private dyn!: Phaser.GameObjects.Graphics;

    private trail!: Phaser.GameObjects.Particles.ParticleEmitter;
    private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
    private blast!: Phaser.GameObjects.Particles.ParticleEmitter;

    private serveText!: Phaser.GameObjects.Text;
    private pauseText!: Phaser.GameObjects.Text;
    private pauseShade!: Phaser.GameObjects.Rectangle;

    private muted = options.muted ?? false;
    private trailEmitting = true;
    private theme: BoardTheme = options.theme ?? 'light';
    private palette: BoardPalette = BOARD_PALETTES[this.theme];
    private bgGfx!: Phaser.GameObjects.Graphics;
    private ringGfx!: Phaser.GameObjects.Graphics;
    /** Antes de `create()` solo se guarda el tema: no hay objetos que pintar. */
    private ready = false;

    constructor() {
      super('nimble-board');
    }

    create(): void {
      const palette = this.palette;
      this.cameras.main.setBackgroundColor(palette.bg);
      this.buildDotTexture();

      this.bgGfx = this.add
        .graphics()
        .fillGradientStyle(palette.bgTop, palette.bgTop, palette.bgBottom, palette.bgBottom, 1)
        .fillRect(0, 0, W, H);

      this.ringGfx = this.add.graphics().setDepth(1);
      this.drawSpawnRing();

      this.table = this.add.graphics().setDepth(1);
      this.dyn = this.add.graphics().setDepth(2);

      const view = this.engine.view();
      this.drawTable();

      this.runners = PLAYERS.reduce((record, player) => {
        record[player] = this.buildRunner(player);
        return record;
      }, {} as PlayerRecord<Phaser.GameObjects.Container>);
      this.wasAlive = PLAYERS.reduce((record, player) => {
        record[player] = view.alive[player];
        return record;
      }, {} as PlayerRecord<boolean>);

      this.ballGlow = this.add
        .circle(CENTER, CENTER, BALL_R + 7, palette.ballGlow, palette.ballGlowAlpha)
        .setDepth(4);
      this.ball = this.add.circle(CENTER, CENTER, BALL_R, palette.ball).setDepth(5);

      this.buildEmitters();
      this.buildTexts();
      this.registerTones();

      this.ready = true;
      this.input.on('pointerdown', () => this.unlockAudio());
    }

    override update(_time: number, delta: number): void {
      const events = this.engine.step(Math.min(delta, MAX_STEP_MS));
      for (const event of events) {
        options.onEvent?.(event);
        this.react(event);
      }

      const view = this.engine.view();
      this.drawDynamic(view);
      this.sync(view);
      this.updateOverlays(view);
    }

    /** Controla el silencio desde React sin reiniciar la escena. */
    setMuted(muted: boolean): void {
      this.muted = muted;
      if (this.sound) this.sound.mute = muted;
    }

    /** Cambia el tema sin recrear la escena: repinta todo lo que ya existe. */
    setTheme(theme: BoardTheme): void {
      if (theme === this.theme) return;
      this.theme = theme;
      this.palette = BOARD_PALETTES[theme];
      if (!this.ready) return;
      this.paintTheme();
    }

    private paintTheme(): void {
      const palette = this.palette;

      this.cameras.main.setBackgroundColor(palette.bg);
      this.bgGfx.clear();
      this.bgGfx.fillGradientStyle(palette.bgTop, palette.bgTop, palette.bgBottom, palette.bgBottom, 1);
      this.bgGfx.fillRect(0, 0, W, H);

      this.drawSpawnRing();
      this.drawTable();

      this.ball.setFillStyle(palette.ball);
      this.ballGlow.setFillStyle(palette.ballGlow, palette.ballGlowAlpha);

      for (const player of PLAYERS) {
        const [halo, body, core] = this.runners[player].list as Phaser.GameObjects.Arc[];
        halo?.setFillStyle(PLAYER_COLOR[player], 0.16);
        body?.setFillStyle(PLAYER_COLOR[player]);
        body?.setStrokeStyle(palette.runnerStroke === null ? 0 : 2, palette.runnerStroke ?? 0x000000, 0.9);
        core?.setFillStyle(palette.runnerCore, palette.runnerCoreAlpha);
      }

      for (const emitter of [this.trail, this.sparks, this.blast]) {
        emitter.setBlendMode(palette.additive ? 'ADD' : 'NORMAL');
      }
      this.trail.setParticleTint(palette.trail);
      this.sparks.setParticleTint(palette.spark);

      this.serveText.setColor(palette.text);
      this.pauseText.setColor(palette.textDim);
      this.pauseShade.setFillStyle(palette.shade, palette.shadeAlpha);
    }

    /* ------------------------------- texturas ------------------------------- */

    private buildDotTexture(): void {
      if (this.textures.exists(DOT_TEXTURE)) return;

      const size = 32;
      const texture = this.textures.createCanvas(DOT_TEXTURE, size, size);
      if (!texture) return;

      const ctx = texture.context;
      const half = size / 2;
      const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.4, 'rgba(255,255,255,0.55)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      texture.refresh();
    }

    /* ------------------------------ construccion ---------------------------- */

    private buildRunner(player: Player): Phaser.GameObjects.Container {
      const color = PLAYER_COLOR[player];
      const palette = this.palette;
      const body = this.add.circle(0, 0, RUNNER_R, color);
      if (palette.runnerStroke !== null) body.setStrokeStyle(2, palette.runnerStroke, 0.9);
      return this.add
        .container(0, 0, [
          this.add.circle(0, 0, RUNNER_R * 1.8, color, 0.16),
          body,
          this.add.circle(0, 0, RUNNER_R * 0.42, palette.runnerCore, palette.runnerCoreAlpha),
        ])
        .setDepth(3);
    }

    private buildEmitters(): void {
      const palette = this.palette;
      const blendMode = palette.additive ? 'ADD' : 'NORMAL';

      this.trail = this.add
        .particles(0, 0, DOT_TEXTURE, {
          speed: 0,
          lifespan: 280,
          frequency: 16,
          scale: { start: 0.55, end: 0 },
          alpha: { start: 0.45, end: 0 },
          blendMode,
          tint: palette.trail,
        })
        .setDepth(4);

      this.sparks = this.add
        .particles(0, 0, DOT_TEXTURE, {
          speed: { min: 40, max: 170 },
          lifespan: { min: 180, max: 420 },
          scale: { start: 0.4, end: 0 },
          alpha: { start: 0.8, end: 0 },
          blendMode,
          tint: palette.spark,
          emitting: false,
        })
        .setDepth(6);

      this.blast = this.add
        .particles(0, 0, DOT_TEXTURE, {
          speed: { min: 60, max: 300 },
          lifespan: { min: 260, max: 620 },
          scale: { start: 0.85, end: 0 },
          alpha: { start: 0.95, end: 0 },
          blendMode,
          emitting: false,
        })
        .setDepth(6);
    }

    private buildTexts(): void {
      const palette = this.palette;
      const style: Phaser.Types.GameObjects.Text.TextStyle = {
        fontFamily: 'ui-monospace, monospace',
        fontSize: '20px',
      };

      this.serveText = this.add
        .text(CENTER, CENTER - 46, 'SAQUE', { ...style, color: palette.text })
        .setOrigin(0.5)
        .setDepth(10)
        .setVisible(false);

      this.pauseShade = this.add
        .rectangle(CENTER, CENTER, W, H, palette.shade, palette.shadeAlpha)
        .setDepth(20)
        .setVisible(false);

      this.pauseText = this.add
        .text(CENTER, CENTER, 'EN PAUSA', { ...style, fontSize: '22px', color: palette.textDim })
        .setOrigin(0.5)
        .setDepth(21)
        .setVisible(false);
    }

    /* --------------------------------- dibujo ------------------------------- */

    /** El anillo de salida se dibuja una vez: no depende del estado. */
    private drawSpawnRing(): void {
      const ring = this.ringGfx;
      ring.clear();
      ring.lineStyle(2, this.palette.ring, 1);
      for (const dash of dashedCircle(CENTER, CENTER, PLAYER_RING_R, { dash: 8, gap: 12 })) {
        for (let index = 1; index < dash.length; index += 1) {
          const from = dash[index - 1];
          const to = dash[index];
          if (!from || !to) continue;
          ring.lineBetween(from.x, from.y, to.x, to.y);
        }
      }
    }

    /** El marco de la mesa. Fijo: la mesa ya no se cierra. */
    private drawTable(): void {
      const gfx = this.table;
      gfx.clear();
      gfx.lineStyle(3, this.palette.line, 1);
      gfx.strokeRect(PAD, PAD, W - PAD * 2, H - PAD * 2);
    }

    /**
     * Color del equipo listo para pintar. En claro, el amarillo y el lima
     * desaparecen sobre blanco, asi que se oscurecen un poco.
     */
    private teamColor(color: number): number {
      const amount = this.palette.teamDarken;
      if (amount <= 0) return color;
      return phaser.Display.Color.ValueToColor(color).darken(amount).color;
    }

    /** Lo que cambia cada frame: avisos de peligro y el cono de direccion. */
    private drawDynamic(view: GameView): void {
      const gfx = this.dyn;
      gfx.clear();

      for (const player of PLAYERS) {
        if (!view.alive[player]) continue;
        const runner = view.runners[player];

        if (distance(view.ball, runner) <= DANGER_R) {
          gfx.lineStyle(2, this.palette.danger, 0.55);
          gfx.strokeCircle(runner.x, runner.y, DANGER_R);
        }

        const vector = MOVE_VEC[runner.move];
        if (vector.x === 0 && vector.y === 0) continue;

        const [from, to] = pointerSegment(runner, vector, RUNNER_R * 0.6, RUNNER_R + 9);
        gfx.lineStyle(3, this.teamColor(PLAYER_COLOR[player]), 0.9);
        gfx.lineBetween(from.x, from.y, to.x, to.y);
      }
    }

    private sync(view: GameView): void {
      for (const player of PLAYERS) {
        const node = this.runners[player];
        const alive = view.alive[player];

        if (alive && !this.wasAlive[player]) this.reviveRunner(node);
        if (alive) node.setPosition(view.runners[player].x, view.runners[player].y);
        this.wasAlive[player] = alive;
      }

      this.ball.setPosition(view.ball.x, view.ball.y);
      this.ballGlow.setPosition(view.ball.x, view.ball.y);
      this.trail.setPosition(view.ball.x, view.ball.y);
    }

    private updateOverlays(view: GameView): void {
      const paused = view.paused && view.winner === null;
      this.pauseShade.setVisible(paused);
      this.pauseText.setVisible(paused);
      this.serveText.setVisible(view.serveDelayMs > 0 && view.winner === null && !view.paused);

      const emitting = !view.paused && view.winner === null;
      if (emitting !== this.trailEmitting) {
        this.trailEmitting = emitting;
        if (emitting) this.trail.start();
        else this.trail.stop();
      }
    }

    /* -------------------------------- reaccion ------------------------------ */

    private react(event: GameEvent): void {
      switch (event.type) {
        case 'wall': {
          this.sparks.setPosition(event.x, event.y);
          this.sparks.explode(6);
          this.play('wall');
          break;
        }
        case 'kill': {
          this.blast.setPosition(event.x, event.y);
          this.blast.setParticleTint(PLAYER_COLOR[event.player]);
          this.blast.explode(26);
          this.expandingRing(event.x, event.y, this.palette.danger);
          this.expandingRing(event.x, event.y, PLAYER_COLOR[event.player], 40);
          this.cameras.main.shake(420, 0.008);
          this.play('kill');
          break;
        }
        case 'death': {
          this.killRunner(this.runners[event.player]);
          this.play('death', 140);
          break;
        }
        case 'serve': {
          this.tweens.add({
            targets: [this.ball, this.ballGlow],
            scale: { from: 0.6, to: 1 },
            duration: 220,
            ease: 'Quad.easeOut',
          });
          this.play('serve');
          break;
        }
        case 'game-over': {
          this.cameras.main.shake(240, 0.005);
          this.play('over');
          this.play('overEcho', 130);
          break;
        }
        default:
          break;
      }
    }

    private expandingRing(x: number, y: number, color: number, delay = 0): void {
      const ring = this.add
        .circle(x, y, RING_R, color, 0)
        .setStrokeStyle(3, color, 1)
        .setDepth(7);

      this.tweens.add({
        targets: ring,
        scale: { from: 1, to: 3.6 },
        alpha: { from: 1, to: 0 },
        delay,
        duration: 380,
        ease: 'Quad.easeOut',
        onComplete: () => ring.destroy(),
      });
    }

    private killRunner(node: Phaser.GameObjects.Container): void {
      this.tweens.killTweensOf(node);
      this.tweens.add({
        targets: node,
        scale: { from: 1, to: 0.15 },
        alpha: { from: 1, to: 0 },
        duration: 260,
        ease: 'Quad.easeIn',
        onComplete: () => node.setVisible(false),
      });
    }

    private reviveRunner(node: Phaser.GameObjects.Container): void {
      this.tweens.killTweensOf(node);
      node.setVisible(true).setAlpha(0).setScale(0.2);
      this.tweens.add({
        targets: node,
        scale: 1,
        alpha: 1,
        duration: 300,
        ease: 'Back.easeOut',
      });
    }

    /* --------------------------------- audio -------------------------------- */

    private registerTones(): void {
      const manager = this.sound;
      if (!(manager instanceof phaser.Sound.WebAudioSoundManager)) return;

      for (const [key, spec] of Object.entries(TONES)) {
        try {
          if (this.cache.audio.exists(key)) continue;
          const samples = toneSamples({ ...spec, sampleRate: manager.context.sampleRate });
          const buffer = manager.context.createBuffer(1, samples.length, manager.context.sampleRate);
          buffer.getChannelData(0).set(samples);
          this.cache.audio.add(key, buffer);
          manager.add(key);
        } catch {
          // Sin audio el juego sigue: los sonidos son adorno, no estado.
        }
      }

      this.sound.mute = this.muted;
    }

    private play(key: keyof typeof TONES, delayMs = 0): void {
      if (delayMs > 0) {
        this.time.delayedCall(delayMs, () => this.play(key));
        return;
      }
      if (this.muted) return;

      const sound = this.sound.get(key);
      if (!sound) return;
      this.sound.play(key);
    }

    private unlockAudio(): void {
      const manager = this.sound as { unlock?: () => void } | undefined;
      manager?.unlock?.();
    }
  }

  const scene = new BoardScene();
  const startTheme = options.theme ?? 'light';
  const game = new phaser.Game({
    type: phaser.AUTO,
    parent: options.parent,
    width: W,
    height: H,
    backgroundColor: BOARD_PALETTES[startTheme].bg,
    banner: false,
    scale: {
      mode: phaser.Scale.FIT,
      autoCenter: phaser.Scale.CENTER_BOTH,
    },
    scene: [scene],
  });

  return {
    game,
    setMuted: (muted: boolean) => scene.setMuted(muted),
    setTheme: (theme: BoardTheme) => scene.setTheme(theme),
    destroy: () => game.destroy(true),
  };
}
