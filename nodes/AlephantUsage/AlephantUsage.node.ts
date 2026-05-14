import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { ENDPOINTS } from '../../shared/constants';
import { resolveVirtualKeyCredentials } from '../../shared/credentials';
import { alephantRequest } from '../../shared/http';
import type { AlephantRequestOptions } from '../../shared/http';
import type { AlephantVirtualKeyCredentials } from '../../shared/types';

export type UsageOperation =
  | 'scope'
  | 'budgetStatus'
  | 'usageSummary'
  | 'dailyCosts'
  | 'costByModel'
  | 'recentRequests'
  | 'requestLogDetail';

export interface UsageRequestParams {
  period?: string | null;
  limit?: number | null;
  offset?: number | null;
  requestLogId?: string | null;
}

export interface UsageRequest {
  host?: 'saas' | 'analytics';
  path: string;
  qs?: IDataObject;
}

function withQs(path: string, qs: IDataObject): UsageRequest {
  const sanitized = Object.fromEntries(
    Object.entries(qs).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ) as IDataObject;

  return Object.keys(sanitized).length > 0 ? { path, qs: sanitized } : { path };
}

function isPositiveNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isNonNegativeNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function requireRequestLogId(value: string | null | undefined): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('Request Log ID is required');
  }

  return encodeURIComponent(value.trim());
}

function normalizeOptionalString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }

    return (current as Record<string, unknown>)[key];
  }, source);
}

function extractWorkspaceIdFromScope(scope: IDataObject): string {
  const paths = [
    'workspaceId',
    'workspace_id',
    'xWorkspaceId',
    'workspace.id',
    'workspace.uuid',
    'data.workspaceId',
    'data.workspace_id',
    'data.workspace.id',
    'data.workspace.uuid',
    'scope.workspaceId',
    'scope.workspace_id',
    'scope.workspace.id',
    'scope.workspace.uuid',
  ];

  for (const path of paths) {
    const workspaceId = normalizeOptionalString(readPath(scope, path));
    if (workspaceId !== '') {
      return workspaceId;
    }
  }

  return '';
}

function normalizeAttemptCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 6;
}

function normalizeDelayMs(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value * 1000)
    : 1000;
}

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function isRequestLogNotFoundError(error: unknown): boolean {
  const httpCode = normalizeOptionalString(readPath(error, 'httpCode'));
  const status = readPath(error, 'response.status') ?? readPath(error, 'status');
  const code = readPath(error, 'context.data.code') ?? readPath(error, 'response.data.code');
  const message =
    normalizeOptionalString(readPath(error, 'context.data.message')) ||
    normalizeOptionalString(readPath(error, 'response.data.message')) ||
    normalizeOptionalString(readPath(error, 'message'));

  return (
    (httpCode === '404' || status === 404) &&
    (code === 40401 || message.toLowerCase().includes('request not found'))
  );
}

async function requestWithLogPolling<T>(
  ctx: IExecuteFunctions,
  options: AlephantRequestOptions,
  maxAttempts: number,
  retryDelayMs: number,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await alephantRequest<T>(ctx, options);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isRequestLogNotFoundError(error)) {
        throw error;
      }

      await sleep(retryDelayMs);
    }
  }

  throw lastError;
}

export function buildUsageRequest(
  operation: UsageOperation,
  params: UsageRequestParams,
): UsageRequest {
  switch (operation) {
    case 'scope':
      return { path: ENDPOINTS.cockpitScope };
    case 'budgetStatus':
      return withQs(ENDPOINTS.cockpitBudgetStatus, { period: params.period });
    case 'usageSummary':
      return withQs(ENDPOINTS.cockpitUsageSummary, { period: params.period });
    case 'dailyCosts':
      return withQs(ENDPOINTS.cockpitDailyCosts, { period: params.period });
    case 'costByModel':
      return withQs(ENDPOINTS.cockpitCostByModel, { period: params.period });
    case 'recentRequests':
      return withQs(ENDPOINTS.cockpitRecentRequests, {
        limit: isPositiveNumber(params.limit) ? params.limit : undefined,
        offset: isNonNegativeNumber(params.offset) ? params.offset : undefined,
      });
    case 'requestLogDetail':
      return {
        host: 'analytics',
        path: `${ENDPOINTS.analyticsRequestLogs}/${requireRequestLogId(params.requestLogId)}`,
      };
  }
}

export class AlephantUsage implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Alephant Usage',
    name: 'alephantUsage',
    icon: 'file:alephant.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Inspect Alephant Virtual Key usage and cost analytics',
    defaults: { name: 'Alephant Usage' },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: 'alephantVirtualKeyApi', required: true }],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        default: 'usageSummary',
        options: [
          { name: 'Budget Status', value: 'budgetStatus' },
          { name: 'Cost By Model', value: 'costByModel' },
          { name: 'Daily Costs', value: 'dailyCosts' },
          { name: 'Recent Requests', value: 'recentRequests' },
          { name: 'Request Log Detail', value: 'requestLogDetail' },
          { name: 'Scope', value: 'scope' },
          { name: 'Usage Summary', value: 'usageSummary' },
        ],
      },
      {
        displayName: 'Period',
        name: 'period',
        type: 'options',
        default: '7d',
        options: [
          { name: '24 Hours', value: '24h' },
          { name: '7 Days', value: '7d' },
          { name: '30 Days', value: '30d' },
          { name: '90 Days', value: '90d' },
        ],
        displayOptions: {
          show: {
            operation: ['budgetStatus', 'usageSummary', 'dailyCosts', 'costByModel'],
          },
        },
      },
      {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        default: 50,
        typeOptions: { minValue: 1 },
        displayOptions: { show: { operation: ['recentRequests'] } },
      },
      {
        displayName: 'Offset',
        name: 'offset',
        type: 'number',
        default: 0,
        typeOptions: { minValue: 0 },
        displayOptions: { show: { operation: ['recentRequests'] } },
      },
      {
        displayName: 'Request Log ID',
        name: 'requestLogId',
        type: 'string',
        default: '={{$json.requestLogId || $json.requestId || ""}}',
        required: true,
        displayOptions: { show: { operation: ['requestLogDetail'] } },
      },
      {
        displayName: 'Workspace ID',
        name: 'workspaceId',
        type: 'string',
        default: '={{$json.workspaceId || $json.workspace_id || $json.xWorkspaceId || ""}}',
        description:
          'Workspace ID for analytics request log lookups. Overrides the Workspace ID in credentials when set.',
        displayOptions: { show: { operation: ['requestLogDetail'] } },
      },
      {
        displayName: 'Request Log Max Attempts',
        name: 'requestLogMaxAttempts',
        type: 'number',
        default: 6,
        typeOptions: { minValue: 1 },
        description: 'Maximum number of attempts while waiting for asynchronous request logs',
        displayOptions: { show: { operation: ['requestLogDetail'] } },
      },
      {
        displayName: 'Request Log Retry Delay Seconds',
        name: 'requestLogRetryDelaySeconds',
        type: 'number',
        default: 1,
        typeOptions: { minValue: 0 },
        description: 'Delay between request log lookup attempts',
        displayOptions: { show: { operation: ['requestLogDetail'] } },
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
      const operation = this.getNodeParameter('operation', itemIndex) as UsageOperation;
      let request: UsageRequest;

      try {
        request = buildUsageRequest(operation, {
          period: this.getNodeParameter('period', itemIndex, '7d') as string,
          limit: this.getNodeParameter('limit', itemIndex, 50) as number,
          offset: this.getNodeParameter('offset', itemIndex, 0) as number,
          requestLogId: this.getNodeParameter('requestLogId', itemIndex, '') as string,
        });
      } catch (error) {
        throw new NodeOperationError(
          this.getNode(),
          error instanceof Error ? error.message : 'Invalid Alephant Usage input',
          { itemIndex },
        );
      }

      let workspaceId =
        request.host === 'analytics'
          ? normalizeOptionalString(this.getNodeParameter('workspaceId', itemIndex, '')) ||
            normalizeOptionalString(items[itemIndex]?.json?.workspaceId) ||
            normalizeOptionalString(items[itemIndex]?.json?.workspace_id) ||
            normalizeOptionalString(items[itemIndex]?.json?.xWorkspaceId) ||
            credentials.workspaceId
          : undefined;

      if (request.host === 'analytics' && workspaceId === '') {
        const scope = await alephantRequest<IDataObject>(this, {
          method: 'GET',
          baseUrl: credentials.saasBaseUrl,
          path: ENDPOINTS.cockpitScope,
          token: credentials.virtualKey,
          itemIndex,
        });
        workspaceId = extractWorkspaceIdFromScope(scope);
      }

      if (request.host === 'analytics' && workspaceId === '') {
        throw new NodeOperationError(
          this.getNode(),
          'Workspace ID is required for request log detail lookups and could not be resolved from Alephant Scope',
          { itemIndex },
        );
      }

      const requestOptions: AlephantRequestOptions = {
        method: 'GET',
        baseUrl: request.host === 'analytics' ? credentials.analyticsBaseUrl : credentials.saasBaseUrl,
        path: request.path,
        token: credentials.virtualKey,
        workspaceId,
        qs: request.qs,
        itemIndex,
      };
      const data =
        request.host === 'analytics'
          ? await requestWithLogPolling<IDataObject>(
              this,
              requestOptions,
              normalizeAttemptCount(
                this.getNodeParameter('requestLogMaxAttempts', itemIndex, 6),
              ),
              normalizeDelayMs(
                this.getNodeParameter('requestLogRetryDelaySeconds', itemIndex, 1),
              ),
            )
          : await alephantRequest<IDataObject>(this, requestOptions);

      returnData.push({
        json: data,
        pairedItem: { item: itemIndex },
      });
    }

    return [returnData];
  }
}
