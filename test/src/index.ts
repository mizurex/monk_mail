// src/webhook-server.ts
import express from 'express';
import crypto from 'crypto';
import { Monkmail } from '../../packages/app/src';

const PORT = 80;
const GITHUB_WEBHOOK_SECRET = "1377743400"; // set this in GH webhook
const TELEGRAM_BOT_TOKEN = "8514650405:AAFzBuEQxw83GnvP3mmTnnKyCFjwmiObB0M";
const TELEGRAM_CHAT_ID = "1377743400";

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in env');
    process.exit(1);
}

const mailer = new Monkmail({ botToken: TELEGRAM_BOT_TOKEN, chatId: TELEGRAM_CHAT_ID });

// helper to verify signature header
function verifySignature(secret: string, payload: Buffer, signatureHeader?: string) {
    if (!signatureHeader) return false;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const digest = `sha256=${hmac.digest('hex')}`;
    // timing-safe compare
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signatureHeader));
}

// parse JSON but keep raw body for signature verification
const app = express();

// raw body for application/json
app.use(
    express.raw({
        type: 'application/json',
        limit: '1mb',
    })
);

app.post('/webhook', async (req, res) => {
    const raw = req.body as Buffer;
    const sig = req.headers['x-hub-signature-256'] as string | undefined;

    if (GITHUB_WEBHOOK_SECRET && !verifySignature(GITHUB_WEBHOOK_SECRET, raw, sig)) {
        res.status(401).send('invalid signature');
        return;
    }

    // parse once verified
    let payload: any;
    try {
        payload = JSON.parse(raw.toString('utf8'));
    } catch (err) {
        res.status(400).send('invalid json');
        return;
    }

    const event = req.headers['x-github-event'] as string | undefined;

    try {
        if (event === 'workflow_run') {
            await handleWorkflowRun(payload);
        } else if (event === 'pull_request') {
            await handlePullRequest(payload);
        } else if (event === 'issues') {
            await handleIssue(payload);
        } else if (event === 'push') {
            await handlePush(payload);
        } else {
            // ignore other events or log
            console.log('Unhandled event', event);
        }

        res.status(200).send('ok');
    } catch (err: any) {
        console.error('handler error', err);
        res.status(500).send('handler error');
    }
});

app.listen(PORT, () => {
    console.log(`Webhook server listening on ${PORT}`);
});

/* ---------------- Handlers & message templates ---------------- */

function mdEscape(text: string) {
    // Basic escape for MarkdownV2; escape characters Telegram treats specially.
    return text.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

async function handleWorkflowRun(payload: any) {
    // triggered when a GitHub Actions workflow run completes/changes
    const workflow = payload.workflow;
    const run = payload.workflow_run;
    const repo = payload.repository;
    const conclusion = run.conclusion; // success, failure, cancelled, etc.
    const htmlUrl = run.html_url;
    const branch = run.head_branch;
    const actor = run.actor?.login || run.triggering_actor?.login || payload.sender?.login;

    const title = `${repo.full_name} · Workflow ${workflow} · ${conclusion?.toUpperCase()}`;
    const message = `*${mdEscape(title)}*\n` +
        `Branch: \`${mdEscape(branch)}\`\n` +
        `By: ${mdEscape(String(actor))}\n` +
        `[View run](${htmlUrl})`;

    // send as MarkdownV2 to allow [text](url)
    await mailer.sendMail(message, 'MarkdownV2');
}

async function handlePullRequest(payload: any) {
    const action = payload.action; // opened, closed, reopened, etc.
    const pr = payload.pull_request;
    const repo = payload.repository;

    const title = `${repo.full_name} · PR ${pr.number} ${action}`;
    const prTitle = pr.title;
    const user = pr.user?.login;
    const url = pr.html_url;

    const message = `*${mdEscape(title)}*\n` +
        `#${pr.number}: ${mdEscape(prTitle)}\n` +
        `By: ${mdEscape(String(user))}\n` +
        `[View PR](${url})`;

    await mailer.sendMail(message, 'MarkdownV2');
}

async function handleIssue(payload: any) {
    const action = payload.action; // opened, closed, etc.
    const issue = payload.issue;
    const repo = payload.repository;

    const title = `${repo.full_name} · Issue ${issue.number} ${action}`;
    const issueTitle = issue.title;
    const user = issue.user?.login;
    const url = issue.html_url;

    const message = `*${mdEscape(title)}*\n` +
        `#${issue.number}: ${mdEscape(issueTitle)}\n` +
        `By: ${mdEscape(String(user))}\n` +
        `[View Issue](${url})`;

    await mailer.sendMail(message, 'MarkdownV2');
}

async function handlePush(payload: any) {
    const repo = payload.repository;
    const ref = payload.ref; // refs/heads/main
    const branch = ref.replace('refs/heads/', '');
    const pusher = payload.pusher?.name || payload.sender?.login;
    const commits: any[] = payload.commits || [];
    const commit = commits[commits.length - 1];
    const url = `${repo.html_url}/commit/${commit?.id}`;

    const message = `*${mdEscape(repo.full_name)}* · push to \`${mdEscape(branch)}\`\n` +
        `By: ${mdEscape(String(pusher))}\n` +
        `${mdEscape(commit?.message || '(no message)')}\n` +
        `[View commit](${url})`;

    await mailer.sendMail(message, 'MarkdownV2');
}
