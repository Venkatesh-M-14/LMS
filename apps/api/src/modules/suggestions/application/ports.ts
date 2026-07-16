import type { SuggestionStatus, SuggestionView } from '@academy/shared';
import type { AuthoringItemInput } from '../../assessments/application/ports';

export interface CreateSuggestionInput {
  userId: string;
  kind: 'IDEA' | 'DRAFT_QUESTION';
  lessonId: string | null;
  body: string;
  draft: AuthoringItemInput | null;
}

export interface SuggestionRow {
  id: string;
  userId: string;
  kind: 'IDEA' | 'DRAFT_QUESTION';
  lessonId: string | null;
  status: SuggestionStatus;
  draft: AuthoringItemInput | null;
}

export interface SuggestionRepository {
  create(input: CreateSuggestionInput): Promise<SuggestionView>;
  getRowById(id: string): Promise<SuggestionRow | null>;
  /** The author's own suggestions, newest first. */
  listMine(userId: string): Promise<SuggestionView[]>;
  /** The admin review queue — PENDING first, then recently reviewed. */
  listForReview(status: SuggestionStatus | null): Promise<SuggestionView[]>;
  /** Guarded transition: only a PENDING row can be reviewed (returns false otherwise). */
  markReviewed(input: {
    id: string;
    reviewerId: string;
    accepted: boolean;
    adminNote: string | null;
    createdItemId: string | null;
  }): Promise<boolean>;
  authorName(userId: string): Promise<string | null>;
}
