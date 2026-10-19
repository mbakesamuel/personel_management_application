import type {
  AppraisalSummaryResponse,
  AppraisalSummarySection,
  FinancialYear,
  SectionOption,
  UnitOption,
  User,
} from "@personel-management-app/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createApiClient } from "../api/client";
import { buildAppraisalSummaryPrintHtml } from "../lib/appraisal-summary-print";
import { ReportPreviewConsole } from "./ReportPreviewConsole";
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

type AppraisalSummaryConsoleProps = {
  user: User;
  financialYear: FinancialYear | null;
  onClose: () => void;
};

const ALL_VALUE = "__all__";
const EMPTY_SECTIONS: AppraisalSummarySection[] = [];

export function AppraisalSummaryConsole({
  user,
  financialYear,
  onClose,
}: AppraisalSummaryConsoleProps) {
  const [unitId, setUnitId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [report, setReport] = useState<AppraisalSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const appyear = financialYear?.appyear ?? null;
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

  const loadReport = useCallback(async () => {
    if (appyear == null) {
      setReport(null);
      setStatus(
        user.permissions.canFinancialYears
          ? "No open financial year is available."
          : "Open a financial year before viewing the appraisal summary.",
      );
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const client = await createApiClient();
      const res = await client.reports["appraisal-summary"].$get({
        query: {
          appyear: String(appyear),
          ...(unitId ? { unitId } : {}),
          ...(sectionId ? { sectionId } : {}),
        },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          body?.error ?? `Failed to load summary (${res.status})`,
        );
      }
      const data = (await res.json()) as AppraisalSummaryResponse;
      setReport(data);
      if (data.sections.length === 0) {
        setStatus(
          `No posted salary review data for year ${appyear}. Use Post on the Appraisal Console first.`,
        );
      }
    } catch (err) {
      setReport(null);
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [appyear, unitId, sectionId, user.permissions.canFinancialYears]);

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
    void loadReport();
  }, [loadReport]);

  const sectionsData = report?.sections ?? EMPTY_SECTIONS;
  const printOptions = useMemo(() => ({ landscape: true }), []);
  const defaultPdfName =
    appyear != null
      ? `appraisal-summary-${appyear}.pdf`
      : "appraisal-summary.pdf";
  const printHtml = useMemo(
    () =>
      sectionsData.length > 0
        ? buildAppraisalSummaryPrintHtml(sectionsData, appyear)
        : "",
    [sectionsData, appyear],
  );

  return (
    <ReportPreviewConsole
      title="Appraisal Summary"
      onClose={onClose}
      status={status}
      loading={loading}
      onRefresh={() => void loadReport()}
      hasData={sectionsData.length > 0}
      printHtml={printHtml}
      printOptions={printOptions}
      defaultPdfName={defaultPdfName}
      emptyMessage="No summary pages to display."
      toolbar={
        <Card className="shrink-0 py-3">
          <CardContent className="flex flex-wrap items-end gap-3 px-3">
            <div className="grid gap-1">
              <Label>Appraisal Year</Label>
              <Input
                className="w-36"
                value={appyear != null ? String(appyear) : ""}
                readOnly
                disabled
                placeholder="No year open"
              />
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
          </CardContent>
        </Card>
      }
    />
  );
}
