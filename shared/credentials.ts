import {
  DEFAULT_ANALYTICS_BASE_URL,
  DEFAULT_GATEWAY_BASE_URL,
  DEFAULT_SAAS_BASE_URL,
} from './constants';
import type { AlephantManagerCredentials, AlephantVirtualKeyCredentials } from './types';
import { trimTrailingSlash } from './url';

export function resolveVirtualKeyCredentials(
  raw: AlephantVirtualKeyCredentials,
): Required<AlephantVirtualKeyCredentials> {
  return {
    virtualKey: raw.virtualKey,
    workspaceId: raw.workspaceId?.trim() || '',
    gatewayBaseUrl: trimTrailingSlash(raw.gatewayBaseUrl || DEFAULT_GATEWAY_BASE_URL),
    saasBaseUrl: trimTrailingSlash(raw.saasBaseUrl || DEFAULT_SAAS_BASE_URL),
    analyticsBaseUrl: trimTrailingSlash(raw.analyticsBaseUrl || DEFAULT_ANALYTICS_BASE_URL),
  };
}

export function resolveManagerCredentials(
  raw: AlephantManagerCredentials,
): Required<AlephantManagerCredentials> {
  return {
    pat: raw.pat,
    workspaceId: raw.workspaceId,
    saasBaseUrl: trimTrailingSlash(raw.saasBaseUrl || DEFAULT_SAAS_BASE_URL),
    analyticsBaseUrl: trimTrailingSlash(raw.analyticsBaseUrl || DEFAULT_ANALYTICS_BASE_URL),
  };
}
