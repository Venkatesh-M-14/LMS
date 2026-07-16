import type {
  AssessmentAuthoringView,
  AssessmentItemPayload,
  ChallengeSummary,
  CodingPayload,
  UpsertAssessmentRequest,
} from '@academy/shared';
import type { SnapshotItem } from '../domain/snapshot';

export interface AssessmentRecord {
  id: string;
  lessonId: string | null;
  title: string;
  passingScorePct: number;
  maxAttempts: number | null;
  cooldownMinutes: number;
  shuffleItems: boolean;
}

export interface ItemRecord {
  id: string;
  order: number;
  type: 'MCQ' | 'MULTI_SELECT' | 'OUTPUT_PREDICTION' | 'REFLECTION' | 'CODING' | 'DEBUGGING';
  points: number;
  payload: unknown;
}

export interface AuthoringItemInput {
  points: number;
  skillIds: string[];
  item: AssessmentItemPayload;
}

export interface AssessmentRepository {
  findByLessonId(lessonId: string): Promise<AssessmentRecord | null>;
  findById(assessmentId: string): Promise<AssessmentRecord | null>;
  listItems(assessmentId: string): Promise<ItemRecord[]>;
  getAuthoringView(lessonId: string): Promise<AssessmentAuthoringView | null>;
  upsertForLesson(lessonId: string, settings: UpsertAssessmentRequest): Promise<AssessmentRecord>;
  replaceItems(assessmentId: string, items: AuthoringItemInput[]): Promise<void>;
  /**
   * Appends one item at the end of the bank without disturbing the others —
   * how an accepted student draft (M10) joins the quiz.
   */
  appendItem(assessmentId: string, item: AuthoringItemInput): Promise<{ id: string }>;
  /** currentPublishedVersionId of the lesson the assessment hangs off (pin). */
  getLessonPublishedVersionId(lessonId: string): Promise<string | null>;
  /**
   * The full challenge (instructions, starter files, ALL tests — hidden
   * included, solutions excluded) for freezing into an attempt snapshot.
   */
  getChallengeFreeze(challengeId: string): Promise<CodingPayload | null>;
  listChallenges(): Promise<ChallengeSummary[]>;
}

export interface RunRecord {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'TIMEOUT' | 'ERROR';
  resultsJson: unknown;
  stdout: string;
  errorMessage: string;
  durationMs: number | null;
}

export interface SubmissionRecord {
  id: string;
  itemId: string;
  answer: unknown;
  autoScore: number | null;
  manualScore: number | null;
  graderFeedback: string;
  /** Most recent judge run, if this submission was ever judged. */
  latestRun?: RunRecord | null;
}

export interface AttemptRecord {
  id: string;
  userId: string;
  assessmentId: string;
  attemptNumber: number;
  status: 'IN_PROGRESS' | 'GRADING' | 'GRADED';
  passed: boolean | null;
  scorePct: number | null;
  rawScore: number | null;
  maxScore: number | null;
  itemsSnapshot: unknown;
  startedAt: Date;
  submittedAt: Date | null;
  gradedAt: Date | null;
  submissions: SubmissionRecord[];
}

export interface AttemptFactsRecord {
  id: string;
  status: 'IN_PROGRESS' | 'GRADING' | 'GRADED';
  scorePct: number | null;
  passed: boolean | null;
  submittedAt: Date | null;
}

export interface GradeWrite {
  itemId: string;
  answer: unknown;
  autoScore: number | null;
}

export interface FinalizeWrite {
  status: 'GRADING' | 'GRADED';
  rawScore: number | null;
  maxScore: number | null;
  scorePct: number | null;
  passed: boolean | null;
  submittedAt: Date;
  gradedAt: Date | null;
}

export interface AttemptRepository {
  listFacts(userId: string, assessmentId: string): Promise<AttemptFactsRecord[]>;
  findById(attemptId: string): Promise<AttemptRecord | null>;
  create(input: {
    userId: string;
    assessmentId: string;
    attemptNumber: number;
    itemsSnapshot: SnapshotItem[];
    lessonVersionId: string | null;
  }): Promise<AttemptRecord>;
  upsertAnswers(
    attemptId: string,
    answers: Array<{ itemId: string; answer: unknown }>,
  ): Promise<void>;
  /** Atomically writes grades for every item and the attempt's final state. */
  applyGrading(attemptId: string, grades: GradeWrite[], finalize: FinalizeWrite): Promise<void>;

  // ── Judge runs ────────────────────────────────────────────────────────────
  createExecutionRun(
    itemSubmissionId: string,
    files: Record<string, string>,
  ): Promise<{ id: string }>;
  /** Claims a QUEUED run (sets RUNNING); returns null if already claimed/missing. */
  claimRun(runId: string): Promise<{
    runId: string;
    submissionId: string;
    attemptId: string;
    itemId: string;
    files: Record<string, string>;
  } | null>;
  /** Atomically: finish the run AND write the submission's autoScore. */
  completeRun(
    runId: string,
    submissionId: string,
    data: {
      status: 'PASSED' | 'FAILED' | 'TIMEOUT' | 'ERROR';
      resultsJson: unknown;
      stdout: string;
      errorMessage: string;
      durationMs: number;
      autoScore: number;
    },
  ): Promise<void>;
}

/** Enqueue port — implemented by the BullMQ adapter. */
export interface JudgeQueuePort {
  enqueue(runId: string): Promise<void>;
}

export interface GradingQueueRow {
  attemptId: string;
  assessmentTitle: string;
  lessonTitle: string | null;
  studentName: string;
  submittedAt: Date;
  pendingItems: number;
}

export interface GradingDetailRow {
  attempt: AttemptRecord;
  studentName: string;
  assessmentTitle: string;
  lessonTitle: string | null;
}

export interface GradingRepository {
  listQueue(): Promise<GradingQueueRow[]>;
  getDetail(attemptId: string): Promise<GradingDetailRow | null>;
  findSubmission(submissionId: string): Promise<(SubmissionRecord & { attemptId: string }) | null>;
  setManualScore(
    submissionId: string,
    graderId: string,
    score: number,
    feedback: string,
    gradedAt: Date,
  ): Promise<void>;
  finalizeAttempt(attemptId: string, finalize: Omit<FinalizeWrite, 'submittedAt'>): Promise<void>;
}
