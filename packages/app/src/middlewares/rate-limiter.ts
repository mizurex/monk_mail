import { Request, Response, NextFunction } from 'express';
import { redisConnection } from '../config/redis';

export const rateLimiter = async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `rate_limit:${ip}`;
    const limit = 10;
    const windowSeconds = 60;

    try {
        const current = await redisConnection.incr(key);

        if (current === 1) {
            await redisConnection.expire(key, windowSeconds);
        }

        if (current > limit) {
            return res.status(429).json({
                error: 'Too many requests',
                message: 'limit exceeded. Please try again after a minute.'
            });
        }

        next();
    } catch (err) {
        console.error('Rate limiter failure:', err);
        next();
    }
};
