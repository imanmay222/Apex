import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashPassword, passwordProblem, verifyPassword } from "../src/server/auth/password";
import { can, permissionsFor } from "../src/server/auth/permissions";
import { cleanPath } from "../src/server/services/analytics";
import { checkFormToken, issueFormToken, scoreSpam } from "../src/server/services/enquiries";
import { detectFileType } from "../src/server/services/media";
import { csvCell, escapeHtml, escapeRegex, singleLine, slugify, tokenize } from "../src/server/lib/text";
import { normalizePhone } from "../src/server/validation/primitives";
import { signToken, verifyToken } from "../src/server/lib/signed-token";
import { PNG_1X1 } from "./helpers";

describe("slugify", () => {
  it("transliterates German characters", () => assert.equal(slugify("Dräger X-plore 8000 PAPR"), "draeger-x-plore-8000-papr"));
  it("collapses punctuation and ampersands", () => assert.equal(slugify("Road Safety & Traffic Products"), "road-safety-and-traffic-products"));
  it("never starts or ends with a hyphen", () => assert.equal(slugify("  --Hello, World!--  "), "hello-world"));
  it("returns empty for symbols only", () => assert.equal(slugify("!!!"), ""));
});

describe("normalizePhone", () => {
  for (const [input, expected] of [
    ["98765 43210", "+919876543210"],
    ["+91 98765-43210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["09876543210", "+919876543210"],
    ["(+44) 20 7946 0958", "+442079460958"],
  ] as const) {
    it(`${input} -> ${expected}`, () => assert.equal(normalizePhone(input), expected));
  }
  for (const bad of ["12345", "abcdefghij", "5876543210", "", "+1", "98765 4321"]) {
    it(`rejects "${bad}"`, () => assert.equal(normalizePhone(bad), null));
  }
});

describe("text helpers", () => {
  it("neutralises CSV formula injection", () => {
    for (const evil of ["=HYPERLINK(\"x\")", "+1+1", "-2+3", "@SUM(A1)"]) assert.ok(csvCell(evil).startsWith("'") || csvCell(evil).startsWith("\"'"));
  });
  it("leaves phone numbers and plain numbers readable", () => {
    for (const ok of ["+919876543210", "+91 98765-43210", "-5", "(044) 2345"]) assert.equal(csvCell(ok), ok);
  });
  it("still escapes formulas that merely start like a number", () => {
    for (const evil of ["+1+1", "-2+3", "+cmd|' /C calc'!A0", "=1+1"]) assert.ok(csvCell(evil).startsWith("'"), evil);
  });
  it("quotes cells with commas, quotes and newlines", () => {
    assert.equal(csvCell('a,"b"'), '"a,""b"""');
    assert.equal(csvCell("line1\nline2"), '"line1\nline2"');
    assert.equal(csvCell(null), "");
  });
  it("escapes HTML", () => assert.equal(escapeHtml(`<img src=x onerror="a()">&'`), "&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39;"));
  it("escapes regex metacharacters", () => assert.equal(new RegExp(escapeRegex("a.b*c(d)")).test("a.b*c(d)"), true));
  it("strips CR/LF (header injection)", () => assert.equal(singleLine("Hi\r\nBcc: evil@x.com"), "Hi Bcc: evil@x.com"));
  it("tokenizes and caps tokens", () => {
    assert.deepEqual(tokenize("  Gas,   Detector "), ["gas", "detector"]);
    assert.equal(tokenize("a b c d e f g h").length, 6);
  });
});

describe("spam scoring", () => {
  it("passes a normal enquiry", () => {
    const r = scoreSpam({ name: "Ravi Kumar", message: "We need 200 helmets and gloves for our plant in Cuddalore." });
    assert.equal(r.isSpam, false);
  });
  it("flags link-heavy spam words", () => {
    const r = scoreSpam({ name: "Seo Guy", message: "Cheap backlinks! http://a.com http://b.com http://c.com" });
    assert.equal(r.isSpam, true);
    assert.ok(r.reasons.includes("many-links"));
  });
  it("flags a filled honeypot outright", () => assert.equal(scoreSpam({ name: "Bot", message: "hello there friend", honeypot: "http://x" }).isSpam, true));
  it("flags disposable email + URL name", () => assert.equal(scoreSpam({ name: "www.buy-now.com", message: "hello world check", email: "a@mailinator.com" }).isSpam, true));
});

describe("form tokens", () => {
  it("rejects tampered tokens", () => assert.equal(checkFormToken(`${issueFormToken()}x`), "invalid"));
  it("rejects garbage", () => assert.equal(checkFormToken("nonsense"), "invalid"));
  it("rejects tokens used too quickly", () => assert.equal(checkFormToken(issueFormToken()), "too-fast"));
});

describe("file type sniffing", () => {
  it("accepts a real PNG", () => assert.equal(detectFileType(PNG_1X1)?.contentType, "image/png"));
  it("accepts PDFs", () => assert.equal(detectFileType(Buffer.from("%PDF-1.7\n..."))?.contentType, "application/pdf"));
  it("rejects SVG (script-capable)", () => assert.equal(detectFileType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>')), null));
  it("rejects HTML and plain text", () => {
    assert.equal(detectFileType(Buffer.from("<html><script>alert(1)</script></html>")), null);
    assert.equal(detectFileType(Buffer.from("just some text")), null);
  });
});

describe("passwords", () => {
  it("round-trips and rejects the wrong password", async () => {
    const hash = await hashPassword("Correct-Horse-9-Battery");
    assert.match(hash, /^scrypt\$32768\$8\$1\$/);
    assert.equal(await verifyPassword("Correct-Horse-9-Battery", hash), true);
    assert.equal(await verifyPassword("Correct-Horse-9-Batterx", hash), false);
  });
  it("salts every hash", async () => assert.notEqual(await hashPassword("Same-Password-123"), await hashPassword("Same-Password-123")));
  it("refuses malformed stored hashes", async () => assert.equal(await verifyPassword("x", "not-a-hash"), false));
  it("enforces the policy", () => {
    assert.ok(passwordProblem("short1"));
    assert.ok(passwordProblem("onlylettersnodigits"));
    assert.ok(passwordProblem("123456789012345"));
    assert.ok(passwordProblem("password1234"));
    assert.ok(passwordProblem("ravi-kumar-2026", { email: "ravi@x.com" }));
    assert.equal(passwordProblem("Tr0ub4dor-and-3-horses"), null);
  });
});

describe("permissions", () => {
  it("admin can do everything", () => assert.ok(can("admin", "users:manage") && can("admin", "enquiries:delete")));
  it("editor edits content but not enquiries", () => {
    assert.ok(can("editor", "content:write"));
    assert.ok(!can("editor", "enquiries:read"));
  });
  it("sales works enquiries but not content or users", () => {
    assert.ok(can("sales", "enquiries:write"));
    assert.ok(!can("sales", "content:write") && !can("sales", "users:manage") && !can("sales", "enquiries:delete"));
  });
  it("lists permissions per role", () => assert.ok(permissionsFor("editor").includes("media:write")));
});

describe("analytics path hygiene", () => {
  it("keeps clean paths", () => assert.equal(cleanPath("/products/scba/?utm=1#x"), "/products/scba"));
  it("drops API, admin and protocol-relative paths", () => {
    for (const bad of ["/api/products", "/admin/x", "//evil.com", "http://evil.com", "relative"]) assert.equal(cleanPath(bad), null);
  });
});

describe("signed tokens", () => {
  it("round-trips a payload", () => assert.deepEqual(verifyToken(signToken({ a: "confirm", id: "abc" })), { a: "confirm", id: "abc" }));
  it("rejects a tampered payload", () => {
    const [body, sig] = signToken({ a: "confirm", id: "abc" }).split(".");
    const forged = Buffer.from(JSON.stringify({ a: "confirm", id: "xyz" })).toString("base64url");
    assert.equal(verifyToken(`${forged}.${sig}`), null);
    assert.equal(verifyToken(`${body}.deadbeef`), null);
  });
  it("rejects malformed tokens", () => {
    for (const bad of ["", "x", "a.b.c", ".", "a."]) assert.equal(verifyToken(bad), null, bad);
  });
  it("honours expiry", () => {
    assert.ok(verifyToken(signToken({ a: "x" }, 60)));
    assert.equal(verifyToken(signToken({ a: "x" }, -10)), null);
  });
});

describe("subscriber permissions", () => {
  it("sales can read the list but not erase entries; editors cannot touch it", () => {
    assert.ok(can("sales", "subscribers:read"));
    assert.ok(!can("sales", "subscribers:manage"));
    assert.ok(!can("editor", "subscribers:read"));
    assert.ok(can("admin", "subscribers:manage"));
  });
});
