'use client'
type Variant = 'primary' | 'neutral'
type Props = { children: React.ReactNode; variant?: Variant; className?: string; onClick?: () => void }
export default function Button({ children, variant = 'neutral', className, onClick }: Props) {
  const cls = variant === 'primary'
    ? 'rounded-xl bg-blue-600 px-6 py-3 text-base font-medium text-white shadow-md active:scale-95 transition-all min-h-[48px] min-w-[48px] flex items-center justify-center'
    : 'rounded-xl border border-gray-300 bg-white px-6 py-3 text-base font-medium active:scale-95 transition-all min-h-[48px] min-w-[48px] flex items-center justify-center'
  return (
    <button className={`${cls} ${className || ''}`} onClick={onClick}>{children}</button>
  )
}
