import { getOrDefault, setMeta } from './meta';
import { listOccurrenceDates } from './entries';
import { daysBetweenKeys } from '$lib/utils/date';

const META_KEY = 'statusBarItems';

/** One configurable cell in the Day-screen status bar. The `type` discriminator
    keeps the stored shape open for future widget kinds (cycle day, streaks,
    rolling counts …) without a storage migration — readers switch on `type`. */
export type StatusItem = {
  id: string;
  type: 'daysSince';
  symptomId: string;
};

export async function loadStatusItems(): Promise<StatusItem[]> {
  return getOrDefault<StatusItem[]>(META_KEY, []);
}

export async function saveStatusItems(items: StatusItem[]): Promise<void> {
  await setMeta(META_KEY, items);
}

/** Days between `viewedDate` and the most recent occurrence of `symptomId` on
    or before that date. Logged on the viewed day → 0. No occurrence on or
    before the viewed day → null (rendered as a dash). Occurrences strictly
    after the viewed day are ignored so the bar reflects the day in view. */
export async function daysSinceLastOccurrence(
  symptomId: string,
  viewedDate: string
): Promise<number | null> {
  const dates = await listOccurrenceDates(symptomId); // ascending
  let latest: string | null = null;
  for (const d of dates) {
    if (d <= viewedDate) latest = d;
    else break;
  }
  return latest === null ? null : daysBetweenKeys(viewedDate, latest);
}
