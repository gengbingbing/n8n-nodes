import { NodeApiError } from 'n8n-workflow';
import type { IExecuteFunctions, IHttpRequestMethods } from 'n8n-workflow';

export function toNodeApiError(
  ctx: IExecuteFunctions,
  error: unknown,
  method: IHttpRequestMethods,
  url: string,
): NodeApiError {
  if (error instanceof NodeApiError) {
    return error;
  }

  const message = error instanceof Error ? error.message : 'Alephant request failed';
  return new NodeApiError(ctx.getNode(), {
    message,
    description: `${method} ${url}`,
  });
}
