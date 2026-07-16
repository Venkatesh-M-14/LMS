import { EmailService } from '../emailService';
import type { EmailOutboxRepository, EmailQueuePort, EmailSender, EnqueueEmailInput, OutboxRow } from '../ports';

class FakeRepo implements EmailOutboxRepository {
  rows = new Map<string, OutboxRow & { lastError?: string }>();
  emails = new Map<string, string>([['u1', 'u1@example.com']]);
  names = new Map<string, string>([['u1', 'Sam']]);
  /** The circle that still wants milestone email. */
  milestonePeers: Array<{ userId: string; email: string }> = [];
  private seq = 0;

  async enqueue(input: EnqueueEmailInput): Promise<{ id: string }> {
    const id = `e-${this.seq++}`;
    this.rows.set(id, {
      id,
      toEmail: input.toEmail,
      subject: input.subject,
      template: input.template,
      payload: input.payload,
      status: 'PENDING',
      attempts: 0,
    });
    return { id };
  }
  async getById(id: string) {
    return this.rows.get(id) ?? null;
  }
  async markSending(id: string) {
    const r = this.rows.get(id)!;
    r.status = 'SENDING';
    r.attempts += 1;
  }
  async markSent(id: string) {
    this.rows.get(id)!.status = 'SENT';
  }
  async markFailed(id: string, error: string) {
    const r = this.rows.get(id)!;
    r.status = 'FAILED';
    r.lastError = error;
  }
  async findResumable() {
    return [...this.rows.values()].filter((r) => r.status !== 'SENT').map((r) => r.id);
  }
  async getUserEmail(userId: string) {
    return this.emails.get(userId) ?? null;
  }
  async getUserDisplayName(userId: string) {
    return this.names.get(userId) ?? null;
  }
  async listMilestoneRecipients(exceptUserId: string) {
    return this.milestonePeers.filter((p) => p.userId !== exceptUserId);
  }
}

class FakeQueue implements EmailQueuePort {
  enqueued: string[] = [];
  async enqueue(outboxId: string) {
    this.enqueued.push(outboxId);
  }
}

class FakeSender implements EmailSender {
  sent: Array<{ to: string; subject: string }> = [];
  constructor(private enabled: boolean, private failTimes = 0) {}
  isEnabled() {
    return this.enabled;
  }
  async send(m: { to: string; subject: string; html: string; text: string }) {
    if (this.failTimes > 0) {
      this.failTimes -= 1;
      throw new Error('smtp error');
    }
    this.sent.push({ to: m.to, subject: m.subject });
  }
}

function make(sender: FakeSender) {
  const repo = new FakeRepo();
  const queue = new FakeQueue();
  const service = new EmailService({ repo, queue, sender, webOrigin: 'http://web.test' });
  return { repo, queue, sender, service };
}

describe('EmailService outbox', () => {
  it('writes a PENDING row and enqueues a drain job on UserRegistered', async () => {
    const { repo, queue, service } = make(new FakeSender(true));
    await service.onUserRegistered({ userId: 'u1', email: 'u1@example.com', displayName: 'Sam' });

    expect([...repo.rows.values()][0]).toMatchObject({ template: 'welcome', status: 'PENDING' });
    expect(queue.enqueued).toHaveLength(1);
  });

  it('drains to SENT via the sender when SMTP is enabled', async () => {
    const { repo, queue, sender, service } = make(new FakeSender(true));
    await service.onUserRegistered({ userId: 'u1', email: 'u1@example.com', displayName: 'Sam' });
    const id = queue.enqueued[0]!;

    await service.drain(id, false);

    expect(sender.sent).toHaveLength(1);
    expect(repo.rows.get(id)!.status).toBe('SENT');
  });

  it('marks SENT without sending when SMTP is disabled', async () => {
    const { repo, queue, sender, service } = make(new FakeSender(false));
    await service.onUserRegistered({ userId: 'u1', email: 'u1@example.com', displayName: 'Sam' });
    const id = queue.enqueued[0]!;

    await service.drain(id, false);

    expect(sender.sent).toHaveLength(0);
    expect(repo.rows.get(id)!.status).toBe('SENT');
  });

  it('rethrows on send failure and only marks FAILED on the final attempt', async () => {
    const { repo, queue, service } = make(new FakeSender(true, 5));
    await service.onCertificateIssued({ userId: 'u1', certificateId: 'c', scope: 'MODULE', scopeTitle: 'M', verificationCode: 'v' });
    const id = queue.enqueued[0]!;

    await expect(service.drain(id, false)).rejects.toThrow('smtp error');
    expect(repo.rows.get(id)!.status).toBe('SENDING'); // not final → still retrying

    await expect(service.drain(id, true)).rejects.toThrow('smtp error');
    expect(repo.rows.get(id)!.status).toBe('FAILED'); // final attempt → FAILED
  });

  it('resumes stranded PENDING rows by re-enqueuing them', async () => {
    const { queue, service } = make(new FakeSender(true));
    await service.onUserRegistered({ userId: 'u1', email: 'u1@example.com', displayName: 'Sam' });
    queue.enqueued = []; // simulate a crash before the job was enqueued

    const resumed = await service.resumePending();

    expect(resumed).toBe(1);
    expect(queue.enqueued).toHaveLength(1);
  });
});
