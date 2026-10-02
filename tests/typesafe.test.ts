import { afterEach, describe, expect, it, vi } from 'vitest';

import type { QuestionSet } from '@/lib/game/prompt';
import { ModelError } from '@/server/model-error';
import { askSystemOne, listTypesafeModels, typesafeConfig } from '@/server/typesafe';

const questions: QuestionSet = {
  rojo: {
    type: 'choice',
    instructions: 'Direccion del jugador rojo',
    criteria: { arriba: 'hacia arriba', abajo: 'hacia abajo' },
  },
};

const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('typesafeConfig', () => {
  it('usa los valores por defecto de TypeSafe', () => {
    vi.stubEnv('TYPESAFE_URL', '');
    vi.stubEnv('TYPESAFE_MODEL', '');
    vi.stubEnv('TYPESAFE_API_KEY', '');
    const config = typesafeConfig();
    expect(config.url).toBe('https://api.typesafe.ai');
    expect(config.model).toBe('jev-latest');
    expect(config.timeoutMs).toBe(30_000);
    expect(config.apiKey).toBe('');
  });

  it('sanea la URL y el timeout', () => {
    vi.stubEnv('TYPESAFE_URL', 'https://api.typesafe.test/');
    vi.stubEnv('TYPESAFE_TIMEOUT_MS', '5000');
    const config = typesafeConfig();
    expect(config.url).toBe('https://api.typesafe.test');
    expect(config.timeoutMs).toBe(5000);
  });
});

describe('cliente de TypeSafe', () => {
  it('manda la clave en el header y normaliza la respuesta choice', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', 'secreta');
    vi.stubEnv('TYPESAFE_URL', 'https://api.typesafe.test');
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        capturedUrl = String(url);
        capturedInit = init;
        return jsonResponse({
          model: 'jev-1.13.0',
          answers: {
            rojo: { type: 'choice', choice: 'arriba', confidence: 0.62, probabilities: { arriba: 0.62, abajo: 0.38 } },
          },
          usage: { input_tokens: 100, output_tokens: 5 },
        });
      }),
    );

    const result = await askSystemOne({ model: 'jev-latest', state: 'hola', questions });

    expect(result.answers.rojo?.choice).toBe('arriba');
    expect(result.answers.rojo?.confidence).toBeCloseTo(0.62, 5);
    expect(result.usage?.input_tokens).toBe(100);
    expect(capturedUrl).toBe('https://api.typesafe.test/v1/systemone');
    expect(capturedInit?.headers).toMatchObject({ Authorization: 'Bearer secreta' });
    const body = JSON.parse(String(capturedInit?.body)) as { model: string; questions: QuestionSet };
    expect(body.model).toBe('jev-latest');
    expect(body.questions).toEqual(questions);
  });

  it('un 403 se convierte en model-unauthorized, no en un fallo generico', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', 'vencida');
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ detail: 'nope' }, 403)));

    await expect(askSystemOne({ model: 'jev-latest', state: 'hola', questions })).rejects.toMatchObject({
      name: 'ModelError',
      code: 'model-unauthorized',
    });
  });

  it('sin clave no llama a la red y falla como no configurado', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(askSystemOne({ model: 'jev-latest', state: 'hola', questions })).rejects.toBeInstanceOf(ModelError);
    await expect(askSystemOne({ model: 'jev-latest', state: 'hola', questions })).rejects.toMatchObject({
      code: 'model-not-configured',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('un contrato roto es model-malformed', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', 'secreta');
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ nope: true })));

    await expect(
      askSystemOne({ model: 'jev-latest', state: 'hola', questions }),
    ).rejects.toMatchObject({ code: 'model-malformed' });
  });

  it('lista y ordena los modelos de TypeSafe', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', 'secreta');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          models: [
            { name: 'jev-preview', description: 'preview' },
            { name: 'jev-latest', description: 'estable' },
            { name: 42 },
          ],
        })),
    );

    const models = await listTypesafeModels();
    expect(models.map((model) => model.name)).toEqual(['jev-latest', 'jev-preview']);
    expect(models[0]?.description).toBe('estable');
  });
});
