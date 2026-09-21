import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { linkAccountTrips } from "./store";

/**
 * Passwordless accounts: people sign in with a one-tap email link. There is no
 * password and no code to type in.
 */

export interface AccountState {
  loading: boolean;
  session: Session | null;
  email: string | null;
  userId: string | null;
}

export function useAccount(): AccountState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      setSession(next);
      setLoading(false);
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        if (next) void linkAccountTrips();
      }
    });
    void supabase.auth.getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setLoading(false);
      });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return {
    loading,
    session,
    email: session?.user?.email ?? null,
    userId: session?.user?.id ?? null,
  };
}

/** Sanitise the page a sign-in link should return to: first-party paths only. */
export function safeReturnPath(value: string | null | undefined): string {
  if (typeof value !== "string") return "/trips";
  if (!value.startsWith("/") || value.startsWith("//")) return "/trips";
  return value;
}

export async function sendSignInLink(email: string, returnTo: string) {
  const origin = window.location.origin;
  const redirect = `${origin}/auth?next=${encodeURIComponent(safeReturnPath(returnTo))}`;
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: redirect, shouldCreateUser: true },
  });
  if (error) throw new Error(error.message);
}

export async function signOutEverything() {
  await supabase.auth.signOut();
}

/** Sign out of this device and every other device this account is open on. */
export async function signOutEveryDevice() {
  await supabase.auth.signOut({ scope: "global" });
}

/** Start an email change: a confirmation link goes to the new address. */
export async function changeEmail(next: string) {
  const { error } = await supabase.auth.updateUser(
    { email: next.trim() },
    { emailRedirectTo: `${window.location.origin}/auth?next=/account` },
  );
  if (error) throw new Error(error.message);
}
