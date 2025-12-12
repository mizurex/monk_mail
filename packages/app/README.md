# monkmail

Zero-dependency notification library for Node.js

## Features

- **Telegram Notifications** - Send messages via Telegram Bot API
- **SMTP Client** - Send emails with TLS support (Gmail)
- **Zero Dependencies** - Uses only Node.js built-in modules
- **TypeScript Support** - Full type definitions included

## Installation

```bash
npm install monkmail
```

## Quick Start

### Telegram Notifications

Send messages to Telegram using a bot token and chat ID:

```typescript
import { Monkmail } from 'monkmail';

const telegram = new Monkmail({
  botToken: 'YOUR_BOT_TOKEN',
  chatId: 'YOUR_CHAT_ID'
});

await telegram.sendMail('Hello from monkmail!');
```

**Getting your credentials:**
1. Create a bot via [@BotFather](https://t.me/botfather) to get your `botToken`
2. Get your `User ID` by messaging [@userinfobot](https://t.me/userinfobot)

### SMTP Email

Send emails via SMTP with TLS (works with Gmail) [ others not tested ]:

```typescript
import { SmtpClient } from 'monkmail';

const smtp = new SmtpClient({
  host: 'smtp.gmail.com',
  port: 465,
  username: 'your-email@gmail.com',
  password: 'your-app-password',
  from: 'Your Name <your-email@gmail.com>'
});

await smtp.sendEmail(
  'recipient@example.com',
  'Test Subject',
  'This is the email body!'
);
```

**Gmail users:** Use an [App Password](https://support.google.com/accounts/answer/185833) instead of your regular password.

### GitHub Webhook Handler

Process GitHub webhook events with beautifully formatted messages:

```typescript
import { monkHandler, Monkmail } from 'monkmail';
import express from 'express';

const app = express();
const telegram = new Monkmail({ botToken: '...', chatId: '...' });

app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const event = req.headers['x-github-event'] as string;
  
  await monkHandler(
    { rawBody: req.body, event },
    (text) => telegram.sendMail(text)
  );
  
  res.sendStatus(200);
});

app.listen(3000);
```

**GitHub Events:**
- `push` - Code pushes
- `pull_request` - PR opened, closed, merged, etc.
- `issues` - Issue created, closed, etc.
- `workflow_run` - GitHub Actions workflow results
- All other events 

**Example formatted message:**
```
(\_/)
( •_•)
/ >💌
┏ Pull Request • user/repo
────────────────────────
Action : opened
#42: Add new feature
By     : username
View   : https://github.com/user/repo/pull/42
────────────────────────
```

## API Reference

### `Monkmail`

**Constructor:**
```typescript
new Monkmail(config: MonkmailConfig)
```

**Config:**
- `botToken: string` - Telegram bot token from @BotFather
- `chatId: string` - Telegram chat ID

**Methods:**
- `sendMail(message: string): Promise<void>` - Send a message to Telegram

---

### `SmtpClient`

**Constructor:**
```typescript
new SmtpClient(config: SmtpConfig)
```

**Methods:**
- `sendEmail(to: string, subject: string, textBody: string): Promise<void>` - Send an email

---

### `monkHandler`

**Function:**
```typescript
monkHandler(
  options: GithubWebhookOptions,
  send: (text: string) => Promise<void>
): Promise<void>
```

**Options:**
- `rawBody: Buffer` - Raw request body from GitHub webhook
- `event?: string` - GitHub event type (from `X-GitHub-Event` header)

**Send Function:**
- A callback that receives formatted text and sends it (e.g., via Telegram or email)

## Example: Complete Notification System

```typescript
import { Monkmail, SmtpClient, monkHandler } from 'monkmail';
import express from 'express';

// Setup notification channels
const telegram = new Monkmail({
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
  chatId: process.env.TELEGRAM_CHAT_ID!
});

const smtp = new SmtpClient({
  host: 'smtp.gmail.com',
  port: 465,
  username: process.env.SMTP_USER!,
  password: process.env.SMTP_PASS!,
  from: process.env.SMTP_FROM!
});

// Notification function that sends to both channels
async function notify(message: string) {
  await Promise.all([
    telegram.sendMail(message),
    smtp.sendEmail(
      process.env.ALERT_EMAIL!,
      'GitHub Notification',
      message
    )
  ]);
}

// Setup webhook endpoint
const app = express();

app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const event = req.headers['x-github-event'] as string;
    await monkHandler({ rawBody: req.body, event }, notify);
    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(500);
  }
});

app.listen(3000, () => {
  console.log('Webhook server running on port 3000');
});
```

## Security Notes

- **Never commit credentials** - Use environment variables
- **GitHub Webhooks** - This library does NOT verify webhook signatures. Add your own verification if needed.
- **SMTP Passwords** - Use app-specific passwords


