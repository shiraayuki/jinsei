import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Without this, a render error unmounts the whole tree and leaves a blank
 * screen with no way back other than restarting the app.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-8 text-center">
        <p className="font-semibold text-gray-900 dark:text-zinc-100">Da ist etwas schiefgelaufen.</p>
        <p className="text-xs text-gray-400 dark:text-zinc-500">{this.state.error.message}</p>
        <button
          onClick={() => window.location.assign('/')}
          className="mt-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Zur Startseite
        </button>
      </div>
    )
  }
}
