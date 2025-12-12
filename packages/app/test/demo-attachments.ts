import * as fs from "fs";
import * as path from "path";
import { SmtpClient, Monkmail } from "../src";

const SMTP_CONFIG = {
  host: "smtp.gmail.com",
  port: 465,
  username: process.env.SMTP_USERNAME!,
  password: process.env.SMTP_PASSWORD!,
  from: "monkmail <dhananjayadhal3@gmail.com>",
};

const TELEGRAM_CONFIG = {
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
  chatId: process.env.TELEGRAM_CHAT_ID!,
};

const TEST_DIR = __dirname;

// Helper to get file path
const getFile = (name: string) => path.join(TEST_DIR, name);


async function testEmailWithAttachment() {
  console.log("\nSending email with attachment...");
  
  const smtp = new SmtpClient(SMTP_CONFIG);
  
  await smtp.send({
    to: process.env.SMTP_TO!,
    subject: "Monkmail Test - Attachment",
    body: "This email has an attachment.",
    attachments: [
      {
        filename: "image.png",
        content: fs.readFileSync(getFile("sample-image.png")),
      },
    ],
  });
  
  console.log("Email sent!");
}

async function testEmailWithMultipleAttachments() {
  console.log("\nSending email with multiple attachments...");
  
  const smtp = new SmtpClient(SMTP_CONFIG);
  
  await smtp.send({
    to: process.env.SMTP_TO!,
    subject: "Monkmail Test - Multiple Attachments",
    body: "This email has multiple attachments.",
    attachments: [
      {
        filename: "document.txt",
        content: fs.readFileSync(getFile("sample-document.txt")),
      },
      {
        filename: "image.png",
        content: fs.readFileSync(getFile("sample-image.png")),
      },
    ],
  });
  
  console.log("Email sent!");
}

async function testTelegramPhoto() {
  console.log("\nSending Telegram photo...");
  
  const telegram = new Monkmail(TELEGRAM_CONFIG);
  
  await telegram.sendPhoto(
    fs.readFileSync(getFile("sample-image.png")),
    "Photo sent via Monkmail",
    "photo.png"
  );
  
  console.log("Telegram photo sent!");
}

async function testTelegramDocument() {
  console.log("\nSending Telegram document...");
  
  const telegram = new Monkmail(TELEGRAM_CONFIG);
  
  await telegram.sendDocument(
    fs.readFileSync(getFile("sample-document.txt")),
    "Document sent via Monkmail",
    "document.txt"
  );
  
  console.log("Telegram document sent!");
}

async function main() {
  console.log("Monkmail Attachment Demo");
  console.log("========================\n");
  
  // Uncomment what you want to test:
  
  // await testEmailWithAttachment();
  // await testEmailWithMultipleAttachments();
  await testTelegramPhoto();
  await testTelegramDocument();
  
  console.log("\nDone!");
}

main().catch(console.error);
