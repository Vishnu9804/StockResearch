/**
 * FinScreen Motion Design System
 * ───────────────────────────────
 * Single source of truth for all Framer Motion variants and GSAP configs.
 * Import from here — never define inline animation variants in components.
 */

import type { Variants, Transition } from 'framer-motion'

// ─── Reduced-motion guard ──────────────────────────────────────────────────────
// When prefersReducedMotion is true, all variants collapse to instant opacity-only.
const INSTANT: Variants = {
  initial:  { opacity: 0 },
  animate:  { opacity: 1, transition: { duration: 0.01 } },
  exit:     { opacity: 0, transition: { duration: 0.01 } },
}

export function reduceVariants(variants: Variants, prefersReduced: boolean): Variants {
  return prefersReduced ? INSTANT : variants
}

// ─── Spring configs ────────────────────────────────────────────────────────────
export const springs = {
  /** Standard UI spring — snappy but not bouncy */
  standard: { type: 'spring', stiffness: 400, damping: 35 } as Transition,
  /** Gentle spring for layout shifts and larger elements */
  gentle:   { type: 'spring', stiffness: 280, damping: 28 } as Transition,
  /** Bouncy spring for playful elements */
  bouncy:   { type: 'spring', stiffness: 500, damping: 22 } as Transition,
  /** Smooth tween */
  smooth:   { duration: 0.22, ease: [0.16, 1, 0.3, 1] } as Transition,
  /** Slow tween for hero/large elements */
  heroIn:   { duration: 0.5, ease: [0.16, 1, 0.3, 1] } as Transition,
}

// ─── Page-level variants ───────────────────────────────────────────────────────
export const pageVariants: Variants = {
  initial:  { opacity: 0, y: 10 },
  animate:  { opacity: 1, y: 0,  transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } },
  exit:     { opacity: 0, y: -6, transition: { duration: 0.14, ease: 'easeIn' } },
}

// ─── Auth page variants (slide horizontally) ───────────────────────────────────
export const authPageVariants: Variants = {
  initial:  { opacity: 0, x: 18,  scale: 0.98 },
  animate:  { opacity: 1, x: 0,   scale: 1,   transition: springs.smooth },
  exit:     { opacity: 0, x: -18, scale: 0.98, transition: { duration: 0.14, ease: 'easeIn' } },
}

// ─── Stagger container (wraps a list of children that stagger in) ──────────────
export const containerVariants: Variants = {
  initial:  {},
  animate:  { transition: { staggerChildren: 0.065, delayChildren: 0.05 } },
  exit:     { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
}

export const containerVariantsFast: Variants = {
  initial:  {},
  animate:  { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
}

// ─── Individual stagger child ──────────────────────────────────────────────────
export const itemVariants: Variants = {
  initial:  { opacity: 0, y: 12 },
  animate:  { opacity: 1, y: 0,  transition: springs.standard },
  exit:     { opacity: 0, y: -8, transition: { duration: 0.12 } },
}

export const itemVariantsX: Variants = {
  initial:  { opacity: 0, x: -14 },
  animate:  { opacity: 1, x: 0,   transition: springs.standard },
  exit:     { opacity: 0, x: -14, transition: { duration: 0.1 } },
}

// ─── Fade only ────────────────────────────────────────────────────────────────
export const fadeVariants: Variants = {
  initial:  { opacity: 0 },
  animate:  { opacity: 1, transition: { duration: 0.2 } },
  exit:     { opacity: 0, transition: { duration: 0.15 } },
}

// ─── Scale fade (for cards, badges, chips) ────────────────────────────────────
export const scaleFadeVariants: Variants = {
  initial:  { opacity: 0, scale: 0.92 },
  animate:  { opacity: 1, scale: 1,    transition: springs.bouncy },
  exit:     { opacity: 0, scale: 0.88, transition: { duration: 0.12 } },
}

// ─── Command palette panel ────────────────────────────────────────────────────
export const paletteVariants: Variants = {
  initial:  { opacity: 0, scale: 0.95, y: -14 },
  animate:  { opacity: 1, scale: 1,    y: 0,  transition: springs.gentle },
  exit:     { opacity: 0, scale: 0.96, y: -8, transition: { duration: 0.16, ease: 'easeIn' } },
}

export const backdropVariants: Variants = {
  initial:  { opacity: 0 },
  animate:  { opacity: 1, transition: { duration: 0.2 } },
  exit:     { opacity: 0, transition: { duration: 0.18 } },
}

// ─── Slide in from below ───────────────────────────────────────────────────────
export const slideUpVariants: Variants = {
  initial:  { opacity: 0, y: 20 },
  animate:  { opacity: 1, y: 0,  transition: springs.gentle },
  exit:     { opacity: 0, y: 10, transition: { duration: 0.15 } },
}

// ─── Kinetic word — for company name reveal ───────────────────────────────────
export const wordVariants: Variants = {
  initial:  { opacity: 0, y: 18, rotateX: -20 },
  animate:  { opacity: 1, y: 0,  rotateX: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
}

export const wordContainerVariants: Variants = {
  initial:  {},
  animate:  { transition: { staggerChildren: 0.075, delayChildren: 0.05 } },
}

// ─── Row slide-in (for table/list rows) ───────────────────────────────────────
export const rowVariants: Variants = {
  initial:  { opacity: 0, x: -10 },
  animate:  { opacity: 1, x: 0,   transition: springs.standard },
  exit:     { opacity: 0, x: -10, height: 0, marginBottom: 0, transition: { duration: 0.22 } },
}

// ─── Metric badge pop (for price change badge) ────────────────────────────────
export const badgePopVariants: Variants = {
  initial:  { opacity: 0, scale: 0.7 },
  animate:  { opacity: 1, scale: 1, transition: springs.bouncy },
}
