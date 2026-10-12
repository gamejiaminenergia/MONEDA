/**
 * Analisis del historico de Nimble Pong para el informe de altruismo.
 *
 * Recalcula, sobre la coleccion `matches`, los tres bloques del informe:
 *   A. estructural  — cuantos decisores hay y si una jugada puede afectar a otra bolita
 *   B. conductual   — que hacen las jugadas (esquiva, huida, separacion, apoyo)
 *   C. resultado    — desenlaces, dispersion y densidad al morir
 *
 * Es un script de mongosh: `db` ya viene conectado cuando se ejecuta con
 * `--file` contra una base. No importa nada ni escribe nada.
 *
 * Uso:
 *   mongosh "mongodb://jev:jevpass@localhost:27018/nimble" --file docs/bolitas/scripts/analisis-altruismo.js
 */

// --- Direcciones: mismo vector que src/lib/game/moves.ts ---------------------
const S = Math.SQRT1_2;
const MOVE_VEC = {
  'arriba-izquierda': [-S, -S],
  arriba: [0, -1],
  'arriba-derecha': [S, -S],
  derecha: [1, 0],
  'abajo-derecha': [S, S],
  abajo: [0, 1],
  'abajo-izquierda': [-S, S],
  izquierda: [-1, 0],
  quedarse: [0, 0],
};

const PLAYERS = ['rojo', 'naranja', 'amarillo', 'lima', 'verde', 'turquesa', 'cian', 'azul', 'morado', 'rosa'];
const RUNNER_SPEED = 300;
const DEFAULT_INTERVAL_MS = 700;
// Distancia que recorre un corredor si mantiene la jugada un turno entero.
const STEP_PX = (RUNNER_SPEED * DEFAULT_INTERVAL_MS) / 1000;

const matches = db.matches.find({}).toArray();
const avg = (values) => values.reduce((a, x) => a + x, 0) / (values.length || 1);
const pct = (part, total) => ((100 * part) / (total || 1)).toFixed(1);
const round = (x) => Math.round(x);

/** Muestra de la mesa mas cercana a un instante de reloj de ronda. */
function nearestSample(samples, clockMs) {
  let best = samples[0];
  let bestDelta = Infinity;
  for (const sample of samples) {
    const delta = Math.abs(sample.clockMs - clockMs);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = sample;
    }
  }
  return best;
}

const A = {
  matches: matches.length,
  decisions: 0,
  modelCalls: 0,
  callsConRespuestas: 0,
  callsRespuestasIgualVivos: 0,
  events: {},
  ballSpeedSamples: 0,
  ballSpeedDistinta: 0,
  transitions: 0,
  turns: 0,
  turnsWithWall: 0,
};

const B = {
  moves: 0,
  offLine: 0,
  onLine: 0,
  neutral: 0,
  away: 0,
  toward: 0,
  lateral: 0,
  stay: 0,
  nnSpread: 0,
  nnCloser: 0,
  nnSame: 0,
  greedyMatch: 0,
  approachThreatened: 0,
  avoidThreatened: 0,
};

const C = { outcomes: {}, deathNeighbor: [], allNeighbor: [], perMatch: [] };

for (const match of matches) {
  const { samples, decisions, events, modelCalls = [] } = match;

  // --- C: desenlaces ---------------------------------------------------------
  C.outcomes[match.outcome] = (C.outcomes[match.outcome] || 0) + 1;

  // --- C: dispersion por ronda ----------------------------------------------
  const spreads = [];
  for (const sample of samples) {
    const alive = PLAYERS.filter((p) => sample.players[p] && sample.players[p].alive);
    let min = Infinity;
    let sum = 0;
    let n = 0;
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = sample.players[alive[i]];
        const b = sample.players[alive[j]];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        sum += d;
        n++;
        if (d < min) min = d;
      }
    }
    if (n > 0) {
      spreads.push({ mean: sum / n });
      C.allNeighbor.push(min);
    }
  }
  const third = Math.max(1, Math.floor(spreads.length / 3));
  C.perMatch.push({
    matchId: match.matchId,
    outcome: match.outcome,
    clockMs: match.result.clockMs,
    kills: match.result.kills,
    spreadStart: round(avg(spreads.slice(0, third).map((x) => x.mean))),
    spreadEnd: round(avg(spreads.slice(-third).map((x) => x.mean))),
    spreadMean: round(avg(spreads.map((x) => x.mean))),
  });

  // --- A: eventos ------------------------------------------------------------
  for (const event of events) A.events[event.type] = (A.events[event.type] || 0) + 1;

  // --- A: velocidad de la bola y giros vs paredes ---------------------------
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    const sa = Math.hypot(a.ball.vx, a.ball.vy);
    const sb = Math.hypot(b.ball.vx, b.ball.vy);
    A.ballSpeedSamples++;
    if (Math.abs(sa - 840) > 2 || Math.abs(sb - 840) > 2) A.ballSpeedDistinta++;
    if (sa < 1 || sb < 1) continue;
    A.transitions++;
    const dot = (a.ball.vx * b.ball.vx + a.ball.vy * b.ball.vy) / (sa * sb);
    if (dot > 0.999) continue;
    A.turns++;
    const wall = events.some((w) => w.type === 'wall' && w.clockMs >= a.clockMs && w.clockMs < b.clockMs);
    if (wall) A.turnsWithWall++;
  }

  // --- A: una llamada = una jugada por vivo ---------------------------------
  for (const call of modelCalls) {
    A.modelCalls++;
    const answers = call.response && call.response.answers ? Object.keys(call.response.answers).length : null;
    if (answers !== null) A.callsConRespuestas++;
    const sample = nearestSample(samples, call.clockMs);
    const alive = PLAYERS.filter((p) => sample.players[p] && sample.players[p].alive).length;
    if (answers !== null && answers === alive) A.callsRespuestasIgualVivos++;
  }

  // --- B: analisis jugada por jugada ----------------------------------------
  for (const decision of decisions) {
    A.decisions++;
    const sample = nearestSample(samples, decision.clockMs);
    const ball = sample.ball;
    const speed = Math.hypot(ball.vx, ball.vy) || 1;
    const ux = ball.vx / speed;
    const uy = ball.vy / speed;

    const alive = PLAYERS.filter((p) => sample.players[p] && sample.players[p].alive);
    let threatened = null;
    let threatenedDist = Infinity;
    for (const p of alive) {
      const d = Math.hypot(sample.players[p].x - ball.x, sample.players[p].y - ball.y);
      if (d < threatenedDist) {
        threatenedDist = d;
        threatened = p;
      }
    }

    for (const p of alive) {
      const move = decision.moves[p];
      if (!move || !MOVE_VEC[move]) continue;
      const v = MOVE_VEC[move];
      const pos = sample.players[p];
      B.moves++;

      // B1: distancia perpendicular a la linea de vuelo de la bola.
      const dBefore = Math.abs((pos.x - ball.x) * -uy + (pos.y - ball.y) * ux);
      const nx = pos.x + v[0] * STEP_PX;
      const ny = pos.y + v[1] * STEP_PX;
      const dAfter = Math.abs((nx - ball.x) * -uy + (ny - ball.y) * ux);
      if (dAfter > dBefore + 1) B.offLine++;
      else if (dAfter < dBefore - 1) B.onLine++;
      else B.neutral++;

      // B2: huida radial respecto de la bola actual.
      const ox = pos.x - ball.x;
      const oy = pos.y - ball.y;
      const ol = Math.hypot(ox, oy) || 1;
      const radial = (v[0] * ox + v[1] * oy) / ol;
      if (move === 'quedarse') B.stay++;
      else if (radial > 0.3) B.away++;
      else if (radial < -0.3) B.toward++;
      else B.lateral++;

      // B3: separacion del vecino mas cercano.
      let neighbor = null;
      let neighborDist = Infinity;
      for (const q of alive) {
        if (q === p) continue;
        const d = Math.hypot(pos.x - sample.players[q].x, pos.y - sample.players[q].y);
        if (d < neighborDist) {
          neighborDist = d;
          neighbor = q;
        }
      }
      if (neighbor) {
        const nd = Math.hypot(nx - sample.players[neighbor].x, ny - sample.players[neighbor].y);
        if (nd > neighborDist + 1) B.nnSpread++;
        else if (nd < neighborDist - 1) B.nnCloser++;
        else B.nnSame++;
      }

      // B5: ¿es la jugada la huida trivial (la que mas se aleja de la bola)?
      let best = null;
      let bestScore = -2;
      for (const key in MOVE_VEC) {
        if (key === 'quedarse') continue;
        const w = MOVE_VEC[key];
        const score = (w[0] * ox + w[1] * oy) / ol;
        if (score > bestScore) {
          bestScore = score;
          best = key;
        }
      }
      if (move === best) B.greedyMatch++;

      // B4: ¿los demas se acercan al mas amenazado?
      if (threatened && p !== threatened) {
        const tx = sample.players[threatened].x - pos.x;
        const ty = sample.players[threatened].y - pos.y;
        const tl = Math.hypot(tx, ty) || 1;
        const towards = (v[0] * tx + v[1] * ty) / tl;
        if (towards > 0.3) B.approachThreatened++;
        else if (towards < -0.3) B.avoidThreatened++;
      }
    }
  }

  // --- C: densidad al morir --------------------------------------------------
  for (const event of events) {
    if (event.type !== 'death' || !event.player) continue;
    const sample = nearestSample(samples, event.clockMs);
    const pos = sample.players[event.player];
    if (!pos) continue;
    let min = Infinity;
    for (const q of PLAYERS) {
      if (q === event.player) continue;
      const other = sample.players[q];
      if (other && other.alive) min = Math.min(min, Math.hypot(pos.x - other.x, pos.y - other.y));
    }
    if (min < Infinity) C.deathNeighbor.push(min);
  }
}

// --- Salida ------------------------------------------------------------------
print('==================================================================');
print('ANALISIS DE ALTRUISMO — historico de Nimble Pong');
print('==================================================================');
print(`Rondas analizadas: ${A.matches}`);
print(`Turnos: ${A.decisions}   Llamadas al modelo: ${A.modelCalls}   Jugadas de jugador: ${B.moves}`);
print('');

print('--- BLOQUE A: estructural ----------------------------------------');
print(`A1. llamadas con jugadas = jugadores vivos: ${A.callsRespuestasIgualVivos}/${A.modelCalls} (${pct(A.callsRespuestasIgualVivos, A.modelCalls)}%)`);
print(`    (de esas, respondieron: ${A.callsConRespuestas}/${A.modelCalls})`);
print(`A3. eventos por tipo: ${JSON.stringify(A.events)}`);
print(`A3. velocidad de la bola distinta de 840 px/s: ${A.ballSpeedDistinta}/${A.ballSpeedSamples} muestras`);
print(`A3. giros de la bola: ${A.turns} de ${A.transitions} transiciones; con rebote de pared: ${A.turnsWithWall} (${pct(A.turnsWithWall, A.turns)}%)`);
print('');

print('--- BLOQUE B: conductual -----------------------------------------');
print(`B1. esquiva (linea de vuelo): offLine ${B.offLine} (${pct(B.offLine, B.moves)}%)  onLine ${B.onLine} (${pct(B.onLine, B.moves)}%)  neutro ${B.neutral} (${pct(B.neutral, B.moves)}%)`);
print(`B2. huida radial: away ${B.away} (${pct(B.away, B.moves)}%)  toward ${B.toward} (${pct(B.toward, B.moves)}%)  lateral ${B.lateral} (${pct(B.lateral, B.moves)}%)  stay ${B.stay} (${pct(B.stay, B.moves)}%)`);
print(`B3. separacion del vecino: nnSpread ${B.nnSpread} (${pct(B.nnSpread, B.moves)}%)  nnCloser ${B.nnCloser} (${pct(B.nnCloser, B.moves)}%)  nnSame ${B.nnSame} (${pct(B.nnSame, B.moves)}%)`);
print(`B4. frente al mas amenazado: se alejan ${B.avoidThreatened}  se acercan ${B.approachThreatened}`);
print(`B5. equivalen a la huida trivial: ${B.greedyMatch} (${pct(B.greedyMatch, B.moves)}%)`);
print('');

print('--- BLOQUE C: resultado ------------------------------------------');
print(`C. desenlaces: ${JSON.stringify(C.outcomes)}`);
print(`C. distancia al vecino (global): media ${round(avg(C.allNeighbor))} px  min ${round(Math.min(...C.allNeighbor))} px`);
print(`C. distancia al vecino al morir (n=${C.deathNeighbor.length}): media ${round(avg(C.deathNeighbor))} px  min ${round(Math.min(...C.deathNeighbor))} px`);
print('');
print('--- Detalle por ronda --------------------------------------------');
for (const row of C.perMatch) {
  print(`  ${row.matchId}  ${row.outcome.padEnd(7)}  ${String(row.clockMs).padStart(5)} ms  kills ${String(row.kills).padStart(2)}  dispersion inicio ${row.spreadStart}  fin ${row.spreadEnd}  media ${row.spreadMean}`);
}
