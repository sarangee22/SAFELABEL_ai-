const RESTRICTION_CATEGORIES = [
  {
    aliases: ["eye area", "눈 주위", "eye", "eyearea"],
    label: "눈 주위",
  },
  {
    aliases: [
      "generally",
      "includes lipsticks",
      "일반적인 사용",
      "일반 화장품",
      "일반 화장품 사용",
      "일반적으로",
    ],
    label: "일반 화장품",
  },
  {
    aliases: ["external use", "외용", "외용 제품"],
    label: "외용 제품",
  },
];

function cleanText(value: unknown) {
  return String(value || "")
    .replace(/\r\n|\n|\r/g, " ")
    .replace(/[•·]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*[:\-–]\s*/g, ": ")
    .trim();
}

function splitRestrictionLines(value: string) {
  return value
    .split(/;|\||\n|\/|·|•|,/)  
    .map((part) => cleanText(part))
    .filter(Boolean);
}

function flattenRestrictionSource(source: unknown): string[] {
  if (source == null) return [];
  if (Array.isArray(source)) {
    return source.flatMap(flattenRestrictionSource);
  }
  if (typeof source === "object") {
    return Object.values(source).flatMap(flattenRestrictionSource);
  }
  if (typeof source === "string") {
    return splitRestrictionLines(source);
  }
  return [];
}

function detectStatus(text: string) {
  const normalized = text.toLowerCase();

  if (/(?:yes|사용가능|사용 가능|가능|allowed|ok)\b/.test(normalized)) {
    return "사용 가능";
  }

  if (/(?:no|사용제한|사용 불가|불가|금지|restricted|not allowed)\b/.test(normalized)) {
    return "사용 제한";
  }

  return undefined;
}

function detectCategory(text: string) {
  const normalized = text.toLowerCase();

  return RESTRICTION_CATEGORIES.find((entry) =>
    entry.aliases.some((alias) => normalized.includes(alias))
  );
}

function formatRestrictionLine(line: string) {
  const cleaned = cleanText(line);
  if (!cleaned) return null;

  const category = detectCategory(cleaned);
  const status = detectStatus(cleaned);

  if (category && status) {
    return `${category.label} ${status}`;
  }

  if (category && !status) {
    return `${category.label} 사용 여부를 확인해 주세요.`;
  }

  if (status) {
    const fallbackLabel =
      detectCategory(cleaned)?.label ||
      (/(?:eye|눈)/i.test(cleaned) ? "눈 주위" :
      /(?:external|외용)/i.test(cleaned) ? "외용 제품" :
      /(?:generally|일반)/i.test(cleaned) ? "일반 화장품" :
      undefined);

    if (fallbackLabel) {
      return `${fallbackLabel} ${status}`;
    }
  }

  const parts = cleaned.split(":").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const label = parts[0];
    const statusPart = parts.slice(1).join(": ");
    const statusText = detectStatus(statusPart);

    if (statusText) {
      return `${label} ${statusText}`;
    }
  }

  return cleaned;
}

export function formatRestrictionInfo(source: unknown): string[] {
  const rawLines = flattenRestrictionSource(source);
  const mapped = rawLines
    .map(formatRestrictionLine)
    .filter((text): text is string => Boolean(text))
    .map((text) => text.replace(/\s+/g, " ").trim());

  const uniqueMap = new Map<string, string>();

  for (const text of mapped) {
    const normalized = text
      .replace(/\s+/g, " ")
      .toLowerCase()
      .trim();

    const label = (normalized.match(/^(.*?)\s+(?:사용 가능|사용 제한|사용 여부를 확인해 주세요\.)$/)?.[1] ||
      normalized) as string;

    if (!label) continue;

    const existing = uniqueMap.get(label);
    if (!existing) {
      uniqueMap.set(label, text);
      continue;
    }

    if (
      existing.includes("사용 가능") &&
      text.includes("사용 제한")
    ) {
      uniqueMap.set(label, text);
    }
  }

  return Array.from(uniqueMap.values());
}
