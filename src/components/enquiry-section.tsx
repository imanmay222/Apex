import { getEnquiryOptions } from "@/server/data/public";
import { EnquiryForm } from "./enquiry-form";

/** Server wrapper: supplies the form with the live product / survey / training choices. */
export async function EnquiryFormWithOptions(props: { defaultType?: "products" | "survey" | "training"; defaultSubject?: string }) {
  return <EnquiryForm options={await getEnquiryOptions()} {...props} />;
}
