import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MicNode } from './MicNode';

describe('MicNode', () => {
  let audioContext: AudioContext;
  let mockGetUserMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock AudioContext
    audioContext = {
      createGain: () => ({
        gain: { value: 1.0 },
        disconnect: vi.fn(),
        connect: vi.fn()
      }),
      createMediaStreamSource: vi.fn((stream) => ({
        connect: vi.fn(),
        disconnect: vi.fn()
      }))
    } as unknown as AudioContext;

    // Mock navigator.mediaDevices.getUserMedia
    mockGetUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }]
    });

    global.navigator = {
      mediaDevices: {
        getUserMedia: mockGetUserMedia
      }
    } as unknown as Navigator;
  });

  it('should format deviceId constraint correctly', async () => {
    const micNode = new MicNode('test-node', audioContext);

    // Update settings with a device ID
    micNode.updateSettings({ deviceId: 'test-device-id' });

    // Wait for async operation
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify getUserMedia was called with correct constraints
    expect(mockGetUserMedia).toHaveBeenCalled();

    const callArgs = mockGetUserMedia.mock.calls[mockGetUserMedia.mock.calls.length - 1];
    const constraints = callArgs[0].audio as MediaTrackConstraints;

    // The deviceId should be nested inside an object with 'exact' property
    // Correct: { deviceId: { exact: "test-device-id" } }
    // Wrong: { exact: "test-device-id" }
    expect(constraints).toHaveProperty('deviceId');
    expect(constraints.deviceId).toHaveProperty('exact', 'test-device-id');
  });

  it('should not include deviceId constraint when deviceId is not set', async () => {
    const micNode = new MicNode('test-node', audioContext);

    // Wait for initial mic setup
    await new Promise((resolve) => setTimeout(resolve, 100));

    const callArgs = mockGetUserMedia.mock.calls[mockGetUserMedia.mock.calls.length - 1];
    const constraints = callArgs[0].audio as MediaTrackConstraints;

    // When deviceId is not set, it should not be in constraints
    expect(constraints).not.toHaveProperty('exact');
    expect(constraints).not.toHaveProperty('deviceId');
  });

  it('should include other constraint properties', async () => {
    const micNode = new MicNode('test-node', audioContext);

    // Wait for initial mic setup
    await new Promise((resolve) => setTimeout(resolve, 100));

    const callArgs = mockGetUserMedia.mock.calls[mockGetUserMedia.mock.calls.length - 1];
    const constraints = callArgs[0].audio as MediaTrackConstraints;

    // Verify other constraints are present
    expect(constraints).toHaveProperty('sampleRate');
    expect(constraints).toHaveProperty('echoCancellation');
    expect(constraints).toHaveProperty('noiseSuppression');
    expect(constraints).toHaveProperty('autoGainControl');
  });
});
