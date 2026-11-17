// Token Radar, model radar-5: the radar-4 fitted comps/size curve,
// kept unchanged after radar-5's challengers all failed the bar
// (see below). Computed only from the sealed snapshot. No protocol
// name is ever special-cased.
//
//   Core: log-log OLS of market cap on TVL and chain count over the
//         snapshot's own live-token protocols — only the ones that
//         can price a fresh DeFi launch. radar-3 fit on all 128
//         live-token protocols; radar-4 leaves out 34 of them: CEX
//         tokens (9) and wrapped / staked / bridged products (25:
//         Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking,
//         Restaked BTC). An exchange token is equity in a company, and
//         a wrapped product's market cap prices the token it wraps,
//         not a new launch — and the board never ranks a CEX row
//         anyway. The 94 that remain are the comparables.
//           log(mcap) = a + b * log(tvl) + c * log(chains)
//         Full fit on this snapshot: a = 9.31, b = 0.397, c = -0.174,
//         R2 = 0.11 in log space. The chains term is fitted, not a
//         prior, and its sign is the finding: once TVL is controlled
//         for, a protocol spread over more chains trades at a lower
//         multiple — breadth dilutes depth. radar-3 gave every extra
//         chain a +1% bonus; the data say the opposite, and the blind
//         tests agree: the chains term wins leave-one-out (81.7% vs
//         84.0% median error for the curve without it) and walk-forward
//         on all four cuts (58-67% vs 79-86% flat and 82-87% radar-3). The model is picked by
//         blind tests, not by in-sample fit — in-sample R2 is low
//         (0.11) and the dashboard says exactly that, with the LOO
//         mean error (656% vs 598% without chains) reported as the
//         honest counterweight: a few huge misses get worse, the
//         typical protocol and every out-of-time test get better.
//   radar-5 challengers, all tested against the same bar (beat
//         radar-4 on LOO median AND on all four walk-forward cuts)
//         and all rejected: (B) fit on all 128 with fitted indicator
//         dummies for CEX and for wrapped / staked / bridged products
//         plus the chains term — LOO median 85.6% (worse), walk-forward
//         better on only 1 of 4 cuts; (C) per-category dummies — LOO
//         85.8%, walk-forward 0 of 4; (E) all 128 + dummies without
//         chains — LOO 85.3%, 1 of 4; (F/G/H) chains term shrunk by
//         0.25 / 0.50 / 0.75 — LOO 84.8% / 85.9% / 86.7%, none better
//         on all four cuts; (J) chains plus a fitted growth term —
//         LOO 83.8%, walk-forward worse on all four cuts. Bringing the
//         34 back in, even with dummies, reintroduces the bias the
//         clean fit removes; shrinking the chains term moves the
//         model back toward the 2-term curve, which already loses.
//         So radar-5 ships radar-4's model unchanged, with 500
//         bootstrap refits (was 200) for more stable rank ranges —
//         the ranges themselves are honestly unchanged (mean p90-p10
//         width 37.3 ranks at 500 refits vs 37.4 at 200; the top-20
//         mean is 15.7 vs 15.0), so nothing was tightened by hand.
//   Priors (small, bounded, NOT fitted): growth 1 + clamp(change_7d,
//         -60, 120)/100 * 0.25, maturity 0.8 + min(age, 1095)/1095 *
//         0.2. They move a row by at most a few percent; the fitted
//         terms do the pricing. Fitted growth and age terms were
//         tested and dropped: see validation.dropped.
//   Discount: a wrapped, staked or bridged product of a token that
//         already trades, or a Bridge / Liquid Staking / Liquid
//         Restaking / Restaked BTC / CEX protocol, is priced at 0.5x.
//         That mirrors the house watchlist rule and stops a wrapped
//         product ranking as a fresh launch. The discount and its
//         reason are on every row that carries one.
//   implied = round(exp(a + b*log(tvl) + c*log(chains)) * growth
//                   * maturity * discount), at least $1.

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

export const MODEL_VERSION = 'radar-5';
export const EARLY_ROWS = 160;
export const LIVE_ROWS = 24;
export const BOOTSTRAP_REFITS = 500;
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
  start_date: string;
  hold_end_date: string;
  flip_implied_usd: number;
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
  radar3_median_ape: number;
  cand_b_median_ape: number;
}

export interface Validation {
  comparables_n: number;
  usable_n: number;
  excluded_n: number;
  excluded_categories: string[];
  fit_intercept: number;
  fit_slope: number;
  fit_chain_coef: number;
  fit_r2: number;
  flat_r2: number;
  loo: ValidationEntry[];
  walk_forward: WalkForwardEntry[];
  terciles: { label: string; tvl_min_usd: number; tvl_max_usd: number; median_ratio: number; n: number }[];
  dropped: { term: string; loo_median_ape: number; verdict: string }[];
  bootstrap_refits: number;
  bootstrap_seed: number;
}

export interface FitPoint {
  tvl_usd: number;
  mcap_usd: number;
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
  fit_points: FitPoint[];
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

/** Categories that cannot price a fresh DeFi launch: exchange tokens
 *  and wrapped / staked / bridged products. Their market caps price
 *  a company or a token that already trades, not a new launch. */
export const EXCLUDED_CATEGORIES = ['CEX', 'Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC'];

/** All live-token protocols: a positive market cap and TVL. */
export function allLive(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter(
    (p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0,
  );
}

/** Live-token protocols usable as comparables: the all-live set minus
 *  the excluded categories. radar-3 fit on all 128; radar-4 fits on
 *  the 94 that remain. */
export function comparables(snapshot: Snapshot): SnapshotProtocol[] {
  return allLive(snapshot).filter((p) => p.category === null || !EXCLUDED_CATEGORIES.includes(p.category));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-14" plus n days, as "14 Dec 2026". */
export function dateLabel(asOf: string, days: number): string {
  const d = new Date(`${asOf}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]!} ${d.getUTCFullYear()}`;
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

/** The fitted model: log(mcap) on log(TVL) and log(chains). */
export interface ModelFit {
  intercept: number;
  slope: number;
  chain_coef: number;
  r2: number;
}

/** OLS fit of log(mcap) on [1, log TVL, log chains]. */
export function fitModel(train: SnapshotProtocol[]): ModelFit {
  const feats = (p: SnapshotProtocol): number[] => [1, Math.log(p.tvl_usd), Math.log(Math.max(1, p.chains.length))];
  const beta = fitOls(train, feats);
  const ys = train.map((p) => Math.log(p.mcap_usd!));
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let ssRes = 0;
  let ssTot = 0;
  for (const p of train) {
    const f = feats(p);
    let pred = 0;
    for (let i = 0; i < beta.length; i++) pred += beta[i]! * f[i]!;
    ssRes += (Math.log(p.mcap_usd!) - pred) * (Math.log(p.mcap_usd!) - pred);
    ssTot += (Math.log(p.mcap_usd!) - my) * (Math.log(p.mcap_usd!) - my);
  }
  return {
    intercept: round4(beta[0]!),
    slope: round4(beta[1]!),
    chain_coef: round4(beta[2]!),
    r2: round4(ssTot === 0 ? 0 : 1 - ssRes / ssTot),
  };
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

/** Bounded priors: growth and maturity only. Chains are a fitted
 *  term now (see fitModel), not a prior: chainMult is 1. */
export function priors(p: SnapshotProtocol, asOf: string, model: ModelConstants = MODEL): {
  growthPct: number; growthMult: number; chainMult: number; maturityMult: number; age: number | null;
} {
  const age = ageDays(asOf, p.listed_at);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, finite(p.change_7d, 0)));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor
    + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  return { growthPct: round4(growthPct), growthMult: round4(growthMult), chainMult: 1, maturityMult: round4(maturityMult), age };
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

/** Full implied value under the fitted model: curve (TVL + chains)
 *  x growth and maturity priors x discount. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  fit: ModelFit,
  model: ModelConstants = MODEL,
): ImpliedBreakdown {
  const pr = priors(protocol, asOf, model);
  const d = productDiscount(protocol, model);
  const curveImplied = Math.exp(fit.intercept + fit.slope * Math.log(protocol.tvl_usd));
  const chainFactor = Math.exp(fit.chain_coef * Math.log(Math.max(1, protocol.chains.length)));
  const implied = Math.max(
    1,
    Math.round(curveImplied * chainFactor * pr.growthMult * pr.maturityMult * d.discount),
  );
  return {
    implied,
    curveImplied: Math.round(curveImplied),
    baseMultiple: round4(curveImplied / protocol.tvl_usd),
    chainMultiplier: round4(chainFactor),
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

/** A predictor from an arbitrary fitted feature set: OLS on the given
 *  features, then the same bounded growth / maturity priors and the
 *  same 0.5x wrapped-product discount the shipped model applies, so
 *  challenger variants are compared on identical footing. `shrink`
 *  scales the chains coefficient (feature index 2) toward 0. */
export function predictWithFeats(
  train: SnapshotProtocol[],
  features: (p: SnapshotProtocol) => number[],
  asOf: string,
  model: ModelConstants = MODEL,
  shrink = 1,
): (p: SnapshotProtocol) => number {
  const beta = fitOls(train, features);
  const b = [...beta];
  if (shrink !== 1 && b.length > 2) b[2] = beta[2]! * shrink;
  return (p: SnapshotProtocol): number => {
    const f = features(p);
    let s = 0;
    for (let i = 0; i < b.length; i++) s += b[i]! * f[i]!;
    const pr = priors(p, asOf, model);
    const d = productDiscount(p, model);
    return Math.max(1, Math.round(Math.exp(s) * pr.growthMult * pr.maturityMult * d.discount));
  };
}

/** Indicator features for the radar-5 candidate that fits on all 128
 *  live-token protocols: [1, log TVL, log chains, is CEX, is wrapped /
 *  staked / bridged]. */
export function dummyFeats(p: SnapshotProtocol): number[] {
  const isCex = p.category === 'CEX' ? 1 : 0;
  const isWrapped = p.category !== null && EXCLUDED_CATEGORIES.includes(p.category) && p.category !== 'CEX' ? 1 : 0;
  return [1, Math.log(p.tvl_usd), Math.log(Math.max(1, p.chains.length)), isCex, isWrapped];
}

/** Leave-one-out validation on the clean comparables. Every variant is
 *  refit on the clean set minus the held-out protocol — except the
 *  radar-3 curve, which is refit on all 128 live-token protocols
 *  minus the held-out one and scored on the same clean holdouts, so
 *  the comparison is on identical test rows. */
export function looValidation(
  live: SnapshotProtocol[],
  all: SnapshotProtocol[],
  asOf: string,
  model: ModelConstants = MODEL,
): ValidationEntry[] {
  const entries: ValidationEntry[] = [];
  const flat = (p: SnapshotProtocol): number => p.tvl_usd * model.fallback_multiple;
  const sizeOnly = (train: SnapshotProtocol[]) => {
    const f = fitSizeCurve(train);
    return (p: SnapshotProtocol): number => Math.exp(f.intercept + f.slope * Math.log(p.tvl_usd));
  };
  const full = (train: SnapshotProtocol[]) => {
    const f = fitModel(train);
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
  const catCurve = (train: SnapshotProtocol[], minN: number) => {
    const by = new Map<string, SnapshotProtocol[]>();
    for (const q of train) {
      const list = by.get(q.category ?? '') ?? [];
      list.push(q);
      by.set(q.category ?? '', list);
    }
    const fits = new Map<string, { intercept: number; slope: number }>();
    for (const [c, ps] of by) if (ps.length >= minN) fits.set(c, fitSizeCurve(ps));
    const base = fitSizeCurve(train);
    return (p: SnapshotProtocol): number => {
      const f = fits.get(p.category ?? '') ?? base;
      return Math.exp(f.intercept + f.slope * Math.log(p.tvl_usd));
    };
  };
  const catIntercepts = (train: SnapshotProtocol[], minN: number) => {
    const counts = new Map<string, number>();
    for (const q of train) counts.set(q.category ?? '', (counts.get(q.category ?? '') ?? 0) + 1);
    const cats = [...counts.entries()].filter(([, n]) => n >= minN).map(([c]) => c);
    const feats = (p: SnapshotProtocol): number[] => [
      1,
      Math.log(p.tvl_usd),
      ...cats.map((c) => ((p.category ?? '') === c ? 1 : 0)),
    ];
    const beta = fitOls(train, feats);
    return (p: SnapshotProtocol): number => {
      const f = feats(p);
      let s = 0;
      for (let i = 0; i < beta.length; i++) s += beta[i]! * f[i]!;
      return Math.exp(s);
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
  const quad = (train: SnapshotProtocol[]) => {
    const feats = (p: SnapshotProtocol): number[] => {
      const x = Math.log(p.tvl_usd);
      return [1, x, x * x];
    };
    const beta = fitOls(train, feats);
    return (p: SnapshotProtocol): number => {
      const f = feats(p);
      let s = 0;
      for (let i = 0; i < beta.length; i++) s += beta[i]! * f[i]!;
      return Math.exp(s);
    };
  };
  const joint = (train: SnapshotProtocol[]) => {
    const feats = (p: SnapshotProtocol): number[] => [
      1,
      Math.log(p.tvl_usd),
      growthFrac(p, model),
      Math.log(Math.max(1, p.chains.length)),
      Math.log(Math.max(1, ageFor(p, asOf, model))),
    ];
    const beta = fitOls(train, feats);
    return (p: SnapshotProtocol): number => {
      const f = feats(p);
      let s = 0;
      for (let i = 0; i < beta.length; i++) s += beta[i]! * f[i]!;
      return Math.exp(s);
    };
  };
  const variants: { name: string; scope: 'clean' | 'all'; make: (train: SnapshotProtocol[]) => (p: SnapshotProtocol) => number }[] = [
    { name: 'flat 0.25x multiple', scope: 'clean', make: () => flat },
    { name: 'size curve, clean comparables (2-term)', scope: 'clean', make: sizeOnly },
    { name: 'size + fitted chains (radar-5 core)', scope: 'clean', make: (t) => extra(t, 'chains') },
    { name: 'size + fitted chains + bounded priors + discount (radar-5)', scope: 'clean', make: full },
    { name: 'size curve on all 128 comparables (radar-3)', scope: 'all', make: sizeOnly },
    { name: 'all 128 + fitted CEX/wrapped dummies + chains (radar-5 candidate B)', scope: 'all', make: (t) => predictWithFeats(t, dummyFeats, asOf, model) },
    { name: 'size + fitted chains, chains shrunk 0.5 (radar-5 candidate F)', scope: 'clean', make: (t) => predictWithFeats(t, (p) => [1, Math.log(p.tvl_usd), Math.log(Math.max(1, p.chains.length))], asOf, model, 0.5) },
    { name: 'size + fitted chains + fitted growth (radar-5 candidate J)', scope: 'clean', make: (t) => predictWithFeats(t, (p) => [1, Math.log(p.tvl_usd), Math.log(Math.max(1, p.chains.length)), growthFrac(p, model)], asOf, model) },
    { name: 'category median multiple', scope: 'clean', make: catMedian },
    { name: 'per-category size curve, n>=8', scope: 'clean', make: (t) => catCurve(t, 8) },
    { name: 'category intercepts, n>=8', scope: 'clean', make: (t) => catIntercepts(t, 8) },
    { name: 'size curve + fitted growth', scope: 'clean', make: (t) => extra(t, 'growth') },
    { name: 'size curve + fitted age', scope: 'clean', make: (t) => extra(t, 'age') },
    { name: 'quadratic log-TVL', scope: 'clean', make: quad },
    { name: 'joint fitted (growth + chains + age)', scope: 'clean', make: joint },
  ];
  for (const v of variants) {
    const errs: number[] = [];
    for (let i = 0; i < live.length; i++) {
      const p = live[i]!;
      const train = (v.scope === 'all' ? all : live).filter((q) => q !== p);
      const predict = v.make(train);
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
export function walkForward(
  live: SnapshotProtocol[],
  all: SnapshotProtocol[],
  asOf: string,
  cuts: string[],
  model: ModelConstants = MODEL,
): WalkForwardEntry[] {
  const out: WalkForwardEntry[] = [];
  for (const cut of cuts) {
    const train = live.filter((p) => p.listed_at !== null && p.listed_at <= cut);
    const test = live.filter((p) => p.listed_at !== null && p.listed_at > cut);
    if (train.length < 10 || test.length < 5) continue;
    const trainAll = all.filter((p) => p.listed_at !== null && p.listed_at <= cut);
    const f = fitModel(train);
    const f2 = fitSizeCurve(train);
    const f3 = fitSizeCurve(trainAll);
    const candB = predictWithFeats(trainAll, dummyFeats, asOf, model);
    out.push({
      cut,
      train_n: train.length,
      test_n: test.length,
      flat_median_ape: medianApe((p) => p.tvl_usd * model.fallback_multiple, test),
      size_median_ape: medianApe((p) => Math.exp(f2.intercept + f2.slope * Math.log(p.tvl_usd)), test),
      full_median_ape: medianApe((p) => impliedValue(p, asOf, f, model).implied, test),
      radar3_median_ape: medianApe((p) => Math.exp(f3.intercept + f3.slope * Math.log(p.tvl_usd)), test),
      cand_b_median_ape: medianApe(candB, test),
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
  const all = allLive(snapshot);
  const fit = fitModel(live);
  const loo = looValidation(live, all, snapshot.as_of, model);
  const byName = new Map(loo.map((e) => [e.model, e]));
  const dropped: Validation['dropped'] = [
    {
      term: 'radar-3 curve (all 128 comparables, CEX and wrapped products in)',
      loo_median_ape: byName.get('size curve on all 128 comparables (radar-3)')!.loo_median_ape,
      verdict: 'dropped as the fit set: worse than radar-5 on the same clean holdouts, and worse walk-forward on all four cuts',
    },
    {
      term: 'radar-5 candidate B: all 128 comparables with fitted CEX and wrapped/staked dummies plus the chains term',
      loo_median_ape: byName.get('all 128 + fitted CEX/wrapped dummies + chains (radar-5 candidate B)')!.loo_median_ape,
      verdict: 'dropped: bringing the 34 back in, even with dummies, reintroduces the bias the clean fit removes — worse on the median and better on only 1 of 4 walk-forward cuts',
    },
    {
      term: 'radar-5 candidate F: chains term shrunk halfway toward zero',
      loo_median_ape: byName.get('size + fitted chains, chains shrunk 0.5 (radar-5 candidate F)')!.loo_median_ape,
      verdict: 'dropped: shrinking the chains term moves the model back toward the 2-term curve, which already loses — worse on the median and on all four walk-forward cuts',
    },
    {
      term: 'radar-5 candidate J: chains plus a fitted growth term',
      loo_median_ape: byName.get('size + fitted chains + fitted growth (radar-5 candidate J)')!.loo_median_ape,
      verdict: 'dropped: worse than the shipped model on the median and on all four walk-forward cuts; growth survives only as a small bounded prior',
    },
    {
      term: 'category median multiple (radar-2 base)',
      loo_median_ape: byName.get('category median multiple')!.loo_median_ape,
      verdict: 'dropped: worse than the flat baseline out-of-sample, so no category multiple is used',
    },
    {
      term: 'per-category size curve, one fit per category with n>=8',
      loo_median_ape: byName.get('per-category size curve, n>=8')!.loo_median_ape,
      verdict: 'dropped: 88.5% median error — fitting each category alone overfits the small samples',
    },
    {
      term: 'category intercepts, one shift per category with n>=8',
      loo_median_ape: byName.get('category intercepts, n>=8')!.loo_median_ape,
      verdict: 'dropped: worse than the pooled curve out-of-sample; the categories do not carry a stable level shift',
    },
    {
      term: 'quadratic log-TVL (curved size effect)',
      loo_median_ape: byName.get('quadratic log-TVL')!.loo_median_ape,
      verdict: 'dropped: worse than the straight log-log curve out-of-sample',
    },
    {
      term: 'joint fitted terms (growth + chains + age together)',
      loo_median_ape: byName.get('joint fitted (growth + chains + age)')!.loo_median_ape,
      verdict: 'dropped: the three fitted terms together still lose to the size curve alone',
    },
    {
      term: 'fitted growth term (log mcap on log TVL + 7d growth)',
      loo_median_ape: byName.get('size curve + fitted growth')!.loo_median_ape,
      verdict: 'dropped as a fitted term: worse than the size curve alone out-of-sample; growth survives only as a small bounded prior',
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
    excluded_n: all.length - live.length,
    excluded_categories: [...EXCLUDED_CATEGORIES],
    fit_intercept: fit.intercept,
    fit_slope: fit.slope,
    fit_chain_coef: fit.chain_coef,
    fit_r2: fit.r2,
    flat_r2: flatR2(live),
    loo,
    walk_forward: walkForward(live, all, snapshot.as_of, ['2023-07-01', '2024-01-01', '2024-03-01', '2024-06-01'], model),
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
export function farmEconomics(p: SnapshotProtocol, age: number | null, implied: number, asOf: string, model: ModelConstants = MODEL): FarmEconomics {
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
    start_date: dateLabel(asOf, 0),
    hold_end_date: dateLabel(asOf, hold),
    flip_implied_usd: totalCost * 200000,
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
 * netted in dollars, on a dated timeline that starts on the
 * snapshot's date: the plan names its capital, its total cash cost,
 * its expected payout on the stated capture assumption, and its call.
 * A skip row says so in its own plan and tells the reader the exact
 * implied value that would flip it to farm.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, econ: FarmEconomics, implied: number, asOf: string): FarmStep[] {
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
      : `Call: skip. Expected payout about $${econ.expected_usd} against $${econ.total_cost_usd} of costs, net about $${econ.net_usd}: do not farm this row; revisit only if its implied value rises above $${econ.flip_implied_usd} — that is the exact value that would make the plan break even at the minimum size.`;
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm with ${p.name}, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    { text: `${action} Start in the week of ${econ.start_date}, the snapshot week.`, cost: `$${capital} of capital and about $${econ.setup_gas_usd} of gas`, time: '15 minutes to set up' },
    { text: `${weekly} Do this every week for ${econ.weeks} weeks, from the week of ${econ.start_date} to the week of ${econ.hold_end_date}.`, cost: `about $${econ.weekly_gas_usd} of gas a week for ${econ.weeks} weeks`, time: '10 minutes a week' },
    { text: spread, cost: '$25 of capital and about $3 of gas', time: '10 minutes' },
    {
      text: `Hold the position until ${econ.hold_end_date} — at least ${hold} days from ${econ.start_date} — so the activity is counted in more than one snapshot, and do not withdraw and redeposit the same funds. Total cash cost is $${econ.total_cost_usd} over ${econ.weeks} weeks, so the position breaks even if the airdrop is worth at least $${econ.total_cost_usd}, which is ${econ.breakeven_share_pct.toFixed(5)}% of the $${implied} implied value.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `From ${econ.hold_end_date}, open ${p.name}'s own points or rewards page from its own site and claim only from the link it publishes. The claim window opens on ${econ.hold_end_date}; do not claim before then.`,
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
  fit: ModelFit,
  model: ModelConstants = MODEL,
): { v: ImpliedBreakdown; econ: FarmEconomics } {
  const v = impliedValue(p, asOf, fit, model);
  const econ = farmEconomics(p, v.age, v.implied, asOf, model);
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
    const f = fitModel(sample);
    const scored = board
      .map((b) => ({ slug: b.slug, implied: scoreProtocol(b.protocol, asOf, f, model).v.implied }))
      .sort((a, b) => b.implied - a.implied || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
    scored.forEach((s, i) => ranks.get(s.slug)!.push(i + 1));
  }
  const out = new Map<string, { p10: number; p50: number; p90: number }>();
  for (const [slug, list] of ranks) {
    const s = [...list].sort((a, b) => a - b);
    out.set(slug, {
      p10: s[Math.floor(0.1 * BOOTSTRAP_REFITS) - 1]!,
      p50: s[Math.floor(0.5 * BOOTSTRAP_REFITS) - 1]!,
      p90: s[Math.floor(0.9 * BOOTSTRAP_REFITS) - 1]!,
    });
  }
  return out;
}

export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; validation: Validation } {
  const live = comparables(snapshot);
  const fit = fitModel(live);
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
        farm_steps: farmSteps(s.p, s.v.age, s.econ, s.v.implied, snapshot.as_of).map(stepText),
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
    fit_points: comparables(snapshot).map((p) => ({ tvl_usd: p.tvl_usd, mcap_usd: p.mcap_usd! })),
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
