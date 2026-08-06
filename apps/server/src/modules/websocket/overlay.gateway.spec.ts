import { readFileSync } from 'fs';
import { join } from 'path';
import { OverlayGateway } from './overlay.gateway';
import { OverlayService } from '../overlay/overlay.service';
import { OVERLAY_SOCKET, RuleActionType, LiveEventType, OverlayAction } from '@livenova/shared';

interface MockSocket {
  handshake: { query: Record<string, unknown>; auth: Record<string, unknown> };
  join: jest.Mock;
  emit: jest.Mock;
  disconnect: jest.Mock;
  overlayId?: string;
  ownerId?: string;
}

function makeSocket(query: Record<string, unknown> = {}, auth: Record<string, unknown> = {}): MockSocket {
  return {
    handshake: { query, auth },
    join: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
}

function makeAction(overrides: Partial<OverlayAction> = {}): OverlayAction {
  return {
    id: 'act-1',
    ruleId: 'rule-1',
    ruleName: 'Hoa hồng → video',
    type: RuleActionType.MEDIA_POPUP,
    payload: { mediaType: 'video', url: 'https://cdn.example/v.mp4', durationMs: 5000 },
    event: {
      type: LiveEventType.GIFT,
      senderDisplayName: 'Nguyễn Văn A',
      giftName: 'Hoa hồng',
      giftCoinValue: 1,
    },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('OverlayGateway', () => {
  let overlayService: { findByPublicToken: jest.Mock };
  let gateway: OverlayGateway;
  let emit: jest.Mock;
  let to: jest.Mock;

  const VALID_TOKEN = 'a'.repeat(43);

  beforeEach(() => {
    overlayService = { findByPublicToken: jest.fn() };
    gateway = new OverlayGateway(overlayService as unknown as OverlayService);

    emit = jest.fn();
    to = jest.fn().mockReturnValue({ emit });
    gateway.server = { to } as never;
  });

  describe('handshake', () => {
    it('rejects a connection with no token', async () => {
      const client = makeSocket();

      await gateway.handleConnection(client as never);

      expect(client.emit).toHaveBeenCalledWith(OVERLAY_SOCKET.ERROR, {
        code: 'TOKEN_REQUIRED',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.join).not.toHaveBeenCalled();
    });

    it('rejects an unknown token', async () => {
      overlayService.findByPublicToken.mockResolvedValue(null);
      const client = makeSocket({ token: VALID_TOKEN });

      await gateway.handleConnection(client as never);

      expect(client.emit).toHaveBeenCalledWith(OVERLAY_SOCKET.ERROR, {
        code: 'TOKEN_INVALID',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('gives the same response for a disabled overlay as for a missing one', async () => {
      // findByPublicToken returns null for both cases, so the socket cannot be
      // used to probe which tokens exist.
      overlayService.findByPublicToken.mockResolvedValue(null);
      const client = makeSocket({ token: VALID_TOKEN });

      await gateway.handleConnection(client as never);

      const codes = client.emit.mock.calls.map((c) => c[1].code);
      expect(codes).toEqual(['TOKEN_INVALID']);
    });

    it('accepts a valid token and joins both rooms', async () => {
      overlayService.findByPublicToken.mockResolvedValue({
        id: 'ov-1',
        userId: 'user-1',
        type: 'MEDIA',
        enabled: true,
      });
      const client = makeSocket({ token: VALID_TOKEN });

      await gateway.handleConnection(client as never);

      expect(client.join).toHaveBeenCalledWith('overlay_ov-1');
      expect(client.join).toHaveBeenCalledWith('overlay_user_user-1');
      expect(client.emit).toHaveBeenCalledWith(OVERLAY_SOCKET.READY, {
        overlayId: 'ov-1',
        type: 'MEDIA',
        // Config rides along with the handshake: a browser source holds no
        // credential with which to fetch it separately.
        config: {},
      });
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('accepts the token from handshake.auth as well as the query string', async () => {
      overlayService.findByPublicToken.mockResolvedValue({
        id: 'ov-2',
        userId: 'user-2',
        type: 'CHAT',
        enabled: true,
      });
      const client = makeSocket({}, { token: VALID_TOKEN });

      await gateway.handleConnection(client as never);

      expect(overlayService.findByPublicToken).toHaveBeenCalledWith(VALID_TOKEN);
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('never exposes the owner id to the client', async () => {
      overlayService.findByPublicToken.mockResolvedValue({
        id: 'ov-1',
        userId: 'user-secret',
        type: 'MEDIA',
        enabled: true,
      });
      const client = makeSocket({ token: VALID_TOKEN });

      await gateway.handleConnection(client as never);

      const readyPayload = client.emit.mock.calls.find(
        (c) => c[0] === OVERLAY_SOCKET.READY,
      )?.[1];
      expect(JSON.stringify(readyPayload)).not.toContain('user-secret');
    });
  });

  describe('state', () => {
    it('addresses continuous state at one overlay only', () => {
      gateway.handleState({
        userId: 'user-1',
        overlayId: 'ov-1',
        state: { kind: 'goal', current: 250, target: 1000, label: 'Mục tiêu' },
      });

      // A goal bar belongs to one browser source; broadcasting it to the user
      // room would drive every other overlay they have open.
      expect(to).toHaveBeenCalledWith('overlay_ov-1');
      expect(emit).toHaveBeenCalledWith(
        'overlay.state',
        expect.objectContaining({ kind: 'goal', current: 250 }),
      );
    });

    it('ignores a malformed state payload without throwing', () => {
      expect(() => gateway.handleState({ userId: 'user-1' } as never)).not.toThrow();
      expect(emit).not.toHaveBeenCalled();
    });
  });
  describe('dispatch', () => {
    it('delivers to the owner room by default', () => {
      const action = makeAction();

      gateway.handleDispatch({ userId: 'user-1', action });

      expect(to).toHaveBeenCalledWith('overlay_user_user-1');
      expect(emit).toHaveBeenCalledWith(OVERLAY_SOCKET.ACTION, action);
    });

    it('narrows delivery to one overlay when overlayId is given', () => {
      const action = makeAction();

      gateway.handleDispatch({ userId: 'user-1', action, overlayId: 'ov-9' });

      expect(to).toHaveBeenCalledWith('overlay_ov-9');
      expect(to).not.toHaveBeenCalledWith('overlay_user_user-1');
    });

    it('never delivers one user’s action into another user’s room', () => {
      gateway.handleDispatch({ userId: 'victim', action: makeAction() });

      const rooms = to.mock.calls.map((c) => c[0]);
      expect(rooms).toEqual(['overlay_user_victim']);
      expect(rooms).not.toContain('overlay_user_attacker');
    });

    it('ignores a malformed dispatch without throwing', () => {
      expect(() =>
        gateway.handleDispatch({ userId: '', action: undefined } as never),
      ).not.toThrow();
      expect(emit).not.toHaveBeenCalled();
    });
  });

  describe('shape', () => {
    /**
     * Source of the gateway with comments removed.
     *
     * Comments must be stripped or the guard below is useless in both
     * directions: the class doc-comment mentions `@SubscribeMessage` by name to
     * explain why there isn't one, which made the assertion fail on clean code.
     */
    const gatewaySource = (): string =>
      readFileSync(join(__dirname, 'overlay.gateway.ts'), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');

    it('exposes no client-callable message handlers (audit C-03)', () => {
      // An overlay must never originate an action — that was C-03, where any
      // client could broadcast fake gift events into any channel.
      //
      // Asserting on Nest's decorator metadata looked cleaner but is silently
      // vacuous: without `reflect-metadata` imported here, Reflect.getMetadata
      // is undefined, every lookup yields undefined, and the assertion passes
      // even when a handler exists. Reading the source cannot be fooled.
      const code = gatewaySource();

      expect(code).not.toMatch(/@SubscribeMessage\s*\(/);
      expect(code).not.toMatch(/\bclient\.on\s*\(/);
    });

    it('keeps credentials off on the namespace', () => {
      // Cookies must never reach this namespace: the overlay token is the only
      // credential, and OBS cannot carry a session anyway.
      expect(gatewaySource()).toMatch(/credentials:\s*false/);
    });
  });
});
