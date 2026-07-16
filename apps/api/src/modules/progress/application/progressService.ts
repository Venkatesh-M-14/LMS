import {
  ErrorCodes,
  type LessonCompletionResult,
  type ProgressMap,
  type Role,
} from '@academy/shared';
import { AppError, NotFoundError } from '../../../core/errors/appError';
import { GatingEvaluator } from '../domain/gating';
import type { ProgressRepository } from './ports';
import type { EventBus } from '../../../core/events/eventBus';

export interface Actor {
  id: string;
  role: Role;
}

/**
 * Progress & gating application service. Availability is derived on read;
 * completion cascades (lesson → topic → module) are recorded exactly once.
 */
export class ProgressService {
  constructor(
    private readonly repo: ProgressRepository,
    private readonly events?: EventBus,
  ) {}

  /** The whole path's effective statuses for one user (auto-enrolls students). */
  async getMap(actor: Actor): Promise<ProgressMap> {
    const { pathId, modules } = await this.repo.getPathStructure();
    if (actor.role === 'STUDENT') {
      await this.repo.ensureEnrolled(actor.id, pathId);
    }
    const evaluator = await this.buildEvaluator(actor.id, modules, actor.role !== 'STUDENT');
    return evaluator.computeMap();
  }

  /**
   * Server-side gate for reading a lesson or starting its quiz.
   * Instructors and admins bypass — they author and review this content.
   */
  async assertLessonAccessible(actor: Actor, lessonId: string): Promise<void> {
    if (actor.role !== 'STUDENT') return;
    const { modules } = await this.repo.getPathStructure();
    const evaluator = await this.buildEvaluator(actor.id, modules);

    for (const module of modules) {
      for (const topic of module.topics) {
        const lesson = topic.lessons.find((l) => l.id === lessonId);
        if (lesson) {
          if (!evaluator.lessonAccessible(lesson, topic, module)) {
            throw new AppError(
              ErrorCodes.GATING_LOCKED,
              403,
              'Complete the previous lessons to unlock this one',
            );
          }
          return;
        }
      }
    }
    // Lesson not part of the active path — nothing to gate (404s elsewhere).
  }

  /** Same gate at topic level — used by the projects module. */
  async assertTopicAccessible(actor: Actor, topicId: string): Promise<void> {
    if (actor.role !== 'STUDENT') return;
    const { modules } = await this.repo.getPathStructure();
    const evaluator = await this.buildEvaluator(actor.id, modules);
    for (const module of modules) {
      const topic = module.topics.find((candidate) => candidate.id === topicId);
      if (topic) {
        if (!evaluator.topicAccessible(topic, module)) {
          throw new AppError(
            ErrorCodes.GATING_LOCKED,
            403,
            'Complete the previous topics to unlock this project',
          );
        }
        return;
      }
    }
  }

  /** Records "the student opened this lesson" (never downgrades COMPLETED). */
  async markLessonOpened(actor: Actor, lessonId: string): Promise<void> {
    if (actor.role !== 'STUDENT') return;
    await this.repo.markInProgress(actor.id, 'LESSON', lessonId);
  }

  /**
   * Manual completion — only for lessons without a quiz (quiz lessons complete
   * by passing the quiz). Idempotent.
   */
  async markLessonComplete(actor: Actor, lessonId: string): Promise<LessonCompletionResult> {
    const context = await this.repo.findLessonContext(lessonId);
    if (!context || !context.published) throw new NotFoundError('Lesson not found');
    if (context.hasQuiz) {
      throw new AppError(
        ErrorCodes.LESSON_HAS_QUIZ,
        409,
        'This lesson is completed by passing its quiz',
      );
    }
    await this.assertLessonAccessible(actor, lessonId);
    const result = await this.completeLessonCascade(actor.id, lessonId, null);
    // Quiz lessons emit AttemptGraded; quizless lessons notify here so
    // gamification (XP + certificates) reacts to this path too.
    if (result.lessonCompleted && this.events) {
      await this.events.emit('LessonCompleted', { userId: actor.id, lessonId });
    }
    return result;
  }

  /** Event subscriber: a graded, passed quiz completes its lesson. */
  async onAttemptGraded(event: {
    userId: string;
    lessonId: string | null;
    passed: boolean;
    scorePct: number;
  }): Promise<void> {
    if (!event.lessonId || !event.passed) return;
    await this.completeLessonCascade(event.userId, event.lessonId, event.scorePct);
  }

  /**
   * The exactly-once cascade. completeUnit's atomic guard makes concurrent
   * submissions race safely: only one caller sees `true` per unit transition.
   */
  private async completeLessonCascade(
    userId: string,
    lessonId: string,
    scorePct: number | null,
  ): Promise<LessonCompletionResult> {
    const context = await this.repo.findLessonContext(lessonId);
    if (!context) throw new NotFoundError('Lesson not found');

    const lessonCompleted = await this.repo.completeUnit(userId, 'LESSON', lessonId, scorePct);

    // Recompute completability with fresh records (post-write).
    const { modules } = await this.repo.getPathStructure();
    let evaluator = await this.buildEvaluator(userId, modules);

    const module = modules.find((m) => m.id === context.moduleId);
    const topic = module?.topics.find((t) => t.id === context.topicId);

    let topicCompleted = false;
    if (topic && evaluator.topicCompletable(topic)) {
      topicCompleted = await this.repo.completeUnit(userId, 'TOPIC', topic.id, null);
    }

    let moduleCompleted = false;
    if (module) {
      evaluator = await this.buildEvaluator(userId, modules);
      if (evaluator.moduleCompletable(module)) {
        moduleCompleted = await this.repo.completeUnit(userId, 'MODULE', module.id, null);
      }
    }

    return { lessonCompleted, topicCompleted, moduleCompleted };
  }

  private async buildEvaluator(
    userId: string,
    modules: Awaited<ReturnType<ProgressRepository['getPathStructure']>>['modules'],
    ignoreRules = false,
  ) {
    const [rules, records] = await Promise.all([
      this.repo.getRules(),
      this.repo.getUserRecords(userId),
    ]);
    return new GatingEvaluator(modules, rules, records, ignoreRules);
  }
}
