import type { ChatChannelType, ChatMessageView, ChatPeer } from '@academy/shared';
import type { PrismaClient } from '../../../core/db/prisma';
import type { ChannelListRow, ChannelRow, ChatRepository } from '../application/ports';

const PREVIEW_CHARS = 80;

export class PrismaChatRepository implements ChatRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async ensureChannel(input: {
    key: string;
    type: ChatChannelType;
    lessonId: string | null;
    memberIds?: string[];
  }): Promise<ChannelRow> {
    // Upsert on the unique key: concurrent first-opens collapse into one row.
    const channel = await this.prisma.chatChannel.upsert({
      where: { key: input.key },
      create: { key: input.key, type: input.type, lessonId: input.lessonId },
      update: {},
      select: { id: true, type: true, key: true, lessonId: true },
    });

    if (input.memberIds?.length) {
      await this.prisma.chatMembership.createMany({
        data: input.memberIds.map((userId) => ({ channelId: channel.id, userId })),
        skipDuplicates: true,
      });
    }
    return channel;
  }

  async getChannelById(channelId: string): Promise<ChannelRow | null> {
    return this.prisma.chatChannel.findUnique({
      where: { id: channelId },
      select: { id: true, type: true, key: true, lessonId: true },
    });
  }

  async isMember(channelId: string, userId: string): Promise<boolean> {
    const row = await this.prisma.chatMembership.findUnique({
      where: { channelId_userId: { channelId, userId } },
      select: { userId: true },
    });
    return row !== null;
  }

  async ensureMembership(channelId: string, userId: string): Promise<void> {
    await this.prisma.chatMembership.createMany({
      data: [{ channelId, userId }],
      skipDuplicates: true,
    });
  }

  async listChannelsFor(userId: string): Promise<ChannelListRow[]> {
    // A member sees: every GROUP/LESSON channel, plus the DMs they belong to.
    const channels = await this.prisma.chatChannel.findMany({
      where: {
        OR: [{ type: { in: ['GROUP', 'LESSON'] } }, { members: { some: { userId } } }],
      },
      include: {
        lesson: { select: { title: true } },
        members: {
          select: { userId: true, lastReadAt: true, user: { select: { displayName: true } } },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { body: true, createdAt: true },
        },
      },
    });

    const rows = await Promise.all(
      channels.map(async (channel) => {
        const mine = channel.members.find((m) => m.userId === userId);
        const unreadCount = await this.prisma.chatMessage.count({
          where: {
            channelId: channel.id,
            authorId: { not: userId },
            ...(mine?.lastReadAt ? { createdAt: { gt: mine.lastReadAt } } : {}),
          },
        });
        const last = channel.messages[0];
        const title =
          channel.type === 'GROUP'
            ? 'Circle chat'
            : channel.type === 'LESSON'
              ? (channel.lesson?.title ?? 'Lesson')
              : (channel.members.find((m) => m.userId !== userId)?.user.displayName ?? 'Direct message');

        return {
          id: channel.id,
          type: channel.type,
          key: channel.key,
          lessonId: channel.lessonId,
          title,
          unreadCount,
          lastMessageAt: last?.createdAt.toISOString() ?? null,
          lastMessagePreview: last ? last.body.slice(0, PREVIEW_CHARS) : null,
        };
      }),
    );

    // Most recent conversation first; never-used channels sink to the bottom.
    return rows.sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
  }

  async listPeers(userId: string): Promise<ChatPeer[]> {
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE', id: { not: userId } },
      orderBy: { displayName: 'asc' },
      select: { id: true, displayName: true },
    });
    return users.map((u) => ({ userId: u.id, displayName: u.displayName }));
  }

  async listMessages(
    channelId: string,
    limit: number,
    before?: string,
  ): Promise<{ messages: ChatMessageView[]; nextCursor: string | null }> {
    const rows = await this.prisma.chatMessage.findMany({
      where: { channelId, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: { author: { select: { displayName: true } } },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      // Oldest-first for rendering; the cursor is the oldest item's timestamp.
      messages: page
        .map((row) => ({
          id: row.id,
          authorId: row.authorId,
          authorName: row.author.displayName,
          body: row.body,
          createdAt: row.createdAt.toISOString(),
        }))
        .reverse(),
      nextCursor: hasMore ? (page.at(-1)?.createdAt.toISOString() ?? null) : null,
    };
  }

  async postMessage(channelId: string, authorId: string, body: string): Promise<ChatMessageView> {
    const row = await this.prisma.chatMessage.create({
      data: { channelId, authorId, body },
      include: { author: { select: { displayName: true } } },
    });
    return {
      id: row.id,
      authorId: row.authorId,
      authorName: row.author.displayName,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async markRead(channelId: string, userId: string): Promise<void> {
    await this.prisma.chatMembership.upsert({
      where: { channelId_userId: { channelId, userId } },
      create: { channelId, userId, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    });
  }

  async recipientsFor(channel: ChannelRow, exceptUserId: string): Promise<string[]> {
    if (channel.type === 'DIRECT') {
      const members = await this.prisma.chatMembership.findMany({
        where: { channelId: channel.id, userId: { not: exceptUserId } },
        select: { userId: true },
      });
      return members.map((m) => m.userId);
    }
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE', id: { not: exceptUserId } },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  async lessonTitle(lessonId: string): Promise<string | null> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { title: true },
    });
    return lesson?.title ?? null;
  }
}
