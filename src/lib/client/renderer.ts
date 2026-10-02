import {
  BALL_R,
  CENTER,
  COLORS,
  H,
  PAD,
  PAD_H,
  PAD_W,
  PLANE,
  W,
} from '@/lib/game/constants';
import { SIDES, SIDE_AXIS, type Side } from '@/lib/game/sides';
import type { PaddlePair, SideRecord } from '@/lib/game/types';
import type { GameEvent } from '@/lib/game/types';

/**
 * Tope de pixeles del canvas. Con dpr 2 y una pantalla grande el buffer se
 * dispara; por encima de esto se baja la resolucion en vez de comerse la memoria.
 */
const MAX_BACKING_PIXELS = 8_000_000;
const MAX_DPR = 2;
const SEAL_COLOR = 0x5a6b8c;

const SIDE_COLORS: Record<Side, [number, number]> = {
  left: [COLORS.leftA, COLORS.leftB],
  right: [COLORS.rightA, COLORS.rightB],
  top: [COLORS.topA, COLORS.topB],
  bottom: [COLORS.bottomA, COLORS.bottomB],
};

interface Ring {
  x: number;
  y: number;
  color: number;
  bornAt: number;
}

interface RenderView {
  ball: { x: number; y: number };
  paddles: SideRecord<PaddlePair>;
  alive: SideRecord<boolean>;
  serveDelayMs: number;
  winner: Side | null;
  paused: boolean;
}

const hexColor = (value: number): string => `#${value.toString(16).padStart(6, '0')}`;

/**
 * Renderer de la mesa en Canvas 2D. Lee el estado del motor y dibuja;
 * los efectos (estela, ondas, sacudida) viven solo aqui, no en el motor.
 */
export class BoardRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly observer: ResizeObserver | null = null;
  private trail: { x: number; y: number }[] = [];
  private rings: Ring[] = [];
  private shakeUntil = 0;
  private lastFrameAt = 0;
  private scaleX = 1;
  private scaleY = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Este navegador no soporta Canvas 2D');
    this.ctx = ctx;
    this.resize();
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(canvas);
    }
    window.addEventListener('resize', this.handleWindowResize);
  }

  /**
   * Ajusta el buffer a la caja CSS real del canvas. El juego sigue pensando en
   * 720x720: solo cambia la escala con la que se proyecta a pantalla.
   */
  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const cssWidth = rect.width > 1 ? rect.width : W;
    const cssHeight = rect.height > 1 ? rect.height : (cssWidth / W) * H;

    let width = Math.max(1, Math.round(cssWidth * dpr));
    let height = Math.max(1, Math.round(cssHeight * dpr));
    const pixels = width * height;
    if (pixels > MAX_BACKING_PIXELS) {
      const factor = Math.sqrt(MAX_BACKING_PIXELS / pixels);
      width = Math.max(1, Math.round(width * factor));
      height = Math.max(1, Math.round(height * factor));
    }

    this.scaleX = width / W;
    this.scaleY = height / H;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  destroy(): void {
    this.observer?.disconnect();
    window.removeEventListener('resize', this.handleWindowResize);
  }

  /** Traduce un evento del motor en algo visual. */
  pushEvent(event: GameEvent, at = performance.now()): void {
    switch (event.type) {
      case 'paddle-hit':
        this.rings.push({ x: event.x, y: event.y, color: SIDE_COLORS[event.side][0], bornAt: at });
        break;
      case 'wall':
        this.rings.push({ x: event.x, y: event.y, color: SEAL_COLOR, bornAt: at });
        break;
      case 'life-lost':
        this.shakeUntil = at + 160;
        break;
      case 'death':
        this.shakeUntil = at + 420;
        this.rings.push({ x: CENTER, y: CENTER, color: 0xff5c5c, bornAt: at });
        break;
      default:
        break;
    }
  }

  draw(view: RenderView, now: number): void {
    const dt = this.lastFrameAt ? Math.min(now - this.lastFrameAt, 50) : 16;
    this.lastFrameAt = now;
    const ctx = this.ctx;

    ctx.setTransform(this.scaleX, 0, 0, this.scaleY, 0, 0);
    ctx.save();
    ctx.clearRect(0, 0, W, H);

    if (now < this.shakeUntil) {
      const power = 8 * ((this.shakeUntil - now) / 160);
      ctx.translate((Math.random() * 2 - 1) * power, (Math.random() * 2 - 1) * power);
    }

    this.drawTable(view);
    this.drawTrail(view.ball, dt);
    this.drawRings(now);

    ctx.beginPath();
    ctx.arc(view.ball.x, view.ball.y, BALL_R + 7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(159,232,255,0.13)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(view.ball.x, view.ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = hexColor(COLORS.ball);
    ctx.shadowColor = hexColor(COLORS.ballGlow);
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.shadowBlur = 0;

    this.drawPaddles(view);

    if (view.serveDelayMs > 0 && !view.winner) {
      ctx.fillStyle = '#39d8ff';
      ctx.font = '20px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SAQUE', CENTER, CENTER - 46);
    }

    if (view.paused && !view.winner) {
      ctx.fillStyle = 'rgba(4,6,12,0.45)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#8aa0c6';
      ctx.font = '22px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('EN PAUSA', CENTER, CENTER);
    }

    ctx.restore();
  }

  private drawTable(view: RenderView): void {
    const ctx = this.ctx;
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, hexColor(COLORS.bgTop));
    gradient.addColorStop(1, hexColor(COLORS.bgBottom));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.line;
    ctx.strokeRect(PAD, PAD, W - 2 * PAD, H - 2 * PAD);

    // Cruz central de la mesa cuadrada.
    ctx.strokeStyle = '#141f36';
    ctx.setLineDash([10, 12]);
    ctx.beginPath();
    ctx.moveTo(CENTER, PAD);
    ctx.lineTo(CENTER, H - PAD);
    ctx.moveTo(PAD, CENTER);
    ctx.lineTo(W - PAD, CENTER);
    ctx.stroke();
    ctx.setLineDash([]);

    // Cada pared: linea tenue del color del equipo, o muro sellado si murio.
    for (const side of SIDES) {
      const alive = view.alive[side];
      const { from, to } = sideSegment(side);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      if (alive) {
        ctx.strokeStyle = hexColor(SIDE_COLORS[side][0]);
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = hexColor(SEAL_COLOR);
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 6;
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  private drawTrail(ball: { x: number; y: number }, dt: number): void {
    const ctx = this.ctx;
    this.trail.push({ x: ball.x, y: ball.y });
    if (this.trail.length > 14) this.trail.shift();
    ctx.globalAlpha = Math.min(1, dt / 16);
    this.trail.forEach((point, index) => {
      const ratio = index / this.trail.length;
      ctx.beginPath();
      ctx.arc(point.x, point.y, BALL_R * (0.3 + ratio * 0.7), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(159,232,255,${ratio * 0.35})`;
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  private drawRings(now: number): void {
    const ctx = this.ctx;
    this.rings = this.rings.filter((ring) => now - ring.bornAt < 320);
    for (const ring of this.rings) {
      const progress = (now - ring.bornAt) / 320;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, 8 + progress * 18, 0, Math.PI * 2);
      ctx.strokeStyle = hexColor(ring.color);
      ctx.globalAlpha = 1 - progress;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawPaddles(view: RenderView): void {
    const ctx = this.ctx;
    for (const side of SIDES) {
      if (!view.alive[side]) continue;
      const colors = SIDE_COLORS[side];
      const axisIsY = SIDE_AXIS[side] === 'y';
      const brace = axisIsY
        ? side === 'left'
          ? PAD + PAD_W / 2
          : W - PAD - PAD_W / 2
        : side === 'top'
          ? PAD + PAD_W / 2
          : H - PAD - PAD_W / 2;

      view.paddles[side].forEach((paddle, index) => {
        ctx.fillStyle = hexColor(colors[index] ?? COLORS.ball);
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 14;
        if (axisIsY) ctx.fillRect(brace - PAD_W / 2, paddle.pos - PAD_H / 2, PAD_W, PAD_H);
        else ctx.fillRect(paddle.pos - PAD_H / 2, brace - PAD_W / 2, PAD_H, PAD_W);
        ctx.shadowBlur = 0;
      });
    }
  }

  private readonly handleWindowResize = (): void => {
    this.resize();
  };
}

/** Extremos de la pared que defiende cada equipo. */
function sideSegment(side: Side): { from: { x: number; y: number }; to: { x: number; y: number } } {
  const inner = PLANE;
  const far = W - PLANE;
  switch (side) {
    case 'left':
      return { from: { x: inner, y: inner }, to: { x: inner, y: far } };
    case 'right':
      return { from: { x: far, y: inner }, to: { x: far, y: far } };
    case 'top':
      return { from: { x: inner, y: inner }, to: { x: far, y: inner } };
    case 'bottom':
      return { from: { x: inner, y: far }, to: { x: far, y: far } };
  }
}
