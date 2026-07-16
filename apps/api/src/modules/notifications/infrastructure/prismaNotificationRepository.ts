import type { Notification } from '@prisma/client';
import type { NotificationView } from '@academy/shared';
import type { PrismaClient } from '../../../core/db/prisma';
import type { CreateNotificationInput, NotificationRepository } from '../application/ports';

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
}
