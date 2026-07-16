import type { LessonRead, PathTree } from '@academy/shared';
import { apiRequest } from '../../shared/api/client';

export function fetchPathTree(): Promise<PathTree> {
  return apiRequest<PathTree>('/curriculum/path');
}

export function fetchLessonRead(lessonId: string): Promise<LessonRead> {
  return apiRequest<LessonRead>(`/curriculum/lessons/${lessonId}`);
}

export const curriculumKeys = {
  pathTree: ['curriculum', 'path'] as const,
  lesson: (lessonId: string) => ['curriculum', 'lesson', lessonId] as const,
};
