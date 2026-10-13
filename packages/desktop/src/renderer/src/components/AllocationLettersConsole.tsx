import {
  memoDateTextHtml,
  memoFormDocumentHtml,
  memoFormPageHtml,
  type AllocationLetter,
  type AllocationLettersResponse,
  type MemoCcLayout,
  type SectionOption,
  type UnitOption,
  type User,
} from "@personel-management-app/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
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

function formatAmount(value: number): string {
  return value.toLocaleString("en-US");
}

const ALLOCATION_CSS = `
.memo-body table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12pt; }
.memo-body th, .memo-body td { border: 1px solid #000; padding: 4px 6px; vertical-align: middle; }
.memo-body th { text-align: left; text-transform: uppercase; }
.memo-body .r { text-align: right; }
.memo-body .u { text-transform: uppercase; }
.memo-body ol { margin: 0 0 12px 1.25em; padding: 0; }
.memo-body li { margin-bottom: 8px; }
`;

function buildPrintHtml(
  letters: AllocationLetter[],
  ccLayout: MemoCcLayout,
): string {
  const pages = letters
    .map((letter) => {
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
        .map((condition) => `<li>${escapeHtml(condition)}</li>`)
        .join("");
      const body = `<p>${escapeHtml(letter.openingParagraph)}</p>
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
        <p>The following conditions shall apply;</p>
        <ol>${conditions}</ol>
        <p>${escapeHtml(letter.closingLine)}</p>`;
      return memoFormPageHtml({
        fromTitle: letter.fromTitle,
        toName: letter.names ?? letter.matricule,
        designation: letter.designationLine,
        throTitle: letter.throTitle,
        refs: letter.refs,
        matricule: letter.matricule,
        dateHtml: memoDateTextHtml(letter.memoDate),
        subject: letter.subject,
        bodyHtml: body,
        signatoryName: letter.signatoryName,
        signatoryTitle: letter.signatoryTitle ?? letter.fromTitle,
        ccLines: letter.cc,
        ccLayout,
      });
    })
    .join("");
  return memoFormDocumentHtml({
    title: "Allowance Allocation Letters",
    pageHtml: pages,
    copies: 2,
    extraCss: ALLOCATION_CSS,
  });
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
  const [ccLayout, setCcLayout] = useState<MemoCcLayout>("COLUMN");
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
        setCcLayout(data.ccLayout === "ROW" ? "ROW" : "COLUMN");
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

  const printHtml = useMemo(
    () => (letters.length > 0 ? buildPrintHtml(letters, ccLayout) : ""),
    [letters, ccLayout],
  );

  return (
    <ReportPreviewConsole
      title="Allowance Allocation Letters"
      onClose={onClose}
      status={status}
      loading={loading}
      onRefresh={() => applyMatricAndLoad()}
      hasData={letters.length > 0}
      printHtml={printHtml}
      defaultPdfName="allowance-allocation-letters.pdf"
      emptyMessage="No allocation letters for the current filters."
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
