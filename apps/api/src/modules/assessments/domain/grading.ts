import {
  answerSchemaByType,
  type McqPayload,
  type MultiSelectPayload,
  type OutputMatchMode,
  type OutputPredictionPayload,
} from '@academy/shared';
import { toTypedItem, type SnapshotItem } from './snapshot';

/**
 * Pure grading logic. No I/O, no clocks — a snapshot item plus an answer in,
 * a verdict out. Every scoring rule of the platform lives in this file.
 */

export interface ItemGrade {
  /** Points earned; null while a reflection awaits manual grading. */
  autoScore: number | null;
  /** Binary correctness; null for reflections and partial credit ∈ (0,1). */
  correct: boolean | null;
  needsManual: boolean;
}

export function normalizeOutput(value: string, mode: OutputMatchMode): string {
  switch (mode) {
    case 'exact':
      return value;
    case 'trimmed':
      return value.trim();
    case 'normalized':
      return value.trim().toLowerCase().replace(/\s+/g, ' ');
  }
}

function gradeMcq(
  payload: McqPayload,
  answer: { selectedOptionId: string },
  points: number,
): ItemGrade {
  const correct = answer.selectedOptionId === payload.correctOptionId;
  return { autoScore: correct ? points : 0, correct, needsManual: false };
}

/**
 * Multi-select partial credit: (right picks − wrong picks) / total correct,
 * floored at zero. Selecting everything scores zero unless everything is
 * correct — guessing is never free.
 */
function gradeMultiSelect(
  payload: MultiSelectPayload,
  answer: { selectedOptionIds: string[] },
  points: number,
): ItemGrade {
  const correctSet = new Set(payload.correctOptionIds);
  const selected = new Set(answer.selectedOptionIds);

  let right = 0;
  let wrong = 0;
  for (const id of selected) {
    if (correctSet.has(id)) right++;
    else wrong++;
  }

  const fraction = Math.max(0, (right - wrong) / correctSet.size);
  const autoScore = roundScore(points * fraction);
  const exact = right === correctSet.size && wrong === 0;
  return { autoScore, correct: exact, needsManual: false };
}

function gradeOutputPrediction(
  payload: OutputPredictionPayload,
  answer: { predictedOutput: string },
  points: number,
): ItemGrade {
  const correct =
    normalizeOutput(answer.predictedOutput, payload.matchMode) ===
    normalizeOutput(payload.expectedOutput, payload.matchMode);
  return { autoScore: correct ? points : 0, correct, needsManual: false };
}

/**
 * Grades one snapshot item against a raw (untrusted) answer.
 * Missing or malformed answers score zero — except an ANSWERED reflection,
 * which parks the item for manual grading.
 */
export function gradeItem(item: SnapshotItem, rawAnswer: unknown): ItemGrade {
  const parsed = answerSchemaByType[item.type].safeParse(rawAnswer);
  if (!parsed.success) {
    return { autoScore: 0, correct: item.type === 'REFLECTION' ? null : false, needsManual: false };
  }

  const typed = toTypedItem(item);
  switch (typed.type) {
    case 'MCQ':
      return gradeMcq(typed.payload, parsed.data as { selectedOptionId: string }, item.points);
    case 'MULTI_SELECT':
      return gradeMultiSelect(
        typed.payload,
        parsed.data as { selectedOptionIds: string[] },
        item.points,
      );
    case 'OUTPUT_PREDICTION':
      return gradeOutputPrediction(
        typed.payload,
        parsed.data as { predictedOutput: string },
        item.points,
      );
    case 'REFLECTION': {
      const text = (parsed.data as { text: string }).text.trim();
      if (text.length === 0) {
        return { autoScore: 0, correct: null, needsManual: false };
      }
      return { autoScore: null, correct: null, needsManual: true };
    }
  }
}

export function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Final percentage, one decimal place. */
export function toScorePct(rawScore: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  return Math.round((rawScore / maxScore) * 1000) / 10;
}
