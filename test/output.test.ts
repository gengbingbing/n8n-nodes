import { parseJsonObjectInput } from '../shared/json';
import { normalizeChatCompletion, trimTrailingSlash } from '../shared/output';
import { trimTrailingSlash as trimUrlTrailingSlash } from '../shared/url';

describe('shared output helpers', () => {
  it('normalizes chat completion text and usage', () => {
    const normalized = normalizeChatCompletion(
      {
        id: 'chatcmpl_123',
        model: 'gpt-4o-mini',
        choices: [
          {
            message: { role: 'assistant', content: 'Hello from Alephant' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
      },
      'req_123',
    );

    expect(normalized.text).toBe('Hello from Alephant');
    expect(normalized.model).toBe('gpt-4o-mini');
    expect(normalized.requestId).toBe('req_123');
    expect(normalized.finishReason).toBe('stop');
    expect(normalized.usage.total_tokens).toBe(14);
  });

  it('normalizes non-string chat completion content to a string', () => {
    const normalized = normalizeChatCompletion({
      choices: [
        {
          message: { role: 'assistant', content: { type: 'text', value: 'Hello' } },
        },
      ],
    });

    expect(normalized.text).toBe('[object Object]');
  });

  it('trims trailing slashes from base URLs', () => {
    expect(trimTrailingSlash('https://analytics.alephant.io///')).toBe('https://analytics.alephant.io');
  });

  it('exposes focused URL trimming helper', () => {
    expect(trimUrlTrailingSlash('https://ai.alephant.io/v1///')).toBe('https://ai.alephant.io/v1');
  });

  it('parses JSON object parameters from strings and objects', () => {
    expect(parseJsonObjectInput('{"seed":7}', 'Additional Options')).toEqual({ seed: 7 });
    expect(parseJsonObjectInput({ workflow: 'wf_1' }, 'Metadata')).toEqual({ workflow: 'wf_1' });
    expect(parseJsonObjectInput('', 'Metadata')).toEqual({});
    expect(parseJsonObjectInput(undefined, 'Metadata')).toEqual({});
  });

  it('rejects JSON parameters that are not objects', () => {
    expect(() => parseJsonObjectInput('[1,2]', 'Metadata')).toThrow('Metadata must be a JSON object');
    expect(() => parseJsonObjectInput('{bad json}', 'Metadata')).toThrow('Metadata must be valid JSON');
  });
});
