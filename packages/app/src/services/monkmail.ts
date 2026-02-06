import * as https from "https";
import * as fs from "fs";
import * as path from "path";

export interface MonkmailConfig {
    botToken: string;
    chatId: string;
}

export class Monkmail {
    private config: MonkmailConfig;

    constructor(config: MonkmailConfig) {
        this.config = config;
        if (!this.config.botToken || !this.config.chatId) {
            throw new Error("botToken and chatId are required");
        }
    }

    async sendMail(message: string): Promise<void> {
        const payload = JSON.stringify({ chat_id: this.config.chatId, text: message });
        await this.request(`/bot${this.config.botToken}/sendMessage`, payload);
    }

    async sendPhoto(photo: Buffer | string, caption?: string, filename?: string): Promise<void> {
        const photoBuffer = Buffer.isBuffer(photo) ? photo : fs.readFileSync(photo);
        const photoFilename = filename || (typeof photo === "string" ? path.basename(photo) : "photo.jpg");
        await this.sendMultipart(`/bot${this.config.botToken}/sendPhoto`, "photo", photoBuffer, photoFilename, caption);
    }

    async sendDocument(document: Buffer | string, caption?: string, filename?: string): Promise<void> {
        const docBuffer = Buffer.isBuffer(document) ? document : fs.readFileSync(document);
        const docFilename = filename || (typeof document === "string" ? path.basename(document) : "document");
        await this.sendMultipart(`/bot${this.config.botToken}/sendDocument`, "document", docBuffer, docFilename, caption);
    }

    private async request(apiPath: string, payload: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const req = https.request({
                hostname: "api.telegram.org",
                port: 443,
                path: apiPath,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(payload),
                },
            }, (res) => {
                let body = "";
                res.on("data", (c) => (body += c));
                res.on("end", () => {
                    if (res.statusCode === 200) resolve();
                    else reject(new Error(`Telegram error ${res.statusCode}: ${body}`));
                });
            });
            req.on("error", reject);
            req.write(payload);
            req.end();
        });
    }

    private async sendMultipart(apiPath: string, type: string, buffer: Buffer, filename: string, caption?: string): Promise<void> {
        const boundary = `----FormBoundary${Date.now()}`;
        const parts: Buffer[] = [];
        parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${this.config.chatId}\r\n`));
        if (caption) parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n`));
        parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${type}"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`));
        parts.push(buffer);
        parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

        const body = Buffer.concat(parts);
        return new Promise((resolve, reject) => {
            const req = https.request({
                hostname: "api.telegram.org",
                port: 443,
                path: apiPath,
                method: "POST",
                headers: {
                    "Content-Type": `multipart/form-data; boundary=${boundary}`,
                    "Content-Length": body.length,
                },
            }, (res) => {
                let responseBody = "";
                res.on("data", (c) => (responseBody += c));
                res.on("end", () => {
                    if (res.statusCode === 200) resolve();
                    else reject(new Error(`Telegram error ${res.statusCode}: ${responseBody}`));
                });
            });
            req.on("error", reject);
            req.write(body);
            req.end();
        });
    }
}

export function formatGithubEvent(event: string, payload: any): string {
    const repo = payload.repository?.full_name || "unknown repo";
    switch (event) {
        case "push":
            return `Push to ${payload.ref?.replace("refs/heads/", "")} in ${repo}\nLatest: ${payload.commits?.[0]?.message || "No message"}`;
        case "pull_request":
            return `PR ${payload.action} in ${repo}\nTitle: ${payload.pull_request?.title}`;
        case "issues":
            return `Issue ${payload.action} in ${repo}\n#${payload.issue?.number}: ${payload.issue?.title}`;
        default:
            return `Event: ${event} in ${repo}`;
    }
}
