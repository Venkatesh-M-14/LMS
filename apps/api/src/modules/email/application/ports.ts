export interface EnqueueEmailInput {
  userId: string | null;
  toEmail: string;
  subject: string;
  template: string;
  payload: Record<string, unknown>;
}

export interface OutboxRow {
  id: string;
  toEmail: string;
  subject: string;
  template: string;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'SENDING' | 'SENT' | 'FAILED';
  attempts: number;
}

export interface EmailOutboxRepository {
  /** Writes a PENDING intent row; returns its id. */
  enqueue(input: EnqueueEmailInput): Promise<{ id: string }>;
  getById(id: string): Promise<OutboxRow | null>;
  markSending(id: string): Promise<void>;
  markSent(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  /** Ids of rows stuck in PENDING/SENDING — recovers lost enqueues on boot. */
  findResumable(limit: number): Promise<string[]>;
  /** Recipient address for a user, or null if the account is gone. */
  getUserEmail(userId: string): Promise<string | null>;
}

/** The transport seam: real SMTP (nodemailer) or a null sender when unconfigured. */
export interface EmailSender {
  /** True when a real transport is configured. */
  isEnabled(): boolean;
  send(message: { to: string; subject: string; html: string; text: string }): Promise<void>;
}

/** Enqueues a drain job for an outbox row; BullMQ handles retry/backoff. */
export interface EmailQueuePort {
  enqueue(outboxId: string): Promise<void>;
}
