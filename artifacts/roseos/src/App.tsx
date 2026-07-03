import React, { useEffect, useMemo, useRef, useState } from "react";
import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppStateProvider, useAppState } from "@/hooks/use-app-state";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard, Target, Users, Search, Lightbulb, PenTool, FileBarChart,
  Activity, Brain, ClipboardCheck, Settings as SettingsIcon, Bell, Lock, Menu, X,
  Sparkles, Send, AlertTriangle, Inbox, LogOut, UserCog, ScrollText, Wand2,
} from "lucide-react";
import { alerts, projects } from "@/data/seed";
import { canAccessMindMeld, canViewModule, mapServerRole, canSubmit, classifyIntakeMessage, detectDuplicates } from "@/lib/helpers";
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
import ExternalIntake from "@/pages/external-intake";
import SettingsPage from "@/pages/settings";
import UserManagement from "@/pages/user-management";
import AuditLogs from "@/pages/audit-logs";

const queryClient = new QueryClient();

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  ctx: string;
  gated?: boolean;
}

const NAV: NavItem[] = [
  { href: "/", label: "Collab Dashboard", icon: LayoutDashboard, ctx: "Collab Dashboard" },
  { href: "/duplicate-radar", label: "Duplicate Radar", icon: Target, ctx: "Duplicate Radar" },
  { href: "/team-pulse", label: "Team Pulse", icon: Users, ctx: "Team Pulse" },
  { href: "/solution-finder", label: "Solution Finder", icon: Search, ctx: "Solution Finder" },
  { href: "/innovation-lab", label: "Innovation Lab", icon: Lightbulb, ctx: "Innovation Lab" },
  { href: "/mockup-studio", label: "Mockup Studio", icon: PenTool, ctx: "Mockup Studio" },
  { href: "/executive-reports", label: "Executive Reports", icon: FileBarChart, ctx: "Executive Reports" },
  { href: "/market-pulse", label: "Market Pulse", icon: Activity, ctx: "Market Pulse" },
  { href: "/mind-meld", label: "Mind Meld Room", icon: Brain, ctx: "Mind Meld Room", gated: true },
  { href: "/review-queue", label: "Review Queue", icon: ClipboardCheck, ctx: "Review Queue" },
  { href: "/external-intake", label: "External Intake", icon: Inbox, ctx: "External Intake" },
  { href: "/settings", label: "Settings", icon: SettingsIcon, ctx: "Settings" },
];

const ROSE_BRAIN_TIPS: Record<string, string[]> = {
  "Collab Dashboard": ["3 high-risk items need leadership attention.", "Document Collection has been unowned for 7 days.", "Want a one-paragraph executive brief?"],
  "Duplicate Radar": ["Content Magic and AI Content Generator overlap 95%.", "I can draft a merge recommendation for review.", "Two analytics surfaces share the same CRM data."],
  "Team Pulse": ["Ops needs documentation support most.", "Sales reports Zoho tool friction.", "I can suggest a supportive follow-up plan."],
  "Solution Finder": ["Ask me how onboarding or qualifier scoring works.", "I only answer from documented Company Brain records.", "If undocumented, I'll route you to the right owner."],
  "Innovation Lab": ["Three platform ideas cluster into Collab OS vNext.", "I can check a new idea for overlap before you submit.", "Momentum is highest on Collab OS vNext."],
  "Mockup Studio": ["Describe an idea and I'll structure a build brief.", "I can generate a ready-to-use build prompt.", "Send any concept to the Review Queue."],
  "Executive Reports": ["I can generate 10 report types from live data.", "Project Health flags 2 at-risk projects.", "Export creates a leadership-ready summary."],
  "Market Pulse": ["All signals are public-source sample data.", "Acme Corp launched an AI intake assistant.", "I can suggest a recommended response per signal."],
  "Mind Meld Room": ["This space is private to Rose and Carmen.", "Carmenfy routes to systems; Rosify routes to direction.", "Handoffs never auto-create official decisions."],
  "Review Queue": ["AI recommendations are never auto-approved.", "Pricing decision needs both Rose and Carmen.", "Each action is logged to audit history."],
  "Settings": ["Adjust duplicate sensitivity and alert thresholds.", "All integrations are recommend-only.", "Reset sample data anytime."],
};

const ROLE_IDENTITY: Record<string, { name: string; title: string; initials: string }> = {
  Rose: { name: "Rose Almeida", title: "Founder & CEO", initials: "RA" },
  Carmen: { name: "Carmen Vega", title: "Systems Lead", initials: "CV" },
  Admin: { name: "Admin", title: "Full access", initials: "AD" },
  "Department Lead": { name: "Department Lead", title: "Team oversight", initials: "DL" },
  "Team Member": { name: "Team Member", title: "Contributor", initials: "TM" },
  Viewer: { name: "Viewer", title: "Read-only", initials: "VW" },
};

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const { currentRole, setRoseBrainContext, setRoseBrainOpen } = useAppState();
  const { user, hasPermission } = useAuth();
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
  const visibleNav = [
    ...NAV.filter((l) => canViewModule(currentRole, l.href)),
    ...adminNav,
  ];
  return (
    <>
      <div className="flex items-center justify-center px-6 py-5">
        <img src={collabosLogo} alt="CollabOS Command Center logo" className="w-36 shrink-0 object-contain" />
      </div>
      <nav className="flex-1 space-y-0.5 px-3 pb-4">
        {visibleNav.map((l) => {
          const Icon = l.icon;
          const active = location === l.href;
          const locked = l.gated && !canAccessMindMeld(currentRole);
          const cls = active
            ? (l.gated
                ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-sm"
                : "bg-gradient-to-r from-rose-50 to-fuchsia-50 text-rose-600 ring-1 ring-rose-100")
            : (l.gated
                ? "bg-violet-50/70 text-violet-700 ring-1 ring-violet-100 hover:bg-violet-100"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900");
          const iconCls = active
            ? (l.gated ? "text-white" : "text-rose-500")
            : (l.gated ? "text-violet-500" : "text-slate-400");
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => { setRoseBrainContext(l.ctx); onNavigate?.(); }}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${cls}`}
            >
              <Icon className={`h-4 w-4 ${iconCls}`} />
              <span className="flex-1">{l.label}</span>
              {l.gated && (locked
                ? <Lock className={`h-3.5 w-3.5 ${active ? "text-white/70" : "text-violet-300"}`} />
                : <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-white" : "bg-violet-400"}`} />)}
            </Link>
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
          <p className="mt-1.5 text-xs leading-relaxed text-white/85">Ask Rose Brain anything about your collaboration intelligence.</p>
          <button
            onClick={() => { setRoseBrainOpen(true); onNavigate?.(); }}
            className="mt-3 w-full rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
          >
            Chat now
          </button>
        </div>
      </div>
      <div className="border-t border-slate-100 px-4 py-3 text-[11px] text-slate-400">
        Local-first prototype · no live data
      </div>
    </>
  );
}

function AlertsBell() {
  const [open, setOpen] = useState(false);
  const high = alerts.filter((a) => a.risk === "high" || a.risk === "critical").length;
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative rounded-full p-2 text-slate-500 transition hover:bg-slate-100">
        <Bell className="h-5 w-5" />
        {high > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{high}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Alerts</p>
            <ul className="max-h-96 space-y-1.5 overflow-y-auto">
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
          </div>
        </>
      )}
    </div>
  );
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { currentRole, submitIdea } = useAppState();
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [smartResult, setSmartResult] = useState<{ title: string; lines: string[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  if (!open) return null;

  const q = query.trim();
  const navMatches = NAV.filter(
    (n) => canViewModule(currentRole, n.href) && (!n.gated || canAccessMindMeld(currentRole)) &&
      (q === "" || n.label.toLowerCase().includes(q.toLowerCase())),
  );

  const go = (href: string) => { onClose(); navigate(href); };

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
            placeholder="Jump to a module, or type an idea / message to act on it..."
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
          <p className="px-2 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Go to</p>
          {navMatches.length === 0 && <p className="px-2.5 py-2 text-xs text-slate-400">No modules match.</p>}
          {navMatches.map((n) => (
            <button key={n.href} onClick={() => go(n.href)} className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50">
              <n.icon className="h-4 w-4 text-slate-400" /> {n.label}
            </button>
          ))}
        </div>
        <p className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-[10px] text-slate-400">
          Smart actions are rule-based drafts — everything still goes through the Review Queue.
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
            Search modules, or type an idea to act on...
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
          <p className="mt-1 text-xs text-slate-500">Your current role ({currentRole}) doesn't have access to this module. Ask an admin if you need more access.</p>
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
          <p className="mt-1 text-xs text-slate-500">This area is limited to administrators. The server enforces this permission too.</p>
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
        <Route path="/duplicate-radar">{() => <Guarded href="/duplicate-radar"><DuplicateRadar /></Guarded>}</Route>
        <Route path="/team-pulse">{() => <Guarded href="/team-pulse"><TeamPulse /></Guarded>}</Route>
        <Route path="/solution-finder">{() => <Guarded href="/solution-finder"><SolutionFinder /></Guarded>}</Route>
        <Route path="/innovation-lab">{() => <Guarded href="/innovation-lab"><InnovationLab /></Guarded>}</Route>
        <Route path="/mockup-studio">{() => <Guarded href="/mockup-studio"><MockupStudio /></Guarded>}</Route>
        <Route path="/executive-reports">{() => <Guarded href="/executive-reports"><ExecutiveReports /></Guarded>}</Route>
        <Route path="/market-pulse">{() => <Guarded href="/market-pulse"><MarketPulse /></Guarded>}</Route>
        <Route path="/mind-meld">{() => <Guarded href="/mind-meld"><MindMeldRoom /></Guarded>}</Route>
        <Route path="/review-queue">{() => <Guarded href="/review-queue"><ReviewQueue /></Guarded>}</Route>
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

function AuthGate() {
  const { status } = useAuth();
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-rose-50 via-white to-blue-50">
        <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-400" /> Checking your session...
        </div>
      </div>
    );
  }
  if (status === "anon") return <LoginPage />;
  return (
    <AppStateProvider>
      <RoleSync />
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </AppStateProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
