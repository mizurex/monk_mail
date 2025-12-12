import { SmtpClient } from "./smtp";
import { Monkmail } from "./monkmail";
import {
  MessageQueue,
  QueuedMessage,
  TelegramPayload,
  SmtpPayload,
} from "./queue";


export interface ProcessorConfig {
  intervalMs?: number;
  onSent?: (message: QueuedMessage) => void;
  onFailed?: (message: QueuedMessage, error: string) => void;
  onDead?: (message: QueuedMessage) => void;
}


export class QueueProcessor {
  private queue: MessageQueue;
  private config: ProcessorConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;

  constructor(queue: MessageQueue, config: ProcessorConfig = {}) {
    this.queue = queue;
    this.config = {
      intervalMs: config.intervalMs ?? 5000,
      onSent: config.onSent,
      onFailed: config.onFailed,
      onDead: config.onDead,
    };
  }

  /**
   * Start the background processor
   */
  start(): void {
    if (this.intervalId) return; // Already running

    console.log("[QueueProcessor] Starting...");
    this.intervalId = setInterval(() => {
      this.processCycle();
    }, this.config.intervalMs);

    // Also run immediately
    this.processCycle();
  }

  /**
   * Stop the background processor
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[QueueProcessor] Stopped");
    }
  }

  /**
   * Check if processor is running
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Process a single cycle (one message)
   */
  async processCycle(): Promise<void> {
    if (this.isProcessing) return; // Prevent concurrent processing

    const message = this.queue.getNextPending();
    if (!message) return;

    this.isProcessing = true;

    try {
      await this.processMessage(message);
    } catch (err) {
      console.error("[QueueProcessor] Unexpected error:", err);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process all pending messages (useful for manual flush)
   */
  async processAll(): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    while (true) {
      const message = this.queue.getNextPending();
      if (!message) break;

      const success = await this.processMessage(message);
      if (success) sent++;
      else failed++;
    }

    return { sent, failed };
  }

  /**
   * Process a single message
   */
  private async processMessage(message: QueuedMessage): Promise<boolean> {
    console.log(`[QueueProcessor] Processing ${message.id} (attempt ${message.attempts + 1}/${message.maxAttempts})`);

    this.queue.markProcessing(message.id);

    try {
      if (message.type === "telegram") {
        await this.sendTelegram(message.payload as TelegramPayload);
      } else if (message.type === "smtp") {
        await this.sendSmtp(message.payload as SmtpPayload);
      }

      // Success!
      this.queue.markSent(message.id);
      console.log(`[QueueProcessor] ✅ Sent ${message.id}`);

      if (this.config.onSent) {
        this.config.onSent(this.queue.get(message.id)!);
      }

      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.log(`[QueueProcessor] ❌ Failed ${message.id}: ${errorMsg}`);

      this.queue.markFailed(message.id, errorMsg);

      const updated = this.queue.get(message.id)!;

      if (updated.status === "dead") {
        console.log(`[QueueProcessor] 💀 Moved to dead letter: ${message.id}`);
        if (this.config.onDead) {
          this.config.onDead(updated);
        }
      } else {
        if (this.config.onFailed) {
          this.config.onFailed(updated, errorMsg);
        }
      }

      return false;
    }
  }

  /**
   * Send a Telegram message/photo/document using Monkmail class
   */
  private async sendTelegram(payload: TelegramPayload): Promise<void> {
    const telegram = new Monkmail({
      botToken: payload.botToken,
      chatId: payload.chatId,
    });

    // Send photo if present
    if (payload.photo) {
      const photoBuffer = Buffer.from(payload.photo.contentBase64, "base64");
      await telegram.sendPhoto(photoBuffer, payload.message, payload.photo.filename);
      return;
    }

    // Send document if present
    if (payload.document) {
      const docBuffer = Buffer.from(payload.document.contentBase64, "base64");
      await telegram.sendDocument(docBuffer, payload.message, payload.document.filename);
      return;
    }

    // Send text message
    if (payload.message) {
      await telegram.sendMail(payload.message);
    }
  }

  /**
   * Send an SMTP email using SmtpClient class (with attachment support)
   */
  private async sendSmtp(payload: SmtpPayload): Promise<void> {
    const smtp = new SmtpClient({
      host: payload.host,
      port: payload.port,
      username: payload.username,
      password: payload.password,
      from: payload.from,
    });

    // Convert base64 attachments back to Buffers
    const attachments = payload.attachments?.map((att) => ({
      filename: att.filename,
      content: Buffer.from(att.contentBase64, "base64"),
      mimeType: att.mimeType,
    }));

    await smtp.send({
      to: payload.to,
      subject: payload.subject,
      body: payload.body,
      attachments,
    });
  }
}
