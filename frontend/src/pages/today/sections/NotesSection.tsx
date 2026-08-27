import { useState } from 'react'
import { NotebookPen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDayNote, useUpsertDayNote } from '../../../features/notes/hooks'
import { Section, SaveStatus } from './Section'
import { useAutosave } from '../../../lib/useAutosave'

/**
 * The day in words, on its own row rather than tucked under a measurement.
 *
 * It used to be two note fields, one under the weight and one under the night,
 * which meant deciding where a sentence about the day belonged before writing
 * it — and then only finding it again by opening the right card.
 */
function NoteForm({ date, initial }: { date: string; initial: string }) {
  const { t } = useTranslation()
  const upsert = useUpsertDayNote()
  const [text, setText] = useState(initial)

  useAutosave({ date, text: text.trim() === '' ? null : text }, values => upsert.mutate(values))

  return (
    <div className="space-y-3">
      <textarea
        rows={4}
        placeholder={t('notes.placeholder')}
        value={text}
        onChange={e => setText(e.target.value)}
        className="w-full resize-none rounded-control border border-line bg-raised px-3 py-2 text-body text-ink outline-none focus:ring-2 focus:ring-accent"
      />

      <SaveStatus
        pending={upsert.isPending}
        savedAt={upsert.isSuccess ? upsert.submittedAt : undefined}
        error={upsert.error}
      />
    </div>
  )
}

export function NotesSection({ date }: { date: string }) {
  const { t } = useTranslation()
  const { data: note, isLoading } = useDayNote(date)

  // A note is long enough to be worth a hint of, but not in full: the summary
  // line is one line, and the card is right underneath it.
  const summary = note?.text ? note.text.split('\n')[0].slice(0, 40) : undefined

  return (
    <Section module="mind" title={t('notes.title')} icon={<NotebookPen size={17} />} summary={summary}>
      {isLoading
        ? <p className="py-4 text-center text-body text-ink-mute">{t('common.loading')}</p>
        : <NoteForm key={date} date={date} initial={note?.text ?? ''} />}
    </Section>
  )
}
