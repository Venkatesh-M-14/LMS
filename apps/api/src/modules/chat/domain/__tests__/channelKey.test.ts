import { GROUP_CHANNEL_KEY, directChannelKey, lessonChannelKey } from '../channelKey';

describe('channel keys', () => {
  it('has a single stable group key', () => {
    expect(GROUP_CHANNEL_KEY).toBe('group');
  });

  it('namespaces lesson threads by lesson id', () => {
    expect(lessonChannelKey('lesson-1')).toBe('lesson:lesson-1');
  });

  it('produces the same DM key regardless of member order', () => {
    expect(directChannelKey('alice', 'bob')).toBe(directChannelKey('bob', 'alice'));
  });

  it('sorts ids so the DM key is deterministic', () => {
    expect(directChannelKey('bob', 'alice')).toBe('dm:alice:bob');
  });
});
