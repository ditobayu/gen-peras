import { RECIPES, recipeIngredients } from './engine';

/** Input-driven drink preparation. This module never touches business inventory or money. */
export type PrepPhase = 'select' | 'cut' | 'load' | 'blend' | 'pour' | 'ready' | 'serve' | 'react' | 'done';
export type BlendQuality = 'chunky' | 'almost' | 'perfect' | 'over';
export type PrepAction = 'none' | 'pick' | 'slice' | 'load' | 'ice' | 'liquid' | 'blend' | 'pour' | 'serve';
export interface PrepState {
  version: 1;
  phase: PrepPhase;
  recipeId: string;
  modifier: string;
  selectedFruits: string[];
  requiredFruits: string[];
  cuts: number;
  cutsRequired: 3;
  loadedPortions: number;
  iceAdded: boolean;
  liquidAdded: boolean;
  liquidType: 'water' | 'milk' | null;
  blendSeconds: number;
  blendQuality: BlendQuality;
  blendHeld: boolean;
  tilt: number;
  pouringHeld: boolean;
  /** Cup units. One unit is the cup's physical rim. */
  fill: number;
  /** Fraction of the full jar, 0..1. */
  remaining: number;
  /** Lost cup units, including overflow and the brief stream tail. */
  spilled: number;
  totalVolume: 1.15;
  /** Current stream rate in cup units/second, useful for rendering the release tail. */
  flow: number;
  elapsed: number;
  lastCutAt: number;
  gesture: number;
  transfer: number;
  animation: number;
  quality: number;
  lastAction: PrepAction;
  actionAge: number;
  eventIds: string[];
}

type Identified = { id?: string };
export type PrepEvent = Identified & (
  | { type: 'PICK_FRUIT'; fruit: string }
  | { type: 'SLICE'; distance: number }
  | { type: 'LOAD_PORTION' }
  | { type: 'ADD_ICE' }
  | { type: 'ADD_LIQUID'; liquid?: 'water' | 'milk' }
  | { type: 'BLEND_START' }
  | { type: 'BLEND_STOP' }
  | { type: 'POUR_START'; tilt?: number }
  | { type: 'POUR_TILT'; tilt: number }
  | { type: 'POUR_STOP' }
  | { type: 'FINISH_POUR' }
  | { type: 'SERVE' }
  | { type: 'RESET'; recipeId?: string; modifier?: string }
);

const PHASES: PrepPhase[] = ['select', 'cut', 'load', 'blend', 'pour', 'ready', 'serve', 'react', 'done'];
const LEGACY_STAGES = ['select', 'cut', 'add', 'load', 'loaded', 'blend', 'blended', 'pour', 'ready', 'serve', 'done'];
const ACTIONS: PrepAction[] = ['none', 'pick', 'slice', 'load', 'ice', 'liquid', 'blend', 'pour', 'serve'];
const DURATIONS: Record<PrepAction, number> = { none: 0, pick: .48, slice: .36, load: .65, ice: .56, liquid: .68, blend: .3, pour: .35, serve: 2.6 };
export const PREP_TIMING = { sliceCooldown: .16, sliceAnimation: .36, loadAnimation: .65, serve: 2.6, react: 1.6, perfectBlendStart: 3, perfectBlendEnd: 4.5, overblend: 6.5, targetFillMin: .88, targetFillMax: .98, pourThreshold: .2, streamTail: .06 } as const;
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const safe = (value: unknown, fallback: number, min = 0, max = 1e9) => finite(value) ? clamp(value, min, max) : fallback;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const validRecipe = (id: unknown): id is string => typeof id === 'string' && RECIPES.some(recipe => recipe.id === id);
const needsIce = (state: Pick<PrepState, 'modifier'>) => state.modifier !== 'Tanpa es';
const ingredientsLoaded = (state: PrepState) => state.loadedPortions === 2 && state.liquidAdded && (!needsIce(state) || state.iceAdded);

export function createPreparation(recipeId: string, modifier = 'Biasa'): PrepState {
  if (!validRecipe(recipeId)) throw new Error('Resep persiapan tidak ditemukan.');
  return {
    version: 1, phase: 'select', recipeId, modifier,
    selectedFruits: [], requiredFruits: Object.keys(recipeIngredients(recipeId, modifier)),
    cuts: 0, cutsRequired: 3, loadedPortions: 0, iceAdded: false, liquidAdded: false, liquidType: null,
    blendSeconds: 0, blendQuality: 'chunky', blendHeld: false,
    tilt: 0, pouringHeld: false, fill: 0, remaining: 1, spilled: 0, totalVolume: 1.15, flow: 0,
    elapsed: 0, lastCutAt: -10, gesture: 0, transfer: 0, animation: 0,
    quality: 0, lastAction: 'none', actionAge: 0, eventIds: [],
  };
}

export function blendQualityAt(seconds: number): BlendQuality {
  if (seconds > PREP_TIMING.overblend) return 'over';
  if (seconds >= PREP_TIMING.perfectBlendStart) return 'perfect';
  if (seconds >= 1.8) return 'almost';
  return 'chunky';
}
function blendScore(seconds: number): number {
  if (seconds < 1) return clamp(seconds * .3);
  if (seconds < 3) return .3 + (seconds - 1) * .35;
  if (seconds <= 4.5) return 1;
  if (seconds <= 6.5) return 1 - (seconds - 4.5) * .075;
  return Math.max(.5, .85 - (seconds - 6.5) * .055);
}

/** Compare to an order at service; the base score describes the actual prepared drink. */
export function preparationQuality(state: PrepState, expectedRecipeId?: string, expectedModifier?: string): number {
  if (expectedRecipeId && state.recipeId !== expectedRecipeId) return 0;
  if (['select', 'cut', 'load', 'blend'].includes(state.phase)) return 0;
  const fillScore = state.fill < .88 ? clamp(.2 + (state.fill - .4) / .48 * .8) : state.fill <= .98 ? 1 : 1 - (state.fill - .98) * 5;
  let score = blendScore(state.blendSeconds) * .58 + fillScore * .42 - Math.min(.35, state.spilled / state.totalVolume * 2);
  if (state.modifier === 'Tanpa susu' && state.liquidType === 'milk') score *= .68;
  if (expectedModifier !== undefined && state.modifier !== expectedModifier) score *= .68;
  return clamp(score);
}
function withQuality(state: PrepState): PrepState { return { ...state, quality: preparationQuality(state) }; }
function animate(state: PrepState, action: PrepAction): PrepState {
  return { ...state, lastAction: action, actionAge: 0, animation: 0,
    gesture: action === 'slice' ? 0 : state.gesture,
    transfer: ['load', 'ice', 'liquid'].includes(action) ? 0 : state.transfer };
}
function readyToBlend(state: PrepState): PrepState {
  return ingredientsLoaded(state) ? { ...state, phase: 'blend' } : state;
}
function animatedTransferBusy(state: PrepState): boolean {
  return ['load', 'ice', 'liquid'].includes(state.lastAction) && state.actionAge < .24;
}

/** Invalid or repeated input is a no-op. Optional IDs deduplicate a single physical gesture. */
export function reducePreparation(state: PrepState, event: PrepEvent): PrepState {
  if (event.id && state.eventIds.includes(event.id)) return state;
  let next = state;
  switch (event.type) {
    case 'RESET':
      return createPreparation(event.recipeId ?? state.recipeId, event.modifier ?? state.modifier);
    case 'PICK_FRUIT':
      if (state.phase !== 'select' || !state.requiredFruits.includes(event.fruit) || state.selectedFruits.includes(event.fruit)) break;
      next = animate({ ...state, selectedFruits: [...state.selectedFruits, event.fruit] }, 'pick');
      if (next.selectedFruits.length === next.requiredFruits.length) next = { ...next, phase: 'cut' };
      break;
    case 'SLICE':
      if (state.phase !== 'cut' || !finite(event.distance) || event.distance < .08 || state.cuts >= state.cutsRequired || state.elapsed - state.lastCutAt < PREP_TIMING.sliceCooldown) break;
      next = animate({ ...state, cuts: state.cuts + 1, lastCutAt: state.elapsed }, 'slice');
      if (next.cuts === next.cutsRequired) next = { ...next, phase: 'load' };
      break;
    case 'LOAD_PORTION':
      if (state.phase !== 'load' || state.loadedPortions >= 2 || animatedTransferBusy(state)) break;
      next = readyToBlend(animate({ ...state, loadedPortions: state.loadedPortions + 1 }, 'load'));
      break;
    case 'ADD_ICE':
      if (state.phase !== 'load' || state.iceAdded || !needsIce(state) || animatedTransferBusy(state)) break;
      next = readyToBlend(animate({ ...state, iceAdded: true }, 'ice'));
      break;
    case 'ADD_LIQUID':
      if (state.phase !== 'load' || state.liquidAdded || animatedTransferBusy(state)) break;
      next = readyToBlend(animate({ ...state, liquidAdded: true, liquidType: event.liquid ?? (['avocado', 'strawberry', 'banana'].includes(state.recipeId) && state.modifier !== 'Tanpa susu' ? 'milk' : 'water') }, 'liquid'));
      break;
    case 'BLEND_START':
      if (state.phase !== 'blend' || state.blendHeld || !ingredientsLoaded(state)) break;
      next = animate({ ...state, blendHeld: true }, 'blend');
      break;
    case 'BLEND_STOP':
      if (state.phase !== 'blend' || (!state.blendHeld && state.blendSeconds < 1)) break;
      next = { ...state, blendHeld: false };
      if (state.blendSeconds >= 1) next = { ...next, phase: 'pour', tilt: 0 };
      break;
    case 'POUR_START':
      if (state.phase !== 'pour' || state.remaining <= 0 || state.pouringHeld) break;
      next = animate({ ...state, pouringHeld: true, tilt: safe(event.tilt, .65, 0, 1) }, 'pour');
      break;
    case 'POUR_TILT':
      if (state.phase !== 'pour' || !finite(event.tilt)) break;
      next = { ...state, tilt: clamp(event.tilt) };
      break;
    case 'POUR_STOP':
      if (state.phase !== 'pour' || (!state.pouringHeld && state.tilt === 0)) break;
      next = { ...state, pouringHeld: false, tilt: 0 };
      break;
    case 'FINISH_POUR':
      if (state.phase !== 'pour' || state.fill < .4) break;
      next = withQuality(animate({ ...state, phase: 'ready', pouringHeld: false, blendHeld: false, tilt: 0, flow: 0 }, 'pour'));
      break;
    case 'SERVE':
      if (state.phase !== 'ready') break;
      next = animate({ ...state, phase: 'serve', pouringHeld: false, blendHeld: false, flow: 0 }, 'serve');
      break;
  }
  if (next === state) return state;
  return event.id ? { ...next, eventIds: [...next.eventIds, event.id].slice(-128) } : next;
}

/** Advance held controls or authored response motion; waiting alone never prepares a drink. */
export function tickPreparation(state: PrepState, dt: number): PrepState {
  if (!finite(dt) || dt <= 0) return state;
  const delta = Math.min(dt, 60);
  const actionAge = state.actionAge + delta;
  const duration = DURATIONS[state.lastAction];
  let next: PrepState = { ...state, elapsed: state.elapsed + delta, actionAge,
    animation: duration ? clamp(actionAge / duration) : state.animation };
  if (state.lastAction === 'slice') next.gesture = clamp(actionAge / PREP_TIMING.sliceAnimation);
  if (['load', 'ice', 'liquid'].includes(state.lastAction)) next.transfer = duration ? clamp(actionAge / duration) : 1;
  if (state.phase === 'blend' && state.blendHeld) {
    next.blendSeconds = Math.min(120, state.blendSeconds + delta);
    next.blendQuality = blendQualityAt(next.blendSeconds);
  }
  if (state.phase === 'pour') {
    let volume = 0;
    if (state.pouringHeld) {
      next.flow = Math.max(0, (state.tilt - PREP_TIMING.pourThreshold) / (1 - PREP_TIMING.pourThreshold)) * .44;
      volume = next.flow * delta;
    } else if (state.flow > .0001) {
      const decay = Math.exp(-delta / PREP_TIMING.streamTail);
      volume = state.flow * PREP_TIMING.streamTail * (1 - decay);
      next.flow = state.flow * decay;
    } else next.flow = 0;
    const available = state.remaining * state.totalVolume;
    const poured = Math.min(available, volume);
    next.remaining = clamp((available - poured) / state.totalVolume);
    const caught = Math.min(Math.max(0, 1 - state.fill), poured);
    next.fill = clamp(state.fill + caught);
    next.spilled = state.spilled + (poured - caught);
    if (next.remaining <= 1e-9) { next.remaining = 0; next.flow = 0; }
    next = withQuality(next);
  }
  if (state.phase === 'serve' && actionAge >= PREP_TIMING.serve) {
    // Expose react for at least one frame even after a long background frame, so payout cannot be skipped.
    next = { ...next, phase: 'react', actionAge: 0, animation: 0 };
  } else if (state.phase === 'react' && actionAge >= PREP_TIMING.react) next = { ...next, phase: 'done', animation: 1 };
  else if (state.phase === 'react') next.animation = clamp(actionAge / PREP_TIMING.react);
  return next;
}

export function serializePrep(state: PrepState): string {
  return JSON.stringify({ version: 1, preparation: state });
}

function legacyPreparation(recipeId: string, modifier: string, stage: string): PrepState {
  const state = createPreparation(recipeId, modifier);
  if (stage === 'select') return state;
  const selected = { ...state, selectedFruits: [...state.requiredFruits], phase: 'cut' as PrepPhase };
  if (stage === 'cut') return selected;
  const cut = { ...selected, cuts: 3, gesture: 1, phase: 'load' as PrepPhase };
  if (stage === 'add' || stage === 'load') return cut;
  const loaded = { ...cut, loadedPortions: 2, transfer: 1, iceAdded: needsIce(state), liquidAdded: true,
    liquidType: (['avocado', 'strawberry', 'banana'].includes(recipeId) && modifier !== 'Tanpa susu' ? 'milk' : 'water') as 'milk' | 'water', phase: 'blend' as PrepPhase };
  if (stage === 'loaded' || stage === 'blend') return loaded;
  const blended = { ...loaded, blendSeconds: 3.6, blendQuality: 'perfect' as BlendQuality, phase: 'pour' as PrepPhase };
  if (stage === 'blended' || stage === 'pour') return blended;
  const ready = withQuality({ ...blended, fill: .93, remaining: (state.totalVolume - .93) / state.totalVolume, phase: 'ready' });
  return stage === 'done' ? { ...ready, phase: 'done' } : ready;
}

/** Restore only recognized fields, stop held controls, and support legacy reserved preparation checkpoints. */
export function restorePrep(raw: unknown, recipeId?: string, modifier = 'Biasa', legacyStage?: string): PrepState | null {
  try {
    if (typeof raw === 'string' && LEGACY_STAGES.includes(raw)) return validRecipe(recipeId) ? legacyPreparation(recipeId, modifier, raw) : null;
    let parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (record(parsed) && 'preparation' in parsed) {
      if (parsed.version !== 1) return null;
      parsed = parsed.preparation;
    }
    if (!record(parsed) || parsed.version !== 1 || !validRecipe(parsed.recipeId) || !PHASES.includes(parsed.phase as PrepPhase)) {
      const oldStage = legacyStage ?? (typeof raw === 'string' && !raw.startsWith('{') ? raw : undefined);
      return validRecipe(recipeId) && oldStage && LEGACY_STAGES.includes(oldStage) ? legacyPreparation(recipeId, modifier, oldStage) : null;
    }
    if (recipeId && parsed.recipeId !== recipeId) return null;
    const savedModifier = typeof parsed.modifier === 'string' && parsed.modifier.length < 50 ? parsed.modifier : modifier;
    const base = createPreparation(parsed.recipeId, savedModifier);
    const selectedFruits = Array.isArray(parsed.selectedFruits) ? [...new Set(parsed.selectedFruits.filter((fruit): fruit is string => typeof fruit === 'string' && base.requiredFruits.includes(fruit)))] : [];
    const cuts = Math.floor(safe(parsed.cuts, 0, 0, 3));
    const loadedPortions = Math.floor(safe(parsed.loadedPortions, 0, 0, 2));
    const blendSeconds = safe(parsed.blendSeconds, 0, 0, 120);
    const fill = safe(parsed.fill, 0, 0, 1);
    // Reconstruct volume from the cup and loss rather than trusting a second inconsistent saved total.
    const spilled = safe(parsed.spilled, 0, 0, Math.max(0, base.totalVolume - fill));
    const remaining = clamp((base.totalVolume - fill - spilled) / base.totalVolume);
    const elapsed = safe(parsed.elapsed, 0);
    let next: PrepState = { ...base, phase: parsed.phase as PrepPhase, selectedFruits, cuts, loadedPortions,
      iceAdded: parsed.iceAdded === true && needsIce(base), liquidAdded: parsed.liquidAdded === true,
      liquidType: parsed.liquidAdded === true ? parsed.liquidType === 'milk' ? 'milk' : 'water' : null,
      blendSeconds, blendQuality: blendQualityAt(blendSeconds), blendHeld: false,
      pouringHeld: false, tilt: 0, flow: 0, fill, spilled, remaining,
      elapsed, lastCutAt: safe(parsed.lastCutAt, -10, -10, elapsed),
      gesture: safe(parsed.gesture, 0, 0, 1), transfer: safe(parsed.transfer, 0, 0, 1),
      animation: safe(parsed.animation, 0, 0, 1), actionAge: safe(parsed.actionAge, 0),
      lastAction: ACTIONS.includes(parsed.lastAction as PrepAction) ? parsed.lastAction as PrepAction : 'none',
      eventIds: Array.isArray(parsed.eventIds) ? [...new Set(parsed.eventIds.filter((id): id is string => typeof id === 'string' && id.length <= 150))].slice(-128) : [],
    };
    // Inconsistent/corrupt future phases recover to the earliest physically supported stage.
    const previousPhase = next.phase;
    if (next.phase !== 'select' && next.selectedFruits.length !== next.requiredFruits.length) next.phase = 'select';
    else if (['load', 'blend', 'pour', 'ready', 'serve', 'react', 'done'].includes(next.phase) && cuts !== 3) next.phase = 'cut';
    else if (['blend', 'pour', 'ready', 'serve', 'react', 'done'].includes(next.phase) && !ingredientsLoaded(next)) next.phase = 'load';
    else if (['pour', 'ready', 'serve', 'react', 'done'].includes(next.phase) && blendSeconds < 1) next.phase = 'blend';
    else if (['ready', 'serve', 'react', 'done'].includes(next.phase) && fill < .4) next.phase = 'pour';
    if (['select', 'cut', 'load', 'blend'].includes(next.phase)) {
      next = { ...next, fill: 0, spilled: 0, remaining: 1, quality: 0 };
      if (next.phase !== 'blend') next = { ...next, blendSeconds: 0, blendQuality: 'chunky' };
      if (next.phase === 'select' || next.phase === 'cut') next = { ...next, loadedPortions: 0, iceAdded: false, liquidAdded: false, liquidType: null };
    }
    if (next.phase !== previousPhase) next = { ...next, lastAction: 'none', actionAge: 0, animation: 0, transfer: 0 };
    next = withQuality(next);
    return next;
  } catch {
    return validRecipe(recipeId) && legacyStage && LEGACY_STAGES.includes(legacyStage) ? legacyPreparation(recipeId, modifier, legacyStage) : null;
  }
}
