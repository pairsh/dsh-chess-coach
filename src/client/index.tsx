/**
 * Browser half of dsh-chess-coach.
 *
 * Registers one page type in DSH's native right Sidebar (stage one), then its
 * body and chip title in the keyed `sidebar.right.pane.tab` seats. No other
 * plugin's values are imported: the whole UI is a self-contained React tree
 * that talks to this package's host routes over same-origin fetch.
 */
import { createElement } from 'react'
import { ChessCoach } from './ChessCoach.tsx'
import { KnightIcon } from './icons.tsx'
import { injectStyles } from './styles.ts'
import type { ClientContext, SidebarTabBodyProps } from './types.ts'

export const inject = ['slots', 'sidebarRightTabs']

const KIND = 'dsh-chess-coach'
const TITLE = '棋局教练'
const DESCRIPTION = '交互棋盘 + Stockfish 实时教练，分析双方计划、战术与下一步。'

function CoachBody(props: SidebarTabBodyProps) {
  return createElement(ChessCoach, { sessionId: props.sessionId })
}

function CoachTitle() {
  return createElement(
    'span',
    { className: 'cc-tab-title' },
    createElement(KnightIcon, { size: 14 }),
    createElement('span', null, TITLE),
  )
}

/**
 * Mount the client plugin.
 * @param ctx - client context carrying the slot registry and native Sidebar registry.
 */
export function apply(ctx: ClientContext): void {
  injectStyles()
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: KIND,
    kind: KIND,
    keepMounted: true,
    title: () => TITLE,
    guide: [{
      id: 'coach',
      order: 18,
      title: () => TITLE,
      description: () => DESCRIPTION,
      icon: KnightIcon,
    }],
  }), 'dsh-chess-coach: sidebar tab type')

  ctx.effect(() => ctx.slots.register({
    name: 'sidebar.right.pane.tab',
    key: KIND,
  }, CoachBody), 'dsh-chess-coach: sidebar tab body')

  ctx.effect(() => ctx.slots.register({
    name: 'sidebar.right.pane.tab.title',
    key: KIND,
  }, CoachTitle), 'dsh-chess-coach: sidebar tab title')
}
