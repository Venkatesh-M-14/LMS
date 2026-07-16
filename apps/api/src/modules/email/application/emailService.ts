import type { Logger } from '../../../core/logging/logger';
import type { DomainEvents } from '../../../core/events/eventBus';
import { renderEmail } from '../domain/templates';
import type {
  EmailOutboxRepository,
  EmailQueuePort,
  EmailSender,
  EnqueueEmailInput,
} from './ports';

export interface EmailServiceDeps {
  repo: EmailOutboxRepository;
  queue: EmailQueuePort;
  sender: EmailSender;
  webOrigin: string;
  logger?: Logger;
}

/**
 * Transactional outbox: event subscribers write a PENDING row (never send
 * inline) and enqueue a drain job. `drain` is called by the BullMQ worker; it
 * renders + sends and flips the row to SENT (or FAILED after retries).
 */
export class EmailService {
  constructor(private readonly deps: EmailServiceDeps) {}

  // ── Event subscribers ───────────────────────────────────────────────────────

  onUserRegistered(event: DomainEvents['UserRegistered']): Promise<void> {
    return this.enqueue({
      userId: event.userId,
      toEmail: event.email,
      subject: 'Welcome to Frontend Engineering Academy',
      template: 'welcome',
      payload: { displayName: event.displayName },
    });
  }

  /**
   * A certificate is the milestone we email about: the achiever gets theirs,
   * and the circle is told — this is the only peer email, deliberately. Every
   * other peer success stays in-app so inboxes remain usable.
   */
  async onCertificateIssued(event: DomainEvents['CertificateIssued']): Promise<void> {
    const toEmail = await this.emailFor(event.userId);
    if (toEmail) {
      await this.enqueue({
        userId: event.userId,
        toEmail,
        subject: `Your certificate for "${event.scopeTitle}" is ready`,
        template: 'certificate-issued',
        payload: {
          scope: event.scope,
          scopeTitle: event.scopeTitle,
          verificationCode: event.verificationCode,
        },
      });
    }

    const [peers, actorName] = await Promise.all([
      this.deps.repo.listMilestoneRecipients(event.userId),
      this.deps.repo.getUserDisplayName(event.userId),
    ]);
    const who = actorName ?? 'A member';
    for (const peer of peers) {
      await this.enqueue({
        userId: peer.userId,
        toEmail: peer.email,
        subject: `${who} just completed ${event.scope === 'PATH' ? 'the learning path' : event.scopeTitle}`,
        template: 'peer-milestone',
        payload: { actorName: who, scope: event.scope, scopeTitle: event.scopeTitle },
      });
    }
  }

  async onProjectReviewed(event: DomainEvents['ProjectReviewed']): Promise<void> {
    const toEmail = await this.emailFor(event.userId);
    if (!toEmail) return;
    await this.enqueue({
      userId: event.userId,
      toEmail,
      subject:
        event.decision === 'APPROVED'
          ? `Your project "${event.briefTitle}" was approved`
          : `Feedback on your project "${event.briefTitle}"`,
      template: 'project-reviewed',
      payload: { briefTitle: event.briefTitle, decision: event.decision },
    });
  }

  // ── Outbox lifecycle ──────────────────────────────────────────────────────────

  private async enqueue(input: EnqueueEmailInput): Promise<void> {
    const { id } = await this.deps.repo.enqueue(input);
    try {
      await this.deps.queue.enqueue(id);
    } catch (err) {
      // The row stays PENDING; the boot-time sweep will re-enqueue it.
      this.deps.logger?.warn({ err, outboxId: id }, 'Email enqueue failed; left PENDING');
    }
  }

  private emailFor(userId: string): Promise<string | null> {
    return this.deps.repo.getUserEmail(userId);
  }

  /**
   * Drains one outbox row (called by the worker). Throws on send failure so
   * BullMQ retries with backoff; marks FAILED once attempts are exhausted.
   */
  async drain(outboxId: string, isFinalAttempt: boolean): Promise<void> {
    const row = await this.deps.repo.getById(outboxId);
    if (!row || row.status === 'SENT') return; // already handled

    if (!this.deps.sender.isEnabled()) {
      // No SMTP configured (dev/CI): mark SENT so the pipeline is exercised
      // end-to-end without a mail server.
      await this.deps.repo.markSent(outboxId);
      this.deps.logger?.debug({ outboxId, template: row.template }, 'Email skipped (no SMTP)');
      return;
    }

    const rendered = renderEmail(row.template, row.payload, this.deps.webOrigin);
    if (!rendered) {
      await this.deps.repo.markFailed(outboxId, `Unknown template: ${row.template}`);
      return;
    }

    await this.deps.repo.markSending(outboxId);
    try {
      await this.deps.sender.send({
        to: row.toEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
      await this.deps.repo.markSent(outboxId);
      this.deps.logger?.info({ outboxId, to: row.toEmail }, 'Email sent');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isFinalAttempt) await this.deps.repo.markFailed(outboxId, message);
      throw err; // let BullMQ apply backoff / count the attempt
    }
  }

  /** Re-enqueue rows stranded by a crash between DB write and job enqueue. */
  async resumePending(): Promise<number> {
    const ids = await this.deps.repo.findResumable(200);
    for (const id of ids) await this.deps.queue.enqueue(id);
    if (ids.length > 0) this.deps.logger?.info({ count: ids.length }, 'Resumed pending emails');
    return ids.length;
  }
}
