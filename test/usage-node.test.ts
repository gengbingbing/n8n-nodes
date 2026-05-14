import type { IExecuteFunctions } from 'n8n-workflow';
import { AlephantUsage, buildUsageRequest } from '../nodes/AlephantUsage/AlephantUsage.node';

describe('Alephant Usage node', () => {
  it.each([
    ['scope', {}, { path: '/api/v1/cockpit/scope' }],
    [
      'budgetStatus',
      { period: '7d' },
      { path: '/api/v1/cockpit/budget-status', qs: { period: '7d' } },
    ],
    [
      'usageSummary',
      { period: '7d' },
      { path: '/api/v1/cockpit/usage-summary', qs: { period: '7d' } },
    ],
    [
      'dailyCosts',
      { period: '30d' },
      { path: '/api/v1/cockpit/daily-costs', qs: { period: '30d' } },
    ],
    [
      'costByModel',
      { period: '90d' },
      { path: '/api/v1/cockpit/cost-by-model', qs: { period: '90d' } },
    ],
    [
      'recentRequests',
      { limit: 25, offset: 10 },
      { path: '/api/v1/cockpit/recent-requests', qs: { limit: 25, offset: 10 } },
    ],
    [
      'requestLogDetail',
      { requestLogId: '79a583b6-1fe1-41bf-a53b-c23b469329b1' },
      {
        host: 'analytics',
        path: '/v1/analytics/request-logs/79a583b6-1fe1-41bf-a53b-c23b469329b1',
      },
    ],
  ] as const)('maps %s operation', (operation, params, expected) => {
    expect(buildUsageRequest(operation, params)).toEqual(expected);
  });

  it.each(['budgetStatus', 'usageSummary', 'dailyCosts', 'costByModel'] as const)(
    'omits missing period for %s',
    (operation) => {
      expect(buildUsageRequest(operation, {})).toEqual({
        path: expect.stringMatching(/^\/api\/v1\/cockpit\//),
      });
    },
  );

  it('omits empty period values', () => {
    expect(buildUsageRequest('usageSummary', { period: '' })).toEqual({
      path: '/api/v1/cockpit/usage-summary',
    });
  });

  it('omits null period values', () => {
    expect(buildUsageRequest('usageSummary', { period: null })).toEqual({
      path: '/api/v1/cockpit/usage-summary',
    });
  });

  it('omits non-meaningful recent request query values', () => {
    expect(
      buildUsageRequest('recentRequests', {
        limit: 0,
        offset: null,
      }),
    ).toEqual({
      path: '/api/v1/cockpit/recent-requests',
    });
  });

  it('keeps meaningful recent request query values independently', () => {
    expect(buildUsageRequest('recentRequests', { offset: 0 })).toEqual({
      path: '/api/v1/cockpit/recent-requests',
      qs: { offset: 0 },
    });
  });

  it('executes cockpit usage requests against SaaS base URL with virtual key credentials', async () => {
    const httpRequest = jest.fn().mockResolvedValue({ total_cost: 12.34 });
    const node = new AlephantUsage();
    const ctx = {
      getInputData: jest.fn().mockReturnValue([{ json: { input: true } }]),
      getCredentials: jest.fn().mockResolvedValue({
        virtualKey: 'vk_test',
        saasBaseUrl: 'https://saas.example/',
        analyticsBaseUrl: 'https://analytics.example/',
      }),
      getNodeParameter: jest.fn((name: string) => {
        const values: Record<string, unknown> = {
          operation: 'usageSummary',
          period: '7d',
          limit: 50,
          offset: 0,
        };

        return values[name];
      }),
      helpers: { httpRequest },
    } as unknown as IExecuteFunctions;

    await expect(node.execute.call(ctx)).resolves.toEqual([
      [{ json: { total_cost: 12.34 }, pairedItem: { item: 0 } }],
    ]);

    expect(httpRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: 'https://saas.example/api/v1/cockpit/usage-summary',
      json: true,
      headers: {
        Authorization: 'Bearer vk_test',
        'Content-Type': 'application/json',
      },
      qs: { period: '7d' },
      body: undefined,
    });
  });

  it('executes request log detail requests against analytics base URL with workspace id', async () => {
    const httpRequest = jest.fn().mockResolvedValue({
      data: { row: { request_id: '79a583b6-1fe1-41bf-a53b-c23b469329b1', cost: 0.000012 } },
    });
    const node = new AlephantUsage();
    const ctx = {
      getInputData: jest.fn().mockReturnValue([{ json: { input: true } }]),
      getCredentials: jest.fn().mockResolvedValue({
        virtualKey: 'vk_test',
        workspaceId: 'workspace-id',
        saasBaseUrl: 'https://saas.example/',
        analyticsBaseUrl: 'https://analytics.example/',
      }),
      getNodeParameter: jest.fn((name: string) => {
        const values: Record<string, unknown> = {
          operation: 'requestLogDetail',
          requestLogId: '79a583b6-1fe1-41bf-a53b-c23b469329b1',
          period: '7d',
          limit: 50,
          offset: 0,
        };

        return values[name];
      }),
      helpers: { httpRequest },
    } as unknown as IExecuteFunctions;

    await expect(node.execute.call(ctx)).resolves.toEqual([
      [
        {
          json: {
            data: {
              row: { request_id: '79a583b6-1fe1-41bf-a53b-c23b469329b1', cost: 0.000012 },
            },
          },
          pairedItem: { item: 0 },
        },
      ],
    ]);

    expect(httpRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: 'https://analytics.example/v1/analytics/request-logs/79a583b6-1fe1-41bf-a53b-c23b469329b1',
      json: true,
      headers: {
        Authorization: 'Bearer vk_test',
        'Content-Type': 'application/json',
        'X-Workspace-Id': 'workspace-id',
      },
      qs: undefined,
      body: undefined,
    });
  });

  it('uses request log detail workspace id from node parameters when credentials do not include it', async () => {
    const httpRequest = jest.fn().mockResolvedValue({
      data: { row: { request_id: '79a583b6-1fe1-41bf-a53b-c23b469329b1', cost: 0.000012 } },
    });
    const node = new AlephantUsage();
    const ctx = {
      getInputData: jest.fn().mockReturnValue([{ json: { input: true } }]),
      getCredentials: jest.fn().mockResolvedValue({
        virtualKey: 'vk_test',
        workspaceId: '',
        saasBaseUrl: 'https://saas.example/',
        analyticsBaseUrl: 'https://analytics.example/',
      }),
      getNode: jest.fn().mockReturnValue({ name: 'Alephant Usage' }),
      getNodeParameter: jest.fn((name: string) => {
        const values: Record<string, unknown> = {
          operation: 'requestLogDetail',
          requestLogId: '79a583b6-1fe1-41bf-a53b-c23b469329b1',
          workspaceId: 'node-workspace-id',
          period: '7d',
          limit: 50,
          offset: 0,
        };

        return values[name];
      }),
      helpers: { httpRequest },
    } as unknown as IExecuteFunctions;

    await expect(node.execute.call(ctx)).resolves.toEqual([
      [
        {
          json: {
            data: {
              row: { request_id: '79a583b6-1fe1-41bf-a53b-c23b469329b1', cost: 0.000012 },
            },
          },
          pairedItem: { item: 0 },
        },
      ],
    ]);

    expect(httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Workspace-Id': 'node-workspace-id',
        }),
      }),
    );
  });

  it('uses request log detail workspace id from input JSON when node parameters and credentials do not include it', async () => {
    const httpRequest = jest.fn().mockResolvedValue({
      data: { row: { request_id: '79a583b6-1fe1-41bf-a53b-c23b469329b1', cost: 0.000012 } },
    });
    const node = new AlephantUsage();
    const ctx = {
      getInputData: jest.fn().mockReturnValue([
        { json: { workspaceId: 'input-workspace-id', input: true } },
      ]),
      getCredentials: jest.fn().mockResolvedValue({
        virtualKey: 'vk_test',
        workspaceId: '',
        saasBaseUrl: 'https://saas.example/',
        analyticsBaseUrl: 'https://analytics.example/',
      }),
      getNode: jest.fn().mockReturnValue({ name: 'Alephant Usage' }),
      getNodeParameter: jest.fn((name: string) => {
        const values: Record<string, unknown> = {
          operation: 'requestLogDetail',
          requestLogId: '79a583b6-1fe1-41bf-a53b-c23b469329b1',
          workspaceId: '',
          period: '7d',
          limit: 50,
          offset: 0,
        };

        return values[name];
      }),
      helpers: { httpRequest },
    } as unknown as IExecuteFunctions;

    await expect(node.execute.call(ctx)).resolves.toHaveLength(1);

    expect(httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Workspace-Id': 'input-workspace-id',
        }),
      }),
    );
  });

  it('resolves request log detail workspace id from scope when explicit values do not include it', async () => {
    const httpRequest = jest
      .fn()
      .mockResolvedValueOnce({
        data: {
          workspace: {
            id: 'scope-workspace-id',
          },
        },
      })
      .mockResolvedValueOnce({
        data: { row: { request_id: '79a583b6-1fe1-41bf-a53b-c23b469329b1', cost: 0.000012 } },
      });
    const node = new AlephantUsage();
    const ctx = {
      getInputData: jest.fn().mockReturnValue([{ json: { input: true } }]),
      getCredentials: jest.fn().mockResolvedValue({
        virtualKey: 'vk_test',
        workspaceId: '',
        saasBaseUrl: 'https://saas.example/',
        analyticsBaseUrl: 'https://analytics.example/',
      }),
      getNode: jest.fn().mockReturnValue({ name: 'Alephant Usage' }),
      getNodeParameter: jest.fn((name: string) => {
        const values: Record<string, unknown> = {
          operation: 'requestLogDetail',
          requestLogId: '79a583b6-1fe1-41bf-a53b-c23b469329b1',
          workspaceId: '',
          period: '7d',
          limit: 50,
          offset: 0,
        };

        return values[name];
      }),
      helpers: { httpRequest },
    } as unknown as IExecuteFunctions;

    await expect(node.execute.call(ctx)).resolves.toEqual([
      [
        {
          json: {
            data: {
              row: { request_id: '79a583b6-1fe1-41bf-a53b-c23b469329b1', cost: 0.000012 },
            },
          },
          pairedItem: { item: 0 },
        },
      ],
    ]);

    expect(httpRequest).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        method: 'GET',
        url: 'https://saas.example/api/v1/cockpit/scope',
      }),
    );
    expect(httpRequest).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        method: 'GET',
        url: 'https://analytics.example/v1/analytics/request-logs/79a583b6-1fe1-41bf-a53b-c23b469329b1',
        headers: expect.objectContaining({
          'X-Workspace-Id': 'scope-workspace-id',
        }),
      }),
    );
  });

  it('retries request log detail when the log has not been stored yet', async () => {
    const httpRequest = jest
      .fn()
      .mockRejectedValueOnce({
        response: {
          status: 404,
          data: {
            code: 40401,
            message: 'request not found',
            data: null,
          },
        },
      })
      .mockResolvedValueOnce({
        data: { row: { request_id: '79a583b6-1fe1-41bf-a53b-c23b469329b1', cost: 0.000012 } },
      });
    const node = new AlephantUsage();
    const ctx = {
      getInputData: jest.fn().mockReturnValue([{ json: { input: true } }]),
      getCredentials: jest.fn().mockResolvedValue({
        virtualKey: 'vk_test',
        workspaceId: 'workspace-id',
        saasBaseUrl: 'https://saas.example/',
        analyticsBaseUrl: 'https://analytics.example/',
      }),
      getNode: jest.fn().mockReturnValue({ name: 'Alephant Usage' }),
      getNodeParameter: jest.fn((name: string, _index: number, fallback?: unknown) => {
        const values: Record<string, unknown> = {
          operation: 'requestLogDetail',
          requestLogId: '79a583b6-1fe1-41bf-a53b-c23b469329b1',
          workspaceId: '',
          requestLogMaxAttempts: 3,
          requestLogRetryDelaySeconds: 0,
          period: '7d',
          limit: 50,
          offset: 0,
        };

        return name in values ? values[name] : fallback;
      }),
      helpers: { httpRequest },
    } as unknown as IExecuteFunctions;

    await expect(node.execute.call(ctx)).resolves.toEqual([
      [
        {
          json: {
            data: {
              row: { request_id: '79a583b6-1fe1-41bf-a53b-c23b469329b1', cost: 0.000012 },
            },
          },
          pairedItem: { item: 0 },
        },
      ],
    ]);

    expect(httpRequest).toHaveBeenCalledTimes(2);
  });
});
