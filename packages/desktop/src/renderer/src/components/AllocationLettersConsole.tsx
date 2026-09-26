import type {
  AllocationLetter,
  AllocationLettersResponse,
  SectionOption,
  UnitOption,
  User,
} from "@perf-appraisal-app/shared";
import { useCallback, useEffect, useState } from "react";
import { createApiClient } from "../api/client";
import { ReportPreviewConsole } from "./ReportPreviewConsole";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AllocationLettersConsoleProps = {
  user: User;
  onClose: () => void;
};

const ALL_VALUE = "__all__";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderMemoDate(value: string): string {
  return escapeHtml(value).replace(/^(\d+)(st|nd|rd|th)/i, "$1<sup>$2</sup>");
}

function formatAmount(value: number): string {
  return value.toLocaleString("en-US");
}

function AllocationMemoPage({ letter }: { letter: AllocationLetter }) {
  return (
    <article className="memo-page mx-auto mb-8 max-w-[210mm] bg-white p-8 font-serif text-[14px] leading-normal text-black shadow-sm">
      <header className="text-center">
        <h1 className="m-0 text-[14px] font-bold uppercase tracking-wide">
          Cameroon Development Corporation
        </h1>
        <p className="m-0 mt-1 text-[14px] font-semibold uppercase underline">
          Inter-Departmental Memo
        </p>
      </header>

      <div className="mt-4 grid grid-cols-2 border-y-2 border-black text-[14px]">
        <div className="border-r border-black">
          <div className="border-b border-black px-2 py-1 font-semibold uppercase">
            From:
          </div>
          <div className="border-b border-black px-2 py-1 pl-16 font-semibold uppercase">
            {letter.fromTitle}
          </div>
          <div className="px-2 py-1">&nbsp;</div>
        </div>
        <div>
          <div className="border-b border-black px-2 py-1 font-semibold uppercase">
            To:
          </div>
          <div className="border-b border-black px-2 py-1 pl-16 font-bold uppercase">
            {letter.names ?? letter.matricule}
          </div>
          <div className="px-2 py-1 pl-16 uppercase">
            {letter.designationLine}
          </div>
        </div>
      </div>

      <div className="mt-1 grid grid-cols-2 text-[14px] uppercase">
        <div />
        <div className="px-2 py-1 pl-16">
          Thro&apos;: {letter.throTitle}
        </div>
      </div>

      <div className="mt-3 flex items-start justify-between gap-4 text-[14px]">
        <div className="uppercase">
          {letter.refs.map((ref) => (
            <div key={ref}>{ref}</div>
          ))}
          <div className="mt-1 font-bold underline">
            Mat. No. {letter.matricule}
          </div>
        </div>
        <div
          className="shrink-0 [&_sup]:text-[0.7em]"
          dangerouslySetInnerHTML={{
            __html: renderMemoDate(letter.memoDate),
          }}
        />
      </div>

      <h2 className="mt-6 text-center text-[14px] font-bold uppercase underline">
        {letter.subject}
      </h2>

      <p className="mt-4 text-justify text-[14px]">{letter.openingParagraph}</p>

      <table className="mt-4 w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className="border border-black px-2 py-1 text-left uppercase">
              Allowance
            </th>
            <th className="border border-black px-2 py-1 text-right uppercase">
              Monthly Amount(FCFA)
            </th>
            <th className="border border-black px-2 py-1 text-left uppercase">
              Area to Cover
            </th>
          </tr>
        </thead>
        <tbody>
          {letter.rows.map((row) => (
            <tr key={row.allowanceId}>
              <td className="border border-black px-2 py-1 uppercase">
                {row.allowanceName}
              </td>
              <td className="border border-black px-2 py-1 text-right">
                {formatAmount(row.monthlyAmount)}
              </td>
              <td className="border border-black px-2 py-1">
                {row.areaToCover}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-4 text-[14px]">The following conditions shall apply;</p>
      <ol className="mt-2 list-decimal space-y-2 pl-6 text-justify text-[14px]">
        {letter.conditions.map((condition) => (
          <li key={condition}>{condition}</li>
        ))}
      </ol>

      <p className="mt-4 text-[14px]">{letter.closingLine}</p>

      <div className="mt-10 text-right text-[14px]">
        {letter.signatoryName ? (
          <div className="font-bold uppercase">{letter.signatoryName}</div>
        ) : null}
        <div className="font-bold uppercase">
          {letter.signatoryTitle ?? letter.fromTitle}
        </div>
      </div>

      <p className="mt-10 text-[14px]">
        Cc: {letter.cc.length > 0 ? letter.cc.join(", ") : "—"}
      </p>
    </article>
  );
}

function buildPrintHtml(letters: AllocationLetter[]): string {
  const pages = letters
    .map((letter) => {
      const refs = letter.refs
        .map((ref) => `<div>${escapeHtml(ref)}</div>`)
        .join("");
      const rows = letter.rows
        .map(
          (row) => `
        <tr>
          <td class="u">${escapeHtml(row.allowanceName)}</td>
          <td class="r">${formatAmount(row.monthlyAmount)}</td>
          <td>${escapeHtml(row.areaToCover)}</td>
        </tr>`,
        )
        .join("");
      const conditions = letter.conditions
        .map((c) => `<li>${escapeHtml(c)}</li>`)
        .join("");
      return `
      <article class="memo-page">
        <header class="center">
          <div class="org">CAMEROON DEVELOPMENT CORPORATION</div>
          <div class="doc-title">INTER-DEPARTMENTAL MEMO</div>
        </header>
        <div class="grid">
          <div class="left">
            <div class="cell top"><strong>FROM: </strong></div>
            <div class="cell indent"><strong>${escapeHtml(letter.fromTitle)}</strong></div>
            <div class="cell">&nbsp;</div>
          </div>
          <div class="right">
            <div class="cell top">To:</div>
            <div class="cell indent"><strong>${escapeHtml(letter.names ?? letter.matricule)}</strong></div>
            <div class="cell indent">${escapeHtml(letter.designationLine)}</div>
          </div>
        </div>
        <div class="thro"><div class="thro-text">Thro': ${escapeHtml(letter.throTitle)}</div></div>
        <div class="meta">
          <div class="meta-left">
            ${refs}
            <div class="matric"><strong>MAT. NO. ${escapeHtml(letter.matricule)}</strong></div>
          </div>
          <div class="meta-right">${renderMemoDate(letter.memoDate)}</div>
        </div>
        <h2 class="subject">${escapeHtml(letter.subject)}</h2>

        <p class="body">${escapeHtml(letter.openingParagraph)}</p>
        <table>
          <thead>
            <tr>
              <th>ALLOWANCE</th>
              <th>MONTHLY AMOUNT(FCFA)</th>
              <th>AREA TO COVER</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="body">The following conditions shall apply;</p>
        <ol class="conditions">${conditions}</ol>
        <p class="body">${escapeHtml(letter.closingLine)}</p>
        <div class="sign">
          ${letter.signatoryName ? `<div class="name">${escapeHtml(letter.signatoryName)}</div>` : ""}
          <div class="title">${escapeHtml(letter.signatoryTitle ?? letter.fromTitle)}</div>
        </div>
        <div class="cc">Cc: ${escapeHtml(letter.cc.join(", ") || "—")}</div>
      </article>`;
    })
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Allowance Allocation Letters</title>
  <style>
    @page {
      size: A4;
      margin-top: 4mm;
      margin-bottom: 4mm;
      margin-left: 18mm;
      margin-right: 18mm;
    }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 12pt;
      line-height: 1.5;
      color: #000;
      margin: 0;
    }
    .memo-page { page-break-after: always; }
    .memo-page:last-child { page-break-after: auto; }
    .center { text-align: center; }
    .org { font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; }
    .doc-title { margin-top: 4px; font-weight: 700; text-transform: uppercase; text-decoration: underline; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; border-top: 2px solid #000; border-bottom: 2px solid #000; margin-top: 16px; }
    .left { border-right: 1px solid #000; }
    .cell { padding: 6px 8px; border-bottom: 1px solid #000; text-transform: uppercase; }
    .cell.top { font-weight: 600; }
    .cell.indent { padding-left: 4em; }
    .right .cell:last-child { border-bottom: none; }
    .left .cell:last-child { border-bottom: none; }
    .thro {
      display: grid;
      grid-template-columns: 1fr 1fr;
      margin-top: 4px;
      text-transform: uppercase;
    }
    .thro-text {
      grid-column: 2;
      padding: 4px 8px;
      padding-left: 4em;
      box-sizing: border-box;
    }
    .meta { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-top: 12px; text-transform: uppercase; }
    .meta-left .matric { font-weight: 700; text-decoration: underline; margin-top: 4px; }
    .meta-right { text-transform: none; }
    .meta-right sup { font-size: 0.7em; }
    .subject { text-align: center; text-transform: uppercase; text-decoration: underline; margin: 24px 0 16px; font-size: 14pt; }
    .body { margin: 0 0 12px; text-align: justify; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12pt; }
    th, td { border: 1px solid #000; padding: 4px 6px; vertical-align: middle; }
    th { text-align: left; text-transform: uppercase; }
    .r { text-align: right; }
    .u { text-transform: uppercase; }
    .conditions { margin: 0 0 12px 1.25em; padding: 0; text-align: justify; }
    .conditions li { margin-bottom: 8px; }
    .sign { text-align: right; margin-top: 40px; }
    .sign .name, .sign .title { font-weight: 700; text-transform: uppercase; }
    .cc { margin-top: 40px; }
    sup { font-size: 0.7em; }
  </style>
</head>
<body>${pages}</body>
</html>`;
}

export function AllocationLettersConsole({
  user,
  onClose,
}: AllocationLettersConsoleProps) {
  const [unitId, setUnitId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [matricInput, setMatricInput] = useState("");
  const [matric, setMatric] = useState("");
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [letters, setLetters] = useState<AllocationLetter[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const unrestricted = user.jurisdiction === "all";
  const scope = user.jurisdiction;
  const unitLocked = !unrestricted && (scope === "unit" || scope === "section");
  const sectionLocked = !unrestricted && scope === "section";

  const loadLookups = useCallback(async () => {
    const client = await createApiClient();
    const unitsRes = await client.appraisals.units.$get();
    if (unitsRes.ok) setUnits(await unitsRes.json());
  }, []);

  const loadSections = useCallback(async (unit: string) => {
    const client = await createApiClient();
    const res = await client.appraisals.sections.$get({
      query: unit ? { unitId: unit } : {},
    });
    if (res.ok) setSections(await res.json());
    else setSections([]);
  }, []);

  const loadLetters = useCallback(
    async (matricOverride?: string) => {
      const matricFilter = (matricOverride ?? matric).trim();
      setLoading(true);
      setStatus(null);
      try {
        const client = await createApiClient();
        const res = await client.reports["allowance-allocation-letters"].$get({
          query: {
            ...(unitId ? { unitId } : {}),
            ...(sectionId ? { sectionId } : {}),
            ...(matricFilter ? { matric: matricFilter } : {}),
          },
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(
            body?.error ?? `Failed to load letters (${res.status})`,
          );
        }
        const data = (await res.json()) as AllocationLettersResponse;
        setLetters(data.letters);
        if (data.letters.length === 0) {
          setStatus(
            matricFilter
              ? `No allocation letter found for matric ${matricFilter} with the current filters.`
              : "No current validated allowance allocations for the current filters.",
          );
        }
      } catch (err) {
        setLetters([]);
        setStatus(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [unitId, sectionId, matric],
  );

  function applyMatricAndLoad() {
    const next = matricInput.trim();
    setMatric(next);
    void loadLetters(next);
  }

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    if (unrestricted) return;
    if (scope === "unit" && user.unitId) setUnitId(user.unitId);
    else if (scope === "section") {
      if (user.unitId) setUnitId(user.unitId);
      else if (units.length === 1) setUnitId(units[0].id);
      if (user.sectionId != null) setSectionId(String(user.sectionId));
    } else if (scope === "group" && units.length === 1) {
      setUnitId(units[0].id);
    }
  }, [unrestricted, scope, user.unitId, user.sectionId, units]);

  useEffect(() => {
    void loadSections(unitId);
    if (!sectionLocked) setSectionId("");
  }, [unitId, loadSections, sectionLocked]);

  useEffect(() => {
    void loadLetters();
  }, [loadLetters]);

  return (
    <ReportPreviewConsole
      title="Allowance Allocation Letters"
      onClose={onClose}
      status={status}
      loading={loading}
      onRefresh={() => applyMatricAndLoad()}
      hasData={letters.length > 0}
      getPrintHtml={() => buildPrintHtml(letters)}
      defaultPdfName="allowance-allocation-letters.pdf"
      emptyMessage="No allocation letters for the current filters."
      preview={letters.map((letter) => (
        <AllocationMemoPage key={letter.matricule} letter={letter} />
      ))}
      toolbar={
        <Card className="shrink-0 py-3">
          <CardContent className="flex flex-wrap items-end gap-3 px-3">
            <div className="grid gap-1">
              <Label>Unit</Label>
              <Select
                value={unitId || ALL_VALUE}
                onValueChange={(value) =>
                  setUnitId(value === ALL_VALUE ? "" : value)
                }
                disabled={unitLocked}
              >
                <SelectTrigger className="min-w-64">
                  <SelectValue placeholder="All units" />
                </SelectTrigger>
                <SelectContent>
                  {!unitLocked ? (
                    <SelectItem value={ALL_VALUE}>All units</SelectItem>
                  ) : null}
                  {units
                    .filter((unit) => unit.active || unit.id === unitId)
                    .map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.unitName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1">
              <Label>Section</Label>
              <Select
                value={sectionId || ALL_VALUE}
                onValueChange={(value) =>
                  setSectionId(value === ALL_VALUE ? "" : value)
                }
                disabled={sectionLocked || (!unitId && sections.length === 0)}
              >
                <SelectTrigger className="min-w-48">
                  <SelectValue placeholder="All sections" />
                </SelectTrigger>
                <SelectContent>
                  {!sectionLocked ? (
                    <SelectItem value={ALL_VALUE}>All sections</SelectItem>
                  ) : null}
                  {sections
                    .filter(
                      (section) =>
                        section.active || String(section.id) === sectionId,
                    )
                    .map((section) => (
                      <SelectItem key={section.id} value={String(section.id)}>
                        {section.section ?? `Section #${section.id}`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1">
              <Label htmlFor="alloc-letter-matric">Matric</Label>
              <div className="flex gap-2">
                <Input
                  id="alloc-letter-matric"
                  className="w-36"
                  value={matricInput}
                  maxLength={6}
                  placeholder="e.g. 080189"
                  onChange={(e) => setMatricInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyMatricAndLoad();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => applyMatricAndLoad()}
                  disabled={loading}
                >
                  Find
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      }
    />
  );
}
