import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

type Props = { children: ReactNode };
type State = { hasError: boolean };

/**
 * Last line of defence. Without this a render throw — or a lazy chunk that 404s
 * after a redeploy — unmounts the tree to a blank white page. The error itself
 * is only logged in dev; in production it would just hand a user internals.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('Unhandled render error', error, info.componentStack);
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The page failed to load. Reloading usually fixes it — if it doesn't, contact support.
        </p>
        <Button onClick={() => globalThis.location.reload()}>Reload page</Button>
      </div>
    );
  }
}
