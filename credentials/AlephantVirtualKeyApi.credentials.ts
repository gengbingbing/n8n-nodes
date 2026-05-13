import type { ICredentialType, INodeProperties } from 'n8n-workflow';
import { DEFAULT_ANALYTICS_BASE_URL, DEFAULT_GATEWAY_BASE_URL } from '../shared/constants';

export class AlephantVirtualKeyApi implements ICredentialType {
  name = 'alephantVirtualKeyApi';
  displayName = 'Alephant Virtual Key';
  documentationUrl = 'https://docs.alephant.ai/integrations/n8n';

  properties: INodeProperties[] = [
    {
      displayName: 'Virtual Key',
      name: 'virtualKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Alephant Virtual Key used for AI Gateway and VK-scoped usage APIs',
    },
    {
      displayName: 'Gateway Base URL',
      name: 'gatewayBaseUrl',
      type: 'string',
      default: DEFAULT_GATEWAY_BASE_URL,
      required: false,
      description: 'Optional. Override for staging, local, or self-hosted Gateway testing.',
    },
    {
      displayName: 'Analytics Base URL',
      name: 'analyticsBaseUrl',
      type: 'string',
      default: DEFAULT_ANALYTICS_BASE_URL,
      required: false,
      description: 'Optional. Override for staging, local, or self-hosted analytics API testing.',
    },
  ];
}
