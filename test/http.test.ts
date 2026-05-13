import { NodeApiError } from 'n8n-workflow';
import type { IExecuteFunctions, IHttpRequestOptions } from 'n8n-workflow';
import {
  DEFAULT_ANALYTICS_BASE_URL,
  DEFAULT_GATEWAY_BASE_URL,
  DEFAULT_SAAS_BASE_URL,
  ENDPOINTS,
} from '../shared/constants';
import { alephantRequest } from '../shared/http';

function createExecuteContext(httpRequest: jest.Mock): IExecuteFunctions {
  return {
    getNode: () => ({
      id: 'node_1',
      name: 'Alephant Test',
      type: 'n8n-nodes-alephant.test',
      typeVersion: 1,
      position: [0, 0],
      parameters: {},
    }),
    helpers: {
      httpRequest,
    },
  } as unknown as IExecuteFunctions;
}

describe('shared HTTP helpers', () => {
  it('exports production constants and endpoint values', () => {
    expect(DEFAULT_GATEWAY_BASE_URL).toBe('https://ai.alephant.io/v1');
    expect(DEFAULT_SAAS_BASE_URL).toBe('https://alephant.io');
    expect(DEFAULT_ANALYTICS_BASE_URL).toBe('https://analytics.alephant.io');
    expect(ENDPOINTS.chatCompletions).toBe('/chat/completions');
    expect(ENDPOINTS.cockpitBudgetStatus).toBe('/api/v1/cockpit/budget-status');
    expect(ENDPOINTS.analyticsOverview).toBe('/api/v1/analytics/overview');
  });

  it('trims base URL and builds headers, body, and query string', async () => {
    const httpRequest = jest.fn().mockResolvedValue({ ok: true });
    const ctx = createExecuteContext(httpRequest);

    await expect(
      alephantRequest(ctx, {
        method: 'POST',
        baseUrl: 'https://ai.alephant.io/v1///',
        path: ENDPOINTS.chatCompletions,
        token: 'vk_test',
        qs: { stream: false },
        body: { model: 'gpt-4o-mini' },
      }),
    ).resolves.toEqual({ ok: true });

    expect(httpRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: 'https://ai.alephant.io/v1/chat/completions',
      json: true,
      headers: {
        Authorization: 'Bearer vk_test',
        'Content-Type': 'application/json',
      },
      qs: { stream: false },
      body: { model: 'gpt-4o-mini' },
    } satisfies IHttpRequestOptions);
  });

  it('includes workspace header when workspace ID is present', async () => {
    const httpRequest = jest.fn().mockResolvedValue({ ok: true });
    const ctx = createExecuteContext(httpRequest);

    await alephantRequest(ctx, {
      method: 'GET',
      baseUrl: DEFAULT_SAAS_BASE_URL,
      path: ENDPOINTS.cockpitScope,
      token: 'pat_test',
      workspaceId: 'ws_123',
    });

    expect(httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Workspace-Id': 'ws_123',
        }),
      }),
    );
  });

  it('omits workspace header when workspace ID is absent', async () => {
    const httpRequest = jest.fn().mockResolvedValue({ ok: true });
    const ctx = createExecuteContext(httpRequest);

    await alephantRequest(ctx, {
      method: 'GET',
      baseUrl: DEFAULT_SAAS_BASE_URL,
      path: ENDPOINTS.cockpitScope,
      token: 'pat_test',
    });

    expect(httpRequest.mock.calls[0][0].headers).not.toHaveProperty('X-Workspace-Id');
  });

  it('wraps request failures as NodeApiError while preserving response details', async () => {
    const originalError = {
      message: 'Request failed with status code 429',
      response: {
        status: 429,
        data: {
          error: {
            message: 'Quota exceeded',
          },
          requestId: 'req_429',
        },
      },
    };
    const httpRequest = jest.fn().mockRejectedValue(originalError);
    const ctx = createExecuteContext(httpRequest);

    let thrownError: unknown;
    try {
      await alephantRequest(ctx, {
        method: 'GET',
        baseUrl: DEFAULT_ANALYTICS_BASE_URL,
        path: ENDPOINTS.analyticsUsage,
        token: 'pat_test',
      });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(NodeApiError);
    expect(thrownError).toMatchObject({
      name: 'NodeApiError',
      httpCode: '429',
      description: 'GET https://analytics.alephant.io/api/v1/analytics/usage',
      context: {
        data: originalError.response.data,
      },
    });
  });
});
