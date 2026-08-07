import type { BroadcastSource } from './types';

/**
 * What each rule action can actually do, per broadcast source.
 *
 * One table, consulted by every screen that has to warn about or hide an
 * action. The distinction is not about TikTok's rules — it is about physics:
 * anything that has to be drawn into the video needs a compositor in the video
 * path, and a phone broadcasting from its own camera has none.
 *
 * This is UI guidance only. The rule engine still executes every action
 * regardless: the overlay may legitimately be open on another machine, and
 * gating server-side would make a dry run report something different from what
 * a real event does.
 */
export type ActionType =
  | 'tts_read'
  | 'sound'
  | 'media_popup'
  | 'effect'
  | 'obs_command'
  | 'game_input'
  | 'webhook';

export type Availability =
  /** Reaches viewers as designed. */
  | 'works'
  /** Runs, but needs the user to route audio into the phone. */
  | 'needs-audio-route'
  /** Cannot reach viewers at all in this mode. */
  | 'unavailable';

interface ActionInfo {
  label: string;
  desktop: Availability;
  mobile: Availability;
  /** Shown when the action is not fully available. */
  mobileNote?: string;
}

export const ACTION_CAPABILITY: Record<ActionType, ActionInfo> = {
  tts_read: {
    label: 'Đọc thành tiếng',
    desktop: 'works',
    mobile: 'needs-audio-route',
    mobileNote:
      'Tiếng phát ra ở máy tính. Bật loa ngoài cạnh điện thoại để khán giả nghe được.',
  },
  sound: {
    label: 'Phát âm thanh',
    desktop: 'works',
    mobile: 'needs-audio-route',
    mobileNote:
      'Tiếng phát ra ở máy tính. Bật loa ngoài cạnh điện thoại để khán giả nghe được.',
  },
  media_popup: {
    label: 'Hiện video/ảnh lên màn hình',
    desktop: 'works',
    mobile: 'unavailable',
    mobileNote:
      'Khi live bằng điện thoại không có phần mềm ghép hình, nên khán giả sẽ không thấy.',
  },
  effect: {
    label: 'Hiệu ứng màn hình',
    desktop: 'works',
    mobile: 'unavailable',
    mobileNote:
      'Khi live bằng điện thoại không có phần mềm ghép hình, nên khán giả sẽ không thấy.',
  },
  obs_command: {
    label: 'Điều khiển OBS',
    desktop: 'works',
    mobile: 'unavailable',
    mobileNote: 'Chỉ chạy khi bạn live bằng OBS trên máy tính.',
  },
  game_input: {
    label: 'Bấm phím trong game',
    desktop: 'works',
    mobile: 'works',
  },
  webhook: {
    label: 'Gửi tín hiệu ra ngoài',
    desktop: 'works',
    mobile: 'works',
  },
};

export function availabilityOf(
  action: string,
  source: BroadcastSource | undefined,
): Availability {
  const info = ACTION_CAPABILITY[action as ActionType];
  if (!info) return 'works';
  return source === 'MOBILE' ? info.mobile : info.desktop;
}

export function noteFor(
  action: string,
  source: BroadcastSource | undefined,
): string | null {
  if (source !== 'MOBILE') return null;
  const info = ACTION_CAPABILITY[action as ActionType];
  return info?.mobileNote ?? null;
}

/** True when at least one linked channel broadcasts from a phone. */
export function hasMobileChannel(
  channels: { broadcastSource?: BroadcastSource }[] | null | undefined,
): boolean {
  return (channels ?? []).some((c) => c.broadcastSource === 'MOBILE');
}
