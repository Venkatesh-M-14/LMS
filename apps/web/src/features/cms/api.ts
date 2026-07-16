import type {
  AssessmentAuthoringView,
  ChallengeSummary,
  CmsLessonOverview,
  ContentBlockInput,
  CreateLessonRequest,
  GradeSubmissionRequest,
  GradingAttemptDetail,
  GradingQueueEntry,
  LessonVersionDetail,
  LessonVersionSummary,
  ReplaceItemsRequest,
  SkillDto,
  UpsertAssessmentRequest,
} from '@academy/shared';
import { apiRequest } from '../../shared/api/client';

export const cmsKeys = {
  lessons: ['cms', 'lessons'] as const,
  skills: ['cms', 'skills'] as const,
  versions: (lessonId: string) => ['cms', 'versions', lessonId] as const,
  version: (versionId: string) => ['cms', 'version', versionId] as const,
  assessment: (lessonId: string) => ['cms', 'assessment', lessonId] as const,
  challenges: ['cms', 'challenges'] as const,
  gradingQueue: ['cms', 'grading'] as const,
  gradingDetail: (attemptId: string) => ['cms', 'grading', attemptId] as const,
};

export function fetchCmsLessons(): Promise<CmsLessonOverview[]> {
  return apiRequest('/cms/lessons');
}

export function fetchSkills(): Promise<SkillDto[]> {
  return apiRequest('/cms/skills');
}

export function createLesson(input: CreateLessonRequest): Promise<CmsLessonOverview> {
  return apiRequest('/cms/lessons', { method: 'POST', body: input });
}

export function setLessonSkills(lessonId: string, skillIds: string[]): Promise<void> {
  return apiRequest(`/cms/lessons/${lessonId}/skills`, { method: 'PUT', body: { skillIds } });
}

export function fetchVersions(lessonId: string): Promise<LessonVersionSummary[]> {
  return apiRequest(`/cms/lessons/${lessonId}/versions`);
}

export function createDraft(lessonId: string, changelog: string): Promise<LessonVersionDetail> {
  return apiRequest(`/cms/lessons/${lessonId}/versions`, { method: 'POST', body: { changelog } });
}

export function fetchVersionDetail(versionId: string): Promise<LessonVersionDetail> {
  return apiRequest(`/cms/lesson-versions/${versionId}`);
}

export function replaceBlocks(
  versionId: string,
  blocks: ContentBlockInput[],
): Promise<LessonVersionDetail> {
  return apiRequest(`/cms/lesson-versions/${versionId}/blocks`, {
    method: 'PUT',
    body: { blocks },
  });
}

export function submitVersion(versionId: string): Promise<LessonVersionDetail> {
  return apiRequest(`/cms/lesson-versions/${versionId}/submit`, { method: 'POST' });
}

export function publishVersion(versionId: string): Promise<LessonVersionDetail> {
  return apiRequest(`/cms/lesson-versions/${versionId}/publish`, { method: 'POST' });
}

export function rejectVersion(
  versionId: string,
  reviewNotes: string,
): Promise<LessonVersionDetail> {
  return apiRequest(`/cms/lesson-versions/${versionId}/reject`, {
    method: 'POST',
    body: { reviewNotes },
  });
}

// ── Assessments & grading ───────────────────────────────────────────────────

export function fetchLessonAssessment(lessonId: string): Promise<AssessmentAuthoringView | null> {
  return apiRequest(`/cms/lessons/${lessonId}/assessment`);
}

export function upsertLessonAssessment(
  lessonId: string,
  settings: UpsertAssessmentRequest,
): Promise<AssessmentAuthoringView> {
  return apiRequest(`/cms/lessons/${lessonId}/assessment`, { method: 'PUT', body: settings });
}

export function replaceAssessmentItems(
  assessmentId: string,
  request: ReplaceItemsRequest,
): Promise<void> {
  return apiRequest(`/cms/assessments/${assessmentId}/items`, { method: 'PUT', body: request });
}

export function fetchChallenges(): Promise<ChallengeSummary[]> {
  return apiRequest('/cms/challenges');
}

export function fetchGradingQueue(): Promise<GradingQueueEntry[]> {
  return apiRequest('/cms/grading');
}

export function fetchGradingDetail(attemptId: string): Promise<GradingAttemptDetail> {
  return apiRequest(`/cms/grading/${attemptId}`);
}

export function gradeSubmission(
  submissionId: string,
  request: GradeSubmissionRequest,
): Promise<void> {
  return apiRequest(`/cms/grading/submissions/${submissionId}`, {
    method: 'POST',
    body: request,
  });
}
