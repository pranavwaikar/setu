'use client';

import { useState, useEffect } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { api, User, Subdomain, ApiKey, Tunnel } from '../lib/api';

export default function Home() {
  // Navigation & Session State
  const [authStatus, setAuthStatus] = useState<'loading' | 'unauthenticated' | 'authenticated'>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'tunnels' | 'subdomains' | 'api-keys' | 'instructions'>('tunnels');
  
  // Forms & Inputs
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [subdomainInput, setSubdomainInput] = useState('');
  
  // Data State
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [subdomains, setSubdomains] = useState<Subdomain[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  
  // UI UX States
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [newGeneratedKey, setNewGeneratedKey] = useState<string | null>(null);

  // Dynamic Domain Detection
  const [baseDomain, setBaseDomain] = useState('setu.helios-logic.com');
  const [baseDomainWithPort, setBaseDomainWithPort] = useState('setu.helios-logic.com');
  const [protocol, setProtocol] = useState('https:');

  // Authenticate user on load
  useEffect(() => {
    checkAuth();
    if (typeof window !== 'undefined') {
      setBaseDomain(window.location.hostname);
      setBaseDomainWithPort(window.location.host);
      setProtocol(window.location.protocol);
    }
  }, []);

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
      const [t, s, k] = await Promise.all([
        api.listTunnels(),
        api.listSubdomains(),
        api.listApiKeys()
      ]);
      setTunnels(t);
      setSubdomains(s);
      setApiKeys(k);
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
        await api.register(email, password);
        setAuthMode('login');
        showSuccess('Account created! Please log in.');
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

  // Unauthenticated screen
  if (authStatus === 'unauthenticated') {
    return (
      <div className="flex-1 flex items-center justify-center p-4 bg-[#09090b]">
        {/* Glow circles */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="w-full max-w-md glass rounded-2xl p-8 z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.2)] mb-4">
              <div className="h-4 w-4 bg-purple-500 rounded-full animate-pulse" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
              Setu Tunnel
            </h1>
            <p className="text-muted-foreground text-sm mt-2">
              {authMode === 'login' ? 'Sign in to manage your local tunnels' : 'Create an account to start exposing local services'}
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

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loadingAction === 'auth'}
              className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-colors cursor-pointer flex items-center justify-center"
            >
              {loadingAction === 'auth' ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : authMode === 'login' ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs">
            <button
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              className="text-purple-400 hover:text-purple-300 font-medium underline cursor-pointer"
            >
              {authMode === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
            </button>
          </div>
        </div>
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
          <div className="p-6 border-b border-zinc-900 flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
              <div className="h-2 w-2 bg-purple-500 rounded-full" />
            </div>
            <span className="font-bold tracking-tight text-lg bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              Setu Tunnel
            </span>
          </div>

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
              <p className="text-[10px] text-purple-400 uppercase tracking-widest font-bold">
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
          {activeTab !== 'instructions' && (
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
                  {subdomains.length} <span className="text-xs font-normal text-muted-foreground">/ 10</span>
                </h3>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Quota limit: 10 subdomains
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
                    disabled={loadingAction === 'claim' || subdomains.length >= 10}
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
            <div className="space-y-6">
              <div className="glass rounded-xl p-6 space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white">Install and Configure Setu CLI</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Follow these simple steps to expose your local projects.</p>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-4 items-start">
                    <div className="h-6 w-6 rounded-full bg-purple-500/10 text-purple-400 font-bold text-xs flex items-center justify-center border border-purple-500/20 shrink-0 mt-0.5">
                      1
                    </div>
                    <div className="space-y-2 flex-1">
                      <h4 className="text-sm font-semibold text-zinc-200">Login via CLI</h4>
                      <p className="text-xs text-muted-foreground">
                        Initialize the connection credentials by running the login command on your machine.
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
                        Note: When prompted, paste one of your generated API Keys from the **API Keys** tab.
                      </p>
                    </div>
                  </div>

                  <hr className="border-zinc-900" />

                  <div className="flex gap-4 items-start">
                    <div className="h-6 w-6 rounded-full bg-purple-500/10 text-purple-400 font-bold text-xs flex items-center justify-center border border-purple-500/20 shrink-0 mt-0.5">
                      2
                    </div>
                    <div className="space-y-2 flex-1">
                      <h4 className="text-sm font-semibold text-zinc-200">Expose Local Port</h4>
                      <p className="text-xs text-muted-foreground">
                        Expose a port of your choice using one of your claimed subdomains.
                      </p>
                      <div className="flex gap-2 max-w-xl bg-zinc-950 p-2.5 rounded-lg border border-zinc-900 items-center justify-between">
                        <span className="font-mono text-xs text-zinc-300 select-all">
                          setu expose 3000 --subdomain {subdomains[0]?.hostname || '&lt;your-subdomain&gt;'}
                        </span>
                        <button
                          onClick={() => handleCopy(`setu expose 3000 --subdomain ${subdomains[0]?.hostname || '<your-subdomain>'}`, 'cli-expose')}
                          className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-300 rounded text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer border border-zinc-800"
                        >
                          {copiedText === 'cli-expose' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-[10px] text-zinc-500">
                        Replace `3000` with the port you want to route, and verify your subdomain is listed as `ACTIVE` on this dashboard.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
