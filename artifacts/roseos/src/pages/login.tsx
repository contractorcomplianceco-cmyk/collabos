import { useState } from "react";
import { Lock, LogIn, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import collabosLogo from "@/assets/collabos-logo.png";

const DEMO_ACCOUNTS = [
  { label: "Rose · Founder Admin", email: "rose@collabos.demo", password: "rose-demo-2026" },
  { label: "Carmen · Systems Admin", email: "carmen@collabos.demo", password: "carmen-demo-2026" },
  { label: "Super Admin", email: "admin@collabos.demo", password: "admin-demo-2026" },
  { label: "Leadership Reviewer", email: "lena@collabos.demo", password: "lena-demo-2026" },
  { label: "Contributor", email: "devon@collabos.demo", password: "devon-demo-2026" },
  { label: "Viewer", email: "viewer@collabos.demo", password: "viewer-demo-2026" },
  { label: "Guest", email: "guest@collabos.demo", password: "guest-demo-2026" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-rose-50 via-white to-blue-50 p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl md:grid-cols-2">
        <div className="flex flex-col justify-between bg-gradient-to-br from-rose-500 via-rose-500 to-blue-500 p-8 text-white">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
              <ShieldCheck className="h-3.5 w-3.5" /> Secure workspace sign-in
            </div>
            <h1 className="text-2xl font-bold leading-snug">CollabOS Command Center</h1>
            <p className="mt-2 text-sm text-white/85">
              Real accounts, real permissions. What you can see and do inside is decided by your
              role — approvals, sensitive content, and admin tools are locked server-side.
            </p>
          </div>
          <div className="mt-8 space-y-2 text-xs text-white/80">
            <p className="flex items-center gap-2"><Lock className="h-3.5 w-3.5" /> Sessions are verified on every request</p>
            <p className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" /> Every important action is written to the audit log</p>
          </div>
        </div>
        <div className="p-8">
          <div className="mb-6 flex justify-center">
            <img src={collabosLogo} alt="CollabOS Command Center logo" className="w-40 object-contain" />
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label htmlFor="login-email" className="mb-1 block text-xs font-semibold text-slate-600">Email</label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field-input w-full"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="mb-1 block text-xs font-semibold text-slate-600">Password</label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-input w-full"
                placeholder="••••••••"
              />
            </div>
            {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
            >
              <LogIn className="h-4 w-4" /> {busy ? "Signing in..." : "Sign in"}
            </button>
          </form>
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Demo workspace — preloaded demo accounts
            </p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => { setEmail(a.email); setPassword(a.password); setError(null); }}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-[11px] text-slate-600 transition hover:border-rose-200 hover:text-rose-600"
                >
                  <span className="block font-semibold">{a.label}</span>
                  <span className="block truncate text-[10px] text-slate-400">{a.email}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-slate-400">
              Click an account to fill the form. These are demo credentials for exploring role-based access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
