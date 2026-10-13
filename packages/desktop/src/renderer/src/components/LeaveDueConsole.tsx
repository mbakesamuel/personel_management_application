import { useCallback, useEffect, useRef, useState } from "react";
import type {
  GroupOption,
  LeaveDueRow,
  UnitOption,
  ZoneOption,
} from "@personel-management-app/shared";
import { createApiClient } from "../api/client";
import { formatDisplayDate } from "../lib/format-date";
import { Button } from "@/components/ui/button";
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

type LeaveDueConsoleProps = {
  onClose: () => void;
  onOpenLeave?: (matricule: string) => void;
};

function durationLabel(years: number, months: number): string {
  const yearPart = years === 1 ? "1 year" : `${years} years`;
  const monthPart = months === 1 ? "1 month" : `${months} months`;
  if (years === 0) return monthPart;
  if (months === 0) return yearPart;
  return `${yearPart} ${monthPart}`;
}

function day(value: string | null | undefined) {
  return formatDisplayDate(value) || "—";
}

async function readError(res: Response, fallback: string) {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}

export function LeaveDueConsole({ onClose, onOpenLeave }: LeaveDueConsoleProps) {
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [groupId, setGroupId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [matricule, setMatricule] = useState("");
  const [rows, setRows] = useState<LeaveDueRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const requestId = useRef(0);

  const zonesForGroup = zones.filter(
    (zone) => zone.active && (!groupId || zone.groupId === groupId),
  );
  const unitsForFilter = units.filter(
    (unit) =>
      (unit.active || unit.id === unitId) &&
      (!groupId || unit.groupId === groupId) &&
      (!zoneId || unit.zoneId === zoneId),
  );

  useEffect(() => {
    void (async () => {
      const client = await createApiClient();
      const [groupRes, zoneRes, unitRes] = await Promise.all([
        client.organization.groups.$get(),
        client.organization.zones.$get({ query: {} }),
        client.organization.units.$get(),
      ]);
      if (groupRes.ok) setGroups(await groupRes.json());
      if (zoneRes.ok) setZones(await zoneRes.json());
      if (unitRes.ok) setUnits(await unitRes.json());
    })();
  }, []);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setStatus(null);
    try {
      const client = await createApiClient();
      const query: {
        groupId?: string;
        zoneId?: string;
        unitId?: string;
        matricule?: string;
      } = {};
      if (groupId) query.groupId = groupId;
      if (zoneId) query.zoneId = zoneId;
      if (unitId) query.unitId = unitId;
      const trimmed = matricule.trim();
      if (trimmed) query.matricule = trimmed;
      const res = await client.leave.due.$get({ query });
      if (!res.ok) throw new Error(await readError(res, "Failed to load leave due"));
      const next = (await res.json()) as LeaveDueRow[];
      if (id !== requestId.current) return;
      setRows(next);
      setLoaded(true);
    } catch (err) {
      if (id !== requestId.current) return;
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [groupId, zoneId, unitId, matricule]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Leave due</h1>
          <p className="text-sm text-muted-foreground">
            Employees in your jurisdiction with at least one year of annual
            leave due, as of today. Twelve completed months count as one year.
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
          void load();
        }}
      >
        <div className="grid gap-1">
          <Label>Group</Label>
          <Select
            value={groupId || "__all__"}
            onValueChange={(value) => {
              const next = value === "__all__" ? "" : value;
              setGroupId(next);
              setZoneId("");
              setUnitId("");
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All groups" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All groups</SelectItem>
              {groups
                .filter((group) => group.active || group.id === groupId)
                .map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.groupName}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label>Zone</Label>
          <Select
            value={zoneId || "__all__"}
            onValueChange={(value) => {
              setZoneId(value === "__all__" ? "" : value);
              setUnitId("");
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All zones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All zones</SelectItem>
              {zonesForGroup.map((zone) => (
                <SelectItem key={zone.id} value={zone.id}>
                  {zone.zoneName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label>Unit</Label>
          <Select
            value={unitId || "__all__"}
            onValueChange={(value) => setUnitId(value === "__all__" ? "" : value)}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All units" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All units</SelectItem>
              {unitsForFilter.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.unitName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Matricule</span>
          <Input
            value={matricule}
            onChange={(event) => setMatricule(event.target.value)}
            className="w-40"
            placeholder="Search"
          />
        </label>
        <Button type="submit" disabled={loading}>
          Refresh
        </Button>
      </form>

      {status ? (
        <p className="shrink-0 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {status}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            <TableRow>
              <TableHead>Matricule</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Zone</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Last return</TableHead>
              <TableHead>Accrual from</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Earned days</TableHead>
              <TableHead>Application</TableHead>
              <TableHead className="w-24 text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.matricule}>
                <TableCell>{row.matricule}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.designation || "—"}</TableCell>
                <TableCell>{row.category || "—"}</TableCell>
                <TableCell>{row.groupName || "—"}</TableCell>
                <TableCell>{row.zoneName || "—"}</TableCell>
                <TableCell>{row.unitName || "—"}</TableCell>
                <TableCell>{day(row.lastReturnDate)}</TableCell>
                <TableCell>{day(row.accrualStartDate)}</TableCell>
                <TableCell>
                  {durationLabel(row.durationYears, row.durationMonths)}
                </TableCell>
                <TableCell>
                  {row.earnedDays == null ? "—" : row.earnedDays}
                </TableCell>
                <TableCell>{row.application ?? "—"}</TableCell>
                <TableCell className="text-right">
                  {onOpenLeave ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenLeave(row.matricule)}
                    >
                      Open
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
            {loaded && rows.length === 0 && !loading ? (
              <TableRow>
                <TableCell
                  colSpan={13}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  No employees have completed a year of leave accrual in this
                  scope.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
