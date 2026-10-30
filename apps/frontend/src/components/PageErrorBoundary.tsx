import { Component, type ReactNode } from "react";

// Catches a page that throws while loading or drawing, so the rest of the
// site (header, tab bar) stays usable and there's a way forward instead of
// a blank screen.
export default class PageErrorBoundary extends Component<
  { children: ReactNode; resetKey: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  // Going to another page clears the error.
  componentDidUpdate(previous: { resetKey: string }) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  componentDidCatch(error: unknown) {
    console.error("A page failed to load", error);
  }

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }
    return (
      <div className="card page-error" role="alert">
        <h1>This page didn't load</h1>
        <p>The site may have just been updated. Reloading usually fixes it.</p>
        <button type="button" className="button-primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
