import { Router } from 'express';
import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';
import { formatGithubEvent } from '../services/monkmail';

const router = Router();

const messageQueue = new Queue('telegram-messages', {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: { age: 86400 }
    },
});

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

router.post('/', async (req, res) => {
    if (!BOT_TOKEN || !CHAT_ID) {
        return res.status(500).json({ error: 'System configuration missing' });
    }

    const event = req.headers['x-github-event'] as string;
    const payload = req.body;

    if (!event) {
        return res.status(400).json({ error: 'X-GitHub-Event header missing' });
    }

    try {
        const message = formatGithubEvent(event, payload);

        await messageQueue.add('send-telegram', {
            botToken: BOT_TOKEN,
            chatId: CHAT_ID,
            message: message
        });

        res.status(200).json({ status: 'ok', message: 'Queued' });
    } catch (err) {
        console.error('Webhook processing error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
