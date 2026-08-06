import { renderHook, act, waitFor } from '@testing-library/react';
import type { GameInputCommand } from '@livenova/shared';
import {
  useLocalBridge,
  readStoredBridgeToken,
  storeBridgeToken,
  BRIDGE_TOKEN_KEY,
} from './use-local-bridge';

class FakeSocket {
  static instances: FakeSocket[] = [];

  readyState = 0;
  sent: string[] = [];
  closed = false;

  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }

  open() {
    this.readyState = 1;
    this.onopen?.();
  }

  reply(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(code = 1000) {
    this.closed = true;
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

function setup(token: string) {
  FakeSocket.instances = [];
  return renderHook(() =>
    useLocalBridge({
      token,
      createSocket: (url) => new FakeSocket(url) as unknown as WebSocket,
    }),
  );
}

const command = (over: Partial<GameInputCommand> = {}): GameInputCommand => ({
  id: 'c1',
  ruleName: 'Quà to thì nhảy',
  vkCode: 32,
  holdMs: 50,
  cooldownMs: 1000,
  ...over,
});

describe('useLocalBridge', () => {
  beforeEach(() => window.localStorage.clear());

  it('stays disabled with no token rather than dialling loopback', () => {
    const { result } = setup('');

    expect(result.current.status).toBe('disabled');
    expect(FakeSocket.instances).toHaveLength(0);
  });

  it('connects to loopback with the token in the query', async () => {
    const { result } = setup('tok-123');

    expect(FakeSocket.instances[0].url).toBe('ws://127.0.0.1:4000/?token=tok-123');

    act(() => FakeSocket.instances[0].open());
    await waitFor(() => expect(result.current.status).toBe('connected'));
  });

  it('sends a key press once the socket is open', async () => {
    const { result } = setup('tok');
    act(() => FakeSocket.instances[0].open());

    act(() => result.current.send(command()));

    expect(JSON.parse(FakeSocket.instances[0].sent[0] ?? '{}')).toMatchObject({
      type: 'key_press',
      vkCode: 32,
      holdMs: 50,
      cooldownMs: 1000,
    });
  });

  it('ignores a repeated dispatch id', () => {
    const { result } = setup('tok');
    act(() => FakeSocket.instances[0].open());

    act(() => {
      result.current.send(command());
      result.current.send(command());
    });

    // Pressing a key twice is not idempotent the way redrawing an overlay is.
    expect(FakeSocket.instances[0].sent).toHaveLength(1);
  });

  it('drops a command sent before the socket opened', () => {
    const { result } = setup('tok');

    act(() => result.current.send(command()));

    expect(FakeSocket.instances[0].sent).toHaveLength(0);
  });

  it('surfaces a refusal from the bridge', async () => {
    const { result } = setup('tok');
    act(() => FakeSocket.instances[0].open());

    act(() =>
      FakeSocket.instances[0].reply({ ok: false, error: 'key error: not in the allowlist' }),
    );

    await waitFor(() => expect(result.current.lastError).toContain('allowlist'));
  });

  it('clears the error once a command succeeds', async () => {
    const { result } = setup('tok');
    act(() => FakeSocket.instances[0].open());

    act(() => FakeSocket.instances[0].reply({ ok: false, error: 'nope' }));
    await waitFor(() => expect(result.current.lastError).toBe('nope'));

    act(() => FakeSocket.instances[0].reply({ ok: true }));
    await waitFor(() => expect(result.current.lastError).toBeNull());
  });

  it('tells a missing desktop app apart from a wrong token', async () => {
    // 1006 is an abnormal close: nothing answered on loopback. Anything else
    // means the bridge answered and refused. Reporting the wrong one sends the
    // streamer looking in the wrong place.
    const offline = setup('tok');
    act(() => FakeSocket.instances[0].close(1006));
    await waitFor(() => expect(offline.result.current.status).toBe('offline'));

    const rejected = setup('tok');
    act(() => FakeSocket.instances[0].close(1002));
    await waitFor(() => expect(rejected.result.current.status).toBe('rejected'));
  });

  it('closes the socket on unmount', () => {
    const { unmount } = setup('tok');
    act(() => FakeSocket.instances[0].open());

    unmount();

    expect(FakeSocket.instances[0].closed).toBe(true);
  });
});

describe('bridge token storage', () => {
  beforeEach(() => window.localStorage.clear());

  it('round-trips through localStorage only', () => {
    storeBridgeToken('  abc  ');

    expect(window.localStorage.getItem(BRIDGE_TOKEN_KEY)).toBe('abc');
    expect(readStoredBridgeToken()).toBe('abc');
  });

  it('clears the entry rather than storing an empty string', () => {
    storeBridgeToken('abc');
    storeBridgeToken('   ');

    expect(window.localStorage.getItem(BRIDGE_TOKEN_KEY)).toBeNull();
  });
});
