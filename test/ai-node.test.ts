import {
  AlephantAi,
  buildChatCompletionBody,
  parseMessagesInput,
} from '../nodes/AlephantAi/AlephantAi.node';
import type { IExecuteFunctions } from 'n8n-workflow';

describe('Alephant AI node', () => {
  it('builds a prompt-mode chat completion body', () => {
    const body = buildChatCompletionBody({
      model: 'gpt-4o-mini',
      inputMode: 'prompt',
      prompt: 'Summarize this',
      temperature: 0.2,
      maxTokens: 200,
      responseFormat: 'json_object',
      metadata: { workflow: 'wf_1' },
      additionalOptions: {},
    });

    expect(body.messages).toEqual([{ role: 'user', content: 'Summarize this' }]);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.temperature).toBe(0.2);
    expect(body.max_tokens).toBe(200);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('omits optional fields from the default chat completion body', () => {
    const body = buildChatCompletionBody({
      model: 'gpt-4o-mini',
      inputMode: 'prompt',
      prompt: 'Hi',
      metadata: {},
      additionalOptions: {},
    });

    expect(body.temperature).toBeUndefined();
    expect(body.max_tokens).toBeUndefined();
    expect(body.metadata).toBeUndefined();
  });

  it('omits metadata when store is not enabled', () => {
    const body = buildChatCompletionBody({
      model: 'gpt-4o-mini',
      inputMode: 'prompt',
      prompt: 'Hi',
      metadata: { workflow: 'wf_1' },
      additionalOptions: {},
    });

    expect(body.metadata).toBeUndefined();
  });

  it('includes metadata only when store is enabled', () => {
    const body = buildChatCompletionBody({
      model: 'gpt-4o-mini',
      inputMode: 'prompt',
      prompt: 'Hi',
      metadata: { workflow: 'wf_1' },
      additionalOptions: { store: true },
    });

    expect(body.store).toBe(true);
    expect(body.metadata).toEqual({ workflow: 'wf_1' });
  });

  it('does not configure temperature and max tokens by default', () => {
    const node = new AlephantAi();
    const temperature = node.description.properties.find(({ name }) => name === 'temperature');
    const maxTokens = node.description.properties.find(({ name }) => name === 'maxTokens');

    expect(temperature?.default).toBeUndefined();
    expect(maxTokens?.default).toBeUndefined();
  });

  it('builds a messages-mode chat completion body', () => {
    const body = buildChatCompletionBody({
      model: 'gpt-4o-mini',
      inputMode: 'messages',
      messages: [{ role: 'system', content: 'Be concise' }, { role: 'user', content: 'Hi' }],
      additionalOptions: { seed: 7 },
    });

    expect(body.messages).toHaveLength(2);
    expect(body.seed).toBe(7);
  });

  it('does not let additional options override core request fields', () => {
    const body = buildChatCompletionBody({
      model: 'gpt-4o-mini',
      inputMode: 'prompt',
      prompt: 'Hi',
      additionalOptions: {
        model: 'override',
        messages: [],
        temperature: 0,
        seed: 7,
      },
    });

    expect(body.model).toBe('gpt-4o-mini');
    expect(body.messages).toEqual([{ role: 'user', content: 'Hi' }]);
    expect(body.temperature).toBeUndefined();
    expect(body.seed).toBe(7);
  });

  it('parses messages from JSON string input', () => {
    expect(parseMessagesInput('[{"role":"user","content":"Hi"}]')).toEqual([
      { role: 'user', content: 'Hi' },
    ]);
  });

  it('rejects non-array messages input', () => {
    expect(() => parseMessagesInput('{"role":"user","content":"Hi"}')).toThrow(
      'Messages must be a JSON array',
    );
  });

  it('rejects invalid messages JSON with a stable message', () => {
    expect(() => parseMessagesInput('{bad json}')).toThrow('Messages must be valid JSON');
  });

  it('executes imported prompt workflows when optional number parameters are absent', async () => {
    const httpRequest = jest.fn().mockResolvedValue({
      model: 'gpt-4o-mini',
      choices: [{ message: { content: 'Hello' }, finish_reason: 'stop' }],
      usage: { total_tokens: 3 },
    });
    const node = new AlephantAi();
    const ctx = {
      getInputData: jest.fn().mockReturnValue([
        { json: { workspaceId: 'input-workspace-id' } },
      ]),
      getCredentials: jest.fn().mockResolvedValue({
        virtualKey: 'vk_test',
        gatewayBaseUrl: 'https://gateway.example/v1/',
      }),
      getNode: jest.fn().mockReturnValue({
        name: 'Alephant AI',
        type: 'alephantAi',
        typeVersion: 1,
        position: [0, 0],
        parameters: {},
      }),
      getNodeParameter: jest.fn((...args: [string, number, unknown?]) => {
        const [name, , fallback] = args;
        const values: Record<string, unknown> = {
          inputMode: 'prompt',
          model: 'gpt-4o-mini',
          prompt: 'Hi',
          responseFormat: 'text',
          metadata: '{}',
          additionalOptions: '{}',
        };

        if (name in values) {
          return values[name];
        }
        if (args.length >= 3 && fallback !== undefined) {
          return fallback;
        }
        throw new Error('Could not get parameter');
      }),
      helpers: { httpRequest },
    } as unknown as IExecuteFunctions;

    const result = await node.execute.call(ctx);
    const request = httpRequest.mock.calls[0][0];

    expect(result).toEqual([
      [
        {
          json: expect.objectContaining({
            text: 'Hello',
            model: 'gpt-4o-mini',
            workspaceId: 'input-workspace-id',
            requestLogId: expect.stringMatching(
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
            ),
          }),
          pairedItem: { item: 0 },
        },
      ],
    ]);
    expect(result[0][0].json.requestLogId).toBe(request.headers['x-request-id']);

    expect(httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: 'https://gateway.example/v1/chat/completions',
        headers: expect.objectContaining({
          'x-request-id': result[0][0].json.requestLogId,
        }),
        body: expect.not.objectContaining({
          temperature: expect.anything(),
          max_tokens: expect.anything(),
        }),
      }),
    );
  });
});
