import type { Notification } from '@prisma/client';
import type { NotificationPreferences, NotificationView } from '@academy/shared';
import type { PrismaClient } from '../../../core/db/prisma';
import type {
  CreateNotificationInput,
  NotificationRepository,
  PeerPreference,
} from '../application/ports';

function toView(row: Notification): NotificationView {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    linkUrl: row.linkUrl,
    read: row.readAt !== null,
    createdAt: row.createdAt.toISOString(),
  };
}

export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateNotificationInput): Promise<NotificationView> {
    const row = await this.prisma.notification.create({ data: input });
    return toView(row);
  }

  async list(userId: string, limit: number): Promise<NotificationView[]> {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(toView);
  }

  unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, ids: string[] | null): Promise<number> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    });
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async createMany(inputs: CreateNotificationInput[]): Promise<NotificationView[]> {
    if (inputs.length === 0) return [];
    // createMany cannot return rows, and the caller needs ids to push — for a
    // small circle a short transaction of creates is simpler than a re-query.
    const rows = await this.prisma.$transaction(
      inputs.map((data) => this.prisma.notification.create({ data })),
    );
    return rows.map(toView);
  }

  async listPeerRecipients(exceptUserId: string, pref: PeerPreference): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE', id: { not: exceptUserId }, [pref]: true },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  async listAdmins(): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE', role: 'ADMIN' },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  async wants(userId: string, pref: PeerPreference): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { [pref]: true } as { notifyPeerSuccess?: true; notifyOvertaken?: true },
    });
    return Boolean(user?.[pref]);
  }

  async displayName(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });
    return user?.displayName ?? null;
  }

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notifyPeerSuccess: true, notifyOvertaken: true, emailMilestones: true },
    });
    return {
      notifyPeerSuccess: user?.notifyPeerSuccess ?? true,
      notifyOvertaken: user?.notifyOvertaken ?? true,
      emailMilestones: user?.emailMilestones ?? true,
    };
  }

  async updatePreferences(
    userId: string,
    patch: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: patch,
      select: { notifyPeerSuccess: true, notifyOvertaken: true, emailMilestones: true },
    });
    return user;
  }
}
