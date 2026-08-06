import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { EVENTS_SOCKET, LiveEvent, LiveEventType } from '@livenova/shared';
// jest.mock calls below are hoisted above these imports by the transform, so
// the mocks are registered before the hook module is evaluated.
import { useEventsSocket } from './use-events-socket';

const handlers = new Map<string, (payload: unknown) => void>();

interface SocketDouble {
  on: jest.Mock;
  emit: jest.Mock;
  removeAllListeners: jest.Mock;
  disconnect: jest.Mock;
  io: { reconnection: jest.Mock };
}

const socketMock: SocketDouble = {
  on: jest.fn((event: string, cb: (payload: unknown) => void) => {
    handlers.set(event, cb);
    return socketMock;
  }),
  emit: jest.fn(),
  removeAllListeners: jest.fn(),
  disconnect: jest.fn(),
  io: { reconnection: jest.fn() },
};
const ioMock = jest.fn((): SocketDouble => socketMock);

jest.mock('socket.io-client', () => ({
  io: (...args: unknown[]) => ioMock(...(args as [])),
}));

let currentToken: string | null = 'access-token';
const restoreSessionMock = jest.fn<Promise<string | null>, []>();
jest.mock('./api-client', () => ({
  getAccessToken: () => currentToken,
  restoreSession: () => restoreSessionMock(),
}));


function emit(event: string, payload?: unknown) {
  act(() => {
    handlers.get(event)?.(payload);
  });
}

function makeEvent(id: string): LiveEvent {
  return {
    id,
    type: LiveEventType.GIFT,
    channelId: 'ch-1',
    senderUsername: 'a',
    senderDisplayName: 'A',
    occurredAt: new Date(),
  };
}

function Harness({
  channelIds,
  onEvent,
}: {
  channelIds: string[];
  onEvent: (e: LiveEvent) => void;
}) {
  const { status, subscribed } = useEventsSocket({ channelIds, onEvent });
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="subscribed">{subscribed.join(',')}</span>
    </div>
  );
}

describe('useEventsSocket', () => {
  beforeEach(() => {
    handlers.clear();
    jest.clearAllMocks();
    currentToken = 'access-token';
    restoreSessionMock.mockResolvedValue('refreshed-token');
    (socketMock as unknown as { connected: boolean }).connected = true;
  });

  it('authenticates with the JWT once connected', () => {
    render(<Harness channelIds={['ch-1']} onEvent={jest.fn()} />);

    emit('connect');

    expect(socketMock.emit).toHaveBeenCalledWith(EVENTS_SOCKET.AUTHENTICATE, {
      token: 'access-token',
    });
    expect(screen.getByTestId('status')).toHaveTextContent('authenticating');
  });

  it('subscribes only after the server confirms authentication', () => {
    render(<Harness channelIds={['ch-1', 'ch-2']} onEvent={jest.fn()} />);

    emit('connect');
    expect(socketMock.emit).not.toHaveBeenCalledWith(
      EVENTS_SOCKET.SUBSCRIBE_CHANNEL,
      'ch-1',
    );

    emit('authenticated');

    expect(socketMock.emit).toHaveBeenCalledWith(EVENTS_SOCKET.SUBSCRIBE_CHANNEL, 'ch-1');
    expect(socketMock.emit).toHaveBeenCalledWith(EVENTS_SOCKET.SUBSCRIBE_CHANNEL, 'ch-2');
    expect(screen.getByTestId('status')).toHaveTextContent('connected');
  });

  it('re-authenticates and re-subscribes after a reconnect', () => {
    // Socket.IO restores the transport, but the server keeps no memory of who a
    // socket was. A client that skipped this would sit connected and silent —
    // the worst failure mode, because it looks healthy.
    render(<Harness channelIds={['ch-1']} onEvent={jest.fn()} />);

    emit('connect');
    emit('authenticated');
    emit('subscribed', { channelId: 'ch-1' });
    socketMock.emit.mockClear();

    emit('disconnect', 'transport close');
    expect(screen.getByTestId('status')).toHaveTextContent('reconnecting');
    expect(screen.getByTestId('subscribed')).toHaveTextContent('');

    emit('connect');
    expect(socketMock.emit).toHaveBeenCalledWith(EVENTS_SOCKET.AUTHENTICATE, {
      token: 'access-token',
    });

    emit('authenticated');
    expect(socketMock.emit).toHaveBeenCalledWith(EVENTS_SOCKET.SUBSCRIBE_CHANNEL, 'ch-1');
  });

  it('reads the token at connect time, not at render time', () => {
    // A token refreshed between renders must not leave this holding a stale one.
    render(<Harness channelIds={['ch-1']} onEvent={jest.fn()} />);

    currentToken = 'rotated-token';
    emit('connect');

    expect(socketMock.emit).toHaveBeenCalledWith(EVENTS_SOCKET.AUTHENTICATE, {
      token: 'rotated-token',
    });
  });

  it('reports unauthorized when there is no token', () => {
    currentToken = null;
    render(<Harness channelIds={['ch-1']} onEvent={jest.fn()} />);

    emit('connect');

    expect(screen.getByTestId('status')).toHaveTextContent('unauthorized');
    expect(socketMock.emit).not.toHaveBeenCalled();
  });

  it('does not treat a rejected token as terminal on the first attempt', async () => {
    // This test previously asserted the opposite. That encoded the very bug
    // review found: a token rejected once was treated as a dead session, so a
    // reconnect after the 15-minute access-token TTL killed the feed for good.
    // The terminal path is now covered in 'token expiry on reconnect' below,
    // after the refresh has actually been tried and failed.
    render(<Harness channelIds={['ch-1']} onEvent={jest.fn()} />);

    emit('connect');
    await act(async () => {
      handlers.get('error')?.({ code: 'AUTH_INVALID' });
    });

    expect(restoreSessionMock).toHaveBeenCalled();
    expect(screen.getByTestId('status')).not.toHaveTextContent('unauthorized');
  });

  it('does not stop retrying on a non-auth error', () => {
    render(<Harness channelIds={['ch-1']} onEvent={jest.fn()} />);

    emit('connect');
    emit('error', { code: 'FORBIDDEN' });

    expect(socketMock.io.reconnection).not.toHaveBeenCalled();
  });

  it('tracks which channels the server accepted', () => {
    render(<Harness channelIds={['ch-1', 'ch-2']} onEvent={jest.fn()} />);

    emit('connect');
    emit('authenticated');
    emit('subscribed', { channelId: 'ch-1' });

    // ch-2 was requested but never acknowledged — the server may have refused it.
    expect(screen.getByTestId('subscribed')).toHaveTextContent('ch-1');
  });

  it('forwards live events and ignores malformed ones', () => {
    const onEvent = jest.fn();
    render(<Harness channelIds={['ch-1']} onEvent={onEvent} />);

    emit('connect');
    emit('authenticated');
    emit(EVENTS_SOCKET.LIVE_EVENT, makeEvent('e1'));
    emit(EVENTS_SOCKET.LIVE_EVENT, { type: 'gift' }); // no id

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls[0][0].id).toBe('e1');
  });

  it('does not rebuild the socket when the callback identity changes', () => {
    const { rerender } = render(<Harness channelIds={['ch-1']} onEvent={jest.fn()} />);
    expect(ioMock).toHaveBeenCalledTimes(1);

    rerender(<Harness channelIds={['ch-1']} onEvent={jest.fn()} />);

    expect(ioMock).toHaveBeenCalledTimes(1);
    expect(socketMock.disconnect).not.toHaveBeenCalled();
  });

  it('subscribes to a newly added channel without dropping the socket', () => {
    const { rerender } = render(<Harness channelIds={['ch-1']} onEvent={jest.fn()} />);

    emit('connect');
    emit('authenticated');
    emit('subscribed', { channelId: 'ch-1' });
    socketMock.emit.mockClear();

    rerender(<Harness channelIds={['ch-1', 'ch-2']} onEvent={jest.fn()} />);

    expect(socketMock.emit).toHaveBeenCalledWith(EVENTS_SOCKET.SUBSCRIBE_CHANNEL, 'ch-2');
    expect(socketMock.emit).not.toHaveBeenCalledWith(EVENTS_SOCKET.SUBSCRIBE_CHANNEL, 'ch-1');
    expect(ioMock).toHaveBeenCalledTimes(1);
  });

  it('tears the socket down on unmount', () => {
    const { unmount } = render(<Harness channelIds={['ch-1']} onEvent={jest.fn()} />);

    unmount();

    expect(socketMock.removeAllListeners).toHaveBeenCalled();
    expect(socketMock.disconnect).toHaveBeenCalled();
  });

  describe('token expiry on reconnect', () => {
    it('refreshes the access token before giving up', async () => {
      // An access token lives 15 minutes. A reconnect after that window is the
      // normal case for a tab left open, not a dead session — treating it as
      // terminal killed the feed permanently.
      render(<Harness channelIds={['ch-1']} onEvent={jest.fn()} />);
      emit('connect');
      socketMock.emit.mockClear();

      currentToken = 'refreshed-token';
      await act(async () => {
        handlers.get('error')?.({ code: 'AUTH_INVALID' });
      });

      expect(restoreSessionMock).toHaveBeenCalledTimes(1);
      expect(socketMock.emit).toHaveBeenCalledWith(EVENTS_SOCKET.AUTHENTICATE, {
        token: 'refreshed-token',
      });
      expect(socketMock.io.reconnection).not.toHaveBeenCalled();
    });

    it('gives up when the refresh cookie is also dead', async () => {
      restoreSessionMock.mockResolvedValue(null);
      render(<Harness channelIds={['ch-1']} onEvent={jest.fn()} />);
      emit('connect');

      await act(async () => {
        handlers.get('error')?.({ code: 'AUTH_INVALID' });
      });

      expect(screen.getByTestId('status')).toHaveTextContent('unauthorized');
      expect(socketMock.io.reconnection).toHaveBeenCalledWith(false);
    });

    it('only attempts the refresh once per connection', async () => {
      restoreSessionMock.mockResolvedValue(null);
      render(<Harness channelIds={['ch-1']} onEvent={jest.fn()} />);
      emit('connect');

      await act(async () => {
        handlers.get('error')?.({ code: 'AUTH_INVALID' });
      });
      await act(async () => {
        handlers.get('error')?.({ code: 'AUTH_INVALID' });
      });

      expect(restoreSessionMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscription reconciliation', () => {
    it('subscribes each channel exactly once after authenticating', () => {
      // The 'authenticated' handler used to emit as well as the reconcile
      // effect, doubling every ownership query on the server.
      render(<Harness channelIds={['ch-1', 'ch-2']} onEvent={jest.fn()} />);

      emit('connect');
      emit('authenticated');

      const subs = socketMock.emit.mock.calls.filter(
        (c) => c[0] === EVENTS_SOCKET.SUBSCRIBE_CHANNEL,
      );
      expect(subs).toHaveLength(2);
    });

    it('unsubscribes a channel that is removed', () => {
      const { rerender } = render(
        <Harness channelIds={['ch-1', 'ch-2']} onEvent={jest.fn()} />,
      );
      emit('connect');
      emit('authenticated');
      emit('subscribed', { channelId: 'ch-1' });
      emit('subscribed', { channelId: 'ch-2' });
      socketMock.emit.mockClear();

      rerender(<Harness channelIds={['ch-1']} onEvent={jest.fn()} />);

      expect(socketMock.emit).toHaveBeenCalledWith(
        EVENTS_SOCKET.UNSUBSCRIBE_CHANNEL,
        'ch-2',
      );
    });

    it('drops a channel from state when the server acknowledges the unsubscribe', () => {
      // Without this the set only grows, and unlink-then-relink on a live socket
      // would never re-send SUBSCRIBE for the returning channel.
      render(<Harness channelIds={['ch-1']} onEvent={jest.fn()} />);
      emit('connect');
      emit('authenticated');
      emit('subscribed', { channelId: 'ch-1' });
      expect(screen.getByTestId('subscribed')).toHaveTextContent('ch-1');

      emit('unsubscribed', { channelId: 'ch-1' });

      expect(screen.getByTestId('subscribed')).toHaveTextContent('');
    });

    it('unsubscribes when the ack arrives after the channel was removed', () => {
      // The reconcile effect cannot catch this: at the time the channel was
      // dropped the subscribe had not been acknowledged, so it was in neither
      // the wanted nor the acknowledged set.
      const { rerender } = render(<Harness channelIds={['ch-1']} onEvent={jest.fn()} />);
      emit('connect');
      emit('authenticated');

      rerender(<Harness channelIds={[]} onEvent={jest.fn()} />);
      socketMock.emit.mockClear();

      emit('subscribed', { channelId: 'ch-1' });

      expect(socketMock.emit).toHaveBeenCalledWith(
        EVENTS_SOCKET.UNSUBSCRIBE_CHANNEL,
        'ch-1',
      );
      expect(screen.getByTestId('subscribed')).toHaveTextContent('');
    });
  });
});
