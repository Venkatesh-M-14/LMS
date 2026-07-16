import type {
  CmsLessonOverview,
  ContentBlockInput,
  CreateLessonRequest,
  LessonVersionDetail,
  LessonVersionSummary,
  SkillDto,
} from '@academy/shared';
import { apiRequest } from '../../shared/api/client';

export const cmsKeys = {
  lessons: ['cms', 'lessons'] as const,
  skills: ['cms', 'skills'] as const,
  versions: (lessonId: string) => ['cms', 'versions', lessonId] as const,
  version: (versionId: string) => ['cms', 'version', versionId] as const,
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
