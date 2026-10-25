import { CUSTOMERS, RECIPES, makeOrder, type GameState, type Order } from './engine';

export const CUSTOMER_QUEUE_SIZE = 3;
const MODIFIERS = ['Biasa', 'Sedikit gula', 'Es ekstra', 'Tanpa es', 'Tanpa susu', 'Buah ekstra', 'Gelas besar'];
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Recover order intent independently of stock: fruit may already be reserved or need restocking. */
function restoreOrder(state: GameState, value: unknown): Order | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id || value.id.length > 150 || state.completedOrderIds.includes(value.id)) return null;
  if (!isRecord(value.customer)) return null;
  const savedCustomer = value.customer;
  const customer = CUSTOMERS.find(item => item.id === savedCustomer.id);
  const recipe = RECIPES.find(item => item.id === value.recipeId && item.unlockDay <= state.day);
  if (!customer || !recipe || typeof value.dialogue !== 'string' || value.dialogue.length > 1500 || typeof value.patience !== 'number' || !Number.isFinite(value.patience) || value.patience <= 0) return null;
  const modifier = typeof value.modifier === 'string' && MODIFIERS.includes(value.modifier) ? value.modifier : 'Biasa';
  // Reuse live objects so waiting people keep their order identity when they move up.
  if ((value as unknown as Order).customer === customer && value.modifier === modifier) return value as unknown as Order;
  return { id: value.id, customer, recipeId: recipe.id, modifier, patience: value.patience, dialogue: value.dialogue };
}

function fillQueue(state: GameState, queue: Order[], excludedCustomerIds: readonly string[] = []): Order[] {
  while (queue.length < CUSTOMER_QUEUE_SIZE) {
    try { queue.push(makeOrder(state, [...excludedCustomerIds, ...queue.map(order => order.customer.id)])); }
    catch { break; } // Closed stand or empty baskets: keep the waiting customers, without inventing stock.
  }
  return queue;
}

/** Restore only this day's saved queue; callers own the session's day check. */
export function createOrderQueue(state: GameState, saved?: unknown): Order[] {
  if (state.dayClosed) return [];
  const queue: Order[] = [];
  const departedCustomerIds: string[] = [];
  if (Array.isArray(saved)) for (const value of saved) {
    if (isRecord(value) && typeof value.id === 'string' && state.completedOrderIds.includes(value.id) && isRecord(value.customer) && typeof value.customer.id === 'string') departedCustomerIds.push(value.customer.id);
    const order = restoreOrder(state, value);
    if (order && !queue.some(item => item.id === order.id || item.customer.id === order.customer.id)) queue.push(order);
    if (queue.length === CUSTOMER_QUEUE_SIZE) break;
  }
  return fillQueue(state, queue, departedCustomerIds);
}

/** Promote the visible next customer once; stale animation callbacks cannot skip another person. */
export function advanceOrderQueue(state: GameState, queue: readonly Order[], departingOrderId: string): Order[] {
  if (state.dayClosed) return [];
  if (queue[0]?.id !== departingOrderId) return [...queue];
  const departed = queue[0];
  const remaining = queue.slice(1).filter(order => !state.completedOrderIds.includes(order.id));
  return fillQueue(state, remaining, [departed.customer.id]);
}
