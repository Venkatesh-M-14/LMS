import type { Prisma } from '@prisma/client';
import type { SuggestionStatus, SuggestionView } from '@academy/shared';
import type { PrismaClient } from '../../../core/db/prisma';
import type { AuthoringItemInput } from '../../assessments/application/ports';
import type { CreateSuggestionInput, SuggestionRepository, SuggestionRow } from '../application/ports';

type Row = Prisma.SyllabusSuggestionGetPayload<{
  include: { user: { select: { displayName: true } }; lesson: { select: { title: true } } };
}>;

function toView(row: Row): SuggestionView {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    authorId: row.userId,
    authorName: row.user.displayName,
    lessonId: row.lessonId,
    lessonTitle: row.lesson?.title ?? null,
    body: row.body,
    draft: row.draft ?? null,
    adminNote: row.adminNote,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdItemId: row.createdItemId,
    createdAt: row.createdAt.toISOString(),
  };
}

const INCLUDE = {
  user: { select: { displayName: true } },
  lesson: { select: { title: true } },
} as const;

export class PrismaSuggestionRepository implements SuggestionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateSuggestionInput): Promise<SuggestionView> {
    const row = await this.prisma.syllabusSuggestion.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        lessonId: input.lessonId,
        body: input.body,
        draft: (input.draft ?? undefined) as Prisma.InputJsonValue | undefined,
      },
      include: INCLUDE,
    });
    return toView(row);
  }

  async getRowById(id: string): Promise<SuggestionRow | null> {
    const row = await this.prisma.syllabusSuggestion.findUnique({ where: { id } });
    if (!row) return null;
    return {
      id: row.id,
      userId: row.userId,
      kind: row.kind,
      lessonId: row.lessonId,
      status: row.status,
      draft: (row.draft as AuthoringItemInput | null) ?? null,
    };
  }

  async listMine(userId: string): Promise<SuggestionView[]> {
    const rows = await this.prisma.syllabusSuggestion.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: INCLUDE,
    });
    return rows.map(toView);
  }

  async listForReview(status: SuggestionStatus | null): Promise<SuggestionView[]> {
    const rows = await this.prisma.syllabusSuggestion.findMany({
      where: status ? { status } : {},
      // Pending first (P < A/R alphabetically is not reliable) — sort explicitly.
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: INCLUDE,
    });
    const weight = (s: SuggestionStatus) => (s === 'PENDING' ? 0 : 1);
    return rows
      .map(toView)
      .sort((a, b) => weight(a.status) - weight(b.status) || b.createdAt.localeCompare(a.createdAt));
  }

  async markReviewed(input: {
    id: string;
    reviewerId: string;
    accepted: boolean;
    adminNote: string | null;
    createdItemId: string | null;
  }): Promise<boolean> {
    // Guarded transition: only PENDING moves, so two reviewers cannot both win.
    const { count } = await this.prisma.syllabusSuggestion.updateMany({
      where: { id: input.id, status: 'PENDING' },
      data: {
        status: input.accepted ? 'ACCEPTED' : 'REJECTED',
        reviewedById: input.reviewerId,
        reviewedAt: new Date(),
        adminNote: input.adminNote,
        createdItemId: input.createdItemId,
      },
    });
    return count === 1;
  }

  async authorName(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });
    return user?.displayName ?? null;
  }
}
