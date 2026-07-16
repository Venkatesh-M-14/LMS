import type { LessonCompletionResult, ProgressMap } from '@academy/shared';
import { apiRequest } from '../../shared/api/client';

export const progressKeys = {
  map: ['progress', 'map'] as const,
};

export function fetchProgressMap(): Promise<ProgressMap> {
  return apiRequest('/progress/map');
}

export function markLessonComplete(lessonId: string): Promise<LessonCompletionResult> {
  return apiRequest(`/progress/lessons/${lessonId}/complete`, { method: 'POST' });
}
