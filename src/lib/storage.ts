/**
 * Browser storage shared by the workbench and the boot script.
 *
 * History, saved words, query and appearance all live in one blob, so the inline
 * theme script in the document has to read the same key the provider writes.
 */
export const WORKBENCH_STORAGE_KEY = "pleco-web:workbench:v1";

/**
 * Applies the saved appearance before the first paint.
 *
 * A React effect runs *after* the browser has already painted, so restoring the
 * theme there makes a dark-mode refresh flash white. This inline script runs
 * while the document is parsing, so the very first frame is already correct.
 * An explicit choice always wins over the OS preference.
 */
export function themeBootScript(): string {
  return `(function(){try{var raw=localStorage.getItem(${JSON.stringify(WORKBENCH_STORAGE_KEY)});var saved=raw?JSON.parse(raw):{};var dark=saved.theme==="dark"||(saved.theme!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var root=document.documentElement;root.classList.toggle("dark",dark);root.style.colorScheme=dark?"dark":"light";}catch(e){}})();`;
}
