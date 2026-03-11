const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseTodoTxt(input) {
  const raw = (input || "").trim();
  if (!raw) {
    throw new Error("Todo.txt line is empty");
  }

  let remaining = raw;
  const result = {
    raw,
    isCompleted: false,
    priority: null,
    creationDate: null,
    completionDate: null,
    projects: [],
    contexts: [],
    keyValues: {},
    description: ""
  };

  if (remaining.startsWith("x ")) {
    result.isCompleted = true;
    remaining = remaining.slice(2).trim();

    const parts = remaining.split(/\s+/);
    if (parts[0] && DATE_RE.test(parts[0])) {
      result.completionDate = parts.shift();
    }
    if (parts[0] && DATE_RE.test(parts[0])) {
      result.creationDate = parts.shift();
    }
    remaining = parts.join(" ");
  }

  const priorityMatch = remaining.match(/^\(([A-Z])\)\s+/);
  if (priorityMatch) {
    result.priority = priorityMatch[1];
    remaining = remaining.slice(priorityMatch[0].length);
  }

  const tokens = remaining.split(/\s+/).filter(Boolean);
  const descriptionTokens = [];

  if (!result.creationDate && tokens[0] && DATE_RE.test(tokens[0])) {
    result.creationDate = tokens.shift();
  }

  for (const token of tokens) {
    if (token.startsWith("+") && token.length > 1) {
      result.projects.push(token.slice(1));
      continue;
    }
    if (token.startsWith("@") && token.length > 1) {
      result.contexts.push(token.slice(1));
      continue;
    }

    const keyValueMatch = token.match(/^([^:\s]+):(.+)$/);
    if (keyValueMatch) {
      const key = keyValueMatch[1].trim();
      const value = keyValueMatch[2].trim();
      if (key) {
        result.keyValues[key] = value;
      }
      continue;
    }

    descriptionTokens.push(token);
  }

  result.description = descriptionTokens.join(" ").trim();
  if (!result.description) {
    result.description = raw;
  }

  return result;
}
