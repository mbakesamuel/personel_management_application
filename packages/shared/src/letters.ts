export type AwardLetterTemplate = {
  subject: string;
  paragraphs: string[];
};

export type LetterVars = {
  names: string;
  matric: string;
  appyear: string;
  effectiveYear: string;
  award: string;
  preCat: string;
  preEch: string;
  proCat: string;
  proEch: string;
  designation: string;
  section: string;
  unitName: string;
};

const ACCOUNTANT_PARAGRAPH =
  "By copy of this memo, the Accountant is requested to adjust your wages accordingly and pay you any resulting arrears.";

const ENCOURAGEMENT_PARAGRAPH =
  "I hope this decision will encourage you to serve the corporation better.";

function incrementParagraphs(awardLabel: string): string[] {
  return [
    `Following a good report on your work and conduct for the financial year {{appyear}}, You have been awarded **${awardLabel}** from Category **{{preCat}}** Echelon **{{preEch}}** to Category **{{proCat}}** Echelon **{{proEch}}** with effect from **January {{effectiveYear}}**.`,
    ACCOUNTANT_PARAGRAPH,
    ENCOURAGEMENT_PARAGRAPH,
  ];
}

/** Keys are lowercase trimmed award names from tbl_award.award */
export const LETTER_TEMPLATES: Record<string, AwardLetterTemplate> = {
  warning: {
    subject: "WARNING",
    paragraphs: [
      "I regret to inform you that your performance for the financial year **{{appyear}}** has been assessed as **POOR**.",
      "Accordingly, you are **WARNED** to improve on all aspects of your work in the ensuing year as failure to do so shall attract a more severe sanction.",
    ],
  },
  "average report": {
    subject: "AVERAGE REPORT",
    paragraphs: [
      "I regret to inform you that your overall performance for the financial year **{{appyear}}** has been assessed as **AVERAGE**.",
      "You are hereby enjoined to improve on all aspects of your work in the ensuing financial year.",
    ],
  },
  "good report": {
    subject: "GOOD REPORT",
    paragraphs: [
      "Your performance for the financial year **{{appyear}}** has been assessed as **GOOD**. You are encouraged to keep up the good work.",
    ],
  },
  "single increment": {
    subject: "INCREMENT",
    paragraphs: incrementParagraphs("Single Increment"),
  },
  "double increment": {
    subject: "INCREMENT",
    paragraphs: incrementParagraphs("Double Increment"),
  },
  "triple increment": {
    subject: "INCREMENT",
    paragraphs: incrementParagraphs("Triple Increment"),
  },
  upgrading: {
    subject: "UPGRADING",
    paragraphs: [
      "Following a good report on your work and conduct for the financial year **{{appyear}}**, You have been UPGRADED from Category **{{preCat}}** Echelon **{{preEch}}** to Category **{{proCat}}** Echelon **{{proEch}}** with effect from **January {{effectiveYear}}**.",
      ACCOUNTANT_PARAGRAPH,
      ENCOURAGEMENT_PARAGRAPH,
    ],
  },
};

export function normalizeAwardKey(award: string | null | undefined): string {
  return (award ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function templateForAward(
  award: string | null | undefined,
): AwardLetterTemplate | null {
  const key = normalizeAwardKey(award);
  if (!key || key === "not due") return null;
  return LETTER_TEMPLATES[key] ?? null;
}

/**
 * Parse category/echelon from values like:
 * "3G10", "3 G10", "3-G10", "12F", "Category 3 Echelon G10", "2G 10"
 */
export function parseCatEchelon(raw: string | null | undefined): {
  category: string
  echelon: string
} {
  const value = (raw ?? '').trim()
  if (!value) return { category: '', echelon: '' }

  const match = value.match(
    /(?:category\s*)?(\d+)\s*(?:[-/]|\s+)?(?:echelon\s*)?([A-Za-z])\s*(\d*)/i,
  )

  if (match) {
    const letter = (match[2] ?? '').toUpperCase()
    const digits = match[3] ?? ''
    return {
      category: match[1] ?? '',
      echelon: `${letter}${digits}`,
    }
  }

  // Category only, e.g. "3"
  const catOnly = value.match(/^(?:category\s*)?(\d+)\s*$/i)
  if (catOnly) {
    return { category: catOnly[1] ?? '', echelon: '' }
  }

  return { category: value, echelon: '' }
}

export function fillTemplate(template: string, vars: LetterVars): string {
  return template
    .replaceAll("{{names}}", vars.names)
    .replaceAll("{{matric}}", vars.matric)
    .replaceAll("{{appyear}}", vars.appyear)
    .replaceAll("{{effectiveYear}}", vars.effectiveYear)
    .replaceAll("{{award}}", vars.award)
    .replaceAll("{{preCat}}", vars.preCat || "—")
    .replaceAll("{{preEch}}", vars.preEch || "—")
    .replaceAll("{{proCat}}", vars.proCat || "—")
    .replaceAll("{{proEch}}", vars.proEch || "—")
    .replaceAll("{{designation}}", vars.designation)
    .replaceAll("{{section}}", vars.section)
    .replaceAll("{{unitName}}", vars.unitName);
}

export const LETTER_CC = [
  "DHR",
  "GRM",
  "MIS",
  "HRO (R)",
  "ACCOUNTANT",
] as const;

const FINANCE_CC_AWARD_KEYS = new Set([
  "single increment",
  "double increment",
  "triple increment",
  "upgrading",
]);

export function awardIncludesFinanceCc(
  award: string | null | undefined,
): boolean {
  return FINANCE_CC_AWARD_KEYS.has(normalizeAwardKey(award));
}

export function isFinanceLetterCc(label: string): boolean {
  const key = label.trim().toLowerCase();
  if (key === "mis") return true;
  if (key.includes("accountant")) return true;
  const collapsed = key.replace(/[\s.]+/g, " ").trim();
  const compact = key.replace(/[\s.]+/g, "");
  return (
    collapsed === "fin d" ||
    compact === "find" ||
    collapsed === "financial director"
  );
}

export function filterLetterCcForAward(
  labels: string[],
  award?: string | null,
): string[] {
  if (award === undefined || awardIncludesFinanceCc(award)) return labels;
  return labels.filter((label) => !isFinanceLetterCc(label));
}

export function formatMemoDate(date = new Date()): string {
  const day = date.getDate();
  const ordinal =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  const month = date.toLocaleString("en-GB", { month: "long" });
  return `${day}${ordinal}, ${month}, ${date.getFullYear()}`;
}
