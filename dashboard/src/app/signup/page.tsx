'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    // Check if already authenticated
    api.me()
      .then(() => router.push('/'))
      .catch(() => {});
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !firstName || !lastName || !agreed) return;
    setErrorMsg(null);
    setLoading(true);

    try {
      await api.register(email, password, firstName, lastName);
      setSuccessMsg('Account created successfully! Redirecting to login...');
      setTimeout(() => {
        router.push('/login');
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed');
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-[#09090b] relative min-h-screen">
      {/* Glow circles */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md glass rounded-2xl p-8 z-10 border border-zinc-800 bg-zinc-950/80 backdrop-blur-md shadow-2xl">
        <Link href="/" className="flex flex-col items-center mb-8 hover:opacity-90 transition-opacity">
          <img src="/setu-logo.png" alt="Setu Logo" className="h-20 w-20 rounded-2xl object-contain mb-4 shadow-[0_0_20px_rgba(168,85,247,0.3)]" />
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
            Create Account
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            Get started exposing local services securely
          </p>
        </Link>

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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                First Name
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="John"
                className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                Last Name
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Cena"
                className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all text-white"
              />
            </div>
          </div>
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
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all text-white"
            />
          </div>

          <div className="flex items-start gap-2.5 mt-2">
            <input
              id="agree-checkbox"
              type="checkbox"
              required
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-zinc-800 bg-zinc-900 text-purple-600 focus:ring-purple-500/30 accent-purple-600 cursor-pointer"
            />
            <label htmlFor="agree-checkbox" className="text-xs text-zinc-400 leading-normal cursor-pointer select-none">
              I agree to the{' '}
              <a
                href="https://github.com/pranavwaikar/setu/blob/main/legal-and-compliance/terms-of-use.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 underline"
              >
                Terms of Use
              </a>
              ,{' '}
              <a
                href="https://github.com/pranavwaikar/setu/blob/main/legal-and-compliance/privacy-policy.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 underline"
              >
                Privacy Policy
              </a>
              ,{' '}
              <a
                href="https://github.com/pranavwaikar/setu/blob/main/legal-and-compliance/trademark.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 underline"
              >
                Trademark Policy
              </a>
              , and{' '}
              <a
                href="https://github.com/pranavwaikar/setu/blob/main/legal-and-compliance/data-compliance.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 underline"
              >
                Data Compliance Statement
              </a>
              . I understand that this is an open-source demo and Helios Logic holds no responsibility.
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !agreed}
            className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800/50 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors cursor-pointer flex items-center justify-center"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-xs">
          <button
            onClick={() => router.push('/login')}
            className="text-purple-400 hover:text-purple-300 font-medium underline cursor-pointer"
          >
            Already have an account? Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
