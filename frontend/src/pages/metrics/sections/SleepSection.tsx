import { Clock, Moon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Chart } from '../../../components/charts/Chart'
import { StatTile } from '../../../components/charts/StatTile'
import { BarRow } from '../../../components/charts/BarRow'
import { useAuth } from '../../../app/auth/AuthProvider'
import { useSleep } from '../../../features/sleep/hooks'
import { moduleColor } from '../../../lib/modules'
import {
  byWeekday, clockToNightAxis, consistencyScore, defined, mean, nightAxisToClock,
  sleepMidpoint, socialJetlag, stdDev,
} from '../../../lib/stats'
import { Block, EmptyHint } from '../Block'
import { duration, num, series, splitWindow } from '../shared'

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** What a night is usually made of, as the sleep literature reports it. */
function band(min: number, max: number) {
  const mid = (min + max) / 2
  return { mid, tolerance: (max - min) / 2 / mid, label: `${min}–${max} %` }
}

const DEEP_BAND = band(13, 23)
const REM_BAND = band(20, 25)

type SleepNight = {
  deepMinutes: number | null
  remMinutes: number | null
  lightMinutes: number | null
}

export function SleepSection({ days }: { days: number }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: sleep = [] } = useSleep(days)

  // Time asleep is the number worth trending; time in bed stands in only where
  // the night was logged without it.
  const minutes = series(sleep, e => e.actualSleepMinutes ?? e.timeInBedMinutes, days)

  // The phases as nightly means over the range: what a night was made of, not
  // just how long it was.
  const phaseMeans = [
    { key: 'deep', label: t('sleep.deep'), color: moduleColor.sleep, value: mean(defined(series(sleep, e => e.deepMinutes, days))) },
    { key: 'rem', label: t('sleep.rem'), color: moduleColor.mind, value: mean(defined(series(sleep, e => e.remMinutes, days))) },
    { key: 'light', label: t('sleep.light'), color: moduleColor.move, value: mean(defined(series(sleep, e => e.lightMinutes, days))) },
    { key: 'awake', label: t('sleep.awake'), color: 'var(--ink-mute)', value: mean(defined(series(sleep, e => e.awakeMinutes, days))) },
  ].filter((p): p is typeof p & { value: number } => p.value != null)

  const phaseMax = Math.max(...phaseMeans.map(p => p.value), 1)
  const onsetMean = mean(defined(series(sleep, e => e.sleepOnsetMinutes, days)))
  const inBedMean = mean(defined(series(sleep, e => e.timeInBedMinutes, days)))

  // The night as its parts, stacked, so the bar's height is still the night's
  // length. A night logged before the phases existed — or one the screenshot
  // did not carry them for — keeps its bar in a muted colour rather than
  // leaving a gap where a night was slept.
  const deepPoints = series(sleep, e => e.deepMinutes, days)
  const remPoints = series(sleep, e => e.remMinutes, days)
  const lightPoints = series(sleep, e => e.lightMinutes, days)
  const hasPhases = (e: { deepMinutes: number | null; remMinutes: number | null; lightMinutes: number | null }) =>
    e.deepMinutes != null || e.remMinutes != null || e.lightMinutes != null
  const unsplitPoints = series(
    sleep,
    e => (hasPhases(e) ? null : e.actualSleepMinutes ?? e.timeInBedMinutes),
    days,
  )

  const nights = defined(minutes)
  if (nights.length === 0) {
    return (
      <Block module="sleep" icon={<Moon size={15} />} title={t('sleep.title')}>
        <EmptyHint text={t('metrics.empty')} />
      </Block>
    )
  }

  const goal = user?.sleepGoalMinutes ?? null
  const { current, previous } = splitWindow(minutes, 7)
  const weekMean = mean(defined(current))
  const prevMean = mean(defined(previous))

  const spread = stdDev(nights)
  const durationScore = consistencyScore(spread)
  const weekday = byWeekday(minutes)
  const weekdayMax = Math.max(...weekday.map(v => v ?? 0), 1)

  // The same weekday buckets, one per phase, so a bar can be broken into what
  // the night was made of. A weekday whose nights carry no phases keeps a
  // single-coloured bar — the length is known even when the shape is not.
  const weekdayPhases = [
    { key: 'deep', color: moduleColor.sleep, byDay: byWeekday(deepPoints) },
    { key: 'rem', color: moduleColor.mind, byDay: byWeekday(remPoints) },
    { key: 'light', color: moduleColor.move, byDay: byWeekday(lightPoints) },
  ]

  // Shares of the night, which is how the phases are read: 20 % deep says
  // something on its own, 104 minutes only says it next to the total.
  const phaseTotal = phaseMeans
    .filter(p => p.key !== 'awake')
    .reduce((sum, p) => sum + p.value, 0)

  // Clock times live on an axis anchored at noon, so an evening and the small
  // hours after it are neighbours rather than twenty hours apart.
  const bedPoints = series(sleep, e => (e.bedTime ? clockToNightAxis(e.bedTime) : null), days)
  const wakePoints = series(sleep, e => (e.wakeTime ? clockToNightAxis(e.wakeTime) : null), days)
  const midpoints = series(sleep, e => sleepMidpoint(e.bedTime, e.wakeTime), days)

  const bedMean = mean(defined(bedPoints))
  const wakeMean = mean(defined(wakePoints))
  // Regularity is the spread of the midpoint, not of the duration: a night
  // shifted later as a whole is a shifted night, not a broken one.
  const regularity = stdDev(defined(midpoints))
  // Being woken by an alarm five days a week and by nothing on the other two
  // is living in two time zones; the shift between them is the number the
  // sleep literature calls social jetlag.
  // Both spreads are also given as a score, which is the form these numbers
  // take in every other sleep app; the minutes stay underneath, because that is
  // the part that is actually measured.
  const regularityScore = consistencyScore(regularity)
  const jetlag = socialJetlag(midpoints)

  /**
   * A phase as its share of the night, per night. Nights without phases stay
   * empty rather than counting as nought percent.
   */
  const shareOf = (pick: (e: SleepNight) => number | null) =>
    series(sleep, e => {
      const total = (e.deepMinutes ?? 0) + (e.remMinutes ?? 0) + (e.lightMinutes ?? 0)
      const value = pick(e)
      return total > 0 && value != null ? (value / total) * 100 : null
    }, days)

  const deepShare = shareOf(e => e.deepMinutes)
  const remShare = shareOf(e => e.remMinutes)
  const hasShares = defined(deepShare).length > 0
  const hasTimes = defined(bedPoints).length > 0

  return (
    <>
      <Block module="sleep" icon={<Moon size={15} />} title={t('metrics.sleep.duration')}>
        <div className="grid grid-cols-2 gap-2">
          <StatTile
            label={t('sleep.avgDuration')}
            value={duration(weekMean)}
            hint={t('metrics.trend')}
            delta={weekMean != null && prevMean != null ? (weekMean - prevMean) / 60 : null}
            deltaUnit=" h"
            spark={minutes}
            color={moduleColor.sleep}
            smooth={7}
          />
          <StatTile
            label={`Ø ${t('sleep.timeInBed')}`}
            value={duration(inBedMean)}
            hint={t('metrics.perNight')}
          />
          <StatTile
            label={`Ø ${t('sleep.onset')}`}
            value={onsetMean != null ? `${num(onsetMean)} min` : '–'}
            hint={t('metrics.perNight')}
          />
          <StatTile
            label={t('metrics.sleep.consistency')}
            value={durationScore != null ? `${durationScore} / 100` : '–'}
            hint={spread != null ? `± ${duration(spread)}` : t('metrics.sleep.consistencyHint')}
          />
        </div>

        <Chart
          series={[
            { label: t('sleep.deep'), color: moduleColor.sleep, points: deepPoints, kind: 'bar', stack: 'night', unit: ' h', scaleWith: 'night' },
            { label: t('sleep.rem'), color: moduleColor.mind, points: remPoints, kind: 'bar', stack: 'night', unit: ' h', scaleWith: 'night' },
            { label: t('sleep.light'), color: moduleColor.move, points: lightPoints, kind: 'bar', stack: 'night', unit: ' h', scaleWith: 'night' },
            { label: t('metrics.sleep.unsplit'), color: 'var(--line-strong)', points: unsplitPoints, kind: 'bar', stack: 'unsplit', unit: ' h', scaleWith: 'night' },
          ]}
          goal={goal != null ? { value: goal, label: t('metrics.goal') } : undefined}
          format={v => num(v / 60, 1)}
          empty={t('metrics.empty')}
        />
      </Block>

      {phaseMeans.length > 0 && (
        <Block module="sleep" icon={<Moon size={15} />} title={t('sleep.phases')} summary={t('metrics.perNight')}>
          <div className="space-y-2">
            {phaseMeans.map(p => (
              <BarRow
                key={p.key}
                label={p.label}
                value={p.value}
                max={phaseMax}
                color={p.color}
                hint={
                  p.key === 'awake' || phaseTotal <= 0
                    ? duration(p.value)
                    : `${duration(p.value)} · ${Math.round((p.value / phaseTotal) * 100)} %`
                }
              />
            ))}
          </div>
        </Block>
      )}

      {hasShares && (
        <Block module="sleep" icon={<Moon size={15} />} title={t('metrics.sleep.shares')}>
          {/* The bands are the range a healthy adult night usually falls in —
              13–23 % deep, 20–25 % REM. They are a reference, not a goal: a
              night outside them is worth a look, not a verdict. */}
          <p className="text-meta text-ink-mute">{t('sleep.deep')}</p>
          <Chart
            series={[{ label: t('sleep.deep'), color: moduleColor.sleep, points: deepShare, unit: ' %', averageOver: 7 }]}
            goal={{ value: DEEP_BAND.mid, label: DEEP_BAND.label, tolerance: DEEP_BAND.tolerance }}
            format={v => num(v)}
          />

          <p className="text-meta text-ink-mute">{t('sleep.rem')}</p>
          <Chart
            series={[{ label: t('sleep.rem'), color: moduleColor.mind, points: remShare, unit: ' %', averageOver: 7 }]}
            goal={{ value: REM_BAND.mid, label: REM_BAND.label, tolerance: REM_BAND.tolerance }}
            format={v => num(v)}
          />

          <p className="text-label text-ink-faint">{t('metrics.sleep.sharesHint')}</p>
        </Block>
      )}

      <Block module="sleep" icon={<Clock size={15} />} title={t('metrics.sleep.clockChart')}>
        {hasTimes ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <StatTile
                label={t('metrics.sleep.bedAvg')}
                value={bedMean != null ? nightAxisToClock(bedMean) : '–'}
              />
              <StatTile
                label={t('metrics.sleep.wakeAvg')}
                value={wakeMean != null ? nightAxisToClock(wakeMean) : '–'}
              />
              <StatTile
                label={t('metrics.sleep.regularity')}
                value={regularityScore != null ? `${regularityScore} / 100` : '–'}
                hint={regularity != null ? `± ${duration(regularity)}` : t('metrics.sleep.regularityHint')}
              />
            </div>

            <div className="grid grid-cols-1 gap-2">
              <StatTile
                label={t('metrics.sleep.jetlag')}
                value={jetlag != null ? duration(jetlag) : '–'}
                hint={t('metrics.sleep.jetlagHint')}
              />
            </div>

            {/* Both lines share one scale, so the band between them is the
                night itself. */}
            <Chart
              series={[
                { label: t('metrics.sleep.bedAvg'), color: moduleColor.sleep, points: bedPoints, scaleWith: 'clock' },
                { label: t('metrics.sleep.wakeAvg'), color: moduleColor.mind, points: wakePoints, scaleWith: 'clock' },
              ]}
              format={nightAxisToClock}
              empty={t('metrics.sleep.needsTimes')}
            />
          </>
        ) : (
          <EmptyHint text={t('metrics.sleep.needsTimes')} />
        )}
      </Block>

      <Block module="sleep" icon={<Moon size={15} />} title={t('metrics.sleep.byWeekday')}>
        <div className="space-y-1.5">
          {weekday.map((value, i) => (
            <BarRow
              key={WEEKDAYS[i]}
              label={WEEKDAYS[i]}
              value={value ?? 0}
              max={weekdayMax}
              color={moduleColor.sleep}
              segments={weekdayPhases
                .map(p => ({ key: p.key, value: p.byDay[i] ?? 0, color: p.color }))
                .filter(p => p.value > 0)}
              hint={value != null ? duration(value) : '–'}
            />
          ))}
        </div>
      </Block>

    </>
  )
}
