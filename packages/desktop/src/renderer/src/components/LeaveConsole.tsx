import {
  isAnnualLeaveType,
  isAnnualLeaveTypeName,
  leaveMemoFileRef,
  parseCatEchCode,
  type User,
  type WorkflowStatus,
} from "@personel-management-app/shared";
import { Download, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createApiClient } from "../api/client";
import { formatDisplayDate } from "../lib/format-date";
import {
  FormDialog,
  FormDialogActions,
  FormDialogError,
  FormDialogRow,
} from "./form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  initialMatricule?: string | null;
  onShowLeaveDue?: () => void;
  onClose: () => void;
};

type DocumentRequirement = { id: number; name: string; sortOrder: number };
type LeaveType = {
  id: number;
  code: string;
  name: string;
  active: boolean;
  category?: "LEAVE" | "PERMISSION";
  isPaid?: boolean;
  deductBalance?: boolean;
  maxDays?: number | null;
  durationUnit?: "WORKING_DAYS" | "CALENDAR_WEEKS";
  documentRequirements?: DocumentRequirement[];
};
type Attachment = {
  id: number;
  originalName: string;
  requirementId: number | null;
};
type Calculation = {
  entitledDays: number | null;
  mothersLeaveDays: number | null;
  qualifyingChildCount: number | null;
  serviceYears: number | null;
  eligibleMonths: number | null;
  basicDays: number | null;
  seniorityDays: number | null;
  monthlyAccrual: number | null;
};

function combinedDue(snapshot: Calculation | undefined) {
  if (!snapshot || snapshot.entitledDays == null) return null;
  return snapshot.entitledDays + (snapshot.mothersLeaveDays ?? 0);
}

function durationLabel(
  type:
    | {
        maxDays?: number | null;
        durationUnit?: string;
      }
    | undefined,
) {
  if (!type || type.maxDays == null) return "—";
  if (type.durationUnit === "CALENDAR_WEEKS") return `${type.maxDays} weeks`;
  return `${type.maxDays} days`;
}
type LeaveRequest = {
  id: number;
  matricule: string;
  leaveType?: {
    name?: string;
    deductBalance?: boolean;
    maxDays?: number | null;
    durationUnit?: "WORKING_DAYS" | "CALENDAR_WEEKS";
    documentRequirements?: DocumentRequirement[];
  };
  leaveTypeId: number;
  applicationDate: string;
  startDate: string;
  endDate: string | null;
  reason: string | null;
  suppliedResumedDate: string | null;
  workflowStatus: WorkflowStatus;
  attachments: Attachment[];
  calculations: Calculation[];
  grant: { grantedDays: number | null; expectedReturnDate: string } | null;
  resumptions: { id: number; actualReturnDate: string }[];
  memo: { id: number } | null;
};
type LeaveEmployee = {
  name: string;
  designation: string | null;
  category: string | null;
  unitName: string | null;
  groupName: string | null;
  dateEng: string | null;
  lastLeaveDate: string | null;
  lastResumedDate: string | null;
  accrualBalance: number;
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
  return formatDisplayDate(value) || "—";
}

const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
};

function imageType(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_TYPES[ext] ?? null;
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

async function readError(res: Response, fallback: string) {
  const body = (await res.json().catch(() => null)) as {
    error?: string;
  } | null;
  return body?.error ?? fallback;
}

export function LeaveConsole({
  currentUser,
  initialMatricule,
  onShowLeaveDue,
  onClose,
}: LeaveConsoleProps) {
  const [matricule, setMatricule] = useState("");
  const [loadedMatricule, setLoadedMatricule] = useState("");
  const [employee, setEmployee] = useState<LeaveEmployee | null>(null);
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
    suppliedResumedDate: "",
  });
  const [supplyLastResumption, setSupplyLastResumption] = useState(false);
  const [permissionBalance, setPermissionBalance] = useState<number | null>(
    null,
  );
  const [memoHtml, setMemoHtml] = useState<string | null>(null);
  const [calculationReportHtml, setCalculationReportHtml] = useState<
    string | null
  >(null);
  const [review, setReview] = useState<"validate" | "reject" | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [daysToGrant, setDaysToGrant] = useState("");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustBalance, setAdjustBalance] = useState("");
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [returnDate, setReturnDate] = useState("");
  const [preview, setPreview] = useState<{ name: string; url: string } | null>(
    null,
  );
  const [previewError, setPreviewError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const requirementTarget = useRef<number | null>(null);
  const previewUrl = useRef<string | null>(null);

  const selected = requests.find((row) => row.id === selectedId) ?? null;
  const annualLeave = isAnnualLeaveType(selected?.leaveType);
  const canReview = currentUser.permissions.canLeaveValidate;
  const snapshot = selected?.calculations[0];
  const categoryNum =
    employee?.category != null
      ? parseCatEchCode(employee.category).catNum
      : 0;
  const category9 = categoryNum >= 9;
  const annualMemoFileRef = leaveMemoFileRef("ANNUAL_LEAVE", categoryNum);
  const earnedPreview =
    snapshot?.entitledDays != null
      ? Math.ceil(Number(snapshot.entitledDays))
      : 0;
  const mothersPreview = snapshot?.mothersLeaveDays ?? 0;
  const lastTourPreview = category9 ? (employee?.accrualBalance ?? 0) : 0;
  const grossPreview = earnedPreview + mothersPreview + lastTourPreview;
  const permissionPreview = Math.min(permissionBalance ?? 0, grossPreview);
  const netDuePreview = grossPreview - permissionPreview;
  const grantPreview = Number(daysToGrant);
  const thisTourPreview =
    Number.isInteger(grantPreview) &&
    grantPreview >= 1 &&
    grantPreview <= netDuePreview
      ? netDuePreview - grantPreview
      : null;
  const editable =
    selected?.workflowStatus === "PENDING" ||
    selected?.workflowStatus === "REJECTED";

  const loadTypes = useCallback(async () => {
    const client = await createApiClient();
    const [res, settingRes] = await Promise.all([
      client.leave.types.$get(),
      client.leave["processing-settings"].$get(),
    ]);
    if (res.ok) setTypes((await res.json()) as LeaveType[]);
    if (settingRes.ok) {
      const setting = (await settingRes.json()) as {
        userSupplyLastResumption: boolean;
      };
      setSupplyLastResumption(setting.userSupplyLastResumption);
    }
  }, []);

  useEffect(() => {
    void loadTypes();
  }, [loadTypes]);

  const load = useCallback(async (target: string) => {
    const trimmed = target.trim();
    if (!trimmed) return;
    setLoading(true);
    setStatus(null);
    setEmployee(null);
    try {
      const client = await createApiClient();
      const [requestRes, historyRes, balanceRes, employeeRes] =
        await Promise.all([
          client.leave.requests.$get({ query: { matricule: trimmed } }),
          client.leave.history.$get({ query: { matricule: trimmed } }),
          client.permissions.account.$get({ query: { matricule: trimmed } }),
          client.leave.employee.$get({ query: { matricule: trimmed } }),
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
      setEmployee(
        employeeRes.ok ? ((await employeeRes.json()) as LeaveEmployee) : null,
      );
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

  useEffect(() => {
    if (!initialMatricule) return;
    setMatricule(initialMatricule);
    void load(initialMatricule);
  }, [initialMatricule, load]);

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
        ...(supplyLastResumption
          ? { suppliedResumedDate: form.suppliedResumedDate || null }
          : {}),
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
      suppliedResumedDate: "",
    });
  }

  async function openCalculationReport() {
    if (!selected) return;
    setLoading(true);
    setStatus(null);
    try {
      const client = await createApiClient();
      const res = await client.leave.requests[":id"]["calculation-report"].$get(
        {
          param: { id: String(selected.id) },
        },
      );
      if (!res.ok) {
        throw new Error(await readError(res, "Calculation report failed"));
      }
      const body = (await res.json()) as { html: string };
      setCalculationReportHtml(body.html);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
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

  const closePreview = useCallback(() => {
    if (previewUrl.current) {
      URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = null;
    }
    setPreview(null);
    setPreviewError(false);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
  }, []);

  useEffect(() => {
    if (!preview) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      closePreview();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview, closePreview]);

  function showPreview(name: string, url: string) {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = url;
    setPreviewError(false);
    setPreview({ name, url });
  }

  async function fetchAttachment(attachmentId: number) {
    if (!selected) throw new Error("No leave selected");
    const config = await window.api.getServerConfig();
    if (!config.serverUrl) throw new Error("Server URL is not set");
    const headers: Record<string, string> = {
      "x-user-id": String(currentUser.id),
    };
    if (config.authToken) headers.Authorization = `Bearer ${config.authToken}`;
    const res = await fetch(
      `${config.serverUrl.replace(/\/$/, "")}/leave/requests/${selected.id}/attachments/${attachmentId}`,
      { headers },
    );
    if (!res.ok) throw new Error(await readError(res, "Download failed"));
    return res.blob();
  }

  async function openAttachment(file: Attachment) {
    if (!selected) return;
    setStatus(null);
    try {
      const blob = await fetchAttachment(file.id);
      const type = imageType(file.originalName);
      if (type) {
        const image = new Blob([await blob.arrayBuffer()], { type });
        showPreview(file.originalName, URL.createObjectURL(image));
        return;
      }
      saveBlob(blob, file.originalName);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  function downloadPreview() {
    if (!preview) return;
    const link = document.createElement("a");
    link.href = preview.url;
    link.download = preview.name;
    link.click();
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
            ? annualLeave
              ? {
                  reviewNote: reviewNote.trim() || undefined,
                  memoRef: annualMemoFileRef ?? "",
                  ...(category9 && daysToGrant.trim()
                    ? { daysToGrant: Number(daysToGrant) }
                    : {}),
                }
              : { reviewNote: reviewNote.trim() || undefined }
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

  async function saveAccrual() {
    const balanceDays = Number(adjustBalance);
    if (!Number.isInteger(balanceDays) || balanceDays < 0) {
      setAdjustError("Enter a whole number of days");
      return;
    }
    setLoading(true);
    setAdjustError(null);
    try {
      const client = await createApiClient();
      const res = await client.leave["accrual-account"].$post({
        json: { matricule: loadedMatricule, balanceDays },
      });
      if (!res.ok) throw new Error(await readError(res, "Adjustment failed"));
      setAdjustOpen(false);
      await load(loadedMatricule);
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function pickFile(requirementId: number | null) {
    requirementTarget.current = requirementId;
    fileRef.current?.click();
  }

  async function upload(file: File, requirementId: number | null) {
    if (!selected) return;
    setLoading(true);
    setStatus(null);
    try {
      const config = await window.api.getServerConfig();
      if (!config.serverUrl) throw new Error("Server URL is not set");
      const body = new FormData();
      body.append("file", file);
      if (requirementId != null) {
        body.append("requirementId", String(requirementId));
      }
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
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-4 overflow-hidden p-4">
        <div className="flex shrink-0 items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Leave requests</h1>
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
          className="flex shrink-0 flex-wrap items-end gap-2"
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
            Register Application
          </Button>
          {onShowLeaveDue ? (
            <Button type="button" variant="outline" onClick={onShowLeaveDue}>
              Leave due
            </Button>
          ) : null}
        </form>
        {employee ? (
          <Card className="shrink-0 gap-0 py-4">
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    { label: "Name", value: employee.name },
                    { label: "Designation", value: employee.designation },
                    { label: "Category", value: employee.category },
                    { label: "Unit", value: employee.unitName },
                    { label: "Group", value: employee.groupName },
                    {
                      label: "Date of engagement",
                      value: day(employee.dateEng),
                    },
                    {
                      label: "Last leave date",
                      value: day(employee.lastLeaveDate),
                    },
                    {
                      label: "Last resumed date",
                      value: day(employee.lastResumedDate),
                    },
                  ] as const
                ).map((item, index) => (
                  <div
                    key={item.label}
                    className={cn(
                      "rounded-lg px-3 py-2",
                      index % 2 === 0 ? "bg-primary/10" : "bg-accent/20",
                    )}
                  >
                    <div className="text-xs text-muted-foreground">
                      {item.label}
                    </div>
                    <div className="text-sm font-semibold">
                      {item.value?.trim() ? item.value : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
        {status ? (
          <p className="shrink-0 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {status}
          </p>
        ) : null}

        <div className="max-h-80 w-full min-w-0 shrink-0 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Leave Type</TableHead>
                <TableHead>Applied on</TableHead>
                <TableHead>To start on</TableHead>
                <TableHead>Ends on</TableHead>
                <TableHead>Days Due</TableHead>
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
                      {isAnnualLeaveType(row.leaveType)
                        ? (combinedDue(row.calculations[0]) ?? "—")
                        : durationLabel(row.leaveType)}
                    </TableCell>
                    <TableCell>{row.workflowStatus}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {selected ? (
          <div className="grid min-h-0 w-full min-w-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-4 overflow-hidden md:grid-cols-2 md:grid-rows-[minmax(0,1fr)]">
            <section className="min-h-0 min-w-0 space-y-2 overflow-auto">
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
                      applicationDate: selected.applicationDate.slice(0, 10),
                      startDate: selected.startDate.slice(0, 10),
                      reason: selected.reason ?? "",
                      suppliedResumedDate: selected.suppliedResumedDate
                        ? selected.suppliedResumedDate.slice(0, 10)
                        : "",
                    });
                    setFormError(null);
                    setApplyOpen(true);
                  }}
                >
                  Edit Line
                </Button>
                {annualLeave ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={loading || !editable}
                    onClick={() => void calculate()}
                  >
                    Process Calculation
                  </Button>
                ) : null}
                {annualLeave && snapshot ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={loading}
                    onClick={() => void openCalculationReport()}
                  >
                    Calculation report
                  </Button>
                ) : null}
                {canReview ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        loading || selected.workflowStatus !== "PENDING"
                      }
                      onClick={() => {
                        setReviewNote("");
                        setDaysToGrant(
                          netDuePreview > 0 ? String(netDuePreview) : "",
                        );
                        setReview("validate");
                      }}
                    >
                      Validate
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        loading || selected.workflowStatus !== "PENDING"
                      }
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
                    const requirementId = requirementTarget.current;
                    requirementTarget.current = null;
                    event.target.value = "";
                    if (file) void upload(file, requirementId);
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={loading || !editable}
                  onClick={() => pickFile(null)}
                >
                  Attach other document
                </Button>
                {selected.memo ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={loading}
                    onClick={() => void openMemo()}
                  >
                    Preview Memo
                  </Button>
                ) : null}
              </div>
              <h1 className="text-sm font-medium text-underline">
                Leave Processing Summary
              </h1>
              <p className="text-sm text-muted-foreground mt-4">
                Outsanding Permission Days: {permissionBalance ?? "—"}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>Leave accrued: {employee?.accrualBalance ?? 0}</span>
                {category9 && canReview ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={loading}
                    onClick={() => {
                      setAdjustBalance(String(employee?.accrualBalance ?? 0));
                      setAdjustError(null);
                      setAdjustOpen(true);
                    }}
                  >
                    Adjust
                  </Button>
                ) : null}
              </div>
              {annualLeave && snapshot ? (
                <Card className="gap-0 py-4">
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {(
                        [
                          {
                            label: "Length of service",
                            value: `${snapshot.serviceYears} years`,
                          },
                          {
                            label: "Eligible months",
                            value: snapshot.eligibleMonths,
                          },
                          { label: "Basic Days", value: snapshot.basicDays },
                          {
                            label: "Seniority Days",
                            value: snapshot.seniorityDays,
                          },
                          {
                            label: "Monthly Accrual",
                            value: snapshot.monthlyAccrual,
                          },
                          { label: "Earned", value: snapshot.entitledDays },
                          {
                            label: "Mother's leave",
                            value: `${snapshot.mothersLeaveDays ?? 0} (${snapshot.qualifyingChildCount ?? 0} children)`,
                          },
                          {
                            label: "Leave Days Due",
                            value: combinedDue(snapshot),
                            due: true,
                          },
                        ] as const
                      ).map((item, index) => (
                        <div
                          key={item.label}
                          className={cn(
                            "rounded-lg px-3 py-2",
                            "due" in item && item.due
                              ? "bg-primary text-primary-foreground"
                              : index % 2 === 0
                                ? "bg-primary/10"
                                : "bg-accent/20",
                          )}
                        >
                          <div
                            className={cn(
                              "text-xs",
                              "due" in item && item.due
                                ? "text-primary-foreground/80"
                                : "text-muted-foreground",
                            )}
                          >
                            {item.label}
                          </div>
                          <div className="text-sm font-semibold">
                            {item.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : annualLeave ? (
                <p className="text-sm text-muted-foreground">
                  No calculation yet. Calculate before validating.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Fixed duration: {durationLabel(selected.leaveType)}.
                  Validating writes the end date and does not change leave
                  balances.
                  {selected.leaveType?.durationUnit === "CALENDAR_WEEKS"
                    ? " Counted in calendar weeks, including weekends and public holidays."
                    : " Working days skip weekends and public holidays."}
                </p>
              )}
              <h2 className="text-sm font-medium">
                Attachments/Supporting Documents
              </h2>
              {(selected.leaveType?.documentRequirements ?? []).map(
                (requirement) => {
                  const files = selected.attachments.filter(
                    (file) => file.requirementId === requirement.id,
                  );
                  return (
                    <div
                      key={requirement.id}
                      className="space-y-1 rounded-md border px-3 py-2"
                    >
                      <div className="text-sm font-medium">
                        {requirement.name}
                      </div>
                      {files.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Required
                        </p>
                      ) : (
                        <ul className="space-y-1 text-sm">
                          {files.map((file) => (
                            <li
                              key={file.id}
                              className="flex items-center gap-2"
                            >
                              <button
                                type="button"
                                className="text-left underline"
                                onClick={() => void openAttachment(file)}
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
                          ))}
                        </ul>
                      )}
                      {editable ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={loading}
                          onClick={() => pickFile(requirement.id)}
                        >
                          Attach
                        </Button>
                      ) : null}
                    </div>
                  );
                },
              )}
              <ul className="space-y-1 text-sm">
                {selected.attachments.filter(
                  (file) => file.requirementId == null,
                ).length === 0 ? (
                  <li className="text-muted-foreground">No other documents.</li>
                ) : (
                  selected.attachments
                    .filter((file) => file.requirementId == null)
                    .map((file) => (
                      <li key={file.id} className="flex items-center gap-2">
                        <button
                          type="button"
                          className="text-left underline"
                          onClick={() => void openAttachment(file)}
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
                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">
                      Actual return date
                    </span>
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
            <section className="flex min-h-0 min-w-0 flex-col gap-2">
              <h2 className="shrink-0 text-sm font-medium">Leave history</h2>
              <div className="max-h-80 w-full min-w-0 shrink-0 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>To Start on</TableHead>
                      <TableHead>Ends on</TableHead>
                      <TableHead>No. Of Days</TableHead>
                      <TableHead>Date Resumed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-muted-foreground"
                        >
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
          title={editingId == null ? "Register Leave" : "Change leave"}
          subtitle={
            employee?.name
              ? `${loadedMatricule} — ${employee.name}`
              : loadedMatricule
          }
          wide
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
                  .filter(
                    (type) => type.active && type.category !== "PERMISSION",
                  )
                  .map((type) => (
                    <SelectItem key={type.id} value={String(type.id)}>
                      {type.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </FormDialogRow>
          {isAnnualLeaveTypeName(
            types.find((type) => String(type.id) === form.leaveTypeId)?.name,
          ) ? (
            <div className="mb-2 space-y-2">
              <p className="text-sm font-medium">Leave Applied for:</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-primary/10 px-3 py-2">
                  <div className="text-xs text-muted-foreground">From</div>
                  <div className="text-sm font-semibold">
                    {day(
                      employee?.lastLeaveDate ??
                        (supplyLastResumption && form.suppliedResumedDate
                          ? form.suppliedResumedDate
                          : employee?.dateEng),
                    )}
                  </div>
                </div>
                <div className="rounded-lg bg-accent/20 px-3 py-2">
                  <div className="text-xs text-muted-foreground">To</div>
                  <div className="text-sm font-semibold">
                    {day(form.applicationDate)}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
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

          {supplyLastResumption ? (
            <FormDialogRow label="Last resump. date" htmlFor="leave-resumed">
              <Input
                id="leave-resumed"
                type="date"
                value={form.suppliedResumedDate}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    suppliedResumedDate: event.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Use this when the employee has no leave history yet. Leave it
                blank to start from the engagement date.
              </p>
            </FormDialogRow>
          ) : null}
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

          {(
            types.find((type) => String(type.id) === form.leaveTypeId)
              ?.documentRequirements ?? []
          ).length > 0 ? (
            <div className="space-y-1 text-sm">
              <p className="font-medium">Compulsory supporting documents</p>
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                {types
                  .find((type) => String(type.id) === form.leaveTypeId)
                  ?.documentRequirements?.map((requirement) => (
                    <li key={requirement.id}>{requirement.name}</li>
                  ))}
              </ol>
              <p>
                Attach each document on the saved request before it can be
                validated.
              </p>
            </div>
          ) : null}
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
          {review === "validate" && annualLeave ? (
            <FormDialogRow label="File reference">
              <p className="pt-2 text-sm font-medium">
                {annualMemoFileRef ?? "No file reference for this category"}
              </p>
            </FormDialogRow>
          ) : null}
          {review === "validate" && annualLeave && category9 ? (
            <>
              <p className="text-sm text-muted-foreground">
                Accrued last tour: {lastTourPreview}. Leave due after
                permissions: {netDuePreview}. Accrued this tour:{" "}
                {thisTourPreview ?? "—"}.
              </p>
              <FormDialogRow
                label="Days to grant now"
                htmlFor="leave-days-grant"
              >
                <Input
                  id="leave-days-grant"
                  type="number"
                  min={1}
                  max={netDuePreview}
                  value={daysToGrant}
                  onChange={(event) => setDaysToGrant(event.target.value)}
                />
              </FormDialogRow>
            </>
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
              loading
                ? "Working…"
                : review === "validate"
                  ? "Validate"
                  : "Reject"
            }
            onPrimary={() => void confirmReview()}
            onCancel={() => setReview(null)}
            primaryDisabled={
              loading ||
              (review === "validate" && annualLeave && !annualMemoFileRef) ||
              (review === "validate" &&
                annualLeave &&
                category9 &&
                thisTourPreview == null)
            }
            cancelDisabled={loading}
          />
        </FormDialog>

        <FormDialog
          open={adjustOpen}
          onOpenChange={setAdjustOpen}
          title="Accrued leave"
          subtitle={
            employee?.name
              ? `${loadedMatricule} — ${employee.name}`
              : loadedMatricule
          }
        >
          <FormDialogError>{adjustError}</FormDialogError>
          <FormDialogRow label="Balance days" htmlFor="leave-accrual-balance">
            <Input
              id="leave-accrual-balance"
              type="number"
              min={0}
              value={adjustBalance}
              onChange={(event) => setAdjustBalance(event.target.value)}
            />
          </FormDialogRow>
          <FormDialogActions
            primaryLabel={loading ? "Saving…" : "Save"}
            onPrimary={() => void saveAccrual()}
            onCancel={() => setAdjustOpen(false)}
            primaryDisabled={loading || adjustBalance.trim() === ""}
            cancelDisabled={loading}
          />
        </FormDialog>
      </div>
      {preview ? (
        <div className="absolute inset-0 z-20 flex flex-col bg-background p-3">
          <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
            <h2 className="m-0 truncate text-lg font-semibold">
              {preview.name}
            </h2>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={downloadPreview}>
                <Download className="size-4" />
                Download
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={closePreview}
              >
                <X className="size-4" />
                Close
              </Button>
            </div>
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden bg-muted/40">
            {previewError ? (
              <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
                This image could not be displayed. Download it instead.
              </p>
            ) : (
              <img
                src={preview.url}
                alt={preview.name}
                className="absolute inset-0 h-full w-full object-contain"
                onError={() => setPreviewError(true)}
              />
            )}
          </div>
        </div>
      ) : null}
      {memoHtml ? (
        <LetterPdfOverlay
          html={memoHtml}
          title="Leave memo"
          onClose={() => setMemoHtml(null)}
        />
      ) : null}
      {calculationReportHtml ? (
        <LetterPdfOverlay
          html={calculationReportHtml}
          title="Leave calculation"
          onClose={() => setCalculationReportHtml(null)}
        />
      ) : null}
    </div>
  );
}
