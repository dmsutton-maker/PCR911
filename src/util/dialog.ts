import { Alert } from 'react-native';

/**
 * Cross-platform dialogs.
 *
 * React Native's `Alert` has no implementation on web — calls are a silent
 * no-op, which made every error message and every confirmation prompt in the
 * app invisible in the browser build. Pressing a button appeared to do nothing.
 *
 * Everything goes through here instead. See dialog.web.ts for the browser
 * implementation.
 */

export interface ConfirmOptions {
  title: string;
  message?: string;
  /** Label for the affirmative action. Defaults to 'OK'. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the affirmative action as destructive on iOS. */
  destructive?: boolean;
}

/** Show a message with a single dismiss button. */
export function notify(title: string, message?: string): void {
  Alert.alert(title, message);
}

/** Ask a yes/no question. Resolves true when the user confirms. */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(options.title, options.message, [
      {
        text: options.cancelLabel ?? 'Cancel',
        style: 'cancel',
        onPress: () => resolve(false),
      },
      {
        text: options.confirmLabel ?? 'OK',
        style: options.destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}
