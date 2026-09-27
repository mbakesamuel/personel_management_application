import type { User } from "@personel-management-app/shared";
import {
  fallbackLabelForRole,
  fallbackScopeForRole,
  isScopeKind,
  SCOPE_KIND_RANK,
  type Role,
  type RoleDefinition,
  type ScopeKind,
  type GroupOption,
  type SectionOption,
  type UnitOption,
  type ZoneOption,
} from "@personel-management-app/shared";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createApiClient } from "../api/client";
import {
  FormDialog,
  FormDialogActions,
  FormDialogError,
  FormDialogHint,
  FormDialogRow,
} from "./form-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Toolbar } from "@/components/ui/toolbar";
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

type UsersConsoleProps = {
  currentUser: User;
  onClose: () => void;
};

type FormState = {
  username: string;
  password: string;
  role: Role;
  groupId: string;
  zoneId: string;
  unitId: string;
  sectionId: string;
};

const emptyForm = (): FormState => ({
  username: "",
  password: "",
  role: "SECRETARY",
  groupId: "",
  zoneId: "",
  unitId: "",
  sectionId: "",
});

function scopeKindFor(
  role: Role,
  roles: RoleDefinition[],
): ScopeKind {
  const def = roles.find((r) => r.code === role)
  if (def?.scopeKind) return def.scopeKind
  const code = def?.jurisdiction ?? fallbackScopeForRole(role)
  return isScopeKind(code) ? code : "section";
}

function rankForJurisdiction(code: string): number {
  return isScopeKind(code) ? SCOPE_KIND_RANK[code] : SCOPE_KIND_RANK.section;
}

function labelFor(role: Role, roles: RoleDefinition[]): string {
  return (
    roles.find((r) => r.code === role)?.label ?? fallbackLabelForRole(role)
  );
}

function assignableRoles(
  roles: RoleDefinition[],
  actorJurisdiction: string,
): RoleDefinition[] {
  const maxRank = rankForJurisdiction(actorJurisdiction);
  return roles.filter(
    (role) => rankForJurisdiction(role.jurisdiction) <= maxRank,
  );
}

function scopeLabel(
  user: User,
  roles: RoleDefinition[],
  groups: GroupOption[],
  zones: ZoneOption[],
  units: UnitOption[],
  sections: SectionOption[],
): string {
  const scope = isScopeKind(user.jurisdiction)
    ? user.jurisdiction
    : scopeKindFor(user.role, roles);
  if (scope === "all") return "All";
  if (scope === "group") {
    const g = groups.find((x) => x.id === user.groupId);
    return g?.groupName ?? user.groupId ?? "—";
  }
  if (scope === "zone") {
    const z = zones.find((x) => x.id === user.zoneId);
    return z?.zoneName ?? user.zoneId ?? "—";
  }
  if (scope === "unit") {
    const u = units.find((x) => x.id === user.unitId);
    return u?.unitName ?? user.unitId ?? "—";
  }
  const s = sections.find((x) => x.id === user.sectionId);
  return s?.section ?? (user.sectionId != null ? `#${user.sectionId}` : "—");
}

export function UsersConsole({ currentUser, onClose }: UsersConsoleProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const formScope = useMemo(
    () => scopeKindFor(form.role, roles),
    [form.role, roles],
  );

  const rolesForForm = useMemo(
    () => assignableRoles(roles, currentUser.jurisdiction),
    [roles, currentUser.jurisdiction],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const client = await createApiClient();
      const [usersRes, rolesRes, groupsRes, zonesRes, unitsRes, sectionsRes] =
        await Promise.all([
          client.users.$get(),
          client.roles.$get(),
          client.organization.groups.$get(),
          client.organization.zones.$get({ query: {} }),
          client.organization.units.$get(),
          client.organization.sections.$get({ query: {} }),
        ]);
      if (
        !usersRes.ok ||
        !rolesRes.ok ||
        !groupsRes.ok ||
        !zonesRes.ok ||
        !unitsRes.ok ||
        !sectionsRes.ok
      ) {
        throw new Error("Failed to load users data");
      }
      setUsers(
        (await usersRes.json()).filter((u: User) => u.id !== currentUser.id),
      );
      setRoles(await rolesRes.json());
      setGroups(await groupsRes.json());
      setZones(await zonesRes.json());
      setUnits(await unitsRes.json());
      setSections(await sectionsRes.json());
      setSelectedId(null);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [currentUser.id]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  function openCreate() {
    const defaultRole = rolesForForm[0]?.code ?? "SECRETARY";
    setDialogMode("create");
    setForm({
      ...emptyForm(),
      role: defaultRole,
      groupId: groups.find((g) => g.active)?.id ?? currentUser.groupId ?? "",
      zoneId: zones.find((z) => z.active)?.id ?? currentUser.zoneId ?? "",
      unitId: units.find((u) => u.active)?.id ?? currentUser.unitId ?? "",
      sectionId: sections.find((s) => s.active)
        ? String(sections.find((s) => s.active)!.id)
        : currentUser.sectionId != null
          ? String(currentUser.sectionId)
          : "",
    });
    setDialogOpen(true);
  }

  function openEdit(row: User) {
    if (row.id === currentUser.id) {
      setStatus("You cannot edit your own account here.");
      return;
    }
    setSelectedId(row.id);
    setDialogMode("edit");
    setForm({
      username: row.username ?? "",
      password: "",
      role: row.role,
      groupId: row.groupId ?? groups[0]?.id ?? "",
      zoneId: row.zoneId ?? zones[0]?.id ?? "",
      unitId: row.unitId ?? units[0]?.id ?? "",
      sectionId:
        row.sectionId != null
          ? String(row.sectionId)
          : sections[0]
            ? String(sections[0].id)
            : "",
    });
    setDialogOpen(true);
  }

  function requestDelete(row: User) {
    if (row.id === currentUser.id) {
      setStatus("You cannot delete your own account.");
      return;
    }
    setSelectedId(row.id);
    setConfirmDeleteOpen(true);
  }

  async function handleSave() {
    if (!form.username.trim()) {
      setStatus("Username is required.");
      return;
    }
    if (dialogMode === "create" && !form.password) {
      setStatus("Password is required for new users.");
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      const client = await createApiClient();
      const json = {
        username: form.username.trim(),
        ...(form.password ? { password: form.password } : {}),
        role: form.role,
        groupId: formScope === "group" ? form.groupId || null : null,
        zoneId: formScope === "zone" ? form.zoneId || null : null,
        unitId: formScope === "unit" ? form.unitId || null : null,
        sectionId:
          formScope === "section"
            ? form.sectionId
              ? Number(form.sectionId)
              : null
            : null,
      };

      const res =
        dialogMode === "edit" && selectedId != null
          ? await client.users[":id"].$put({
              param: { id: String(selectedId) },
              json,
            })
          : await client.users.$post({ json });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `Save failed (${res.status})`);
      }

      setDialogOpen(false);
      await loadAll();
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
      const res = await client.users[":id"].$delete({
        param: { id: String(selectedId) },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `Delete failed (${res.status})`);
      }
      setConfirmDeleteOpen(false);
      await loadAll();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <h2 className="m-0 text-xl font-bold">Users</h2>
      </div>

      {status ? (
        <Alert variant="destructive" className="shrink-0">
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      ) : null}

      <Toolbar>
        <Button type="button" size="sm" onClick={openCreate} disabled={loading}>
          <Plus className="size-4" />
          New
        </Button>

        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          <X className="size-4" />
          Close
        </Button>
      </Toolbar>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-background">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((row) => {
              const isSelf = row.id === currentUser.id;
              return (
                <TableRow
                  key={row.id}
                  className="cursor-default"
                  onDoubleClick={() => {
                    if (!isSelf) openEdit(row);
                  }}
                >
                  <TableCell>{row.username ?? `user #${row.id}`}</TableCell>
                  <TableCell>{labelFor(row.role, roles)}</TableCell>
                  <TableCell>
                    {scopeLabel(row, roles, groups, zones, units, sections)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Edit user"
                        disabled={loading || isSelf}
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
                        aria-label="Delete user"
                        disabled={loading || isSelf}
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
              );
            })}
            {users.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={dialogMode === "create" ? "Add user" : "Edit user"}
        subtitle="Assign role and organizational scope for this account"
      >
        <FormDialogRow label="Username" htmlFor="user-username">
          <Input
            id="user-username"
            value={form.username}
            placeholder="e.g. jdoe"
            onChange={(e) =>
              setForm((prev) => ({ ...prev, username: e.target.value }))
            }
          />
        </FormDialogRow>
        <FormDialogRow label="Password" htmlFor="user-password">
          <Input
            id="user-password"
            type="password"
            value={form.password}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, password: e.target.value }))
            }
            autoComplete="new-password"
          />
          <FormDialogHint>
            {dialogMode === "edit"
              ? "Leave blank to keep the current password. A new password must be changed on next login."
              : "Temporary password: the user must change it on first login."}
          </FormDialogHint>
        </FormDialogRow>
        <FormDialogRow label="Role">
          <Select
            value={form.role}
            onValueChange={(value) =>
              setForm((prev) => ({ ...prev, role: value as Role }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rolesForForm.map((role) => (
                <SelectItem key={role.code} value={role.code}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormDialogRow>

        {formScope === "group" ? (
          <FormDialogRow label="Group">
            <Select
              value={form.groupId || undefined}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, groupId: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select group" />
              </SelectTrigger>
              <SelectContent>
                {groups
                  .filter((g) => g.active || g.id === form.groupId)
                  .map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.groupName}
                      {g.active ? "" : " (inactive)"}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </FormDialogRow>
        ) : null}

        {formScope === "zone" ? (
          <FormDialogRow label="Zone">
            <Select
              value={form.zoneId || undefined}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, zoneId: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select zone" />
              </SelectTrigger>
              <SelectContent>
                {zones
                  .filter((z) => z.active || z.id === form.zoneId)
                  .map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.zoneName}
                      {z.active ? "" : " (inactive)"}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </FormDialogRow>
        ) : null}

        {formScope === "unit" ? (
          <FormDialogRow label="Unit">
            <Select
              value={form.unitId || undefined}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, unitId: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select unit" />
              </SelectTrigger>
              <SelectContent>
                {units
                  .filter((u) => u.active || u.id === form.unitId)
                  .map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.unitName}
                      {u.active ? "" : " (inactive)"}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </FormDialogRow>
        ) : null}

        {formScope === "section" ? (
          <FormDialogRow label="Section">
            <Select
              value={form.sectionId || undefined}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, sectionId: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent>
                {sections
                  .filter(
                    (section) =>
                      section.active || String(section.id) === form.sectionId,
                  )
                  .map((section) => {
                    const unit = units.find((u) => u.id === section.unitId);
                    return (
                      <SelectItem key={section.id} value={String(section.id)}>
                        {unit?.unitName ?? section.unitId ?? "?"} —{" "}
                        {section.section ?? `#${section.id}`}
                        {section.active ? "" : " (inactive)"}
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
          </FormDialogRow>
        ) : null}

        <FormDialogError>{dialogOpen ? status : null}</FormDialogError>
        <FormDialogActions
          primaryLabel={
            loading
              ? "Saving…"
              : dialogMode === "create"
                ? "Add user"
                : "Save changes"
          }
          onPrimary={() => void handleSave()}
          onCancel={() => setDialogOpen(false)}
          primaryDisabled={loading}
          cancelDisabled={loading}
        />
      </FormDialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the selected account.
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
