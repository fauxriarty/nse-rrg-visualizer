"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (userId) router.replace('/');
  }, [router]);

  const handleAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'signup') {
        const usedEmail = email || `${username}@example.com`;
        // Create a confirmed user on the server (uses service role) to skip email verification
        const res = await fetch('/api/auth/create-confirmed-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: usedEmail, password, username }),
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || 'Failed to create user');

        // Now sign in the newly-created user to create a client session
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email: usedEmail, password });
        if (signInErr) throw signInErr;
        const uid = signInData.user?.id;
        if (uid) {
          localStorage.setItem('userId', uid);
          localStorage.setItem('username', username || usedEmail);
          try {
            await fetch('/api/migrate-lists', { method: 'POST', headers: { 'x-user-id': uid } });
          } catch {}
          router.replace('/');
        }
      } else {
        const usedEmail = email || `${username}@example.com`;
        const { data, error } = await supabase.auth.signInWithPassword({ email: usedEmail, password });
        if (error) throw error;
        const uid = data.user?.id;
        if (uid) {
          localStorage.setItem('userId', uid);
          localStorage.setItem('username', username || usedEmail);
          // Migrate any IP-based lists to this user
          try {
            await fetch('/api/migrate-lists', { method: 'POST', headers: { 'x-user-id': uid } });
          } catch {}
          router.replace('/');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-6">
        <h1 className="text-xl font-bold text-white mb-4">Welcome</h1>
        <p className="text-slate-400 text-sm mb-6">Login or Sign up to save your lists and defaults.</p>

        <div className="flex gap-2 mb-6">
          <button
            className={`px-3 py-1.5 rounded text-xs font-semibold ${mode==='login'?'bg-blue-600 text-white':'text-slate-400 border border-slate-700'}`}
            onClick={() => setMode('login')}
          >Login</button>
          <button
            className={`px-3 py-1.5 rounded text-xs font-semibold ${mode==='signup'?'bg-blue-600 text-white':'text-slate-400 border border-slate-700'}`}
            onClick={() => setMode('signup')}
          >Sign Up</button>
        </div>

        <div className="flex flex-col gap-3">
          <label className="text-xs text-slate-400">Username</label>
          <input
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            value={username}
            onChange={(e)=>setUsername(e.target.value)}
            placeholder="yourname"
          />
          <label className="text-xs text-slate-400">Password</label>
          <input
            type="password"
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <label className="text-xs text-slate-400">Email</label>
          <input
            type="email"
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

        <button
          onClick={handleAuth}
          disabled={loading || !username || !password}
          className="w-full mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
        >{loading ? 'Please wait…' : mode==='login' ? 'Login' : 'Create Account'}</button>
      </div>
    </main>
  );
}
