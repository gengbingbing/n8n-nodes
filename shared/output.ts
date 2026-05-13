import type { NormalizedChatCompletion } from './types';

export function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function normalizeChatCompletion(raw: any, requestId?: string): NormalizedChatCompletion {
  const firstChoice = Array.isArray(raw?.choices) ? raw.choices[0] : undefined;
  const text =
    firstChoice?.message?.content ??
    firstChoice?.text ??
    '';

  return {
    raw,
    text,
    usage: raw?.usage ?? {},
    model: raw?.model,
    requestId,
    finishReason: firstChoice?.finish_reason ?? firstChoice?.finishReason,
  };
}
