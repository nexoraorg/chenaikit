/// <reference types="@testing-library/jest-dom" />

declare namespace jest {
  interface Matchers<R = void> {
    toBeInTheDocument(): R;
    toHaveTextContent(text: string | RegExp): R;
    toHaveClass(...classNames: string[]): R;
    toHaveAttribute(attr: string, value?: string): R;
    toBeDisabled(): R;
  }
}
