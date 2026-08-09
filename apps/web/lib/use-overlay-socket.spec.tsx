import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { OVERLAY_SOCKET, OverlayAction, RuleActionType, LiveEventType } from '@livenova/shared';

// A hand-rolled socket double. socket.io-client is mocked at the module level so
// the hook can be driven event by event without a server.
const handlers = new Map<string, (payload: unknown) => void>();

interface SocketDouble {
  on: jest.Mock;
  removeAllListeners: jest.Mock;
  disconnect: jest.Mock;
  io: { reconnection: jest.Mock };
}

// The annotation is required: `on` returns the object it belongs to, which makes
// the type circular and leaves TypeScript inferring `any` (TS7022).
const socketMock: SocketDouble = {
  on: jest.fn((event: string, cb: (payload: unknown) => void) => {
    handlers.set(event, cb);
    return socketMock;
  }),
  removeAllListeners: jest.fn(),
  disconnect: jest.fn(),
  io: { reconnection: jest.fn() },
};
const ioMock = jest.fn((): SocketDouble => socketMock);

jest.mock('socket.io-client', () => ({
  io: (...args: unknown[]) => ioMock(...(args as [])),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useOverlaySocket } = require('./use-overlay-socket') as typeof import('./use-overlay-socket');

function emit(event: string, payload?: unknown) {
  act(() => {
    handlers.get(event)?.(payload);
  });
}

function makeAction(id: string): OverlayAction {
  return {
    id,
    ruleId: 'r1',
    ruleName: 'test',
    type: RuleActionType.MEDIA_POPUP,
    payload: {},
    event: { type: LiveEventType.GIFT, senderDisplayName: 'A' },
    createdAt: new Date().toISOString(),
  };
}

function Harness({ token, onAction }: { token: string | null; onAction: (a: OverlayAction) => void }) {
  const { status, rejectionCode } = useOverlaySocket(token, { onAction });
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="code">{rejectionCode ?? ''}</span>
    </div>
  );
}

describe('useOverlaySocket', () => {
  beforeEach(() => {
    handlers.clear();
    jest.clearAllMocks();
  });

  it('does not open a socket without a token', () => {
    render(<Harness token={null} onAction={jest.fn()} />);

    expect(ioMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('status')).toHaveTextContent('rejected');
    expect(screen.getByTestId('code')).toHaveTextContent('TOKEN_REQUIRED');
  });

  it('connects with the token in auth rather than the Engine.IO query string', () => {
    render(<Harness token="tok-1" onAction={jest.fn()} />);

    expect(ioMock).toHaveBeenCalledTimes(1);
    const [url, opts] = ioMock.mock.calls[0] as unknown as [string, Record<string, unknown>];

    expect(url).toContain(OVERLAY_SOCKET.NAMESPACE);
    expect(opts.auth).toEqual({ token: 'tok-1' });
    expect(opts.query).toBeUndefined();
    // Cookies must never reach the overlay namespace.
    expect(opts.withCredentials).toBe(false);
  });

  it('reports connected once the server says ready', () => {
    render(<Harness token="tok-1" onAction={jest.fn()} />);

    emit(OVERLAY_SOCKET.READY, { overlayId: 'ov-1', type: 'MEDIA' });

    expect(screen.getByTestId('status')).toHaveTextContent('connected');
  });

  it('forwards actions to the callback', () => {
    const onAction = jest.fn();
    render(<Harness token="tok-1" onAction={onAction} />);

    emit(OVERLAY_SOCKET.ACTION, makeAction('a1'));

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction.mock.calls[0][0].id).toBe('a1');
  });

  it('drops a redelivered action', () => {
    // Socket.IO replays buffered events after a reconnect. Playing the same gift
    // video twice is a visible defect on stream, so duplicates must never reach
    // the renderer.
    const onAction = jest.fn();
    render(<Harness token="tok-1" onAction={onAction} />);

    emit(OVERLAY_SOCKET.ACTION, makeAction('same'));
    emit(OVERLAY_SOCKET.ACTION, makeAction('same'));
    emit(OVERLAY_SOCKET.ACTION, makeAction('different'));

    expect(onAction).toHaveBeenCalledTimes(2);
    expect(onAction.mock.calls.map((c) => c[0].id)).toEqual(['same', 'different']);
  });

  it('ignores an action with no id', () => {
    const onAction = jest.fn();
    render(<Harness token="tok-1" onAction={onAction} />);

    emit(OVERLAY_SOCKET.ACTION, { ...makeAction('x'), id: '' });

    expect(onAction).not.toHaveBeenCalled();
  });

  it('stops retrying after the server rejects the token', () => {
    render(<Harness token="bad" onAction={jest.fn()} />);

    emit(OVERLAY_SOCKET.ERROR, { code: 'TOKEN_INVALID' });

    expect(screen.getByTestId('status')).toHaveTextContent('rejected');
    expect(screen.getByTestId('code')).toHaveTextContent('TOKEN_INVALID');
    // Hammering the server after an explicit rejection helps nobody.
    expect(socketMock.io.reconnection).toHaveBeenCalledWith(false);
  });

  it('treats a transport drop as recoverable but a server kick as final', () => {
    const { rerender } = render(<Harness token="tok-1" onAction={jest.fn()} />);

    emit('disconnect', 'transport close');
    expect(screen.getByTestId('status')).toHaveTextContent('reconnecting');

    rerender(<Harness token="tok-1" onAction={jest.fn()} />);
    emit('disconnect', 'io server disconnect');
    expect(screen.getByTestId('status')).toHaveTextContent('rejected');
  });

  it('tears the socket down on unmount', () => {
    const { unmount } = render(<Harness token="tok-1" onAction={jest.fn()} />);

    unmount();

    expect(socketMock.removeAllListeners).toHaveBeenCalled();
    expect(socketMock.disconnect).toHaveBeenCalled();
  });

  it('does not recreate the socket when only the callback identity changes', () => {
    const { rerender } = render(<Harness token="tok-1" onAction={jest.fn()} />);
    expect(ioMock).toHaveBeenCalledTimes(1);

    // A new inline arrow on every render must not tear down the connection.
    rerender(<Harness token="tok-1" onAction={jest.fn()} />);

    expect(ioMock).toHaveBeenCalledTimes(1);
    expect(socketMock.disconnect).not.toHaveBeenCalled();
  });
});
