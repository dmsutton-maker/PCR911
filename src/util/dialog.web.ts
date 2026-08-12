import type { ConfirmOptions } from './dialog';

/**
 * Browser implementation of the dialog helpers.
 *
 * Uses the native window dialogs. They are plain, but they are synchronous,
 * always visible, and work inside a home-screen PWA — which matters more here
 * than styling, because the alternative (React Native's `Alert`) renders
 * nothing at all on web.
 */

function joinMessage(title: string, message?: string): string {
  return message ? `${title}\n\n${message}` : title;
}

export function notify(title: string, message?: string): void {
  if (typeof window === 'undefined') return;
  window.alert(joinMessage(title, message));
}

export function confirm(options: ConfirmOptions): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  return Promise.resolve(window.confirm(joinMessage(options.title, options.message)));
}

export type { ConfirmOptions };
