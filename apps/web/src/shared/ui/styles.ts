/** Visible keyboard focus ring shared by links, buttons and form controls. */
export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700';

const buttonBase = `inline-flex min-h-11 items-center justify-center rounded-md px-4 font-medium disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

/** Main action of a screen (links and buttons). */
export const primaryButton = `${buttonBase} bg-teal-700 text-white hover:bg-teal-800`;

/** Secondary action next to a primary one. */
export const secondaryButton = `${buttonBase} border border-slate-400 bg-white text-slate-900 hover:bg-slate-100`;

/** Destructive or irreversible action. */
export const dangerButton = `${buttonBase} bg-red-700 text-white hover:bg-red-800`;

/** Inline text link, e.g. "back" links. */
export const textLink = `inline-block rounded-md font-medium text-teal-800 underline ${focusRing}`;

/** Error message box. */
export const errorBox = 'rounded-xl border border-red-200 bg-red-50 p-4 text-red-900';
