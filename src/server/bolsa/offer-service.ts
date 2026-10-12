import 'server-only';

import type { BolsaDecisionResponse } from '@/lib/ai/bolsa';
import { buildGeneratorQuestions, buildGeneratorState } from '@/lib/bolsa/prompt';
import type { Agent, AgentId, MarketState, Offer } from '@/lib/bolsa/types';
import type { QuestionSet } from '@/lib/game/prompt';
import { elapsedMs, logger } from '../log';
import { ModelError } from '../model-error';
import { mapAnswersToOffers } from './offer-mapper';
import type { ModelGateway } from './ports';

/**
 * Caso de uso: decidir las ofertas de un mes. Depende del puerto `ModelGateway`
 * (Dependency Inversion): no sabe si detras esta TypeSafe, otro proveedor o un
 * doble de prueba. Cada generador decide toda su cartera en una peticion.
 */

const log = logger.child('bolsa');

export interface OfferServiceConfig {
  defaultModel: string;
  timeoutMs: number;
  hasApiKey: boolean;
}

export interface DecideOptions {
  model?: string;
  signal?: AbortSignal;
}

interface SettledGenerator {
  id: AgentId;
  offers: Record<string, Offer>;
  inputTokens: number | null;
  outputTokens: number | null;
}

export class OfferService {
  constructor(
    private readonly gateway: ModelGateway,
    private readonly config: OfferServiceConfig,
  ) {}

  async decide(market: MarketState, options: DecideOptions = {}): Promise<BolsaDecisionResponse> {
    const startedAt = Date.now();
    if (!this.config.hasApiKey) {
      throw new ModelError('model-not-configured', 'TypeSafe no esta configurado: falta TYPESAFE_API_KEY');
    }
    const requested = options.model?.trim();
    const model = requested && requested !== 'auto' ? requested : this.config.defaultModel;

    const generators = market.agents.filter((agent) => agent.role === 'generador' && agent.alive);
    if (generators.length === 0) {
      return { model, latencyMs: Date.now() - startedAt, offers: {}, usage: { inputTokens: null, outputTokens: null } };
    }

    const settled = await Promise.all(
      generators.map((agent) => this.decideForAgent(model, market, agent, options.signal)),
    );

    const offers: Partial<Record<AgentId, Record<string, Offer>>> = {};
    let inputTokens: number | null = 0;
    let outputTokens: number | null = 0;
    let answered = 0;
    for (const item of settled) {
      if (!item) continue;
      offers[item.id] = item.offers;
      answered += 1;
      inputTokens = (inputTokens ?? 0) + (item.inputTokens ?? 0);
      outputTokens = (outputTokens ?? 0) + (item.outputTokens ?? 0);
    }

    if (answered === 0) {
      log.error('ningun generador respondio', { model, ms: elapsedMs(startedAt) });
      throw new ModelError('model-malformed', 'Ningun generador obtuvo oferta del modelo');
    }

    log.info('ofertas', { model, mes: market.monthIndex, generadores: answered, inTokens: inputTokens, ms: elapsedMs(startedAt) });
    return { model, latencyMs: Date.now() - startedAt, offers, usage: { inputTokens, outputTokens } };
  }

  /** Un generador sin respuesta no detiene el mes: el motor reusa su ultima oferta. */
  private async decideForAgent(
    model: string,
    market: MarketState,
    agent: Agent,
    signal: AbortSignal | undefined,
  ): Promise<SettledGenerator | null> {
    try {
      const answer = await this.gateway.ask({
        model,
        state: buildGeneratorState(market, agent),
        questions: buildGeneratorQuestions(agent, market) as unknown as QuestionSet,
        timeoutMs: this.config.timeoutMs,
        ...(signal ? { signal } : {}),
      });
      const offers = mapAnswersToOffers(market, agent, answer.answers);
      if (Object.keys(offers).length === 0) {
        throw new ModelError('model-malformed', `Sin ofertas para ${agent.name}`);
      }
      return {
        id: agent.id,
        offers,
        inputTokens: answer.usage.inputTokens,
        outputTokens: answer.usage.outputTokens,
      };
    } catch (error) {
      log.warn('generador sin oferta', {
        id: agent.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
