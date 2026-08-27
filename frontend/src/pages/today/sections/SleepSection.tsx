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
  const [awake, setAwake] = useState<number | null>(entry?.awakeMinutes ?? null)
  const [light, setLight] = useState<number | null>(entry?.lightMinutes ?? null)
  const [rem, setRem] = useState<number | null>(entry?.remMinutes ?? null)
  const [deep, setDeep] = useState<number | null>(entry?.deepMinutes ?? null)
  const [onset, setOnset] = useState(entry?.sleepOnsetMinutes == null ? '' : String(entry.sleepOnsetMinutes))
  const [notes, setNotes] = useState(entry?.notes ?? '')

  // Light, REM and deep are the sleep itself; awake is time in bed. Filling
  // them in therefore answers the duration above, which stays editable.
  const phaseSleep = [light, rem, deep].some(v => v != null)
    ? (light ?? 0) + (rem ?? 0) + (deep ?? 0)
    : null

  const sleepMinutes = asleep ?? phaseSleep

  const efficiency = inBed && inBed > 0 && sleepMinutes != null
    ? Math.round((sleepMinutes / inBed) * 100)
    : null

  const tooMuchSleep = inBed != null && sleepMinutes != null && sleepMinutes > inBed

  // The upsert rejects that pair, so it is held back until it makes sense
  // again rather than autosaved into a 400.
  useAutosave(
    {
      date,
      timeInBedMinutes: inBed,
      actualSleepMinutes: asleep ?? phaseSleep,
      awakeMinutes: awake,
      lightMinutes: light,
      remMinutes: rem,
      deepMinutes: deep,
      sleepOnsetMinutes: onset.trim() === '' ? null : Number(onset),
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
          if (f.bedTime) setBedTime(f.bedTime)
          if (f.wakeTime) setWakeTime(f.wakeTime)
          if (f.timeInBedMinutes != null) setInBed(f.timeInBedMinutes)
          else if (f.bedTime && f.wakeTime) setInBed(spanMinutes(f.bedTime, f.wakeTime) ?? inBed)
          if (f.actualSleepMinutes != null) setAsleep(f.actualSleepMinutes)
          if (f.awakeMinutes != null) setAwake(f.awakeMinutes)
          if (f.lightMinutes != null) setLight(f.lightMinutes)
          if (f.remMinutes != null) setRem(f.remMinutes)
          if (f.deepMinutes != null) setDeep(f.deepMinutes)
          if (f.sleepOnsetMinutes != null) setOnset(String(f.sleepOnsetMinutes))
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

      {/* The phases are their own group: four durations that are read off one
          screenshot together and mean little apart. */}
      <div className="space-y-2 rounded-control bg-raised/60 p-3">
        <p className="text-meta text-ink-mute">
          {t('sleep.phases')}
          {phaseSleep != null && (
            <span className="text-ink-faint"> · {formatDuration(phaseSleep)} {t('sleep.phasesSum')}</span>
          )}
        </p>
        <DurationField label={t('sleep.light')} minutes={light} onChange={setLight} />
        <DurationField label={t('sleep.rem')} minutes={rem} onChange={setRem} />
        <DurationField label={t('sleep.deep')} minutes={deep} onChange={setDeep} />
        <DurationField label={t('sleep.awake')} minutes={awake} onChange={setAwake} />

        {/* Minutes only: falling asleep is a handful of them, and an hours
            field next to a 9 would only be a zero to tab past. */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-meta text-ink-mute">{t('sleep.onset')}</span>
          <div className="flex items-baseline gap-1 rounded-control bg-raised px-3 py-2">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={600}
              placeholder="–"
              value={onset}
              onChange={e => setOnset(e.target.value)}
              className="w-16 min-w-0 bg-transparent text-right text-body font-semibold text-ink outline-none"
            />
            <span className="text-meta text-ink-mute">min</span>
          </div>
        </div>
      </div>

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
