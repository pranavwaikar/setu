'use client';

import { useState } from 'react';
import Link from 'next/link';
import { RefreshCw, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { api } from '../../lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      await api.forgotPassword(email);
      setSuccessMsg('If an account exists with this email, a password reset link has been sent.');
      setEmail('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-[#09090b] relative min-h-screen">
      {/* Glow circles */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md glass rounded-2xl p-8 z-10 border border-zinc-800 bg-zinc-950/80 backdrop-blur-md shadow-2xl">
        <Link href="/login" className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-300 text-xs mb-6 transition-colors">
          <ArrowLeft className="h-3 w-3" />
          <span>Back to Sign In</span>
        </Link>

        <div className="flex flex-col items-center mb-8">
          <img src="/setu-logo.png" alt="Setu Logo" className="h-20 w-20 rounded-2xl object-contain mb-4 shadow-[0_0_20px_rgba(168,85,247,0.3)]" />
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
            Forgot Password
          </h1>
          <p className="text-muted-foreground text-sm mt-2 text-center">
            Enter your email and we'll send you a password reset link
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
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all text-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-colors cursor-pointer flex items-center justify-center"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              'Send Reset Link'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
