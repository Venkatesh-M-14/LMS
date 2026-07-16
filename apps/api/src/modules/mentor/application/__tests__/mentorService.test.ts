import { ErrorCodes, type MentorStreamChunk } from '@academy/shared';
import { MutableClock } from '../../../auth/application/__tests__/fakes';
import type { LlmMessage, LlmProvider, LlmStreamResult } from '../llmProvider';
import { MentorService } from '../mentorService';
import type { ConversationRow, MentorRepository } from '../ports';

/** Captures the system prompt and streams a fixed reply. */
class FakeProvider implements LlmProvider {
  lastSystem = '';
  lastMessages: LlmMessage[] = [];
  configured = true;
  words = ['Hello', ' there'];

  isConfigured() {
    return this.configured;
  }

  streamReply(system: string, messages: LlmMessage[]): LlmStreamResult {
    this.lastSystem = system;
    this.lastMessages = messages;
    const words = this.words;
    return {
      stream: (async function* () {
        for (const w of words) yield w;
      })(),
      usage: async () => ({ inputTokens: 10, outputTokens: 5 }),
    };
  }
}

class FakeRepo implements MentorRepository {
  conversations = new Map<string, ConversationRow>();
  history = new Map<string, LlmMessage[]>();
  grounding: { title: string; excerpt: string } | null = null;
  usage = new Map<string, number>();
  appended: Array<{ role: string; content: string }> = [];
  titleSet: string | null = null;
  timezone = 'UTC';

  async getUserTimezone() {
    return this.timezone;
  }
  async createConversation(userId: string, lessonId: string | null) {
    const id = `c-${this.conversations.size + 1}`;
    this.conversations.set(id, { id, userId, lessonId });
    return { id };
  }
  async listConversations() {
    return [];
  }
  async getConversationDetail() {
    return null;
  }
  async getConversationRow(conversationId: string) {
    return this.conversations.get(conversationId) ?? null;
  }
  async getHistory(conversationId: string) {
    return this.history.get(conversationId) ?? [];
  }
  async appendUserMessage(_c: string, content: string) {
    this.appended.push({ role: 'user', content });
    return { id: 'm-user' };
  }
  async appendAssistantMessage(_c: string, content: string) {
    this.appended.push({ role: 'assistant', content });
    return { id: 'm-assistant' };
  }
  async setTitleIfDefault(_c: string, title: string) {
    this.titleSet = title;
  }
  async getLessonGrounding() {
    return this.grounding;
  }
  async getTokensUsed(userId: string, day: string) {
    return this.usage.get(`${userId}:${day}`) ?? 0;
  }
  async addUsage(userId: string, day: string, tokens: number) {
    const key = `${userId}:${day}`;
    this.usage.set(key, (this.usage.get(key) ?? 0) + tokens);
  }
}

function makeService(over: { repo?: FakeRepo; provider?: FakeProvider; budget?: number } = {}) {
  const repo = over.repo ?? new FakeRepo();
  const provider = over.provider ?? new FakeProvider();
  const clock = new MutableClock(new Date('2026-07-16T12:00:00Z'));
  const service = new MentorService({
    repo,
    provider,
    clock,
    dailyTokenBudget: over.budget ?? 1000,
  });
  return { service, repo, provider };
}

async function collect(gen: AsyncGenerator<MentorStreamChunk>): Promise<MentorStreamChunk[]> {
  const out: MentorStreamChunk[] = [];
  for await (const c of gen) out.push(c);
  return out;
}

describe('MentorService.streamMessage', () => {
  it('streams start → deltas → done and persists the exchange + usage', async () => {
    const { service, repo } = makeService();
    const { id } = await repo.createConversation('u1', null);

    const chunks = await collect(service.streamMessage(id, 'u1', 'How does the CPU work?'));

    expect(chunks[0]).toMatchObject({ type: 'start' });
    expect(chunks.filter((c) => c.type === 'delta').map((c) => (c as { text: string }).text)).toEqual([
      'Hello',
      ' there',
    ]);
    const done = chunks.at(-1);
    expect(done).toMatchObject({ type: 'done', content: 'Hello there', tokensUsedToday: 15 });
    expect(repo.appended).toEqual([
      { role: 'user', content: 'How does the CPU work?' },
      { role: 'assistant', content: 'Hello there' },
    ]);
    expect(repo.usage.get('u1:2026-07-16')).toBe(15);
    expect(repo.titleSet).toBe('How does the CPU work?');
  });

  it('grounds only in the provided (published) lesson excerpt', async () => {
    const repo = new FakeRepo();
    repo.grounding = {
      title: 'How a Computer Works',
      excerpt: 'The CPU fetches, decodes, and executes instructions.',
    };
    const { service, provider } = makeService({ repo });
    const { id } = await repo.createConversation('u1', 'lesson-1');

    await collect(service.streamMessage(id, 'u1', 'help'));

    expect(provider.lastSystem).toContain('How a Computer Works');
    expect(provider.lastSystem).toContain('fetches, decodes, and executes');
    // The persona explicitly disclaims access to answer keys / hidden tests.
    expect(provider.lastSystem).toMatch(/never have access to quiz answer keys/i);
  });

  it('blocks when the daily budget is already spent', async () => {
    const repo = new FakeRepo();
    repo.usage.set('u1:2026-07-16', 1000);
    const { service } = makeService({ repo, budget: 1000 });
    const { id } = await repo.createConversation('u1', null);

    const chunks = await collect(service.streamMessage(id, 'u1', 'hi'));

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ type: 'error', code: ErrorCodes.MENTOR_BUDGET_EXCEEDED });
    expect(repo.appended).toHaveLength(0);
  });

  it('reports an error chunk when the provider is not configured', async () => {
    const provider = new FakeProvider();
    provider.configured = false;
    const { service, repo } = makeService({ provider });
    // A conversation cannot be created while unconfigured, so seed one directly.
    repo.conversations.set('c-1', { id: 'c-1', userId: 'u1', lessonId: null });

    const chunks = await collect(service.streamMessage('c-1', 'u1', 'hi'));

    expect(chunks[0]).toMatchObject({ type: 'error', code: ErrorCodes.MENTOR_NOT_CONFIGURED });
  });

  it('refuses to stream on another user’s conversation', async () => {
    const { service, repo } = makeService();
    const { id } = await repo.createConversation('owner', null);

    const chunks = await collect(service.streamMessage(id, 'intruder', 'hi'));

    expect(chunks[0]).toMatchObject({ type: 'error', code: ErrorCodes.FORBIDDEN });
  });
});

describe('MentorService.getBudget', () => {
  it('reports configuration and remaining tokens', async () => {
    const repo = new FakeRepo();
    repo.usage.set('u1:2026-07-16', 200);
    const { service } = makeService({ repo, budget: 1000 });

    const budget = await service.getBudget('u1');

    expect(budget).toEqual({
      configured: true,
      dailyTokenBudget: 1000,
      tokensUsedToday: 200,
      remaining: 800,
    });
  });
});
