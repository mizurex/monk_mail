import * as https from "https";
import * as fs from "fs";
import * as path from "path";

export interface MonkmailConfig {
  botToken: string;
  chatId: string;
}

export interface TelegramAttachment {
  filename: string;
  content: Buffer | string;
}

export class Monkmail {
  private config: MonkmailConfig;

  constructor(config: MonkmailConfig) {
    this.config = config;
    if (!this.config.botToken || !this.config.chatId) {
      throw new Error("Monkmail requires botToken and chatId");
    }
  }

  async sendMail(message: string): Promise<void> {
    const { botToken, chatId } = this.config;
    const payload = JSON.stringify({ chat_id: chatId, text: message });

    await new Promise<void>((resolve, reject) => {
      const req = https.request(
        {
          hostname: "api.telegram.org",
          port: 443,
          path: `/bot${botToken}/sendMessage`,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          },        },
        (res) => {
          let body = "";
          res.on("data", (c) => (body += c));
          res.on("end", () => {
            if (res.statusCode === 200) resolve();
            else reject(new Error(`Telegram error ${res.statusCode}: ${body}`));
          });        }
      );

      req.on("error", (err) => reject(err));
      req.write(payload);
      req.end();
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Photo (Images)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Send a photo (image file)
   * Supports: JPEG, PNG, GIF, WebP
   * 
   * @example
   * // From file path
   * await telegram.sendPhoto("./screenshot.png", "Check this out!");
   * 
   * @example
   * // From Buffer
   * const imageBuffer = fs.readFileSync("./image.jpg");
   * await telegram.sendPhoto(imageBuffer, "My photo", "photo.jpg");
   * 
   * How it works:
   * ─────────────
   * Telegram requires multipart/form-data for file uploads.
   * This is the same format used by HTML forms with file inputs.
   * 
   * Format:
   *   --boundary
   *   Content-Disposition: form-data; name="chat_id"
   *   
   *   123456789
   *   --boundary
   *   Content-Disposition: form-data; name="photo"; filename="image.png"
   *   Content-Type: image/png
   *   
   *   <binary image data>
   *   --boundary--
   */
  async sendPhoto(
    photo: Buffer | string,
    caption?: string,
    filename?: string
  ): Promise<void> {
    const { botToken, chatId } = this.config;

    // Get file content
    const photoBuffer = Buffer.isBuffer(photo) ? photo : fs.readFileSync(photo);
    const photoFilename = filename || (typeof photo === "string" ? path.basename(photo) : "photo.jpg");

    // Detect content type from filename
    const contentType = this.getImageContentType(photoFilename);

    // Build multipart form data
    const boundary = `----FormBoundary${Date.now()}`;
    const parts: Buffer[] = [];

    // Part 1: chat_id
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="chat_id"\r\n\r\n` +
      `${chatId}\r\n`
    ));

    // Part 2: caption (optional)
    if (caption) {
      parts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="caption"\r\n\r\n` +
        `${caption}\r\n`
      ));
    }

    // Part 3: photo file
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="photo"; filename="${photoFilename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`
    ));
    parts.push(photoBuffer);
    parts.push(Buffer.from(`\r\n`));

    // Final boundary
    parts.push(Buffer.from(`--${boundary}--\r\n`));

    // Combine all parts
    const body = Buffer.concat(parts);

    await this.sendMultipart(`/bot${botToken}/sendPhoto`, boundary, body);
  }

  /**
   * Send a document (PDF, file, etc.)
   * 
   * @example
   * // From file path
   * await telegram.sendDocument("./report.pdf", "Monthly report");
   * 
   * @example
   * // From Buffer
   * const pdfBuffer = fs.readFileSync("./invoice.pdf");
   * await telegram.sendDocument(pdfBuffer, "Your invoice", "invoice.pdf");
   */
  async sendDocument(
    document: Buffer | string,
    caption?: string,
    filename?: string
  ): Promise<void> {
    const { botToken, chatId } = this.config;

    // Get file content
    const docBuffer = Buffer.isBuffer(document) ? document : fs.readFileSync(document);
    const docFilename = filename || (typeof document === "string" ? path.basename(document) : "document");

    // Detect content type
    const contentType = this.getDocumentContentType(docFilename);

    // Build multipart form data
    const boundary = `----FormBoundary${Date.now()}`;
    const parts: Buffer[] = [];

    // Part 1: chat_id
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="chat_id"\r\n\r\n` +
      `${chatId}\r\n`
    ));

    // Part 2: caption (optional)
    if (caption) {
      parts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="caption"\r\n\r\n` +
        `${caption}\r\n`
      ));
    }

    // Part 3: document file
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="document"; filename="${docFilename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`
    ));
    parts.push(docBuffer);
    parts.push(Buffer.from(`\r\n`));

    // Final boundary
    parts.push(Buffer.from(`--${boundary}--\r\n`));

    // Combine all parts
    const body = Buffer.concat(parts);

    await this.sendMultipart(`/bot${botToken}/sendDocument`, boundary, body);
  }

  private sendMultipart(apiPath: string, boundary: string, body: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: "api.telegram.org",
          port: 443,
          path: apiPath,
          method: "POST",
          headers: {
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
            "Content-Length": body.length,
          },
        },
        (res) => {
          let responseBody = "";
          res.on("data", (c) => (responseBody += c));
          res.on("end", () => {
            if (res.statusCode === 200) resolve();
            else reject(new Error(`Telegram error ${res.statusCode}: ${responseBody}`));
          });
        }
      );

      req.on("error", reject);
      req.write(body);
      req.end();
    });
  }

  /**
   * Get content type for images
   */
  private getImageContentType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const types: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };
    return types[ext] || "image/jpeg";
  }

  /**
   * Get content type for documents
   */
  private getDocumentContentType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const types: Record<string, string> = {
      ".pdf": "application/pdf",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".xls": "application/vnd.ms-excel",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".txt": "text/plain",
      ".csv": "text/csv",
      ".json": "application/json",
      ".zip": "application/zip",
    };
    return types[ext] || "application/octet-stream";
  }
}




export interface GithubWebhookOptions {
  rawBody: Buffer;
  event?: string;
}

/**
 * monkHandler: Process GitHub webhook events
 */
export async function monkHandler(
  { rawBody, event }: GithubWebhookOptions,
  send: (text: string) => Promise<void>
): Promise<void> {
  if (!rawBody) throw new Error("rawBody required");

  let payload: any;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new Error("Invalid JSON");
  }

  switch (event) {
    case "workflow_run":
      return handleWorkflowRun(payload, send);
    case "pull_request":
      return handlePullRequest(payload, send);
    case "issues":
      return handleIssue(payload, send);
    case "push":
      return handlePush(payload, send);
    default:
      return safeSend(send, buildGenericGithubMessage(event, payload));
  }
}

const ANIMALS = [String.raw`ʕ•ᴥ•ʔ`];

function randomAnimal(): string {
  const idx = Math.floor(Math.random() * ANIMALS.length);
  return ANIMALS[idx];
}

const SEP = "────────────────────────";

function headerLine(label: string, repoName?: string) {
  return `┏ ${label}${repoName ? ` • ${repoName}` : ""}\n${SEP}`;
}

/* ---------------- GitHub handlers ---------------- */

async function handleWorkflowRun(payload: any, send: (t: string) => Promise<void>) {
  const run = payload.workflow_run;
  const repo = payload.repository;

  const workflowName = run?.name || payload.workflow?.name || "workflow";
  const conclusion = run?.conclusion || "unknown";
  const branch = run?.head_branch || run?.head_commit?.ref || "unknown";
  const actor = run?.actor?.login || payload.sender?.login || "unknown";
  const htmlUrl = run?.html_url || repo?.html_url || "";

  const art = randomAnimal();

  const msg =
    `${art}\n` +
    `${headerLine("Workflow", repo?.full_name)}\n` +
    `Name   : ${workflowName}\n` +
    `Status : ${conclusion}\n` +
    `Branch : ${branch}\n` +
    `By     : ${actor}\n` +
    (htmlUrl ? `View   : ${htmlUrl}\n` : "") +
    SEP;

  await safeSend(send, msg);
}

async function handlePullRequest(payload: any, send: (t: string) => Promise<void>) {
  const pr = payload.pull_request;
  const repo = payload.repository;
  if (!pr) return;

  const action = payload.action || "updated";
  const title = pr.title || "(no title)";
  const number = pr.number;
  const author = pr.user?.login || "unknown";
  const htmlUrl = pr.html_url || "";

  const art = randomAnimal();

  const msg =
    `${art}\n` +
    `${headerLine("Pull Request", repo?.full_name)}\n` +
    `Action : ${action}\n` +
    `#${number}: ${title}\n` +
    `By     : ${author}\n` +
    (htmlUrl ? `View   : ${htmlUrl}\n` : "") +
    SEP;

  await safeSend(send, msg);
}

async function handleIssue(payload: any, send: (t: string) => Promise<void>) {
  const issue = payload.issue;
  const repo = payload.repository;
  if (!issue) return;

  const action = payload.action || "updated";
  const title = issue.title || "(no title)";
  const number = issue.number;
  const author = issue.user?.login || "unknown";
  const htmlUrl = issue.html_url || "";

  const art = randomAnimal();

  const msg =
    `${art}\n` +
    `${headerLine("Issue", repo?.full_name)}\n` +
    `Action : ${action}\n` +
    `#${number}: ${title}\n` +
    `By     : ${author}\n` +
    (htmlUrl ? `View   : ${htmlUrl}\n` : "") +
    SEP;

  await safeSend(send, msg);
}

async function handlePush(payload: any, send: (t: string) => Promise<void>) {
  const repo = payload.repository;
  const ref = payload.ref || "";
  const branch = ref.replace("refs/heads/", "") || "unknown";
  const pusher = payload.pusher?.name || payload.sender?.login || "unknown";
  const commits: any[] = payload.commits || [];
  const last = commits[commits.length - 1] || {};
  const commitMsg = last.message || "(no message)";
  const commitId = last.id || "";
  const commitUrl =
    last.url || (repo?.html_url && commitId ? `${repo.html_url}/commit/${commitId}` : "");

  const art = randomAnimal();

  const msg =
    `${art}\n` +
    `${headerLine("⬆️ Push", repo?.full_name)}\n` +
    `Branch : ${branch}\n` +
    `By     : ${pusher}\n` +
    `Latest : ${commitMsg}\n` +
    (commitUrl ? `View   : ${commitUrl}\n` : "") +
    SEP;

  await safeSend(send, msg);
}

/* ---------------- Fallback for all other GitHub events ---------------- */

function buildGenericGithubMessage(event: string | undefined, payload: any) {
  return `GitHub event: ${event}\nPayload:\n${JSON.stringify(payload, null, 2)}`;
}

async function safeSend(send: (t: string) => Promise<void>, text: string) {
  try {
    await send(text);
  } catch (err) {
    console.error("send failed", err);
  }
}
