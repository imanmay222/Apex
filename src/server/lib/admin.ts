import type { AuthContext } from "../auth/sessions";

/** The acting admin, in the shape the services expect for auditing and attribution. */
export const actorOf = (auth: AuthContext) => ({
  id: auth.user.id,
  email: auth.user.email,
  name: auth.user.name,
  role: auth.user.role,
});
