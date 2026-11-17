// Token Radar, model radar-3: a fitted comps/size curve, tested
// out-of-sample, not a flat multiple. Computed only from the sealed
// snapshot. No protocol name is ever special-cased.
//
//   Core: log-log OLS of market cap on TVL over the snapshot's own
//         live-token protocols (mcap > 0, TVL > 0; n = 128):
//           log(mcap) = a + b * log(tvl)
//         Full fit on this snapshot: a = 6.965, b = 0.522, R2 = 0.194
//         in log space. A slope below 1 is the point: the median
//         mcap/TVL falls from 0.76x in the smallest TVL tercile to
//         0.29x in the middle to 0.05x in the largest. A flat multiple
//         prices a $2.7B protocol as if it were a $7M one; the curve
//         does not. See the Validation section the dashboard renders:
//         the curve is kept because it beats the flat baseline
//         out-of-sample, and every term that does not is dropped there.
//   Priors (small, bounded, NOT fitted): growth 1 + clamp(change_7d,
//         -60, 120)/100 * 0.25, chain 1 + 0.01 per chain beyond the
//         first (cap +0.05), maturity 0.8 + min(age, 1095)/1095 * 0.2.
//         They move a row by at most a few percent; the curve does
//         the pricing. A fitted growth/chains/age term was tested and
//         dropped: see validation.dropped.
//   Discount: a wrapped, staked or bridged product of a token that
//         already trades, or a Bridge / Liquid Staking / Liquid
//         Restaking / Restaked BTC / CEX protocol, is priced at 0.5x.
//         That mirrors the house watchlist rule and stops a wrapped
//         product ranking as a fresh launch. The discount and its
//         reason are on every row that carries one.
//   implied = round(exp(a + b*log(tvl)) * growth * chain * maturity
//                   * discount), at least $1.

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export interface ModelConstants {
  fallback_multiple: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  chain_bonus_per_chain: number;
  chain_bonus_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  discount_wrapped: number;
  farm_capture_share: number;
  farm_call_net: number;
  farm_skip_net: number;
}

export const MODEL: ModelConstants = {
  fallback_multiple: 0.25,
  growth_weight: 0.25,
  growth_floor: -60,
  growth_cap: 120,
  chain_bonus_per_chain: 0.01,
  chain_bonus_cap: 0.05,
  maturity_floor: 0.8,
  maturity_range: 0.2,
  maturity_days: 1095,
  unknown_age_days: 365,
  discount_wrapped: 0.5,
  farm_capture_share: 0.000005,
  farm_call_net: 20,
  farm_skip_net: -5,
};

export const MODEL_VERSION = 'radar-3';
export const EARLY_ROWS = 160;
export const LIVE_ROWS = 24;
export const BOOTSTRAP_REFITS = 200;
export const BOOTSTRAP_SEED = 20261114;

export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

export interface FarmEconomics {
  capital_usd: number;
  setup_gas_usd: number;
  weekly_gas_usd: number;
  weeks: number;
  total_cost_usd: number;
  expected_usd: number;
  net_usd: number;
  breakeven_share_pct: number;
  call: 'farm' | 'thin' | 'skip';
}

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    curve_intercept: number;
    curve_slope: number;
    curve_implied_usd: number;
    base_multiple: number;
    chain_multiplier: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    discount: number;
    discount_reason: string;
    age_days: number | null;
    rank_p10: number;
    rank_p50: number;
    rank_p90: number;
  };
  farm: FarmEconomics;
  farm_steps: string[];
}

export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  curve_implied_usd: number;
  base_multiple: number;
  chain_multiplier: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  discount: number;
  discount_reason: string;
  rank_p10: number;
  rank_p50: number;
  rank_p90: number;
  farm: FarmEconomics;
  farm_steps: string[];
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

export interface ValidationEntry {
  model: string;
  loo_median_ape: number;
  loo_mean_ape: number;
}

export interface WalkForwardEntry {
  cut: string;
  train_n: number;
  test_n: number;
  flat_median_ape: number;
  size_median_ape: number;
  full_median_ape: number;
}

export interface Validation {
  comparables_n: number;
  usable_n: number;
  fit_intercept: number;
  fit_slope: number;
  fit_r2: number;
  flat_r2: number;
  loo: ValidationEntry[];
  walk_forward: WalkForwardEntry[];
  terciles: { label: string; tvl_min_usd: number; tvl_max_usd: number; median_ratio: number; n: number }[];
  dropped: { term: string; loo_median_ape: number; verdict: string }[];
  bootstrap_refits: number;
  bootstrap_seed: number;
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  validation: Validation;
  rows: RadarRow[];
  live: LiveRow[];
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** A deterministic PRNG (mulberry32): the bootstrap refits must be identical on every run. */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Live-token protocols usable as comparables: a positive market cap and TVL. */
export function comparables(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter(
    (p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0,
  );
}

/** OLS log-log fit: log(mcap) = intercept + slope * log(tvl). */
export function fitSizeCurve(train: SnapshotProtocol[]): { intercept: number; slope: number; r2: number } {
  const xs = train.map((p) => Math.log(p.tvl_usd));
  const ys = train.map((p) => Math.log(p.mcap_usd!));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) * (xs[i]! - mx);
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < xs.length; i++) {
    const pred = intercept + slope * xs[i]!;
    ssRes += (ys[i]! - pred) * (ys[i]! - pred);
    ssTot += (ys[i]! - my) * (ys[i]! - my);
  }
  return { intercept: round4(intercept), slope: round4(slope), r2: round4(ssTot === 0 ? 0 : 1 - ssRes / ssTot) };
}

/** R2 in log space of the flat 0.25x multiple (slope 1, intercept log 0.25). */
export function flatR2(train: SnapshotProtocol[]): number {
  const ys = train.map((p) => Math.log(p.mcap_usd!));
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let ssRes = 0;
  let ssTot = 0;
  for (const p of train) {
    const pred = Math.log(p.tvl_usd) + Math.log(0.25);
    ssRes += (Math.log(p.mcap_usd!) - pred) * (Math.log(p.mcap_usd!) - pred);
    ssTot += (Math.log(p.mcap_usd!) - my) * (Math.log(p.mcap_usd!) - my);
  }
  return round4(ssTot === 0 ? 0 : 1 - ssRes / ssTot);
}

/** Solve A x = b by Gaussian elimination with partial pivoting. */
export function solveLinear(aIn: number[][], bIn: number[]): number[] {
  const n = bIn.length;
  const a = aIn.map((row) => [...row]);
  const b = [...bIn];
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r]![col]!) > Math.abs(a[pivot]![col]!)) pivot = r;
    [a[col], a[pivot]] = [a[pivot]!, a[col]!];
    [b[col], b[pivot]] = [b[pivot]!, b[col]!];
    const d = a[col]![col]!;
    if (Math.abs(d) < 1e-12) continue;
    for (let r = col + 1; r < n; r++) {
      const f = a[r]![col]! / d;
      for (let c = col; c < n; c++) a[r]![c]! -= f * a[col]![c]!;
      b[r]! -= f * b[col]!;
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i]!;
    for (let j = i + 1; j < n; j++) s -= a[i]![j]! * x[j]!;
    const d = a[i]![i]!;
    x[i] = Math.abs(d) < 1e-12 ? 0 : s / d;
  }
  return x;
}

/** OLS fit of log(mcap) on the given feature rows. */
export function fitOls(train: SnapshotProtocol[], features: (p: SnapshotProtocol) => number[]): number[] {
  const k = features(train[0]!).length;
  const ata: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const atb: number[] = new Array<number>(k).fill(0);
  for (const p of train) {
    const f = features(p);
    const y = Math.log(p.mcap_usd!);
    for (let i = 0; i < k; i++) {
      atb[i]! += f[i]! * y;
      for (let j = 0; j < k; j++) ata[i]![j]! += f[i]! * f[j]!;
    }
  }
  for (let i = 0; i < k; i++) ata[i]![i]! += 1e-9;
  return solveLinear(ata, atb);
}

function growthFrac(p: SnapshotProtocol, model: ModelConstants): number {
  return Math.min(model.growth_cap, Math.max(model.growth_floor, finite(p.change_7d, 0))) / 100;
}

function ageFor(p: SnapshotProtocol, asOf: string, model: ModelConstants): number {
  return ageDays(asOf, p.listed_at) ?? model.unknown_age_days;
}

/** Bounded priors: growth, chain, maturity. Small by design; the curve prices. */
export function priors(p: SnapshotProtocol, asOf: string, model: ModelConstants = MODEL): {
  growthPct: number; growthMult: number; chainMult: number; maturityMult: number; age: number | null;
} {
  const age = ageDays(asOf, p.listed_at);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, finite(p.change_7d, 0)));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const extraChains = Math.max(0, p.chains.length - 1);
  const chainMult = 1 + Math.min(model.chain_bonus_cap, extraChains * model.chain_bonus_per_chain);
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor
    + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  return { growthPct: round4(growthPct), growthMult: round4(growthMult), chainMult: round4(chainMult), maturityMult: round4(maturityMult), age };
}

const DISCOUNT_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
const WRAPPED = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_START = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** 0.5 when the protocol is a wrapped/staked/bridged product of a token that trades, else 1. */
export function productDiscount(p: SnapshotProtocol, model: ModelConstants = MODEL): { discount: number; reason: string } {
  if (p.category !== null && DISCOUNT_CATEGORIES.has(p.category)) {
    return { discount: model.discount_wrapped, reason: `category ${p.category} is a wrapped, staked or bridged product` };
  }
  if (WRAPPED.test(p.name)) return { discount: model.discount_wrapped, reason: 'name carries wrapped, staked or staking' };
  if (EXCHANGE_START.test(p.name)) return { discount: model.discount_wrapped, reason: 'name begins with an exchange name' };
  return { discount: 1, reason: '' };
}

export interface ImpliedBreakdown {
  implied: number;
  curveImplied: number;
  baseMultiple: number;
  chainMultiplier: number;
  growthPct: number;
  growthMultiplier: number;
  maturityMultiplier: number;
  discount: number;
  discountReason: string;
  age: number | null;
}

/** Full implied value under a fitted curve: curve x priors x discount. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  fit: { intercept: number; slope: number },
  model: ModelConstants = MODEL,
): ImpliedBreakdown {
  const pr = priors(protocol, asOf, model);
  const d = productDiscount(protocol, model);
  const curveImplied = Math.exp(fit.intercept + fit.slope * Math.log(protocol.tvl_usd));
  const implied = Math.max(
    1,
    Math.round(curveImplied * pr.growthMult * pr.chainMult * pr.maturityMult * d.discount),
  );
  return {
    implied,
    curveImplied: Math.round(curveImplied),
    baseMultiple: round4(curveImplied / protocol.tvl_usd),
    chainMultiplier: pr.chainMult,
    growthPct: pr.growthPct,
    growthMultiplier: pr.growthMult,
    maturityMultiplier: pr.maturityMult,
    discount: d.discount,
    discountReason: d.reason,
    age: pr.age,
  };
}

/** Median absolute percentage error of a predictor over a test set. */
export function medianApe(predict: (p: SnapshotProtocol) => number, test: SnapshotProtocol[]): number {
  const errs = test.map((p) => Math.abs(predict(p) - p.mcap_usd!) / p.mcap_usd!);
  return round4(median(errs));
}

export function meanApe(predict: (p: SnapshotProtocol) => number, test: SnapshotProtocol[]): number {
  const errs = test.map((p) => Math.abs(predict(p) - p.mcap_usd!) / p.mcap_usd!);
  return round4(errs.reduce((a, b) => a + b, 0) / errs.length);
}

/** Leave-one-out validation for flat, size-only, full, category-median and one-extra-term fits. */
export function looValidation(live: SnapshotProtocol[], asOf: string, model: ModelConstants = MODEL): ValidationEntry[] {
  const entries: ValidationEntry[] = [];
  const flat = (p: SnapshotProtocol): number => p.tvl_usd * model.fallback_multiple;
  const sizeOnly = (train: SnapshotProtocol[]) => {
    const f = fitSizeCurve(train);
    return (p: SnapshotProtocol): number => Math.exp(f.intercept + f.slope * Math.log(p.tvl_usd));
  };
  const full = (train: SnapshotProtocol[]) => {
    const f = fitSizeCurve(train);
    return (p: SnapshotProtocol): number => impliedValue(p, asOf, f, model).implied;
  };
  const catMedian = (train: SnapshotProtocol[]) => {
    const ratios = new Map<string, number[]>();
    for (const q of train) {
      if (q.category === null) continue;
      const list = ratios.get(q.category) ?? [];
      list.push(q.mcap_usd! / q.tvl_usd);
      ratios.set(q.category, list);
    }
    return (p: SnapshotProtocol): number => {
      const list = p.category === null ? undefined : ratios.get(p.category);
      return p.tvl_usd * (list === undefined ? model.fallback_multiple : median(list));
    };
  };
  const extra = (train: SnapshotProtocol[], kind: 'growth' | 'chains' | 'age') => {
    const feats = (p: SnapshotProtocol): number[] => {
      const base = [1, Math.log(p.tvl_usd)];
      if (kind === 'growth') base.push(growthFrac(p, model));
      if (kind === 'chains') base.push(Math.log(Math.max(1, p.chains.length)));
      if (kind === 'age') base.push(Math.log(Math.max(1, ageFor(p, asOf, model))));
      return base;
    };
    const beta = fitOls(train, feats);
    return (p: SnapshotProtocol): number => {
      const f = feats(p);
      let s = 0;
      for (let i = 0; i < beta.length; i++) s += beta[i]! * f[i]!;
      return Math.exp(s);
    };
  };
  const variants: { name: string; make: (train: SnapshotProtocol[]) => (p: SnapshotProtocol) => number }[] = [
    { name: 'flat 0.25x multiple', make: () => flat },
    { name: 'size curve (log-log)', make: sizeOnly },
    { name: 'size curve + bounded priors + discount (radar-3)', make: full },
    { name: 'category median multiple', make: catMedian },
    { name: 'size curve + fitted growth', make: (t) => extra(t, 'growth') },
    { name: 'size curve + fitted chains', make: (t) => extra(t, 'chains') },
    { name: 'size curve + fitted age', make: (t) => extra(t, 'age') },
  ];
  for (const v of variants) {
    const errs: number[] = [];
    for (let i = 0; i < live.length; i++) {
      const train = live.slice(0, i).concat(live.slice(i + 1));
      const predict = v.make(train);
      const p = live[i]!;
      errs.push(Math.abs(predict(p) - p.mcap_usd!) / p.mcap_usd!);
    }
    entries.push({
      model: v.name,
      loo_median_ape: round4(median(errs)),
      loo_mean_ape: round4(errs.reduce((a, b) => a + b, 0) / errs.length),
    });
  }
  return entries;
}

/** Walk-forward: train on protocols listed on or before the cut, test on newer ones. */
export function walkForward(live: SnapshotProtocol[], asOf: string, cuts: string[], model: ModelConstants = MODEL): WalkForwardEntry[] {
  const out: WalkForwardEntry[] = [];
  for (const cut of cuts) {
    const train = live.filter((p) => p.listed_at !== null && p.listed_at <= cut);
    const test = live.filter((p) => p.listed_at !== null && p.listed_at > cut);
    if (train.length < 10 || test.length < 5) continue;
    const f = fitSizeCurve(train);
    out.push({
      cut,
      train_n: train.length,
      test_n: test.length,
      flat_median_ape: medianApe((p) => p.tvl_usd * model.fallback_multiple, test),
      size_median_ape: medianApe((p) => Math.exp(f.intercept + f.slope * Math.log(p.tvl_usd)), test),
      full_median_ape: medianApe((p) => impliedValue(p, asOf, f, model).implied, test),
    });
  }
  return out;
}

/** Median mcap/TVL by TVL tercile of the live comparables. */
export function terciles(live: SnapshotProtocol[]): Validation['terciles'] {
  const sorted = [...live].sort((a, b) => a.tvl_usd - b.tvl_usd);
  const n = sorted.length;
  const labels = ['smallest third', 'middle third', 'largest third'];
  return [0, 1, 2].map((i) => {
    const chunk = sorted.slice(Math.floor((i * n) / 3), Math.floor(((i + 1) * n) / 3));
    return {
      label: labels[i]!,
      tvl_min_usd: chunk[0]!.tvl_usd,
      tvl_max_usd: chunk[chunk.length - 1]!.tvl_usd,
      median_ratio: round4(median(chunk.map((p) => p.mcap_usd! / p.tvl_usd))),
      n: chunk.length,
    };
  });
}

/** The whole validation report, computed from the snapshot on every run. */
export function validate(snapshot: Snapshot, model: ModelConstants = MODEL): Validation {
  const live = comparables(snapshot);
  const fit = fitSizeCurve(live);
  const loo = looValidation(live, snapshot.as_of, model);
  const byName = new Map(loo.map((e) => [e.model, e]));
  const dropped: Validation['dropped'] = [
    {
      term: 'category median multiple (radar-2 base)',
      loo_median_ape: byName.get('category median multiple')!.loo_median_ape,
      verdict: 'dropped: worse than the flat baseline out-of-sample, so no category multiple is used in radar-3',
    },
    {
      term: 'fitted growth term (log mcap on log TVL + 7d growth)',
      loo_median_ape: byName.get('size curve + fitted growth')!.loo_median_ape,
      verdict: 'dropped as a fitted term: worse than the size curve alone out-of-sample; growth survives only as a small bounded prior',
    },
    {
      term: 'fitted chains term (log mcap on log TVL + log chains)',
      loo_median_ape: byName.get('size curve + fitted chains')!.loo_median_ape,
      verdict: 'dropped as a fitted term: worse than the size curve alone out-of-sample; chains survive only as a small bounded prior',
    },
    {
      term: 'fitted age term (log mcap on log TVL + log age)',
      loo_median_ape: byName.get('size curve + fitted age')!.loo_median_ape,
      verdict: 'dropped as a fitted term: worse than the size curve alone out-of-sample; age survives only as a small bounded prior',
    },
  ];
  return {
    comparables_n: live.length,
    usable_n: live.length,
    fit_intercept: fit.intercept,
    fit_slope: fit.slope,
    fit_r2: fit.r2,
    flat_r2: flatR2(live),
    loo,
    walk_forward: walkForward(live, snapshot.as_of, ['2024-01-01', '2024-06-01'], model),
    terciles: terciles(live),
    dropped,
    bootstrap_refits: BOOTSTRAP_REFITS,
    bootstrap_seed: BOOTSTRAP_SEED,
  };
}

const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** Capital tier by TVL: $50 under $100M, $100 to $1B, $150 to $5B, $250 above. */
export function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

export function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/**
 * Farm economics, netted to break-even in dollars. The expected payout
 * assumes one farmer in 200,000 recipients of the launch (capture share
 * 0.000005 of implied value) — an assumption, stated on the dashboard,
 * not a prediction. Total cost is cash out of pocket: setup gas, weekly
 * gas over the hold, and the second position's gas. Capital itself is
 * not a cost: it comes back on unwind. Call: farm when net >= $20,
 * thin when net >= -$5, skip below that — a skip row costs more to
 * farm than any payout on that assumption is worth.
 */
export function farmEconomics(p: SnapshotProtocol, age: number | null, implied: number, model: ModelConstants = MODEL): FarmEconomics {
  const capital = capitalFor(p);
  const setupGas = capital >= 150 ? 8 : 4;
  const weeklyGas = 2;
  const hold = holdDaysFor(age);
  const weeks = Math.max(1, Math.ceil(hold / 7));
  const totalCost = setupGas + weeklyGas * weeks + 3;
  const expected = Math.round(implied * model.farm_capture_share);
  const net = expected - totalCost;
  const breakevenShare = Number((((totalCost / Math.max(1, implied)) * 100)).toFixed(5));
  const call: FarmEconomics['call'] = net >= model.farm_call_net ? 'farm' : net >= model.farm_skip_net ? 'thin' : 'skip';
  return {
    capital_usd: capital,
    setup_gas_usd: setupGas,
    weekly_gas_usd: weeklyGas,
    weeks,
    total_cost_usd: totalCost,
    expected_usd: expected,
    net_usd: net,
    breakeven_share_pct: breakevenShare,
    call,
  };
}

export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

function secondChainOf(p: SnapshotProtocol): string | null {
  return p.chains.length > 1 ? p.chains[1]! : null;
}

function categoryKey(p: SnapshotProtocol): string {
  return (p.category ?? '').toLowerCase();
}

function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = categoryKey(p);
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the lending position open.`;
  if (c.includes('dex') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it.`;
  if (c.includes('rwa')) return `Mint $${capital} of ${name}'s yield-bearing asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  if (c.includes('basis')) return `Deposit $${capital} into ${name}'s basis strategy on ${chain} and keep the position open.`;
  if (c.includes('yield')) return `Deposit $${capital} into ${name}'s highest-TVL yield vault on ${chain} and keep the shares.`;
  if (c.includes('payment')) return `Route $${capital} of payments through ${name} on ${chain} and keep the account active.`;
  if (c.includes('governance')) return `Deposit $${capital} into ${name} on ${chain} and vote in its next governance round.`;
  if (c.includes('chain')) return `Bridge $${capital} of USDC onto ${name}'s chain and use one of its native apps.`;
  if (c.includes('launchpad')) return `Commit $${capital} to the next ${name} launch on ${chain} and hold the allocation.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

function weeklyFor(p: SnapshotProtocol, chain: string): string {
  const c = categoryKey(p);
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Each week, borrow a small amount against your ${name} supply on ${chain} and repay it, so the account shows both sides of the market.`;
  if (c.includes('dex') || c.includes('leveraged farm')) return `Each week, swap a small amount through ${name}'s main pool on ${chain} and add a little liquidity if the range is still in range.`;
  if (c.includes('bridge')) return `Each week, bridge a small amount through ${name} to ${chain} and back, keeping the route active without moving the full position.`;
  if (c.includes('staking') || c.includes('restak')) return `Each week, check the ${name} staking rewards on ${chain} and restake or claim them, so the position compounds.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Each week, close and reopen one small hedged position on ${name}, keeping total margin near your starting size.`;
  if (c.includes('prediction')) return `Each week, place one small position in a new ${name} market, so the account stays active across markets.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return `Each week, check the ${name} vault's allocation on ${chain} and top up a small amount when a new vault opens.`;
  if (c.includes('rwa')) return `Each week, check the yield accrued on your ${name} asset on ${chain} and reinvest the yield when it clears.`;
  if (c.includes('insurance')) return `Each week, review the ${name} cover on ${chain} and renew it before it lapses, so coverage never gaps.`;
  if (c.includes('basis')) return `Each week, check the ${name} basis position on ${chain} and rebalance only if the funding rate has flipped.`;
  if (c.includes('yield')) return `Each week, harvest the yield from your ${name} vault on ${chain} and redeposit it, so the position compounds.`;
  if (c.includes('governance')) return `Each week, vote in any open ${name} proposal and post in its governance forum.`;
  if (c.includes('payment')) return `Each week, send one small payment through ${name} on ${chain} to keep the account's activity fresh.`;
  if (c.includes('chain')) return `Each week, use one native app on ${name}'s chain, so the chain sees real activity beyond the bridge.`;
  return `Each week, make one qualifying action on ${name} on ${chain}, such as a deposit, a swap or a vote.`;
}

function nameWord(p: SnapshotProtocol): string {
  return categoryKey(p).includes('lend') ? 'lending' : categoryKey(p).includes('dex') ? 'liquidity' : 'yield';
}

/**
 * Seven farm steps, each derived from the protocol's own record and
 * netted in dollars: the plan names its capital, its total cash cost,
 * its expected payout on the stated capture assumption, and its call.
 * A skip row says so in its own plan and tells the reader what would
 * have to change before farming it.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, econ: FarmEconomics, implied: number): FarmStep[] {
  const chain = chainOf(p);
  const second = secondChainOf(p);
  const capital = econ.capital_usd;
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const weekly = weeklyFor(p, chain);
  const spread = second === null
    ? `Open a second, smaller $25 position in a different ${nameWord(p)} pool or vault on ${chain}, so the wallet is not tied to a single pool.`
    : `Open a second, smaller $25 position on ${second}, so the wallet shows activity on more than one of ${p.name}'s chains.`;
  const callLine = econ.call === 'farm'
    ? `Call: farm. Expected payout about $${econ.expected_usd} against $${econ.total_cost_usd} of costs, net about $${econ.net_usd}.`
    : econ.call === 'thin'
      ? `Call: thin. Expected payout about $${econ.expected_usd} against $${econ.total_cost_usd} of costs, net about $${econ.net_usd}: farm only at the minimum size, or skip it.`
      : `Call: skip. Expected payout about $${econ.expected_usd} against $${econ.total_cost_usd} of costs, net about $${econ.net_usd}: do not farm this row; revisit only if its implied value rises above $${econ.total_cost_usd * 200000} or its costs fall.`;
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm with ${p.name}, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    { text: action, cost: `$${capital} of capital and about $${econ.setup_gas_usd} of gas`, time: '15 minutes to set up' },
    { text: weekly, cost: `about $${econ.weekly_gas_usd} of gas a week for ${econ.weeks} weeks`, time: '10 minutes a week' },
    { text: spread, cost: '$25 of capital and about $3 of gas', time: '10 minutes' },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot, and do not withdraw and redeposit the same funds. Total cash cost is $${econ.total_cost_usd} over ${econ.weeks} weeks, so the position breaks even if the airdrop is worth at least $${econ.total_cost_usd}, which is ${econ.breakeven_share_pct.toFixed(5)}% of the $${implied} implied value.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open ${p.name}'s own points or rewards page from its own site and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `${callLine} Write the wallet, the dates and every transaction in a farm log, check the protocol's TVL each week, and unwind if its TVL falls by half or its site stops responding.`,
      cost: 'nothing but the log',
      time: '5 minutes a week',
    },
  ];
}

/** Score one protocol under a fitted curve, with its farm economics. */
export function scoreProtocol(
  p: SnapshotProtocol,
  asOf: string,
  fit: { intercept: number; slope: number },
  model: ModelConstants = MODEL,
): { v: ImpliedBreakdown; econ: FarmEconomics } {
  const v = impliedValue(p, asOf, fit, model);
  const econ = farmEconomics(p, v.age, v.implied, model);
  return { v, econ };
}

/** Bootstrap rank ranges: refit the size curve on resampled comparables, rank the board, take p10/p50/p90. */
export function rankRanges(
  board: { slug: string; protocol: SnapshotProtocol }[],
  live: SnapshotProtocol[],
  asOf: string,
  model: ModelConstants = MODEL,
): Map<string, { p10: number; p50: number; p90: number }> {
  const rng = mulberry32(BOOTSTRAP_SEED);
  const ranks = new Map<string, number[]>();
  for (const b of board) ranks.set(b.slug, []);
  for (let it = 0; it < BOOTSTRAP_REFITS; it++) {
    const sample: SnapshotProtocol[] = [];
    for (let i = 0; i < live.length; i++) sample.push(live[Math.floor(rng() * live.length)]!);
    const f = fitSizeCurve(sample);
    const scored = board
      .map((b) => ({ slug: b.slug, implied: scoreProtocol(b.protocol, asOf, f, model).v.implied }))
      .sort((a, b) => b.implied - a.implied || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
    scored.forEach((s, i) => ranks.get(s.slug)!.push(i + 1));
  }
  const out = new Map<string, { p10: number; p50: number; p90: number }>();
  for (const [slug, list] of ranks) {
    const s = [...list].sort((a, b) => a - b);
    out.set(slug, { p10: s[19]!, p50: s[99]!, p90: s[179]! });
  }
  return out;
}

export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; validation: Validation } {
  const live = comparables(snapshot);
  const fit = fitSizeCurve(live);
  const validation = validate(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const { v, econ } = scoreProtocol(p, snapshot.as_of, fit, model);
    return { p, v, econ };
  });
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  const ranges = rankRanges(scored.map((s) => ({ slug: s.p.slug, protocol: s.p })), live, snapshot.as_of, model);
  return {
    validation,
    board: scored.map((s, i) => {
      const r = ranges.get(s.p.slug)!;
      return {
        rank: i + 1,
        slug: s.p.slug,
        name: s.p.name,
        category: s.p.category,
        chains: s.p.chains,
        tvl_usd: s.p.tvl_usd,
        change_7d: s.p.change_7d,
        mcap_usd: s.p.mcap_usd,
        listed_at: s.p.listed_at,
        gecko_id: s.p.gecko_id,
        symbol: s.p.symbol,
        token_status: 'pre-token' as const,
        age_days: s.v.age,
        implied_value_usd: s.v.implied,
        model: {
          curve_intercept: fit.intercept,
          curve_slope: fit.slope,
          curve_implied_usd: s.v.curveImplied,
          base_multiple: s.v.baseMultiple,
          chain_multiplier: s.v.chainMultiplier,
          growth_pct: s.v.growthPct,
          growth_multiplier: s.v.growthMultiplier,
          maturity_multiplier: s.v.maturityMultiplier,
          discount: s.v.discount,
          discount_reason: s.v.discountReason,
          age_days: s.v.age,
          rank_p10: r.p10,
          rank_p50: r.p50,
          rank_p90: r.p90,
        },
        farm: s.econ,
        farm_steps: farmSteps(s.p, s.v.age, s.econ, s.v.implied).map(stepText),
      };
    }),
  };
}

export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    curve_implied_usd: row.model.curve_implied_usd,
    base_multiple: row.model.base_multiple,
    chain_multiplier: row.model.chain_multiplier,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    discount: row.model.discount,
    discount_reason: row.model.discount_reason,
    rank_p10: row.model.rank_p10,
    rank_p50: row.model.rank_p50,
    rank_p90: row.model.rank_p90,
    farm: row.farm,
    farm_steps: row.farm_steps,
  };
}

export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const { board, validation } = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    validation,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
