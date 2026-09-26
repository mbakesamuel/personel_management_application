import type {
  SectionOption,
  SectionThroAssignment,
  UnitOption,
} from "@perf-appraisal-app/shared";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createApiClient } from "../api/client";
import { formatDisplayDate } from "../lib/format-date";
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
import { Toolbar } from "@/components/ui/toolbar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type ThroOfficersConsoleProps = {
  onClose: () => void;
};

type FormState = {
  name: string;
  title: string;
  effdate: string;
};

type BatchRow = {
  sectionId: number;
  sectionLabel: string;
  active: boolean;
  name: string;
  title: string;
  effdate: string;
};

const DEFAULT_TITLE = "Head of Section";

function todayIso(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

function emptyForm(): FormState {
  return {
    name: "",
    title: DEFAULT_TITLE,
    effdate: todayIso(),
  };
}

function sortSections(sections: SectionOption[]): SectionOption[] {
  return [...sections].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return (a.section ?? "").localeCompare(b.section ?? "");
  });
}

function latestBySection(
  assignments: SectionThroAssignment[],
): Map<number, SectionThroAssignment> {
  const map = new Map<number, SectionThroAssignment>();
  for (const row of assignments) {
    if (!map.has(row.sectionId)) map.set(row.sectionId, row);
  }
  return map;
}

function buildBatchRows(
  sections: SectionOption[],
  assignments: SectionThroAssignment[],
  date: string,
): BatchRow[] {
  const latest = latestBySection(assignments);
  return sortSections(sections).map((section) => {
    const current = latest.get(section.id);
    return {
      sectionId: section.id,
      sectionLabel: section.section ?? `Section #${section.id}`,
      active: section.active,
      name: current?.name ?? "",
      title: current?.title || DEFAULT_TITLE,
      effdate: date,
    };
  });
}

export function ThroOfficersConsole({ onClose }: ThroOfficersConsoleProps) {
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [unitId, setUnitId] = useState("");
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<SectionThroAssignment[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<FormState>(emptyForm());
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [batchRows, setBatchRows] = useState<BatchRow[]>([]);
  const [sharedDate, setSharedDate] = useState(todayIso);

  const selectedSection =
    sections.find((section) => section.id === sectionId) ?? null;

  const loadUnits = useCallback(async () => {
    const client = await createApiClient();
    const res = await client.organization.units.$get();
    if (res.ok) setUnits(await res.json());
  }, []);

  const loadSections = useCallback(async () => {
    const client = await createApiClient();
    const res = await client.organization.sections.$get({
      query: unitId ? { unitId } : {},
    });
    if (!res.ok) {
      setSections([]);
      return;
    }
    const next = await res.json();
    setSections(next);
    setSectionId((prev) =>
      prev != null && next.some((section) => section.id === prev)
        ? prev
        : (next.find((section) => section.active)?.id ?? next[0]?.id ?? null),
    );
  }, [unitId]);

  const loadAssignments = useCallback(async () => {
    if (batchMode || sectionId == null) {
      if (!batchMode) setAssignments([]);
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const client = await createApiClient();
      const res = await client["section-thro"].$get({
        query: { sectionId: String(sectionId) },
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      setAssignments(await res.json());
      setSelectedId(null);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [sectionId, batchMode]);

  const loadBatchGrid = useCallback(async () => {
    if (!unitId) {
      setBatchRows([]);
      return;
    }
    setLoading(true);
    setStatus(null);
    const date = todayIso();
    setSharedDate(date);
    try {
      const client = await createApiClient();
      const [secRes, asgRes] = await Promise.all([
        client.organization.sections.$get({ query: { unitId } }),
        client["section-thro"].$get({ query: { unitId } }),
      ]);
      if (!secRes.ok) {
        throw new Error(await secRes.text());
      }
      if (!asgRes.ok) {
        const payload = (await asgRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          payload?.error ?? `Failed to load holders (${asgRes.status})`,
        );
      }
      const nextSections = await secRes.json();
      const nextAssignments = await asgRes.json();
      setSections(nextSections);
      setBatchRows(buildBatchRows(nextSections, nextAssignments, date));
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
      setBatchRows([]);
    } finally {
      setLoading(false);
    }
  }, [unitId]);

  useEffect(() => {
    void loadUnits();
  }, [loadUnits]);

  useEffect(() => {
    void loadSections();
  }, [loadSections]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  useEffect(() => {
    if (!batchMode) return;
    if (!unitId) {
      setBatchMode(false);
      setBatchRows([]);
      return;
    }
    void loadBatchGrid();
  }, [batchMode, unitId, loadBatchGrid]);

  function openCreate() {
    if (sectionId == null) {
      setStatus("Select a section first.");
      return;
    }
    setDialogMode("create");
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(row: SectionThroAssignment) {
    setSelectedId(row.id);
    setDialogMode("edit");
    setForm({
      name: row.name,
      title: row.title,
      effdate: row.effdate,
    });
    setDialogOpen(true);
  }

  function requestDelete(row: SectionThroAssignment) {
    setSelectedId(row.id);
    setConfirmDeleteOpen(true);
  }

  function openBatch() {
    if (!unitId) {
      setStatus("Select a unit first.");
      return;
    }
    setStatus(null);
    setBatchMode(true);
  }

  function cancelBatch() {
    setBatchMode(false);
    setBatchRows([]);
    setStatus(null);
  }

  function applyDateToAll(date: string) {
    setSharedDate(date);
    setBatchRows((prev) => prev.map((row) => ({ ...row, effdate: date })));
  }

  function updateBatchRow(
    sectionId: number,
    patch: Partial<Pick<BatchRow, "name" | "title" | "effdate">>,
  ) {
    setBatchRows((prev) =>
      prev.map((row) =>
        row.sectionId === sectionId ? { ...row, ...patch } : row,
      ),
    );
  }

  async function handleSave() {
    if (sectionId == null) return;
    setLoading(true);
    setStatus(null);
    try {
      const client = await createApiClient();
      const body = {
        sectionId,
        name: form.name.trim(),
        title: form.title.trim(),
        effdate: form.effdate,
      };
      const res =
        dialogMode === "create"
          ? await client["section-thro"].$post({ json: body })
          : await client["section-thro"][":id"].$put({
              param: { id: String(selectedId) },
              json: body,
            });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? `Save failed (${res.status})`);
      }
      setDialogOpen(false);
      await loadAssignments();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleBatchSave() {
    const rows = batchRows
      .filter((row) => row.name.trim())
      .map((row) => ({
        sectionId: row.sectionId,
        name: row.name.trim(),
        title: row.title.trim() || DEFAULT_TITLE,
        effdate: row.effdate,
      }));
    if (rows.length === 0) {
      setStatus("Enter at least one name to save.");
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const client = await createApiClient();
      const res = await client["section-thro"].batch.$post({ json: { rows } });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? `Save failed (${res.status})`);
      }
      setBatchMode(false);
      setBatchRows([]);
      setStatus(null);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (selectedId == null) return;
    setLoading(true);
    setStatus(null);
    try {
      const client = await createApiClient();
      const res = await client["section-thro"][":id"].$delete({
        param: { id: String(selectedId) },
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? `Delete failed (${res.status})`);
      }
      setConfirmDeleteOpen(false);
      await loadAssignments();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
      <h2 className="m-0 shrink-0 text-xl font-bold">Section Officers i/c</h2>

      <Toolbar>
        {batchMode ? (
          <Button
            type="button"
            size="sm"
            onClick={() => void handleBatchSave()}
            disabled={loading || batchRows.length === 0}
          >
            <Save className="size-4" />
            Save
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={openCreate}
            disabled={loading || sectionId == null}
          >
            <Plus className="size-4" />
            Add
          </Button>
        )}
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
        <CardContent className="grid gap-3 px-3 sm:grid-cols-3">
          <p className="text-sm text-muted-foreground sm:col-span-3">
            {batchMode
              ? "Enter a name, title, and effective date for each section in the unit. Rows without a name are skipped."
              : "Assign Section Officers i/c for each section, with an effective date."}
          </p>
          <div className="grid gap-1">
            <Label>Unit</Label>
            <Select
              value={unitId || "__all__"}
              onValueChange={(value) =>
                setUnitId(value === "__all__" ? "" : value)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All units" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__" disabled={batchMode}>
                  All units
                </SelectItem>
                {units
                  .filter((unit) => unit.active || unit.id === unitId)
                  .map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.unitName} {/* ({unit.id}) */}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          {batchMode ? (
            <div className="grid gap-1">
              <Label htmlFor="thro-batch-date">Apply date to all</Label>
              <Input
                id="thro-batch-date"
                type="date"
                value={sharedDate}
                onChange={(e) => applyDateToAll(e.target.value)}
              />
            </div>
          ) : (
            <div className="grid gap-1">
              <Label>Section</Label>
              <Select
                value={sectionId != null ? String(sectionId) : undefined}
                onValueChange={(value) => setSectionId(Number(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {sections
                    .filter(
                      (section) => section.active || section.id === sectionId,
                    )
                    .map((section) => (
                      <SelectItem key={section.id} value={String(section.id)}>
                        {section.section ?? `Section #${section.id}`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={batchMode}
              disabled={loading || !unitId}
              onChange={(e) => {
                if (e.target.checked) openBatch();
                else cancelBatch();
              }}
            />
            Batch entry
          </label>
        </CardContent>
      </Card>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-md border bg-background">
          {batchMode ? (
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted">
                <TableRow>
                  <TableHead>Section</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="w-44">Effective date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batchRows.map((row) => (
                  <TableRow key={row.sectionId} className="cursor-default">
                    <TableCell className="align-middle">
                      {row.sectionLabel}
                      {row.active ? "" : " (inactive)"}
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Input
                        value={row.name}
                        placeholder="Holder name"
                        onChange={(e) =>
                          updateBatchRow(row.sectionId, {
                            name: e.target.value,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Input
                        value={row.title}
                        placeholder={DEFAULT_TITLE}
                        onChange={(e) =>
                          updateBatchRow(row.sectionId, {
                            title: e.target.value,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Input
                        type="date"
                        value={row.effdate}
                        onChange={(e) =>
                          updateBatchRow(row.sectionId, {
                            effdate: e.target.value,
                          })
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {batchRows.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="px-3 py-6 text-center text-muted-foreground"
                    >
                      No sections found for this unit.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Effective date</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-default"
                    onDoubleClick={() => openEdit(row)}
                  >
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.title}</TableCell>
                    <TableCell>{formatDisplayDate(row.effdate)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Modify holder"
                          disabled={loading}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(row);
                          }}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Delete holder"
                          disabled={loading}
                          onClick={(e) => {
                            e.stopPropagation();
                            requestDelete(row);
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {assignments.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="px-3 py-6 text-center text-muted-foreground"
                    >
                      {sectionId == null
                        ? "Select a section to assign a Through holder."
                        : "No Through holders assigned for this section."}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          )}
        </div>

      {status ? (
        <Alert className="shrink-0">
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" ? "Add holder" : "Modify holder"}
              {selectedSection
                ? ` — ${selectedSection.section ?? `Section #${selectedSection.id}`}`
                : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label htmlFor="thro-name">Name</Label>
              <Input
                id="thro-name"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Holder name (for history)"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="thro-title">Title</Label>
              <Input
                id="thro-title"
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="e.g. Head of Section"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="thro-effdate">Effective date</Label>
              <Input
                id="thro-effdate"
                type="date"
                value={form.effdate}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, effdate: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={loading}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the holder record. Earlier dated assignments for the
              same section are kept.
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
    </section>
  );
}
