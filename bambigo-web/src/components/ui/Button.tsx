'use client'
type Variant = 'primary' | 'neutral'
type Props = { children: React.ReactNode; variant?: Variant; className?: string; onClick?: () => void }
export default function Button({ children, variant = 'neutral', className, onClick }: Props) {
  const cls = variant === 'primary'
    ? 'rounded bg-blue-600 px-3 py-2 text-sm text-white'
    : 'rounded-full border border-gray-300 px-3 py-2 text-sm'
  return (
    <button className={`${cls} ${className || ''}`} onClick={onClick}>{children}</button>
  )
}
