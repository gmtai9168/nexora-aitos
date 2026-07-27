import { kvGetJson, kvSetJson } from "./kv";
import { updateUser, type KycStatus } from "./users";

/**
 * KYC submissions. Stores the applicant's details (and an optional ID image,
 * size-capped) at `nexora:kyc:<email>` and mirrors the status onto the user
 * record so the whole app can gate on it. Review is manual by an admin/founder.
 */

export type KycSubmission = {
  email: string;
  fullName: string;
  docType: "id_card" | "passport" | "driver_license";
  docNumber: string;
  /** Optional data-URI of the ID image; capped so it fits a KV value. */
  docImage?: string;
  status: KycStatus;
  submittedAt: number;
  reviewedAt?: number;
  reviewer?: string;
  reason?: string;
};

const key = (email: string) => `nexora:kyc:${email.trim().toLowerCase()}`;
const INDEX_KEY = "nexora:kyc:index";
const MAX_IMAGE = 600_000; // ~600 KB data-URI cap

/** Maintains a de-duplicated list of every email that has submitted KYC. */
async function addToIndex(email: string): Promise<void> {
  const list = (await kvGetJson<string[]>(INDEX_KEY)) ?? [];
  const e = email.trim().toLowerCase();
  if (!list.includes(e)) await kvSetJson(INDEX_KEY, [...list, e]);
}

/** All submissions (image stripped), newest first — for the admin review queue. */
export async function listSubmissions(): Promise<ReturnType<typeof toSummary>[]> {
  const emails = (await kvGetJson<string[]>(INDEX_KEY)) ?? [];
  const subs = await Promise.all(emails.map((e) => getKyc(e)));
  return subs
    .filter((s): s is KycSubmission => Boolean(s))
    .sort((a, b) => b.submittedAt - a.submittedAt)
    .map(toSummary);
}

export async function getKyc(email: string): Promise<KycSubmission | null> {
  return kvGetJson<KycSubmission>(key(email));
}

export async function submitKyc(
  email: string,
  input: { fullName: string; docType: KycSubmission["docType"]; docNumber: string; docImage?: string },
): Promise<KycSubmission> {
  const image = input.docImage && input.docImage.length <= MAX_IMAGE ? input.docImage : undefined;
  const sub: KycSubmission = {
    email: email.trim().toLowerCase(),
    fullName: input.fullName.slice(0, 120),
    docType: input.docType,
    docNumber: input.docNumber.slice(0, 60),
    docImage: image,
    status: "pending",
    submittedAt: Date.now(),
  };
  await kvSetJson(key(email), sub);
  await addToIndex(sub.email);
  await updateUser(email, { kyc: "pending" });
  return sub;
}

export async function reviewKyc(
  email: string,
  decision: "approved" | "rejected",
  reviewer: string,
  reason?: string,
): Promise<KycSubmission | null> {
  const sub = await getKyc(email);
  if (!sub) return null;
  sub.status = decision;
  sub.reviewedAt = Date.now();
  sub.reviewer = reviewer;
  sub.reason = reason;
  await kvSetJson(key(email), sub);
  await updateUser(email, { kyc: decision });
  return sub;
}

/** Strips the image for list/status views. */
export function toSummary(sub: KycSubmission) {
  const { docImage, ...rest } = sub;
  void docImage;
  return { ...rest, hasImage: Boolean(docImage) };
}
