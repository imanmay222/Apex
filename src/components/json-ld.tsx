// U+2028 / U+2029 are valid in JSON but are line terminators in JavaScript source; build the
// patterns from char codes so no invisible characters live in this file.
const LINE_SEPARATOR = new RegExp(String.fromCharCode(0x2028), "g");
const PARAGRAPH_SEPARATOR = new RegExp(String.fromCharCode(0x2029), "g");

/**
 * Renders schema.org JSON-LD. Content now comes from the database, so `<` is escaped to keep a
 * stray `</script>` in an admin-entered string from breaking out of the tag.
 */
export function JsonLd({ data }: { data: unknown }) {
  const json = JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(LINE_SEPARATOR, "\\u2028")
    .replace(PARAGRAPH_SEPARATOR, "\\u2029");

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
