/** Org-level roles — pure data, safe to import from client components. */

export type OrgRole = "owner" | "trader" | "analyst" | "viewer" | "risk";

export const ORG_ROLES: { id: OrgRole; th: string }[] = [
  { id: "owner", th: "เจ้าของ" },
  { id: "trader", th: "เทรดเดอร์" },
  { id: "analyst", th: "นักวิเคราะห์" },
  { id: "viewer", th: "ผู้ชม" },
  { id: "risk", th: "ผู้จัดการความเสี่ยง" },
];
