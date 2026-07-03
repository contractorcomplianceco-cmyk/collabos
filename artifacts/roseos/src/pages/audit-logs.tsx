import { useMemo, useState } from "react";
import { useListAuditLogs, ApiError } from "@workspace/api-client-react";
import { ScrollText, Filter } from "lucide-react";
import { SectionCard } from "@/components/shared";

const ACTION_TONES: Record<string, string> = {
  login: "bg-emerald-50 text-emerald-600",
  logout: "bg-slate-100 text-slate-500",
  login_failed: "bg-rose-50 text-rose-600",
  user_created: "bg-sky-50 text-sky-600",
  role_changed: "bg-violet-50 text-violet-600",
  user_deactivated: "bg-amber-50 text-amber-600",
  user_activated: "bg-emerald-50 text-emerald-600",
  password_reset: "bg-amber-50 text-amber-600",
  mockup_approved: "bg-emerald-50 text-emerald-600",
  mockup_rejected: "bg-rose-50 text-rose-600",
};

function tone(action: string): string {
  return ACTION_TONES[action] ?? "bg-slate-100 text-slate-600";
}

export default function AuditLogs() {
  const { data: logs, isLoading, error } = useListAuditLogs();
  const [actionFilter, setActionFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");

  const actions = useMemo(() => Array.from(new Set((logs ?? []).map((l) => l.action))).sort(), [logs]);
  const areas = useMemo(() => Array.from(new Set((logs ?? []).map((l) => l.sourceArea))).sort(), [logs]);

  const filtered = useMemo(
    () =>
      (logs ?? []).filter(
        (l) => (actionFilter === "all" || l.action === actionFilter) && (areaFilter === "all" || l.sourceArea === areaFilter),
      ),
    [logs, actionFilter, areaFilter],
  );

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800"><ScrollText className="h-5 w-5 text-rose-500" /> Audit Logs</h1>
        <p className="text-sm text-slate-500">A server-side record of who did what, where, and when. Entries cannot be edited from the app.</p>
      </div>

      <SectionCard
        title={`Events (${filtered.length})`}
        action={
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select className="field-input !w-auto text-xs" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
              <option value="all">All actions</option>
              {actions.map((a) => <option key={a} value={a}>{a.replaceAll("_", " ")}</option>)}
            </select>
            <select className="field-input !w-auto text-xs" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
              <option value="all">All areas</option>
              {areas.map((a) => <option key={a} value={a}>{a.replaceAll("_", " ")}</option>)}
            </select>
          </div>
        }
      >
        {isLoading && <p className="py-6 text-center text-sm text-slate-400">Loading audit trail...</p>}
        {error != null && (
          <p className="py-6 text-center text-sm text-rose-500">
            {error instanceof ApiError ? ((error.data as { message?: string })?.message ?? "Could not load audit logs") : "Could not load audit logs"}
          </p>
        )}
        {!isLoading && !error && filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-400">No events match these filters yet.</p>
        )}
        {!isLoading && !error && filtered.length > 0 && (
          <ul className="divide-y divide-slate-50">
            {filtered.map((l) => (
              <li key={l.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2.5">
                <span className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone(l.action)}`}>{l.action.replaceAll("_", " ")}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold">{l.actorName}</span>
                    {l.details ? <span className="text-slate-500"> — {l.details}</span> : null}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {l.sourceArea.replaceAll("_", " ")} · {l.targetType}{l.targetId ? ` #${l.targetId}` : ""} · {new Date(l.createdAt).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
