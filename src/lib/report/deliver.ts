export type DeliveryMode = 'share' | 'newtab' | 'download';

/** Decide how to hand a file to the user. Pure decision function so it can be
    unit-tested without touching the DOM. `canPopup` reflects whether opening a
    new tab is viable (caller passes the result of window.open feature support). */
export function chooseDeliveryMode(nav: Navigator, canPopup: boolean): DeliveryMode {
  const n = nav as Navigator & { canShare?: (d?: unknown) => boolean; share?: unknown };
  if (typeof n.canShare === 'function' && typeof n.share === 'function' && n.canShare({ files: [] as unknown as File[] })) {
    return 'share';
  }
  return canPopup ? 'newtab' : 'download';
}

/** Deliver a Blob as a downloadable/sharable file using the best available
    mechanism. Browser-only. */
export async function deliverFile(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: blob.type || 'application/pdf' });
  const n = navigator as Navigator & { canShare?: (d?: unknown) => boolean; share?: (d: unknown) => Promise<void> };
  const mode = chooseDeliveryMode(navigator, typeof window !== 'undefined' && typeof window.open === 'function');

  if (mode === 'share' && n.share && n.canShare?.({ files: [file] })) {
    try {
      await n.share({ files: [file], title: filename });
      return;
    } catch {
      // user cancelled or share failed → fall through to download
    }
  }

  const url = URL.createObjectURL(blob);
  if (mode === 'newtab') {
    const w = window.open(url, '_blank');
    if (w) { setTimeout(() => URL.revokeObjectURL(url), 60_000); return; }
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
