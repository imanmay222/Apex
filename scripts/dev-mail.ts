import { startMailSink } from "./lib/mail-sink";

async function main() {
  const sink = await startMailSink({
    smtpPort: Number(process.env.DEV_SMTP_PORT ?? 1025),
    httpPort: Number(process.env.DEV_MAIL_UI_PORT ?? 8025),
  });
  console.log(`Dev mail catcher running.\n  SMTP  127.0.0.1:${sink.smtpPort}   (SMTP_HOST=127.0.0.1 SMTP_PORT=${sink.smtpPort})\n  Inbox http://127.0.0.1:${sink.httpPort}\n`);

  const shutdown = async () => {
    await sink.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
