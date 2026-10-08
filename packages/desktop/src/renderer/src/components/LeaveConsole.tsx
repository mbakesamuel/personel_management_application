import type { User, WorkflowStatus } from "@personel-management-app/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { createApiClient } from "../api/client";
import {
  FormDialog,
  FormDialogActions,
  FormDialogError,
  FormDialogRow,
} from "./form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { LetterPdfOverlay } from "./LetterPdfOverlay";

type LeaveConsoleProps = {
  currentUser: User;
  onClose: () => void;
};

type LeaveType = { id: number; code: string; name: string; active: boolean };
type Attachment = { id: number; originalName: string };
type Calculation = {
  entitledDays: number | null;
  serviceYears: number | null;
  eligibleMonths: number | null;
  basicDays: number | null;
  seniorityDays: number | null;
  monthlyAccrual: number | null;
};
type LeaveRequest = {
  id: number;
  matricule: string;
  leaveType?: { name?: string };
  leaveTypeId: number;
  applicationDate: string;
  startDate: string;
  endDate: string | null;
  reason: string | null;
  workflowStatus: WorkflowStatus;
  attachments: Attachment[];
  calculations: Calculation[];
  grant: { grantedDays: number | null; expectedReturnDate: string } | null;
  resumptions: { id: number; actualReturnDate: string }[];
  memo: { id: number } | null;
};
type HistoryRow = {
  id: number;
  leaveType: string;
  leaveStartDate: string;
  leaveEndDate: string;
  resumedDate: string | null;
  daysGranted: number | null;
  leaveRequestId: number;
};

function day(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "—";
}

async function readError(res: Response, fallback: string) {
  const body = (await res.json().catch(() => null)) as {
    error?: string;
  } | null;
  return body?.error ?? fallback;
}

export function LeaveConsole({ currentUser, onClose }: LeaveConsoleProps) {
  const [matricule, setMatricule] = useState("");
  const [loadedMatricule, setLoadedMatricule] = useState("");
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    leaveTypeId: "",
    applicationDate: "",
    startDate: "",
    reason: "",
  });
  const [permissionBalance, setPermissionBalance] = useState<number | null>(
    null,
  );
  const [memoHtml, setMemoHtml] = useState<string | null>(null);
  const [review, setReview] = useState<"validate" | "reject" | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [memoRef, setMemoRef] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = requests.find((row) => row.id === selectedId) ?? null;
  const canReview = currentUser.permissions.canValidate;
  const snapshot = selected?.calculations[0];
  const editable =
    selected?.workflowStatus === "PENDING" ||
    selected?.workflowStatus === "REJECTED";

  const loadTypes = useCallback(async () => {
    const client = await createApiClient();
    const res = await client.leave.types.$get();
    if (res.ok) setTypes((await res.json()) as LeaveType[]);
  }, []);

  useEffect(() => {
    void loadTypes();
  }, [loadTypes]);

  const load = useCallback(async (target: string) => {
    const trimmed = target.trim();
    if (!trimmed) return;
    setLoading(true);
    setStatus(null);
    try {
      const client = await createApiClient();
      const [requestRes, historyRes, balanceRes] = await Promise.all([
        client.leave.requests.$get({ query: { matricule: trimmed } }),
        client.leave.history.$get({ query: { matricule: trimmed } }),
        client.permissions.account.$get({ query: { matricule: trimmed } }),
      ]);
      if (!requestRes.ok) {
        throw new Error(await readError(requestRes, "Failed to load leave"));
      }
      if (!historyRes.ok) {
        throw new Error(await readError(historyRes, "Failed to load history"));
      }
      const rows = (await requestRes.json()) as LeaveRequest[];
      setRequests(rows);
      setHistory((await historyRes.json()) as HistoryRow[]);
      if (balanceRes.ok) {
        const balance = (await balanceRes.json()) as { balanceDays: number };
        setPermissionBalance(balance.balanceDays);
      } else {
        setPermissionBalance(null);
      }
      setLoadedMatricule(trimmed);
      setSelectedId((prev) =>
        prev != null && rows.some((row) => row.id === prev)
          ? prev
          : (rows[0]?.id ?? null),
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  async function applyLeave() {
    if (!form.leaveTypeId || !form.applicationDate || !form.startDate) {
      setFormError("Type, application date, and start date are required");
      return;
    }
    setLoading(true);
    setFormError(null);
    try {
      const client = await createApiClient();
      const json = {
        leaveTypeId: Number(form.leaveTypeId),
        applicationDate: form.applicationDate,
        startDate: form.startDate,
        reason: form.reason.trim() || null,
      };
      const res =
        editingId == null
          ? await client.leave.requests.$post({
              json: { ...json, matricule: loadedMatricule },
            })
          : await client.leave.requests[":id"].$patch({
              param: { id: String(editingId) },
              json,
            });
      if (!res.ok) throw new Error(await readError(res, "Apply failed"));
      setApplyOpen(false);
      setEditingId(null);
      await load(loadedMatricule);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function blankForm() {
    setForm({
      leaveTypeId: "",
      applicationDate: "",
      startDate: "",
      reason: "",
    });
  }

  async function openMemo() {
    if (!selected) return;
    setLoading(true);
    setStatus(null);
    try {
      const client = await createApiClient();
      const res = await client.leave.requests[":id"].memo.$get({
        param: { id: String(selected.id) },
      });
      if (!res.ok) throw new Error(await readError(res, "Memo failed"));
      const body = (await res.json()) as { html: string };
      setMemoHtml(body.html);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function download(attachmentId: number, name: string) {
    if (!selected) return;
    setStatus(null);
    try {
      const config = await window.api.getServerConfig();
      if (!config.serverUrl) throw new Error("Server URL is not set");
      const headers: Record<string, string> = {
        "x-user-id": String(currentUser.id),
      };
      if (config.authToken)
        headers.Authorization = `Bearer ${config.authToken}`;
      const res = await fetch(
        `${config.serverUrl.replace(/\/$/, "")}/leave/requests/${selected.id}/attachments/${attachmentId}`,
        { headers },
      );
      if (!res.ok) throw new Error(await readError(res, "Download failed"));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  async function removeAttachment(attachmentId: number) {
    if (!selected) return;
    setLoading(true);
    setStatus(null);
    try {
      const client = await createApiClient();
      const res = await client.leave.requests[":id"].attachments[
        ":attachmentId"
      ].$delete({
        param: { id: String(selected.id), attachmentId: String(attachmentId) },
      });
      if (!res.ok) throw new Error(await readError(res, "Remove failed"));
      await load(loadedMatricule);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function calculate() {
    if (!selected) return;
    setLoading(true);
    setStatus(null);
    try {
      const client = await createApiClient();
      const res = await client.leave.requests[":id"].calculate.$post({
        param: { id: String(selected.id) },
      });
      if (!res.ok) throw new Error(await readError(res, "Calculation failed"));
      await load(loadedMatricule);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function confirmReview() {
    if (!selected || !review) return;
    setLoading(true);
    setStatus(null);
    try {
      const client = await createApiClient();
      const endpoint =
        review === "validate"
          ? client.leave.requests[":id"].validate
          : client.leave.requests[":id"].reject;
      const res = await endpoint.$post({
        param: { id: String(selected.id) },
        json:
          review === "validate"
            ? {
                reviewNote: reviewNote.trim() || undefined,
                memoRef: memoRef.trim(),
              }
            : { reviewNote: reviewNote.trim() || undefined },
      } as { param: { id: string } });
      if (!res.ok) throw new Error(await readError(res, "Review failed"));
      setReview(null);
      await load(loadedMatricule);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function upload(file: File) {
    if (!selected) return;
    setLoading(true);
    setStatus(null);
    try {
      const config = await window.api.getServerConfig();
      if (!config.serverUrl) throw new Error("Server URL is not set");
      const body = new FormData();
      body.append("file", file);
      const headers: Record<string, string> = {
        "x-user-id": String(currentUser.id),
      };
      if (config.authToken)
        headers.Authorization = `Bearer ${config.authToken}`;
      const res = await fetch(
        `${config.serverUrl.replace(/\/$/, "")}/leave/requests/${selected.id}/attachments`,
        { method: "POST", headers, body },
      );
      if (!res.ok) throw new Error(await readError(res, "Upload failed"));
      await load(loadedMatricule);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function resume() {
    if (!selected || !returnDate) return;
    setLoading(true);
    setStatus(null);
    try {
      const client = await createApiClient();
      const res = await client.leave.requests[":id"].resumption.$post({
        param: { id: String(selected.id) },
        json: { actualReturnDate: returnDate },
      });
      if (!res.ok) throw new Error(await readError(res, "Resumption failed"));
      setReturnDate("");
      await load(loadedMatricule);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Leave</h1>
          <p className="text-sm text-muted-foreground">
            Record leave applications, Process calculations for entitlements,
            Leave Approvals.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void load(matricule);
        }}
      >
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Matricule</span>
          <Input          
            value={matricule}
            onChange={(event) => setMatricule(event.target.value)}
            className="w-48 ml-2"
          />
        </label>
        <Button type="submit" disabled={loading || !matricule.trim()}>
          Load
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!loadedMatricule || loading}
          onClick={() => {
            setEditingId(null);
            blankForm();
            setFormError(null);
            setApplyOpen(true);
          }}
        >
          Apply leave
        </Button>
      </form>
      {status ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {status}
        </p>
      ) : null}

      <div className="overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Applied</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  {loadedMatricule
                    ? "No leave requests for this employee."
                    : "Enter a matricule and load leave."}
                </TableCell>
              </TableRow>
            ) : (
              requests.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    "cursor-pointer",
                    selectedId === row.id && "bg-muted",
                  )}
                  onClick={() => setSelectedId(row.id)}
                >
                  <TableCell>{row.leaveType?.name ?? "—"}</TableCell>
                  <TableCell>{day(row.applicationDate)}</TableCell>
                  <TableCell>{day(row.startDate)}</TableCell>
                  <TableCell>{day(row.endDate)}</TableCell>
                  <TableCell>
                    {row.calculations[0]?.entitledDays ?? "—"}
                  </TableCell>
                  <TableCell>{row.workflowStatus}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {selected ? (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loading || !editable}
                onClick={() => {
                  setEditingId(selected.id);
                  setForm({
                    leaveTypeId: String(selected.leaveTypeId),
                    applicationDate: day(selected.applicationDate),
                    startDate: day(selected.startDate),
                    reason: selected.reason ?? "",
                  });
                  setFormError(null);
                  setApplyOpen(true);
                }}
              >
                Change
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loading || !editable}
                onClick={() => void calculate()}
              >
                Calculate
              </Button>
              {canReview ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={loading || selected.workflowStatus !== "PENDING"}
                    onClick={() => {
                      setReviewNote("");
                      setMemoRef("");
                      setReview("validate");
                    }}
                  >
                    Validate
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={loading || selected.workflowStatus !== "PENDING"}
                    onClick={() => {
                      setReviewNote("");
                      setReview("reject");
                    }}
                  >
                    Reject
                  </Button>
                </>
              ) : null}
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void upload(file);
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loading || !editable}
                onClick={() => fileRef.current?.click()}
              >
                Attach
              </Button>
              {selected.memo ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={loading}
                  onClick={() => void openMemo()}
                >
                  Memo
                </Button>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              Permission days available: {permissionBalance ?? "—"}
            </p>
            {snapshot ? (
              <p className="text-sm text-muted-foreground">
                Service years {snapshot.serviceYears} · Eligible months{" "}
                {snapshot.eligibleMonths} · Basic {snapshot.basicDays} ·
                Seniority {snapshot.seniorityDays} · Monthly{" "}
                {snapshot.monthlyAccrual} · Due {snapshot.entitledDays}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No calculation yet. Calculate before validating.
              </p>
            )}
            <ul className="space-y-1 text-sm">
              {selected.attachments.length === 0 ? (
                <li className="text-muted-foreground">No documents.</li>
              ) : (
                selected.attachments.map((file) => (
                  <li key={file.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-left underline"
                      onClick={() => void download(file.id, file.originalName)}
                    >
                      {file.originalName}
                    </button>
                    {editable ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={() => void removeAttachment(file.id)}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
            {selected.grant ? (
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void resume();
                }}
              >
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Actual return</span>
                  <Input
                    type="date"
                    value={returnDate}
                    onChange={(event) => setReturnDate(event.target.value)}
                  />
                </label>
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    loading || !returnDate || selected.resumptions.length > 0
                  }
                >
                  Record resumption
                </Button>
              </form>
            ) : null}
          </section>
          <section className="space-y-2">
            <h2 className="text-sm font-medium">Leave history</h2>
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Resumed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">
                        No granted leave yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    history.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.leaveType}</TableCell>
                        <TableCell>{day(row.leaveStartDate)}</TableCell>
                        <TableCell>{day(row.leaveEndDate)}</TableCell>
                        <TableCell>{row.daysGranted ?? "—"}</TableCell>
                        <TableCell>{day(row.resumedDate)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
      ) : null}

      <FormDialog
        open={applyOpen}
        onOpenChange={(next) => {
          setApplyOpen(next);
          if (!next) setEditingId(null);
        }}
        title={editingId == null ? "Apply leave" : "Change leave"}
        subtitle={loadedMatricule}
      >
        <FormDialogError>{formError}</FormDialogError>
        <FormDialogRow label="Type" htmlFor="leave-apply-type">
          <Select
            value={form.leaveTypeId || undefined}
            onValueChange={(value) =>
              setForm((prev) => ({ ...prev, leaveTypeId: value }))
            }
          >
            <SelectTrigger id="leave-apply-type" className="w-full">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {types
                .filter((type) => type.active)
                .map((type) => (
                  <SelectItem key={type.id} value={String(type.id)}>
                    {type.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </FormDialogRow>
        <FormDialogRow label="Application date" htmlFor="leave-applied">
          <Input
            id="leave-applied"
            type="date"
            value={form.applicationDate}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                applicationDate: event.target.value,
              }))
            }
          />
        </FormDialogRow>
        <FormDialogRow label="Start" htmlFor="leave-start">
          <Input
            id="leave-start"
            type="date"
            value={form.startDate}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, startDate: event.target.value }))
            }
          />
        </FormDialogRow>
        <FormDialogRow label="Reason" htmlFor="leave-reason">
          <Textarea
            id="leave-reason"
            rows={3}
            value={form.reason}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, reason: event.target.value }))
            }
          />
        </FormDialogRow>
        <FormDialogActions
          primaryLabel={loading ? "Saving…" : "Save"}
          onPrimary={() => void applyLeave()}
          onCancel={() => {
            setApplyOpen(false);
            setEditingId(null);
          }}
          primaryDisabled={loading}
          cancelDisabled={loading}
        />
      </FormDialog>

      <FormDialog
        open={review != null}
        onOpenChange={(next) => {
          if (!next) setReview(null);
        }}
        title={review === "validate" ? "Validate leave" : "Reject leave"}
      >
        {review === "validate" ? (
          <FormDialogRow label="File reference" htmlFor="leave-memo-ref">
            <Input
              id="leave-memo-ref"
              value={memoRef}
              placeholder="IS/302"
              onChange={(event) => setMemoRef(event.target.value)}
            />
          </FormDialogRow>
        ) : null}
        <FormDialogRow label="Review note" htmlFor="leave-review">
          <Textarea
            id="leave-review"
            rows={3}
            value={reviewNote}
            onChange={(event) => setReviewNote(event.target.value)}
          />
        </FormDialogRow>
        <FormDialogActions
          primaryLabel={
            loading ? "Working…" : review === "validate" ? "Validate" : "Reject"
          }
          onPrimary={() => void confirmReview()}
          onCancel={() => setReview(null)}
          primaryDisabled={
            loading || (review === "validate" && !memoRef.trim())
          }
          cancelDisabled={loading}
        />
      </FormDialog>
      {memoHtml ? (
        <LetterPdfOverlay
          html={memoHtml}
          title="Leave memo"
          onClose={() => setMemoHtml(null)}
        />
      ) : null}
    </div>
  );
}
