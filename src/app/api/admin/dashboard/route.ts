import { adminApi } from "@/server/lib/http";
import { dashboardSnapshot } from "@/server/services/dashboard";

export const GET = adminApi({ name: "dashboard.get", permission: "enquiries:read" }, async () => dashboardSnapshot());
