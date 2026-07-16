import type { EffectiveStatus, ProgressMap, UnitProgress } from '@academy/shared';

/**
 * Pure gating logic. Given the path structure, the prerequisite rules, and a
 * user's persisted records, derive every unit's effective status. LOCKED and
 * AVAILABLE are never stored — they are always computed here, so there is no
 * unlock state that can go stale or race.
 */

export type UnitType = 'LESSON' | 'TOPIC' | 'MODULE';

export interface StructureLesson {
  id: string;
  order: number;
  published: boolean;
}
export interface StructureTopic {
  id: string;
  order: number;
  lessons: StructureLesson[];
}
export interface StructureModule {
  id: string;
  order: number;
  topics: StructureTopic[];
}
export type PathStructure = StructureModule[];

export interface Rule {
  unitType: UnitType;
  unitId: string;
  requiredUnitType: UnitType;
  requiredUnitId: string;
  minScorePct: number | null;
}

export interface RecordRow {
  unitType: UnitType;
  unitId: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  bestScorePct: number | null;
}

const key = (type: UnitType, id: string) => `${type}:${id}`;

export class GatingEvaluator {
  private readonly rulesByUnit = new Map<string, Rule[]>();
  private readonly records = new Map<string, RecordRow>();

  constructor(
    private readonly structure: PathStructure,
    rules: Rule[],
    records: RecordRow[],
    /** Instructors/admins review everything: rules never lock units for them. */
    private readonly ignoreRules = false,
  ) {
    for (const rule of rules) {
      const k = key(rule.unitType, rule.unitId);
      const list = this.rulesByUnit.get(k) ?? [];
      list.push(rule);
      this.rulesByUnit.set(k, list);
    }
    for (const record of records) {
      this.records.set(key(record.unitType, record.unitId), record);
    }
  }

  isCompleted(type: UnitType, id: string): boolean {
    return this.records.get(key(type, id))?.status === 'COMPLETED';
  }

  private scoreOf(type: UnitType, id: string): number | null {
    return this.records.get(key(type, id))?.bestScorePct ?? null;
  }

  /** All prerequisite rules of one unit are satisfied. */
  rulesSatisfied(type: UnitType, id: string): boolean {
    if (this.ignoreRules) return true;
    const rules = this.rulesByUnit.get(key(type, id)) ?? [];
    return rules.every((rule) => {
      if (!this.isCompleted(rule.requiredUnitType, rule.requiredUnitId)) return false;
      if (rule.minScorePct !== null) {
        const score = this.scoreOf(rule.requiredUnitType, rule.requiredUnitId);
        return score !== null && score >= rule.minScorePct;
      }
      return true;
    });
  }

  moduleAccessible(moduleId: string): boolean {
    return this.rulesSatisfied('MODULE', moduleId);
  }

  topicAccessible(topic: StructureTopic, module: StructureModule): boolean {
    return this.moduleAccessible(module.id) && this.rulesSatisfied('TOPIC', topic.id);
  }

  lessonAccessible(
    lesson: StructureLesson,
    topic: StructureTopic,
    module: StructureModule,
  ): boolean {
    return this.topicAccessible(topic, module) && this.rulesSatisfied('LESSON', lesson.id);
  }

  /**
   * A topic is completable when it has at least one published lesson and all
   * of them are completed. Empty (outline) topics never complete — and never
   * block their module (see moduleCompletable).
   */
  topicCompletable(topic: StructureTopic): boolean {
    const published = topic.lessons.filter((lesson) => lesson.published);
    return (
      published.length > 0 && published.every((lesson) => this.isCompleted('LESSON', lesson.id))
    );
  }

  /** A module completes when every topic that HAS content is completed. */
  moduleCompletable(module: StructureModule): boolean {
    const contentTopics = module.topics.filter((topic) =>
      topic.lessons.some((lesson) => lesson.published),
    );
    return (
      contentTopics.length > 0 &&
      contentTopics.every((topic) => this.isCompleted('TOPIC', topic.id))
    );
  }

  private effectiveStatus(type: UnitType, id: string, accessible: boolean): UnitProgress {
    const record = this.records.get(key(type, id));
    let status: EffectiveStatus;
    if (record?.status === 'COMPLETED') status = 'COMPLETED';
    else if (!accessible) status = 'LOCKED';
    else if (record?.status === 'IN_PROGRESS') status = 'IN_PROGRESS';
    else status = 'AVAILABLE';
    return { status, bestScorePct: record?.bestScorePct ?? null };
  }

  computeMap(): ProgressMap {
    const map: ProgressMap = {
      lessons: {},
      topics: {},
      modules: {},
      nextLessonId: null,
      completedLessons: 0,
      totalLessons: 0,
    };

    for (const module of [...this.structure].sort((a, b) => a.order - b.order)) {
      map.modules[module.id] = this.effectiveStatus(
        'MODULE',
        module.id,
        this.moduleAccessible(module.id),
      );

      for (const topic of [...module.topics].sort((a, b) => a.order - b.order)) {
        map.topics[topic.id] = this.effectiveStatus(
          'TOPIC',
          topic.id,
          this.topicAccessible(topic, module),
        );

        for (const lesson of [...topic.lessons].sort((a, b) => a.order - b.order)) {
          if (!lesson.published) continue;
          const progress = this.effectiveStatus(
            'LESSON',
            lesson.id,
            this.lessonAccessible(lesson, topic, module),
          );
          map.lessons[lesson.id] = progress;
          map.totalLessons++;
          if (progress.status === 'COMPLETED') map.completedLessons++;
          if (
            map.nextLessonId === null &&
            (progress.status === 'AVAILABLE' || progress.status === 'IN_PROGRESS')
          ) {
            map.nextLessonId = lesson.id;
          }
        }
      }
    }
    return map;
  }
}

/** Default rule set: strictly sequential lessons, topics, and modules. */
export function generateDefaultRules(structure: PathStructure): Rule[] {
  const rules: Rule[] = [];
  const orderedModules = [...structure].sort((a, b) => a.order - b.order);

  for (const [moduleIndex, module] of orderedModules.entries()) {
    if (moduleIndex > 0) {
      rules.push({
        unitType: 'MODULE',
        unitId: module.id,
        requiredUnitType: 'MODULE',
        requiredUnitId: orderedModules[moduleIndex - 1]!.id,
        minScorePct: null,
      });
    }
    const orderedTopics = [...module.topics].sort((a, b) => a.order - b.order);
    for (const [topicIndex, topic] of orderedTopics.entries()) {
      if (topicIndex > 0) {
        rules.push({
          unitType: 'TOPIC',
          unitId: topic.id,
          requiredUnitType: 'TOPIC',
          requiredUnitId: orderedTopics[topicIndex - 1]!.id,
          minScorePct: null,
        });
      }
      const orderedLessons = [...topic.lessons].sort((a, b) => a.order - b.order);
      for (const [lessonIndex, lesson] of orderedLessons.entries()) {
        if (lessonIndex > 0) {
          rules.push({
            unitType: 'LESSON',
            unitId: lesson.id,
            requiredUnitType: 'LESSON',
            requiredUnitId: orderedLessons[lessonIndex - 1]!.id,
            minScorePct: null,
          });
        }
      }
    }
  }
  return rules;
}
