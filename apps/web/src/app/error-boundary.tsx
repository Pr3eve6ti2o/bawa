import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onError?: (error: { message: string }) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

const SAFE_ERROR_MESSAGE = "Something went wrong while displaying this page.";

// Boundaries catch render errors only, never async refresh failures —
// the refresh path has its own explicit failure state.
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(_error: unknown): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(_error: Error): void {
    // Even an error's message can hold wallet secrets, so report a fixed safe one.
    this.props.onError?.({ message: SAFE_ERROR_MESSAGE });
  }

  private readonly resetError = (): void => {
    this.setState({ hasError: false });
  };

  override render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div role="alert">
        <h2>{this.props.fallbackTitle ?? "Something went wrong"}</h2>
        <p>{SAFE_ERROR_MESSAGE}</p>
        <button type="button" onClick={this.resetError}>
          Try again
        </button>
      </div>
    );
  }
}
