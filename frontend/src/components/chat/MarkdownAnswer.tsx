/**
 * A deliberately small markdown renderer for chat answers.
 *
 * Why not a markdown library: the app ships none today, and pulling one in
 * (plus a sanitiser, which any HTML-emitting renderer needs) to display model
 * output is a large dependency and a real XSS surface for a formatting problem
 * this narrow. Answers use exactly one small subset — headings, bullet and
 * numbered lists, bold, italic, inline code, and [n] citation markers — and
 * that subset is what this supports.
 *
 * It never produces HTML strings and never touches dangerouslySetInnerHTML;
 * everything is React elements built from parsed text, so model output cannot
 * inject markup by construction rather than by escaping.
 */
import { Fragment, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface MarkdownAnswerProps {
  content: string
  /** Called when a [n] citation marker is clicked, so the page can highlight the source. */
  onCitationClick?: (n: number) => void
  className?: string
}

// Inline patterns, applied in one pass so a bold span inside a list item works
// and a citation inside bold text still renders as a citation.
const INLINE_PATTERN = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_|\[\d{1,2}\])/g

function renderInline(text: string, onCitationClick?: (n: number) => void): ReactNode[] {
  const nodes: ReactNode[] = []
  let key = 0

  for (const part of text.split(INLINE_PATTERN)) {
    if (!part) continue

    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      nodes.push(<strong key={key++} className="font-semibold text-textPrimary">{part.slice(2, -2)}</strong>)
    } else if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      nodes.push(
        <code key={key++} className="rounded bg-surfaceMuted px-1 py-0.5 font-mono text-[0.85em] text-textPrimary">
          {part.slice(1, -1)}
        </code>,
      )
    } else if (/^\[\d{1,2}\]$/.test(part)) {
      const n = Number(part.slice(1, -1))
      nodes.push(
        <button
          key={key++}
          type="button"
          onClick={() => onCitationClick?.(n)}
          title={`Jump to source ${n}`}
          className={cn(
            'mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded px-1 align-baseline',
            'bg-accentSoft text-[10px] font-semibold text-accent',
            'transition-colors hover:bg-accent hover:text-white',
          )}
        >
          {n}
        </button>,
      )
    } else if (
      (part.startsWith('*') && part.endsWith('*') && part.length > 2) ||
      (part.startsWith('_') && part.endsWith('_') && part.length > 2)
    ) {
      nodes.push(<em key={key++} className="italic text-textSecondary">{part.slice(1, -1)}</em>)
    } else {
      nodes.push(<Fragment key={key++}>{part}</Fragment>)
    }
  }

  return nodes
}

type Block =
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }

function parseBlocks(content: string): Block[] {
  const blocks: Block[] = []
  let paragraph: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ kind: 'paragraph', lines: paragraph })
      paragraph = []
    }
  }
  const flushList = () => {
    if (list) {
      blocks.push({ kind: 'list', ...list })
      list = null
    }
  }

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trimEnd()

    if (!line.trim()) {
      flushParagraph()
      flushList()
      continue
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      flushParagraph()
      flushList()
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] })
      continue
    }

    const bullet = line.match(/^\s*[-*+]\s+(.*)$/)
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/)
    if (bullet || numbered) {
      flushParagraph()
      const ordered = Boolean(numbered)
      // A change of list type starts a new list rather than mixing markers.
      if (!list || list.ordered !== ordered) {
        flushList()
        list = { ordered, items: [] }
      }
      list.items.push((bullet ?? numbered)![1])
      continue
    }

    // A plain line directly under a list item is that item's continuation,
    // which is how the model writes wrapped bullet text.
    if (list && list.items.length) {
      list.items[list.items.length - 1] += ` ${line.trim()}`
      continue
    }

    paragraph.push(line)
  }

  flushParagraph()
  flushList()
  return blocks
}

export function MarkdownAnswer({ content, onCitationClick, className }: MarkdownAnswerProps) {
  const blocks = parseBlocks(content)

  return (
    <div className={cn('space-y-3 text-sm leading-relaxed text-textSecondary', className)}>
      {blocks.map((block, index) => {
        if (block.kind === 'heading') {
          return (
            <div
              key={index}
              className={cn(
                'font-semibold tracking-tight text-textPrimary',
                block.level <= 2 ? 'text-base pt-1' : 'text-sm',
              )}
            >
              {renderInline(block.text, onCitationClick)}
            </div>
          )
        }

        if (block.kind === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul'
          return (
            <ListTag
              key={index}
              className={cn(
                'space-y-1.5 pl-5',
                block.ordered ? 'list-decimal marker:text-textMuted' : 'list-disc marker:text-accent/60',
              )}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="pl-1">{renderInline(item, onCitationClick)}</li>
              ))}
            </ListTag>
          )
        }

        return (
          <p key={index}>
            {block.lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 && <br />}
                {renderInline(line, onCitationClick)}
              </Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}

export default MarkdownAnswer
