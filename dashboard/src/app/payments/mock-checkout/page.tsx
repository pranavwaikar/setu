'use client';

import { useState, useEffect } from 'react';
import { CreditCard, ShieldCheck, RefreshCw, XCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../../../lib/api';

export default function MockCheckout() {
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isTestMode, setIsTestMode] = useState(false);
  const [plan, setPlan] = useState<'PRO' | 'ENTERPRISE'>('PRO');

  // Card details mock states
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [cardExpiry, setCardExpiry] = useState('12/29');
  const [cardCvv, setCardCvv] = useState('123');
  const [cardName, setCardName] = useState('Setu Developer');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setUserId(params.get('userId') || '');
      setEmail(params.get('email') || '');
      setIsTestMode(params.get('testMode') === 'true');
      setPlan(params.get('plan') === 'ENTERPRISE' ? 'ENTERPRISE' : 'PRO');
    }
  }, []);

  const handleSimulatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      // Simulate API success
      await api.simulatePaymentSuccess(plan);
      setIsSuccess(true);
      
      // Notify parent overlay iframe if present
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'payment_success' }, '*');
      } else {
        // Fallback for standalone window
        setTimeout(() => {
          window.location.href = '/?status=success';
        }, 1500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Payment simulation failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'payment_cancel' }, '*');
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md bg-zinc-950/60 backdrop-blur-xl border border-zinc-900 rounded-2xl p-8 shadow-2xl relative z-10">
        
        {/* Sandbox Indicator */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-semibold mb-6 select-none">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
          </span>
          Dodo Payments Test Sandbox
        </div>

        {isTestMode && (
          <div className="mb-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/25 text-yellow-400 text-xs space-y-1 animate-fadeIn">
            <span className="font-extrabold flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
              ⚠️ Simulated Test Mode Active
            </span>
            <p className="text-zinc-300 leading-relaxed">
              This environment is not accepting real payments. Real transactions will not be processed, and this is purely a sandbox simulation.
            </p>
          </div>
        )}

        {isSuccess ? (
          <div className="text-center py-8 space-y-4 animate-fadeIn">
            <div className="mx-auto h-16 w-16 bg-green-500/10 border border-green-500/25 rounded-full flex items-center justify-center text-green-400">
              <CheckCircle2 className="h-10 w-10 animate-bounce" />
            </div>
            <h2 className="text-xl font-bold text-white">Payment Successful!</h2>
            <p className="text-zinc-400 text-sm">
              Your account is upgrading. Closing checkout session...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSimulatePayment} className="space-y-6">
            <div>
              <h2 className="text-xl font-extrabold text-white">Setu {plan} Subscription</h2>
              <p className="text-xs text-zinc-400 mt-1">
                {plan === 'ENTERPRISE'
                  ? 'Managed subdomain deployment for entire org'
                  : 'Expose up to 50 concurrent subdomains'
                }
              </p>
            </div>

            {/* Order Details Summary */}
            <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Plan</span>
                <span className="font-semibold text-zinc-200">Setu {plan} Plan</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Account</span>
                <span className="font-semibold text-zinc-200 truncate max-w-[200px]">{email || 'Anonymous'}</span>
              </div>
              <hr className="border-zinc-900 my-1" />
              <div className="flex justify-between text-sm">
                <span className="font-bold text-zinc-400">Amount Due</span>
                <span className="font-extrabold text-purple-400">
                  {plan === 'ENTERPRISE' ? '$250.00' : '$5.00'}{' '}
                  <span className="text-[10px] text-zinc-500 font-normal">/ mo</span>
                </span>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <XCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Mock Credit Card Fields */}
            <div className="space-y-3">
              <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Payment Details</span>
              
              <div className="relative">
                <input
                  type="text"
                  required
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="Card Number"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:border-purple-500 text-white"
                />
                <CreditCard className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(e.target.value)}
                  placeholder="MM/YY"
                  className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:border-purple-500 text-white"
                />
                <input
                  type="text"
                  required
                  value={cardCvv}
                  onChange={(e) => setCardCvv(e.target.value)}
                  placeholder="CVV"
                  className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:border-purple-500 text-white"
                />
              </div>

              <input
                type="text"
                required
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="Cardholder Name"
                className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:border-purple-500 text-white"
              />
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Simulate Payment Success
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCancel}
                disabled={isLoading}
                className="w-full py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                Cancel Payment
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
