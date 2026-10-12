import 'server-only';

import { askSystemOne } from '../typesafe';
import type { ModelAnswer, ModelGateway, ModelRequest } from './ports';

/**
 * Adaptador del puerto `ModelGateway` sobre TypeSafe. Es el unico punto del
 * backend que conoce `askSystemOne`; el servicio no sabe que existe.
 */
export const typesafeGateway: ModelGateway = {
  async ask(request: ModelRequest): Promise<ModelAnswer> {
    const call = await askSystemOne({
      model: request.model,
      state: request.state,
      questions: request.questions,
      ...(request.signal ? { signal: request.signal } : {}),
      timeoutMs: request.timeoutMs,
    });
    return {
      answeredModel: call.model ?? null,
      answers: call.answers,
      usage: {
        inputTokens: call.usage?.input_tokens ?? null,
        outputTokens: call.usage?.output_tokens ?? null,
      },
    };
  },
};
