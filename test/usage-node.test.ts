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

  it('executes usage requests against analytics base URL with virtual key credentials', async () => {
    const httpRequest = jest.fn().mockResolvedValue({ total_cost: 12.34 });
    const node = new AlephantUsage();
    const ctx = {
      getInputData: jest.fn().mockReturnValue([{ json: { input: true } }]),
      getCredentials: jest.fn().mockResolvedValue({
        virtualKey: 'vk_test',
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
      url: 'https://analytics.example/api/v1/cockpit/usage-summary',
      json: true,
      headers: {
        Authorization: 'Bearer vk_test',
        'Content-Type': 'application/json',
      },
      qs: { period: '7d' },
      body: undefined,
    });
  });
});
