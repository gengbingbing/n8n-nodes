import type { NormalizedChatCompletion } from './types';
export { trimTrailingSlash } from './url';

export function normalizeChatCompletion(raw: any, requestId?: string): NormalizedChatCompletion {
  const firstChoice = Array.isArray(raw?.choices) ? raw.choices[0] : undefined;
  const content =
    firstChoice?.message?.content ??
    firstChoice?.text ??
    '';
  const text = typeof content === 'string' ? content : String(content);

  return {
    raw,
    text,
    usage: raw?.usage ?? {},
    model: raw?.model,
    requestId,
    requestLogId: requestId,
    finishReason: firstChoice?.finish_reason ?? firstChoice?.finishReason,
  };
}
