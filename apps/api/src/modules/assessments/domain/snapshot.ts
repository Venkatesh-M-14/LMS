import { z } from 'zod';
import {
  assessmentItemPayloadSchema,
  toStudentPayload,
  type AssessmentItemPayload,
  type StudentItemView,
} from '@academy/shared';

/**
 * The shape frozen into Attempt.itemsSnapshot at start. Contains answer keys —
 * it must never leave the server unsanitized (use toStudentItems).
 */
export const snapshotItemSchema = z.object({
  itemId: z.string(),
  order: z.number().int(),
  type: z.enum(['MCQ', 'MULTI_SELECT', 'OUTPUT_PREDICTION', 'REFLECTION']),
  points: z.number().int().min(1),
  payload: z.unknown(),
});
export type SnapshotItem = z.infer<typeof snapshotItemSchema>;

export const snapshotSchema = z.array(snapshotItemSchema);

export function parseSnapshot(raw: unknown): SnapshotItem[] {
  return snapshotSchema.parse(raw);
}

/** Re-validates a snapshot item's payload into the typed discriminated union. */
export function toTypedItem(item: SnapshotItem): AssessmentItemPayload {
  return assessmentItemPayloadSchema.parse({ type: item.type, payload: item.payload });
}

export function toStudentItems(snapshot: SnapshotItem[]): StudentItemView[] {
  return [...snapshot]
    .sort((a, b) => a.order - b.order)
    .map((item) => ({
      itemId: item.itemId,
      order: item.order,
      type: item.type,
      points: item.points,
      payload: toStudentPayload(toTypedItem(item)),
    }));
}
