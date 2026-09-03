import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDailyReport, useGenerateDailyReport } from '../../../features/dailyReport/hooks'
import { Section } from './Section'
import { Button } from '../../../components/ui/Button'
import { dateLocale } from '../../../i18n'

export function DailyReportSection({ date }: { date: string }) {
  const { t } = useTranslation()
  const { data: report, isLoading } = useDailyReport(date)
  const generate = useGenerateDailyReport()

  const generatedLabel = report?.generatedAt
    ? new Date(report.generatedAt).toLocaleString(dateLocale(), {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <Section module="mind" title={t('dailyReport.title')} icon={<Sparkles size={17} />}>
      {isLoading ? (
        <p className="py-4 text-center text-body text-ink-mute">{t('common.loading')}</p>
      ) : (
        <div className="space-y-3">
          {report?.content ? (
            <>
              <p className="whitespace-pre-wrap text-body text-ink">{report.content}</p>
              {generatedLabel && (
                <p className="text-meta text-ink-faint">
                  {t('dailyReport.generatedAt', { time: generatedLabel })}
                  {' · '}
                  {report.source === 'manual' ? t('dailyReport.sourceManual') : t('dailyReport.sourceScheduled')}
                </p>
              )}
            </>
          ) : (
            <p className="text-body text-ink-mute">{t('dailyReport.empty')}</p>
          )}

          {generate.isError && (
            <p className="text-meta text-bad">{(generate.error as Error).message}</p>
          )}

          <Button
            variant="secondary"
            size="sm"
            loading={generate.isPending}
            onClick={() => generate.mutate(date)}
          >
            {report?.content ? t('dailyReport.regenerate') : t('dailyReport.generate')}
          </Button>
        </div>
      )}
    </Section>
  )
}
