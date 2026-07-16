import { EventBus } from '../../../../core/events/eventBus';
import type { AuthoringItemInput, AssessmentRecord, AssessmentRepository } from '../../../assessments/application/ports';
import { SuggestionService } from '../suggestionService';
import type { CreateSuggestionInput, SuggestionRepository, SuggestionRow } from '../ports';
import type { SuggestionStatus, SuggestionView } from '@academy/shared';

const DRAFT: AuthoringItemInput = {
  points: 2,
  skillIds: [],
  item: {
    type: 'MCQ',
    payload: {
      prompt: 'What does fetch do?',
      options: [
        { id: 'a', text: 'reads the next instruction' },
        { id: 'b', text: 'stores to disk' },
      ],
      correctOptionId: 'a',
    },
  },
};

class FakeSuggestionRepo implements SuggestionRepository {
  rows = new Map<string, SuggestionRow & { status: SuggestionStatus }>();
  private seq = 0;

  async create(input: CreateSuggestionInput): Promise<SuggestionView> {
    const id = `s-${this.seq++}`;
    this.rows.set(id, { id, userId: input.userId, kind: input.kind, lessonId: input.lessonId, status: 'PENDING', draft: input.draft });
    return {
      id, kind: input.kind, status: 'PENDING', authorId: input.userId, authorName: 'Student',
      lessonId: input.lessonId, lessonTitle: null, body: input.body, draft: input.draft,
      adminNote: null, reviewedAt: null, createdItemId: null, createdAt: '2026-07-16T00:00:00.000Z',
    };
  }
  async getRowById(id: string) {
    return this.rows.get(id) ?? null;
  }
  async listMine() {
    return [];
  }
  async listForReview() {
    return [];
  }
  async markReviewed(input: { id: string; accepted: boolean }): Promise<boolean> {
    const row = this.rows.get(input.id);
    if (!row || row.status !== 'PENDING') return false;
    row.status = input.accepted ? 'ACCEPTED' : 'REJECTED';
    return true;
  }
  async authorName() {
    return 'Student';
  }
}

class FakeAssessments implements Pick<AssessmentRepository, 'findByLessonId' | 'appendItem'> {
  hasQuiz = true;
  appended: AuthoringItemInput[] = [];
  async findByLessonId(): Promise<AssessmentRecord | null> {
    return this.hasQuiz ? ({ id: 'as1' } as AssessmentRecord) : null;
  }
  async appendItem(_assessmentId: string, item: AuthoringItemInput) {
    this.appended.push(item);
    return { id: `item-${this.appended.length}` };
  }
}

function make(over: { hasQuiz?: boolean } = {}) {
  const repo = new FakeSuggestionRepo();
  const assessments = new FakeAssessments();
  if (over.hasQuiz === false) assessments.hasQuiz = false;
  const events = new EventBus();
  const service = new SuggestionService({
    repo,
    assessments: assessments as unknown as AssessmentRepository,
    events,
  });
  return { repo, assessments, events, service };
}

describe('SuggestionService', () => {
  it('emits SuggestionSubmitted and notifies on submit', async () => {
    const { events, service } = make();
    const submitted: unknown[] = [];
    events.on('SuggestionSubmitted', (e) => void submitted.push(e));

    await service.submit('u1', { kind: 'DRAFT_QUESTION', lessonId: 'l1', body: 'test fetch', draft: DRAFT });

    expect(submitted).toHaveLength(1);
  });

  it('accepting a draft appends a real question to the lesson bank', async () => {
    const { repo, assessments, events, service } = make();
    const { id } = await repo.create({ userId: 'u1', kind: 'DRAFT_QUESTION', lessonId: 'l1', body: '', draft: DRAFT });
    const reviewed: Array<{ accepted: boolean; createdItemId: string | null }> = [];
    events.on('SuggestionReviewed', (e) => void reviewed.push(e));

    await service.review(id, 'admin', { decision: 'ACCEPT' });

    expect(assessments.appended).toHaveLength(1);
    expect(reviewed[0]).toMatchObject({ accepted: true, createdItemId: 'item-1' });
    expect(repo.rows.get(id)!.status).toBe('ACCEPTED');
  });

  it('rejecting does not touch the question bank', async () => {
    const { repo, assessments, service } = make();
    const { id } = await repo.create({ userId: 'u1', kind: 'DRAFT_QUESTION', lessonId: 'l1', body: '', draft: DRAFT });

    await service.review(id, 'admin', { decision: 'REJECT', adminNote: 'not now' });

    expect(assessments.appended).toHaveLength(0);
    expect(repo.rows.get(id)!.status).toBe('REJECTED');
  });

  it('refuses to accept a draft into a lesson that has no quiz', async () => {
    const { repo, service } = make({ hasQuiz: false });
    const { id } = await repo.create({ userId: 'u1', kind: 'DRAFT_QUESTION', lessonId: 'l1', body: '', draft: DRAFT });

    await expect(service.review(id, 'admin', { decision: 'ACCEPT' })).rejects.toMatchObject({ httpStatus: 422 });
    expect(repo.rows.get(id)!.status).toBe('PENDING'); // nothing committed
  });

  it('cannot review the same suggestion twice', async () => {
    const { repo, service } = make();
    const { id } = await repo.create({ userId: 'u1', kind: 'IDEA', lessonId: null, body: 'cover closures', draft: null });

    await service.review(id, 'admin', { decision: 'ACCEPT' });
    await expect(service.review(id, 'admin', { decision: 'REJECT' })).rejects.toMatchObject({ httpStatus: 409 });
  });
});
