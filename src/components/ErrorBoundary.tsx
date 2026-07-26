"use client";

import { Component, type ReactNode } from "react";

/**
 * Per-panel error boundary. A single panel that can't render for an asset (e.g.
 * a crypto-only panel fed a stock) shows a small placeholder instead of taking
 * down the whole page. Reset when the symbol changes via the `resetKey` prop.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode; resetKey?: string },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error: unknown) {
    console.error("panel error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="rounded-lg border border-line bg-panel px-3 py-6 text-center text-[10px] text-dim">
            ส่วนนี้แสดงผลไม่ได้สำหรับสินทรัพย์นี้
          </div>
        )
      );
    }
    return this.props.children;
  }
}
