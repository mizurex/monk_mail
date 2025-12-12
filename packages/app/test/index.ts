import * as path from "path";
import {
  SmtpClient,
  SmtpConfig,
  Monkmail,
  MonkmailConfig,
  monkHandler,
  logFailedEmail,
  readTodayLogs,
  MessageQueue,
  QueueProcessor,
  TelegramPayload,
  SmtpPayload,
} from "../src";

const TEST_DIR = __dirname;


const SMTP_CONFIG: SmtpConfig = {
  host: "smtp.gmail.com",
  port: 465,
  username: "dhananjayadhal3@gmail.com",
  password: "mefatgodgcomlyty",
  from: "Viswas Dhal <dhananjayadhal3@gmail.com>",
};

const TELEGRAM_CONFIG: MonkmailConfig = {
  botToken: "8514650405:AAFzBuEQxw83GnvP3mmTnnKyCFjwmiObB0M",
  chatId: "1377743400",
};


async function testSmtp() {
  console.log("\nTesting SmtpClient...\n");

  const smtp = new SmtpClient(SMTP_CONFIG);

  try {
    await smtp.sendEmail(
      "viswasdhal@gmail.com",
      "Test Email from Monkmail",
          "Hello! This is a test email sent via SmtpClient."
    );
    console.log("Email sent successfully!");
  } catch (err) {
    console.error("Failed to send email:", err);
  }
}


async function testTelegram() {
  console.log("\nTesting Monkmail (Telegram)...\n");

  try {
    const monkmail = new Monkmail(TELEGRAM_CONFIG);
    await monkmail.sendMail("Test message from Monkmail!");
    console.log("Telegram message sent successfully!");
  } catch (err) {
    console.error("Failed to send Telegram message:", err);
  }
}


async function testGithubHandlers() {
  console.log("\nTesting GitHub Webhook Handlers...\n");

  const mockSend = async (text: string) => {
    console.log("─── Message Output ───");
    console.log(text);
    console.log("──────────────────────\n");
  };

  console.log("Testing workflow_run event:");
  await monkHandler(
    {
      rawBody: Buffer.from(JSON.stringify({
        workflow_run: {
          name: "CI Build",
          conclusion: "success",
          head_branch: "main",
          actor: { login: "octocat" },
          html_url: "https://github.com/example/repo/actions/runs/123",
        },
        repository: { full_name: "example/repo" },
      })),
      event: "workflow_run"
    },
    mockSend
  );

  console.log("Testing push event:");
  await monkHandler(
    {
      rawBody: Buffer.from(JSON.stringify({
        ref: "refs/heads/main",
        pusher: { name: "developer" },
        commits: [{ id: "abc123", message: "Fix bug", url: "https://github.com/example/repo/commit/abc123" }],
        repository: { full_name: "example/repo", html_url: "https://github.com/example/repo" },
      })),
      event: "push"
    },
    mockSend
  );
}


async function testLogger() {
  console.log("\nTesting Logger Utils...\n");

  logFailedEmail({ id: "test-123", email: "test@example.com", reason: "Test failure" });
  console.log("Logged a test entry");

  await new Promise((r) => setTimeout(r, 100));

  const logs = readTodayLogs();
  if (logs) {
    console.log("Today's logs:");
    console.log(logs);
  }
}


async function testQueue() {
  console.log("\nTesting Message Queue...\n");

  const queue = new MessageQueue({
    persistPath: path.join(TEST_DIR, "data", "test-queue.json"),
    maxAttempts: 3,
  });

  queue.clear();

  // Add messages
  const telegramId = queue.add("telegram", {
    botToken: "test-token",
    chatId: "test-chat",
    message: "Hello from queue!",
  });
  console.log(`Added Telegram message: ${telegramId}`);

  // Check stats
  const stats = queue.getStats();
  console.log(`\nQueue Stats: Total=${stats.total}, Pending=${stats.pending}`);

  // Test retry logic
  console.log("\n Testing retry logic...");
  queue.markFailed(telegramId, "Error 1");
  queue.markFailed(telegramId, "Error 2");
  queue.markFailed(telegramId, "Error 3");
  console.log(`   Status after 3 failures: ${queue.getStatus(telegramId)}`);

  // Check dead letter
  const dead = queue.getDead();
  console.log(`Dead letter queue: ${dead.length} messages`);
}


async function main() {
  console.log("Monkmail Test Suite");

  // await testSmtp();
  // await testTelegram();
  await testGithubHandlers();
  await testLogger();
  await testQueue();

  console.log("\nTests complete!");
}

main().catch(console.error);

