'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface SpeechItem {
  /** Dispatch id, used to drop repeats after a socket reconnect. */
  id: string;
  audioUrl: string;
  /** 0..1 */
  volume: number;
}

export type SpeechStatus = 'idle' | 'speaking' | 'blocked';

interface Options {
  /**
   * Beyond this many waiting lines the oldest are dropped.
   *
   * A gift rush can queue faster than speech plays, and a queue that only grows
   * ends up reading out a comment from four minutes ago over a live broadcast.
   * Dropping the oldest keeps what is spoken close to what is happening.
   */
  maxQueueLength?: number;
  /** Injectable for tests; defaults to the real Audio constructor. */
  createAudio?: (src: string) => HTMLAudioElement;
}

/**
 * Plays synthesised speech one line at a time.
 *
 * The server hands the overlay a ready audio URL, so this only has to sequence
 * playback. Sequencing matters: two overlapping `Audio` elements produce two
 * voices talking over each other on the stream, which is worse than silence.
 */
export function useSpeechQueue(options: Options = {}) {
  const { maxQueueLength = 8, createAudio } = options;

  const [status, setStatus] = useState<SpeechStatus>('idle');
  const queue = useRef<SpeechItem[]>([]);
  const playing = useRef(false);
  const current = useRef<HTMLAudioElement | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const mounted = useRef(true);

  /**
   * Sticky, unlike `speaking`/`idle`.
   *
   * Autoplay refusal is a property of the page, not of one line. Reporting it
   * per line meant the warning was overwritten by `idle` a few milliseconds
   * later and the streamer never saw why the overlay was silent. It clears only
   * when a line actually plays.
   */
  const blocked = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      current.current?.pause();
      current.current = null;
      queue.current = [];
    };
  }, []);

  const playNext = useCallback(() => {
    if (playing.current) return;

    const next = queue.current.shift();
    if (!next) {
      if (mounted.current && !blocked.current) setStatus('idle');
      return;
    }

    playing.current = true;
    if (mounted.current && !blocked.current) setStatus('speaking');

    const audio = createAudio ? createAudio(next.audioUrl) : new Audio(next.audioUrl);
    audio.volume = Math.min(Math.max(next.volume, 0), 1);
    current.current = audio;

    const done = () => {
      playing.current = false;
      current.current = null;
      playNext();
    };

    audio.onended = done;
    // A decode failure must not wedge the queue: one unplayable line would
    // otherwise silence every line after it for the rest of the broadcast.
    audio.onerror = done;

    void Promise.resolve(audio.play())
      .then(() => {
        if (blocked.current) {
          blocked.current = false;
          if (mounted.current) setStatus('speaking');
        }
      })
      .catch(() => {
        // Autoplay is permitted in an OBS browser source but blocked in a normal
        // tab without a prior gesture. Say so rather than failing silently, since
        // the streamer is most likely previewing the URL in their own browser.
        blocked.current = true;
        if (mounted.current) setStatus('blocked');
        done();
      });
  }, [createAudio]);

  const enqueue = useCallback(
    (item: SpeechItem) => {
      // Socket.IO replays nothing on reconnect, but the server may redeliver a
      // dispatch; the id makes that harmless.
      if (seen.current.has(item.id)) return;
      seen.current.add(item.id);

      queue.current.push(item);
      if (queue.current.length > maxQueueLength) {
        queue.current.splice(0, queue.current.length - maxQueueLength);
      }
      playNext();
    },
    [maxQueueLength, playNext],
  );

  const pending = () => queue.current.length;

  return { enqueue, status, pending };
}
