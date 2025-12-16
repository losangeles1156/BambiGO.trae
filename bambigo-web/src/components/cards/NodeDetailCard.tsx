'use client'
import { getLocalizedName } from '../../../lib/utils/i18n'
type Name = { ja?: string; en?: string; zh?: string }
type Tag = { label: string; tone?: 'purple' | 'yellow' | 'gray' | 'blue' }
type Props = {
  name: Name
  l1Summary?: string
  l1Tags?: Tag[]
  l2Status?: Tag[]
  l3Context?: Tag[]
  l4Timeline?: Tag[]
}
export default function NodeDetailCard({ name, l1Summary = '', l1Tags = [], l2Status = [], l3Context = [], l4Timeline = [] }: Props) {
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'zh-TW'
  const chip = (t: Tag, i: number) => (
    <span
      key={i}
      className={`ui-chip ${
        t.tone === 'purple'
          ? 'ui-chip--purple'
          : t.tone === 'yellow'
          ? 'ui-chip--yellow'
          : t.tone === 'blue'
          ? 'ui-chip--blue'
          : 'ui-chip--gray'
      }`}
    >
      {t.label}
    </span>
  )
  return (
    <div className="ui-card p-4">
      <div className="ui-card__title">{getLocalizedName(name as Record<string, string>, locale)}</div>
      <div className="mt-3">
        <div className="ui-section__title">L1 地點基因</div>
        <div className="mt-2 flex flex-wrap gap-6">
          {l1Summary && <span className="ui-chip bg-primary-500 text-white">{l1Summary}</span>}
          {l1Tags.map(chip)}
        </div>
      </div>
      <div className="mt-3">
        <div className="ui-section__title">L2 即時狀態</div>
        <div className="mt-2 flex flex-wrap gap-6">{l2Status.map(chip)}</div>
      </div>
      <div className="mt-3">
        <div className="ui-section__title">L3 機能與環境</div>
        <div className="mt-2 flex flex-wrap gap-6">{l3Context.map(chip)}</div>
      </div>
      <div className="mt-3">
        <div className="ui-section__title">L4 交通動態</div>
        <div className="mt-2 flex flex-wrap gap-6">{l4Timeline.map(chip)}</div>
      </div>
    </div>
  )
}
