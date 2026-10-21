import { getAccountToken } from "./accountApi";
import { getSignalingHttpBase } from "./roomsApi";
import { translate } from "@/lib/i18n";
import { trackFeatureEvent } from "./features";
import type { PartnerClickRewardPlacement, PartnerSchedule } from "./partner";
import type { PartnerStats } from "./adminApi";
import type { PixCharge } from "./premiumApi";

// The self-serve ad dashboard (/partner): buy a slot, build the card, pay,
// wait for an admin, then watch it run. Talks to the API's
// partnerOrderRoutes.ts. Named "partner", never "ad", like everything else
// around these cards: ad-blocker filter lists key off that word.

/** The experiment the whole flow sits behind (see the admin "Features" tab). */
export const SELF_SERVE_PARTNER_FEATURE = "self-serve-ads";

/** Every site event the flow sends — register them on the feature in the admin. */
export const SELF_SERVE_PARTNER_EVENTS = {
  ctaClick: "partner_order_cta_click",
  wizardStep: "partner_order_step",
  created: "partner_order_created",
  checkoutPix: "partner_order_checkout_pix",
  checkoutCard: "partner_order_checkout_card",
  paid: "partner_order_paid",
  edit: "partner_order_edit",
  renew: "partner_order_renew",
  discordClick: "partner_order_discord_click",
} as const;

/** The API's SELF_SERVE_REWARD_POINTS_MAX: points per person a self-serve ad may give. */
export const SELF_SERVE_REWARD_POINTS_MAX = 1000;

/** A usage event, counted for this experiment only. */
export function trackPartnerOrderEvent(name: string, value?: number) {
  trackFeatureEvent(name, { feature: SELF_SERVE_PARTNER_FEATURE, ...(value ? { value } : {}) });
}

/** Where to talk to a human: the ads ticket on the Discord server. */
export const PARTNER_DISCORD_URL = "https://go.nemtudo.me/golive-partner-nemtudodiscord";

export type PartnerPackage = { id: string; hours: number; priceCents: number; priceLabel: string };

export type PartnerOrderConfig = {
  packages: PartnerPackage[];
  methods: { pix: boolean; card: boolean };
};

/** What an advertiser sets on the card — every admin field except weight and dates. */
export type PartnerCreative = {
  title: string;
  description: string;
  extendedDescription: string | null;
  imageUrl: string | null;
  iconUrl: string | null;
  buttonLabel: string;
  buttonUrl: string;
  backgroundColor: string | null;
  textColor: string | null;
  buttonBackgroundColor: string | null;
  buttonTextColor: string | null;
  rewardVideoUrl: string | null;
  rewardPoints: number | null;
  clickRewardPoints: number | null;
  clickRewardPlacement: PartnerClickRewardPlacement | null;
  schedules?: PartnerSchedule[];
};

export type PartnerOrderStatus = "awaiting_payment" | "pending_review" | "approved" | "rejected" | "cancelled";

export type PartnerOrder = {
  id: string;
  status: PartnerOrderStatus;
  packageId: string;
  hours: number;
  amountCents: number;
  amountLabel: string;
  creative: PartnerCreative;
  pendingCreative: PartnerCreative | null;
  paymentMethod: "pix" | "card" | null;
  paidAt: number | null;
  approvedAt: number | null;
  endsAt: number | null;
  reviewNote: string | null;
  reviewedAt: number | null;
  createdAt: number;
  live: boolean;
  reportToken: string | null;
  partnerId: string | null;
  stats?: (PartnerStats & { uniqueViews?: number }) | null;
};

export type AdminPartnerOrder = PartnerOrder & {
  accountId: string;
  username: string;
  provider: string | null;
  paidPaymentId: string | null;
  submittedAt: number | null;
  reviewedBy: string | null;
  needsReview: boolean;
};

export type PartnerCheckoutResult =
  | { method: "pix"; pix: PixCharge }
  | { method: "card"; url: string };

/** A refused request, with what the buyer can still do about it. */
export class PartnerOrderError extends Error {
  needsEmail: boolean;
  needsTaxId: boolean;
  constructor(message: string, body: { needsEmail?: boolean; needsTaxId?: boolean } | null) {
    super(message);
    this.needsEmail = Boolean(body?.needsEmail);
    this.needsTaxId = Boolean(body?.needsTaxId);
  }
}

async function call<T>(path: string, init?: RequestInit & { auth?: boolean }): Promise<T> {
  const token = getAccountToken();
  if (init?.auth !== false && !token) throw new PartnerOrderError("unauthorized", null);
  const res = await fetch(`${getSignalingHttpBase()}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as (Record<string, unknown> & { error?: string }) | null;
  if (!res.ok) {
    throw new PartnerOrderError(
      typeof data?.error === "string" ? data.error : translate("adminApi.errorStatus", { status: res.status }),
      data as { needsEmail?: boolean; needsTaxId?: boolean } | null
    );
  }
  return data as T;
}

export function fetchPartnerOrderConfig(): Promise<PartnerOrderConfig> {
  return call("/partner-orders/config", { auth: false });
}

export async function fetchMyPartnerOrders(): Promise<PartnerOrder[]> {
  return (await call<{ orders: PartnerOrder[] }>("/partner-orders")).orders;
}

export async function fetchPartnerOrder(id: string, signal?: AbortSignal): Promise<PartnerOrder> {
  return (await call<{ order: PartnerOrder }>(`/partner-orders/${encodeURIComponent(id)}`, { signal })).order;
}

export async function createPartnerOrder(packageId: string, creative: PartnerCreative): Promise<PartnerOrder> {
  return (
    await call<{ order: PartnerOrder }>("/partner-orders", {
      method: "POST",
      body: JSON.stringify({ packageId, creative }),
    })
  ).order;
}

export async function updatePartnerOrder(
  id: string,
  creative: PartnerCreative,
  packageId?: string
): Promise<PartnerOrder> {
  return (
    await call<{ order: PartnerOrder }>(`/partner-orders/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify({ creative, ...(packageId ? { packageId } : {}) }),
    })
  ).order;
}

export async function withdrawPartnerOrderEdit(id: string): Promise<PartnerOrder> {
  return (
    await call<{ order: PartnerOrder }>(`/partner-orders/${encodeURIComponent(id)}/pending-edit`, {
      method: "DELETE",
    })
  ).order;
}

export async function deletePartnerOrder(id: string): Promise<void> {
  await call<void>(`/partner-orders/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function startPartnerCheckout(
  id: string,
  method: "pix" | "card",
  extra: { email?: string; taxId?: string } = {}
): Promise<PartnerCheckoutResult> {
  return call(`/partner-orders/${encodeURIComponent(id)}/checkout`, {
    method: "POST",
    body: JSON.stringify({ method, ...extra }),
  });
}

// --- Admin -----------------------------------------------------------------

export async function fetchPartnerOrdersPendingCount(): Promise<number> {
  return (await call<{ count: number }>("/admin/partner-orders/pending-count")).count;
}

export function fetchAdminPartnerOrders(): Promise<{ orders: AdminPartnerOrder[]; pendingCount: number }> {
  return call("/admin/partner-orders");
}

export async function approvePartnerOrder(id: string): Promise<AdminPartnerOrder> {
  return (
    await call<{ order: AdminPartnerOrder }>(`/admin/partner-orders/${encodeURIComponent(id)}/approve`, {
      method: "POST",
      body: JSON.stringify({}),
    })
  ).order;
}

export async function rejectPartnerOrder(id: string, note: string): Promise<AdminPartnerOrder> {
  return (
    await call<{ order: AdminPartnerOrder }>(`/admin/partner-orders/${encodeURIComponent(id)}/reject`, {
      method: "POST",
      body: JSON.stringify({ note }),
    })
  ).order;
}

// --- Helpers ---------------------------------------------------------------

/** "24 horas", "3 dias" — a package's length as people say it. */
export function packageDurationLabel(hours: number): string {
  if (hours < 72) return translate("partnerOrders.hoursCount", { count: hours });
  return translate("partnerOrders.daysCount", { count: Math.round(hours / 24) });
}

/** What the API's /checkout prices a package at, per day — for the "economize" hint. */
export function pricePerDayCents(pkg: Pick<PartnerPackage, "hours" | "priceCents">): number {
  return Math.round(pkg.priceCents / (pkg.hours / 24));
}

/** The status as a short label and a tone for its pill. */
export function orderStatusDisplay(order: Pick<PartnerOrder, "status" | "live" | "pendingCreative">): {
  label: string;
  tone: "zinc" | "amber" | "emerald" | "red" | "sky";
} {
  switch (order.status) {
    case "awaiting_payment":
      return { label: translate("partnerOrders.status.awaitingPayment"), tone: "zinc" };
    case "pending_review":
      return { label: translate("partnerOrders.status.pendingReview"), tone: "amber" };
    case "rejected":
      return { label: translate("partnerOrders.status.rejected"), tone: "red" };
    case "approved":
      if (order.pendingCreative) return { label: translate("partnerOrders.status.editInReview"), tone: "sky" };
      return order.live
        ? { label: translate("partnerOrders.status.live"), tone: "emerald" }
        : { label: translate("partnerOrders.status.ended"), tone: "zinc" };
    default:
      return { label: order.status, tone: "zinc" };
  }
}

export const STATUS_TONE_CLASS: Record<string, string> = {
  zinc: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
};

/** An empty creative to start the builder from. */
export function blankCreative(): PartnerCreative {
  return {
    title: "",
    description: "",
    extendedDescription: null,
    imageUrl: null,
    iconUrl: null,
    buttonLabel: translate("partnerCard.learnMore"),
    buttonUrl: "https://",
    backgroundColor: "#111827",
    textColor: "#f4f4f5",
    buttonBackgroundColor: "#10b981",
    buttonTextColor: "#ffffff",
    rewardVideoUrl: null,
    rewardPoints: null,
    clickRewardPoints: null,
    clickRewardPlacement: null,
    schedules: [],
  };
}

/** The creative a stored order carries, cleaned of anything the API adds. */
export function creativeOf(source: PartnerCreative): PartnerCreative {
  return {
    title: source.title,
    description: source.description,
    extendedDescription: source.extendedDescription ?? null,
    imageUrl: source.imageUrl ?? null,
    iconUrl: source.iconUrl ?? null,
    buttonLabel: source.buttonLabel,
    buttonUrl: source.buttonUrl,
    backgroundColor: source.backgroundColor ?? null,
    textColor: source.textColor ?? null,
    buttonBackgroundColor: source.buttonBackgroundColor ?? null,
    buttonTextColor: source.buttonTextColor ?? null,
    rewardVideoUrl: source.rewardVideoUrl ?? null,
    rewardPoints: source.rewardPoints ?? null,
    clickRewardPoints: source.clickRewardPoints ?? null,
    clickRewardPlacement: source.clickRewardPlacement ?? null,
    schedules: source.schedules ?? [],
  };
}
