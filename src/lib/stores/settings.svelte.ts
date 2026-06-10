import { db } from '$lib/db';

// Selectable granularities for the intensity slider. 1 = stepless (the
// historical free 1..100 behaviour, hence the default so existing users
// notice no change). Coarser values make the slider snap to fewer stops.
export const SLIDER_STEP_OPTIONS = [1, 5, 10, 20, 25] as const;
export type SliderStep = (typeof SLIDER_STEP_OPTIONS)[number];

const SLIDER_STEP_KEY = 'sliderStep';
const DEFAULT_SLIDER_STEP: SliderStep = 1;

function coerce(v: unknown): SliderStep {
  return (SLIDER_STEP_OPTIONS as readonly number[]).includes(v as number)
    ? (v as SliderStep)
    : DEFAULT_SLIDER_STEP;
}

let _sliderStep = $state<SliderStep>(DEFAULT_SLIDER_STEP);

export const settings = {
  get sliderStep(): SliderStep {
    return _sliderStep;
  },
  async setSliderStep(step: SliderStep): Promise<void> {
    _sliderStep = coerce(step);
    await db.meta.put({ key: SLIDER_STEP_KEY, value: _sliderStep });
  }
};

// Read persisted settings at app startup. Called from the root layout's
// onMount alongside the other meta restores. Tolerates a missing/old DB.
export async function loadSettings(): Promise<void> {
  try {
    const row = await db.meta.get(SLIDER_STEP_KEY);
    _sliderStep = coerce(row?.value);
  } catch {
    _sliderStep = DEFAULT_SLIDER_STEP;
  }
}
