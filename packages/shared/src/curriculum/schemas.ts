import { z } from 'zod';
import { contentBlockDtoSchema } from '../content/blocks';

export const topicDepthSchema = z.enum(['AUTHORED', 'OUTLINE']);
export type TopicDepth = z.infer<typeof topicDepthSchema>;

export const lessonVersionStatusSchema = z.enum(['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED']);
export type LessonVersionStatus = z.infer<typeof lessonVersionStatusSchema>;

export const skillDtoSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
});
export type SkillDto = z.infer<typeof skillDtoSchema>;

// ── Student-facing curriculum tree ──────────────────────────────────────────

export const lessonSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  order: z.number().int(),
  estimatedMinutes: z.number().int(),
  /** Students only ever see lessons that have a published version. */
  isPublished: z.boolean(),
});
export type LessonSummary = z.infer<typeof lessonSummarySchema>;

export const topicSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  order: z.number().int(),
  depth: topicDepthSchema,
  lessons: z.array(lessonSummarySchema),
});
export type TopicSummary = z.infer<typeof topicSummarySchema>;

export const moduleSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  order: z.number().int(),
  topics: z.array(topicSummarySchema),
});
export type ModuleSummary = z.infer<typeof moduleSummarySchema>;

export const pathTreeSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  modules: z.array(moduleSummarySchema),
});
export type PathTree = z.infer<typeof pathTreeSchema>;

/** The published content a student reads. Pinned to a concrete version id. */
export const lessonReadSchema = z.object({
  lessonId: z.string(),
  versionId: z.string(),
  versionNumber: z.number().int(),
  slug: z.string(),
  title: z.string(),
  estimatedMinutes: z.number().int(),
  topic: z.object({ id: z.string(), slug: z.string(), title: z.string() }),
  module: z.object({ id: z.string(), slug: z.string(), title: z.string() }),
  skills: z.array(skillDtoSchema),
  blocks: z.array(contentBlockDtoSchema),
  publishedAt: z.string().datetime(),
});
export type LessonRead = z.infer<typeof lessonReadSchema>;
