"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccountToken } from "@/lib/accountApi";
import { CreateAccountForm } from "@/components/CreateAccountForm";
import { LoginForm } from "@/components/LoginForm";
import { useT } from "@/lib/useI18n";

// A login page made to be opened in a popup by the other apps on this origin
// (the events at /events): window.open("/login"). The session lands in this
// origin's localStorage, so the opener sees the token arrive through its own
// "storage" listener — nothing is posted back. All this window has to do is
// close itself once there is a session.
//
// Opened as a normal tab (no opener, or a blocked popup's fallback) it goes
// to `?next=` (a path on this site) or home instead.
export function LoginPopup() {
  const t = useT();
  const router = useRouter();
  const token = useAccountToken();
  const [mode, setMode] = useState<"login" | "create">("login");

  useEffect(() => {
    if (!token) return;
    const opener = window.opener as Window | null;
    if (opener && !opener.closed) {
      window.close();
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next");
    router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
  }, [token, router]);

  const cancel = () => {
    if (window.opener) window.close();
    else router.replace("/");
  };

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="mb-4 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          {mode === "login" ? t("accountModal.signInToYourAccount") : t("common.createAccount")}
        </h1>
        {mode === "login" ? (
          <LoginForm onCancel={cancel} onSwitchToCreate={() => setMode("create")} />
        ) : (
          <CreateAccountForm onCancel={cancel} onSwitchToLogin={() => setMode("login")} />
        )}
      </div>
    </main>
  );
}
