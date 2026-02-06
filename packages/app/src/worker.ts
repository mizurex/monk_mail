import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { redisConnection } from './config/redis';
import { Monkmail } from './services/monkmail';

const worker = new Worker(
    'telegram-messages',
    async (job: Job) => {
        const { botToken, chatId, message } = job.data;
        const telegram = new Monkmail({ botToken, chatId });

        if (message) {
            await telegram.sendMail(message);
        }
    },
    {
        connection: redisConnection,
        concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'),
    }
);

worker.on('completed', (job: Job) => {
    console.log(`[Worker] Job ${job.id} - Delivery success`);
});

worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} - Delivery failed: ${err.message}`);
});

console.log('[Workers running]');
