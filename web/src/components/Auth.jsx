"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { FileText } from "lucide-react";
import { supabase, supabaseReady } from "@/lib/supabase.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function Auth({ onLocalMode }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [info, setInfo] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo("Account created. Check your email if confirmation is required, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-orange-50 p-5">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <Card className="w-[380px] max-w-[92vw] p-7 border-orange-200 shadow-[0_20px_60px_rgba(234,88,12,0.15)]">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center">
              <FileText size={19} className="text-white" strokeWidth={2.25} />
            </div>
            <div>
              <div className="font-extrabold text-base">Change Order Tracker</div>
              <div className="text-[10px] text-stone-500">
                ConstructPro · {mode === "signup" ? "Create account" : "Sign in"}
              </div>
            </div>
          </div>

          {!supabaseReady && (
            <div className="p-2.5 bg-amber-100 border border-amber-200 rounded-lg text-[11px] text-amber-800 mb-3.5">
              Supabase not configured. Copy <code>.env.example</code> to <code>.env.local</code>, add your Project URL + anon key, and restart the dev server.
              <button
                onClick={onLocalMode}
                className="block mt-1.5 text-orange-600 font-semibold text-[11px] hover:underline"
              >
                Continue in local-only mode →
              </button>
            </div>
          )}

          {supabaseReady && (
            <form onSubmit={submit} className="space-y-2.5">
              <Input
                type="email"
                required
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                type="password"
                required
                minLength={6}
                placeholder="Password (min 6)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {err && (
                <div className="p-2 bg-red-100 text-red-700 rounded-md text-[11px]">{err}</div>
              )}
              {info && (
                <div className="p-2 bg-green-100 text-green-700 rounded-md text-[11px]">{info}</div>
              )}
              <Button
                type="submit"
                disabled={busy}
                className="w-full bg-gradient-to-br from-orange-400 to-orange-600 hover:opacity-90 text-white font-extrabold"
              >
                {busy ? "…" : mode === "signup" ? "Create account" : "Sign in"}
              </Button>
              <div className="text-center mt-3 text-[11px] text-stone-500">
                {mode === "signin" ? (
                  <>
                    No account?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("signup")}
                      className="text-orange-600 font-semibold hover:underline"
                    >
                      Create one
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("signin")}
                      className="text-orange-600 font-semibold hover:underline"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </div>
            </form>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
