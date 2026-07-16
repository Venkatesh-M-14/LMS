/**
 * Weakness detection — pure. Given a graded attempt's items (with their skill
 * tags and whether the learner got each right), identify the skills the
 * learner struggled with. A skill is "weak" when the learner missed at least
 * one item tagged with it.
 */

export interface GradedItem {
  itemId: string;
  /** Skills tagged on this item (empty for untagged items). */
  skillIds: string[];
  /** Points earned vs available; a shortfall marks the item as missed. */
  earned: number;
  points: number;
}

export function detectWeakSkills(items: GradedItem[]): string[] {
  const weak = new Set<string>();
  for (const item of items) {
    if (item.earned < item.points) {
      for (const skillId of item.skillIds) weak.add(skillId);
    }
  }
  return [...weak];
}
