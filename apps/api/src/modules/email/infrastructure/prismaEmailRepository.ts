import type { Prisma } from '@prisma/client';
import type { PrismaClient } from '../../../core/db/prisma';
import type { EmailOutboxRepository, EnqueueEmailInput, OutboxRow } from '../application/ports';

export class PrismaEmailRepository implements EmailOutboxRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async enqueue(input: EnqueueEmailInput): Promise<{ id: string }> {
    const row = await this.prisma.emailOutbox.create({
      data: {
        userId: input.userId,
        toEmail: input.toEmail,
        subject: input.subject,
        template: input.template,
        payload: input.payload as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    return { id: row.id };
  }

  async getById(id: string): Promise<OutboxRow | null> {
    const row = await this.prisma.emailOutbox.findUnique({ where: { id } });
    if (!row) return null;
    return {
      id: row.id,
      toEmail: row.toEmail,
      subject: row.subject,
      template: row.template,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      status: row.status,
      attempts: row.attempts,
    };
  }

  async markSending(id: string): Promise<void> {
    await this.prisma.emailOutbox.update({
      where: { id },
      data: { status: 'SENDING', attempts: { increment: 1 } },
    });
  }

  async markSent(id: string): Promise<void> {
    await this.prisma.emailOutbox.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date(), lastError: null },
    });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.prisma.emailOutbox.update({
      where: { id },
      data: { status: 'FAILED', lastError: error.slice(0, 500) },
    });
  }

  async findResumable(limit: number): Promise<string[]> {
    const rows = await this.prisma.emailOutbox.findMany({
      where: { status: { in: ['PENDING', 'SENDING'] } },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async getUserEmail(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return user?.email ?? null;
  }

  async getUserDisplayName(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });
    return user?.displayName ?? null;
  }

  async listMilestoneRecipients(
    exceptUserId: string,
  ): Promise<Array<{ userId: string; email: string }>> {
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE', id: { not: exceptUserId }, emailMilestones: true },
      select: { id: true, email: true },
    });
    return users.map((u) => ({ userId: u.id, email: u.email }));
  }
}
