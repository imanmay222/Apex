import { createServer, type Server } from "node:http";
import { simpleParser } from "mailparser";
import { SMTPServer } from "smtp-server";

/**
 * Local stand-in for Mailpit: an SMTP server that keeps every message in memory, plus a tiny
 * HTTP API (same shape the tests use) and a browsable inbox. Development only - never relays.
 */
export interface Stored {
  ID: string;
  Subject: string;
  From: { Address: string; Name: string };
  To: { Address: string; Name: string }[];
  ReplyTo: { Address: string; Name: string }[];
  Text: string;
  HTML: string;
  Snippet: string;
  Created: string;
}

export interface MailSink {
  smtpPort: number;
  httpPort: number;
  messages: Stored[];
  stop(): Promise<void>;
}

const addresses = (field: unknown): { Address: string; Name: string }[] => {
  const list = Array.isArray(field) ? field : field ? [field] : [];
  return list.flatMap((entry) => (entry as { value?: { address?: string; name?: string }[] }).value ?? []).map((a) => ({ Address: a.address ?? "", Name: a.name ?? "" }));
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function startMailSink(opts: { smtpPort?: number; httpPort?: number; quiet?: boolean } = {}): Promise<MailSink> {
  const messages: Stored[] = [];
  let counter = 0;

  const smtp = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS", "AUTH"],
    size: 5 * 1024 * 1024,
    logger: false,
    onData(stream, _session, done) {
      simpleParser(stream)
        .then((mail) => {
          const to = addresses(mail.to);
          const text = mail.text ?? "";
          messages.unshift({
            ID: `m${++counter}`,
            Subject: mail.subject ?? "",
            From: addresses(mail.from)[0] ?? { Address: "", Name: "" },
            To: to,
            ReplyTo: addresses(mail.replyTo),
            Text: text,
            HTML: typeof mail.html === "string" ? mail.html : "",
            Snippet: text.replace(/\s+/g, " ").slice(0, 120),
            Created: new Date().toISOString(),
          });
          messages.splice(500);
          if (!opts.quiet) console.log(`  mail  ${mail.subject}  ->  ${to.map((t) => t.Address).join(", ")}`);
          done();
        })
        .catch(done);
    },
  });
  await new Promise<void>((resolve, reject) => {
    smtp.once("error", reject);
    smtp.listen(opts.smtpPort ?? 0, "127.0.0.1", resolve);
  });
  const smtpPort = (smtp.server.address() as { port: number }).port;

  const http: Server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const json = (body: unknown, status = 200) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };

    if (url.pathname === "/api/v1/messages") {
      if (req.method === "DELETE") {
        messages.length = 0;
        return json({ ok: true });
      }
      return json({ total: messages.length, messages: messages.map(({ Text, HTML, ...summary }) => (void Text, void HTML, summary)) });
    }

    const one = url.pathname.match(/^\/api\/v1\/message\/([\w-]+)$/);
    if (one) {
      const found = messages.find((m) => m.ID === one[1]);
      return found ? json(found) : json({ error: "not found" }, 404);
    }

    const view = url.pathname.match(/^\/message\/([\w-]+)$/);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (view) {
      const m = messages.find((x) => x.ID === view[1]);
      if (!m) return void res.writeHead(404).end("Not found");
      return void res.end(`<!doctype html><meta charset=utf-8><title>${esc(m.Subject)}</title><body style="font:14px system-ui;margin:24px"><p><a href="/">&larr; Inbox</a></p><h2>${esc(m.Subject)}</h2><p>To: ${esc(m.To.map((t) => t.Address).join(", "))}${m.ReplyTo.length ? ` &middot; Reply-To: ${esc(m.ReplyTo[0].Address)}` : ""}</p><iframe sandbox style="width:100%;height:70vh;border:1px solid #ccc" srcdoc="${esc(m.HTML || `<pre>${esc(m.Text)}</pre>`)}"></iframe></body>`);
    }
    res.end(`<!doctype html><meta charset=utf-8><title>Dev mail</title><body style="font:14px system-ui;margin:24px"><h2>Dev mail catcher (${messages.length})</h2>${messages.length === 0 ? "<p>No messages yet.</p>" : "<ul>" + messages.map((m) => `<li><a href="/message/${m.ID}">${esc(m.Subject)}</a> &mdash; ${esc(m.To.map((t) => t.Address).join(", "))} <small>${esc(m.Created)}</small></li>`).join("") + "</ul>"}<script>setTimeout(()=>location.reload(),5000)</script></body>`);
  });
  await new Promise<void>((resolve) => http.listen(opts.httpPort ?? 0, "127.0.0.1", resolve));
  const httpPort = (http.address() as { port: number }).port;

  return {
    smtpPort,
    httpPort,
    messages,
    stop: () =>
      new Promise<void>((resolve) => {
        http.closeAllConnections?.();
        http.close(() => smtp.close(() => resolve()));
      }),
  };
}
