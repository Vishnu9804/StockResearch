import { motion } from 'framer-motion'
import { wordVariants, wordContainerVariants } from '@/lib/motion'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { cn } from '@/lib/utils'

interface AnimatedCompanyNameProps {
  name: string
  className?: string
}

/**
 * Splits the company name into words and reveals each one
 * with a staggered fade+slide animation on mount.
 * Respects prefers-reduced-motion.
 */
export function AnimatedCompanyName({ name, className }: AnimatedCompanyNameProps) {
  const prefersReduced = useReducedMotion()
  const words = name.split(' ')

  if (prefersReduced) {
    return <span className={className}>{name}</span>
  }

  return (
    <motion.span
      className={cn('inline-flex flex-wrap gap-x-[0.3em] perspective-[600px]', className)}
      variants={wordContainerVariants}
      initial="initial"
      animate="animate"
      style={{ perspective: '600px' }}
    >
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          variants={wordVariants}
          className="inline-block origin-bottom"
          style={{ transformOrigin: 'bottom center' }}
        >
          {word}
        </motion.span>
      ))}
    </motion.span>
  )
}

export default AnimatedCompanyName
