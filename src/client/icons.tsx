export function KnightIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} focusable="false">
      <text x="12" y="19" textAnchor="middle" fontSize="20" fontFamily="'Segoe UI Symbol','Arial Unicode MS',sans-serif" fill="currentColor">♞</text>
    </svg>
  )
}

export function BoardIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1 5.7h14M1 10.3h14M5.7 1v14M10.3 1v14" stroke="currentColor" strokeWidth="1" opacity=".65" />
    </svg>
  )
}
