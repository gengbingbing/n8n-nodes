import type { IDataObject, IExecuteFunctions, IHttpRequestMethods, IHttpRequestOptions } from 'n8n-workflow';
import { toNodeApiError } from './errors';
import { trimTrailingSlash } from './url';

export interface AlephantRequestOptions {
  method: IHttpRequestMethods;
  baseUrl: string;
  path: string;
  token: string;
  workspaceId?: string;
  qs?: IDataObject;
  body?: IDataObject;
  itemIndex?: number;
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
    },
    qs: options.qs,
    body: options.body,
  };

  try {
    return (await ctx.helpers.httpRequest(request)) as T;
  } catch (error) {
    throw toNodeApiError(ctx, error, options.method, url, options.itemIndex);
  }
}
