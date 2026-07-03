import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListUsers,
  useCreateUser,
  useUpdateUser,
  useResetUserPassword,
  getListUsersQueryKey,
  ApiError,
  type UserProfile,
  type UserRole,
} from "@workspace/api-client-react";
import { UserCog, Plus, KeyRound, ShieldCheck, ShieldOff, X } from "lucide-react";
import { SectionCard } from "@/components/shared";
import { useAuth } from "@/hooks/use-auth";
import { mapServerRole } from "@/lib/helpers";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "super_admin", label: "Super Admin" },
  { value: "rose_admin", label: "Rose (Founder Admin)" },
  { value: "carmen_admin", label: "Carmen (Systems Admin)" },
  { value: "leadership_reviewer", label: "Leadership Reviewer" },
  { value: "contributor", label: "Contributor" },
  { value: "viewer", label: "Viewer" },
  { value: "guest", label: "Guest" },
];

function roleLabel(role: string): string {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
}

function errMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const data = err.data as { message?: string } | undefined;
    return data?.message ?? "Request failed";
  }
  return err instanceof Error ? err.message : "Request failed";
}

export default function UserManagement() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const { data: users, isLoading, error } = useListUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const resetPassword = useResetUserPassword();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "contributor" as UserRole });
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });

  const filtered = useMemo(() => {
    const list = users ?? [];
    return roleFilter === "all" ? list : list.filter((u) => u.role === roleFilter);
  }, [users, roleFilter]);

  const submitCreate = () => {
    setProblem(null);
    createUser.mutate(
      { data: { name: form.name, email: form.email, password: form.password, role: form.role } },
      {
        onSuccess: (u) => {
          setNotice(`Created ${u.name} (${roleLabel(u.role)})`);
          setShowCreate(false);
          setForm({ name: "", email: "", password: "", role: "contributor" });
          void invalidate();
        },
        onError: (e) => setProblem(errMessage(e)),
      },
    );
  };

  const patchUser = (u: UserProfile, patch: { role?: UserRole; status?: "active" | "inactive" }) => {
    setProblem(null);
    updateUser.mutate(
      { id: u.id, data: patch },
      {
        onSuccess: () => {
          setNotice(patch.role ? `${u.name} is now ${roleLabel(patch.role)}` : `${u.name} is now ${patch.status}`);
          void invalidate();
        },
        onError: (e) => setProblem(errMessage(e)),
      },
    );
  };

  const doReset = (u: UserProfile) => {
    setProblem(null);
    resetPassword.mutate(
      { id: u.id },
      {
        onSuccess: (r) => {
          setNotice(`Temporary password for ${u.name}: ${r.tempPassword} — share it securely; they'll be asked to change it.`);
          void invalidate();
        },
        onError: (e) => setProblem(errMessage(e)),
      },
    );
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800"><UserCog className="h-5 w-5 text-rose-500" /> User Management</h1>
          <p className="text-sm text-slate-500">Real accounts with server-enforced roles. Every change here is written to the audit log.</p>
        </div>
        <button onClick={() => { setShowCreate((v) => !v); setProblem(null); }} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-blue-500 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95">
          {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {showCreate ? "Cancel" : "Add user"}
        </button>
      </div>

      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-700">
          <span className="break-all">{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss" className="text-emerald-500 hover:text-emerald-700"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
      {problem && <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-600">{problem}</div>}

      {showCreate && (
        <SectionCard title="New account">
          <p className="mb-3 text-xs text-slate-500">The user can sign in immediately with this password.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="field-input" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="field-input" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="field-input" placeholder="Password (min 8 characters)" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <select className="field-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <button
            onClick={submitCreate}
            disabled={createUser.isPending || !form.name.trim() || !form.email.trim() || form.password.length < 8}
            className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {createUser.isPending ? "Creating..." : "Create account"}
          </button>
        </SectionCard>
      )}

      <SectionCard
        title={`Accounts (${filtered.length})`}
        action={
          <select className="field-input !w-auto text-xs" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">All roles</option>
            {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        }
      >
        {isLoading && <p className="py-6 text-center text-sm text-slate-400">Loading accounts...</p>}
        {error != null && <p className="py-6 text-center text-sm text-rose-500">{errMessage(error)}</p>}
        {!isLoading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3 font-semibold">User</th>
                  <th className="py-2 pr-3 font-semibold">Role</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 pr-3 font-semibold">Last login</th>
                  <th className="py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const self = me?.id === u.id;
                  return (
                    <tr key={u.id} className="border-b border-slate-50">
                      <td className="py-2.5 pr-3">
                        <p className="font-semibold text-slate-800">{u.name} {u.isDemo && <span className="ml-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600">Demo</span>} {self && <span className="ml-1 rounded-full bg-sky-50 px-1.5 py-0.5 text-[9px] font-semibold text-sky-600">You</span>}</p>
                        <p className="text-[11px] text-slate-400">{u.email}</p>
                      </td>
                      <td className="py-2.5 pr-3">
                        <select
                          className="field-input !w-auto text-xs"
                          value={u.role}
                          disabled={self || updateUser.isPending}
                          onChange={(e) => patchUser(u, { role: e.target.value as UserRole })}
                        >
                          {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                        <p className="mt-0.5 text-[10px] text-slate-400">Appears in app as: {mapServerRole(u.role)}</p>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${u.status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>{u.status}</span>
                        {u.mustChangePassword && <p className="mt-0.5 text-[10px] text-amber-600">Temp password issued</p>}
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-slate-500">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => patchUser(u, { status: u.status === "active" ? "inactive" : "active" })}
                            disabled={self || updateUser.isPending}
                            title={u.status === "active" ? "Deactivate" : "Activate"}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                          >
                            {u.status === "active" ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => doReset(u)}
                            disabled={resetPassword.isPending}
                            title="Reset password"
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
