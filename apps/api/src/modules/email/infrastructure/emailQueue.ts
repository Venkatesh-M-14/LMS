import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import type { Logger } from '../../../core/logging/logger';
import type { EmailService } from '../application/emailService';
import type { EmailQueuePort } from '../application/ports';

const QUEUE_NAME = 'email';
const MAX_ATTEMPTS = 4;

function createConnection(redisUrl: string): Redis {
  return new Redis(redisUrl, { maxRetriesPerRequest: null });
}

export class BullEmailQueue implements EmailQueuePort {
  private readonly queue: Queue;

  constructor(redisUrl: string) {
    this.queue = new Queue(QUEUE_NAME, {
      connection: createConnection(redisUrl),
      defaultJobOptions: {
        attempts: MAX_ATTEMPTS,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 },
      },
    });
  }

  async enqueue(outboxId: string): Promise<void> {
    // outboxId as jobId: a double-enqueue (e.g. boot sweep + inline) collapses.
    await this.queue.add('send', { outboxId }, { jobId: outboxId });
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}

export function startEmailWorker(
  redisUrl: string,
  emailService: EmailService,
  logger: Logger,
): Worker {
  const worker = new Worker<{ outboxId: string }>(
    QUEUE_NAME,
    async (job) => {
      const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? MAX_ATTEMPTS);
      await emailService.drain(job.data.outboxId, isFinalAttempt);
    },
    { connection: createConnection(redisUrl), concurrency: 4 },
  );
  worker.on('failed', (job, err) => {
    logger.warn({ err, outboxId: job?.data.outboxId }, 'Email job failed (will retry)');
  });
  return worker;
}
