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

export const MEMO_ORGANISATION = "CAMEROON DEVELOPMENT CORPORATION";
export const MEMO_DOCUMENT_TITLE = "INTER-DEPARTMENTAL MEMO";

export const MEMO_LETTERHEAD_CSS = `
.center { text-align: center; }
.org { font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; font-size: 14pt; line-height: 1.5; }
.doc-title { margin-top: 4px; font-weight: 700; text-transform: uppercase; text-decoration: underline; font-size: 14pt; line-height: 1.5; }
.grid { display: grid; grid-template-columns: 1fr 1fr; border-top: 2px solid #000; border-bottom: 2px solid #000; margin-top: 16px; font-family: "Arial Narrow", Arial, sans-serif; font-size: 12pt; line-height: 1.5; }
.left { border-right: 1px solid #000; }
.cell { padding: 6px 8px; border-bottom: 1px solid #000; text-transform: uppercase; }
.as-typed { text-transform: none; }
.cell.top { font-weight: 600; }
.right .cell:last-child { border-bottom: none; text-transform: none; }
.left .cell:last-child { border-bottom: none; }
`;

export type MemoLetterheadInput = {
  fromTitle: string;
  unitName: string | null;
  toName: string;
  designation: string | null;
  throTitle: string | null;
};

function escapeMemoHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function titleCase(value: string): string {
  if (
    value.length > 0 &&
    !/\s/u.test(value) &&
    value === value.toLocaleUpperCase("en") &&
    /\p{L}/u.test(value)
  ) {
    return value;
  }
  return value
    .toLocaleLowerCase("en")
    .replace(
      /(^|[^\p{L}])(\p{L})/gu,
      (_, boundary: string, letter: string) =>
        boundary + letter.toLocaleUpperCase("en"),
    );
}

export function memoAddressGridHtml(input: MemoLetterheadInput): string {
  const unitName = input.unitName?.trim() || "—";
  const designation = input.designation?.trim() || "—";
  const throTitle = input.throTitle?.trim() || "HEAD OF SECTION";
  return `<div class="grid">
    <div class="left">
      <div class="cell top"><strong>FROM: <span class="as-typed">${escapeMemoHtml(titleCase(input.fromTitle))}</span></strong></div>
      <div class="cell">${escapeMemoHtml(unitName)}</div>
    </div>
    <div class="right">
      <div class="cell top">To: <strong><span class="as-typed">${escapeMemoHtml(titleCase(input.toName))}</span></strong></div>
      <div class="cell"><span class="as-typed">${escapeMemoHtml(designation === "—" ? designation : titleCase(designation))}</span></div>
      <div class="cell">Thro' ${escapeMemoHtml(throTitle)}</div>
    </div>
  </div>`;
}

export function memoLetterheadHtml(input: MemoLetterheadInput): string {
  return `<header class="center">
    <div class="org">${MEMO_ORGANISATION}</div>
    <div class="doc-title">${MEMO_DOCUMENT_TITLE}</div>
  </header>
  ${memoAddressGridHtml(input)}`;
}

export type MemoCcLayout = "ROW" | "COLUMN";

const MEMO_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function ordinalSuffix(day: number): string {
  if (day % 10 === 1 && day !== 11) return "st";
  if (day % 10 === 2 && day !== 12) return "nd";
  if (day % 10 === 3 && day !== 13) return "rd";
  return "th";
}

/** Calendar date with the ordinal suffix as a superscript, using the UTC day. */
export function memoDateHtml(date: Date): string {
  const day = date.getUTCDate();
  const month = MEMO_MONTHS[date.getUTCMonth()] ?? "";
  return `${day}<sup>${ordinalSuffix(day)}</sup> ${month}, ${date.getUTCFullYear()}`;
}

/** Superscript the ordinal on a date that is already words, such as "17th, June, 2022". */
export function memoDateTextHtml(value: string): string {
  return escapeMemoHtml(value).replace(
    /^(\d+)(st|nd|rd|th)/i,
    "$1<sup>$2</sup>",
  );
}

export const MEMO_FORM_CSS = `
.center { text-align: center; }
.org { font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; font-size: 14pt; line-height: 1.5; }
.doc-title { margin-top: 2px; font-weight: 700; text-transform: uppercase; text-decoration: underline; font-size: 14pt; line-height: 1.15; }
.memo-grid { display: grid; grid-template-columns: 1fr 1fr; margin-top: 2px; font-family: "Arial Narrow", Arial, sans-serif; font-size: 12pt; line-height: 1.45; }
.memo-from { padding: 8px 12px 0; }
.memo-to-head { padding: 8px 12px 0; }
.memo-from, .memo-from-fill { border-right: 1px solid #000; }
.memo-role { padding: 0 12px; line-height: 1.15; text-align: left; }
.memo-thro { padding: 8px 12px; line-height: 1.15; text-align: left; }
.memo-base-rule { grid-column: 1 / -1; height: 5px; border-bottom: 1px solid #000; }
.memo-rule { border-bottom: 1px solid #000; }
.memo-from-fill.memo-rule {
  border-bottom: none;
  background-image: linear-gradient(#000, #000);
  background-size: calc(100% - 6px) 1px;
  background-position: left bottom;
  background-repeat: no-repeat;
}
.memo-role.memo-rule, .memo-thro.memo-rule {
  border-bottom: none;
  background-image: linear-gradient(#000, #000);
  background-size: calc(100% - 6px) 1px;
  background-position: right bottom;
  background-repeat: no-repeat;
}
.memo-page { page-break-after: always; }
.memo-page:last-child { page-break-after: auto; }
.memo-meta { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 28px; }
.memo-ref { font-weight: 700; }
.memo-date sup, .memo-meta sup { font-size: 0.7em; }
h1.memo-subject { text-align: center; text-decoration: underline; font-size: 14pt; margin: 22px 0; font-weight: 700; }
.memo-body p { margin: 0 0 12px; line-height: 1.45; text-align: justify; }
.memo-sign { margin-top: 84px; margin-left: auto; width: max-content; max-width: 46%; text-align: center; min-height: 72px; }
.memo-cc { margin-top: 28px; }
.memo-cc-column { line-height: 1.35; }
`;

export function memoFormLetterheadHtml(input: MemoLetterheadInput): string {
  const fromTitle = input.fromTitle.trim();
  const designation = input.designation?.trim() ?? "";
  const throTitle = input.throTitle?.trim() ?? "";
  const designationRow = designation
    ? `<div class="memo-from-fill memo-rule"></div><div class="memo-role memo-rule">(${escapeMemoHtml(titleCase(designation))})</div>`
    : "";
  const throRow = throTitle
    ? `<div class="memo-from-fill memo-rule"></div><div class="memo-thro memo-rule">Thro' ${escapeMemoHtml(throTitle)}</div><div class="memo-base-rule"></div>`
    : "";
  const headRule = designationRow || throRow ? "" : " memo-rule";
  return `<header class="center">
    <div class="org">${MEMO_ORGANISATION}</div>
    <div class="doc-title">${MEMO_DOCUMENT_TITLE}</div>
  </header>
  <div class="memo-grid">
    <div class="memo-from${headRule}"><strong>FROM: <span class="as-typed">${escapeMemoHtml(fromTitle ? titleCase(fromTitle) : "")}</span></strong></div>
    <div class="memo-to-head${headRule}">TO: <strong><span class="as-typed">${escapeMemoHtml(titleCase(input.toName.trim()))}</span></strong></div>
    ${designationRow}
    ${throRow}
  </div>`;
}

export function memoSignatoryHtml(input: {
  name: string | null;
  title: string | null;
}): string {
  const name = input.name?.trim() ?? "";
  const title = input.title?.trim() ?? "";
  return `<div class="memo-sign">
    ${name ? `<div><strong>${escapeMemoHtml(name)}</strong></div>` : ""}
    ${title ? `<div><strong>${escapeMemoHtml(title)}</strong></div>` : ""}
  </div>`;
}

export function memoCcHtml(lines: string[], layout: MemoCcLayout): string {
  const items = lines.map((line) => line.trim()).filter(Boolean);
  if (layout === "COLUMN") {
    return `<div class="memo-cc memo-cc-column"><div><strong>cc:</strong></div>${items
      .map((line) => `<div>${escapeMemoHtml(line)}</div>`)
      .join("")}</div>`;
  }
  return `<div class="memo-cc"><strong>Cc:</strong> ${items
    .map((line) => escapeMemoHtml(line))
    .join(", ")}</div>`;
}

export type MemoFormPageInput = {
  fromTitle: string;
  toName: string;
  designation: string | null;
  throTitle: string | null;
  refs: string[];
  matricule: string;
  dateHtml: string;
  subject: string;
  bodyHtml: string;
  signatoryName: string | null;
  signatoryTitle: string | null;
  ccLines: string[];
  ccLayout: MemoCcLayout;
};

export function memoFormPageHtml(input: MemoFormPageInput): string {
  const refs = input.refs
    .map((ref) => `<div class="memo-ref">${escapeMemoHtml(ref)}</div>`)
    .join("");
  return `<section class="memo-page">
    ${memoFormLetterheadHtml({
      fromTitle: input.fromTitle,
      unitName: null,
      toName: input.toName,
      designation: input.designation,
      throTitle: input.throTitle,
    })}
    <div class="memo-meta">
      <div>
        ${refs}
        <div><strong>Mat. No. ${escapeMemoHtml(input.matricule)}</strong></div>
      </div>
      <div class="memo-date">${input.dateHtml}</div>
    </div>
    <h1 class="memo-subject">${escapeMemoHtml(input.subject)}</h1>
    <div class="memo-body">${input.bodyHtml}</div>
    ${memoSignatoryHtml({
      name: input.signatoryName,
      title: input.signatoryTitle,
    })}
    ${memoCcHtml(input.ccLines, input.ccLayout)}
  </section>`;
}

export function memoFormDocumentHtml(options: {
  title: string;
  pageHtml: string;
  copies?: number;
  extraCss?: string;
}): string {
  const copies = options.copies ?? 2;
  const pages = Array.from({ length: copies }, () => options.pageHtml).join("");
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeMemoHtml(options.title)}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    body { font-family: "Arial Narrow", Arial, sans-serif; font-size: 12pt; color: #000; margin: 0; }
    ${MEMO_FORM_CSS}
    ${options.extraCss ?? ""}
  </style>
</head>
<body>
  ${pages}
</body>
</html>`;
}
