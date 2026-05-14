import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import {
  AlephantManagement,
  buildManagementRequest,
} from '../nodes/AlephantManagement/AlephantManagement.node';

function getNodeProperties(name: string) {
  return new AlephantManagement().description.properties.filter((property) => property.name === name);
}

describe('Alephant Management node', () => {
  it('maps virtual key revoke', () => {
    expect(buildManagementRequest('virtualKey', 'revoke', { id: 'vk-id' })).toEqual({
      method: 'POST',
      host: 'saas',
      path: '/api/v1/virtual-keys/vk-id/revoke',
    });
  });

  it('maps workspace usage history', () => {
    expect(
      buildManagementRequest('workspaceUsage', 'history', {
        dateFrom: '2026-05-01',
        dateTo: '2026-05-11',
      }),
    ).toEqual({
      method: 'GET',
      host: 'saas',
      path: '/api/v1/analytics/usage',
      qs: { dateFrom: '2026-05-01', dateTo: '2026-05-11' },
    });
  });

  it('maps workspace usage history with agent filter', () => {
    expect(
      buildManagementRequest('workspaceUsage', 'history', {
        dateFrom: '2026-05-01',
        dateTo: '2026-05-11',
        agentId: 'agent-id',
      }),
    ).toEqual({
      method: 'GET',
      host: 'saas',
      path: '/api/v1/analytics/usage',
      qs: { dateFrom: '2026-05-01', dateTo: '2026-05-11', agentId: 'agent-id' },
    });
  });

  it('rejects workspace usage history with multiple scoped filters', () => {
    expect(() =>
      buildManagementRequest('workspaceUsage', 'history', {
        agentId: 'agent-id',
        memberId: 'member-id',
      }),
    ).toThrow('Choose only one analytics scope filter');
  });

  it('requires an id for virtual key revoke', () => {
    expect(() => buildManagementRequest('virtualKey', 'revoke', { id: '' })).toThrow(
      'Virtual Key ID is required',
    );
  });

  it('requires a non-empty body for agent create', () => {
    expect(() => buildManagementRequest('agent', 'create', { body: {} })).toThrow(
      'Body must not be empty',
    );
  });

  it('requires a non-empty body for virtual key create', () => {
    expect(() => buildManagementRequest('virtualKey', 'create', { body: {} })).toThrow(
      'Body must not be empty',
    );
  });

  it.each([
    [
      'agent',
      'list',
      {
        page: 2,
        pageSize: 25,
        status: 'active',
        departmentId: 'dept-id',
        environment: 'prod',
        search: 'Support',
      },
      {
        method: 'GET',
        host: 'saas',
        path: '/api/v1/agents',
        qs: {
          page: 2,
          pageSize: 25,
          status: 'active',
          departmentId: 'dept-id',
          environment: 'prod',
          search: 'Support',
        },
      },
    ],
    [
      'agent',
      'create',
      { body: { name: 'Support Agent' } },
      {
        method: 'POST',
        host: 'saas',
        path: '/api/v1/agents',
        body: { name: 'Support Agent' },
      },
    ],
    [
      'virtualKey',
      'list',
      { page: 1, pageSize: 50, status: 'active', entityType: 'agent' },
      {
        method: 'GET',
        host: 'saas',
        path: '/api/v1/virtual-keys',
        qs: { page: 1, pageSize: 50, status: 'active', entityType: 'agent' },
      },
    ],
    [
      'virtualKey',
      'create',
      { body: { name: 'Key', entityId: 'agent-id' } },
      {
        method: 'POST',
        host: 'saas',
        path: '/api/v1/virtual-keys',
        body: { name: 'Key', entityId: 'agent-id' },
      },
    ],
    [
      'models',
      'list',
      {},
      {
        method: 'GET',
        host: 'saas',
        path: '/api/v1/models',
      },
    ],
    [
      'workspaceUsage',
      'summary',
      {},
      {
        method: 'GET',
        host: 'saas',
        path: '/api/v1/analytics/overview',
      },
    ],
    [
      'workspaceUsage',
      'costByModel',
      { dateFrom: '2026-05-01', dateTo: '2026-05-11' },
      {
        method: 'GET',
        host: 'saas',
        path: '/api/v1/analytics/models',
        qs: { dateFrom: '2026-05-01', dateTo: '2026-05-11' },
      },
    ],
  ] as const)('maps %s.%s', (resource, operation, params, expected) => {
    expect(buildManagementRequest(resource, operation, params)).toEqual(expected);
  });

  it('omits empty query values', () => {
    expect(
      buildManagementRequest('agent', 'list', {
        page: 1,
        pageSize: undefined,
        status: '',
        departmentId: null,
        environment: 'prod',
      }),
    ).toEqual({
      method: 'GET',
      host: 'saas',
      path: '/api/v1/agents',
      qs: { page: 1, environment: 'prod' },
    });
  });

  it('omits the query object when all values are empty', () => {
    expect(
      buildManagementRequest('workspaceUsage', 'costByModel', {
        dateFrom: '',
        dateTo: null,
      }),
    ).toEqual({
      method: 'GET',
      host: 'saas',
      path: '/api/v1/analytics/models',
    });
  });

  it('rejects unsupported operation combinations', () => {
    expect(() => buildManagementRequest('models', 'create', {})).toThrow(
      'Unsupported Alephant Management operation: models.create',
    );
  });

  it.each(['page', 'pageSize', 'status'])(
    'shows %s for agent.list and virtualKey.list without impossible AND conditions',
    (propertyName) => {
      const properties = getNodeProperties(propertyName);

      expect(properties).toHaveLength(2);
      expect(properties).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            displayOptions: {
              show: {
                resource: ['agent'],
                agentOperation: ['list'],
              },
            },
          }),
          expect.objectContaining({
            displayOptions: {
              show: {
                resource: ['virtualKey'],
                virtualKeyOperation: ['list'],
              },
            },
          }),
        ]),
      );
      for (const property of properties) {
        const show = property.displayOptions?.show || {};
        expect(show).not.toEqual(
          expect.objectContaining({
            agentOperation: ['list'],
            virtualKeyOperation: ['list'],
          }),
        );
      }
    },
  );

  it('uses body as the create body parameter name', () => {
    expect(getNodeProperties('agentBody')).toHaveLength(0);
    expect(getNodeProperties('virtualKeyBody')).toHaveLength(0);
    expect(getNodeProperties('body')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          displayOptions: { show: { resource: ['agent'], agentOperation: ['create'] } },
        }),
        expect.objectContaining({
          displayOptions: { show: { resource: ['virtualKey'], virtualKeyOperation: ['create'] } },
        }),
      ]),
    );
  });

  it('executes management requests with manager credentials and paired items', async () => {
    const httpRequest = jest
      .fn()
      .mockResolvedValueOnce({ agents: [] })
      .mockResolvedValueOnce({ total_cost: 12.34 });
    const node = new AlephantManagement();
    const ctx = {
      getInputData: jest.fn().mockReturnValue([{ json: {} }, { json: {} }]),
      getCredentials: jest.fn().mockResolvedValue({
        pat: 'pat_test',
        workspaceId: 'workspace-id',
        saasBaseUrl: 'https://saas.example/',
        analyticsBaseUrl: 'https://analytics.example/',
      }),
      getNodeParameter: jest.fn((name: string, itemIndex: number) => {
        const values: Array<Record<string, unknown>> = [
          {
            resource: 'agent',
            agentOperation: 'list',
            page: 1,
            pageSize: 25,
            status: 'active',
            departmentId: '',
            environment: '',
            search: '',
          },
          {
            resource: 'workspaceUsage',
            workspaceUsageOperation: 'summary',
          },
        ];

        return values[itemIndex][name];
      }),
      helpers: { httpRequest },
    } as unknown as IExecuteFunctions;

    await expect(node.execute.call(ctx)).resolves.toEqual([
      [
        { json: { agents: [] }, pairedItem: { item: 0 } },
        { json: { total_cost: 12.34 }, pairedItem: { item: 1 } },
      ],
    ]);

    expect(httpRequest).toHaveBeenNthCalledWith(1, {
      method: 'GET',
      url: 'https://saas.example/api/v1/agents',
      json: true,
      headers: {
        Authorization: 'Bearer pat_test',
        'Content-Type': 'application/json',
        'X-Workspace-Id': 'workspace-id',
      },
      qs: { page: 1, pageSize: 25, status: 'active' },
      body: undefined,
    });
    expect(httpRequest).toHaveBeenNthCalledWith(2, {
      method: 'GET',
      url: 'https://saas.example/api/v1/analytics/overview',
      json: true,
      headers: {
        Authorization: 'Bearer pat_test',
        'Content-Type': 'application/json',
        'X-Workspace-Id': 'workspace-id',
      },
      qs: undefined,
      body: undefined,
    });
  });

  it('parses create bodies from the body parameter', async () => {
    const httpRequest = jest.fn().mockResolvedValue({ id: 'agent-id' });
    const node = new AlephantManagement();
    const ctx = {
      getInputData: jest.fn().mockReturnValue([{ json: {} }]),
      getCredentials: jest.fn().mockResolvedValue({
        pat: 'pat_test',
        workspaceId: 'workspace-id',
        saasBaseUrl: 'https://saas.example/',
        analyticsBaseUrl: 'https://analytics.example/',
      }),
      getNodeParameter: jest.fn((name: string) => {
        const values: Record<string, unknown> = {
          resource: 'agent',
          agentOperation: 'create',
          body: '{"name":"Support Agent"}',
        };

        return values[name];
      }),
      helpers: { httpRequest },
    } as unknown as IExecuteFunctions;

    await expect(node.execute.call(ctx)).resolves.toEqual([
      [{ json: { id: 'agent-id' }, pairedItem: { item: 0 } }],
    ]);

    expect(httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: 'https://saas.example/api/v1/agents',
        body: { name: 'Support Agent' },
      }),
    );
    expect(ctx.getNodeParameter).toHaveBeenCalledWith('body', 0, {});
  });

  it('executes imported models workflows when the hidden operation parameter is absent', async () => {
    const httpRequest = jest.fn().mockResolvedValue({ data: [] });
    const node = new AlephantManagement();
    const ctx = {
      getInputData: jest.fn().mockReturnValue([{ json: {} }]),
      getCredentials: jest.fn().mockResolvedValue({
        pat: 'pat_test',
        workspaceId: 'workspace-id',
        saasBaseUrl: 'https://saas.example/',
        analyticsBaseUrl: 'https://analytics.example/',
      }),
      getNode: jest.fn().mockReturnValue({
        name: 'Alephant Management',
        type: 'alephantManagement',
        typeVersion: 1,
        position: [0, 0],
        parameters: {},
      }),
      getNodeParameter: jest.fn((...args: [string, number, unknown?]) => {
        const [name, , fallback] = args;
        const values: Record<string, unknown> = {
          resource: 'models',
        };

        if (name in values) return values[name];
        if (args.length >= 3 && fallback !== undefined) return fallback;
        throw new Error('Could not get parameter');
      }),
      helpers: { httpRequest },
    } as unknown as IExecuteFunctions;

    await expect(node.execute.call(ctx)).resolves.toEqual([
      [{ json: { data: [] }, pairedItem: { item: 0 } }],
    ]);

    expect(httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: 'https://saas.example/api/v1/models',
      }),
    );
  });

  it('executes imported virtual key list workflows when optional query parameters are absent', async () => {
    const httpRequest = jest.fn().mockResolvedValue({ data: [] });
    const node = new AlephantManagement();
    const ctx = {
      getInputData: jest.fn().mockReturnValue([{ json: {} }]),
      getCredentials: jest.fn().mockResolvedValue({
        pat: 'pat_test',
        workspaceId: 'workspace-id',
        saasBaseUrl: 'https://saas.example/',
        analyticsBaseUrl: 'https://analytics.example/',
      }),
      getNode: jest.fn().mockReturnValue({
        name: 'Alephant Management',
        type: 'alephantManagement',
        typeVersion: 1,
        position: [0, 0],
        parameters: {},
      }),
      getNodeParameter: jest.fn((...args: [string, number, unknown?]) => {
        const [name, , fallback] = args;
        const values: Record<string, unknown> = {
          resource: 'virtualKey',
          virtualKeyOperation: 'list',
        };

        if (name in values) return values[name];
        if (args.length >= 3 && fallback !== undefined) return fallback;
        throw new Error('Could not get parameter');
      }),
      helpers: { httpRequest },
    } as unknown as IExecuteFunctions;

    await expect(node.execute.call(ctx)).resolves.toEqual([
      [{ json: { data: [] }, pairedItem: { item: 0 } }],
    ]);

    expect(httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: 'https://saas.example/api/v1/virtual-keys',
        qs: { page: 1, pageSize: 50 },
      }),
    );
  });

  it('wraps invalid execution input in NodeOperationError with item index', async () => {
    const node = new AlephantManagement();
    const ctx = {
      getInputData: jest.fn().mockReturnValue([{ json: {} }]),
      getCredentials: jest.fn().mockResolvedValue({
        pat: 'pat_test',
        workspaceId: 'workspace-id',
        saasBaseUrl: 'https://saas.example/',
        analyticsBaseUrl: 'https://analytics.example/',
      }),
      getNode: jest.fn().mockReturnValue({
        name: 'Alephant Management',
        type: 'alephantManagement',
        typeVersion: 1,
        position: [0, 0],
        parameters: {},
      }),
      getNodeParameter: jest.fn((name: string) => {
        const values: Record<string, unknown> = {
          resource: 'workspaceUsage',
          workspaceUsageOperation: 'history',
          dateFrom: '',
          dateTo: '',
          agentId: 'agent-id',
          memberId: 'member-id',
          usageDepartmentId: '',
        };

        return values[name];
      }),
      helpers: { httpRequest: jest.fn() },
    } as unknown as IExecuteFunctions;

    const error = await node.execute.call(ctx).catch((executionError: unknown) => executionError);

    expect(error).toBeInstanceOf(NodeOperationError);
    expect(error).toMatchObject({
      message: 'Choose only one analytics scope filter',
      context: { itemIndex: 0 },
    });
    expect(ctx.helpers.httpRequest).not.toHaveBeenCalled();
  });

  it('does not request or parse unused body for non-create operations', async () => {
    const httpRequest = jest.fn().mockResolvedValue({ agents: [] });
    const node = new AlephantManagement();
    const ctx = {
      getInputData: jest.fn().mockReturnValue([{ json: {} }]),
      getCredentials: jest.fn().mockResolvedValue({
        pat: 'pat_test',
        workspaceId: 'workspace-id',
        saasBaseUrl: 'https://saas.example/',
        analyticsBaseUrl: 'https://analytics.example/',
      }),
      getNodeParameter: jest.fn((name: string) => {
        if (name === 'body') {
          throw new Error('Body should not be requested');
        }

        const values: Record<string, unknown> = {
          resource: 'agent',
          agentOperation: 'list',
          page: 1,
          pageSize: 25,
          status: '',
          departmentId: '',
          environment: '',
          search: '',
        };

        return values[name];
      }),
      helpers: { httpRequest },
    } as unknown as IExecuteFunctions;

    await expect(node.execute.call(ctx)).resolves.toEqual([
      [{ json: { agents: [] }, pairedItem: { item: 0 } }],
    ]);
    expect(ctx.getNodeParameter).not.toHaveBeenCalledWith('body', expect.any(Number), {});
    expect(httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        body: undefined,
      }),
    );
  });
});
