'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('Verification token is missing.');
      return;
    }

    api.verifyEmail(token)
      .then(() => {
        setStatus('success');
      })
      .catch((err) => {
        setStatus('error');
        setErrorMsg(err.message || 'Verification failed. The token may be invalid or expired.');
      });
  }, [token]);

  return (
    <div className="w-full max-w-md glass rounded-2xl p-8 z-10 border border-zinc-800 bg-zinc-950/80 backdrop-blur-md shadow-2xl text-center">
      <div className="flex flex-col items-center mb-6">
        <img src="/setu-logo.png" alt="Setu Logo" className="h-20 w-20 rounded-2xl object-contain mb-4 shadow-[0_0_20px_rgba(168,85,247,0.3)]" />
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
          Email Verification
        </h1>
      </div>

      {status === 'loading' && (
        <div className="flex flex-col items-center py-8">
          <RefreshCw className="h-12 w-12 text-purple-500 animate-spin mb-4" />
          <p className="text-zinc-400 text-sm">Verifying your email address, please wait...</p>
        </div>
      )}

      {status === 'success' && (
        <div className="py-6">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Verification Complete!</h2>
          <p className="text-zinc-400 text-sm mb-6">
            Your email has been successfully verified. You can now log in to your account.
          </p>
          <Link
            href="/login"
            className="inline-block w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-colors text-center"
          >
            Sign In
          </Link>
        </div>
      )}

      {status === 'error' && (
        <div className="py-6">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Verification Failed</h2>
          <p className="text-red-400 text-xs mb-6 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
            {errorMsg}
          </p>
          <Link
            href="/signup"
            className="inline-block w-full py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-medium text-sm transition-colors text-center"
          >
            Back to Sign Up
          </Link>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
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
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
