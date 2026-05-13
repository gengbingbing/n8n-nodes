import { NodeApiError } from 'n8n-workflow';
import type { IExecuteFunctions, IHttpRequestMethods, JsonObject } from 'n8n-workflow';

function isObjectLike(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null;
}

export function toNodeApiError(
  ctx: IExecuteFunctions,
  error: unknown,
  method: IHttpRequestMethods,
  url: string,
  itemIndex?: number,
): NodeApiError {
  if (error instanceof NodeApiError) {
    if (itemIndex !== undefined && error.context.itemIndex === undefined) {
      error.context.itemIndex = itemIndex;
    }
    return error;
  }

  const description = `${method} ${url}`;
  if (isObjectLike(error)) {
    const nodeApiError = new NodeApiError(ctx.getNode(), error, { description, itemIndex });
    nodeApiError.description = description;
    return nodeApiError;
  }

  const message = typeof error === 'string' ? error : 'Alephant request failed';
  return new NodeApiError(ctx.getNode(), { message }, { description, itemIndex });
}
