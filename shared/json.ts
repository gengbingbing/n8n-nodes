export function parseJsonObjectInput(value: unknown, fieldName: string): Record<string, unknown> {
  if (value === undefined || value === null || value === '') {
    return {};
  }

  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error(`${fieldName} must be valid JSON`);
    }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${fieldName} must be a JSON object`);
  }

  return parsed as Record<string, unknown>;
}
