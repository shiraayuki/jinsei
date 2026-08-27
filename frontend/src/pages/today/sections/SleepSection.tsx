import { useState } from 'react'
import { Moon, Bed, Sunrise } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSleep, useUpsertSleep } from '../../../features/sleep/hooks'
import type { SleepEntry } from '../../../features/sleep/api'
import { DurationField } from '../../../components/ui/DurationField'
import { ScreenshotImport } from '../../../components/ui/ScreenshotImport'
import type { SleepDraftFields } from '../../../features/import/api'
import { Section, SaveStatus } from './Section'
import { useAutosave } from '../../../lib/useAutosave'

/**
 * Minutes from one clock time to the other, wrapping over midnight: 22:30 to
 * 07:30 is nine hours, not minus fifteen. Null unless both are filled in.
 */
function spanMinutes(bed: string, wake: string): number | null {
  if (!bed || !wake) return null
  const [bh, bm] = bed.split(':').map(Number)
  const [wh, wm] = wake.split(':').map(Number)
  if ([bh, bm, wh, wm].some(v => !Number.isFinite(v))) return null
  const minutes = wh * 60 + wm - (bh * 60 + bm)
  return minutes > 0 ? minutes : minutes + 24 * 60
}

function formatDuration(minutes: number | null) {
  if (minutes == null) return null
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

/**
 * Split out so the parent can remount it with a key when the selected day
 * changes: the fields are seeded from the entry once, which keeps the form from
 * having to sync itself in an effect.
 */
function SleepForm({ date, entry, onSelectDate }: {
  date: string
  entry?: SleepEntry
  onSelectDate?: (date: string) => void
}) {
  const { t } = useTranslation()
  const upsert = useUpsertSleep()

  const [bedTime, setBedTime] = useState(entry?.bedTime ?? '')
  const [wakeTime, setWakeTime] = useState(entry?.wakeTime ?? '')
  const [inBed, setInBed] = useState<number | null>(entry?.timeInBedMinutes ?? null)
  const [asleep, setAsleep] = useState<number | null>(entry?.actualSleepMinutes ?? null)
  const [notes, setNotes] = useState(entry?.notes ?? '')

  const efficiency = inBed && inBed > 0 && asleep != null
    ? Math.round((asleep / inBed) * 100)
    : null

  const tooMuchSleep = inBed != null && asleep != null && asleep > inBed

  // The upsert rejects that pair, so it is held back until it makes sense
  // again rather than autosaved into a 400.
  useAutosave(
    {
      date,
      timeInBedMinutes: inBed,
      actualSleepMinutes: asleep,
      bedTime: bedTime || null,
      wakeTime: wakeTime || null,
      notes: notes || undefined,
    },
    values => upsert.mutate(values),
    { enabled: !tooMuchSleep },
  )

  return (
    <div className="space-y-4">
      <ScreenshotImport<SleepDraftFields>
        kind="sleep"
        date={date}
        onSelectDate={onSelectDate}
        // A field the screenshot did not show keeps whatever is already in the
        // form instead of being wiped.
        onApply={f => {
          if (f.timeInBedMinutes != null) setInBed(f.timeInBedMinutes)
          if (f.actualSleepMinutes != null) setAsleep(f.actualSleepMinutes)
        }}
      />

      {/* Entering the two clock times fills in the time in bed, since they
          already say it. It stays editable: the phone was put down before the
          light went out often enough that the two disagree. */}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="flex items-center gap-1 text-meta text-ink-mute">
            <Bed size={13} /> {t('sleep.bedTime')}
          </span>
          <input
            type="time"
            value={bedTime}
            onChange={e => {
              setBedTime(e.target.value)
              setInBed(spanMinutes(e.target.value, wakeTime) ?? inBed)
            }}
            className="rounded-control bg-raised px-3 py-2.5 text-body text-ink outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="flex items-center gap-1 text-meta text-ink-mute">
            <Sunrise size={13} /> {t('sleep.wakeTime')}
          </span>
          <input
            type="time"
            value={wakeTime}
            onChange={e => {
              setWakeTime(e.target.value)
              setInBed(spanMinutes(bedTime, e.target.value) ?? inBed)
            }}
            className="rounded-control bg-raised px-3 py-2.5 text-body text-ink outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
      </div>

      <DurationField
        label={t('sleep.timeInBed')}
        icon={<Bed size={13} />}
        minutes={inBed}
        onChange={setInBed}
      />

      <DurationField
        label={t('sleep.actualSleep')}
        icon={<Moon size={13} />}
        minutes={asleep}
        onChange={setAsleep}
      />

      {tooMuchSleep && (
        <p className="text-meta text-bad">{t('sleep.asleepExceedsBed')}</p>
      )}

      {efficiency != null && (
        <p className="text-center text-body text-ink-mute">
          {t('sleep.efficiency')}: <span className="font-semibold text-ink">{efficiency}%</span>
        </p>
      )}

      <input
        type="text"
        placeholder={t('sleep.notePlaceholder')}
        value={notes}
        onChange={e => setNotes(e.target.value)}
        className="w-full rounded-control bg-raised px-3 py-2 text-body text-ink outline-none focus:ring-2 focus:ring-accent"
      />

      <SaveStatus
        pending={upsert.isPending}
        savedAt={upsert.isSuccess ? upsert.submittedAt : undefined}
        error={upsert.error}
      />
    </div>
  )
}

export function SleepSection({ date, onSelectDate }: {
  date: string
  onSelectDate?: (date: string) => void
}) {
  const { t } = useTranslation()
  const { data: entries = [], isLoading } = useSleep(180)
  const entry = entries.find(e => e.date === date)

  const summary = entry ? formatDuration(entry.actualSleepMinutes ?? entry.timeInBedMinutes) : undefined

  return (
    <Section module="sleep" title={t('sleep.title')} icon={<Moon size={15} />} summary={summary || undefined}>
      {isLoading
        ? <p className="py-4 text-center text-body text-ink-mute">{t('common.loading')}</p>
        : <SleepForm key={date} date={date} entry={entry} onSelectDate={onSelectDate} />}
    </Section>
  )
}
