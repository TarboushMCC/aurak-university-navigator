import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Catches data-validation errors thrown by CampusProvider (docs/PLAN.md §3.4:
 * "the app refuses to boot with invalid data") and shows them plainly instead
 * of a blank white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("University Navigator crashed:", error, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="flex h-dvh w-full items-center justify-center bg-(--color-ground) p-6">
          <div className="max-w-lg rounded-xl border border-red-300 bg-red-50 p-6 text-red-900">
            <h1 className="mb-2 text-lg font-bold">Campus data failed to load</h1>
            <pre className="max-h-80 overflow-auto text-xs whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
