import React, { useEffect, useMemo, useRef, useState } from "react";
import { Switch, Route, Router as WouterRouter, Link, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppStateProvider, useAppState } from "@/hooks/use-app-state";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard, Target, Users, Search, Lightbulb, PenTool, FileBarChart,
  Activity, Brain, ClipboardCheck, Settings as SettingsIcon, Bell, Lock, Menu, X,
  Sparkles, Send, AlertTriangle, Inbox, LogOut, UserCog, ScrollText, Wand2, Bot,
  FolderKanban, ListChecks, Route as RouteIcon, BookMarked,
} from "lucide-react";
import { canAccessMindMeld, canViewModule, mapServerRole, canSubmit, classifyIntakeMessage, detectDuplicates } from "@/lib/helpers";
import { useActivityNotifications } from "@/hooks/use-activity-notifications";
import { pathToActivityModule } from "@/lib/activity-notifications";
import { getPinnedProjectIds, getRecent, pushRecent, type RecentEntry } from "@/lib/nav-prefs";
import { searchWorkspace, SEARCH_KIND_LABEL, type SearchHit, type SearchHitKind } from "@/lib/workspace-search";
import collabosLogo from "@/assets/collabos-logo.png";
import LoginPage from "@/pages/login";

import Dashboard from "@/pages/dashboard";
import DuplicateRadar from "@/pages/duplicate-radar";
import TeamPulse from "@/pages/team-pulse";
import SolutionFinder from "@/pages/solution-finder";
import InnovationLab from "@/pages/innovation-lab";
import MockupStudio from "@/pages/mockup-studio";
import ExecutiveReports from "@/pages/executive-reports";
import MarketPulse from "@/pages/market-pulse";
import MindMeldRoom from "@/pages/mind-meld";
import ReviewQueue from "@/pages/review-queue";
import AgentQueue from "@/pages/agent-queue";
import ExternalIntake from "@/pages/external-intake";
import SettingsPage from "@/pages/settings";
import UserManagement from "@/pages/user-management";
import AuditLogs from "@/pages/audit-logs";
import ProjectsPage from "@/pages/projects";
import ProjectTasksPage from "@/pages/project-tasks";
import CarmenPathPage from "@/pages/carmen-path";
import PromptLibraryPage from "@/pages/prompt-library";
import { listPrompts, PROMPTS_QUERY_KEY } from "@/lib/prompts-api";

const queryClient = new QueryClient();

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  ctx: string;
  gated?: boolean;
  blurb?: string;
}

const NAV: NavItem[] = [
  { href: "/", label: "Collab Dashboard", icon: LayoutDashboard, ctx: "Collab Dashboard", blurb: "Start your day" },
  { href: "/projects", label: "Projects", icon: FolderKanban, ctx: "Projects", blurb: "All apps & hubs" },
  { href: "/carmen-path", label: "Carmen’s Path", icon: RouteIcon, ctx: "Carmen’s Path Today", blurb: "Today’s work order" },
  { href: "/project-tasks", label: "Project Tasks", icon: ListChecks, ctx: "Project Tasks", blurb: "Open follow-ups" },
  { href: "/duplicate-radar", label: "Duplicate Radar", icon: Target, ctx: "Duplicate Radar" },
  { href: "/team-pulse", label: "Team Pulse", icon: Users, ctx: "Team Pulse" },
  { href: "/solution-finder", label: "Solution Finder", icon: Search, ctx: "Solution Finder" },
  { href: "/innovation-lab", label: "Innovation Lab", icon: Lightbulb, ctx: "Innovation Lab" },
  { href: "/mockup-studio", label: "Mockup Studio", icon: PenTool, ctx: "Mockup Studio" },
  { href: "/executive-reports", label: "Executive Reports", icon: FileBarChart, ctx: "Executive Reports" },
  { href: "/market-pulse", label: "Market Pulse", icon: Activity, ctx: "Market Pulse" },
  { href: "/mind-meld", label: "Mind Meld Room", icon: Brain, ctx: "Mind Meld Room", gated: true, blurb: "Think together" },
  { href: "/review-queue", label: "Review Queue", icon: ClipboardCheck, ctx: "Review Queue", blurb: "Stamp decisions" },
  { href: "/prompt-library", label: "Prompt Library", icon: BookMarked, ctx: "Prompt Library", blurb: "Reusable AI prompts" },
  { href: "/agent-queue", label: "Cursor Direct Requests", icon: Bot, ctx: "Cursor Direct Requests", blurb: "Build & fix requests" },
  { href: "/external-intake", label: "Incoming Messages", icon: Inbox, ctx: "Incoming Messages" },
  { href: "/settings", label: "Settings", icon: SettingsIcon, ctx: "Settings" },
];

/** Workflow groups for the sidebar — Decide = sign-off & thinking; Build = do the work. */
const NAV_GROUPS: { id: string; label: string; hrefs: string[]; hint?: string }[] = [
  { id: "home", label: "Home", hrefs: ["/"] },
  { id: "decide", label: "Decide", hint: "Sign-off & think together", hrefs: ["/review-queue", "/mind-meld", "/external-intake"] },
  { id: "build", label: "Build", hint: "Projects, prompts & Cursor work", hrefs: ["/projects", "/carmen-path", "/project-tasks", "/prompt-library", "/agent-queue", "/innovation-lab", "/mockup-studio"] },
  { id: "track", label: "Track", hrefs: ["/duplicate-radar", "/team-pulse", "/solution-finder", "/executive-reports", "/market-pulse"] },
  { id: "account", label: "Account", hrefs: ["/settings"] },
];

const ROSE_BRAIN_TIPS: Record<string, string[]> = {
  "Collab Dashboard": ["Your workspace starts empty — add projects and ideas as you go.", "I can summarize what's happening when your team adds data.", "Want a one-paragraph executive brief?"],
  "Projects": ["Create projects to track work across departments.", "Open the task list to see follow-ups by project.", "Unowned work can be flagged for leadership review."],
  "Carmen’s Path Today": ["Projects appear in the order Rose dragged on Projects.", "Carmen’s open tasks and blockers sit under each project.", "Rose attachments on Cursor requests show at the top when present."],
  "Project Tasks": ["Open tasks are grouped from your shared project list.", "Filter by project from the Projects page.", "Completed tasks stay visible for reference."],
  "Duplicate Radar": ["I can flag overlaps as your project list grows.", "I can draft a merge recommendation for review.", "Add how-we-work records to improve duplicate detection."],
  "Team Pulse": ["Submit feedback to surface where teams need support.", "I can suggest a supportive follow-up plan.", "Team mood signals appear as feedback is collected."],
  "Solution Finder": ["Ask me how documented processes work.", "I only answer from Company Brain records you add.", "If nothing is documented yet, I'll point you to the right owner."],
  "Innovation Lab": ["Submit ideas to get your innovation list started.", "I can check a new idea for overlap before you submit.", "Similar ideas group together as the list grows."],
  "Mockup Studio": ["Describe an idea and I'll structure a build brief.", "I can generate a ready-to-use build prompt.", "Send any concept to the Review Queue."],
  "Executive Reports": ["I can generate report types from live workspace data.", "Reports fill in as projects and team data grow.", "Export creates a leadership-ready summary."],
  "Market Pulse": ["Add competitors and keywords in Settings to start monitoring.", "Signals appear as market data is captured.", "I can suggest a recommended response per signal."],
  "Mind Meld Room": ["Think together — private space for Rose and Carmen.", "Send to Carmen for systems; send to Rose for direction.", "Handoffs never auto-create official decisions — stamp those in Review Queue."],
  "Review Queue": ["Stamp decisions — suggestions are never auto-approved.", "Items appear here when something needs your sign-off.", "Sign-off adds the item to Carmen’s open work."],
  "Prompt Library": ["Reusable prompts by intent — handoff, security, design, audit, Cursor briefs.", "Optionally tag a project; filter by intent or search.", "Copy a reply template for Rose’s AI, then mark shared with Rose or Carmen."],
  "Cursor Direct Requests": ["Only approved requests are ready for Cursor.", "Use this for fixes, bugs, day-to-day ops, and setup work.", "Every Cursor update should include what changed."],
  "Incoming Messages": ["Messages stay drafts until a person reviews them.", "Sensitive items stay with leadership.", "Routing suggestions still need your approval."],
  "Settings": ["Adjust duplicate sensitivity and alert thresholds.", "Connections stay off until you approve them.", "Your shared workspace is saved on the server."],
};

const ROLE_IDENTITY: Record<string, { name: string; title: string; initials: string }> = {
  Rose: { name: "Rose Almeida", title: "Founder & CEO", initials: "RA" },
  Carmen: { name: "Carmen Vega", title: "Systems Lead", initials: "CV" },
  Admin: { name: "Admin", title: "Full access", initials: "AD" },
  "Department Lead": { name: "Department Lead", title: "Team oversight", initials: "DL" },
  "Team Member": { name: "Team Member", title: "Contributor", initials: "TM" },
  Viewer: { name: "Viewer", title: "Read-only", initials: "VW" },
};

function navLinkClass(active: boolean, gated?: boolean) {
  if (active) {
    return gated
      ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-sm"
      : "bg-gradient-to-r from-rose-50 to-fuchsia-50 text-rose-600 ring-1 ring-rose-100";
  }
  return gated
    ? "bg-violet-50/70 text-violet-700 ring-1 ring-violet-100 hover:bg-violet-100"
    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900";
}

function SidebarNavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const { currentRole, setRoseBrainContext } = useAppState();
  const Icon = item.icon;
  const locked = item.gated && !canAccessMindMeld(currentRole);
  const iconCls = active
    ? (item.gated ? "text-white" : "text-rose-500")
    : (item.gated ? "text-violet-500" : "text-slate-400");
  return (
    <Link
      href={item.href}
      onClick={() => { setRoseBrainContext(item.ctx); onNavigate?.(); }}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${navLinkClass(active, item.gated)}`}
    >
      <Icon className={`h-4 w-4 ${iconCls}`} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span>{item.label}</span>
        {item.blurb ? (
          <span className={`text-[10px] font-normal ${active ? (item.gated ? "text-white/80" : "text-rose-400") : "text-slate-400"}`}>
            {item.blurb}
          </span>
        ) : null}
      </span>
      {item.gated && (locked
        ? <Lock className={`h-3.5 w-3.5 ${active ? "text-white/70" : "text-violet-300"}`} />
        : <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-white" : "bg-violet-400"}`} />)}
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const { currentRole, setRoseBrainOpen, projects } = useAppState();
  const { user, hasPermission } = useAuth();
  const userKey = user?.email ?? String(user?.id ?? currentRole);
  const [recent, setRecent] = useState<RecentEntry[]>(() => getRecent(userKey));
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => getPinnedProjectIds(userKey));

  useEffect(() => {
    setRecent(getRecent(userKey));
    setPinnedIds(getPinnedProjectIds(userKey));
  }, [userKey, location]);

  const fallback = ROLE_IDENTITY[currentRole] ?? ROLE_IDENTITY.Rose;
  const me = user
    ? {
        name: user.name,
        title: currentRole,
        initials: user.name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase(),
      }
    : fallback;
  const adminNav: NavItem[] = [
    ...(hasPermission("user_management")
      ? [{ href: "/user-management", label: "User Management", icon: UserCog, ctx: "User Management" }]
      : []),
    ...(hasPermission("audit_logs_view")
      ? [{ href: "/audit-logs", label: "Audit Logs", icon: ScrollText, ctx: "Audit Logs" }]
      : []),
  ];
  const byHref = Object.fromEntries(NAV.map((n) => [n.href, n]));
  const pinnedProjects = pinnedIds
    .map((id) => projects.find((p) => String(p.id) === id))
    .filter(Boolean);

  return (
    <>
      <div className="flex items-center justify-center px-6 py-5">
        <img src={collabosLogo} alt="CollabOS logo" className="w-36 shrink-0 object-contain" />
      </div>
      <nav className="flex-1 space-y-3 overflow-y-auto px-3 pb-4">
        {(pinnedProjects.length > 0 || recent.length > 0) && (
          <div className="space-y-1 rounded-xl bg-slate-50/80 px-1 py-2">
            {pinnedProjects.length > 0 && (
              <>
                <p className="px-2 pb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Pinned</p>
                {pinnedProjects.map((p) => (
                  <Link
                    key={p!.id}
                    href={`/projects?expand=${encodeURIComponent(p!.id)}`}
                    onClick={() => {
                      pushRecent(userKey, { id: String(p!.id), kind: "project", label: p!.name, href: `/projects?expand=${p!.id}` });
                      onNavigate?.();
                    }}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"
                  >
                    <FolderKanban className="h-3.5 w-3.5 text-amber-500" />
                    <span className="truncate">{p!.name}</span>
                  </Link>
                ))}
              </>
            )}
            {recent.length > 0 && (
              <>
                <p className="px-2 pb-0.5 pt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Recent</p>
                {recent.slice(0, 5).map((r) => (
                  <Link
                    key={`${r.kind}:${r.id}`}
                    href={r.href}
                    onClick={() => onNavigate?.()}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-white"
                  >
                    <span className="truncate">{r.label}</span>
                  </Link>
                ))}
              </>
            )}
          </div>
        )}
        {NAV_GROUPS.map((group) => {
          const items = group.hrefs
            .map((h) => byHref[h])
            .filter((l): l is NavItem => !!l && canViewModule(currentRole, l.href));
          const extra = group.id === "account" ? adminNav : [];
          const all = [...items, ...extra];
          if (all.length === 0) return null;
          return (
            <div key={group.id} className="space-y-0.5">
              <div className="px-2 pb-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{group.label}</p>
                {group.hint ? <p className="text-[9px] font-normal normal-case tracking-normal text-slate-400">{group.hint}</p> : null}
              </div>
              {all.map((l) => (
                <SidebarNavLink
                  key={l.href}
                  item={l}
                  active={location === l.href || (l.href !== "/" && location.startsWith(l.href))}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          );
        })}
      </nav>
      <div className="px-3 pb-2">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-blue-500 text-xs font-bold text-white">{me.initials}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">{me.name}</p>
            <p className="truncate text-[11px] text-slate-400">{me.title}</p>
          </div>
        </div>
      </div>
      <div className="px-3 pb-2">
        <div className="rounded-2xl bg-gradient-to-br from-rose-500 via-rose-500 to-blue-500 p-4 text-white shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur"><Brain className="h-4 w-4" /></div>
            <p className="text-sm font-bold">Need help?</p>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-white/85">Ask Rose Brain anything about your team workspace.</p>
          <button
            onClick={() => { setRoseBrainOpen(true); onNavigate?.(); }}
            className="mt-3 w-full rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
          >
            Chat now
          </button>
        </div>
      </div>
      <div className="border-t border-slate-100 px-4 py-3 text-[11px] text-slate-400">
        Shared workspace · connections not live yet
      </div>
    </>
  );
}

function AlertsBell() {
  const { alerts } = useAppState();
  const { sinceLastVisit, totalNew, lastVisitLabel } = useActivityNotifications();
  const [open, setOpen] = useState(false);
  const high = alerts.filter((a) => a.risk === "high" || a.risk === "critical").length;
  const badge = high > 0 ? high : totalNew;
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative rounded-full p-2 text-slate-500 transition hover:bg-slate-100" title="Activity since your last visit">
        <Bell className="h-5 w-5" />
        {badge > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{badge > 9 ? "9+" : badge}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
            <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Since last visit</p>
            {lastVisitLabel ? <p className="mb-2 px-1 text-[10px] text-slate-400">Last check: {lastVisitLabel}</p> : null}
            {sinceLastVisit.length > 0 ? (
              <ul className="max-h-96 space-y-1.5 overflow-y-auto">
                {sinceLastVisit.map((item) => (
                  <li key={item.id}>
                    <Link href={item.href} onClick={() => setOpen(false)} className="flex items-start gap-2 rounded-xl p-2 hover:bg-slate-50">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                      <div>
                        <p className="text-xs font-medium text-slate-700">{item.label}</p>
                        <p className="line-clamp-2 text-[10px] text-slate-400">{item.detail}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl bg-emerald-50 p-2.5 text-xs text-emerald-700">You're caught up since your last visit.</p>
            )}
            {alerts.length > 0 ? (
              <>
                <p className="mb-2 mt-3 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Heads-up alerts</p>
                <ul className="max-h-48 space-y-1.5 overflow-y-auto">
                  {alerts.map((a) => (
                    <li key={a.id} className="flex items-start gap-2 rounded-xl p-2 hover:bg-slate-50">
                      <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${a.risk === "high" ? "text-rose-500" : "text-amber-500"}`} />
                      <div>
                        <p className="text-xs text-slate-700">{a.message}</p>
                        <p className="text-[10px] text-slate-400">{a.source} · {a.createdAt}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function ModuleSeenTracker() {
  const [location] = useLocation();
  const { markModuleSeen } = useActivityNotifications();

  useEffect(() => {
    const mod = pathToActivityModule(location);
    if (!mod || mod === "dashboard") return;
    void markModuleSeen(mod);
  }, [location, markModuleSeen]);

  useEffect(() => {
    const mod = pathToActivityModule(location);
    if (mod !== "dashboard") return;
    return () => { void markModuleSeen("dashboard"); };
  }, [location, markModuleSeen]);

  return null;
}

const HIT_ICONS: Record<SearchHitKind, React.ComponentType<{ className?: string }>> = {
  page: LayoutDashboard,
  project: FolderKanban,
  task: ListChecks,
  decision: ClipboardCheck,
  cursor: Bot,
  prompt: BookMarked,
};

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { currentRole, submitIdea, projects, projectTasks, recommendations, agentWorkItems } = useAppState();
  const { user } = useAuth();
  const userKey = user?.email ?? String(user?.id ?? currentRole);
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [smartResult, setSmartResult] = useState<{ title: string; lines: string[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: prompts = [] } = useQuery({
    queryKey: PROMPTS_QUERY_KEY,
    queryFn: listPrompts,
    enabled: open,
    staleTime: 60_000,
  });


  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSmartResult(null);
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const visibleNav = useMemo(
    () => NAV.filter((n) => canViewModule(currentRole, n.href) && (!n.gated || canAccessMindMeld(currentRole))),
    [currentRole],
  );

  const hits = useMemo(
    () =>
      searchWorkspace({
        query,
        nav: visibleNav,
        projects,
        tasks: projectTasks,
        recommendations,
        agentWork: agentWorkItems,
        prompts,
      }),
    [query, visibleNav, projects, projectTasks, recommendations, agentWorkItems, prompts],
  );

  const grouped = useMemo(() => {
    const order: SearchHitKind[] = ["project", "task", "decision", "cursor", "prompt", "page"];
    const map = new Map<SearchHitKind, SearchHit[]>();
    for (const h of hits) {
      const list = map.get(h.kind) ?? [];
      list.push(h);
      map.set(h.kind, list);
    }
    return order.filter((k) => (map.get(k)?.length ?? 0) > 0).map((k) => ({ kind: k, items: map.get(k)! }));
  }, [hits]);

  if (!open) return null;

  const q = query.trim();
  const go = (href: string, hit?: SearchHit) => {
    if (hit?.kind === "project") {
      pushRecent(userKey, { id: hit.id.replace(/^project:/, ""), kind: "project", label: hit.title, href });
    } else if (hit?.kind === "page") {
      pushRecent(userKey, { id: href, kind: "page", label: hit.title, href });
    }
    onClose();
    navigate(href);
  };

  const smartActions: { id: string; label: string; icon: React.ComponentType<{ className?: string }>; run: () => void }[] = [];
  if (q.length > 2) {
    smartActions.push({
      id: "classify",
      label: `Classify "${q.length > 40 ? q.slice(0, 37) + "..." : q}"`,
      icon: Wand2,
      run: () => {
        const c = classifyIntakeMessage(q);
        setSmartResult({
          title: "Classification (rule-based)",
          lines: [
            `Detected type: ${c.detectedType.replace(/_/g, " ")}`,
            `Suggested destination: ${c.suggestedDestination.replace(/-/g, " ")}`,
            `Review owner: ${c.reviewOwner}`,
            `Why: ${c.reason}`,
            "Draft only — route it via External Intake for a real review.",
          ],
        });
      },
    });
    smartActions.push({
      id: "dup",
      label: "Check for duplicate work",
      icon: Target,
      run: () => {
        const matches = detectDuplicates(q, projects);
        setSmartResult({
          title: "Duplicate check (keyword overlap)",
          lines: matches.length === 0
            ? ["No overlapping projects found above the similarity threshold."]
            : matches.slice(0, 4).map((m) => `${m.candidate.name} — ${m.score}% overlap`),
        });
      },
    });
    if (canSubmit(currentRole)) {
      smartActions.push({
        id: "idea",
        label: "Save as draft idea in Innovation Lab",
        icon: Lightbulb,
        run: () => {
          const overlap = detectDuplicates(q, projects);
          submitIdea({
            title: q.length > 80 ? q.slice(0, 77) + "..." : q,
            description: q,
            submittedBy: currentRole,
            status: overlap.length ? "related-to-existing" : "draft-idea",
            momentum: 50, cluster: null, benefits: [], risks: [], dependencies: [],
            approvalRoute: "carmen",
          });
          go("/innovation-lab");
        },
      });
      smartActions.push({ id: "mockup", label: "Start a mockup from this", icon: PenTool, run: () => go("/mockup-studio") });
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-900/40 p-4 pt-[12vh]" onClick={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-slate-100 px-4">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSmartResult(null); }}
            placeholder="Find projects, tasks, decisions, Cursor requests…"
            className="w-full border-none bg-transparent py-3.5 text-sm focus:outline-none"
          />
          <kbd className="shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">Esc</kbd>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {smartActions.length > 0 && (
            <div className="mb-1">
              <p className="px-2 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Smart actions</p>
              {smartActions.map((a) => (
                <button key={a.id} onClick={a.run} className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-slate-700 transition hover:bg-rose-50 hover:text-rose-700">
                  <a.icon className="h-4 w-4 text-rose-400" /> {a.label}
                </button>
              ))}
            </div>
          )}
          {smartResult && (
            <div className="mx-2 mb-2 rounded-xl border border-sky-100 bg-sky-50/70 p-3">
              <p className="text-xs font-bold text-sky-700">{smartResult.title}</p>
              <ul className="mt-1 space-y-0.5">
                {smartResult.lines.map((l) => <li key={l} className="text-[11px] text-slate-600">{l}</li>)}
              </ul>
            </div>
          )}
          {grouped.length === 0 ? (
            <p className="px-2.5 py-2 text-xs text-slate-400">Nothing matches — try a project name, task, or client code (FRR, EC, ALD).</p>
          ) : (
            grouped.map((g) => (
              <div key={g.kind} className="mb-1">
                <p className="px-2 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {SEARCH_KIND_LABEL[g.kind]}
                </p>
                {g.items.map((h) => {
                  const Icon = HIT_ICONS[h.kind];
                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => go(h.href, h)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{h.title}</span>
                        <span className="block truncate text-[10px] text-slate-400">{h.subtitle}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <p className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-[10px] text-slate-400">
          Jump to the right page with context. Smart actions stay drafts until you stamp them in Review Queue.
        </p>
      </div>
    </div>
  );
}

function TopBar({ onMenu, onOpenPalette }: { onMenu: () => void; onOpenPalette: () => void }) {
  const { currentRole, setRoseBrainOpen, recommendations } = useAppState();
  const { user, logout } = useAuth();
  const pending = recommendations.filter((r) => r.status === "pending").length;
  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex flex-1 items-center gap-3">
        <button onClick={onMenu} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"><Menu className="h-5 w-5" /></button>
        <button type="button" onClick={onOpenPalette} className="relative hidden min-w-0 max-w-md flex-1 sm:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <span className="block w-full truncate whitespace-nowrap rounded-full bg-slate-100 py-2 pl-9 pr-12 text-left text-sm text-slate-400 transition hover:bg-slate-200/70">
            Search projects, tasks, decisions, Cursor requests…
          </span>
          <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 lg:block">⌘K</kbd>
        </button>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <button onClick={() => setRoseBrainOpen(true)} className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-rose-200 hover:text-rose-600 sm:inline-flex sm:text-sm">
          <Brain className="h-4 w-4 text-rose-500" /> Rose Brain <Sparkles className="h-3.5 w-3.5 text-sky-400" />
        </button>
        <AlertsBell />
        <Link href="/review-queue" aria-label="Review queue" className="relative rounded-full p-2 text-slate-500 transition hover:bg-slate-100">
          <ClipboardCheck className="h-5 w-5" />
          {pending > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-bold text-white">{pending}</span>}
        </Link>
        <div className="hidden items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 sm:flex">
          <span className="text-xs font-semibold text-slate-700">{user?.name ?? "Signed in"}</span>
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600">{currentRole}</span>
          {user?.isDemo && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">Demo</span>}
        </div>
        <button onClick={() => void logout()} aria-label="Sign out" title="Sign out" className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-rose-600">
          <LogOut className="h-5 w-5" />
        </button>
        <button onClick={() => setRoseBrainOpen(true)} aria-label="Open Rose Brain" className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-sky-400 text-sm font-bold text-white shadow-sm ring-2 ring-white">
          {currentRole.charAt(0)}
        </button>
      </div>
    </header>
  );
}

function RoseBrainDrawer() {
  const { isRoseBrainOpen, setRoseBrainOpen, roseBrainContext, currentRole } = useAppState();
  const [input, setInput] = useState("");
  const [thread, setThread] = useState<{ role: "you" | "rose"; text: string }[]>([]);
  const tips = useMemo(() => ROSE_BRAIN_TIPS[roseBrainContext] ?? ROSE_BRAIN_TIPS["Collab Dashboard"], [roseBrainContext]);

  if (!isRoseBrainOpen) return null;

  const ask = (q: string) => {
    if (!q.trim()) return;
    const answer = `Here in ${roseBrainContext}, ${tips[0].toLowerCase()} I only surface documented facts and clearly label anything as a recommendation — never an auto-approved decision.`;
    setThread((t) => [...t, { role: "you", text: q }, { role: "rose", text: answer }]);
    setInput("");
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm" onClick={() => setRoseBrainOpen(false)} />
      <aside className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-rose-50 via-white to-blue-50 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-blue-500 text-white"><Brain className="h-5 w-5" /></div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Rose Brain</h2>
              <p className="text-[11px] text-slate-500">Context: {roseBrainContext} · {currentRole}</p>
            </div>
          </div>
          <button onClick={() => setRoseBrainOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-rose-500"><Sparkles className="h-3.5 w-3.5" /> On this page</p>
            <ul className="mt-2 space-y-1.5">
              {tips.map((t) => <li key={t} className="text-sm text-slate-600">• {t}</li>)}
            </ul>
          </div>
          {thread.map((m, i) => (
            <div key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === "you" ? "ml-auto bg-rose-500 text-white" : "bg-slate-100 text-slate-700"}`}>{m.text}</div>
          ))}
        </div>

        <div className="border-t border-slate-100 p-3">
          <div className="flex flex-wrap gap-1.5 pb-2">
            {tips.slice(0, 2).map((t) => (
              <button key={t} onClick={() => ask(t)} className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-100">{t.slice(0, 28)}…</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask(input)} placeholder="Ask Rose Brain..." className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
            <button onClick={() => ask(input)} className="rounded-xl bg-rose-500 p-2 text-white transition hover:bg-rose-600"><Send className="h-4 w-4" /></button>
          </div>
        </div>
      </aside>
    </>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/30 md:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white md:hidden">
            <div className="flex justify-end p-2"><button onClick={() => setMobileOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar onMenu={() => setMobileOpen(true)} onOpenPalette={() => setPaletteOpen(true)} />
        {user?.mustChangePassword && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
            Temporary password active —{" "}
            <Link href="/settings" className="font-semibold underline">change your password in Settings</Link>.
          </div>
        )}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <RoseBrainDrawer />
    </div>
  );
}

function Guarded({ href, children }: { href: string; children: React.ReactNode }) {
  const { currentRole } = useAppState();
  if (!canViewModule(currentRole, href)) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-sm rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100"><Lock className="h-6 w-6 text-slate-400" /></div>
          <h2 className="text-sm font-bold text-slate-800">Access restricted</h2>
          <p className="mt-1 text-xs text-slate-500">Your current role ({currentRole}) can't open this page. Ask Carmen if you need access.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function AdminGuarded({ permission, children }: { permission: string; children: React.ReactNode }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-sm rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100"><Lock className="h-6 w-6 text-slate-400" /></div>
          <h2 className="text-sm font-bold text-slate-800">Admin area</h2>
          <p className="mt-1 text-xs text-slate-500">This area is for administrators only.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/projects">{() => <Guarded href="/projects"><ProjectsPage /></Guarded>}</Route>
        <Route path="/carmen-path">{() => <Guarded href="/carmen-path"><CarmenPathPage /></Guarded>}</Route>
        <Route path="/project-tasks">{() => <Guarded href="/project-tasks"><ProjectTasksPage /></Guarded>}</Route>
        <Route path="/duplicate-radar">{() => <Guarded href="/duplicate-radar"><DuplicateRadar /></Guarded>}</Route>
        <Route path="/team-pulse">{() => <Guarded href="/team-pulse"><TeamPulse /></Guarded>}</Route>
        <Route path="/solution-finder">{() => <Guarded href="/solution-finder"><SolutionFinder /></Guarded>}</Route>
        <Route path="/innovation-lab">{() => <Guarded href="/innovation-lab"><InnovationLab /></Guarded>}</Route>
        <Route path="/mockup-studio">{() => <Guarded href="/mockup-studio"><MockupStudio /></Guarded>}</Route>
        <Route path="/executive-reports">{() => <Guarded href="/executive-reports"><ExecutiveReports /></Guarded>}</Route>
        <Route path="/market-pulse">{() => <Guarded href="/market-pulse"><MarketPulse /></Guarded>}</Route>
        <Route path="/mind-meld">{() => <Guarded href="/mind-meld"><MindMeldRoom /></Guarded>}</Route>
        <Route path="/review-queue">{() => <Guarded href="/review-queue"><ReviewQueue /></Guarded>}</Route>
        <Route path="/agent-queue">{() => <Guarded href="/agent-queue"><AgentQueue /></Guarded>}</Route>
        <Route path="/prompt-library">{() => <Guarded href="/prompt-library"><PromptLibraryPage /></Guarded>}</Route>
        <Route path="/external-intake">{() => <Guarded href="/external-intake"><ExternalIntake /></Guarded>}</Route>
        <Route path="/settings">{() => <Guarded href="/settings"><SettingsPage /></Guarded>}</Route>
        <Route path="/user-management">{() => <AdminGuarded permission="user_management"><UserManagement /></AdminGuarded>}</Route>
        <Route path="/audit-logs">{() => <AdminGuarded permission="audit_logs_view"><AuditLogs /></AdminGuarded>}</Route>
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function RoleSync() {
  const { user } = useAuth();
  const { currentRole, setCurrentRole } = useAppState();
  useEffect(() => {
    if (user) {
      const mapped = mapServerRole(user.role);
      if (mapped !== currentRole) setCurrentRole(mapped);
    }
  }, [user, currentRole, setCurrentRole]);
  return null;
}

function SessionLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-rose-50 via-white to-blue-50">
      <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-400" /> Checking your session...
      </div>
    </div>
  );
}

function LoginRoute() {
  const { status } = useAuth();
  if (status === "loading") return <SessionLoading />;
  if (status === "authed") return <Redirect to="/" />;
  return <LoginPage />;
}

function AuthenticatedApp() {
  const { status } = useAuth();
  const [location] = useLocation();
  if (status === "loading") return <SessionLoading />;
  if (status === "anon") return <Redirect to="/login" />;
  if (location === "/login") return <Redirect to="/" />;
  return (
    <AppStateProvider>
      <RoleSync />
      <ModuleSeenTracker />
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </AppStateProvider>
  );
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/login" component={LoginRoute} />
      <Route component={AuthenticatedApp} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRoutes />
        </WouterRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
