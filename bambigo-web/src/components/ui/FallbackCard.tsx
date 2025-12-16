'use client'
import Card from './Card'
import Button from './Button'
type Props = { title: string; desc?: string; onRetry?: () => void }
export default function FallbackCard({ title, desc, onRetry }: Props) {
  return (
    <Card className="mb-2">
      <div className="text-sm font-semibold">{title}</div>
      {desc && <div className="mt-1 text-xs text-gray-600">{desc}</div>}
      {onRetry && (
        <div className="mt-2">
          <Button className="text-xs" onClick={onRetry}>重試</Button>
        </div>
      )}
    </Card>
  )
}
