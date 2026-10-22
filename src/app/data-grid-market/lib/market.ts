export interface Quote {
  symbol: string;
  name: string;
  sector: string;
  open: number;
  price: number;
  change: number;
  changePercent: number;
  bid: number;
  ask: number;
  volume: number;
  high: number;
  low: number;
}

// The fields a tick changes, which are the cells it updates
export const QUOTE_FIELDS = [
  "price",
  "change",
  "changePercent",
  "bid",
  "ask",
  "volume",
  "high",
  "low",
] as const satisfies ReadonlyArray<keyof Quote>;

export const SECTORS = [
  "Technology",
  "Healthcare",
  "Financials",
  "Energy",
  "Industrials",
  "Consumer",
  "Utilities",
  "Materials",
] as const;

const NAME_PREFIXES = [
  "Apex",
  "Blue",
  "Cedar",
  "Delta",
  "Echo",
  "Falcon",
  "Granite",
  "Harbor",
  "Iron",
  "Juniper",
  "Kestrel",
  "Lumen",
  "Meridian",
  "Nova",
  "Orbit",
  "Pioneer",
  "Quartz",
  "Ridge",
  "Summit",
  "Titan",
] as const;

const NAME_SUFFIXES = [
  "Systems",
  "Labs",
  "Holdings",
  "Energy",
  "Robotics",
  "Biotech",
  "Capital",
  "Networks",
  "Foods",
  "Motors",
] as const;

// A seeded generator, so the server and the browser build the same market
export function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: ReadonlyArray<T>, random: () => number): T {
  return items[Math.floor(random() * items.length)] as T;
}

function roundPrice(value: number) {
  return Math.round(value * 100) / 100;
}

// Three or four letters, unique within the market
function getSymbol(random: () => number, taken: Set<string>) {
  for (;;) {
    const length = random() < 0.6 ? 3 : 4;
    let symbol = "";
    for (let i = 0; i < length; i++) {
      symbol += String.fromCharCode(65 + Math.floor(random() * 26));
    }
    if (taken.has(symbol)) continue;
    taken.add(symbol);
    return symbol;
  }
}

export function createQuotes(count: number, seed = 1): Quote[] {
  const random = createRandom(seed);
  const symbols = new Set<string>();
  return Array.from({ length: count }, () => {
    const open = roundPrice(5 + random() * 495);
    return {
      symbol: getSymbol(random, symbols),
      name: `${pick(NAME_PREFIXES, random)} ${pick(NAME_SUFFIXES, random)}`,
      sector: pick(SECTORS, random),
      open,
      price: open,
      change: 0,
      changePercent: 0,
      bid: roundPrice(open - 0.01),
      ask: roundPrice(open + 0.01),
      volume: Math.round(random() * 2_000_000),
      high: open,
      low: open,
    };
  });
}

// Moves a share of the quotes by a small random step, in place, and returns which moved
export function tickQuotes(
  quotes: Quote[],
  share: number,
  random: () => number,
): number[] {
  const count = Math.max(1, Math.round(quotes.length * share));
  const moved = new Set<number>();
  for (let i = 0; i < count; i++) {
    const index = Math.floor(random() * quotes.length);
    const quote = quotes[index];
    if (!quote) continue;
    const step = (random() - 0.5) * 0.004 * quote.price;
    const price = Math.max(0.01, roundPrice(quote.price + step));
    if (price === quote.price) continue;
    const spread = Math.max(0.01, roundPrice(price * 0.0005));
    quote.price = price;
    quote.change = roundPrice(price - quote.open);
    quote.changePercent = Math.round((quote.change / quote.open) * 10000) / 100;
    quote.bid = roundPrice(price - spread);
    quote.ask = roundPrice(price + spread);
    quote.volume += Math.round(random() * 5000);
    quote.high = Math.max(quote.high, price);
    quote.low = Math.min(quote.low, price);
    moved.add(index);
  }
  return [...moved];
}
