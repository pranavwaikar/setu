'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { RefreshCw, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { api } from '../../lib/api';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setErrorMsg('Password reset token is missing. Please check your email link.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!password) {
      setErrorMsg('Please enter a new password.');
      return;
    }
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      await api.resetPassword(token, password);
      setSuccessMsg('Password reset successfully! Redirecting to login...');
      setTimeout(() => {
        router.push('/login');
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md glass rounded-2xl p-8 z-10 border border-zinc-800 bg-zinc-950/80 backdrop-blur-md shadow-2xl">
      <Link href="/login" className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-300 text-xs mb-6 transition-colors">
        <ArrowLeft className="h-3 w-3" />
        <span>Back to Sign In</span>
      </Link>

      <div className="flex flex-col items-center mb-8">
        <img src="/setu-logo.png" alt="Setu Logo" className="h-20 w-20 rounded-2xl object-contain mb-4 shadow-[0_0_20px_rgba(168,85,247,0.3)]" />
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
          Reset Password
        </h1>
        <p className="text-muted-foreground text-sm mt-2 text-center">
          Enter and confirm your new password below
        </p>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
            New Password
          </label>
          <input
            type="password"
            required
            disabled={!token}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all text-white disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
            Confirm New Password
          </label>
          <input
            type="password"
            required
            disabled={!token}
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all text-white disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !token}
          className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800/50 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors cursor-pointer flex items-center justify-center"
        >
          {loading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            'Reset Password'
          )}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-[#09090b] relative min-h-screen">
      {/* Glow circles */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

      <Suspense fallback={
        <div className="w-full max-w-md glass rounded-2xl p-8 z-10 border border-zinc-800 bg-zinc-950/80 backdrop-blur-md shadow-2xl text-center flex flex-col items-center py-8">
          <RefreshCw className="h-12 w-12 text-purple-500 animate-spin mb-4" />
          <p className="text-zinc-400 text-sm">Loading...</p>
        </div>
      }>
        <ResetPasswordContent />
      </Suspense>
    </div>
  );
}
