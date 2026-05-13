import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
import { ENDPOINTS } from '../../shared/constants';
import { resolveVirtualKeyCredentials } from '../../shared/credentials';
import { alephantRequest } from '../../shared/http';
import type { AlephantVirtualKeyCredentials } from '../../shared/types';

export type UsageOperation =
  | 'scope'
  | 'budgetStatus'
  | 'usageSummary'
  | 'dailyCosts'
  | 'costByModel'
  | 'recentRequests';

export interface UsageRequestParams {
  period?: string;
  limit?: number;
  offset?: number;
}

export interface UsageRequest {
  path: string;
  qs?: IDataObject;
}

export function buildUsageRequest(
  operation: UsageOperation,
  params: UsageRequestParams,
): UsageRequest {
  switch (operation) {
    case 'scope':
      return { path: ENDPOINTS.cockpitScope };
    case 'budgetStatus':
      return { path: ENDPOINTS.cockpitBudgetStatus, qs: { period: params.period } };
    case 'usageSummary':
      return { path: ENDPOINTS.cockpitUsageSummary, qs: { period: params.period } };
    case 'dailyCosts':
      return { path: ENDPOINTS.cockpitDailyCosts, qs: { period: params.period } };
    case 'costByModel':
      return { path: ENDPOINTS.cockpitCostByModel, qs: { period: params.period } };
    case 'recentRequests':
      return {
        path: ENDPOINTS.cockpitRecentRequests,
        qs: { limit: params.limit, offset: params.offset },
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
      const request = buildUsageRequest(operation, {
        period: this.getNodeParameter('period', itemIndex, '7d') as string,
        limit: this.getNodeParameter('limit', itemIndex, 50) as number,
        offset: this.getNodeParameter('offset', itemIndex, 0) as number,
      });

      const data = await alephantRequest<IDataObject>(this, {
        method: 'GET',
        baseUrl: credentials.analyticsBaseUrl,
        path: request.path,
        token: credentials.virtualKey,
        qs: request.qs,
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
