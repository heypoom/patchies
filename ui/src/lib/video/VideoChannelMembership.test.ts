import { describe, expect, it } from 'vitest';

import { VideoChannelMembership } from './VideoChannelMembership';

describe('VideoChannelMembership', () => {
  it('tracks senders and receivers by channel', () => {
    const membership = new VideoChannelMembership();

    membership.subscribe('main', 'send-1', 'send');
    membership.subscribe('main', 'recv-1', 'recv');

    expect(membership.getChannel('main')).toEqual({
      senders: new Set(['send-1']),
      receivers: new Set(['recv-1'])
    });
  });

  it('removes empty channels and reports unsubscribeAll changes', () => {
    const membership = new VideoChannelMembership();

    membership.subscribe('main', 'send-1', 'send');
    membership.subscribe('main', 'recv-1', 'recv');

    expect(membership.unsubscribeAll('send-1')).toBe(true);
    expect(membership.getChannel('main')).toEqual({
      senders: new Set(),
      receivers: new Set(['recv-1'])
    });

    expect(membership.unsubscribeAll('missing')).toBe(false);
    expect(membership.unsubscribeAll('recv-1')).toBe(true);
    expect(membership.getChannel('main')).toBeUndefined();
  });
});
