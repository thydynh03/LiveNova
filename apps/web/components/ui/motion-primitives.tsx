'use client';

import React from 'react';
import { motion, useReducedMotion, type Variants } from 'motion/react';

/**
 * Shared motion vocabulary.
 *
 * Every animation here answers one of: hierarchy (draw the eye to the right
 * thing), storytelling (reveal in a sequence that matches the reading order),
 * feedback (acknowledge an action). Motion that only exists because it looked
 * good is not in this file.
 *
 * Everything degrades to static under `prefers-reduced-motion`. That is not a
 * nicety for this audience: a streamer stares at this interface for six hours
 * beside a second screen, and vestibular discomfort is a real cost.
 */

/** Decelerating curve. Nothing here uses linear easing; it reads mechanical. */
const EASE = [0.16, 1, 0.3, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

export const staggerParent: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

/**
 * Reduced-motion counterparts.
 *
 * Quan trọng: không được thay bằng `variants={undefined}`. `useReducedMotion`
 * chỉ biết kết quả sau khi hydrate, nên lần render đầu đã kịp áp `hidden`
 * (opacity 0); nếu lúc đó variants biến mất thì motion không còn target nào để
 * chạy tới và cả khối nội dung nằm vô hình vĩnh viễn. Giữ nguyên tên biến thể,
 * chỉ bỏ phần chuyển động.
 */
const fadeUpStatic: Variants = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0, transition: { duration: 0 } },
};

const staggerParentStatic: Variants = {
  hidden: {},
  visible: {},
};

/**
 * Reveals a section as it enters the viewport.
 *
 * `once: true` on purpose: re-animating on every scroll-past turns the page
 * into a slot machine on the way back up.
 */
export function Reveal({
  children,
  delay = 0,
  as = 'div',
  className,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  as?: 'div' | 'section' | 'li' | 'article';
  className?: string;
  style?: React.CSSProperties;
}) {
  const reduce = useReducedMotion();
  const Component = motion[as];

  return (
    <Component
      className={className}
      style={style}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={reduce ? { duration: 0 } : { duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </Component>
  );
}

/** Staggered container: children arrive in reading order, not all at once. */
export function RevealGroup({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      style={style}
      variants={reduce ? staggerParentStatic : staggerParent}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      style={style}
      variants={reduce ? fadeUpStatic : fadeUp}
    >
      {children}
    </motion.div>
  );
}

/**
 * Hover and press feedback for cards and tiles.
 *
 * Spring rather than a fixed duration: a spring settles the way a physical
 * object does, and the difference is legible even at 4px of travel.
 */
export function Pressable({
  children,
  className,
  style,
  lift = 4,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  lift?: number;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      style={style}
      whileHover={reduce ? undefined : { y: -lift }}
      whileTap={reduce ? undefined : { y: 0, scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
    >
      {children}
    </motion.div>
  );
}
