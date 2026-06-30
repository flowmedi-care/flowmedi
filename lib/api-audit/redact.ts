const SENSITIVE_PATTERNS: RegExp[] = [
  /"access_token"\s*:\s*"[^"]+"/gi,
  /"refresh_token"\s*:\s*"[^"]+"/gi,
  /"password"\s*:\s*"[^"]+"/gi,
  /"secret"\s*:\s*"[^"]+"/gi,
  /"api_key"\s*:\s*"[^"]+"/gi,
  /sk_(live|test)_[a-zA-Z0-9]+/g,
  /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
  /\b\+?55\s?\(?\d{2}\)?\s?\d{4,5}-?\d{4}\b/g,
];

const MAX_PREVIEW = 2048;

export function redactSensitiveText(text: string): string {
  let result = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, (match) => {
      const keyMatch = match.match(/^"([^"]+)"/);
      if (keyMatch) return `"${keyMatch[1]}": "[REDACTED]"`;
      return "[REDACTED]";
    });
  }
  return result;
}

export function buildResponsePreview(body: string, contentType: string | null): {
  preview: string | null;
  exposesStackTrace: boolean;
  exposesSensitiveData: boolean;
} {
  if (!body) {
    return { preview: null, exposesStackTrace: false, exposesSensitiveData: false };
  }

  const exposesStackTrace =
    /"stack"\s*:/i.test(body) ||
    /at\s+[\w./<>]+\s+\(/i.test(body.slice(0, 500));

  let preview = body;
  if (contentType?.includes("json")) {
    try {
      const parsed = JSON.parse(body);
      preview = JSON.stringify(parsed, null, 2);
    } catch {
      preview = body;
    }
  }

  const redacted = redactSensitiveText(preview);
  const exposesSensitiveData = redacted.includes("[REDACTED]") && body.length > 20;

  const truncated =
    redacted.length > MAX_PREVIEW
      ? `${redacted.slice(0, MAX_PREVIEW)}\n… [truncado]`
      : redacted;

  return {
    preview: truncated,
    exposesStackTrace,
    exposesSensitiveData,
  };
}

export function pickResponseHeaders(headers: Headers): Record<string, string> {
  const keys = [
    "content-type",
    "content-length",
    "cache-control",
    "access-control-allow-origin",
    "x-middleware-rewrite",
  ];
  const result: Record<string, string> = {};
  for (const key of keys) {
    const value = headers.get(key);
    if (value) result[key] = value;
  }
  return result;
}
