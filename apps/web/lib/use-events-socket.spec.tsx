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
jest.mock('./api-client', () => ({
  getAccessToken: () => currentToken,
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

  it('stops retrying when the server rejects the token', () => {
    render(<Harness channelIds={['ch-1']} onEvent={jest.fn()} />);

    emit('connect');
    emit('error', { code: 'AUTH_INVALID' });

    expect(screen.getByTestId('status')).toHaveTextContent('unauthorized');
    expect(socketMock.io.reconnection).toHaveBeenCalledWith(false);
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
});
