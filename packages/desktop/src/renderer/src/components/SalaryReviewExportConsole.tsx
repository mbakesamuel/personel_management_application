import type {
  SectionOption,
  UnitOption,
  User,
} from "@perf-appraisal-app/shared";
import { FileSpreadsheet, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createApiClient } from "../api/client";
import {
  buildSalaryReviewExcel,
  salaryReviewExcelDefaultName,
} from "../lib/export-salary-review-excel";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Toolbar } from "@/components/ui/toolbar";

type SalaryReviewExportConsoleProps = {
  user: User;
  onClose: () => void;
};

const ALL_VALUE = "__all__";

export function SalaryReviewExportConsole({
  user,
  onClose,
}: SalaryReviewExportConsoleProps) {
  const [appyear, setAppyear] = useState<number | null>(null);
  const [years, setYears] = useState<number[]>([]);
  const [unitId, setUnitId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const unrestricted = user.jurisdiction === "all";
  const scope = user.jurisdiction;
  const unitLocked = !unrestricted && (scope === "unit" || scope === "section");
  const sectionLocked = !unrestricted && scope === "section";

  const loadLookups = useCallback(async () => {
    const client = await createApiClient();
    const [yearsRes, unitsRes] = await Promise.all([
      client.appraisals["salary-review"].years.$get(),
      client.appraisals.units.$get(),
    ]);
    if (!yearsRes.ok) {
      const body = (await yearsRes.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(
        body?.error ?? `Failed to load years (${yearsRes.status})`,
      );
    }
    const data = await yearsRes.json();
    setYears(data.years);
    setAppyear((prev) => prev ?? data.years[0] ?? null);
    if (unitsRes.ok) setUnits(await unitsRes.json());
  }, []);

  const loadSections = useCallback(async (unit: string) => {
    const client = await createApiClient();
    const res = await client.appraisals.sections.$get({
      query: unit ? { unitId: unit } : {},
    });
    if (res.ok) {
      setSections(await res.json());
    } else {
      setSections([]);
    }
  }, []);

  useEffect(() => {
    void loadLookups().catch((err) => {
      setStatus(err instanceof Error ? err.message : String(err));
    });
  }, [loadLookups]);

  useEffect(() => {
    if (unrestricted) return;
    if (scope === "unit" && user.unitId) {
      setUnitId(user.unitId);
    } else if (scope === "section") {
      if (user.unitId) setUnitId(user.unitId);
      else if (units.length === 1) setUnitId(units[0].id);
      if (user.sectionId != null) setSectionId(String(user.sectionId));
    } else if (scope === "group" && units.length === 1) {
      setUnitId(units[0].id);
    }
  }, [unrestricted, scope, user.unitId, user.sectionId, units]);

  useEffect(() => {
    void loadSections(unitId);
    if (!sectionLocked) {
      setSectionId("");
    }
  }, [unitId, loadSections, sectionLocked]);

  async function handleExportExcel() {
    if (appyear == null) {
      setStatus("Select a year to export.");
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      if (typeof window.api?.saveFile !== "function") {
        throw new Error("Save file is not available in this environment.");
      }

      const client = await createApiClient();
      const res = await client.appraisals["salary-review"].export.$get({
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
        throw new Error(body?.error ?? `Export failed (${res.status})`);
      }
      const data = await res.json();
      const total = data.sections.reduce(
        (sum, section) => sum + section.rows.length,
        0,
      );
      if (data.sections.length === 0) {
        setStatus("No records to export.");
        return;
      }

      const result = await window.api.saveFile({
        defaultName: salaryReviewExcelDefaultName(appyear, unitId || undefined),
        data: buildSalaryReviewExcel(data),
      });
      if ("ok" in result && result.ok) {
        const name = result.path.replace(/^.*[/\\]/, "");
        setStatus(`Exported ${total} record(s) to ${name}.`);
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
      <h2 className="m-0 shrink-0 text-xl font-bold">
        Export Historic Appraisals
      </h2>

      <Toolbar>
        <Button
          type="button"
          size="sm"
          onClick={() => void handleExportExcel()}
          disabled={loading || appyear == null}
        >
          <FileSpreadsheet className="size-4" />
          Export Excel
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={loading}
        >
          <X className="size-4" />
          Close
        </Button>
      </Toolbar>

      <Card className="shrink-0 py-3">
        <CardContent className="flex flex-wrap items-end gap-3 px-3">
          <p className="w-full text-sm text-muted-foreground">
            Export salary-review history for a year. Unit and section filters
            are optional. The workbook has one worksheet per section.
          </p>
          <div className="grid gap-1">
            <Label>Year</Label>
            <Select
              value={appyear != null ? String(appyear) : undefined}
              onValueChange={(value) => setAppyear(Number(value))}
              disabled={loading || years.length === 0}
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
            <div className="flex gap-2">
              <Input
                className="w-20"
                value={unitId}
                readOnly
                placeholder="ID"
              />
              <Select
                value={unitId || ALL_VALUE}
                onValueChange={(value) =>
                  setUnitId(value === ALL_VALUE ? "" : value)
                }
                disabled={unitLocked || loading}
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
          </div>

          <div className="grid gap-1">
            <Label>Section</Label>
            <Select
              value={sectionId || ALL_VALUE}
              onValueChange={(value) =>
                setSectionId(value === ALL_VALUE ? "" : value)
              }
              disabled={
                sectionLocked || loading || (!unitId && sections.length === 0)
              }
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

      {status ? (
        <Alert className="shrink-0">
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}
