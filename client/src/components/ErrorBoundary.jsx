import { Component } from 'react';

/** Last-resort guard so an unexpected rendering bug shows a message instead of a blank page. */
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('ChapterCheck UI error:', error?.name);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="mx-auto mt-16 max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-red-900">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm">ChapterCheck hit an unexpected problem. Your text was not saved anywhere. Please reload the page.</p>
        <button type="button" className="btn btn-primary mt-4" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
