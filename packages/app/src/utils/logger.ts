import * as fs from "fs";
import * as path from "path";

const LOG_DIR = path.join(process.cwd(), "monkmail-logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function timestamp() {
  return new Date().toISOString();
}

export function logFailedEmail(record: { id: string; email?: string; reason?: string }) {
  const filename = path.join(LOG_DIR, `${new Date().toISOString().slice(0, 10)}.log`);
  const line = JSON.stringify({ ts: timestamp(), ...record }) + "\n";
  fs.appendFile(filename, line, (err) => {
    if (err) {
      // If logging fails, print to console - but don't crash.
      // Keep zero-deps and minimal risk.
      // eslint-disable-next-line no-console
      console.error("Failed to write email log:", err);
    }
  });
}

export function readTodayLogs(): string {
  const filename = path.join(LOG_DIR, `${new Date().toISOString().slice(0, 10)}.log`);
  try {
    return fs.readFileSync(filename, "utf8");
  } catch {
    return "";
  }
}
