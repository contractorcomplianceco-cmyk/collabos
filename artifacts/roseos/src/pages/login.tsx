import { useState } from "react";
import { Lock, LogIn, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import collabosLogo from "@/assets/collabos-logo.png";

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
                placeholder="you@ccacontact.com"
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
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Staff access
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Sign in with your approved <span className="font-medium">@ccacontact.com</span> staff email.
              Admin-created accounts may require a password change on first login; staff bootstrap accounts use your assigned password.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Need access or a password reset? Contact Carmen.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
