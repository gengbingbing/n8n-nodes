import { buildChatCompletionBody, parseMessagesInput } from '../nodes/AlephantAi/AlephantAi.node';

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
});
