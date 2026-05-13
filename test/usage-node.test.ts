import { buildUsageRequest } from '../nodes/AlephantUsage/AlephantUsage.node';

describe('Alephant Usage node', () => {
  it('maps usage summary operation', () => {
    expect(buildUsageRequest('usageSummary', { period: '7d' })).toEqual({
      path: '/api/v1/cockpit/usage-summary',
      qs: { period: '7d' },
    });
  });

  it('maps recent requests operation', () => {
    expect(buildUsageRequest('recentRequests', { limit: 25, offset: 10 })).toEqual({
      path: '/api/v1/cockpit/recent-requests',
      qs: { limit: 25, offset: 10 },
    });
  });
});
