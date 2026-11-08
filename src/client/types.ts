import type { Color } from '../shared/types.ts'

export interface SidebarTabInfo {
  readonly tab: {
    readonly id: string
    readonly visible: boolean
    readonly navigation?: { readonly params?: unknown }
  }
  readonly panel?: { readonly id?: string }
  readonly sidebar?: { readonly expanded?: boolean }
}

export interface SidebarTabBodyProps {
  readonly sessionId: string
  readonly useTabInfo: () => SidebarTabInfo
  readonly [key: string]: unknown
}

export interface ClientContext {
  readonly slots: {
    register(definition: {
      readonly name: string
      readonly key: string
      readonly [key: string]: unknown
    }, component: (props: SidebarTabBodyProps) => unknown): () => void
  }
  readonly sidebarRightTabs: {
    register(definition: {
      readonly id: string
      readonly kind: string
      readonly title: (address: string) => string
      readonly guide?: readonly {
        readonly id: string
        readonly order: number
        readonly title: () => string
        readonly description?: () => string
        readonly icon?: unknown
      }[]
      readonly keepMounted?: boolean
    }): () => void
  }
  effect(callback: () => void | (() => void), label?: string): void
}

export interface Settings {
  depth: number
  multipv: number
  autoAnalyze: boolean
  showArrows: boolean
  cloudEval: boolean
  openingExplorer: boolean
  myColor: Color
  orientation: Color
}

export interface StoredHeaders {
  white: string
  black: string
  whiteElo?: string
  blackElo?: string
  event?: string
  date?: string
  result?: string
}

export interface StoredGame {
  startFen: string
  moves: string[]
  cursor: number
  headers?: StoredHeaders
}

export const DEFAULT_SETTINGS: Settings = {
  depth: 14,
  multipv: 3,
  autoAnalyze: true,
  showArrows: true,
  cloudEval: true,
  openingExplorer: false,
  myColor: 'w',
  orientation: 'w',
}
