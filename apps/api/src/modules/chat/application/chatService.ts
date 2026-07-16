import {
  ErrorCodes,
  type ChatChannelView,
  type ChatMessagePage,
  type ChatMessageView,
  type ChatPeer,
} from '@academy/shared';
import { AppError, ForbiddenError, NotFoundError } from '../../../core/errors/appError';
import type { Logger } from '../../../core/logging/logger';
import {
  GROUP_CHANNEL_KEY,
  directChannelKey,
  lessonChannelKey,
} from '../domain/channelKey';
import type { ChatPusher, ChatRepository } from './ports';

export interface ChatServiceDeps {
  repo: ChatRepository;
  logger?: Logger;
}

const PAGE_SIZE = 50;
const NOOP_PUSHER: ChatPusher = { push: () => {} };

/**
 * Three surfaces over one channel model: the circle's GROUP room, 1:1 DIRECT
 * channels, and per-LESSON threads. GROUP/LESSON are open to every member;
 * DIRECT is gated by membership rows.
 */
export class ChatService {
  private pusher: ChatPusher = NOOP_PUSHER;

  constructor(private readonly deps: ChatServiceDeps) {}

  setPusher(pusher: ChatPusher): void {
    this.pusher = pusher;
  }

  /** The single circle-wide room, created on first use. */
  async getGroupChannel(userId: string): Promise<ChatChannelView> {
    const channel = await this.deps.repo.ensureChannel({
      key: GROUP_CHANNEL_KEY,
      type: 'GROUP',
      lessonId: null,
    });
    await this.deps.repo.ensureMembership(channel.id, userId);
    return this.toView(channel, 'Circle chat');
  }

  /** The discussion thread for one lesson, created on first use. */
  async getLessonChannel(lessonId: string, userId: string): Promise<ChatChannelView> {
    const title = await this.deps.repo.lessonTitle(lessonId);
    if (title === null) throw new NotFoundError('Lesson not found');
    const channel = await this.deps.repo.ensureChannel({
      key: lessonChannelKey(lessonId),
      type: 'LESSON',
      lessonId,
    });
    await this.deps.repo.ensureMembership(channel.id, userId);
    return this.toView(channel, title);
  }

  /** Get-or-create the DM with another member. Self-DMs are rejected. */
  async startDirectChannel(userId: string, peerId: string): Promise<ChatChannelView> {
    if (userId === peerId) {
      throw new AppError(ErrorCodes.VALIDATION_FAILED, 422, 'You cannot message yourself');
    }
    const peers = await this.deps.repo.listPeers(userId);
    const peer = peers.find((p) => p.userId === peerId);
    if (!peer) throw new NotFoundError('That member is not in your circle');

    const channel = await this.deps.repo.ensureChannel({
      key: directChannelKey(userId, peerId),
      type: 'DIRECT',
      lessonId: null,
      memberIds: [userId, peerId],
    });
    return this.toView(channel, peer.displayName);
  }

  listChannels(userId: string): Promise<ChatChannelView[]> {
    return this.deps.repo.listChannelsFor(userId).then((rows) =>
      rows.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        lessonId: row.lessonId,
        unreadCount: row.unreadCount,
        lastMessageAt: row.lastMessageAt,
        lastMessagePreview: row.lastMessagePreview,
      })),
    );
  }

  listPeers(userId: string): Promise<ChatPeer[]> {
    return this.deps.repo.listPeers(userId);
  }

  async getMessages(channelId: string, userId: string, before?: string): Promise<ChatMessagePage> {
    await this.assertCanAccess(channelId, userId);
    const page = await this.deps.repo.listMessages(channelId, PAGE_SIZE, before);
    // Opening a channel reads it; only the first page marks read.
    if (!before) await this.deps.repo.markRead(channelId, userId);
    return page;
  }

  async postMessage(channelId: string, userId: string, body: string): Promise<ChatMessageView> {
    const channel = await this.assertCanAccess(channelId, userId);
    const message = await this.deps.repo.postMessage(channelId, userId, body);
    await this.deps.repo.markRead(channelId, userId); // your own message is read
    try {
      const recipients = await this.deps.repo.recipientsFor(channel, userId);
      this.pusher.push(recipients, { channelId, message });
    } catch (err) {
      this.deps.logger?.warn({ err, channelId }, 'Chat push failed');
    }
    return message;
  }

  async markRead(channelId: string, userId: string): Promise<void> {
    await this.assertCanAccess(channelId, userId);
    await this.deps.repo.markRead(channelId, userId);
  }

  /** GROUP/LESSON are open to the circle; DIRECT requires membership. */
  private async assertCanAccess(channelId: string, userId: string) {
    const channel = await this.deps.repo.getChannelById(channelId);
    if (!channel) throw new NotFoundError('Channel not found');
    if (channel.type === 'DIRECT') {
      const member = await this.deps.repo.isMember(channelId, userId);
      if (!member) throw new ForbiddenError('Not your conversation');
    } else {
      await this.deps.repo.ensureMembership(channelId, userId);
    }
    return channel;
  }

  private toView(
    channel: { id: string; type: ChatChannelView['type']; lessonId: string | null },
    title: string,
  ): ChatChannelView {
    return {
      id: channel.id,
      type: channel.type,
      title,
      lessonId: channel.lessonId,
      unreadCount: 0,
      lastMessageAt: null,
      lastMessagePreview: null,
    };
  }
}
