import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Apple, ChevronLeft, ChevronRight, Dumbbell, Footprints, Moon, Scale } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { StatTile } from '../components/charts/StatTile'
import { Block, EmptyHint } from './metrics/Block'
import { num, duration } from './metrics/shared'
import { useWeekReview, type Change } from '../features/review/hooks'
import { mondayOf } from '../lib/stats'
import { shiftIso, todayIso } from '../lib/date'
import { dateLocale } from '../i18n'

/**
 * The week, against the week before it.
 *
 * Every tile is a number with the same number a week earlier underneath it.
 * That is the whole idea: the plain-text week log already says what happened,
 * and saying it again more prettily would not be worth a screen. What it could
 * not say is whether this week was better than the last one.
 */

/** The delta a tile shows, or null when one of the two weeks has no reading. */
function delta(change: Change): number | null {
  return change.now != null && change.before != null ? change.now - change.before : null
}

function goalHint(change: Change, format: (value: number) => string, label: string): string | undefined {
  return change.goal != null ? `${label}: ${format(change.goal)}` : undefined
}

export function WeekReviewPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()

  // The week asked for, defaulting to the one that has just been lived.
  const date = params.get('date') ?? mondayOf(todayIso())
  const monday = mondayOf(date)
  const thisMonday = mondayOf(todayIso())

  const { data: review, isLoading } = useWeekReview(monday)

  const title = useMemo(() => {
    const format = (iso: string, withYear: boolean) =>
      new Date(`${iso}T00:00:00`).toLocaleDateString(dateLocale(), {
        day: 'numeric',
        month: 'short',
        year: withYear ? 'numeric' : undefined,
      })
    return `${format(monday, false)} – ${format(shiftIso(monday, 6), true)}`
  }, [monday])

  function step(weeks: number) {
    setParams({ date: shiftIso(monday, weeks * 7) })
  }

  return (
    <div>
      <PageHeader title={t('review.title')} back />

      <div className="space-y-4 p-4">
        {/* The week being read, and the way to the ones on either side. There
            is no week after this one to look at, so that arrow stops. */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => step(-1)}
            aria-label={t('review.previous')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-raised text-ink-soft hover:bg-line"
          >
            <ChevronLeft size={19} />
          </button>
          <p className="min-w-0 flex-1 truncate text-center text-body font-medium text-ink">{title}</p>
          <button
            onClick={() => step(1)}
            disabled={monday >= thisMonday}
            aria-label={t('review.next')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-raised text-ink-soft hover:bg-line disabled:opacity-30"
          >
            <ChevronRight size={19} />
          </button>
        </div>

        {review == null ? (
          <EmptyHint text={isLoading ? t('common.loading') : t('metrics.empty')} />
        ) : (
          <>
            <Block module="train" icon={<Dumbbell size={17} />} title={t('workouts.title')}>
              <div className="grid grid-cols-2 gap-2">
                <StatTile
                  label={t('review.sessions')}
                  value={num(review.sessions.now)}
                  delta={delta(review.sessions)}
                  digits={0}
                  hint={goalHint(review.sessions, v => num(v), t('metrics.goal'))}
                />
                <StatTile
                  label={t('review.sets')}
                  value={num(review.sets.now)}
                  delta={delta(review.sets)}
                  digits={0}
                  hint={goalHint(review.sets, v => num(v), t('metrics.goal'))}
                />
                <StatTile
                  label={t('review.volume')}
                  value={`${num(review.volumeKg.now)} kg`}
                  delta={delta(review.volumeKg)}
                  digits={0}
                  neutral
                />
              </div>
            </Block>

            <Block module="sleep" icon={<Moon size={17} />} title={t('sleep.title')}>
              <div className="grid grid-cols-2 gap-2">
                <StatTile
                  label={t('review.sleepMean')}
                  value={duration(review.sleepMinutes.now)}
                  delta={delta(review.sleepMinutes)}
                  deltaUnit=" min"
                  digits={0}
                  hint={goalHint(review.sleepMinutes, duration, t('metrics.goal'))}
                />
                <StatTile
                  label={t('review.nights')}
                  value={`${review.sleepNights}/7`}
                  hint={t('review.nightsHint')}
                />
              </div>
            </Block>

            <Block module="food" icon={<Apple size={17} />} title={t('nutrition.title')}>
              <div className="grid grid-cols-2 gap-2">
                <StatTile
                  label={t('nutrition.calories')}
                  value={num(review.kcal.now)}
                  delta={delta(review.kcal)}
                  digits={0}
                  neutral
                  hint={goalHint(review.kcal, v => num(v), t('metrics.goal'))}
                />
                <StatTile
                  label={t('review.onTarget')}
                  value={review.kcal.goal != null ? `${review.kcalOnTargetDays}/${review.kcalDays}` : '–'}
                  hint={review.kcal.goal != null ? t('review.onTargetHint') : t('metrics.noGoal')}
                />
                <StatTile
                  label={t('nutrition.protein')}
                  value={`${num(review.proteinG.now)} g`}
                  delta={delta(review.proteinG)}
                  digits={0}
                  hint={goalHint(review.proteinG, v => `${num(v)} g`, t('metrics.goal'))}
                />
              </div>
            </Block>

            <Block module="move" icon={<Footprints size={17} />} title={t('activity.title')}>
              <StatTile
                label={t('review.stepsMean')}
                value={num(review.steps.now)}
                delta={delta(review.steps)}
                digits={0}
                hint={goalHint(review.steps, v => num(v), t('metrics.goal'))}
              />
            </Block>

            <Block module="body" icon={<Scale size={17} />} title={t('weight.title')}>
              <div className="grid grid-cols-2 gap-2">
                <StatTile
                  label={t('review.trendWeight')}
                  value={review.trendWeightKg.now != null ? `${num(review.trendWeightKg.now, 1)} kg` : '–'}
                  delta={delta(review.trendWeightKg)}
                  digits={2}
                  lowerIsBetter
                  hint={t('metrics.trend')}
                />
                <StatTile
                  label={t('review.rate')}
                  value={review.ratePerWeekKg != null ? t('metrics.body.ratePerWeek', { value: num(review.ratePerWeekKg, 2) }) : '–'}
                  hint={t('review.rateHint')}
                />
              </div>

              {/* The loop from the pace setting, made visible: the target moved
                  this week, so the numbers above were measured against a
                  different line than last week's were. */}
              {review.kcalGoalSetThisWeek && review.kcalGoal != null && (
                <p className="rounded-control bg-raised p-3 text-label text-ink-mute">
                  {t('review.goalMoved', { value: num(review.kcalGoal) })}
                </p>
              )}
            </Block>
          </>
        )}
      </div>
    </div>
  )
}
