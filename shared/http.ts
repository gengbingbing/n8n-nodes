import type { IDataObject, IExecuteFunctions, IHttpRequestMethods, IHttpRequestOptions } from 'n8n-workflow';
import { toNodeApiError } from './errors';
import { trimTrailingSlash } from './url';

const TRANSIENT_NETWORK_ERROR_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNABORTED',
  'EPIPE',
]);

export interface AlephantRequestOptions {
  method: IHttpRequestMethods;
  baseUrl: string;
  path: string;
  token: string;
  workspaceId?: string;
  headers?: IDataObject;
  qs?: IDataObject;
  body?: IDataObject;
  itemIndex?: number;
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTransientNetworkError(error: unknown): boolean {
  if (!isObjectLike(error) || 'response' in error) {
    return false;
  }

  const code = typeof error.code === 'string' ? error.code : '';
  if (TRANSIENT_NETWORK_ERROR_CODES.has(code)) {
    return true;
  }

  const message = typeof error.message === 'string' ? error.message : '';
  return message.includes('Client network socket disconnected before secure TLS connection');
}

export async function alephantRequest<T>(
  ctx: IExecuteFunctions,
  options: AlephantRequestOptions,
): Promise<T> {
  const url = `${trimTrailingSlash(options.baseUrl)}${options.path}`;
  const request: IHttpRequestOptions = {
    method: options.method,
    url,
    json: true,
    headers: {
      Authorization: `Bearer ${options.token}`,
      'Content-Type': 'application/json',
      ...(options.workspaceId ? { 'X-Workspace-Id': options.workspaceId } : {}),
      ...(options.headers || {}),
    },
    qs: options.qs,
    body: options.body,
  };

  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return (await ctx.helpers.httpRequest(request)) as T;
    } catch (error) {
      lastError = error;
      if (attempt === 0 && isTransientNetworkError(error)) {
        continue;
      }
      break;
    }
  }

  throw toNodeApiError(ctx, lastError, options.method, url, options.itemIndex);
}
