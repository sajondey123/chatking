/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useChatStore } from "../store";
import { ShieldAlert, LogIn, UserPlus, Heart, Settings, Eye, EyeOff } from "lucide-react";

export default function AuthPage() {
  const setUser = useChatStore((state) => state.setUser);
  
  const [isLogin, setIsLogin] = useState(true);
  const [isAdminMode, setIsAdminMode] = useState(false);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const payload = isLogin ? { email, password } : { email, password, name };
    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication procedure failed.");
      }

      // Succeeded! Store session user
      setUser(data);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const autofillAdmin = (num: number) => {
    setIsLogin(true);
    if (num === 1) {
      setEmail("admin1@familyconnect.local");
      setPassword("AdminPassword123!");
    } else {
      setEmail("admin2@familyconnect.local");
      setPassword("AdminPassword456!");
    }
  };

  return (
    <div id="auth-page-container" className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans transition-colors duration-300">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-3xl bg-blue-600 text-white shadow-xl shadow-blue-100 mb-4 hover:scale-105 transition-transform">
          <Heart className="h-8 w-8 text-white fill-current" />
        </div>
        <h2 id="app-logo-header" className="text-3xl font-extrabold tracking-tight text-slate-900">
          FamilyConnect
        </h2>
        <p className="mt-2 text-sm text-slate-500 max-w">
          {isAdminMode 
            ? "Secure Administrative Console Oversight" 
            : "Keep family conversations safe, direct, and transparent"}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div id="auth-card" className="bg-white py-8 px-4 shadow-xl shadow-slate-100 rounded-3xl sm:px-10 border border-slate-100 relative overflow-hidden">
          {isAdminMode && (
            <div className="absolute top-0 inset-x-0 h-1.5 bg-rose-500 animate-pulse" />
          )}

          {error && (
            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 text-xs flex items-start gap-2.5">
              <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 tracking-wider uppercase">
                  Your Full Name
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="appearance-none block w-full px-4 py-3 border border-slate-200 rounded-2xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="e.g. Grandma Clara"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 tracking-wider uppercase">
                Email / Account Username
              </label>
              <div className="mt-1">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-slate-200 rounded-2xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder={isAdminMode ? "admin1@familyconnect.local" : "you@example.com"}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 tracking-wider uppercase">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-slate-200 rounded-2xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 focus:outline-none focus:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className={`w-full flex justify-center py-3.5 px-4 border border-transparent rounded-2xl shadow-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all ${
                  isAdminMode 
                    ? "bg-rose-600 hover:bg-rose-700 focus:ring-rose-500 shadow-rose-100" 
                    : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 shadow-blue-100"
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Please wait...
                  </span>
                ) : isLogin ? (
                  <span className="flex items-center gap-1.5">
                    <LogIn className="h-4 w-4" />
                    {isAdminMode ? "Authorize Admin Access" : "Sign In to Family"}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <UserPlus className="h-4 w-4" />
                    Register Account
                  </span>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-5">
            {!isAdminMode ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="font-medium text-blue-600 hover:text-blue-500 focus:outline-none"
                >
                  {isLogin ? "Need a family account? Register" : "Already registered? Login"}
                </button>
                <div className="text-slate-300">|</div>
              </>
            ) : (
              <div className="w-full flex justify-center gap-4 py-2 bg-slate-50 rounded-xl px-2">
                <span className="font-semibold text-rose-700">Autofill:</span>
                <button
                  onClick={() => autofillAdmin(1)}
                  type="button"
                  className="hover:underline text-rose-600 font-medium"
                >
                  Admin 1
                </button>
                <span className="text-slate-300">•</span>
                <button
                  onClick={() => autofillAdmin(2)}
                  type="button"
                  className="hover:underline text-rose-600 font-medium"
                >
                  Admin 2
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden Management Button in Footer */}
      <div className="mt-8 text-center">
        <button
          type="button"
          onClick={() => {
            setIsAdminMode(!isAdminMode);
            setIsLogin(true);
            setError("");
            setEmail("");
            setPassword("");
          }}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors bg-white hover:bg-slate-100 py-1.5 px-3.5 rounded-full border border-slate-200/60 shadow-sm"
        >
          <Settings className="h-3 w-3" />
          <span>{isAdminMode ? "Back to Family Login" : "System Administrative Console"}</span>
        </button>
      </div>
    </div>
  );
}
