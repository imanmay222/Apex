import { checkFormToken } from "../services/enquiries";
import { ApiError } from "./errors";

const TOKEN_ERRORS = {
  invalid: new ApiError(400, "INVALID_FORM_TOKEN", "This form is no longer valid. Please refresh the page and try again."),
  expired: new ApiError(400, "FORM_EXPIRED", "This form has expired. Please refresh the page and try again."),
  "too-fast": new ApiError(400, "SUBMITTED_TOO_FAST", "That was quick! Please wait a moment and submit again."),
} as const;

/** Shared by every public form: the signed token proves the page was loaded and not merely POSTed at. */
export function assertFormToken(token: string): void {
  const check = checkFormToken(token);
  if (check !== "ok") throw TOKEN_ERRORS[check];
}
