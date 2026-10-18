"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchAdmins,
  searchAdminAccounts,
  setAdminPermissions,
  type AdminAccountHit,
  type AdminMember,
} from "@/lib/adminApi";
import {
  ADMIN_PERMISSIONS,
  adminPermissionFlag,
  adminPermissionHint,
  adminPermissionLabel,
  type AdminPermission,
} from "@/lib/adminPermissions";
import { useT } from "@/lib/useI18n";

// Who may do what in /admin — ADMIN_MASTER only (the tab is not drawn for
// anybody else, and the API refuses both routes behind it).
//
// One card per administrator with a switch per job. Saving rewrites ADMIN and
// the ADMIN_PERM_* flags and nothing else, so the flags editor and this panel
// can never undo each other's work. ADMIN_MASTER is not offered here: it has
// everything already, and granting it stays a database edit.

function permissionsOf(flags: string[]): Set<AdminPermission> {
  return new Set(ADMIN_PERMISSIONS.filter((permission) => flags.includes(adminPermissionFlag(permission))));
}

function MemberCard({
  member,
  onSaved,
}: {
  member: AdminMember;
  onSaved: (flags: string[]) => void;
}) {
  const t = useT();
  const isMaster = member.flags.includes("ADMIN_MASTER");
  const isAdmin = member.flags.includes("ADMIN");
  const [draft, setDraft] = useState<Set<AdminPermission>>(() => permissionsOf(member.flags));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const saved = permissionsOf(member.flags);
  const dirty =
    !isAdmin || draft.size !== saved.size || [...draft].some((permission) => !saved.has(permission));

  function toggle(permission: AdminPermission) {
    setDone(false);
    setDraft((current) => {
      const next = new Set(current);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return next;
    });
  }

  async function save(admin: boolean) {
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const flags = await setAdminPermissions(member.id, admin, admin ? [...draft] : []);
      onSaved(flags);
      if (!admin) setDraft(new Set());
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.couldNotSave"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {member.displayName}
          </p>
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">@{member.username}</p>
        </div>
        {isMaster ? (
          <span className="rounded-md bg-amber-100 px-2 py-0.5 font-mono text-xs font-medium text-amber-900 dark:bg-amber-950/70 dark:text-amber-200">
            ADMIN_MASTER
          </span>
        ) : !isAdmin ? (
          <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
            {t("admin.permissions.notAdminYet")}
          </span>
        ) : null}
      </div>

      {isMaster ? (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{t("admin.permissions.masterHasAll")}</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setDone(false);
                setDraft(new Set(ADMIN_PERMISSIONS));
              }}
              className="rounded-md border border-zinc-300 px-2 py-1 text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              {t("admin.permissions.selectAll")}
            </button>
            <button
              type="button"
              onClick={() => {
                setDone(false);
                setDraft(new Set());
              }}
              className="rounded-md border border-zinc-300 px-2 py-1 text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              {t("admin.permissions.clearAll")}
            </button>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {ADMIN_PERMISSIONS.map((permission) => (
              <label
                key={permission}
                className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-sm transition ${
                  draft.has(permission)
                    ? "border-emerald-500 bg-emerald-50/70 dark:border-emerald-500/50 dark:bg-emerald-950/30"
                    : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                }`}
              >
                <input
                  type="checkbox"
                  checked={draft.has(permission)}
                  onChange={() => toggle(permission)}
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block font-medium text-zinc-900 dark:text-zinc-100">
                    {adminPermissionLabel(permission)}
                  </span>
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                    {adminPermissionHint(permission)}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void save(true)}
              disabled={busy || !dirty}
              className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              {busy ? t("common.saving") : isAdmin ? t("common.save") : t("admin.permissions.makeAdmin")}
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(t("admin.permissions.confirmRemoveAdmin", { value: member.username }))) {
                    void save(false);
                  }
                }}
                disabled={busy}
                className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                {t("admin.permissions.removeAdmin")}
              </button>
            )}
            {done && <span className="text-sm text-emerald-600 dark:text-emerald-500">{t("admin.permissions.saved")}</span>}
            {error && <span className="text-sm text-red-500">{error}</span>}
          </div>
        </>
      )}
    </li>
  );
}

export function AdminPermissionsPanel() {
  const t = useT();
  const [admins, setAdmins] = useState<AdminMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<AdminAccountHit[]>([]);
  // Somebody picked from the search who is not an admin yet: shown as a card
  // until saved, then they are on the list like everybody else.
  const [candidate, setCandidate] = useState<AdminMember | null>(null);

  const load = useCallback(() => {
    fetchAdmins()
      .then(setAdmins)
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    if (query.trim().length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchAdminAccounts(query)
        .then((data) => {
          if (!cancelled) setHits(data.accounts);
        })
        .catch(() => {});
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function savedFlags(id: string, flags: string[]) {
    if (candidate?.id === id) setCandidate(null);
    setAdmins((current) => {
      const list = current ?? [];
      const exists = list.some((member) => member.id === id);
      const base = exists ? list : [...list, ...(candidate?.id === id ? [candidate] : [])];
      return base
        .map((member) => (member.id === id ? { ...member, flags } : member))
        .filter((member) => member.flags.includes("ADMIN"));
    });
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{t("admin.permissions.title")}</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t("admin.permissions.description")}</p>

        <label htmlFor="perm-search" className="mb-1 mt-3 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {t("admin.permissions.addAdmin")}
        </label>
        <input
          id="perm-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("common.nameOrUsername")}
          className={inputClass}
        />
        {query.trim().length >= 2 && hits.length > 0 && (
          <ul className="mt-1 flex max-h-48 flex-col gap-0.5 overflow-y-auto rounded-lg border border-zinc-200 p-1 dark:border-zinc-800">
            {hits.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setHits([]);
                    if (!admins?.some((member) => member.id === hit.id)) {
                      setCandidate({ id: hit.id, username: hit.username, displayName: hit.displayName, flags: hit.flags });
                    }
                  }}
                  className="w-full rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-zinc-100 dark:hover:bg-zinc-900"
                >
                  <span className="block truncate text-zinc-900 dark:text-zinc-100">{hit.displayName}</span>
                  <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">@{hit.username}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {admins === null && !error && <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("common.loading")}</p>}

      <ul className="flex flex-col gap-3">
        {candidate && (
          <MemberCard key={`candidate-${candidate.id}`} member={candidate} onSaved={(flags) => savedFlags(candidate.id, flags)} />
        )}
        {admins?.map((member) => (
          <MemberCard key={member.id} member={member} onSaved={(flags) => savedFlags(member.id, flags)} />
        ))}
      </ul>
    </div>
  );
}
