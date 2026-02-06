import 'dotenv/config';
import express from 'express';
import webhookRouter from './routes/webhook';
import { rateLimiter } from './middlewares/rate-limiter';

const app = express();

app.use(express.json());

app.use(rateLimiter);

app.use('/webhook', webhookRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[RUNNING ON] ${PORT}`);
});
