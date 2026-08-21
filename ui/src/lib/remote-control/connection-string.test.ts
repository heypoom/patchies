import { describe, expect, it } from 'vitest';
import { createConnectionString } from './connection-string';

describe('remote control connection string', () => {
  it('normalizes the instance URL into a versioned opaque payload', () => {
    const value = createConnectionString({
      instanceURL: 'https://patchies.example.com/editor?preview=true',
      sessionID: 'session-id',
      secret: 'secret-value'
    });

    expect(value).toMatch(/^patchies:\/\/v1\/[A-Za-z0-9_-]+$/);
    expect(value).not.toContain('secret-value');
  });
});
