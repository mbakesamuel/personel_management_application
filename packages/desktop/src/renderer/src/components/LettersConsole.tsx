import type {
  AppraisalLetter,
  AppraisalLettersResponse,
  FinancialYear,
  SectionOption,
  SkippedAppraisalLetter,
  UnitOption,
  User,
} from "@personel-management-app/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createApiClient } from "../api/client";
import { LOGO_DATA_URI } from "../lib/logo";
import { ReportPreviewConsole } from "./ReportPreviewConsole";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type LettersConsoleProps = {
  user: User;
  financialYear: FinancialYear | null;
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

/** Convert **bold** markdown markers used in templates to HTML/React-safe spans. */
function renderRichText(text: string): string {
  const escaped = escapeHtml(text);
  return escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function renderMemoDate(value: string): string {
  return escapeHtml(value).replace(
    /^(\d+)(st|nd|rd|th)/i,
    "$1<sup>$2</sup>",
  );
}

function buildPrintHtml(letters: AppraisalLetter[]): string {
  const pages = letters
    .map((letter) => {
      const paragraphs = letter.paragraphs
        .map((p) => `<p>${renderRichText(p)}</p>`)
        .join("");
      const cc = letter.cc
        .map((item) => `<div>${escapeHtml(item)}</div>`)
        .join("");
      return `
      <article class="memo-page">
        <header class="center">
          <div class="org">CAMEROON DEVELOPMENT CORPORATION</div>
          <img class="logo" src="${LOGO_DATA_URI}" alt="" />
          <div class="doc-title">INTER-DEPARTMENTAL MEMO</div>
        </header>
        <div class="grid">
          <div class="left">
            <div class="cell top"><strong>FROM: ${escapeHtml(letter.fromTitle)}</strong></div>
            <div class="cell">${escapeHtml(letter.unitName ?? "—")}</div>
          </div>
          <div class="right">
            <div class="cell top">To: <strong>${escapeHtml(letter.names ?? letter.matric)}</strong></div>
            <div class="cell">${escapeHtml(letter.designationLine || "—")}</div>
            <div class="cell">Thro' ${escapeHtml(letter.throTitle ?? "HEAD OF SECTION")}</div>
          </div>
        </div>
        <div class="meta">
          <div>
            <div class="confidential">CONFIDENTIAL</div>
            <div class="matric">MAT NO ${escapeHtml(letter.matric)}</div>
          </div>
          <div>${renderMemoDate(letter.memoDate)}</div>
        </div>
        <h2 class="subject">${escapeHtml(letter.subject)}</h2>
        <div class="body">${paragraphs}</div>
        <div class="sign">
          <div class="name">${escapeHtml(letter.signatoryName ?? "—")}</div>
          <div class="title">${escapeHtml(letter.signatoryTitle ?? letter.fromTitle)}</div>
        </div>
        <div class="cc">${cc}</div>
      </article>`;
    })
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Appraisal Letters</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 14pt;
      line-height: 1.5;
      color: #000;
      margin: 0;
    }
    .memo-page { page-break-after: always; font-size: 14pt; line-height: 1.5; }
    .memo-page:last-child { page-break-after: auto; }
    .center { text-align: center; }
    .org { font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; font-size: 14pt; line-height: 1.5; }
    .logo { display: block; margin: 4px auto; height: 56px; object-fit: contain; }
    .doc-title { margin-top: 4px; font-weight: 700; text-transform: uppercase; text-decoration: underline; font-size: 14pt; line-height: 1.5; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; border-top: 2px solid #000; border-bottom: 2px solid #000; margin-top: 16px; font-size: 14pt; line-height: 1.5; }
    .left { border-right: 1px solid #000; }
    .cell { padding: 6px 8px; border-bottom: 1px solid #000; text-transform: uppercase; }
    .cell.top { font-weight: 600; }
    .right .cell:last-child { border-bottom: none; text-transform: none; }
    .left .cell:last-child { border-bottom: none; }
    .meta { display: flex; justify-content: space-between; margin-top: 12px; font-size: 14pt; line-height: 1.5; }
    .meta sup { font-size: 0.7em; }
    .confidential, .matric { font-weight: 700; text-decoration: underline; }
    .subject { text-align: center; text-transform: uppercase; text-decoration: underline; font-size: 14pt; line-height: 1.5; margin: 24px 0 16px; }
    .body p { margin: 0 0 12px; font-size: 12pt; line-height: 1.5; text-align: justify; }
    .sign { text-align: right; margin-top: 40px; font-size: 14pt; line-height: 1.5; }
    .sign .name { font-weight: 700; font-style: italic; text-decoration: underline; text-transform: uppercase; }
    .sign .title { font-weight: 700; font-style: italic; text-transform: uppercase; }
    .cc { margin-top: 40px; font-size: 14pt; line-height: 1.5; }
  </style>
</head>
<body>${pages}</body>
</html>`;
}

export function LettersConsole({
  user,
  financialYear,
  onClose,
}: LettersConsoleProps) {
  const [years, setYears] = useState<number[]>([]);
  const [appyear, setAppyear] = useState<number | null>(null);
  const [unitId, setUnitId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [matricInput, setMatricInput] = useState("");
  const [matric, setMatric] = useState("");
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [letters, setLetters] = useState<AppraisalLetter[]>([]);
  const [skipped, setSkipped] = useState<SkippedAppraisalLetter[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [yearsLoaded, setYearsLoaded] = useState(false);

  const unrestricted = user.jurisdiction === "all";
  const scope = user.jurisdiction;
  const unitLocked = !unrestricted && (scope === "unit" || scope === "section");
  const sectionLocked = !unrestricted && scope === "section";
  const sessionYear = financialYear?.appyear ?? null;

  const loadLookups = useCallback(async () => {
    const client = await createApiClient();
    const [unitsRes, yearsRes] = await Promise.all([
      client.appraisals.units.$get(),
      client.reports["appraisal-letter-years"].$get(),
    ]);
    if (unitsRes.ok) setUnits(await unitsRes.json());
    if (!yearsRes.ok) {
      const body = (await yearsRes.json().catch(() => null)) as {
        error?: string;
      } | null;
      setYears([]);
      setStatus(body?.error ?? `Failed to load years (${yearsRes.status})`);
      return;
    }
    const data = await yearsRes.json();
    setYears(data.years);
    setAppyear((prev) => {
      if (prev != null && data.years.includes(prev)) return prev;
      if (sessionYear != null && data.years.includes(sessionYear)) {
        return sessionYear;
      }
      return data.years[0] ?? null;
    });
    setYearsLoaded(true);
  }, [sessionYear]);

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
      if (appyear == null) {
        setLetters([]);
        setSkipped([]);
        if (yearsLoaded) {
          setStatus(
            years.length === 0
              ? "No posted salary review data. Use Post on the Appraisal Console first, or import historic salary review."
              : "Select a year with posted salary review data to load letters.",
          );
        }
        return;
      }
      setLoading(true);
      setStatus(null);
      try {
        const client = await createApiClient();
        const res = await client.reports["appraisal-letters"].$get({
          query: {
            ...(appyear != null ? { appyear: String(appyear) } : {}),
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
        const data = (await res.json()) as AppraisalLettersResponse;
        setLetters(data.letters);
        setSkipped(data.skipped);
        if (data.letters.length === 0 && data.skipped.length === 0) {
          setStatus(
            matricFilter
              ? `No letter found for matric ${matricFilter} with the current filters.`
              : `No posted salary review data for year ${appyear}. Use Post on the Appraisal Console first, or import historic salary review.`,
          );
        }
      } catch (err) {
        setLetters([]);
        setSkipped([]);
        setStatus(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [appyear, unitId, sectionId, matric, years.length, yearsLoaded],
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

  const defaultPdfName =
    appyear != null
      ? `appraisal-letters-${appyear}.pdf`
      : "appraisal-letters.pdf";
  const printHtml = useMemo(
    () => (letters.length > 0 ? buildPrintHtml(letters) : ""),
    [letters],
  );

  return (
    <ReportPreviewConsole
      title="Appraisal Letters"
      onClose={onClose}
      status={status}
      loading={loading}
      onRefresh={() => applyMatricAndLoad()}
      hasData={letters.length > 0}
      printHtml={printHtml}
      defaultPdfName={defaultPdfName}
      emptyMessage="No printable letters for the current filters."
     /*  alerts={
        skipped.length > 0 ? (
          <Alert className="shrink-0">
            <AlertDescription>
              Skipped {skipped.length} record(s):{" "}
              {skipped
                .slice(0, 5)
                .map(
                  (row) =>
                    `${row.matric ?? "?"} (${row.award ?? "no award"} — ${row.reason})`,
                )
                .join("; ")}
              {skipped.length > 5 ? "…" : ""}
            </AlertDescription>
          </Alert>
        ) : null
      } */
      toolbar={
        <Card className="shrink-0 py-3">
          <CardContent className="flex flex-wrap items-end gap-3 px-3">
            <div className="grid gap-1">
              <Label>Appraisal Year</Label>
              <Select
                value={appyear != null ? String(appyear) : undefined}
                onValueChange={(value) => setAppyear(Number(value))}
                disabled={years.length === 0}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
              <Label htmlFor="letter-matric">Matric</Label>
              <div className="flex gap-2">
                <Input
                  id="letter-matric"
                  className="w-36"
                  value={matricInput}
                  maxLength={6}
                  placeholder="e.g. 000224"
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
