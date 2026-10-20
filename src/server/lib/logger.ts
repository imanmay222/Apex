type Level = "debug" | "info" | "warn" | "error";

const weight: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const configured = (process.env.LOG_LEVEL ?? "info") as Level;
  return weight[configured] ?? weight.info;
}

function emit(level: Level, message: string, fields?: Record<string, unknown>) {
  if (weight[level] < threshold()) return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg: message, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** Serialises an unknown thrown value for logging without leaking it into responses. */
export function errorFields(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { error: error.message, name: error.name, stack: error.stack?.split("\n").slice(0, 6).join("\n") };
  }
  return { error: String(error) };
}

export const logger = {
  debug: (message: string, fields?: Record<string, unknown>) => emit("debug", message, fields),
  info: (message: string, fields?: Record<string, unknown>) => emit("info", message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => emit("warn", message, fields),
  error: (message: string, fields?: Record<string, unknown>) => emit("error", message, fields),
};
