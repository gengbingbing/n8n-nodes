import type { ICredentialType, INodeProperties } from 'n8n-workflow';
import { DEFAULT_ANALYTICS_BASE_URL, DEFAULT_SAAS_BASE_URL } from '../shared/constants';

export class AlephantManagerApi implements ICredentialType {
  name = 'alephantManagerApi';
  displayName = 'Alephant Manager';
  documentationUrl = 'https://docs.alephant.ai/integrations/n8n';

  properties: INodeProperties[] = [
    {
      displayName: 'Personal Access Token',
      name: 'pat',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description:
        'Alephant PAT for workspace management automation. Read scope is enough for list and analytics; write scope is required for create, revoke, rotate, or update operations.',
    },
    {
      displayName: 'Workspace ID',
      name: 'workspaceId',
      type: 'string',
      default: '',
      required: true,
      description: 'Workspace UUID used as X-Workspace-Id',
    },
    {
      displayName: 'SaaS Base URL',
      name: 'saasBaseUrl',
      type: 'string',
      default: DEFAULT_SAAS_BASE_URL,
      required: false,
      description: 'Optional. Override for staging, local, or self-hosted SaaS API testing.',
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
