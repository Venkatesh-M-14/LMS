import type {
  MentorConversationDetail,
  MentorConversationSummary,
} from '@academy/shared';
import type { PrismaClient } from '../../../core/db/prisma';
import type { LlmMessage } from '../application/llmProvider';
import type { ConversationRow, MentorRepository } from '../application/ports';

export class PrismaMentorRepository implements MentorRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getUserTimezone(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    return user?.timezone || 'UTC';
  }

  async createConversation(userId: string, lessonId: string | null): Promise<{ id: string }> {
    return this.prisma.mentorConversation.create({
      data: { userId, lessonId },
      select: { id: true },
    });
  }

  async listConversations(userId: string): Promise<MentorConversationSummary[]> {
    const rows = await this.prisma.mentorConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { lesson: { select: { title: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      lessonId: row.lessonId,
      lessonTitle: row.lesson?.title ?? null,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async getConversationDetail(
    conversationId: string,
    userId: string,
  ): Promise<MentorConversationDetail | null> {
    const row = await this.prisma.mentorConversation.findFirst({
      where: { id: conversationId, userId },
      include: {
        lesson: { select: { title: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      lessonId: row.lessonId,
      lessonTitle: row.lesson?.title ?? null,
      updatedAt: row.updatedAt.toISOString(),
      messages: row.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      })),
    };
  }

  getConversationRow(conversationId: string): Promise<ConversationRow | null> {
    return this.prisma.mentorConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, userId: true, lessonId: true },
    });
  }

  async getHistory(conversationId: string): Promise<LlmMessage[]> {
    const messages = await this.prisma.mentorMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    });
    return messages.map((message) => ({
      role: message.role === 'ASSISTANT' ? 'assistant' : 'user',
      content: message.content,
    }));
  }

  async appendUserMessage(conversationId: string, content: string): Promise<{ id: string }> {
    return this.prisma.mentorMessage.create({
      data: { conversationId, role: 'USER', content },
      select: { id: true },
    });
  }

  async appendAssistantMessage(
    conversationId: string,
    content: string,
    tokens: { inputTokens: number; outputTokens: number },
  ): Promise<{ id: string }> {
    const [message] = await this.prisma.$transaction([
      this.prisma.mentorMessage.create({
        data: {
          conversationId,
          role: 'ASSISTANT',
          content,
          inputTokens: tokens.inputTokens,
          outputTokens: tokens.outputTokens,
        },
        select: { id: true },
      }),
      this.prisma.mentorConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);
    return message;
  }

  async setTitleIfDefault(conversationId: string, title: string): Promise<void> {
    await this.prisma.mentorConversation.updateMany({
      where: { id: conversationId, title: 'New conversation' },
      data: { title },
    });
  }

  async getLessonGrounding(
    lessonId: string,
  ): Promise<{ title: string; excerpt: string } | null> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        title: true,
        // PUBLISHED version only — never drafts, and content blocks never hold
        // answer keys or hidden tests.
        currentPublishedVersion: {
          select: { blocks: { orderBy: { order: 'asc' }, select: { type: true, payload: true } } },
        },
      },
    });
    if (!lesson?.currentPublishedVersion) return null;

    const parts: string[] = [];
    for (const block of lesson.currentPublishedVersion.blocks) {
      const payload = block.payload as Record<string, unknown>;
      if (block.type === 'MARKDOWN' || block.type === 'CALLOUT') {
        if (typeof payload.markdown === 'string') parts.push(payload.markdown);
      } else if (block.type === 'CODE') {
        if (typeof payload.code === 'string') parts.push('```\n' + payload.code + '\n```');
      }
    }
    // Bound the grounding size to keep prompts (and cost) predictable.
    const excerpt = parts.join('\n\n').slice(0, 4000);
    return { title: lesson.title, excerpt };
  }

  async getTokensUsed(userId: string, day: string): Promise<number> {
    const usage = await this.prisma.mentorUsage.findUnique({
      where: { userId_day: { userId, day } },
      select: { tokens: true },
    });
    return usage?.tokens ?? 0;
  }

  async addUsage(userId: string, day: string, tokens: number): Promise<void> {
    await this.prisma.mentorUsage.upsert({
      where: { userId_day: { userId, day } },
      create: { userId, day, tokens, messages: 1 },
      update: { tokens: { increment: tokens }, messages: { increment: 1 } },
    });
  }
}
