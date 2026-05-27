import { error } from '@sveltejs/kit';
import { isValidDateKey } from '$lib/utils/date';

export const prerender = false;

export function load({ params }: { params: { date: string } }) {
  if (!isValidDateKey(params.date)) throw error(404, 'Ungültiges Datum');
  return { date: params.date };
}
