import {
  ErrorCodes,
  type MentorBudget,
  type MentorConversationDetail,
  type MentorConversationSummary,
  type MentorStreamChunk,
} from '@academy/shared';
import { AppError, NotFoundError } from '../../../core/errors/appError';
import type { Clock } from '../../auth/application/ports';
import type { Logger } from '../../../core/logging/logger';
import { localDate } from '../../gamification/domain/streak';
import { buildSystemPrompt, deriveTitle, trimHistory } from '../domain/prompt';
import type { LlmProvider } from './llmProvider';
import type { MentorRepository } from './ports';

export interface MentorServiceDeps {
  repo: MentorRepository;
  provider: LlmProvider;
  clock: Clock;
  dailyTokenBudget: number;
  logger?: Logger;
}

export class MentorService {
  constructor(private readonly deps: MentorServiceDeps) {}

  isConfigured(): boolean {
    return this.deps.provider.isConfigured();
  }

  async getBudget(userId: string): Promise<MentorBudget> {
    const configured = this.deps.provider.isConfigured();
    const day = await this.today(userId);
    const used = await this.deps.repo.getTokensUsed(userId, day);
    return {
      configured,
      dailyTokenBudget: this.deps.dailyTokenBudget,
      tokensUsedToday: used,
      remaining: Math.max(0, this.deps.dailyTokenBudget - used),
    };
  }

  listConversations(userId: string): Promise<MentorConversationSummary[]> {
    return this.deps.repo.listConversations(userId);
  }

  async createConversation(userId: string, lessonId: string | null): Promise<{ id: string }> {
    this.assertConfigured();
    return this.deps.repo.createConversation(userId, lessonId);
  }

  async getConversation(conversationId: string, userId: string): Promise<MentorConversationDetail> {
    const detail = await this.deps.repo.getConversationDetail(conversationId, userId);
    if (!detail) throw new NotFoundError('Conversation not found');
    return detail;
  }

  /**
   * Streams a reply. Yields SSE chunks: start → deltas → done (or error). The
   * user message is persisted first; the assistant message and token usage are
   * persisted after the stream completes. Budget is checked up front.
   */
  async *streamMessage(
    conversationId: string,
    userId: string,
    message: string,
  ): AsyncGenerator<MentorStreamChunk> {
    if (!this.deps.provider.isConfigured()) {
      yield { type: 'error', code: ErrorCodes.MENTOR_NOT_CONFIGURED, message: 'The AI Mentor is not configured' };
      return;
    }

    const conversation = await this.deps.repo.getConversationRow(conversationId);
    if (!conversation) {
      yield { type: 'error', code: ErrorCodes.NOT_FOUND, message: 'Conversation not found' };
      return;
    }
    if (conversation.userId !== userId) {
      yield { type: 'error', code: ErrorCodes.FORBIDDEN, message: 'Not your conversation' };
      return;
    }

    const day = await this.today(userId);
    const usedBefore = await this.deps.repo.getTokensUsed(userId, day);
    if (usedBefore >= this.deps.dailyTokenBudget) {
      yield {
        type: 'error',
        code: ErrorCodes.MENTOR_BUDGET_EXCEEDED,
        message: 'You have reached your daily mentor limit. It resets tomorrow.',
      };
      return;
    }

    await this.deps.repo.appendUserMessage(conversationId, message);
    await this.deps.repo.setTitleIfDefault(conversationId, deriveTitle(message));

    const grounding = conversation.lessonId
      ? await this.deps.repo.getLessonGrounding(conversation.lessonId)
      : null;
    const system = buildSystemPrompt(grounding);
    const history = trimHistory(await this.deps.repo.getHistory(conversationId));

    const assistantMessageId = `pending-${conversationId}`;
    yield { type: 'start', conversationId, messageId: assistantMessageId };

    let full = '';
    let usage = { inputTokens: 0, outputTokens: 0 };
    try {
      const result = this.deps.provider.streamReply(system, history);
      for await (const delta of result.stream) {
        full += delta;
        yield { type: 'delta', text: delta };
      }
      usage = await result.usage();
    } catch (error) {
      this.deps.logger?.error({ err: error, conversationId }, 'Mentor stream failed');
      yield { type: 'error', code: ErrorCodes.INTERNAL, message: 'The mentor could not respond. Please try again.' };
      return;
    }

    await this.deps.repo.appendAssistantMessage(conversationId, full, usage);
    const totalTokens = usage.inputTokens + usage.outputTokens;
    await this.deps.repo.addUsage(userId, day, totalTokens);

    const remaining = Math.max(0, this.deps.dailyTokenBudget - (usedBefore + totalTokens));
    yield { type: 'done', content: full, tokensUsedToday: usedBefore + totalTokens, remaining };
  }

  private assertConfigured(): void {
    if (!this.deps.provider.isConfigured()) {
      throw new AppError(
        ErrorCodes.MENTOR_NOT_CONFIGURED,
        503,
        'The AI Mentor is not configured on this server',
      );
    }
  }

  private async today(userId: string): Promise<string> {
    const tz = await this.deps.repo.getUserTimezone(userId);
    return localDate(this.deps.clock.now(), tz);
  }
}
