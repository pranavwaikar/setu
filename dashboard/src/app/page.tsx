'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Terminal,
  Globe,
  Key,
  Layers,
  Lock,
  Plus,
  Trash2,
  Copy,
  Check,
  LogOut,
  User as UserIcon,
  RefreshCw,
  Activity,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Mail,
  Shield
} from 'lucide-react';
import { api, User, Subdomain, ApiKey, Tunnel } from '../lib/api';

export default function Home() {
  // Navigation & Session State
  const [authStatus, setAuthStatus] = useState<'loading' | 'unauthenticated' | 'authenticated'>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'tunnels' | 'subdomains' | 'api-keys' | 'instructions' | 'profile' | 'billing'>('tunnels');
  const [showMockCheckout, setShowMockCheckout] = useState(false);
  const [mockCheckoutUrl, setMockCheckoutUrl] = useState('');
  const [isCheckoutTestMode, setIsCheckoutTestMode] = useState(false);
  
  // Forms & Inputs
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [subdomainInput, setSubdomainInput] = useState('');
  
  // Data State
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [subdomains, setSubdomains] = useState<Subdomain[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  
  // UI UX States
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [newGeneratedKey, setNewGeneratedKey] = useState<string | null>(null);

  // Dynamic Domain Detection
  // Initial value comes from the build-time env var so SSR/first-paint is correct.
  // The useEffect below then syncs it to the actual browser hostname at runtime.
  const [baseDomain, setBaseDomain] = useState(
    process.env.NEXT_PUBLIC_TUNNEL_DOMAIN || 'setu.helios-logic.com'
  );
  const [baseDomainWithPort, setBaseDomainWithPort] = useState(
    process.env.NEXT_PUBLIC_TUNNEL_DOMAIN || 'setu.helios-logic.com'
  );
  const [protocol, setProtocol] = useState('https:');

  // Authenticate user on load
  useEffect(() => {
    checkAuth();
    if (typeof window !== 'undefined') {
      setBaseDomain(window.location.hostname);
      setBaseDomainWithPort(window.location.host);
      setProtocol(window.location.protocol);

      const params = new URLSearchParams(window.location.search);
      if (params.get('tab') === 'billing' || params.get('status') === 'success') {
        setActiveTab('billing');
      }
      if (params.get('status') === 'success') {
        showSuccess('Payment successful! Your account has been upgraded to PRO.');
        checkAuth();
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const handlePaymentMessage = (event: MessageEvent) => {
        if (event.data?.type === 'payment_success') {
          setShowMockCheckout(false);
          setMockCheckoutUrl('');
          showSuccess('Successfully upgraded to PRO plan!');
          checkAuth();
        } else if (event.data?.type === 'payment_cancel') {
          setShowMockCheckout(false);
          setMockCheckoutUrl('');
        }
      };

      window.addEventListener('message', handlePaymentMessage);
      return () => window.removeEventListener('message', handlePaymentMessage);
    }
  }, []);

  const handleUpgradeToPro = async () => {
    setLoadingAction('upgrade');
    setErrorMsg(null);
    try {
      const res = await api.createCheckoutSession();
      setIsCheckoutTestMode(!!res.isTestMode);
      if (res.isMock) {
        setMockCheckoutUrl(res.checkoutUrl);
        setShowMockCheckout(true);
      } else {
        if (typeof (window as any).DodoPayments !== 'undefined') {
          (window as any).DodoPayments.open({
            checkoutUrl: res.checkoutUrl,
          });
        } else {
          window.open(res.checkoutUrl, '_blank');
        }
      }
    } catch (err: any) {
      showError(err.message || 'Failed to start upgrade process');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription? Your plan will be downgraded to Free immediately.')) {
      return;
    }
    setLoadingAction('cancel');
    setErrorMsg(null);
    try {
      await api.cancelSubscription();
      showSuccess('Subscription cancelled and plan downgraded to Free.');
      await checkAuth();
    } catch (err: any) {
      showError(err.message || 'Failed to cancel subscription');
    } finally {
      setLoadingAction(null);
    }
  };

  // Poll active tunnels periodically if authenticated
  useEffect(() => {
    if (authStatus === 'authenticated') {
      const interval = setInterval(fetchTunnels, 5000);
      return () => clearInterval(interval);
    }
  }, [authStatus]);

  const checkAuth = async () => {
    try {
      const u = await api.me();
      setUser(u);
      setAuthStatus('authenticated');
      // Fetch initial data
      fetchData();
    } catch (err) {
      setAuthStatus('unauthenticated');
    }
  };

  const fetchData = async () => {
    try {
      const [t, s, k, h] = await Promise.all([
        api.listTunnels(),
        api.listSubdomains(),
        api.listApiKeys(),
        api.getPaymentHistory()
      ]);
      setTunnels(t);
      setSubdomains(s);
      setApiKeys(k);
      setPaymentHistory(h);
    } catch (err: any) {
      showError(err.message || 'Failed to fetch data');
    }
  };

  const fetchTunnels = async () => {
    try {
      const t = await api.listTunnels();
      setTunnels(t);
    } catch (_) {}
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Auth actions
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setErrorMsg(null);
    setLoadingAction('auth');

    try {
      if (authMode === 'login') {
        const res = await api.login(email, password);
        setUser(res.user);
        setAuthStatus('authenticated');
        showSuccess('Logged in successfully!');
        fetchData();
      } else {
        await api.register(email, password, firstName, lastName);
        setAuthMode('login');
        showSuccess('Account created! Please log in.');
        setFirstName('');
        setLastName('');
      }
      setPassword('');
    } catch (err: any) {
      showError(err.message || 'Authentication failed');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      setUser(null);
      setAuthStatus('unauthenticated');
      setNewGeneratedKey(null);
    } catch (err: any) {
      showError('Logout failed');
    }
  };

  // Subdomain actions
  const handleClaimSubdomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subdomainInput) return;
    setLoadingAction('claim');
    setErrorMsg(null);

    try {
      const newSub = await api.claimSubdomain(subdomainInput);
      setSubdomains([newSub, ...subdomains]);
      setSubdomainInput('');
      showSuccess(`Subdomain '${newSub.hostname}' claimed successfully!`);
    } catch (err: any) {
      showError(err.message || 'Failed to claim subdomain');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleReleaseSubdomain = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to release the subdomain ${name}? All active tunnels mapping to it will disconnect.`)) return;
    setLoadingAction(`release-${id}`);

    try {
      await api.releaseSubdomain(id);
      setSubdomains(subdomains.filter(s => s.id !== id));
      // Refresh tunnels since some might go offline
      fetchTunnels();
      showSuccess(`Released subdomain ${name}`);
    } catch (err: any) {
      showError(err.message || 'Failed to release subdomain');
    } finally {
      setLoadingAction(null);
    }
  };

  // API Key actions
  const handleGenerateApiKey = async () => {
    setLoadingAction('generate-key');
    setErrorMsg(null);
    setNewGeneratedKey(null);

    try {
      const newKey = await api.generateApiKey();
      setApiKeys([newKey, ...apiKeys]);
      setNewGeneratedKey(newKey.key || null);
      showSuccess('API Key generated successfully! Make sure to copy it now.');
    } catch (err: any) {
      showError(err.message || 'Failed to generate API Key');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API Key? Any CLI currently using it will be disconnected.')) return;
    setLoadingAction(`revoke-${id}`);

    try {
      await api.revokeApiKey(id);
      setApiKeys(apiKeys.filter(k => k.id !== id));
      showSuccess('API Key revoked');
    } catch (err: any) {
      showError(err.message || 'Failed to revoke API Key');
    } finally {
      setLoadingAction(null);
    }
  };

  // Loading screen
  if (authStatus === 'loading') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#09090b] text-[#fafafa]">
        <RefreshCw className="h-8 w-8 text-purple-500 animate-spin mb-4" />
        <p className="text-muted-foreground text-sm">Loading your Setu workspace...</p>
      </div>
    );
  }

  // Unauthenticated Developer Landing Page
  if (authStatus === 'unauthenticated') {
    return (
      <div className="flex-1 flex flex-col bg-[#09090b] text-[#fafafa] relative min-h-screen overflow-y-auto">
        {/* Glow circles */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Navigation Bar */}
        <nav className="w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between border-b border-zinc-900 z-10">
          <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <img src="/setu-logo.png" alt="Setu Logo" className="h-12 w-12 rounded-xl object-contain" />
            <span className="font-extrabold tracking-tight text-2xl bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent font-sans">
              Setu
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <a 
              href="https://github.com/pranavwaikar/setu" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold transition-all hover:text-white text-zinc-300"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub
            </a>
            <a 
              href="https://github.com/pranavwaikar/setu/actions"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-block"
            >
              <img src="https://img.shields.io/github/actions/workflow/status/pranavwaikar/setu/release.yml?label=build&style=flat-square&color=8b5cf6" alt="Build Status" />
            </a>
            <Link 
              href="/login"
              className="text-xs font-semibold text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              Sign In
            </Link>
            <Link 
              href="/signup"
              className="text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] shrink-0"
            >
              Sign Up
            </Link>
          </div>
        </nav>

        {/* Hero Section */}
        <main className="w-full max-w-5xl mx-auto px-6 py-20 flex flex-col items-center justify-center text-center z-10 flex-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium mb-8">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
            </span>
            <span>Open Source Dev Tunnel CLI</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-b from-white via-white to-zinc-500 bg-clip-text text-transparent max-w-3xl leading-tight">
            Secure developer tunnels with zero config.
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base max-w-xl mt-6 leading-relaxed">
            Expose local projects running on any port to the public internet securely. Includes wildcard subdomains, persistent routing, and a clean setup panel.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
            <Link 
              href="/signup"
              className="px-6 py-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-all shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] cursor-pointer"
            >
              Get Started for Free
            </Link>
            <Link 
              href="/login"
              className="px-6 py-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-semibold text-sm transition-all hover:text-white cursor-pointer"
            >
              Access Dashboard
            </Link>
          </div>
          <p className="text-zinc-500 text-xs mt-4 select-none font-medium">
            ⚡ Always free. Claim up to 10 subdomains of your choice.
          </p>

          {/* Interactive Mock Terminal */}
          <div className="w-full max-w-2xl mt-16 text-left rounded-xl border border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/40 border-b border-zinc-900">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500/40 inline-block"></span>
                <span className="w-3 h-3 rounded-full bg-yellow-500/40 inline-block"></span>
                <span className="w-3 h-3 rounded-full bg-green-500/40 inline-block"></span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono font-medium">bash — setu tunnel installation</span>
            </div>
            <div className="p-5 font-mono text-xs text-zinc-300 space-y-4 overflow-x-auto leading-relaxed">
              <div>
                <span className="text-zinc-500"># Install the lightweight binary</span>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-purple-400">$ <span className="text-zinc-200">curl -fsSL https://raw.githubusercontent.com/pranavwaikar/setu/main/scripts/install.sh | bash</span></span>
                  <button 
                    onClick={() => handleCopy('curl -fsSL https://raw.githubusercontent.com/pranavwaikar/setu/main/scripts/install.sh | bash', 'install-cmd')}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors uppercase font-bold px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-900/50"
                  >
                    {copiedText === 'install-cmd' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <div>
                <span className="text-zinc-500"># Authenticate client</span>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-purple-400">$ <span className="text-zinc-200">setu login</span></span>
                  <button 
                    onClick={() => handleCopy('setu login', 'login-cmd')}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors uppercase font-bold px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-900/50"
                  >
                    {copiedText === 'login-cmd' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <div>
                <span className="text-zinc-500"># Expose any local server (e.g. port 3000)</span>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-purple-400">$ <span className="text-zinc-200">setu expose 3000 --subdomain my-app</span></span>
                  <button 
                    onClick={() => handleCopy('setu expose 3000 --subdomain my-app', 'expose-cmd')}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors uppercase font-bold px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-900/50"
                  >
                    {copiedText === 'expose-cmd' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="text-zinc-500 mt-2 text-[10px]">
                  {`> Exposing 127.0.0.1:3000 -> https://my-app-jhon-cena.${baseDomain}`}
                </div>
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-24">
            <div className="p-6 rounded-xl border border-zinc-900 bg-zinc-950/40 text-left">
              <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20 mb-4">
                <Globe className="h-4.5 w-4.5 text-purple-400" />
              </div>
              <h3 className="text-sm font-bold text-white">Wildcard Routing</h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                Connect and reserve up to 10 custom user subdomains of your choice for free under {baseDomain}. Expose web apps, APIs, and hooks instantly.
              </p>
            </div>
            <div className="p-6 rounded-xl border border-zinc-900 bg-zinc-950/40 text-left">
              <div className="h-9 w-9 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 mb-4">
                <Layers className="h-4.5 w-4.5 text-indigo-400" />
              </div>
              <h3 className="text-sm font-bold text-white">Connection Multiplexing</h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                Utilizes high-speed Yamux connection multiplexing over secure WebSocket streams to route hundreds of streams simultaneously.
              </p>
            </div>
            <div className="p-6 rounded-xl border border-zinc-900 bg-zinc-950/40 text-left">
              <div className="h-9 w-9 rounded-lg bg-pink-500/10 flex items-center justify-center border border-pink-500/20 mb-4">
                <Lock className="h-4.5 w-4.5 text-pink-400" />
              </div>
              <h3 className="text-sm font-bold text-white">Secure by Default</h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                All external traffic runs over secure SSL/TLS. Tunnels require validation using cryptographically signed private API Keys.
              </p>
            </div>
          </div>
          {/* Pricing Section */}
          <div className="w-full mt-32 text-center z-10" id="pricing">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-6">
              <span>Flexible Plans</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-b from-white via-white to-zinc-500 bg-clip-text text-transparent max-w-2xl mx-auto leading-tight">
              Fair pricing for any scale.
            </h2>
            <p className="text-zinc-400 text-xs sm:text-sm max-w-md mx-auto mt-4 leading-relaxed">
              Start exposing your local servers for free, then upgrade as your organization grows.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl mx-auto mt-16 text-left">
              {/* Free Plan */}
              <div className="p-8 rounded-2xl border border-zinc-900 bg-zinc-950/40 flex flex-col justify-between hover:border-zinc-800 transition-all hover:scale-[1.01] duration-300 relative group">
                <div>
                  <h3 className="text-lg font-bold text-white">Free Plan</h3>
                  <p className="text-zinc-500 text-xs mt-1">For individuals and side projects.</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-white">$0</span>
                    <span className="text-zinc-500 text-xs">/ month</span>
                  </div>
                  <ul className="mt-8 space-y-4 text-xs text-zinc-400">
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-purple-500 shrink-0" />
                      <span>Claim up to 10 static subdomains</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-purple-500 shrink-0" />
                      <span>Secure SSL/HTTPS connections</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-purple-500 shrink-0" />
                      <span>High-speed websocket tunnels</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-purple-500 shrink-0" />
                      <span>Real-time inspector dashboard</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-8 pt-4">
                  <Link
                    href="/signup"
                    className="block w-full py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-center font-bold text-xs text-zinc-200 transition-colors border border-zinc-800"
                  >
                    Get Started for Free
                  </Link>
                </div>
              </div>

              {/* Pro Plan */}
              <div className="p-8 rounded-2xl border border-purple-500/30 bg-zinc-950/80 flex flex-col justify-between hover:border-purple-500/50 transition-all hover:scale-[1.02] duration-300 relative shadow-[0_0_30px_rgba(168,85,247,0.05)] overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-[40px] pointer-events-none" />
                <div className="absolute top-4 right-4 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-bold tracking-wider uppercase">
                  Popular
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Pro Plan
                  </h3>
                  <p className="text-zinc-500 text-xs mt-1">For professional developers needing more capacity.</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-white">$5</span>
                    <span className="text-zinc-500 text-xs">/ month</span>
                  </div>
                  <ul className="mt-8 space-y-4 text-xs text-zinc-400">
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-purple-500 shrink-0" />
                      <span className="font-semibold text-zinc-200">50 concurrent endpoints / user</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-purple-500 shrink-0" />
                      <span>Custom domain options</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-purple-500 shrink-0" />
                      <span>Edge protection (Basic Auth)</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-purple-500 shrink-0" />
                      <span>Layer-4 raw TCP tunneling</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-purple-500 shrink-0" />
                      <span>Priority support</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-8 pt-4">
                  <Link
                    href="/signup"
                    className="block w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-center font-bold text-xs text-white transition-all shadow-[0_0_15px_rgba(168,85,247,0.25)]"
                  >
                    Upgrade to Pro
                  </Link>
                </div>
              </div>

              {/* Enterprise Plan */}
              <div className="p-8 rounded-2xl border border-zinc-900 bg-zinc-950/40 flex flex-col justify-between hover:border-zinc-800 transition-all hover:scale-[1.01] duration-300 relative">
                <div>
                  <h3 className="text-lg font-bold text-white">Enterprise Plan</h3>
                  <p className="text-zinc-500 text-xs mt-1">For organizations requiring complete security control.</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-white">$250</span>
                    <span className="text-zinc-500 text-xs">/ month</span>
                  </div>
                  <ul className="mt-8 space-y-4 text-xs text-zinc-400">
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-purple-500 shrink-0" />
                      <span className="font-semibold text-zinc-200">Managed subdomain deployment for entire org</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-purple-500 shrink-0" />
                      <span>Dedicated tunnel gateway clusters</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-purple-500 shrink-0" />
                      <span>SLA guaranteed uptime</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-purple-500 shrink-0" />
                      <span>Custom authentication integrations</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-purple-500 shrink-0" />
                      <span>24/7 dedicated support team</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-8 pt-4">
                  <a
                    href="mailto:sales@contact.helios-logic.com?subject=Setu Enterprise Plan Query"
                    className="block w-full py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-center font-bold text-xs text-zinc-200 transition-colors border border-zinc-800"
                  >
                    Contact Sales
                  </a>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="w-full border-t border-zinc-900 py-10 bg-zinc-950/40 text-center text-xs text-zinc-500 z-10">
          <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <img src="/setu-logo.png" alt="Setu Logo" className="h-6 w-6 rounded-md" />
                <span className="font-bold text-zinc-300">Setu</span>
              </div>
              <p className="text-zinc-500 text-[11px] leading-relaxed">
                Securely and instantly expose your local servers to the public internet. Operated by Helios Logic as an open-source development demonstration.
              </p>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">Legal & Compliance</h4>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <a href="https://github.com/pranavwaikar/setu/blob/main/legal-and-compliance/terms-of-use.md" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">Terms of Use</a>
                <a href="https://github.com/pranavwaikar/setu/blob/main/legal-and-compliance/privacy-policy.md" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">Privacy Policy</a>
                <a href="https://github.com/pranavwaikar/setu/blob/main/legal-and-compliance/trademark.md" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">Trademark Policy</a>
                <a href="https://github.com/pranavwaikar/setu/blob/main/legal-and-compliance/data-compliance.md" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">Data Compliance</a>
                <a href="https://github.com/pranavwaikar/setu/blob/main/legal-and-compliance/data-security.md" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">Data Security</a>
                <a href="https://github.com/pranavwaikar/setu/blob/main/legal-and-compliance/payment-compliance.md" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">Payments</a>
                <a href="https://github.com/pranavwaikar/setu/blob/main/legal-and-compliance/coppa.md" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">COPPA Policy</a>
                <a href="https://github.com/pranavwaikar/setu/blob/main/legal-and-compliance/email-otp-verification.md" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">Email OTP Rules</a>
                <a href="https://github.com/pranavwaikar/setu/blob/main/legal-and-compliance/ai-disclosure.md" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">AI Disclosure</a>
                <a href="https://github.com/pranavwaikar/setu/blob/main/legal-and-compliance/accessibility-audit.md" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">Accessibility</a>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">Project</h4>
              <p className="text-zinc-500 text-[11px] leading-relaxed">
                Licensed under the <a href="https://github.com/pranavwaikar/setu/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">AGPL-3.0 License</a>. Hosted by <a href="https://helios-logic.com" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">Helios Logic</a>.
              </p>
              <p className="text-zinc-500 text-[11px] leading-relaxed mt-2">
                Need help or custom integrations? Contact us at <a href="mailto:sales@contact.helios-logic.com" className="text-purple-400 hover:underline font-semibold">sales@contact.helios-logic.com</a>.
              </p>
              <p className="text-[10px] text-zinc-600">
                © {new Date().getFullYear()} Setu / Helios Logic. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // Authenticated Dashboard
  return (
    <div className="flex-1 flex overflow-hidden bg-[#09090b] text-[#fafafa] relative">
      {/* Glow effect */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-900 flex flex-col justify-between bg-zinc-950/80 backdrop-blur-md z-10">
        <div>
          {/* Sidebar Logo */}
          <Link href="/" className="p-6 border-b border-zinc-900 flex items-center gap-3 hover:opacity-90 transition-opacity">
            <img src="/setu-logo.png" alt="Setu Logo" className="h-10 w-10 rounded-lg object-contain" />
            <span className="font-bold tracking-tight text-xl bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              Setu Tunnel
            </span>
          </Link>

          {/* Navigation links */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => setActiveTab('tunnels')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeTab === 'tunnels'
                  ? 'bg-purple-500/10 text-purple-400 border-l-2 border-purple-500 pl-2.5'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              <Activity className="h-4 w-4" />
              Active Tunnels
            </button>
            <button
              onClick={() => setActiveTab('subdomains')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeTab === 'subdomains'
                  ? 'bg-purple-500/10 text-purple-400 border-l-2 border-purple-500 pl-2.5'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              <Globe className="h-4 w-4" />
              Subdomains
            </button>
            <button
              onClick={() => setActiveTab('api-keys')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeTab === 'api-keys'
                  ? 'bg-purple-500/10 text-purple-400 border-l-2 border-purple-500 pl-2.5'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              <Key className="h-4 w-4" />
              API Keys
            </button>
            <button
              onClick={() => setActiveTab('instructions')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeTab === 'instructions'
                  ? 'bg-purple-500/10 text-purple-400 border-l-2 border-purple-500 pl-2.5'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              <Terminal className="h-4 w-4" />
              CLI Instructions
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-purple-500/10 text-purple-400 border-l-2 border-purple-500 pl-2.5'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              <UserIcon className="h-4 w-4" />
              Developer Profile
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeTab === 'billing'
                  ? 'bg-purple-500/10 text-purple-400 border-l-2 border-purple-500 pl-2.5'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              <CreditCard className="h-4 w-4" />
              Billing & Subscriptions
            </button>
          </nav>
        </div>

        {/* User context footer */}
        <div className="p-4 border-t border-zinc-900 space-y-3 bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center">
              <UserIcon className="h-4 w-4 text-zinc-400" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold truncate">{user?.email}</p>
              <p className={`text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded border inline-block mt-0.5 ${
                user?.plan === 'PRO'
                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                  : user?.plan === 'ENTERPRISE'
                  ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800'
              }`}>
                {user?.plan} PLAN
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300 transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto bg-zinc-950/40 z-10">
        {/* Header */}
        <header className="h-16 border-b border-zinc-900 flex items-center justify-between px-8 bg-zinc-950/40 backdrop-blur-md">
          <h2 className="font-semibold text-zinc-200">
            {activeTab === 'tunnels' && 'Tunnels Overview'}
            {activeTab === 'subdomains' && 'Manage Subdomains'}
            {activeTab === 'api-keys' && 'API Keys Management'}
            {activeTab === 'instructions' && 'CLI Integration Guide'}
            {activeTab === 'profile' && 'Developer Profile'}
            {activeTab === 'billing' && 'Billing & Subscriptions'}
          </h2>

          {/* Quick info */}
          <div className="flex items-center gap-4 text-xs">
            <div className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Gateway: Active
            </div>
          </div>
        </header>

        {/* Dashboard Panels */}
        <div className="p-8 max-w-5xl w-full mx-auto space-y-6">
          {errorMsg && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3 animate-pulse">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Card Overview stats */}
          {activeTab !== 'instructions' && activeTab !== 'profile' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass rounded-xl p-5 relative overflow-hidden">
                <div className="absolute top-4 right-4 text-purple-500/20">
                  <Activity className="h-10 w-10" />
                </div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Tunnels</p>
                <h3 className="text-3xl font-extrabold mt-1 text-white">
                  {tunnels.filter(t => t.status === 'ONLINE').length}
                </h3>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Total configured: {tunnels.length}
                </p>
              </div>

              <div className="glass rounded-xl p-5 relative overflow-hidden">
                <div className="absolute top-4 right-4 text-purple-500/20">
                  <Globe className="h-10 w-10" />
                </div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Claimed Subdomains</p>
                <h3 className="text-3xl font-extrabold mt-1 text-white">
                  {subdomains.length} <span className="text-xs font-normal text-muted-foreground">/ {user?.plan === 'PRO' ? 50 : user?.plan === 'ENTERPRISE' ? 1000 : 10}</span>
                </h3>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Quota limit: {user?.plan === 'PRO' ? 50 : user?.plan === 'ENTERPRISE' ? '1,000' : '10'} subdomains
                </p>
              </div>

              <div className="glass rounded-xl p-5 relative overflow-hidden">
                <div className="absolute top-4 right-4 text-purple-500/20">
                  <Layers className="h-10 w-10" />
                </div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Authentication Keys</p>
                <h3 className="text-3xl font-extrabold mt-1 text-white">{apiKeys.length}</h3>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Used for authenticating local CLI
                </p>
              </div>
            </div>
          )}

          {/* Tab 1: Active Tunnels */}
          {activeTab === 'tunnels' && (
            <div className="glass rounded-xl p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-base font-bold text-white">Configured Tunnels</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Showing tunnels connected from the CLI</p>
                </div>
                <button
                  onClick={fetchTunnels}
                  className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>

              {tunnels.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-lg">
                  <WifiOff className="h-8 w-8 text-zinc-600 mb-3" />
                  <p className="text-zinc-400 text-sm font-medium">No tunnels online</p>
                  <p className="text-xs text-zinc-500 mt-1 max-w-sm text-center">
                    To expose local services, claim a subdomain, generate an API Key, and execute the run command in the CLI instructions tab.
                  </p>
                  <button
                    onClick={() => setActiveTab('instructions')}
                    className="mt-4 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs font-medium text-white cursor-pointer transition-colors"
                  >
                    View Setup Instructions
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-900 text-xs font-bold text-zinc-400">
                        <th className="pb-3 font-semibold">Subdomain</th>
                        <th className="pb-3 font-semibold">Local Port</th>
                        <th className="pb-3 font-semibold">Status</th>
                        <th className="pb-3 font-semibold">Connected At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900">
                      {tunnels.map(t => (
                        <tr key={t.id} className="group hover:bg-zinc-900/10">
                          <td className="py-4 font-mono font-medium text-purple-400">
                            <a
                              href={`${protocol}//${t.subdomain.hostname}.${baseDomainWithPort}`}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline flex items-center gap-1.5"
                            >
                              {t.subdomain.hostname}.{baseDomain}
                            </a>
                          </td>
                          <td className="py-4 text-zinc-300">
                            127.0.0.1:{t.localPort}
                          </td>
                          <td className="py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider ${
                              t.status === 'ONLINE' 
                                ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                                : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${t.status === 'ONLINE' ? 'bg-green-500 animate-pulse' : 'bg-zinc-500'}`} />
                              {t.status}
                            </span>
                          </td>
                          <td className="py-4 text-xs text-zinc-500">
                            {t.connectedAt ? new Date(t.connectedAt).toLocaleString() : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Subdomains */}
          {activeTab === 'subdomains' && (
            <div className="space-y-6">
              {/* Claim Subdomain Card */}
              <div className="glass rounded-xl p-6">
                <h3 className="text-base font-bold text-white">Claim a New Subdomain</h3>
                <p className="text-xs text-muted-foreground mt-0.5 mb-4">
                  Subdomain names must be unique and can consist of letters, numbers, and hyphens.
                </p>

                <form onSubmit={handleClaimSubdomain} className="flex gap-3 max-w-lg">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      required
                      value={subdomainInput}
                      onChange={e => setSubdomainInput(e.target.value)}
                      placeholder="e.g. staging-app"
                      className="w-full pl-4 pr-36 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm font-mono focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all text-white"
                    />
                    <div className="absolute inset-y-0 right-3 flex items-center text-xs text-zinc-500 select-none">
                      .{baseDomain}
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loadingAction === 'claim' || subdomains.length >= (user?.plan === 'PRO' ? 50 : user?.plan === 'ENTERPRISE' ? 1000 : 10)}
                    className="px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 shrink-0"
                  >
                    {loadingAction === 'claim' ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Claim Subdomain
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Subdomain List */}
              <div className="glass rounded-xl p-6">
                <h3 className="text-base font-bold text-white mb-6">Your Claimed Subdomains</h3>

                {subdomains.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-lg">
                    <Globe className="h-8 w-8 text-zinc-600 mb-3" />
                    <p className="text-zinc-400 text-sm font-medium">No claimed subdomains yet</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      Enter a name above and click "Claim Subdomain" to secure yours.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-900 text-xs font-bold text-zinc-400">
                          <th className="pb-3 font-semibold">Hostname</th>
                          <th className="pb-3 font-semibold">Status</th>
                          <th className="pb-3 font-semibold">Created At</th>
                          <th className="pb-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900">
                        {subdomains.map(s => (
                          <tr key={s.id} className="group hover:bg-zinc-900/10">
                            <td className="py-4 font-mono font-medium text-zinc-200">
                              {s.hostname}.{baseDomain}
                            </td>
                            <td className="py-4">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-green-500/10 text-green-400 border border-green-500/20">
                                {s.status}
                              </span>
                            </td>
                            <td className="py-4 text-xs text-zinc-500">
                              {new Date(s.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-4 text-right">
                              <button
                                onClick={() => handleReleaseSubdomain(s.id, s.hostname)}
                                disabled={loadingAction === `release-${s.id}`}
                                className="p-2 rounded-lg bg-zinc-900 hover:bg-red-500/10 hover:text-red-400 text-zinc-400 transition-all cursor-pointer border border-zinc-800 hover:border-red-500/20"
                              >
                                {loadingAction === `release-${s.id}` ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: API Keys */}
          {activeTab === 'api-keys' && (
            <div className="space-y-6">
              {newGeneratedKey && (
                <div className="p-5 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-3 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-[30px] pointer-events-none" />
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-purple-400" />
                    <h4 className="text-sm font-bold text-white">Copy your API Key</h4>
                  </div>
                  <p className="text-xs text-zinc-300">
                    For security reasons, we only show this key **once**. Copy it and keep it secure.
                  </p>
                  <div className="flex gap-2 max-w-xl bg-zinc-950 p-2.5 rounded-lg border border-zinc-900 items-center justify-between">
                    <span className="font-mono text-sm text-purple-300 break-all select-all pr-4">
                      {newGeneratedKey}
                    </span>
                    <button
                      onClick={() => handleCopy(newGeneratedKey, 'generated-key')}
                      className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-zinc-800"
                    >
                      {copiedText === 'generated-key' ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-green-400" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="glass rounded-xl p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-base font-bold text-white">API Access Keys</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Manage authentication tokens used by the CLI client</p>
                  </div>
                  <button
                    onClick={handleGenerateApiKey}
                    disabled={loadingAction === 'generate-key'}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {loadingAction === 'generate-key' ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        Generate API Key
                      </>
                    )}
                  </button>
                </div>

                {apiKeys.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-lg">
                    <Key className="h-8 w-8 text-zinc-600 mb-3" />
                    <p className="text-zinc-400 text-sm font-medium">No API Keys created yet</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      Click the "Generate API Key" button above to obtain your first key.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-900 text-xs font-bold text-zinc-400">
                          <th className="pb-3 font-semibold">Key Identifier</th>
                          <th className="pb-3 font-semibold">Created At</th>
                          <th className="pb-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900">
                        {apiKeys.map(k => (
                          <tr key={k.id} className="group hover:bg-zinc-900/10">
                            <td className="py-4 font-mono font-medium text-zinc-200">
                              key_{k.id.split('-')[0]}••••••••
                            </td>
                            <td className="py-4 text-xs text-zinc-500">
                              {new Date(k.createdAt).toLocaleString()}
                            </td>
                            <td className="py-4 text-right">
                              <button
                                onClick={() => handleRevokeApiKey(k.id)}
                                disabled={loadingAction === `revoke-${k.id}`}
                                className="p-2 rounded-lg bg-zinc-900 hover:bg-red-500/10 hover:text-red-400 text-zinc-400 transition-all cursor-pointer border border-zinc-800 hover:border-red-500/20"
                              >
                                {loadingAction === `revoke-${k.id}` ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 4: CLI Instructions */}
          {activeTab === 'instructions' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="glass rounded-xl p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white">Get Started with Setu CLI</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Follow these simple steps to configure and expose your local environment.</p>
                </div>

                <div className="space-y-6">
                  {/* Step 1: Install */}
                  <div className="flex gap-4 items-start">
                    <div className="h-6 w-6 rounded-full bg-purple-500/10 text-purple-400 font-bold text-xs flex items-center justify-center border border-purple-500/20 shrink-0 mt-0.5">
                      1
                    </div>
                    <div className="space-y-2 flex-1">
                      <h4 className="text-sm font-semibold text-zinc-200">Install CLI Client</h4>
                      <p className="text-xs text-muted-foreground">
                        Run the installation script to download and install the `setu` binary to your system.
                      </p>
                      <div className="flex gap-2 max-w-xl bg-zinc-950 p-2.5 rounded-lg border border-zinc-900 items-center justify-between">
                        <span className="font-mono text-xs text-purple-400 select-all">
                          curl -fsSL https://raw.githubusercontent.com/pranavwaikar/setu/main/scripts/install.sh | bash
                        </span>
                        <button
                          onClick={() => handleCopy('curl -fsSL https://raw.githubusercontent.com/pranavwaikar/setu/main/scripts/install.sh | bash', 'cli-install')}
                          className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-300 rounded text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer border border-zinc-800"
                        >
                          {copiedText === 'cli-install' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <hr className="border-zinc-900" />

                  {/* Step 2: Login */}
                  <div className="flex gap-4 items-start">
                    <div className="h-6 w-6 rounded-full bg-purple-500/10 text-purple-400 font-bold text-xs flex items-center justify-center border border-purple-500/20 shrink-0 mt-0.5">
                      2
                    </div>
                    <div className="space-y-2 flex-1">
                      <h4 className="text-sm font-semibold text-zinc-200">Authenticate your Client</h4>
                      <p className="text-xs text-muted-foreground">
                        Connect the CLI tool to your Setu account using your private API Key.
                      </p>
                      <div className="flex gap-2 max-w-xl bg-zinc-950 p-2.5 rounded-lg border border-zinc-900 items-center justify-between">
                        <span className="font-mono text-xs text-zinc-300 select-all">
                          setu login
                        </span>
                        <button
                          onClick={() => handleCopy('setu login', 'cli-login')}
                          className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-300 rounded text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer border border-zinc-800"
                        >
                          {copiedText === 'cli-login' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-[10px] text-zinc-500 italic">
                        Note: Copy your API Key from the <strong>API Keys</strong> tab when prompted.
                      </p>
                    </div>
                  </div>

                  <hr className="border-zinc-900" />

                  {/* Step 3: Expose */}
                  <div className="flex gap-4 items-start">
                    <div className="h-6 w-6 rounded-full bg-purple-500/10 text-purple-400 font-bold text-xs flex items-center justify-center border border-purple-500/20 shrink-0 mt-0.5">
                      3
                    </div>
                    <div className="space-y-2 flex-1">
                      <h4 className="text-sm font-semibold text-zinc-200">Expose Local Service</h4>
                      <p className="text-xs text-muted-foreground">
                        Expose a port of your choice using one of your claimed subdomains:
                      </p>
                      <div className="flex gap-2 max-w-xl bg-zinc-950 p-2.5 rounded-lg border border-zinc-900 items-center justify-between">
                        <span className="font-mono text-xs text-zinc-300 select-all">
                          setu expose 3000 --subdomain {subdomains[0]?.hostname || '<subdomain>'}
                        </span>
                        <button
                          onClick={() => handleCopy(`setu expose 3000 --subdomain ${subdomains[0]?.hostname || '<subdomain>'}`, 'cli-expose')}
                          className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-300 rounded text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer border border-zinc-800"
                        >
                          {copiedText === 'cli-expose' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-[10px] text-zinc-500">
                        Replace `3000` with the local port of your application. Make sure the subdomain is claimed in the **Subdomains** tab.
                      </p>
                    </div>
                  </div>

                  <hr className="border-zinc-900" />

                  {/* Step 4: Setup */}
                  <div className="flex gap-4 items-start">
                    <div className="h-6 w-6 rounded-full bg-purple-500/10 text-purple-400 font-bold text-xs flex items-center justify-center border border-purple-500/20 shrink-0 mt-0.5">
                      4
                    </div>
                    <div className="space-y-2 flex-1">
                      <h4 className="text-sm font-semibold text-zinc-200">Visual Setup Panel</h4>
                      <p className="text-xs text-muted-foreground">
                        Launch a local browser-based configuration panel to manage settings visually:
                      </p>
                      <div className="flex gap-2 max-w-xl bg-zinc-950 p-2.5 rounded-lg border border-zinc-900 items-center justify-between">
                        <span className="font-mono text-xs text-zinc-300 select-all">
                          setu setup
                        </span>
                        <button
                          onClick={() => handleCopy('setu setup', 'cli-setup')}
                          className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-300 rounded text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer border border-zinc-800"
                        >
                          {copiedText === 'cli-setup' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-[10px] text-zinc-500">
                        Launches a local web UI at `http://localhost:4500` to configure subdomains, port mappings, and securely save mappings.
                      </p>
                    </div>
                  </div>

                  <hr className="border-zinc-900" />

                  {/* Step 5: Start */}
                  <div className="flex gap-4 items-start">
                    <div className="h-6 w-6 rounded-full bg-purple-500/10 text-purple-400 font-bold text-xs flex items-center justify-center border border-purple-500/20 shrink-0 mt-0.5">
                      5
                    </div>
                    <div className="space-y-2 flex-1">
                      <h4 className="text-sm font-semibold text-zinc-200">Start Configured Tunnels</h4>
                      <p className="text-xs text-muted-foreground">
                        Run all saved tunnels simultaneously in a single terminal process:
                      </p>
                      <div className="flex gap-2 max-w-xl bg-zinc-950 p-2.5 rounded-lg border border-zinc-900 items-center justify-between">
                        <span className="font-mono text-xs text-zinc-300 select-all">
                          setu start
                        </span>
                        <button
                          onClick={() => handleCopy('setu start', 'cli-start')}
                          className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-300 rounded text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer border border-zinc-800"
                        >
                          {copiedText === 'cli-start' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-[10px] text-zinc-500">
                        Launches all active tunnel processes defined in your local configuration concurrently.
                      </p>
                    </div>
                  </div>

                  {/* Info Card on Setup & Start */}
                  <div className="bg-purple-500/5 border border-purple-500/10 p-4 rounded-xl space-y-2 max-w-xl">
                    <h5 className="text-xs font-semibold text-purple-400 flex items-center gap-1.5">
                      💡 Pro Tip: Multi-Tunneling & Visual Configuration
                    </h5>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      For advanced setups (like microservices), use <code className="text-purple-300 font-mono text-[10px] bg-purple-950/40 px-1 py-0.5 rounded">setu setup</code> to assign multiple subdomains (e.g. <code className="text-zinc-300">jhon-cena</code> for frontend, <code className="text-zinc-300">api-jhon-cena</code> for backend) to their respective local ports. Once saved, run <code className="text-purple-300 font-mono text-[10px] bg-purple-950/40 px-1 py-0.5 rounded">setu start</code> to launch all tunnels simultaneously in one terminal window.
                    </p>
                  </div>

                  {/* Expandable CLI details */}
                  <details className="group border border-zinc-800 rounded-xl bg-zinc-950/40 p-4 max-w-xl cursor-pointer">
                    <summary className="list-none flex items-center justify-between text-xs font-semibold text-zinc-300 group-open:text-purple-400 select-none">
                      <span>💡 View Advanced Feature Flags & Commands</span>
                      <span className="text-[10px] text-zinc-500 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="mt-3 space-y-4 text-[11px] text-zinc-400 leading-relaxed border-t border-zinc-900/60 pt-3">
                      <div>
                        <p className="font-semibold text-zinc-300">1. Host Header Overrides</p>
                        <p className="text-zinc-500 mt-0.5">Solve "Invalid Host Header" issues in Vite, Next.js, and Webpack by rewriting the host header:</p>
                        <code className="block mt-1.5 font-mono text-[10px] bg-zinc-900 p-2 rounded text-purple-300 select-all">
                          setu expose 3000 --subdomain myapp --host-header rewrite
                        </code>
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-300">2. Local HTTPS Endpoints</p>
                        <p className="text-zinc-500 mt-0.5">Proxy to local servers running on HTTPS (bypassing self-signed cert validation):</p>
                        <code className="block mt-1.5 font-mono text-[10px] bg-zinc-900 p-2 rounded text-purple-300 select-all">
                          setu expose https://localhost:3000 --subdomain myapp --insecure-skip-verify
                        </code>
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-300">3. Edge Protection (Basic Auth)</p>
                        <p className="text-zinc-500 mt-0.5">Require a username and password before public traffic reaches your local machine:</p>
                        <code className="block mt-1.5 font-mono text-[10px] bg-zinc-900 p-2 rounded text-purple-300 select-all">
                          setu expose 3000 --subdomain myapp --auth "admin:secret"
                        </code>
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-300">4. Layer-4 Raw TCP Tunneling</p>
                        <p className="text-zinc-500 mt-0.5">Expose databases (Postgres, MySQL) or SSH tunnels via dynamic high-ports:</p>
                        <code className="block mt-1.5 font-mono text-[10px] bg-zinc-900 p-2 rounded text-purple-300 select-all">
                          setu expose 5432 --subdomain mydb --tcp
                        </code>
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-300">5. Local HTTP Inspection UI</p>
                        <p className="text-zinc-500 mt-0.5">Inspect incoming headers, payloads, cookies, and responses in real time at:</p>
                        <a 
                          href="http://localhost:4500/inspect" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-purple-400 hover:underline text-[10px] font-mono"
                        >
                          http://localhost:4500/inspect
                        </a>
                      </div>
                      <div className="pt-2 border-t border-zinc-900/60">
                        <a 
                          href="https://github.com/pranavwaikar/setu/blob/main/README.md" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-purple-400 hover:text-purple-300 hover:underline inline-flex items-center gap-1 font-semibold"
                        >
                          Read full documentation on GitHub ➔
                        </a>
                      </div>
                    </div>
                  </details>
                </div>

                {/* Flow Diagram */}
                <div className="mt-8 pt-6 border-t border-zinc-900">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">How it works</h4>
                  <pre className="p-4 rounded-lg bg-zinc-950/80 border border-zinc-900 font-mono text-[10px] text-zinc-400 leading-relaxed overflow-x-auto">
{`Public Request ➔ https://${subdomains[0]?.hostname || 'your-subdomain'}.${baseDomain}
                       │
                       ▼ (TLS Secured Ingress)
                  Setu Gateway (Single Entrypoint)
                       │
                       ▼ (Yamux Multiplexing over WebSockets)
                   Setu CLI
                       │
                       ▼ (Local TCP Forward)
                 127.0.0.1:3000 (Your Local Server)`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Tab 5: Profile Details */}
          {activeTab === 'profile' && (
            <div className="glass rounded-xl p-8 max-w-2xl mx-auto space-y-6">
              <div className="flex items-center gap-4 pb-6 border-b border-zinc-900">
                <div className="h-16 w-16 rounded-full bg-purple-500/10 flex items-center justify-center border border-purple-500/30 text-purple-400 font-extrabold text-2xl">
                  {user?.firstName ? user.firstName[0].toUpperCase() : user?.email[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {user?.firstName || user?.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Developer Profile'}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{user?.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">First Name</span>
                  <p className="text-sm font-semibold text-zinc-200">{user?.firstName || 'Not provided'}</p>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Last Name</span>
                  <p className="text-sm font-semibold text-zinc-200">{user?.lastName || 'Not provided'}</p>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Email Address</span>
                  <p className="text-sm font-semibold text-zinc-200">{user?.email}</p>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Account Plan</span>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase">
                      {user?.plan} Plan
                    </span>
                    {user?.plan === 'FREE' && (
                      <button
                        onClick={() => setActiveTab('billing')}
                        className="text-[10px] text-purple-400 hover:text-purple-300 font-bold underline transition-colors"
                      >
                        Upgrade to Pro ➔
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Email Verification</span>
                  <div className="mt-1">
                    {user?.isVerified ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20">
                        <CheckCircle2 className="h-3 w-3" />
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                        <AlertCircle className="h-3 w-3" />
                        Pending Verification
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Member Since</span>
                  <p className="text-sm font-semibold text-zinc-200">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-900">
                <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">User Identifier</span>
                <div className="flex gap-2 bg-zinc-950 p-2.5 rounded-lg border border-zinc-900 items-center justify-between">
                  <span className="font-mono text-xs text-zinc-400 break-all select-all pr-4">{user?.id}</span>
                  <button
                    onClick={() => handleCopy(user?.id || '', 'user-id')}
                    className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-300 rounded text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer border border-zinc-800"
                  >
                    {copiedText === 'user-id' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-green-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 6: Billing & Subscriptions */}
          {activeTab === 'billing' && (
            <div className="glass rounded-xl p-8 max-w-4xl mx-auto space-y-8 animate-fadeIn">
              <div className="flex justify-between items-start pb-6 border-b border-zinc-900">
                <div>
                  <h3 className="text-xl font-bold text-white">Billing & Subscriptions</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Manage your service plans, quotas, and subscription details.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Current Plan:</span>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold tracking-widest border uppercase ${
                    user?.plan === 'PRO'
                      ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                      : user?.plan === 'ENTERPRISE'
                      ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                  }`}>
                    {user?.plan}
                  </span>
                </div>
              </div>

              {/* Active Plan Detail Box */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-xl border border-zinc-900 bg-zinc-950/20 space-y-4">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Plan Highlights</h4>
                  <div className="space-y-3 text-xs text-zinc-300">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Subdomains Limit</span>
                      <span className="font-semibold">{user?.plan === 'PRO' ? '50' : user?.plan === 'ENTERPRISE' ? '1,000' : '10'} subdomains</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Custom Domain Mappings</span>
                      <span className="font-semibold">{user?.plan === 'FREE' ? 'Not included' : 'Included'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Raw TCP Tunneling</span>
                      <span className="font-semibold">{user?.plan === 'FREE' ? 'Not included' : 'Included'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Edge Protections</span>
                      <span className="font-semibold">{user?.plan === 'FREE' ? 'Not included' : 'Basic Auth Included'}</span>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-xl border border-zinc-900 bg-zinc-950/20 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Billing Cycle</h4>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {user?.plan === 'FREE' 
                        ? 'You are currently running on the Free tier. There are no charges for this account.'
                        : user?.plan === 'PRO'
                        ? 'Your Pro plan is billed at $5.00 USD monthly via Dodo Payments.'
                        : 'Your Enterprise plan is managed for your entire organization at $250.00 USD monthly.'
                      }
                    </p>
                  </div>
                  {user?.plan === 'FREE' && (
                    <button
                      onClick={handleUpgradeToPro}
                      disabled={loadingAction === 'upgrade'}
                      className="mt-4 w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {loadingAction === 'upgrade' ? (
                        <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                      ) : (
                        'Upgrade to Pro ($5/mo)'
                      )}
                    </button>
                  )}
                  {user?.plan !== 'FREE' && user?.subscriptionStatus === 'active' && (
                    <button
                      onClick={handleCancelSubscription}
                      disabled={loadingAction === 'cancel'}
                      className="mt-4 w-full py-2.5 rounded-lg bg-red-950/20 hover:bg-red-900/30 border border-red-500/20 text-red-400 disabled:bg-zinc-800 disabled:text-zinc-600 font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {loadingAction === 'cancel' ? (
                        <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                      ) : (
                        'Cancel Subscription'
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Show Pricing Tier Options if Free user */}
              {user?.plan === 'FREE' && (
                <div className="pt-6 border-t border-zinc-900 space-y-6">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider text-center">Available Upgrade Tiers</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Pro Tier Upgrade Card */}
                    <div className="p-6 rounded-xl border border-purple-500/20 bg-zinc-950/40 relative overflow-hidden flex flex-col justify-between">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-[30px] pointer-events-none" />
                      <div>
                        <h5 className="text-sm font-bold text-white">PRO Plan</h5>
                        <p className="text-zinc-500 text-[11px] mt-1">Unlock raw TCP tunneling, up to 50 endpoints, and edge authentication protection.</p>
                        <div className="mt-4 flex items-baseline gap-1">
                          <span className="text-2xl font-extrabold text-white">$5.00</span>
                          <span className="text-zinc-500 text-[10px]">/ month</span>
                        </div>
                        <ul className="mt-4 space-y-2 text-[11px] text-zinc-400">
                          <li className="flex items-center gap-2">
                            <span className="h-1 w-1 bg-purple-500 rounded-full" />
                            <span>Claim up to 50 active subdomains</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="h-1 w-1 bg-purple-500 rounded-full" />
                            <span>Basic Authentication edge protection</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="h-1 w-1 bg-purple-500 rounded-full" />
                            <span>Layer-4 raw TCP tunneling</span>
                          </li>
                        </ul>
                      </div>
                      <button
                        onClick={handleUpgradeToPro}
                        disabled={loadingAction === 'upgrade'}
                        className="mt-6 w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
                      >
                        {loadingAction === 'upgrade' ? (
                          <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                        ) : (
                          'Upgrade to Pro'
                        )}
                      </button>
                    </div>

                    {/* Enterprise Plan Card */}
                    <div className="p-6 rounded-xl border border-zinc-900 bg-zinc-950/40 flex flex-col justify-between">
                      <div>
                        <h5 className="text-sm font-bold text-white">ENTERPRISE Plan</h5>
                        <p className="text-zinc-500 text-[11px] mt-1">Fully managed subdomains and custom deployments for your entire team or organization.</p>
                        <div className="mt-4 flex items-baseline gap-1">
                          <span className="text-2xl font-extrabold text-white">$250.00</span>
                          <span className="text-zinc-500 text-[10px]">/ month</span>
                        </div>
                        <ul className="mt-4 space-y-2 text-[11px] text-zinc-400">
                          <li className="flex items-center gap-2">
                            <span className="h-1 w-1 bg-indigo-500 rounded-full" />
                            <span>Fully managed subdomain deployment for entire org</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="h-1 w-1 bg-indigo-500 rounded-full" />
                            <span>Dedicated tunnel gateway instances</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="h-1 w-1 bg-indigo-500 rounded-full" />
                            <span>Guaranteed SLA & Uptime Support</span>
                          </li>
                        </ul>
                      </div>
                      <a
                        href="mailto:sales@contact.helios-logic.com?subject=Setu Enterprise Plan Upgrade Request"
                        className="mt-6 block w-full py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-center font-bold text-xs text-zinc-200 rounded-lg transition-colors"
                      >
                        Contact Sales
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment History Section */}
              <div className="pt-6 border-t border-zinc-900 space-y-4 animate-fadeIn">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Payment & Subscription History</h4>
                
                {paymentHistory.length === 0 ? (
                  <div className="text-center py-8 rounded-xl border border-zinc-900 bg-zinc-950/10">
                    <CreditCard className="h-8 w-8 text-zinc-600 mx-auto mb-2.5" />
                    <p className="text-xs text-zinc-500">No payment or subscription logs found.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-zinc-900 bg-zinc-950/10">
                    <table className="w-full border-collapse text-left text-xs text-zinc-300">
                      <thead>
                        <tr className="border-b border-zinc-900 bg-zinc-950/40 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Plan</th>
                          <th className="py-3 px-4">Transaction ID</th>
                          <th className="py-3 px-4">Amount</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900">
                        {paymentHistory.map((log) => {
                          let statusClass = 'bg-zinc-900 text-zinc-400 border-zinc-800';
                          if (log.status === 'SUCCESS') {
                            statusClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                          } else if (log.status === 'FAILED') {
                            statusClass = 'bg-red-500/10 text-red-400 border-red-500/20';
                          } else if (log.status === 'CANCELLED') {
                            statusClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                          } else if (log.status === 'EXPIRED') {
                            statusClass = 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
                          }

                          return (
                            <tr key={log.id} className="hover:bg-zinc-950/20 transition-colors">
                              <td className="py-3.5 px-4 font-mono text-[11px] whitespace-nowrap">
                                {new Date(log.createdAt).toLocaleDateString(undefined, {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </td>
                              <td className="py-3.5 px-4 font-bold tracking-wider text-[10px]">
                                <span className={`px-2 py-0.5 rounded border ${
                                  log.plan === 'PRO'
                                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                    : log.plan === 'ENTERPRISE'
                                    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                    : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                                }`}>
                                  {log.plan}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-500 select-all truncate max-w-[120px]" title={log.transactionId}>
                                {log.transactionId}
                              </td>
                              <td className="py-3.5 px-4 font-semibold text-zinc-200">
                                {log.amount > 0 ? `$${(log.amount / 100).toFixed(2)} ${log.currency}` : '—'}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${statusClass}`}>
                                  {log.status}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-zinc-500 text-[11px] max-w-[200px] truncate" title={log.errorMessage || ''}>
                                {log.errorMessage || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mock Checkout Overlay Modal */}
      {showMockCheckout && (
        <div className="fixed inset-0 z-50 bg-[#09090b]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#09090b] border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl relative">
            <button
              onClick={() => {
                setShowMockCheckout(false);
                setMockCheckoutUrl('');
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-800 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
            <div className="p-4 border-b border-zinc-900">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest font-mono">Overlay Sandbox Checkout</span>
            </div>
            {isCheckoutTestMode && (
              <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2.5 text-yellow-400 text-xs flex items-center gap-2">
                <span className="font-extrabold uppercase text-[9px] tracking-wider shrink-0 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20">Test Mode</span>
                <span className="truncate text-zinc-300">This checkout session is a mock simulation and does not accept real payments.</span>
              </div>
            )}
            <div className="h-[600px] w-full">
              <iframe
                src={mockCheckoutUrl}
                className="w-full h-full border-none"
                title="Mock Sandbox Checkout"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
