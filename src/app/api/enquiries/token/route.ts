import { api, preflight } from "@/server/lib/http";
import { issueFormToken } from "@/server/services/enquiries";

export const OPTIONS = preflight();

/**
 * Issues a signed, time-stamped token that the form must send back with the submission. It proves
 * the form was actually loaded (and not merely POSTed at) and enforces a minimum fill time.
 */
export const GET = api({ name: "enquiries.token", cors: true, rateLimit: { limit: 30, windowSec: 600 } }, async () => ({
  token: issueFormToken(),
}));
