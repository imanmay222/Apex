import { can } from "@/server/auth/permissions";
import { adminApi } from "@/server/lib/http";
import { dashboardSnapshot } from "@/server/services/dashboard";

/** Enquiry overview, plus orders for roles that can see them (`orders` is null otherwise). */
export const GET = adminApi({ name: "dashboard.get", permission: "enquiries:read" }, async ({ auth }) =>
  dashboardSnapshot({ includeOrders: can(auth.user.role, "orders:read") }),
);
