import type {
  IDataObject,
  IExecuteFunctions,
  IHttpRequestMethods,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { ENDPOINTS } from '../../shared/constants';
import { resolveManagerCredentials } from '../../shared/credentials';
import { alephantRequest } from '../../shared/http';
import { parseJsonObjectInput } from '../../shared/json';
import type { AlephantManagerCredentials } from '../../shared/types';

export type ManagementResource = 'agent' | 'virtualKey' | 'models' | 'workspaceUsage';
export type ManagementOperation =
  | 'list'
  | 'create'
  | 'revoke'
  | 'summary'
  | 'history'
  | 'costByModel';

const DEFAULT_OPERATION_BY_RESOURCE: Record<ManagementResource, ManagementOperation> = {
  agent: 'list',
  virtualKey: 'list',
  models: 'list',
  workspaceUsage: 'summary',
};

const DEFAULT_AGENT_PAGE = 1;
const DEFAULT_AGENT_PAGE_SIZE = 25;
const DEFAULT_VIRTUAL_KEY_PAGE = 1;
const DEFAULT_VIRTUAL_KEY_PAGE_SIZE = 50;

export interface ManagementRequest {
  method: IHttpRequestMethods;
  host: 'saas' | 'analytics';
  path: string;
  qs?: IDataObject;
  body?: IDataObject;
}

interface ManagementRequestParams {
  id?: string | number | boolean | null;
  page?: string | number | boolean | null;
  pageSize?: string | number | boolean | null;
  status?: string | number | boolean | null;
  departmentId?: string | number | boolean | null;
  environment?: string | number | boolean | null;
  search?: string | number | boolean | null;
  entityType?: string | number | boolean | null;
  dateFrom?: string | number | boolean | null;
  dateTo?: string | number | boolean | null;
  agentId?: string | number | boolean | null;
  memberId?: string | number | boolean | null;
  body?: unknown;
}

type ManagementQueryValue = string | number | boolean | null | undefined;

function getQueryParameter(
  ctx: IExecuteFunctions,
  name: string,
  itemIndex: number,
  fallback: ManagementQueryValue,
): ManagementQueryValue {
  return ctx.getNodeParameter(name, itemIndex, fallback) as ManagementQueryValue;
}

function compactQs(qs: IDataObject): IDataObject | undefined {
  const sanitized = Object.fromEntries(
    Object.entries(qs).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ) as IDataObject;

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function withQs(request: ManagementRequest, qs: IDataObject): ManagementRequest {
  const sanitized = compactQs(qs);
  return sanitized ? { ...request, qs: sanitized } : request;
}

export function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${fieldName} is required`);
  }

  return value.trim();
}

export function requireNonEmptyObject(value: unknown, fieldName: string): IDataObject {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).length === 0
  ) {
    throw new Error(`${fieldName} must not be empty`);
  }

  return value as IDataObject;
}

export function validateSingleAnalyticsScope(params: ManagementRequestParams): void {
  const populatedFilters = [params.agentId, params.memberId, params.departmentId].filter(
    (value) => value !== undefined && value !== null && value !== '',
  );

  if (populatedFilters.length > 1) {
    throw new Error('Choose only one analytics scope filter');
  }
}

export function buildManagementRequest(
  resource: ManagementResource,
  operation: ManagementOperation,
  params: ManagementRequestParams,
): ManagementRequest {
  if (resource === 'agent' && operation === 'list') {
    return withQs(
      {
        method: 'GET',
        host: 'saas',
        path: ENDPOINTS.agents,
      },
      {
        page: params.page,
        pageSize: params.pageSize,
        status: params.status,
        departmentId: params.departmentId,
        environment: params.environment,
        search: params.search,
      },
    );
  }

  if (resource === 'agent' && operation === 'create') {
    return {
      method: 'POST',
      host: 'saas',
      path: ENDPOINTS.agents,
      body: requireNonEmptyObject(params.body, 'Body'),
    };
  }

  if (resource === 'virtualKey' && operation === 'list') {
    return withQs(
      {
        method: 'GET',
        host: 'saas',
        path: ENDPOINTS.virtualKeys,
      },
      {
        page: params.page,
        pageSize: params.pageSize,
        status: params.status,
        entityType: params.entityType,
      },
    );
  }

  if (resource === 'virtualKey' && operation === 'create') {
    return {
      method: 'POST',
      host: 'saas',
      path: ENDPOINTS.virtualKeys,
      body: requireNonEmptyObject(params.body, 'Body'),
    };
  }

  if (resource === 'virtualKey' && operation === 'revoke') {
    const id = requireString(params.id, 'Virtual Key ID');
    return {
      method: 'POST',
      host: 'saas',
      path: `${ENDPOINTS.virtualKeys}/${id}/revoke`,
    };
  }

  if (resource === 'models' && operation === 'list') {
    return {
      method: 'GET',
      host: 'saas',
      path: ENDPOINTS.models,
    };
  }

  if (resource === 'workspaceUsage' && operation === 'summary') {
    return {
      method: 'GET',
      host: 'saas',
      path: ENDPOINTS.analyticsOverview,
    };
  }

  if (resource === 'workspaceUsage' && operation === 'history') {
    validateSingleAnalyticsScope(params);
    return withQs(
      {
        method: 'GET',
        host: 'saas',
        path: ENDPOINTS.analyticsUsage,
      },
      {
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        agentId: params.agentId,
        memberId: params.memberId,
        departmentId: params.departmentId,
      },
    );
  }

  if (resource === 'workspaceUsage' && operation === 'costByModel') {
    return withQs(
      {
        method: 'GET',
        host: 'saas',
        path: ENDPOINTS.analyticsModels,
      },
      {
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
      },
    );
  }

  throw new Error(`Unsupported Alephant Management operation: ${resource}.${operation}`);
}

function getManagementRequestParams(
  ctx: IExecuteFunctions,
  resource: ManagementResource,
  operation: ManagementOperation,
  itemIndex: number,
): ManagementRequestParams {
  if (resource === 'agent' && operation === 'list') {
    return {
      page: getQueryParameter(ctx, 'page', itemIndex, DEFAULT_AGENT_PAGE),
      pageSize: getQueryParameter(ctx, 'pageSize', itemIndex, DEFAULT_AGENT_PAGE_SIZE),
      status: getQueryParameter(ctx, 'status', itemIndex, ''),
      departmentId: getQueryParameter(ctx, 'departmentId', itemIndex, ''),
      environment: getQueryParameter(ctx, 'environment', itemIndex, ''),
      search: getQueryParameter(ctx, 'search', itemIndex, ''),
    };
  }

  if (resource === 'agent' && operation === 'create') {
    return {
      body: parseJsonObjectInput(ctx.getNodeParameter('body', itemIndex, {}), 'Body'),
    };
  }

  if (resource === 'virtualKey' && operation === 'list') {
    return {
      page: getQueryParameter(ctx, 'page', itemIndex, DEFAULT_VIRTUAL_KEY_PAGE),
      pageSize: getQueryParameter(ctx, 'pageSize', itemIndex, DEFAULT_VIRTUAL_KEY_PAGE_SIZE),
      status: getQueryParameter(ctx, 'status', itemIndex, ''),
      entityType: getQueryParameter(ctx, 'entityType', itemIndex, ''),
    };
  }

  if (resource === 'virtualKey' && operation === 'create') {
    return {
      body: parseJsonObjectInput(ctx.getNodeParameter('body', itemIndex, {}), 'Body'),
    };
  }

  if (resource === 'virtualKey' && operation === 'revoke') {
    return {
      id: getQueryParameter(ctx, 'id', itemIndex, ''),
    };
  }

  if (resource === 'workspaceUsage' && operation === 'history') {
    return {
      dateFrom: getQueryParameter(ctx, 'dateFrom', itemIndex, ''),
      dateTo: getQueryParameter(ctx, 'dateTo', itemIndex, ''),
      agentId: getQueryParameter(ctx, 'agentId', itemIndex, ''),
      memberId: getQueryParameter(ctx, 'memberId', itemIndex, ''),
      departmentId: getQueryParameter(ctx, 'usageDepartmentId', itemIndex, ''),
    };
  }

  if (resource === 'workspaceUsage' && operation === 'costByModel') {
    return {
      dateFrom: getQueryParameter(ctx, 'dateFrom', itemIndex, ''),
      dateTo: getQueryParameter(ctx, 'dateTo', itemIndex, ''),
    };
  }

  return {};
}

export class AlephantManagement implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Alephant Management',
    name: 'alephantManagement',
    icon: 'file:alephant.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["resource"]}}',
    description: 'Manage Alephant agents, virtual keys, models, and workspace analytics',
    defaults: { name: 'Alephant Management' },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: 'alephantManagerApi', required: true }],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        default: 'agent',
        options: [
          { name: 'Agent', value: 'agent' },
          { name: 'Models', value: 'models' },
          { name: 'Virtual Key', value: 'virtualKey' },
          { name: 'Workspace Usage', value: 'workspaceUsage' },
        ],
      },
      {
        displayName: 'Operation',
        name: 'agentOperation',
        type: 'options',
        noDataExpression: true,
        default: 'list',
        displayOptions: { show: { resource: ['agent'] } },
        options: [
          { name: 'Create', value: 'create' },
          { name: 'List', value: 'list' },
        ],
      },
      {
        displayName: 'Operation',
        name: 'virtualKeyOperation',
        type: 'options',
        noDataExpression: true,
        default: 'list',
        displayOptions: { show: { resource: ['virtualKey'] } },
        options: [
          { name: 'Create', value: 'create' },
          { name: 'List', value: 'list' },
          { name: 'Revoke', value: 'revoke' },
        ],
      },
      {
        displayName: 'Operation',
        name: 'modelsOperation',
        type: 'options',
        noDataExpression: true,
        default: 'list',
        displayOptions: { show: { resource: ['models'] } },
        options: [{ name: 'List', value: 'list' }],
      },
      {
        displayName: 'Operation',
        name: 'workspaceUsageOperation',
        type: 'options',
        noDataExpression: true,
        default: 'summary',
        displayOptions: { show: { resource: ['workspaceUsage'] } },
        options: [
          { name: 'Cost By Model', value: 'costByModel' },
          { name: 'History', value: 'history' },
          { name: 'Summary', value: 'summary' },
        ],
      },
      {
        displayName: 'Virtual Key ID',
        name: 'id',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['virtualKey'], virtualKeyOperation: ['revoke'] } },
      },
      {
        displayName: 'Page',
        name: 'page',
        type: 'number',
        default: DEFAULT_AGENT_PAGE,
        displayOptions: { show: { resource: ['agent'], agentOperation: ['list'] } },
      },
      {
        displayName: 'Page',
        name: 'page',
        type: 'number',
        default: DEFAULT_VIRTUAL_KEY_PAGE,
        displayOptions: { show: { resource: ['virtualKey'], virtualKeyOperation: ['list'] } },
      },
      {
        displayName: 'Page Size',
        name: 'pageSize',
        type: 'number',
        default: DEFAULT_AGENT_PAGE_SIZE,
        displayOptions: { show: { resource: ['agent'], agentOperation: ['list'] } },
      },
      {
        displayName: 'Page Size',
        name: 'pageSize',
        type: 'number',
        default: DEFAULT_VIRTUAL_KEY_PAGE_SIZE,
        displayOptions: { show: { resource: ['virtualKey'], virtualKeyOperation: ['list'] } },
      },
      {
        displayName: 'Status',
        name: 'status',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['agent'], agentOperation: ['list'] } },
      },
      {
        displayName: 'Status',
        name: 'status',
        type: 'string',
        default: '',
        displayOptions: {
          show: { resource: ['virtualKey'], virtualKeyOperation: ['list'] },
        },
      },
      {
        displayName: 'Entity Type',
        name: 'entityType',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['virtualKey'], virtualKeyOperation: ['list'] } },
      },
      {
        displayName: 'Agent ID',
        name: 'agentId',
        type: 'string',
        default: '',
        displayOptions: {
          show: { resource: ['workspaceUsage'], workspaceUsageOperation: ['history'] },
        },
      },
      {
        displayName: 'Member ID',
        name: 'memberId',
        type: 'string',
        default: '',
        displayOptions: {
          show: { resource: ['workspaceUsage'], workspaceUsageOperation: ['history'] },
        },
      },
      {
        displayName: 'Department ID',
        name: 'usageDepartmentId',
        type: 'string',
        default: '',
        displayOptions: {
          show: { resource: ['workspaceUsage'], workspaceUsageOperation: ['history'] },
        },
      },
      {
        displayName: 'Department ID',
        name: 'departmentId',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['agent'], agentOperation: ['list'] } },
      },
      {
        displayName: 'Environment',
        name: 'environment',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['agent'], agentOperation: ['list'] } },
      },
      {
        displayName: 'Search',
        name: 'search',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['agent'], agentOperation: ['list'] } },
      },
      {
        displayName: 'Date From',
        name: 'dateFrom',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            resource: ['workspaceUsage'],
            workspaceUsageOperation: ['history', 'costByModel'],
          },
        },
      },
      {
        displayName: 'Date To',
        name: 'dateTo',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            resource: ['workspaceUsage'],
            workspaceUsageOperation: ['history', 'costByModel'],
          },
        },
      },
      {
        displayName: 'Agent Body',
        name: 'body',
        type: 'json',
        default: '{}',
        displayOptions: { show: { resource: ['agent'], agentOperation: ['create'] } },
      },
      {
        displayName: 'Virtual Key Body',
        name: 'body',
        type: 'json',
        default: '{}',
        displayOptions: { show: { resource: ['virtualKey'], virtualKeyOperation: ['create'] } },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const credentials = resolveManagerCredentials(
      (await this.getCredentials('alephantManagerApi')) as AlephantManagerCredentials,
    );
    const returnData: INodeExecutionData[] = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      const resource = this.getNodeParameter('resource', itemIndex, 'agent') as ManagementResource;
      const operation = this.getNodeParameter(
        `${resource}Operation`,
        itemIndex,
        DEFAULT_OPERATION_BY_RESOURCE[resource],
      ) as ManagementOperation;
      let request: ManagementRequest;

      try {
        const params = getManagementRequestParams(this, resource, operation, itemIndex);
        request = buildManagementRequest(resource, operation, params);
      } catch (error) {
        throw new NodeOperationError(
          this.getNode(),
          error instanceof Error ? error.message : 'Invalid Alephant Management input',
          { itemIndex },
        );
      }

      const data = await alephantRequest<IDataObject>(this, {
        method: request.method,
        baseUrl:
          request.host === 'saas' ? credentials.saasBaseUrl : credentials.analyticsBaseUrl,
        path: request.path,
        token: credentials.pat,
        workspaceId: credentials.workspaceId,
        qs: request.qs,
        body: request.body,
        itemIndex,
      });

      returnData.push({
        json: data,
        pairedItem: { item: itemIndex },
      });
    }

    return [returnData];
  }
}
