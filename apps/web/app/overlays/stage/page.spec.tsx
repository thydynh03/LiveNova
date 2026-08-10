import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { OverlayAction, RuleActionType, StageEffectKind } from '@livenova/shared';

/** Captures the page's onAction so a test can push actions at it directly. */
let pushAction: (action: OverlayAction) => void = () => {};

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('token=tok-123'),
}));

jest.mock('../../../lib/use-overlay-socket', () => ({
  useOverlaySocket: (_token: string | null, opts: { onAction: (a: OverlayAction) => void }) => {
    pushAction = opts.onAction;
    return { status: 'connected', ready: null, rejectionCode: null };
  },
}));

/**
 * Lớp nhân vật cần WebGL, thứ jsdom không có. Thay bằng một bản giả ghi lại
 * prop nhận được: phần đáng kiểm ở đây là *cái gì* tới được lớp đó, không phải
 * việc dựng hình.
 */
let lastAvatarProps: { motion: { id: string } | null; modelUrl?: string } | null = null;
jest.mock('../../../components/overlays/VrmAvatarLayer', () => ({
  VrmAvatarLayer: (props: { motion: { id: string } | null; modelUrl?: string }) => {
    lastAvatarProps = props;
    return <div data-testid="vrm-avatar-layer-stub" />;
  },
}));

import StageOverlayPage from './page';

function effectAction(payload: Record<string, unknown>, id = 'act-1'): OverlayAction {
  return {
    id,
    ruleId: 'r1',
    ruleName: 'Hiệu ứng',
    type: RuleActionType.EFFECT,
    payload,
    event: {
      type: 'gift' as never,
      senderDisplayName: 'Ngọc Hân',
    },
    createdAt: new Date().toISOString(),
  };
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }),
  });
  // jsdom has no canvas backend; EffectLayer bails out of its draw loop when
  // getContext returns null, which is exactly what we want under test.
  HTMLCanvasElement.prototype.getContext = jest.fn(() => null) as never;

  // This jsdom build has no fetch. The page reads its own overlay config to
  // find the uploaded VRM model, so without a stub every test here dies on a
  // ReferenceError thrown before any promise exists to catch it.
  (global as unknown as { fetch: unknown }).fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ config: {} }) }),
  );
});

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('StageOverlayPage', () => {
  it('renders a caption as text, never as markup', () => {
    render(<StageOverlayPage />);

    // Captions interpolate {sender}, so this string is viewer-controlled. The
    // reference implementation this feature was modelled on built the same
    // widget by concatenating HTML and shipped a stored XSS as a result.
    const hostile = '<img src=x onerror="document.title=\'pwned\'">';

    act(() => {
      pushAction(effectAction({ kind: StageEffectKind.CONFETTI, caption: hostile }));
    });

    expect(screen.getByText(hostile)).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
    expect(document.title).not.toBe('pwned');
  });

  it('ignores actions that are not effects', () => {
    render(<StageOverlayPage />);

    act(() => {
      pushAction({
        ...effectAction({ kind: StageEffectKind.CONFETTI, caption: 'nên bỏ qua' }),
        type: RuleActionType.MEDIA_POPUP,
      });
    });

    expect(screen.queryByText('nên bỏ qua')).not.toBeInTheDocument();
  });

  it('drops an effect whose kind is not a real effect', () => {
    render(<StageOverlayPage />);

    act(() => {
      pushAction(effectAction({ kind: 'lasers', caption: 'không có thật' }));
    });

    expect(screen.queryByText('không có thật')).not.toBeInTheDocument();
  });

  it('removes the effect once its duration elapses', () => {
    render(<StageOverlayPage />);

    act(() => {
      pushAction(
        effectAction({ kind: StageEffectKind.CONFETTI, durationMs: 1000, caption: 'tạm thời' }),
      );
    });
    expect(screen.getByText('tạm thời')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.queryByText('tạm thời')).not.toBeInTheDocument();
  });

  it('keeps at most MAX_CONCURRENT effects, dropping the oldest', () => {
    render(<StageOverlayPage />);

    act(() => {
      for (let i = 0; i < 6; i++) {
        pushAction(
          effectAction(
            { kind: StageEffectKind.CONFETTI, durationMs: 15_000, caption: `hiệu ứng ${i}` },
            `act-${i}`,
          ),
        );
      }
    });

    // Oldest two evicted, newest four kept.
    expect(screen.queryByText('hiệu ứng 0')).not.toBeInTheDocument();
    expect(screen.queryByText('hiệu ứng 1')).not.toBeInTheDocument();
    expect(screen.getByText('hiệu ứng 2')).toBeInTheDocument();
    expect(screen.getByText('hiệu ứng 5')).toBeInTheDocument();
  });

  it('clamps a runaway duration the server never saw', () => {
    render(<StageOverlayPage />);

    act(() => {
      pushAction(
        effectAction({
          kind: StageEffectKind.SMOKE,
          durationMs: 999_999_999,
          caption: 'phải tự tắt',
        }),
      );
    });

    act(() => {
      jest.advanceTimersByTime(15_000);
    });
    expect(screen.queryByText('phải tự tắt')).not.toBeInTheDocument();
  });

  it('shakes within the amplitude cap and not beyond it', () => {
    const { container } = render(<StageOverlayPage />);

    act(() => {
      pushAction(effectAction({ kind: StageEffectKind.SHAKE, intensity: 1, durationMs: 5000 }));
    });

    const root = container.querySelector('[data-testid="stage-shake-root"]') as HTMLElement;
    expect(root.style.getPropertyValue('--ln-amp')).toBe('12');
  });

  describe('avatar motion', () => {
    function motionAction(payload: Record<string, unknown>, id = 'mot-1'): OverlayAction {
      return {
        id,
        ruleId: 'r2',
        ruleName: 'Quà thì vẫy tay',
        type: RuleActionType.AVATAR_MOTION,
        payload,
        event: { type: 'gift' as never, senderDisplayName: 'Ngọc Hân' },
        createdAt: new Date().toISOString(),
      };
    }

    it('plays a motion and mounts the avatar layer on the first one', async () => {
      render(<StageOverlayPage />);
      expect(screen.queryByTestId('vrm-avatar-layer-stub')).not.toBeInTheDocument();

      await act(async () => {
        pushAction(motionAction({ clip: 'wave', durationMs: 2000 }));
      });

      expect(screen.getByTestId('vrm-avatar-layer-stub')).toBeInTheDocument();
      expect(lastAvatarProps?.motion?.id).toBe('mot-1');
    });

    it('ignores a motion whose clip does not exist', async () => {
      render(<StageOverlayPage />);

      await act(async () => {
        pushAction(motionAction({ clip: 'moonwalk' }));
      });

      expect(screen.queryByTestId('vrm-avatar-layer-stub')).not.toBeInTheDocument();
    });

    it('plays a replayed action only once', async () => {
      // Reconnecting replays recent actions. Without the id filter the
      // character re-performs the whole backlog every time the network blips.
      render(<StageOverlayPage />);

      await act(async () => {
        pushAction(motionAction({ clip: 'wave' }, 'same-id'));
      });
      const first = lastAvatarProps?.motion;

      await act(async () => {
        pushAction(motionAction({ clip: 'bow' }, 'same-id'));
      });

      expect(lastAvatarProps?.motion).toBe(first);
    });

    it('uses the model URL stored on the overlay config', async () => {
      (global as unknown as { fetch: jest.Mock }).fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ config: { vrmModelUrl: 'https://cdn.example.com/mine.vrm' } }),
      });

      render(<StageOverlayPage />);
      await act(async () => {
        pushAction(motionAction({ clip: 'wave' }));
      });

      expect(lastAvatarProps?.modelUrl).toBe('https://cdn.example.com/mine.vrm');
    });
  });
});
