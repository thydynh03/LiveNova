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
});
