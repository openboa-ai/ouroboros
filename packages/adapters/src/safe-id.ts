export interface SafeIdOptions {
  maxLength?: number;
  extraSafeChars?: readonly string[];
}

export function safeId(value: string, options: SafeIdOptions = {}): string {
  const maxLength = options.maxLength ?? 96;
  const extraSafeChars = new Set(options.extraSafeChars ?? []);
  let normalized = "";
  let insertedSeparator = false;

  for (const char of value) {
    if (isBaseSafeIdChar(char) || extraSafeChars.has(char)) {
      normalized += char;
      insertedSeparator = false;
    } else if (!insertedSeparator) {
      normalized += "-";
      insertedSeparator = true;
    }

    if (normalized.length > maxLength) {
      break;
    }
  }

  const trimmed = trimDashEdges(normalized);
  return trimmed.slice(0, maxLength) || "empty";
}

function isBaseSafeIdChar(char: string): boolean {
  if (char === "-" || char === "_") {
    return true;
  }

  const code = char.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122)
  );
}

function trimDashEdges(value: string): string {
  let start = 0;
  let end = value.length;

  while (start < end && value[start] === "-") {
    start += 1;
  }
  while (end > start && value[end - 1] === "-") {
    end -= 1;
  }

  return value.slice(start, end);
}
