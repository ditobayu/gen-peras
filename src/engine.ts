/** PERAS! — immutable, local-first business simulation. All money is whole Rupiah. */
export const SAVE_KEY = 'peras.save.v1';
export const SAVE_VERSION = 1 as const;
export const DAY_LENGTH = 8 * 60;

export const FRUITS = [
  { id: 'mango', name: 'Mangga', color: '#ffb746', unitCost: 3000 },
  { id: 'avocado', name: 'Alpukat', color: '#95bc65', unitCost: 4000 },
  { id: 'orange', name: 'Jeruk', color: '#ff9a51', unitCost: 2000 },
  { id: 'watermelon', name: 'Semangka', color: '#ff7393', unitCost: 2500 },
  { id: 'strawberry', name: 'Stroberi', color: '#e86984', unitCost: 4000 },
  { id: 'guava', name: 'Jambu', color: '#f19d9d', unitCost: 2400 },
  { id: 'banana', name: 'Pisang', color: '#f5d675', unitCost: 1800 },
  { id: 'pineapple', name: 'Nanas', color: '#f6c54e', unitCost: 2800 },
] as const;
export type FruitId = typeof FRUITS[number]['id'];
export type Inventory = Record<FruitId, number>;
export interface Recipe {
  id: string; name: string; fruit: FruitId; color: string; price: number; cost: number;
  unlockDay: number; ingredients: Partial<Record<FruitId, number>>; description: string;
  steps: string[]; complexity: number;
}

export const RECIPES: Recipe[] = [
  { id: 'mango', name: 'Jus Mangga', fruit: 'mango', color: '#ffb746', price: 12000, cost: 3000, unlockDay: 1, ingredients: { mango: 1 }, description: 'Manis, kental, matahari dalam gelas.', steps: ['Potong mangga', 'Tambahkan air & es', 'Blender hingga lembut', 'Tuang & sajikan'], complexity: 1 },
  { id: 'avocado', name: 'Jus Alpukat', fruit: 'avocado', color: '#bed583', price: 16000, cost: 4000, unlockDay: 1, ingredients: { avocado: 1 }, description: 'Lembut dan creamy, favorit semua umur.', steps: ['Belah & keruk alpukat', 'Tambahkan susu & es', 'Blender hingga creamy', 'Tuang & sajikan'], complexity: 2 },
  { id: 'orange', name: 'Jus Jeruk', fruit: 'orange', color: '#ffa342', price: 10000, cost: 2000, unlockDay: 1, ingredients: { orange: 1 }, description: 'Segar ceria untuk memulai hari.', steps: ['Kupas jeruk', 'Tambahkan air & es', 'Blender sebentar', 'Tuang & sajikan'], complexity: 1 },
  { id: 'watermelon', name: 'Jus Semangka', fruit: 'watermelon', color: '#f77989', price: 12000, cost: 2500, unlockDay: 1, ingredients: { watermelon: 1 }, description: 'Dingin merah muda, obat panas terik.', steps: ['Potong semangka', 'Tambahkan es', 'Blender hingga segar', 'Tuang & sajikan'], complexity: 1 },
  { id: 'strawberry', name: 'Jus Stroberi', fruit: 'strawberry', color: '#ec88a0', price: 18000, cost: 4000, unlockDay: 2, ingredients: { strawberry: 1 }, description: 'Sedikit asam, banyak senyuman.', steps: ['Bersihkan stroberi', 'Tambahkan susu & es', 'Blender hingga merah muda', 'Tuang & sajikan'], complexity: 2 },
  { id: 'guava', name: 'Jus Jambu', fruit: 'guava', color: '#f0a3a4', price: 13000, cost: 2400, unlockDay: 2, ingredients: { guava: 1 }, description: 'Jambu merah kesukaan tetangga.', steps: ['Potong jambu', 'Tambahkan air & es', 'Blender hingga lembut', 'Tuang & sajikan'], complexity: 2 },
  { id: 'banana', name: 'Jus Pisang', fruit: 'banana', color: '#efda9a', price: 14000, cost: 1800, unlockDay: 3, ingredients: { banana: 1 }, description: 'Lembut, mengenyangkan, bikin semangat.', steps: ['Kupas pisang', 'Tambahkan susu & es', 'Blender hingga creamy', 'Tuang & sajikan'], complexity: 2 },
  { id: 'tropical', name: 'Tropical Mix', fruit: 'pineapple', color: '#ffc163', price: 22000, cost: 7600, unlockDay: 4, ingredients: { mango: 1, pineapple: 1, banana: 1 }, description: 'Mangga, nanas & pisang: liburan kecil.', steps: ['Potong tiga buah tropis', 'Tambahkan air & es', 'Blender pelangi rasa', 'Tuang & sajikan'], complexity: 3 },
];

export const UPGRADES = [
  { id: 'blender', name: 'Blender Ngebut', description: 'Mesin baru, putaran 25% lebih cepat.', price: 60000 },
  { id: 'canopy', name: 'Kanopi Ceria', description: 'Teduh, cantik, pelanggan 20% lebih sabar.', price: 45000 },
  { id: 'plants', name: 'Kebun Mungil', description: 'Tanaman mungil, reputasi naik 5 poin.', price: 25000 },
  { id: 'cups', name: 'Gelas Istimewa', description: 'Gelas lucu menambah Rp1.000 tiap minuman.', price: 50000 },
  { id: 'lights', name: 'Lampu Kelap-kelip', description: 'Warung makin hangat, reputasi naik 5 poin.', price: 40000 },
  { id: 'storage', name: 'Peti Buah Segar', description: 'Kapasitas buah 100, belanja buah lebih hemat 15%.', price: 65000 },
] as const;

export const LOCATIONS = [
  { id: 'gang', name: 'Gang Pagi', description: 'Sudut kecil, tetangga baik, cerita baru.', unlockDay: 1 },
  { id: 'cfd', name: 'CFD Ceria', description: 'Jogger, sepeda, dan banyak orang haus.', unlockDay: 3 },
  { id: 'pasar', name: 'Pasar Sore', description: 'Sore hangat di bawah lampu pasar.', unlockDay: 5 },
  { id: 'festival', name: 'Festival Buah', description: 'Pesta warna dan pelanggan istimewa.', unlockDay: 7 },
] as const;

export interface Appearance {
  name: string; skin: string; hair: string; hairColor: string; shirt: string; apron: string;
  pants: string; shoes: string; glasses: boolean; hat: string; face: string; body: string;
}
export interface Customer {
  id: string; name: string; role: string; color: string; hair: string; dialogues: string[];
}
export const CUSTOMERS: Customer[] = [
  { id: 'raka', name: 'Kak Raka', role: 'Jogger pagi', color: '#ff9a51', hair: 'short', dialogues: ['Lari dua putaran, hausnya dua kelurahan!', 'Bang, yang seger ya. Medali boleh nggak dapat, jus harus!'] },
  { id: 'nia', name: 'Nia', role: 'Mahasiswi', color: '#b9b1de', hair: 'bob', dialogues: ['Teman ngerjain tugas, satu jus dulu dong!', 'Tabungan jajan aman. Mood ujian? Kita bantu pakai jus.'] },
  { id: 'budi', name: 'Pak Budi', role: 'Tetangga langganan', color: '#7dbb81', hair: 'side', dialogues: ['Langganan datang! Buatkan yang paling seger, ya.', 'Jus sini bikin pagi saya punya alasan buat jalan kaki.'] },
  { id: 'sari', name: 'Mbak Sari', role: 'Pekerja kantoran', color: '#efb387', hair: 'ponytail', dialogues: ['Satu jus sebelum rapat. Biar ide ikut seger!', 'Mas, boleh cepat sedikit? Lift kantor nggak nunggu.'] },
  { id: 'wulan', name: 'Bu Wulan', role: 'Ibu & penjelajah rasa', color: '#ec87a0', hair: 'wavy', dialogues: ['Yang manisnya pas, ya. Nanti si kecil ikut nyicip.', 'Anakku penasaran sama blendernya. Kok bisa muter secepat itu?'] },
  { id: 'dimas', name: 'Mas Dimas', role: 'Pesepeda', color: '#7db6ca', hair: 'curly', dialogues: ['Pit stop dulu! Sepeda minum angin, saya minum jus.', 'Jalannya nanjak, semangatnya harus tetap manis.'] },
  { id: 'oma', name: 'Oma Tini', role: 'Pelanggan kesayangan', color: '#d09bcd', hair: 'bun', dialogues: ['Cucu Oma rekomendasiin tempat ini. Bikin Oma bangga, ya!', 'Dulu Oma jualan es. Sekarang gantian Oma yang jajan.'] },
  { id: 'alex', name: 'Alex', role: 'Pelancong', color: '#edd588', hair: 'curly', dialogues: ['Satu jus, please! Wah, buahnya cantik sekali.', 'Indonesia panas, jusnya pas! Saya mau coba rasa baru.'] },
  { id: 'eko', name: 'Kak Eko', role: 'Pelatih kebugaran', color: '#9dc39a', hair: 'buzz', dialogues: ['Habis latihan, waktunya isi energi lagi!', 'Buahnya matang banget. Ini baru recovery favorit saya.'] },
  { id: 'joko', name: 'Bang Joko', role: 'Tetangga paling ceria', color: '#e4a46f', hair: 'side', dialogues: ['Saya nggak haus sih. Cuma kangen jusnya!', 'Warung makin cantik! Jangan lupa pelanggan pertamanya, ya.'] },
];
export interface Order {
  id: string; customer: Customer; recipeId: string; modifier: string; patience: number; dialogue: string;
}
export interface Reservation { orderId: string; recipeId: string; ingredients: Partial<Record<FruitId, number>>; cost: number; modifier?: string }
export interface Receipt {
  day: number; served: number; revenue: number; costs: number; profit: number;
  reputationChange: number; mostPopular: string; satisfaction: number;
}
export interface GameEvent {
  id: string; title: string; description: string; icon: string; duration: number;
  demandMultiplier: number; costMultiplier: number; moneyDelta: number; reputationDelta: number;
}
export interface GameState {
  version: typeof SAVE_VERSION; money: number; inventory: Inventory; day: number; reputation: number;
  served: number; totalServed: number; revenue: number; costs: number; history: Receipt[]; upgrades: string[];
  appearance: Appearance; location: string; settings: { music: number; sfx: number; muted: boolean; reducedMotion: boolean };
  dayElapsed: number; priceMultiplier: number; completedOrderIds: string[]; reservations: Record<string, Reservation>;
  recipeSales: Record<string, number>; dayStartReputation: number; perfectServes: number; dayClosed: boolean;
  activeEvent: GameEvent | null; appliedEventIds: string[];
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const whole = (n: number) => Math.round(n);
let fallbackUidSequence = 0;
const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${(++fallbackUidSequence).toString(36)}-${Math.random().toString(36).slice(2)}`;
const recipeById = (id: string) => { const recipe = RECIPES.find(r => r.id === id); if (!recipe) throw new Error('Resep tidak ditemukan.'); return recipe; };
export const formatRupiah = (value: number) => `Rp${Math.round(value).toLocaleString('id-ID')}`;
export const dailyTarget = (value: number | GameState) => Math.min(20, 8 + (Math.max(1, typeof value === 'number' ? value : value.day) - 1) * 2);
export const unlockedRecipes = (state: GameState) => RECIPES.filter(recipe => recipe.unlockDay <= state.day);
export const unlockedLocations = (state: GameState) => LOCATIONS.filter(location => location.unlockDay <= state.day);
export const inventoryCapacity = (state: GameState) => state.upgrades.includes('storage') ? 100 : 40;
export const preparationSpeed = (state: GameState) => state.upgrades.includes('blender') ? .75 : 1;
export const demandMultiplier = (state: GameState) => (state.location === 'cfd' ? 1.3 : state.location === 'festival' ? 1.5 : 1) * (state.activeEvent?.demandMultiplier ?? 1) / Math.max(.65, state.priceMultiplier);
export const sellingPrice = (state: GameState, recipeId: string) => whole(recipeById(recipeId).price * state.priceMultiplier) + (state.upgrades.includes('cups') ? 1000 : 0);
/** Extra fruit adds one portion of the hero fruit; a large cup doubles the recipe. */
export function recipeIngredients(recipeId: string, modifier = 'Biasa'): Partial<Record<FruitId, number>> {
  const recipe = recipeById(recipeId);
  const ingredients = { ...recipe.ingredients };
  if (modifier === 'Buah ekstra') ingredients[recipe.fruit] = (ingredients[recipe.fruit] ?? 0) + 1;
  if (modifier === 'Gelas besar') for (const fruit of Object.keys(ingredients) as FruitId[]) ingredients[fruit] = ingredients[fruit]! * 2;
  return ingredients;
}
export const fruitPrice = (state: GameState, fruitId: FruitId) => {
  const fruit = FRUITS.find(f => f.id === fruitId); if (!fruit) throw new Error('Buah tidak ditemukan.');
  return whole(fruit.unitCost * (state.upgrades.includes('storage') ? .85 : 1) * (state.activeEvent?.costMultiplier ?? 1));
};

export function newGame(): GameState {
  return {
    version: SAVE_VERSION, money: 75000,
    inventory: Object.fromEntries(FRUITS.map(fruit => [fruit.id, 12])) as Inventory,
    day: 1, reputation: 70, served: 0, totalServed: 0, revenue: 0, costs: 0, history: [], upgrades: [],
    appearance: { name: 'Dito', skin: '#c88f6a', hair: 'curly', hairColor: '#44312d', shirt: '#fff3d8', apron: '#7dbb81', pants: '#596b58', shoes: '#fff3d8', glasses: false, hat: 'none', face: 'cheerful', body: 'regular' },
    location: 'gang', settings: { music: .35, sfx: .65, muted: false, reducedMotion: false },
    dayElapsed: 0, priceMultiplier: 1, completedOrderIds: [], reservations: {}, recipeSales: {},
    dayStartReputation: 70, perfectServes: 0, dayClosed: false, activeEvent: null, appliedEventIds: [],
  };
}

/** Creates an order without changing state. Persist its ID before beginning preparation. */
export function makeOrder(state: GameState, excludedCustomerIds: readonly string[] = []): Order {
  if (state.dayClosed) throw new Error('Warung sudah tutup. Mulai hari baru dulu, yuk!');
  const choices = unlockedRecipes(state).filter(recipe => Object.entries(recipe.ingredients).every(([fruit, amount]) => state.inventory[fruit as FruitId] >= amount!));
  if (!choices.length) throw new Error('Buah habis. Belanja persediaan dulu, yuk!');
  // First-time players meet a friendly mango customer; later arrivals vary naturally.
  const first = state.totalServed === 0 && excludedCustomerIds.length === 0;
  const recipe = first ? (choices.find(r => r.id === 'mango') ?? choices[0]) : choices[Math.floor(Math.random() * choices.length)];
  const roster = CUSTOMERS.slice(0, Math.min(CUSTOMERS.length, 4 + state.day)).filter(customer => !excludedCustomerIds.includes(customer.id));
  if (!roster.length) throw new Error('Semua pelanggan sedang mengantre.');
  const customer = first ? CUSTOMERS[0] : roster[Math.floor(Math.random() * roster.length)];
  const modifiers = state.day === 1 ? ['Biasa'] : state.day === 2 ? ['Biasa', 'Sedikit gula', 'Es ekstra'] : ['Biasa', 'Sedikit gula', 'Es ekstra', 'Tanpa es', 'Tanpa susu', 'Buah ekstra', 'Gelas besar'];
  const possibleModifiers = modifiers.filter(modifier => Object.entries(recipeIngredients(recipe.id, modifier)).every(([fruit, amount]) => state.inventory[fruit as FruitId] >= amount!));
  const modifier = possibleModifiers[Math.floor(Math.random() * possibleModifiers.length)];
  const special = modifier === 'Biasa' ? '' : ` ${modifier.toLowerCase()}, ya!`;
  const dialogue = first ? 'Bang, jus mangganya satu dong! Habis lari nih.' : `${customer.dialogues[Math.floor(Math.random() * customer.dialogues.length)]} ${recipe.name} satu, dong.${special}`;
  return { id: uid(), customer, recipeId: recipe.id, modifier, patience: whole((70 + (state.day === 1 ? 20 : 0)) * (state.upgrades.includes('canopy') ? 1.2 : 1) / Math.max(1, state.priceMultiplier * .9)), dialogue };
}

/** Ingredients and their cost basis are committed exactly once, before the 3D preparation. */
export function reserveIngredients(state: GameState, recipeId: string, orderId?: string, modifier = 'Biasa'): { state: GameState; ok: boolean; error?: string } {
  if (state.dayClosed) return { state, ok: false, error: 'Warung sudah tutup.' };
  if (orderId && state.completedOrderIds.includes(orderId)) return { state, ok: false, error: 'Pesanan ini sudah disajikan.' };
  const existing = orderId ? state.reservations[orderId] : undefined;
  if (existing) return existing.recipeId === recipeId ? { state, ok: true } : { state, ok: false, error: 'Pesanan ini sudah menggunakan buah lain.' };
  const recipe = RECIPES.find(r => r.id === recipeId);
  if (!recipe || recipe.unlockDay > state.day) return { state, ok: false, error: 'Resep ini belum tersedia.' };
  const ingredients = recipeIngredients(recipeId, modifier);
  for (const [fruit, quantity] of Object.entries(ingredients)) {
    if (state.inventory[fruit as FruitId] < quantity!) return { state, ok: false, error: `${FRUITS.find(f => f.id === fruit)?.name} habis. Belanja dulu, yuk!` };
  }
  const inventory = { ...state.inventory };
  for (const [fruit, quantity] of Object.entries(ingredients)) inventory[fruit as FruitId] -= quantity!;
  const id = orderId ?? `unassigned:${uid()}`;
  const cost = Object.entries(ingredients).reduce((sum, [fruit, quantity]) => sum + FRUITS.find(f => f.id === fruit)!.unitCost * quantity!, 0);
  return { ok: true, state: { ...state, inventory, costs: state.costs + cost, reservations: { ...state.reservations, [id]: { orderId: id, recipeId, ingredients, cost, modifier } } } };
}

/** A duplicate completion is a no-op, including after a refresh. No inventory changes here. */
export function completeOrder(state: GameState, order: Order, recipeId: string, perfect: boolean): GameState {
  if (state.completedOrderIds.includes(order.id)) return state;
  if (state.dayClosed) throw new Error('Pesanan tidak bisa disajikan setelah warung tutup.');
  const direct = state.reservations[order.id];
  const reservationKey = direct ? order.id : Object.keys(state.reservations).find(key => key.startsWith('unassigned:') && state.reservations[key].recipeId === recipeId);
  if (!reservationKey || state.reservations[reservationKey].recipeId !== recipeId) throw new Error('Siapkan bahan pesanan ini sebelum menyajikan.');
  const correct = order.recipeId === recipeId;
  const price = sellingPrice(state, recipeId);
  const tip = correct && perfect ? Math.max(1000, whole(price * .15 / 500) * 500) : 0;
  // A wrong drink still consumes its ingredients, but the customer does not pay.
  const payment = correct ? price + tip : 0;
  const reservations = { ...state.reservations }; delete reservations[reservationKey];
  return { ...state, money: state.money + payment, revenue: state.revenue + payment,
    reputation: clamp(state.reputation + (correct ? perfect ? 1.5 : .5 : -3), 0, 100),
    served: state.served + 1, totalServed: state.totalServed + 1,
    perfectServes: state.perfectServes + (correct && perfect ? 1 : 0),
    recipeSales: { ...state.recipeSales, [recipeId]: (state.recipeSales[recipeId] ?? 0) + (correct ? 1 : 0) },
    reservations, completedOrderIds: [...state.completedOrderIds, order.id] };
}

export function buyUpgrade(state: GameState, id: string): GameState {
  const upgrade = UPGRADES.find(item => item.id === id);
  if (!upgrade) throw new Error('Peningkatan tidak ditemukan.');
  if (state.upgrades.includes(id)) throw new Error('Peningkatan ini sudah terpasang.');
  if (state.money < upgrade.price) throw new Error(`Butuh ${formatRupiah(upgrade.price - state.money)} lagi. Semangat jualan!`);
  return { ...state, money: state.money - upgrade.price, upgrades: [...state.upgrades, id], reputation: clamp(state.reputation + (id === 'plants' || id === 'lights' ? 5 : 0), 0, 100) };
}

export function restock(state: GameState, fruit: FruitId, quantity: number): GameState {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Pilih jumlah buah yang bulat dan lebih dari nol.');
  const price = fruitPrice(state, fruit) * quantity;
  if (state.inventory[fruit] + quantity > inventoryCapacity(state)) throw new Error(`Peti hanya muat ${inventoryCapacity(state)} porsi tiap buah.`);
  if (state.money < price) throw new Error(`Uang belum cukup. Perlu ${formatRupiah(price)}.`);
  return { ...state, money: state.money - price, inventory: { ...state.inventory, [fruit]: state.inventory[fruit] + quantity } };
}

export function endDay(state: GameState): { state: GameState; receipt: Receipt } {
  const existing = state.history.find(receipt => receipt.day === state.day);
  if (existing) return { state, receipt: existing };
  const popular = Object.entries(state.recipeSales).sort((a, b) => b[1] - a[1])[0];
  const receipt: Receipt = { day: state.day, served: state.served, revenue: state.revenue, costs: state.costs,
    profit: state.revenue - state.costs, reputationChange: Math.round((state.reputation - state.dayStartReputation) * 10) / 10,
    mostPopular: popular && popular[1] ? (RECIPES.find(recipe => recipe.id === popular[0])?.name ?? '—') : 'Belum ada',
    satisfaction: state.served ? Math.round(clamp((Object.values(state.recipeSales).reduce((sum, count) => sum + count, 0) * .8 + state.perfectServes * .2) / state.served * 100, 0, 100)) : 0 };
  return { receipt, state: { ...state, dayClosed: true, activeEvent: null, reservations: {}, history: [...state.history, receipt] } };
}

export function nextDay(state: GameState): GameState {
  const closed = endDay(state).state;
  return { ...closed, day: closed.day + 1, served: 0, revenue: 0, costs: 0, dayElapsed: 0,
    recipeSales: {}, perfectServes: 0, dayStartReputation: closed.reputation,
    dayClosed: false, activeEvent: null, reservations: {} };
}
export function updateAppearance(state: GameState, changes: Partial<Appearance>): GameState {
  return { ...state, appearance: { ...state.appearance, ...changes, name: (changes.name ?? state.appearance.name).slice(0, 30) } };
}
export function moveLocation(state: GameState, id: string): GameState {
  if (!unlockedLocations(state).some(location => location.id === id)) throw new Error('Lokasi ini belum terbuka.');
  return { ...state, location: id };
}

const EVENTS: Omit<GameEvent, 'id'>[] = [
  { title: 'PANAS BANGET!', description: 'Matahari lagi semangat. Pelanggan datang 35% lebih cepat selama 80 detik!', icon: 'sun', duration: 80, demandMultiplier: 1.35, costMultiplier: 1, moneyDelta: 0, reputationDelta: 0 },
  { title: 'YAH, HUJAN!', description: 'Hujan tropis sebentar. Pelanggan datang lebih pelan selama 65 detik.', icon: 'rain', duration: 65, demandMultiplier: .65, costMultiplier: 1, moneyDelta: 0, reputationDelta: 0 },
  { title: 'REZEKI TETANGGA!', description: 'Pak RT kasih tip Rp10.000. Katanya jusmu bikin rapat jadi adem.', icon: 'gift', duration: 45, demandMultiplier: 1, costMultiplier: 1, moneyDelta: 10000, reputationDelta: 2 },
  { title: 'BUAH LAGI LANGKA', description: 'Harga belanja buah naik 25% selama 80 detik. Jaga stokmu!', icon: 'fruit', duration: 80, demandMultiplier: 1, costMultiplier: 1.25, moneyDelta: 0, reputationDelta: 0 },
  { title: 'RAMAI DI GRUP RT!', description: 'Warungmu direkomendasikan tetangga. Reputasi +3, pelanggan makin ramai!', icon: 'star', duration: 80, demandMultiplier: 1.3, costMultiplier: 1, moneyDelta: 0, reputationDelta: 3 },
];
export function generateEvent(state: GameState): GameEvent {
  const eligible = state.day === 1 ? [EVENTS[0], EVENTS[2]] : EVENTS;
  return { ...eligible[Math.floor(Math.random() * eligible.length)], id: uid() };
}
export function applyEvent(state: GameState, event: GameEvent): GameState {
  if (state.appliedEventIds.includes(event.id) || state.dayClosed) return state;
  return { ...state, activeEvent: { ...event }, money: Math.max(0, state.money + event.moneyDelta),
    reputation: clamp(state.reputation + event.reputationDelta, 0, 100), appliedEventIds: [...state.appliedEventIds, event.id] };
}

/** Storage is an optional capability: quota errors/private browsing never break play. */
export function saveGame(state: GameState): boolean {
  try { globalThis.localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state })); return true; }
  catch { return false; }
}
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const number = (value: unknown, fallback: number, min = 0, max = 1e12) => typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback;
const list = (value: unknown) => Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length < 150))] : [];
export function loadGame(): GameState | null {
  try {
    const raw: unknown = JSON.parse(globalThis.localStorage.getItem(SAVE_KEY) ?? 'null');
    if (!isRecord(raw) || raw.version !== SAVE_VERSION || !isRecord(raw.state)) return null;
    const saved = raw.state;
    // Recognize a genuine save before recovering optional or partially missing fields.
    if (saved.version !== SAVE_VERSION || !Number.isInteger(saved.day) || !isRecord(saved.inventory) || !isRecord(saved.appearance)) return null;
    const base = newGame();
    const savedInventory = saved.inventory;
    const inventory = Object.fromEntries(FRUITS.map(fruit => [fruit.id, Math.floor(number(savedInventory[fruit.id], 0, 0, 100))])) as Inventory;
    const upgrades = list(saved.upgrades).filter(id => UPGRADES.some(upgrade => upgrade.id === id));
    const completedOrderIds = list(saved.completedOrderIds);
    const reservations: Record<string, Reservation> = {};
    if (isRecord(saved.reservations)) for (const [key, value] of Object.entries(saved.reservations)) {
      if (key.length > 150 || completedOrderIds.includes(key) || !isRecord(value) || typeof value.recipeId !== 'string') continue;
      const recipe = RECIPES.find(item => item.id === value.recipeId); if (!recipe) continue;
      const modifier = typeof value.modifier === 'string' && value.modifier.length < 40 ? value.modifier : 'Biasa';
      const ingredients = recipeIngredients(recipe.id, modifier);
      const cost = Object.entries(ingredients).reduce((sum, [fruit, quantity]) => sum + FRUITS.find(item => item.id === fruit)!.unitCost * quantity!, 0);
      reservations[key] = { orderId: key, recipeId: recipe.id, ingredients, cost, modifier };
    }
    const appearance = { ...base.appearance };
    for (const key of Object.keys(appearance) as (keyof Appearance)[]) {
      const value = saved.appearance[key];
      if (key === 'glasses') appearance.glasses = typeof value === 'boolean' ? value : false;
      else if (typeof value === 'string' && value.length <= 60) (appearance as unknown as Record<string, unknown>)[key] = value;
    }
    const day = Math.floor(number(saved.day, 1, 1, 99999));
    const location = LOCATIONS.find(item => item.id === saved.location && item.unlockDay <= day)?.id ?? 'gang';
    const settings = isRecord(saved.settings) ? saved.settings : {};
    const savedSales = isRecord(saved.recipeSales) ? saved.recipeSales : {};
    const recipeSales = Object.fromEntries(RECIPES.filter(recipe => Object.prototype.hasOwnProperty.call(savedSales, recipe.id)).map(recipe => [recipe.id, Math.floor(number(savedSales[recipe.id], 0))]));
    const history: Receipt[] = [];
    if (Array.isArray(saved.history)) for (const receipt of saved.history) {
      if (!isRecord(receipt) || !Number.isInteger(receipt.day) || history.some(item => item.day === receipt.day)) continue;
      history.push({ day: number(receipt.day, 1, 1, 99999), served: number(receipt.served, 0), revenue: number(receipt.revenue, 0), costs: number(receipt.costs, 0), profit: number(receipt.profit, 0, -1e12), reputationChange: number(receipt.reputationChange, 0, -100, 100), mostPopular: typeof receipt.mostPopular === 'string' ? receipt.mostPopular.slice(0, 60) : 'Belum ada', satisfaction: number(receipt.satisfaction, 0, 0, 100) });
    }
    // Events deliberately expire on reload, avoiding offline timers and repeated gifts.
    return { ...base, money: whole(number(saved.money, base.money)), inventory, day, reputation: number(saved.reputation, 70, 0, 100),
      served: Math.floor(number(saved.served, 0)), totalServed: Math.floor(number(saved.totalServed, 0)),
      revenue: whole(number(saved.revenue, 0)), costs: whole(number(saved.costs, 0)), history, upgrades, appearance, location,
      settings: { music: number(settings.music, .35, 0, 1), sfx: number(settings.sfx, .65, 0, 1), muted: settings.muted === true, reducedMotion: settings.reducedMotion === true },
      dayElapsed: number(saved.dayElapsed, 0, 0, DAY_LENGTH), priceMultiplier: number(saved.priceMultiplier, 1, .75, 1.5),
      completedOrderIds, reservations, recipeSales, dayStartReputation: number(saved.dayStartReputation, 70, 0, 100),
      perfectServes: Math.floor(number(saved.perfectServes, 0)), dayClosed: saved.dayClosed === true,
      appliedEventIds: list(saved.appliedEventIds), activeEvent: null };
  } catch { return null; }
}
