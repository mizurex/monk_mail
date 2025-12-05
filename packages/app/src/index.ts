import * as https from 'https';
import * as tls from 'tls';

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

        return new Promise((resolve, reject) => {
            const req = https.request(
                {
                    hostname: 'api.telegram.org',
                    port: 443,
                    path: `/bot${botToken}/sendMessage`,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(payload),
                    },
                },
                (res) => {
                    let body = '';
                    res.on('data', (c) => (body += c));
                    res.on('end', () => {
                        if (res.statusCode === 200) resolve();
                        else reject(new Error(`Telegram error ${res.statusCode}: ${body}`));
                    });
                }
            );

            req.on('error', (err) => reject(err));
            req.write(payload);
            req.end();
        });
    }
}

/* ---------------- SMTP client ---------------- */

export interface SmtpConfig {
    host: string;
    port: number;
    username: string;
    password: string;
    from: string;
}

export class SmtpClient {
    private config: SmtpConfig;

    constructor(config: SmtpConfig) {
        this.config = config;
    }

    async sendEmail(to: string, subject: string, textBody: string): Promise<void> {
        const { host, port, username, password, from } = this.config;

        const emailData =
            `From: ${from}\r\n` +
            `To: <${to}>\r\n` +
            `Subject: ${subject}\r\n\r\n` +
            textBody;

        await new Promise<void>((resolve, reject) => {
            const socket = tls.connect(
                {
                    host,
                    port,
                    servername: host, // SNI, safer for Gmail
                },
                () => {
                    (async () => {
                        try {
                            // 220 greeting
                            let resp = await this.read(socket);
                            this.expectCode(resp, '220', 'greeting');

                            // EHLO
                            resp = await this.cmd(socket, `EHLO localhost\r\n`);
                            this.expectCode(resp, '250', 'EHLO');

                            // AUTH LOGIN
                            resp = await this.cmd(socket, `AUTH LOGIN\r\n`);
                            this.expectCode(resp, '334', 'AUTH LOGIN (username prompt)');

                            // username
                            resp = await this.cmd(
                                socket,
                                `${Buffer.from(username, 'utf8').toString('base64')}\r\n`
                            );
                            this.expectCode(resp, '334', 'AUTH LOGIN (password prompt)');

                            // password
                            resp = await this.cmd(
                                socket,
                                `${Buffer.from(password, 'utf8').toString('base64')}\r\n`
                            );
                            this.expectCode(resp, '235', 'AUTH success');

                            // MAIL FROM
                            resp = await this.cmd(
                                socket,
                                `MAIL FROM:<${this.extractAddress(from)}>\r\n`
                            );
                            this.expectCode(resp, '250', 'MAIL FROM');

                            // RCPT TO
                            resp = await this.cmd(socket, `RCPT TO:<${to}>\r\n`);
                            this.expectCode(resp, '250', 'RCPT TO');

                            // DATA
                            resp = await this.cmd(socket, `DATA\r\n`);
                            this.expectCode(resp, '354', 'DATA');

                            // message + terminator
                            resp = await this.cmd(socket, `${emailData}\r\n.\r\n`);
                            this.expectCode(resp, '250', 'end of DATA');

                            // QUIT (ignore code)
                            await this.cmd(socket, `QUIT\r\n`);

                            resolve();
                        } catch (e) {
                            reject(e);
                        } finally {
                            socket.end();
                        }
                    })();
                }
            );

            socket.on('error', (err) => reject(err));
        });
    }

    private read(socket: tls.TLSSocket): Promise<string> {
        return new Promise((resolve, reject) => {
            const onData = (d: Buffer) => {
                socket.removeListener('error', onError);
                resolve(d.toString());
            };
            const onError = (err: Error) => {
                socket.removeListener('data', onData);
                reject(err);
            };

            socket.once('data', onData);
            socket.once('error', onError);
        });
    }

    private async cmd(socket: tls.TLSSocket, str: string): Promise<string> {
        socket.write(str);
        const resp = await this.read(socket);
        // Uncomment this to debug SMTP conversation:
        // console.log('SMTP RESP:', resp.trim());
        return resp;
    }

    private expectCode(response: string, expected: string, step: string) {
        const code = response.slice(0, 3);
        if (code !== expected) {
            throw new Error(
                `SMTP error at ${step}: expected ${expected}, got ${code}. Full response:\n${response}`
            );
        }
    }

    private extractAddress(from: string): string {
        const m = from.match(/<(.*?)>/);
        return m ? m[1] : from;
    }
}

/* ---------------- GitHub Webhook (NO signature checking) ---------------- */

export interface GithubWebhookOptions {
    rawBody: Buffer;
    event?: string;
}

/**
 * monkHandler:
 */
export async function monkHandler(
    { rawBody, event }: GithubWebhookOptions,
    send: (text: string) => Promise<void>
): Promise<void> {
    if (!rawBody) throw new Error('rawBody required');

    let payload: any;
    try {
        payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
        throw new Error('Invalid JSON');
    }

    switch (event) {
        case 'workflow_run':
            return handleWorkflowRun(payload, send);
        case 'pull_request':
            return handlePullRequest(payload, send);
        case 'issues':
            return handleIssue(payload, send);
        case 'push':
            return handlePush(payload, send);
        default:
            return safeSend(send, buildGenericGithubMessage(event, payload));
    }
}

const ANIMALS = [
    // bunny
    String.raw`(\_/)
( •_•)
/ >💌`,
    // cat
    String.raw` /\_/\
( o.o )
 > ^ <`,
    // bear
    String.raw`ʕ•ᴥ•ʔ`,
    // duck
    String.raw`<(° )~`,
    // chill blob
    String.raw`(・_・;)`
];

function randomAnimal(): string {
    const idx = Math.floor(Math.random() * ANIMALS.length);
    return ANIMALS[idx];
}

const SEP = '────────────────────────';

function headerLine(label: string, repoName?: string) {
    return `┏ ${label}${repoName ? ` • ${repoName}` : ''}\n${SEP}`;
}

/* ---------------- GitHub handlers ---------------- */

async function handleWorkflowRun(payload: any, send: (t: string) => Promise<void>) {
    const run = payload.workflow_run;
    const repo = payload.repository;

    const workflowName = run?.name || payload.workflow?.name || 'workflow';
    const conclusion = run?.conclusion || 'unknown';
    const branch = run?.head_branch || run?.head_commit?.ref || 'unknown';
    const actor = run?.actor?.login || payload.sender?.login || 'unknown';
    const htmlUrl = run?.html_url || repo?.html_url || '';

    const art = randomAnimal();

    const msg =
        `${art}\n` +
        `${headerLine('Workflow', repo?.full_name)}\n` +
        `Name   : ${workflowName}\n` +
        `Status : ${conclusion}\n` +
        `Branch : ${branch}\n` +
        `By     : ${actor}\n` +
        (htmlUrl ? `View   : ${htmlUrl}\n` : '') +
        SEP;

    await safeSend(send, msg);
}

async function handlePullRequest(payload: any, send: (t: string) => Promise<void>) {
    const pr = payload.pull_request;
    const repo = payload.repository;
    if (!pr) return;

    const action = payload.action || 'updated';
    const title = pr.title || '(no title)';
    const number = pr.number;
    const author = pr.user?.login || 'unknown';
    const htmlUrl = pr.html_url || '';

    const art = randomAnimal();

    const msg =
        `${art}\n` +
        `${headerLine('Pull Request', repo?.full_name)}\n` +
        `Action : ${action}\n` +
        `#${number}: ${title}\n` +
        `By     : ${author}\n` +
        (htmlUrl ? `View   : ${htmlUrl}\n` : '') +
        SEP;

    await safeSend(send, msg);
}

async function handleIssue(payload: any, send: (t: string) => Promise<void>) {
    const issue = payload.issue;
    const repo = payload.repository;
    if (!issue) return;

    const action = payload.action || 'updated';
    const title = issue.title || '(no title)';
    const number = issue.number;
    const author = issue.user?.login || 'unknown';
    const htmlUrl = issue.html_url || '';

    const art = randomAnimal();

    const msg =
        `${art}\n` +
        `${headerLine('Issue', repo?.full_name)}\n` +
        `Action : ${action}\n` +
        `#${number}: ${title}\n` +
        `By     : ${author}\n` +
        (htmlUrl ? `View   : ${htmlUrl}\n` : '') +
        SEP;

    await safeSend(send, msg);
}

async function handlePush(payload: any, send: (t: string) => Promise<void>) {
    const repo = payload.repository;
    const ref = payload.ref || '';
    const branch = ref.replace('refs/heads/', '') || 'unknown';
    const pusher = payload.pusher?.name || payload.sender?.login || 'unknown';
    const commits: any[] = payload.commits || [];
    const last = commits[commits.length - 1] || {};
    const commitMsg = last.message || '(no message)';
    const commitId = last.id || '';
    const commitUrl =
        last.url ||
        (repo?.html_url && commitId ? `${repo.html_url}/commit/${commitId}` : '');

    const art = randomAnimal();

    const msg =
        `${art}\n` +
        `${headerLine('⬆️ Push', repo?.full_name)}\n` +
        `Branch : ${branch}\n` +
        `By     : ${pusher}\n` +
        `Latest : ${commitMsg}\n` +
        (commitUrl ? `View   : ${commitUrl}\n` : '') +
        SEP;

    await safeSend(send, msg);
}

/* ---------------- Fallback for all other GitHub events ---------------- */

function buildGenericGithubMessage(event: string | undefined, payload: any) {
    return `GitHub event: ${event}\nPayload:\n${JSON.stringify(payload, null, 2)}`;
}

async function safeSend(send: (t: string) => Promise<void>, text: string) {
    try {
        await send(text);
    } catch (err) {
        console.error('send failed', err);
    }
}

