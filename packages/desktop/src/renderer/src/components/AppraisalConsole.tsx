import type {
  AppraisalListItem,
  AwardOption,
  FinancialYear,
  SectionOption,
  UnitOption,
  User,
} from "@perf-appraisal-app/shared";
import { FileSpreadsheet, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createApiClient } from "../api/client";
import {
  appraisalExcelDefaultName,
  buildAppraisalExcel,
  type AppraisalExcelSection,
} from "../lib/export-appraisal-excel";
import { formatDisplayDate } from "../lib/format-date";
import { AppraisalDetailModal } from "./AppraisalDetailModal";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AppraisalConsoleProps = {
  user: User;
  financialYear: FinancialYear | null;
  onClose: () => void;
};

const ALL_VALUE = "__all__";

export function AppraisalConsole({
  user,
  financialYear,
  onClose,
}: AppraisalConsoleProps) {
  const [unitId, setUnitId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [search, setSearch] = useState("");
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [awards, setAwards] = useState<AwardOption[]>([]);
  const [items, setItems] = useState<AppraisalListItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const appyear = financialYear?.appyear ?? null;
  const yearClosed = financialYear?.closed === true;
  const canMutate = appyear != null && !yearClosed;
  const unrestricted = user.jurisdiction === "all";
  const scope = user.jurisdiction;
  const unitLocked = !unrestricted && (scope === "unit" || scope === "section");
  const sectionLocked = !unrestricted && scope === "section";

  const loadLookups = useCallback(async () => {
    const client = await createApiClient();
    const [unitsRes, awardsRes] = await Promise.all([
      client.appraisals.units.$get(),
      client.appraisals.awards.$get(),
    ]);
    if (unitsRes.ok) setUnits(await unitsRes.json());
    if (awardsRes.ok) setAwards(await awardsRes.json());
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

  const loadRows = useCallback(async () => {
    setLoading(true);
    setProgress(15);
    setStatus(null);
    try {
      const client = await createApiClient();
      setProgress(45);
      const res = await client.appraisals.$get({
        query: {
          ...(appyear != null ? { appyear: String(appyear) } : {}),
          ...(unitId ? { unitId } : {}),
          ...(sectionId ? { sectionId } : {}),
        },
      });
      setProgress(80);
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = await res.json();
      setItems(data.items);
      setSelectedId(null);
      setProgress(100);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
      setItems([]);
      setProgress(0);
    } finally {
      setLoading(false);
      window.setTimeout(() => setProgress(0), 400);
    }
  }, [appyear, unitId, sectionId]);

  useEffect(() => {
    void loadLookups();
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

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((row) => {
      const matric = (row.matric ?? "").toLowerCase();
      const names = (row.names ?? "").toLowerCase();
      return matric.includes(q) || names.includes(q);
    });
  }, [items, search]);

  useEffect(() => {
    if (selectedId == null) return;
    if (!visibleItems.some((row) => row.id === selectedId)) {
      setSelectedId(null);
    }
  }, [visibleItems, selectedId]);

  function clearFilters() {
    if (!unitLocked) setUnitId("");
    if (!sectionLocked) setSectionId("");
    setSearch("");
  }

  function openCreate() {
    if (appyear == null) {
      setStatus(
        user.permissions.canFinancialYears
          ? "No open financial year is available."
          : "Open a financial year (Processes → Open Financial Year) before creating a record.",
      );
      return;
    }
    if (yearClosed) {
      setStatus(
        `Financial year ${appyear} is closed. Only reports and printing are allowed.`,
      );
      return;
    }
    setModalMode("create");
    setModalOpen(true);
  }

  function openEdit() {
    if (!canMutate) {
      setStatus(
        yearClosed
          ? `Financial year ${appyear} is closed. Only reports and printing are allowed.`
          : user.permissions.canFinancialYears
            ? "No open financial year is available."
            : "Open a financial year before modifying records.",
      );
      return;
    }
    if (selectedId == null) {
      setStatus("Select a row to modify.");
      return;
    }
    setModalMode("edit");
    setModalOpen(true);
  }

  function requestDelete() {
    if (!canMutate) {
      setStatus(
        yearClosed
          ? `Financial year ${appyear} is closed. Only reports and printing are allowed.`
          : "Open a financial year before deleting records.",
      );
      return;
    }
    if (selectedId == null) {
      setStatus("Select a row to delete.");
      return;
    }
    setConfirmDeleteOpen(true);
  }

  async function handleDelete() {
    if (selectedId == null) return;

    setLoading(true);
    try {
      const client = await createApiClient();
      const res = await client.appraisals[":id"].$delete({
        param: { id: String(selectedId) },
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      await loadRows();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handlePost() {
    if (appyear == null) {
      setStatus(
        user.permissions.canFinancialYears
          ? "No open financial year is available."
          : "Open a financial year before posting.",
      );
      return;
    }
    if (yearClosed) {
      setStatus(
        `Financial year ${appyear} is closed. Only reports and printing are allowed.`,
      );
      return;
    }

    const CHUNK = 40;
    setLoading(true);
    setProgress(0);
    setStatus("Starting salary review post…");
    let postedTotal = 0;
    let skippedTotal = 0;

    try {
      const client = await createApiClient();
      const startRes = await client.appraisals["post-salary-review"].start.$post(
        {
          json: { appyear },
        },
      );
      if (!startRes.ok) {
        const body = (await startRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          body?.error ?? `Failed to start post (${startRes.status})`,
        );
      }
      const { ids, total } = await startRes.json();
      if (total === 0) {
        setProgress(0);
        setStatus(`No appraisal records found for year ${appyear}.`);
        return;
      }

      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const batchRes = await client.appraisals[
          "post-salary-review"
        ].batch.$post({
          json: { appyear, ids: chunk },
        });
        if (!batchRes.ok) {
          const body = (await batchRes.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(
            body?.error ?? `Post batch failed (${batchRes.status})`,
          );
        }
        const batch = await batchRes.json();
        postedTotal += batch.posted;
        skippedTotal += batch.skipped;

        const current = Math.min(i + chunk.length, total);
        const percent = Math.round((current / total) * 100);
        setProgress(percent);
        setStatus(
          `Posting salary review: ${current} of ${total} (${percent}%)`,
        );
      }

      setProgress(100);
      setStatus(
        `Successfully posted salary review for appraisal year ${appyear}. ${postedTotal} record(s) posted` +
          (skippedTotal > 0 ? `, ${skippedTotal} skipped.` : "."),
      );
      window.setTimeout(() => setProgress(0), 600);
    } catch (err) {
      setProgress(0);
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleExportExcel() {
    if (appyear == null) {
      setStatus(
        user.permissions.canFinancialYears
          ? "No open financial year is available."
          : "Open a financial year (Processes → Open Financial Year) before exporting.",
      );
      return;
    }
    if (!unitId) {
      setStatus("Select a unit to export.");
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      if (typeof window.api?.saveFile !== "function") {
        throw new Error("Save file is not available in this environment.");
      }

      const client = await createApiClient();
      const res = await client.appraisals.$get({
        query: {
          appyear: String(appyear),
          unitId,
        },
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = await res.json();
      const exportItems: AppraisalListItem[] = data.items;

      const unitSectionIds = new Set(sections.map((section) => section.id));
      const itemsBySection = new Map<number, AppraisalListItem[]>();
      const unassigned: AppraisalListItem[] = [];
      for (const item of exportItems) {
        if (item.sectionId != null && unitSectionIds.has(item.sectionId)) {
          const list = itemsBySection.get(item.sectionId) ?? [];
          list.push(item);
          itemsBySection.set(item.sectionId, list);
        } else {
          unassigned.push(item);
        }
      }

      const excelSections: AppraisalExcelSection[] = [...sections]
        .sort((a, b) =>
          (a.section ?? `Section #${a.id}`).localeCompare(
            b.section ?? `Section #${b.id}`,
          ),
        )
        .map((section) => ({
          sectionId: section.id,
          sectionName: section.section ?? `Section #${section.id}`,
          items: itemsBySection.get(section.id) ?? [],
        }));
      if (unassigned.length > 0) {
        excelSections.push({
          sectionId: null,
          sectionName: "Unassigned",
          items: unassigned,
        });
      }

      if (excelSections.length === 0) {
        setStatus("No records to export.");
        return;
      }

      const unitName =
        units.find((unit) => unit.id === unitId)?.unitName ?? unitId;
      const result = await window.api.saveFile({
        defaultName: appraisalExcelDefaultName(appyear, unitId),
        data: buildAppraisalExcel({
          unitName,
          appyear,
          sections: excelSections,
        }),
      });
      if ("ok" in result && result.ok) {
        const name = result.path.replace(/^.*[/\\]/, "");
        setStatus(`Exported ${exportItems.length} record(s) to ${name}.`);
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
        Performance Appraisal Input
      </h2>

      <Card className="shrink-0 py-3">
        <CardContent className="flex flex-wrap items-end gap-3 px-3">
         {/*  <div className="grid gap-1">
            <Label>Appraisal Year</Label>
            <Input
              className="w-36"
              value={appyear != null ? String(appyear) : ""}
              readOnly
              disabled
              placeholder="No year open"
            />
          </div>
 */}
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
          </div>

          <div className="grid gap-1">
            <Label>Filter By Section</Label>
            <Select
              value={sectionId || ALL_VALUE}
              onValueChange={(value) =>
                setSectionId(value === ALL_VALUE ? "" : value)
              }
              disabled={
                sectionLocked || (!unitId && sections.length === 0)
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

          <div className="grid min-w-56 flex-1 gap-1">
            <Label htmlFor="appraisal-search">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="appraisal-search"
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Matric or name"
                disabled={loading}
              />
            </div>
          </div>

          <Button
            type="button"
            onClick={clearFilters}
            disabled={loading}
          >
            Clear
          </Button>
        </CardContent>
      </Card>

      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-background">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted">
                <TableRow>
                  {[
                    "Matric",
                    "Names",
                    "Date_LMerit",
                    "Date_LStat",
                    "Date_LPro",
                    "Length",
                    "Pre_Cat",
                    "Pro_Cat",
                    "Award",
                  ].map((heading) => (
                    <TableHead key={heading}>{heading}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleItems.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.id === selectedId ? "selected" : undefined}
                    className="cursor-default"
                    onClick={() => setSelectedId(row.id)}
                    onDoubleClick={openEdit}
                  >
                    <TableCell>{row.matric}</TableCell>
                    <TableCell>{row.names}</TableCell>
                    <TableCell>{formatDisplayDate(row.dateLmerit)}</TableCell>
                    <TableCell>{formatDisplayDate(row.dateLstat)}</TableCell>
                    <TableCell>{formatDisplayDate(row.dateLpro)}</TableCell>
                    <TableCell>{row.lengthservice}</TableCell>
                    <TableCell>{row.preCat}</TableCell>
                    <TableCell>{row.proCat}</TableCell>
                    <TableCell>{row.award}</TableCell>
                  </TableRow>
                ))}
                {visibleItems.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="px-3 py-6 text-center text-muted-foreground"
                    >
                      {items.length === 0
                        ? "No appraisal records for the current filters."
                        : "No records match the search."}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="entries">Total Entries:</Label>
            <Input
              id="entries"
              className="w-28 text-center"
              value={
                search.trim()
                  ? `${visibleItems.length}/${items.length}`
                  : items.length
              }
              readOnly
            />
          </div>
        </div>

        <aside className="flex w-25 shrink-0 flex-col gap-2 overflow-y-auto">
          <ActionButton
            icon={<Plus size={16} />}
            label="Add"
            onClick={openCreate}
            disabled={!canMutate && appyear != null && yearClosed}
          />
          <ActionButton
            icon={<Pencil size={16} />}
            label="Modify"
            onClick={openEdit}
            disabled={!canMutate && yearClosed}
          />
          <ActionButton
            icon={<Trash2 size={16} />}
            label="Delete"
            onClick={requestDelete}
            disabled={!canMutate && yearClosed}
          />
          <ActionButton
            icon={<Save size={16} />}
            label="Post"
            onClick={() => void handlePost()}
            disabled={loading || !canMutate}
          />
          <ActionButton
            icon={<FileSpreadsheet size={16} />}
            label="Export Excel"
            onClick={() => void handleExportExcel()}
            disabled={loading || !unitId || appyear == null}
          />
          <ActionButton
            icon={<X size={16} />}
            label="Close"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          />
        </aside>
      </div>

      <div className="flex shrink-0 items-center gap-3 rounded-md border bg-background px-3 py-2">
        <span className="text-sm font-semibold">Progress</span>
        <Progress value={progress} className="flex-1" />
      </div>

      {status ? (
        <Alert className="shrink-0">
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      ) : null}

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete appraisal record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected appraisal record. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {appyear != null ? (
        <AppraisalDetailModal
          open={modalOpen}
          mode={modalMode}
          appyear={appyear}
          appraisalId={modalMode === "edit" ? selectedId : null}
          awards={awards}
          onClose={() => setModalOpen(false)}
          onSaved={() => void loadRows()}
        />
      ) : null}
    </section>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  variant = "default",
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "outline";
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      className="h-auto min-h-12 w-full items-start justify-start gap-2 whitespace-normal px-3 py-2.5 text-left"
      onClick={onClick}
      disabled={disabled}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 leading-snug break-words">{label}</span>
    </Button>
  );
}
