/**
 * Channel keys — pure. The key is the dedupe identity of a channel, so
 * get-or-create is a single atomic upsert on a unique column rather than a
 * read-then-write race.
 */

export const GROUP_CHANNEL_KEY = 'group';

export function lessonChannelKey(lessonId: string): string {
  return `lesson:${lessonId}`;
}

/**
 * A DM key is order-independent: (a,b) and (b,a) must resolve to the same
 * channel, so the two ids are sorted before joining.
 */
export function directChannelKey(userIdA: string, userIdB: string): string {
  const [first, second] = [userIdA, userIdB].sort();
  return `dm:${first}:${second}`;
}
