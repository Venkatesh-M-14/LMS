import { ChatService } from '../chatService';
import type { ChannelListRow, ChannelRow, ChatRepository } from '../ports';
import type { ChatMessageView, ChatPeer } from '@academy/shared';

/** In-memory chat mirroring the key-dedupe + DM-ACL semantics. */
class FakeRepo implements ChatRepository {
  channels = new Map<string, ChannelRow & { members: Set<string> }>();
  messages = new Map<string, ChatMessageView[]>();
  peers: ChatPeer[] = [];
  names = new Map<string, string>();
  lessons = new Map<string, string>();
  private seq = 0;

  async ensureChannel(input: {
    key: string;
    type: ChannelRow['type'];
    lessonId: string | null;
    memberIds?: string[];
  }): Promise<ChannelRow> {
    let channel = [...this.channels.values()].find((c) => c.key === input.key);
    if (!channel) {
      channel = {
        id: `ch-${this.seq++}`,
        type: input.type,
        key: input.key,
        lessonId: input.lessonId,
        members: new Set(),
      };
      this.channels.set(channel.id, channel);
    }
    for (const id of input.memberIds ?? []) channel.members.add(id);
    return channel;
  }
  async getChannelById(id: string) {
    return this.channels.get(id) ?? null;
  }
  async isMember(channelId: string, userId: string) {
    return this.channels.get(channelId)?.members.has(userId) ?? false;
  }
  async ensureMembership(channelId: string, userId: string) {
    this.channels.get(channelId)?.members.add(userId);
  }
  async listChannelsFor(): Promise<ChannelListRow[]> {
    return [];
  }
  async listPeers() {
    return this.peers;
  }
  async listMessages(channelId: string) {
    return { messages: this.messages.get(channelId) ?? [], nextCursor: null };
  }
  async postMessage(channelId: string, authorId: string, body: string) {
    const message: ChatMessageView = {
      id: `m-${this.seq++}`,
      authorId,
      authorName: this.names.get(authorId) ?? authorId,
      body,
      createdAt: '2026-07-16T00:00:00.000Z',
    };
    const list = this.messages.get(channelId) ?? [];
    list.push(message);
    this.messages.set(channelId, list);
    return message;
  }
  async markRead() {}
  async recipientsFor(channel: ChannelRow, exceptUserId: string) {
    const c = this.channels.get(channel.id)!;
    return [...c.members].filter((id) => id !== exceptUserId);
  }
  async lessonTitle(lessonId: string) {
    return this.lessons.get(lessonId) ?? null;
  }
}

describe('ChatService channels', () => {
  it('gives everyone the same singleton group room', async () => {
    const repo = new FakeRepo();
    const service = new ChatService({ repo });
    const a = await service.getGroupChannel('alice');
    const b = await service.getGroupChannel('bob');
    expect(a.id).toBe(b.id);
  });

  it('dedupes a DM regardless of who starts it', async () => {
    const repo = new FakeRepo();
    repo.peers = [
      { userId: 'bob', displayName: 'Bob' },
      { userId: 'alice', displayName: 'Alice' },
    ];
    const service = new ChatService({ repo });
    const fromA = await service.startDirectChannel('alice', 'bob');
    const fromB = await service.startDirectChannel('bob', 'alice');
    expect(fromA.id).toBe(fromB.id);
  });

  it('refuses a DM with a non-member of the circle', async () => {
    const repo = new FakeRepo();
    repo.peers = [{ userId: 'bob', displayName: 'Bob' }];
    const service = new ChatService({ repo });
    await expect(service.startDirectChannel('alice', 'stranger')).rejects.toMatchObject({
      httpStatus: 404,
    });
  });

  it('rejects messaging yourself', async () => {
    const service = new ChatService({ repo: new FakeRepo() });
    await expect(service.startDirectChannel('alice', 'alice')).rejects.toMatchObject({ httpStatus: 422 });
  });
});

describe('ChatService access control', () => {
  it('keeps a DM private to its two members', async () => {
    const repo = new FakeRepo();
    repo.peers = [{ userId: 'bob', displayName: 'Bob' }];
    const service = new ChatService({ repo });
    const dm = await service.startDirectChannel('alice', 'bob');

    await expect(service.getMessages(dm.id, 'eve')).rejects.toMatchObject({ httpStatus: 403 });
    await expect(service.getMessages(dm.id, 'bob')).resolves.toMatchObject({ messages: [] });
  });

  it('pushes a DM only to the other member', async () => {
    const repo = new FakeRepo();
    repo.peers = [{ userId: 'bob', displayName: 'Bob' }];
    const service = new ChatService({ repo });
    const pushed: string[][] = [];
    service.setPusher({ push: (ids) => pushed.push(ids) });
    const dm = await service.startDirectChannel('alice', 'bob');

    await service.postMessage(dm.id, 'alice', 'hi bob');

    expect(pushed).toEqual([['bob']]);
  });

  it('lets any member into the group room', async () => {
    const service = new ChatService({ repo: new FakeRepo() });
    const group = await service.getGroupChannel('alice');
    await expect(service.getMessages(group.id, 'bob')).resolves.toBeDefined();
  });
});
