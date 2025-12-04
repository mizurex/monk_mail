// src/webhook-server.ts
import * as https from 'https';
import express from 'express';
import crypto from 'crypto';

/* ---------------- Monkmail (Telegram sender) ---------------- */
export interface MonkmailConfig {
    botToken: string;
    chatId: string;
}

export class Monkmail {
    private config: MonkmailConfig;

    constructor(config: MonkmailConfig) {
        this.config = config;
        if (!this.config.botToken || !this.config.chatId) {
            throw new Error('Monkmail requires botToken and chatId');
        }
    }

    sendMail(message: string): Promise<void> {
        const { botToken, chatId } = this.config;

        const payload = JSON.stringify({
            chat_id: chatId,
            text: message,
        });

        const requestOptions: https.RequestOptions = {
            hostname: 'api.telegram.org',
            port: 443,
            path: `/bot${botToken}/sendMessage`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
            },
        };

        return new Promise((resolve, reject) => {
            const req = https.request(requestOptions, (res) => {
                let body = '';
                res.on('data', (chunk) => (body += chunk));
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve();
                    } else {
                        reject(new Error(`Telegram error ${res.statusCode}: ${body}`));
                    }
                });
            });

            req.on('error', (err) => reject(new Error(`Network error: ${err.message}`)));
            req.write(payload);
            req.end();
        });
    }
}

/* ---------------- Webhook server ---------------- */

const PORT = Number(process.env.PORT || 80); // set PORT env if you don't want to run on 80
const GITHUB_WEBHOOK_SECRET = "1377743400"; // leave empty to skip verification
const TELEGRAM_BOT_TOKEN = "8514650405:AAFzBuEQxw83GnvP3mmTnnKyCFjwmiObB0M"; // or fill directly below
const TELEGRAM_CHAT_ID = "1377743400";

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('Please set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (env or edit file).');
    process.exit(1);
}

const mailer = new Monkmail({ botToken: TELEGRAM_BOT_TOKEN, chatId: TELEGRAM_CHAT_ID });

// helper to verify signature header (X-Hub-Signature-256)
function verifySignature(secret: string, payload: Buffer, signatureHeader?: string) {
    if (!secret) return true; // if no secret configured, skip verification (convenience for dev)
    if (!signatureHeader) return false;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const digest = `sha256=${hmac.digest('hex')}`;
    try {
        return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signatureHeader));
    } catch {
        return false;
    }
}

const app = express();

// get raw body so signature verification works
app.use(
    express.raw({
        type: 'application/json',
        limit: '2mb',
    })
);

app.post('/webhook', async (req: any, res: any) => {
    const raw = req.body as Buffer;
    const sig = req.headers['x-hub-signature-256'] as string | undefined;

    if (!verifySignature(GITHUB_WEBHOOK_SECRET, raw, sig)) {
        console.warn('Invalid signature for incoming webhook');
        res.status(401).send('invalid signature');
        return;
    }

    let payload: any;
    try {
        payload = JSON.parse(raw.toString('utf8'));
    } catch (err) {
        console.error('Failed to parse JSON', err);
        res.status(400).send('invalid json');
        return;
    }

    const event = req.headers['x-github-event'] as string | undefined;
    console.log('Received GitHub event', event);

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
            console.log('Unhandled event:', event);
        }

        res.status(200).send('ok');
    } catch (err: any) {
        console.error('Handler error:', err);
        res.status(500).send('handler error');
    }
});

app.listen(PORT, () => {
    console.log(`Webhook server listening on ${PORT}`);
});

/* ---------------- Handlers (plain text messages) ---------------- */

async function handleWorkflowRun(payload: any) {
    const run = payload.workflow_run;
    const repo = payload.repository;
    const workflowName = payload.workflow || run.name || 'workflow';
    const conclusion = run.conclusion || 'unknown';
    const htmlUrl = run.html_url || run.html_url || '';
    const branch = run.head_branch || run.head_commit?.ref || 'unknown';
    const actor = run.actor?.login || payload.sender?.login || 'unknown';

    const message =
        `${repo.full_name} - Workflow "${workflowName}" finished with status: ${conclusion}\n` +
        `Branch: ${branch}\n` +
        `By: ${actor}\n` +
        `View: ${htmlUrl}`;

    console.log('workflow_run ->', message);
    await safeSend(message);
}

async function handlePullRequest(payload: any) {
    const action = payload.action || 'unknown';
    const pr = payload.pull_request;
    const repo = payload.repository;
    if (!pr) {
        console.warn('pull_request event missing pull_request payload');
        return;
    }

    const message =
        `${repo.full_name} - Pull request ${action}: #${pr.number} ${pr.title}\n` +
        `By: ${pr.user?.login || 'unknown'}\n` +
        `View: ${pr.html_url}`;

    console.log('pull_request ->', message);
    await safeSend(message);
}

async function handleIssue(payload: any) {
    const action = payload.action || 'unknown';
    const issue = payload.issue;
    const repo = payload.repository;
    if (!issue) {
        console.warn('issues event missing issue payload');
        return;
    }

    const message =
        `${repo.full_name} - Issue ${action}: #${issue.number} ${issue.title}\n` +
        `By: ${issue.user?.login || 'unknown'}\n` +
        `View: ${issue.html_url}`;

    console.log('issues ->', message);
    await safeSend(message);
}

async function handlePush(payload: any) {
    const repo = payload.repository;
    const ref = payload.ref || '';
    const branch = ref.replace('refs/heads/', '') || 'unknown';
    const pusher = payload.pusher?.name || payload.sender?.login || 'unknown';
    const commits: any[] = payload.commits || [];
    const last = commits[commits.length - 1] || {};
    const commitMsg = last.message || '(no message)';
    const commitUrl = last.url || `${repo.html_url}/commit/${last.id || ''}`;

    const message =
        `${repo.full_name} - Push to ${branch}\n` +
        `By: ${pusher}\n` +
        `Latest: ${commitMsg}\n` +
        `View: ${commitUrl}`;

    console.log('push ->', message);
    await safeSend(message);
}

/* ---------------- Helpers ---------------- */

async function safeSend(text: string) {
    try {
        await mailer.sendMail(text);
    } catch (err) {
        // log but don't crash server
        console.error('Failed to send Telegram message:', err);
    }
}
