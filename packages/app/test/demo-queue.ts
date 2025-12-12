import * as path from "path";
import { MessageQueue, QueueProcessor, SmtpPayload } from "../src";

const TEST_DIR = __dirname;

async function sendTwoEmails() {
  console.log("Sending 2 emails via queue...\n");

  const queue = new MessageQueue({
    persistPath: path.join(TEST_DIR, "data", "demo-queue.json"),
    maxAttempts: 3,
  });

  queue.clear();

  const processor = new QueueProcessor(queue, {
    onSent: (msg) => console.log(`Callback: Sent ${msg.id}`),
    onFailed: (msg, err) => console.log(`Callback: Failed - ${err}`),
  });

  const smtpBase = {
    host: "smtp.gmail.com",
    port: 465,
    username: "dhananjayadhal3@gmail.com",
    password: "mefatgodgcomlyty",
    from: "Viswas Dhal <dhananjayadhal3@gmail.com>",
  };

  // Email 1
  const email1: SmtpPayload = {
    ...smtpBase,
    to: "viswasdhal@gmail.com",
    subject: "Queue Email #1",
    body: "This is the FIRST email sent via message queue with retry support!",
  };
  const id1 = queue.add("smtp", email1);
  console.log(`Queued Email #1: ${id1}`);

  // Email 2
  const email2: SmtpPayload = {
    ...smtpBase,
    to: "viswasdhal@gmail.com",
    subject: "Queue Email #2",
    body: "This is the SECOND email sent via message queue with retry support!",
  };
  const id2 = queue.add("smtp", email2);
  console.log(`Queued Email #2: ${id2}`);

  // Show queue stats before processing
  console.log("\nQueue Stats (before processing):");
  const before = queue.getStats();
  console.log(`   Total: ${before.total} | Pending: ${before.pending} | Sent: ${before.sent}`);

  // Process the queue
  console.log("\nProcessing queue...\n");
  const result = await processor.processAll();

  // Show results
  console.log(`\nRESULT: ${result.sent} sent, ${result.failed} failed`);


  console.log("\nQueue Stats (after processing):");
  const after = queue.getStats();
  console.log(`   Total: ${after.total} | Pending: ${after.pending} | Sent: ${after.sent}`);


  console.log("\nAll Messages:");
  for (const msg of queue.getAll()) {
    console.log(`   ${msg.id} | ${msg.status} | ${msg.completedAt || "pending"}`);
  }
}

sendTwoEmails().catch(console.error);

