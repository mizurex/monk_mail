import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export interface QueuedAttachment {
  filename: string;
  contentBase64: string;
  mimeType?: string;
}


export interface TelegramPayload {
  botToken: string;
  chatId: string;
  message?: string;

  photo?: QueuedAttachment;
  document?: QueuedAttachment;
}

/**
 * SMTP email payload 
 */
export interface SmtpPayload {
  host: string;
  port: number;
  username: string;
  password: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  attachments?: QueuedAttachment[];
}

export type MessagePayload = TelegramPayload | SmtpPayload;

export type MessageStatus = "pending" | "processing" | "sent" | "failed" | "dead";

export interface QueuedMessage {
  id: string;
  type: "telegram" | "smtp";
  payload: MessagePayload;
  status: MessageStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  completedAt?: string;
  error?: string;
}

export interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  dead: number;
}

export interface QueueConfig {
  persistPath?: string;
  maxAttempts?: number;
  baseRetryDelayMs?: number;
}


export class MessageQueue {
  private messages: Map<string, QueuedMessage> = new Map();
  private persistPath: string;
  private maxAttempts: number;
  private baseRetryDelayMs: number;

  constructor(config: QueueConfig = {}) {
    this.persistPath = config.persistPath || path.join(process.cwd(), "monkmail-queue.json");
    this.maxAttempts = config.maxAttempts || 3;
    this.baseRetryDelayMs = config.baseRetryDelayMs || 1000;

    // Load existing queue from disk
    this.load();
  }

  add(type: "telegram" | "smtp", payload: MessagePayload, maxAttempts?: number): string {
    const id = this.generateId();
    const message: QueuedMessage = {
      id,
      type,
      payload,
      status: "pending",
      attempts: 0,
      maxAttempts: maxAttempts ?? this.maxAttempts,
      createdAt: new Date().toISOString(),
    };

    this.messages.set(id, message);
    this.persist();
    return id;
  }

  get(id: string): QueuedMessage | undefined {
    return this.messages.get(id);
  }

  
  getAll(status?: MessageStatus): QueuedMessage[] {
    const all = Array.from(this.messages.values());
    if (status) {
      return all.filter((m) => m.status === status);
    }
    return all;
  }
  getNextPending(): QueuedMessage | undefined {
    const now = new Date().toISOString();
    return Array.from(this.messages.values()).find(
      (m) => m.status === "pending" && (!m.nextRetryAt || m.nextRetryAt <= now)
    );
  }

  update(id: string, updates: Partial<QueuedMessage>): boolean {
    const message = this.messages.get(id);
    if (!message) return false;

    Object.assign(message, updates);
    this.messages.set(id, message);
    this.persist();
    return true;
  }


  markProcessing(id: string): boolean {
    return this.update(id, {
      status: "processing",
      lastAttemptAt: new Date().toISOString(),
    });
  }

  markSent(id: string): boolean {
    return this.update(id, {
      status: "sent",
      completedAt: new Date().toISOString(),
      error: undefined,
    });
  }

  
  markFailed(id: string, error: string): boolean {
    const message = this.messages.get(id);
    if (!message) return false;

    const newAttempts = message.attempts + 1;

    if (newAttempts >= message.maxAttempts) {
      // Move to dead letter queue
      return this.update(id, {
        status: "dead",
        attempts: newAttempts,
        error,
        completedAt: new Date().toISOString(),
      });
    }

    // Schedule retry with exponential backoff
    const delayMs = this.calculateBackoff(newAttempts);
    const nextRetryAt = new Date(Date.now() + delayMs).toISOString();

    return this.update(id, {
      status: "pending",
      attempts: newAttempts,
      error,
      nextRetryAt,
    });
  }

 
  retry(id: string): boolean {
    const message = this.messages.get(id);
    if (!message || message.status !== "dead") return false;

    return this.update(id, {
      status: "pending",
      attempts: 0,
      error: undefined,
      nextRetryAt: undefined,
      completedAt: undefined,
    });
  }

  remove(id: string): boolean {
    const deleted = this.messages.delete(id);
    if (deleted) this.persist();
    return deleted;
  }

  clear(status?: MessageStatus): number {
    let count = 0;
    if (status) {
      for (const [id, msg] of this.messages) {
        if (msg.status === status) {
          this.messages.delete(id);
          count++;
        }
      }
    } else {
      count = this.messages.size;
      this.messages.clear();
    }
    this.persist();
    return count;
  }

  getStatus(id: string): MessageStatus | undefined {
    return this.messages.get(id)?.status;
  }


  getStats(): QueueStats {
    const stats: QueueStats = {
      total: 0,
      pending: 0,
      processing: 0,
      sent: 0,
      failed: 0,
      dead: 0,
    };

    for (const msg of this.messages.values()) {
      stats.total++;
      stats[msg.status]++;
    }

    return stats;
  }

  /**
   * Get all dead letter messages
   */
  getDead(): QueuedMessage[] {
    return this.getAll("dead");
  }

 
  hasPending(): boolean {
    return Array.from(this.messages.values()).some(
      (m) => m.status === "pending" || m.status === "processing"
    );
  }

  private persist(): void {
    try {
      const data = JSON.stringify(Array.from(this.messages.entries()), null, 2);
      fs.writeFileSync(this.persistPath, data, "utf8");
    } catch (err) {
      console.error("[MessageQueue] Failed to persist queue:", err);
    }
  }

  /**
   * Load queue from disk
   */
  private load(): void {
    try {
      if (fs.existsSync(this.persistPath)) {
        const data = fs.readFileSync(this.persistPath, "utf8");
        const entries: [string, QueuedMessage][] = JSON.parse(data);
        this.messages = new Map(entries);

        // Reset any "processing" messages to "pending" (in case of crash)
        for (const [id, msg] of this.messages) {
          if (msg.status === "processing") {
            msg.status = "pending";
            this.messages.set(id, msg);
          }
        }
      }
    } catch (err) {
      console.error("[MessageQueue] Failed to load queue:", err);
      this.messages = new Map();
    }
  }

 
  private generateId(): string {
    return `msg_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  }

  
  private calculateBackoff(attempt: number): number {
    return this.baseRetryDelayMs * Math.pow(2, attempt - 1);
  }
}
