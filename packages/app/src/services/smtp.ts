import * as tls from "tls";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";



export interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  from: string;
}


export interface Attachment {
  filename: string;
  content: Buffer | string;
  mimeType?: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  /** Optional attachments (PDFs, images, etc.) */
  attachments?: Attachment[];
}




const MIME_TYPES: Record<string, string> = {
  // Images
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  // Documents
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // Text
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".json": "application/json",
  // Archives
  ".zip": "application/zip",
  ".rar": "application/x-rar-compressed",
  // Default
  "": "application/octet-stream",
};

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return MIME_TYPES[ext] || MIME_TYPES[""];
}

export class SmtpClient {
  private config: SmtpConfig;

  constructor(config: SmtpConfig) {
    this.config = config;
  }

  async sendEmail(to: string, subject: string, textBody: string): Promise<void> {
    return this.send({ to, subject, body: textBody });
  }

  /**
   * 
   * @example
   * // Email with PDF attachment
   * await smtp.send({
   *   to: "user@example.com",
   *   subject: "Report",
   *   body: "Please find attached.",
   *   attachments: [
   *     { filename: "report.pdf", content: fs.readFileSync("./report.pdf") }
   *   ]
   * });
   */
  async send(options: EmailOptions): Promise<void> {
    const { to, subject, body, attachments } = options;
    const { host, port, username, password, from } = this.config;

    // Build email content (simple or MIME multipart)
    const emailData = attachments && attachments.length > 0
      ? this.buildMimeEmail(from, to, subject, body, attachments)
      : this.buildSimpleEmail(from, to, subject, body);

    await this.sendRaw(host, port, username, password, from, to, emailData);
  }

  /**
   * Build a simple text email (no attachments)
   */
  private buildSimpleEmail(from: string, to: string, subject: string, body: string): string {
    return (
      `From: ${from}\r\n` +
      `To: <${to}>\r\n` +
      `Subject: ${subject}\r\n` +
      `MIME-Version: 1.0\r\n` +
      `Content-Type: text/plain; charset=utf-8\r\n` +
      `\r\n` +
      body
    );
  }

  private buildMimeEmail(
    from: string,
    to: string,
    subject: string,
    body: string,
    attachments: Attachment[]
  ): string {
    // Generate unique boundary 
    // This string MUST NOT appear in the content
    const boundary = `----=_Part_${crypto.randomBytes(16).toString("hex")}`;

    // Email headers
    let email =
      `From: ${from}\r\n` +
      `To: <${to}>\r\n` +
      `Subject: ${subject}\r\n` +
      `MIME-Version: 1.0\r\n` +
      `Content-Type: multipart/mixed; boundary="${boundary}"\r\n` +
      `\r\n` +
      `This is a multi-part message in MIME format.\r\n`;


    email +=
      `\r\n--${boundary}\r\n` +
      `Content-Type: text/plain; charset=utf-8\r\n` +
      `Content-Transfer-Encoding: 7bit\r\n` +
      `\r\n` +
      `${body}\r\n`;


    for (const attachment of attachments) {
      const content = this.getAttachmentContent(attachment);
      const mimeType = attachment.mimeType || getMimeType(attachment.filename);
      
      const base64Content = content.toString("base64");
      
      const formattedContent = base64Content.match(/.{1,76}/g)?.join("\r\n") || base64Content;

      email +=
        `\r\n--${boundary}\r\n` +
        `Content-Type: ${mimeType}; name="${attachment.filename}"\r\n` +
        `Content-Disposition: attachment; filename="${attachment.filename}"\r\n` +
        `Content-Transfer-Encoding: base64\r\n` +
        `\r\n` +
        `${formattedContent}\r\n`;
    }
    email += `\r\n--${boundary}--\r\n`;

    return email;
  }

  private getAttachmentContent(attachment: Attachment): Buffer {
    if (Buffer.isBuffer(attachment.content)) {
      return attachment.content;
    }
    return fs.readFileSync(attachment.content);
  }

  private async sendRaw(
    host: string,
    port: number,
    username: string,
    password: string,
    from: string,
    to: string,
    emailData: string
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const socket = tls.connect({ host, port, servername: host }, () => {
        (async () => {
          try {
            let resp = await this.read(socket);
            this.expectCode(resp, "220", "greeting");
            resp = await this.cmd(socket, `EHLO localhost\r\n`);
            this.expectCode(resp, "250", "EHLO");
            resp = await this.cmd(socket, `AUTH LOGIN\r\n`);
            this.expectCode(resp, "334", "AUTH LOGIN (username prompt)");
            resp = await this.cmd(socket, `${Buffer.from(username, "utf8").toString("base64")}\r\n`);
            this.expectCode(resp, "334", "AUTH LOGIN (password prompt)");
            resp = await this.cmd(socket, `${Buffer.from(password, "utf8").toString("base64")}\r\n`);
            this.expectCode(resp, "235", "AUTH success");
            resp = await this.cmd(socket, `MAIL FROM:<${this.extractAddress(from)}>\r\n`);
            this.expectCode(resp, "250", "MAIL FROM");
            resp = await this.cmd(socket, `RCPT TO:<${to}>\r\n`);
            this.expectCode(resp, "250", "RCPT TO");
            resp = await this.cmd(socket, `DATA\r\n`);
            this.expectCode(resp, "354", "DATA");
            resp = await this.cmd(socket, `${emailData}\r\n.\r\n`);
            this.expectCode(resp, "250", "end of DATA");
            await this.cmd(socket, `QUIT\r\n`);
            resolve();
          } catch (e) {
            reject(e);
          } finally {
            socket.end();
          }
        })();
      });

      socket.on("error", (err) => reject(err));
    });
  }

  private read(socket: tls.TLSSocket): Promise<string> {
    return new Promise((resolve, reject) => {
      const onData = (d: Buffer) => {
        socket.removeListener("error", onError);
        resolve(d.toString());
      };
      const onError = (err: Error) => {
        socket.removeListener("data", onData);
        reject(err);
      };

      socket.once("data", onData);
      socket.once("error", onError);
    });
  }

  private async cmd(socket: tls.TLSSocket, str: string): Promise<string> {
    socket.write(str);
    const resp = await this.read(socket);
    return resp;
  }

  private expectCode(response: string, expected: string, step: string) {
    const code = response.slice(0, 3);
    if (code !== expected) {
      throw new Error(`SMTP error at ${step}: expected ${expected}, got ${code}. Full response:\n${response}`);
    }
  }

  private extractAddress(from: string): string {
    const m = from.match(/<(.*?)>/);
    return m ? m[1] : from;
  }
}
