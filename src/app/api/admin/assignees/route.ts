import { adminApi } from "@/server/lib/http";
import { listAssignees } from "@/server/services/users";

/** Active team members (id, name, role) for the enquiry "assign to" picker. */
export const GET = adminApi({ name: "assignees.list", permission: "enquiries:read" }, async () => listAssignees());
