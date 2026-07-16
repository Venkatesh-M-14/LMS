import type { Logger } from '../logging/logger';

/**
 * Typed in-process event bus — the sanctioned channel for cross-module
 * effects (per the architecture: gamification, notifications, progress are
 * subscribers, never direct dependencies of the publishing module).
 *
 * Handlers are awaited so read-after-write flows (submit quiz → refetch
 * progress) observe their effects; a failing handler is logged and swallowed —
 * subscribers must never break the publishing request.
 */
export interface DomainEvents {
  AttemptGraded: {
    userId: string;
    assessmentId: string;
    lessonId: string | null;
    passed: boolean;
    scorePct: number;
  };
  /** Consumed by gamification (M7); emitted from the project review flow. */
  ProjectApproved: {
    userId: string;
    briefId: string;
    topicId: string;
  };
  /** A quizless lesson was manually completed (quiz lessons use AttemptGraded). */
  LessonCompleted: {
    userId: string;
    lessonId: string;
  };
}

type Handler<K extends keyof DomainEvents> = (payload: DomainEvents[K]) => Promise<void> | void;

export class EventBus {
  private readonly handlers = new Map<keyof DomainEvents, Array<Handler<never>>>();

  constructor(private readonly logger?: Logger) {}

  on<K extends keyof DomainEvents>(event: K, handler: Handler<K>): void {
    const list = this.handlers.get(event) ?? [];
    list.push(handler as Handler<never>);
    this.handlers.set(event, list);
  }

  async emit<K extends keyof DomainEvents>(event: K, payload: DomainEvents[K]): Promise<void> {
    const list = (this.handlers.get(event) ?? []) as Array<Handler<K>>;
    for (const handler of list) {
      try {
        await handler(payload);
      } catch (err) {
        this.logger?.error({ err, event }, 'Event handler failed');
      }
    }
  }
}
