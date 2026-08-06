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
  Stop,
  X as CloseIcon,
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
  Clock,
  EyeSlash,
  Queue as QueueIcon,
} from '@phosphor-icons/react';

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
  stop: Stop,
  close: CloseIcon,
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
  pending: Clock,
  queue: QueueIcon,
  eye: Eye,
  eyeSlash: EyeSlash,
} as const satisfies Record<string, PhosphorIcon>;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: IconName;
  size?: number;
  weight?: 'regular' | 'bold' | 'fill' | 'duotone';
  className?: string;
  style?: React.CSSProperties;
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
  if (!Glyph) {
    return null;
  }
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
