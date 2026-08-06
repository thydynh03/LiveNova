'use client';

import React from 'react';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import {
  Broadcast,
  CreditCard,
  Gift,
  Heart,
  UserPlus,
  ShareNetwork,
  ChatCircle,
  SignIn,
  SignOut,
  Lock,
  User,
  DeviceMobile,
  Monitor,
  SpeakerHigh,
  Play,
  SlidersHorizontal,
  Copy,
  Check,
  ArrowLeft,
  ArrowRight,
  List,
  Sun,
  Moon,
  Coins,
  Sparkle,
  Waveform,
  Target,
  Swap,
  Warning,
  Link as LinkIcon,
  Trash,
  ArrowClockwise,
  Eye,
} from '@phosphor-icons/react';

/**
 * One icon family, one stroke weight, one import site.
 *
 * Before this, the interface used 29 hard-coded emoji as icons, including
 * inside headings (`💳 Nạp Credit`, `🗣️ Giọng Đọc`). Emoji-as-icon has three
 * concrete problems beyond looking unserious: every platform renders them
 * differently so the UI is inconsistent across a streamer's devices, screen
 * readers announce them as full sentences ("credit card" mid-heading), and they
 * cannot inherit color, so they never match the theme.
 *
 * Phosphor rather than Lucide: Lucide is the default every AI-built interface
 * reaches for, and its geometry is thinner than this UI wants at small sizes.
 */
export const ICONS = {
  broadcast: Broadcast,
  billing: CreditCard,
  gift: Gift,
  like: Heart,
  follow: UserPlus,
  share: ShareNetwork,
  comment: ChatCircle,
  signIn: SignIn,
  signOut: SignOut,
  lock: Lock,
  user: User,
  device: DeviceMobile,
  desktop: Monitor,
  audio: SpeakerHigh,
  play: Play,
  settings: SlidersHorizontal,
  copy: Copy,
  check: Check,
  back: ArrowLeft,
  forward: ArrowRight,
  menu: List,
  sun: Sun,
  moon: Moon,
  coins: Coins,
  spark: Sparkle,
  waveform: Waveform,
  goal: Target,
  versus: Swap,
  warning: Warning,
  link: LinkIcon,
  trash: Trash,
  rotate: ArrowClockwise,
  preview: Eye,
} as const satisfies Record<string, PhosphorIcon>;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: IconName;
  size?: number;
  weight?: 'regular' | 'bold' | 'fill' | 'duotone';
  className?: string;
  style?: React.CSSProperties;
  /**
   * Give a label only when the icon carries meaning on its own. Beside visible
   * text it is decorative, and a label would make a screen reader read the same
   * thing twice.
   */
  label?: string;
}

export function Icon({
  name,
  size = 20,
  weight = 'regular',
  className,
  style,
  label,
}: IconProps) {
  const Glyph = ICONS[name];
  return (
    <Glyph
      size={size}
      weight={weight}
      className={className}
      style={{ flexShrink: 0, ...style }}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    />
  );
}
