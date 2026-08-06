import { renderHook, act, waitFor } from '@testing-library/react';
import { useSpeechQueue } from './use-speech-queue';

/**
 * Minimal stand-in for HTMLAudioElement.
 *
 * Playback is driven manually so a test can hold one line open and observe what
 * the queue does with the next one.
 */
class FakeAudio {
  static instances: FakeAudio[] = [];

  volume = 1;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  paused = false;

  /** Class-level: the browser refuses every element, not one of them. */
  static autoplayBlocked = false;

  constructor(readonly src: string) {
    FakeAudio.instances.push(this);
  }

  play(): Promise<void> {
    return FakeAudio.autoplayBlocked
      ? Promise.reject(new Error('NotAllowedError'))
      : Promise.resolve();
  }

  pause() {
    this.paused = true;
  }

  finish() {
    this.onended?.();
  }

  fail() {
    this.onerror?.();
  }
}

function setup(maxQueueLength?: number) {
  FakeAudio.instances = [];
  FakeAudio.autoplayBlocked = false;
  return renderHook(() =>
    useSpeechQueue({
      maxQueueLength,
      createAudio: (src) => new FakeAudio(src) as unknown as HTMLAudioElement,
    }),
  );
}

const item = (n: number, volume = 1) => ({ id: `a${n}`, audioUrl: `u${n}`, volume });

describe('useSpeechQueue', () => {
  it('plays one line at a time rather than all at once', () => {
    const { result } = setup();

    act(() => {
      result.current.enqueue(item(1));
      result.current.enqueue(item(2));
      result.current.enqueue(item(3));
    });

    // Two Audio elements playing together are two voices over the broadcast.
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].src).toBe('u1');
  });

  it('advances in order as each line ends', () => {
    const { result } = setup();

    act(() => {
      result.current.enqueue(item(1));
      result.current.enqueue(item(2));
    });
    act(() => FakeAudio.instances[0].finish());

    expect(FakeAudio.instances.map((a) => a.src)).toEqual(['u1', 'u2']);
  });

  it('does not wedge the queue when a line fails to decode', () => {
    const { result } = setup();

    act(() => {
      result.current.enqueue(item(1));
      result.current.enqueue(item(2));
    });
    act(() => FakeAudio.instances[0].fail());

    // Without the error handler every later line is silenced for good.
    expect(FakeAudio.instances.map((a) => a.src)).toEqual(['u1', 'u2']);
  });

  it('drops the oldest waiting lines instead of growing without bound', () => {
    const { result } = setup(2);

    act(() => {
      for (let i = 1; i <= 6; i += 1) result.current.enqueue(item(i));
    });

    // One is playing; at most two wait. Otherwise a gift rush has the overlay
    // reading a comment from minutes ago.
    expect(result.current.pending()).toBe(2);

    act(() => FakeAudio.instances[0].finish());
    expect(FakeAudio.instances[1].src).toBe('u5');
  });

  it('ignores a dispatch id it has already spoken', () => {
    const { result } = setup();

    act(() => {
      result.current.enqueue(item(1));
      result.current.enqueue(item(1));
    });

    expect(FakeAudio.instances).toHaveLength(1);
  });

  it('applies the configured volume, clamped', () => {
    const { result } = setup();

    act(() => result.current.enqueue(item(1, 5)));

    expect(FakeAudio.instances[0].volume).toBe(1);
  });

  it('reports blocked autoplay rather than failing silently', async () => {
    const { result } = setup();

    // What a streamer hits previewing the overlay URL in a normal browser tab.
    FakeAudio.autoplayBlocked = true;
    act(() => {
      result.current.enqueue(item(1));
    });

    // The warning must survive the queue draining. Reporting it per line let
    // 'idle' overwrite it milliseconds later, so nothing ever reached the UI.
    await waitFor(() => expect(result.current.status).toBe('blocked'));
  });

  it('stops playback on unmount', () => {
    const { result, unmount } = setup();

    act(() => result.current.enqueue(item(1)));
    unmount();

    expect(FakeAudio.instances[0].paused).toBe(true);
  });
});
