interface IllustrationProps {
  className?: string
  size?: number
}

export function SearchIllustration({ className, size = 120 }: IllustrationProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Magnifying glass with no results */}
      <circle cx="52" cy="52" r="30" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <line x1="74" y1="74" x2="100" y2="100" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <line x1="40" y1="45" x2="64" y2="45" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <line x1="40" y1="52" x2="58" y2="52" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <line x1="40" y1="59" x2="52" y2="59" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </svg>
  )
}

export function EmptyBoxIllustration({ className, size = 120 }: IllustrationProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Open box */}
      <path d="M30 50 L60 35 L90 50 L60 65 Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M30 50 L30 80 L60 95 L60 65" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M90 50 L90 80 L60 95 L60 65" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Flap lines */}
      <path d="M30 50 L45 38" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <path d="M90 50 L75 38" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </svg>
  )
}

export function ErrorIllustration({ className, size = 120 }: IllustrationProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Warning triangle */}
      <path d="M60 25 L95 90 L25 90 Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <line x1="60" y1="50" x2="60" y2="68" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="60" cy="78" r="2.5" fill="currentColor" />
    </svg>
  )
}

export function FilterIllustration({ className, size = 120 }: IllustrationProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Funnel with no output */}
      <path d="M25 35 L95 35 L68 65 L68 85 L52 95 L52 65 Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      {/* X mark below funnel */}
      <line x1="50" y1="100" x2="70" y2="100" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </svg>
  )
}
