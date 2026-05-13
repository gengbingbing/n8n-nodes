import {
  DEFAULT_ANALYTICS_BASE_URL,
  DEFAULT_GATEWAY_BASE_URL,
  DEFAULT_SAAS_BASE_URL,
} from '../shared/constants';
import { resolveManagerCredentials, resolveVirtualKeyCredentials } from '../shared/credentials';

describe('credential helpers', () => {
  it('uses default base URLs for virtual key credentials', () => {
    const resolved = resolveVirtualKeyCredentials({ virtualKey: 'vk-test' });
    expect(resolved.virtualKey).toBe('vk-test');
    expect(resolved.gatewayBaseUrl).toBe(DEFAULT_GATEWAY_BASE_URL);
    expect(resolved.analyticsBaseUrl).toBe(DEFAULT_ANALYTICS_BASE_URL);
  });

  it('allows virtual key base URL overrides', () => {
    const resolved = resolveVirtualKeyCredentials({
      virtualKey: 'vk-test',
      gatewayBaseUrl: 'http://localhost:8080/v1/',
      analyticsBaseUrl: 'http://localhost:3001/',
    });
    expect(resolved.gatewayBaseUrl).toBe('http://localhost:8080/v1');
    expect(resolved.analyticsBaseUrl).toBe('http://localhost:3001');
  });

  it('uses default SaaS and analytics base URLs for manager credentials', () => {
    const resolved = resolveManagerCredentials({ pat: 'pat_test', workspaceId: 'ws_123' });
    expect(resolved.saasBaseUrl).toBe(DEFAULT_SAAS_BASE_URL);
    expect(resolved.analyticsBaseUrl).toBe(DEFAULT_ANALYTICS_BASE_URL);
  });
});
