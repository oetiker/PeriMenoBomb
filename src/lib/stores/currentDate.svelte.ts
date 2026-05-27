import { addDays, isValidDateKey, todayKey } from '$lib/utils/date';

let value = $state<string>(todayKey());

export const currentDate = {
  get value() { return value; },
  set(key: string) {
    if (!isValidDateKey(key)) throw new Error(`invalid date key "${key}"`);
    value = key;
  },
  next() { value = addDays(value, 1); },
  prev() { value = addDays(value, -1); },
  reset() { value = todayKey(); }
};
