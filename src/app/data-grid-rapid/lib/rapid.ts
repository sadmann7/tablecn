export interface Quote {
  symbol: string;
  name: string;
  sector: string;
  previousClose: number;
  open: number;
  price: number;
  change: number;
  changePercent: number;
  bid: number;
  ask: number;
  volume: number;
  high: number;
  low: number;
  marketCap: number;
  history: number[];
}

export const QUOTE_FIELDS = [
  "price",
  "change",
  "changePercent",
  "bid",
  "ask",
  "volume",
  "high",
  "low",
  "marketCap",
  "history",
] as const satisfies ReadonlyArray<keyof Quote>;

const HISTORY_LENGTH = 40;

interface SectorProfile {
  // Yearly volatility of a large company in the sector
  volatility: number;
  // How strongly the sector follows the whole market
  beta: number;
  suffixes: ReadonlyArray<string>;
}

const SECTOR_PROFILES = {
  Technology: {
    volatility: 0.32,
    beta: 1.25,
    suffixes: ["Systems", "Software", "Semiconductor", "Networks", "Cloud"],
  },
  Healthcare: {
    volatility: 0.38,
    beta: 0.8,
    suffixes: ["Therapeutics", "Biosciences", "Medical", "Health", "Pharma"],
  },
  Financials: {
    volatility: 0.24,
    beta: 1.1,
    suffixes: ["Bancorp", "Financial", "Capital", "Insurance", "Payments"],
  },
  Energy: {
    volatility: 0.34,
    beta: 0.9,
    suffixes: ["Energy", "Petroleum", "Resources", "Midstream", "Drilling"],
  },
  Industrials: {
    volatility: 0.26,
    beta: 1.05,
    suffixes: ["Industries", "Aerospace", "Logistics", "Machinery", "Rail"],
  },
  Consumer: {
    volatility: 0.28,
    beta: 0.95,
    suffixes: ["Brands", "Foods", "Retail", "Apparel", "Restaurants"],
  },
  Utilities: {
    volatility: 0.17,
    beta: 0.45,
    suffixes: ["Power", "Utilities", "Electric", "Water", "Gas"],
  },
  Materials: {
    volatility: 0.3,
    beta: 1,
    suffixes: ["Materials", "Chemicals", "Mining", "Steel", "Packaging"],
  },
} as const satisfies Record<string, SectorProfile>;

type Sector = keyof typeof SECTOR_PROFILES;

const SECTORS = Object.keys(SECTOR_PROFILES) as Sector[];

const NAME_PREFIXES = [
  "Apex",
  "Atlas",
  "Beacon",
  "Cedar",
  "Crestline",
  "Delta",
  "Evergreen",
  "Falcon",
  "Granite",
  "Harbor",
  "Ironwood",
  "Juniper",
  "Keystone",
  "Lumen",
  "Meridian",
  "Northstar",
  "Nova",
  "Orbit",
  "Pinnacle",
  "Pioneer",
  "Quartz",
  "Redwood",
  "Ridge",
  "Sterling",
  "Summit",
  "Titan",
  "Union",
  "Vantage",
  "Westfield",
  "Zenith",
] as const;

// Each tick is a short stretch of a sped up trading day
const STEP_SCALE = 0.0025;

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

interface QuoteModel {
  sector: Sector;
  // Yearly volatility, higher for smaller companies
  volatility: number;
  beta: number;
  shares: number;
  // The bid-ask spread as a share of the price, wider for smaller companies
  spread: number;
  // How often the quote trades compared with the others
  activity: number;
}

export interface Market {
  quotes: Quote[];
  models: QuoteModel[];
  // Running totals of `activity`, to pick busy quotes more often
  activityTotals: Float64Array;
}

export function createMarket(count: number, seed = 1): Market {
  const random = createRandom(seed);
  const symbols = new Set<string>();
  const quotes: Quote[] = [];
  const models: QuoteModel[] = [];
  const activityTotals = new Float64Array(count);
  let activityTotal = 0;

  for (let index = 0; index < count; index++) {
    const sector = pick(SECTORS, random);
    const profile = SECTOR_PROFILES[sector];
    const prefix = pick(NAME_PREFIXES, random);
    const suffix = pick(profile.suffixes, random);

    // Prices and company sizes are log-normal: most are mid-sized, a few are huge
    const previousClose = Math.min(
      2500,
      Math.max(1, roundPrice(Math.exp(Math.log(45) + getNormal(random) * 0.9))),
    );
    const marketCap = Math.exp(Math.log(8e9) + getNormal(random) * 1.4);
    const size = Math.log10(marketCap);
    const smallness = Math.min(1, Math.max(0, (11 - size) / 2));
    const open = roundPrice(
      previousClose * (1 + getNormal(random) * profile.volatility * 0.03),
    );
    const model: QuoteModel = {
      sector,
      volatility: profile.volatility * (1 + smallness * 1.2),
      beta: profile.beta * (0.7 + random() * 0.6),
      shares: Math.round(marketCap / previousClose),
      spread: 0.0002 + smallness * 0.002,
      activity: Math.max(0.05, size - 8),
    };
    // A stretch of trading before the feed starts, so ranges and trends aren't flat
    const history = [open];
    for (let step = 1; step < HISTORY_LENGTH; step++) {
      const last = history[step - 1] ?? open;
      const move = getNormal(random) * model.volatility * STEP_SCALE * 1.5;
      history.push(Math.max(0.01, roundPrice(last * Math.exp(move))));
    }
    const price = history.at(-1) ?? open;
    const change = roundPrice(price - previousClose);

    quotes.push({
      symbol: getSymbol(prefix, suffix, random, symbols),
      name: `${prefix} ${suffix}`,
      sector,
      previousClose,
      open,
      price,
      change,
      changePercent: Math.round((change / previousClose) * 10000) / 100,
      ...getQuotePrices(price, model.spread),
      volume: Math.round((model.shares * 0.002 * random()) / 100) * 100,
      high: Math.max(...history),
      low: Math.min(...history),
      marketCap: model.shares * price,
      history,
    });
    models.push(model);
    activityTotal += model.activity;
    activityTotals[index] = activityTotal;
  }

  return { quotes, models, activityTotals };
}

// Every quote follows one market move and its sector's, plus its own noise, so
// sectors move together
export function tickMarket(
  market: Market,
  share: number,
  random: () => number,
): number[] {
  const { quotes, models } = market;
  const marketMove = getNormal(random) * 0.6;
  const sectorMoves = new Map<Sector, number>();
  for (const sector of SECTORS) {
    sectorMoves.set(sector, getNormal(random) * 0.5);
  }

  const count = Math.max(1, Math.round(quotes.length * share));
  const moved = new Set<number>();
  for (let i = 0; i < count; i++) {
    const index = pickQuoteIndex(market, random);
    const quote = quotes[index];
    const model = models[index];
    if (!quote || !model) continue;

    const shock =
      model.beta * marketMove +
      (sectorMoves.get(model.sector) ?? 0) +
      getNormal(random) * 0.8;
    const step = shock * model.volatility * STEP_SCALE;
    const price = Math.max(0.01, roundPrice(quote.price * Math.exp(step)));
    // Big moves bring in more trading, in round lots
    const lots = Math.ceil(
      Math.exp(getNormal(random)) * (1 + Math.abs(shock) * 2),
    );
    quote.volume += lots * 100 * Math.max(1, Math.round(model.activity));
    moved.add(index);
    if (price === quote.price) continue;

    quote.price = price;
    quote.change = roundPrice(price - quote.previousClose);
    quote.changePercent =
      Math.round((quote.change / quote.previousClose) * 10000) / 100;
    const { bid, ask } = getQuotePrices(price, model.spread);
    quote.bid = bid;
    quote.ask = ask;
    quote.high = Math.max(quote.high, price);
    quote.low = Math.min(quote.low, price);
    quote.marketCap = model.shares * price;
    quote.history = [...quote.history.slice(1 - HISTORY_LENGTH), price];
  }
  return [...moved];
}

function pick<T>(items: ReadonlyArray<T>, random: () => number): T {
  return items[Math.floor(random() * items.length)] as T;
}

function getNormal(random: () => number) {
  const u = Math.max(random(), Number.EPSILON);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

function getSymbol(
  prefix: string,
  suffix: string,
  random: () => number,
  taken: Set<string>,
) {
  const letters = (prefix + suffix).toUpperCase().replace(/[^A-Z]/g, "");
  const candidates = [
    prefix.slice(0, 3).toUpperCase(),
    (prefix.slice(0, 2) + suffix.slice(0, 1)).toUpperCase(),
    (prefix.slice(0, 3) + suffix.slice(0, 1)).toUpperCase(),
    (prefix.slice(0, 2) + suffix.slice(0, 2)).toUpperCase(),
  ];
  for (const symbol of candidates) {
    if (taken.has(symbol)) continue;
    taken.add(symbol);
    return symbol;
  }
  for (;;) {
    const length = random() < 0.5 ? 3 : 4;
    let symbol = letters[0] ?? "X";
    while (symbol.length < length) {
      symbol += String.fromCharCode(65 + Math.floor(random() * 26));
    }
    if (taken.has(symbol)) continue;
    taken.add(symbol);
    return symbol;
  }
}

function getQuotePrices(price: number, spread: number) {
  const halfSpread = Math.max(0.01, roundPrice((price * spread) / 2));
  return {
    bid: roundPrice(price - halfSpread),
    ask: roundPrice(price + halfSpread),
  };
}

function roundPrice(value: number) {
  return Math.round(value * 100) / 100;
}

function pickQuoteIndex(market: Market, random: () => number) {
  const { activityTotals } = market;
  const target = random() * (activityTotals.at(-1) ?? 0);
  let low = 0;
  let high = activityTotals.length - 1;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if ((activityTotals[middle] ?? 0) < target) low = middle + 1;
    else high = middle;
  }
  return low;
}
