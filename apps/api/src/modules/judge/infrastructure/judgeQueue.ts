import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import type { Logger } from '../../../core/logging/logger';
import type { JudgeQueuePort } from '../../assessments/application/ports';
import type { JudgeService } from '../../assessments/application/judgeService';

const QUEUE_NAME = 'judge';

/** BullMQ requires its own connection with maxRetriesPerRequest disabled. */
function createConnection(redisUrl: string): Redis {
  return new Redis(redisUrl, { maxRetriesPerRequest: null });
}

export class BullJudgeQueue implements JudgeQueuePort {
  private readonly queue: Queue;

  constructor(redisUrl: string) {
    this.queue = new Queue(QUEUE_NAME, {
      connection: createConnection(redisUrl),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 500 },
      },
    });
  }

  async enqueue(runId: string): Promise<void> {
    // runId as job id: accidental double-enqueue collapses into one job.
    await this.queue.add('run', { runId }, { jobId: runId });
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}

export function startJudgeWorker(
  redisUrl: string,
  judgeService: JudgeService,
  concurrency: number,
  logger: Logger,
): Worker {
  const worker = new Worker<{ runId: string }>(
    QUEUE_NAME,
    async (job) => {
      await judgeService.processRun(job.data.runId);
    },
    { connection: createConnection(redisUrl), concurrency },
  );
  worker.on('failed', (job, err) => {
    logger.error({ err, runId: job?.data.runId }, 'Judge job failed');
  });
  return worker;
}
