/**
 * Opens a new browser window and writes a complete, self contained HTML
 * document into it directly, rather than navigating to a route: the
 * content this prints exists only in the calling page's memory (see
 * lib/print/login-slip.ts), so there is no route that could re-render it
 * after the fact. Returns false if the browser blocked the popup, so the
 * caller can tell the person to allow it and try again.
 */
export function openPrintWindow(html: string): boolean {
  // Deliberately no "noopener": Chromium returns null from window.open
  // when it is set, which would silently defeat this entirely, since
  // writing the slip into the window is the whole point of opening it.
  // That trade-off (the new window keeps a window.opener reference back
  // here) is the standard one for a same-origin helper window we
  // generate ourselves, not for opening someone else's URL.
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) {
    return false;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  return true;
}
