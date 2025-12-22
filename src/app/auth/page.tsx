"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (userId) router.replace('/');
  }, [router]);

  // Prevent page scroll while on the auth page (restore on unmount)
  useEffect(() => {
    const prev = typeof document !== 'undefined' ? document.body.style.overflow : '';
    if (typeof document !== 'undefined') document.body.style.overflow = 'hidden';
    return () => {
      if (typeof document !== 'undefined') document.body.style.overflow = prev;
    };
  }, []);

  const handleAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'signup') {
        if (password !== passwordConfirm) throw new Error('Passwords do not match');

        // Use simple file-backed auth register
        const res = await fetch('/api/simple-auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        const payload = await res.json().catch(()=>({}));
        if (!res.ok) throw new Error(payload.error || 'Failed to create user');

        // On success, store userId as username and continue
        localStorage.setItem('userId', username);
        localStorage.setItem('username', username);
        try { await fetch('/api/migrate-lists', { method: 'POST', headers: { 'x-user-id': username } }); } catch {}
        router.replace('/');
      } else {
        // Log in via server endpoint which authenticates by username+password and returns tokens
        // Use DB-backed simple-auth login
        const res = await fetch('/api/simple-auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        const payload = await res.json().catch(()=>({}));
        if (!res.ok) throw new Error(payload.error || 'Login failed');

        // Successful login — store user info and continue
        const userId = payload?.user?.user_id || username;
        localStorage.setItem('userId', userId);
        localStorage.setItem('username', username);
        try { await fetch('/api/migrate-lists', { method: 'POST', headers: { 'x-user-id': username } }); } catch {}
        router.replace('/');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md sm:max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-4 sm:p-6">
        <h1 className="text-lg sm:text-xl font-bold text-white mb-3">Welcome</h1>
        <p className="text-slate-400 text-xs sm:text-sm mb-5">Login or Sign up to save your lists and defaults.</p>

        <div className="flex gap-2 mb-4">
          <button
            className={`px-3 py-1.5 rounded text-xs font-semibold ${mode==='login'?'bg-blue-600 text-white':'text-slate-400 border border-slate-700'}`}
            onClick={() => setMode('login')}
          >Login</button>
          <button
            className={`px-3 py-1.5 rounded text-xs font-semibold ${mode==='signup'?'bg-blue-600 text-white':'text-slate-400 border border-slate-700'}`}
            onClick={() => setMode('signup')}
          >Sign Up</button>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-400">Username</label>
          <input
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm sm:text-sm"
            value={username}
            onChange={(e)=>setUsername(e.target.value)}
            placeholder="yourname"
          />
          <label className="text-xs text-slate-400">Password</label>
          <input
            type="password"
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm sm:text-sm"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            placeholder="••••••••"
          />
          {mode === 'signup' && (
            <>
              <label className="text-xs text-slate-400">Confirm Password</label>
              <input
                type="password"
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm sm:text-sm"
                value={passwordConfirm}
                onChange={(e)=>setPasswordConfirm(e.target.value)}
                placeholder="Confirm password"
              />
            </>
          )}
        </div>

        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

        <button
          onClick={handleAuth}
          disabled={loading || !username || !password || (mode === 'signup' && !passwordConfirm)}
          className="w-full mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
        >{loading ? 'Please wait…' : mode==='login' ? 'Login' : 'Create Account'}</button>
      </div>
    </main>
  );
}
