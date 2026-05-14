import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { randomUUID } from 'crypto';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { ENDPOINTS } from '../../shared/constants';
import { resolveVirtualKeyCredentials } from '../../shared/credentials';
import { alephantRequest } from '../../shared/http';
import { parseJsonObjectInput } from '../../shared/json';
import { normalizeChatCompletion } from '../../shared/output';
import type { AlephantVirtualKeyCredentials, ChatMessage, InputMode } from '../../shared/types';

export interface ChatCompletionInput {
  model: string;
  inputMode: InputMode;
  prompt?: string;
  messages?: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: string;
  metadata?: Record<string, unknown>;
  additionalOptions?: Record<string, unknown>;
}

const CORE_CHAT_COMPLETION_FIELDS = new Set([
  'model',
  'messages',
  'temperature',
  'max_tokens',
  'response_format',
  'metadata',
]);

function filterAdditionalOptions(options: Record<string, unknown>): IDataObject {
  return Object.fromEntries(
    Object.entries(options).filter(([key]) => !CORE_CHAT_COMPLETION_FIELDS.has(key)),
  ) as IDataObject;
}

function hasObjectKeys(value: Record<string, unknown> | undefined): value is Record<string, unknown> {
  return value !== undefined && Object.keys(value).length > 0;
}

export function buildChatCompletionBody(input: ChatCompletionInput): IDataObject {
  const messages =
    input.inputMode === 'messages'
      ? input.messages || []
      : [{ role: 'user', content: input.prompt || '' }];
  const additionalOptions = filterAdditionalOptions(input.additionalOptions || {});

  const body: IDataObject = {
    ...additionalOptions,
    model: input.model,
    messages,
  };

  if (typeof input.temperature === 'number') {
    body.temperature = input.temperature;
  }
  if (typeof input.maxTokens === 'number') {
    body.max_tokens = input.maxTokens;
  }
  if (hasObjectKeys(input.metadata) && additionalOptions.store === true) {
    body.metadata = input.metadata;
  }
  if (input.responseFormat && input.responseFormat !== 'text') {
    body.response_format = { type: input.responseFormat };
  }

  return body;
}

export function parseMessagesInput(value: unknown): ChatMessage[] {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error('Messages must be valid JSON');
    }
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Messages must be a JSON array');
  }

  for (const message of parsed) {
    if (
      typeof message !== 'object' ||
      message === null ||
      typeof (message as ChatMessage).role !== 'string' ||
      typeof (message as ChatMessage).content !== 'string'
    ) {
      throw new Error('Each message must include string role and content fields');
    }
  }

  return parsed as ChatMessage[];
}

export class AlephantAi implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Alephant AI',
    name: 'alephantAi',
    icon: 'file:alephant.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Call Alephant AI Gateway with a Virtual Key',
    defaults: { name: 'Alephant AI' },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: 'alephantVirtualKeyApi', required: true }],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        default: 'chatCompletion',
        options: [{ name: 'Chat Completion', value: 'chatCompletion' }],
      },
      {
        displayName: 'Model',
        name: 'model',
        type: 'string',
        default: 'gpt-4o-mini',
        required: true,
      },
      {
        displayName: 'Input Mode',
        name: 'inputMode',
        type: 'options',
        default: 'prompt',
        options: [
          { name: 'Prompt', value: 'prompt' },
          { name: 'Messages JSON', value: 'messages' },
        ],
      },
      {
        displayName: 'Prompt',
        name: 'prompt',
        type: 'string',
        typeOptions: { rows: 5 },
        default: '',
        displayOptions: { show: { inputMode: ['prompt'] } },
      },
      {
        displayName: 'Messages',
        name: 'messages',
        type: 'json',
        default: '[]',
        displayOptions: { show: { inputMode: ['messages'] } },
      },
      {
        displayName: 'Temperature',
        name: 'temperature',
        type: 'number',
        default: undefined,
      },
      {
        displayName: 'Max Tokens',
        name: 'maxTokens',
        type: 'number',
        default: undefined,
      },
      {
        displayName: 'Response Format',
        name: 'responseFormat',
        type: 'options',
        default: 'text',
        options: [
          { name: 'Text', value: 'text' },
          { name: 'JSON Object', value: 'json_object' },
        ],
      },
      {
        displayName: 'Metadata',
        name: 'metadata',
        type: 'json',
        default: '{}',
      },
      {
        displayName: 'Additional Options',
        name: 'additionalOptions',
        type: 'json',
        default: '{}',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const credentials = resolveVirtualKeyCredentials(
      (await this.getCredentials('alephantVirtualKeyApi')) as AlephantVirtualKeyCredentials,
    );
    const returnData: INodeExecutionData[] = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      const inputMode = this.getNodeParameter('inputMode', itemIndex) as InputMode;
      let body: IDataObject;

      try {
        const messages =
          inputMode === 'messages'
            ? parseMessagesInput(this.getNodeParameter('messages', itemIndex, []))
            : [];

        body = buildChatCompletionBody({
          model: this.getNodeParameter('model', itemIndex) as string,
          inputMode,
          prompt: this.getNodeParameter('prompt', itemIndex, '') as string,
          messages,
          temperature:
            (this.getNodeParameter('temperature', itemIndex, null) as number | null) ?? undefined,
          maxTokens:
            (this.getNodeParameter('maxTokens', itemIndex, null) as number | null) ?? undefined,
          responseFormat: this.getNodeParameter('responseFormat', itemIndex, 'text') as string,
          metadata: parseJsonObjectInput(this.getNodeParameter('metadata', itemIndex, {}), 'Metadata'),
          additionalOptions: parseJsonObjectInput(
            this.getNodeParameter('additionalOptions', itemIndex, {}),
            'Additional Options',
          ),
        });
      } catch (error) {
        throw new NodeOperationError(
          this.getNode(),
          error instanceof Error ? error.message : 'Invalid Alephant AI input',
          { itemIndex },
        );
      }

      if (!Array.isArray(body.messages) || body.messages.length === 0) {
        throw new NodeOperationError(this.getNode(), 'At least one message is required', {
          itemIndex,
        });
      }

      const requestLogId = randomUUID();
      const raw = await alephantRequest<Record<string, unknown>>(this, {
        method: 'POST',
        baseUrl: credentials.gatewayBaseUrl,
        path: ENDPOINTS.chatCompletions,
        token: credentials.virtualKey,
        headers: { 'x-request-id': requestLogId },
        body,
        itemIndex,
      });

      const inputWorkspaceId = items[itemIndex]?.json?.workspaceId;
      const workspaceId =
        typeof inputWorkspaceId === 'string' && inputWorkspaceId.trim() !== ''
          ? inputWorkspaceId.trim()
          : undefined;
      const normalized = normalizeChatCompletion(raw, requestLogId) as unknown as IDataObject;
      if (workspaceId) {
        normalized.workspaceId = workspaceId;
      }

      returnData.push({
        json: normalized,
        pairedItem: { item: itemIndex },
      });
    }

    return [returnData];
  }
}
