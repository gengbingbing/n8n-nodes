export type InputMode = 'prompt' | 'messages';

export interface AlephantVirtualKeyCredentials {
  virtualKey: string;
  workspaceId?: string;
  gatewayBaseUrl?: string;
  saasBaseUrl?: string;
  analyticsBaseUrl?: string;
}

export interface AlephantManagerCredentials {
  pat: string;
  workspaceId: string;
  saasBaseUrl?: string;
  analyticsBaseUrl?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface NormalizedChatCompletion {
  raw: unknown;
  text: string;
  usage: Record<string, unknown>;
  model: string | undefined;
  requestId: string | undefined;
  requestLogId: string | undefined;
  finishReason: string | undefined;
}
