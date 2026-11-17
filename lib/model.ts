// Token Radar, model radar-2: a comparable-based implied value, computed only
// from the sealed snapshot. No protocol name is ever special-cased.
//
//   base multiple = median mcap/TVL of the live-token protocols in the same
//                   category (fallback 0.25 when a category has no live
//                   protocol, clamped to 0.05..0.60)
//   chain bonus   = 1 + 0.02 per chain beyond the first, capped at +0.10
//   growth        = 1 + clamp(change_7d, -60, 120) / 100 * 0.5
//   maturity      = 0.6 + min(age_days, 1095) / 1095 * 0.4 (unknown age: 365d)
//   implied       = round(tvl_usd * base * chain * growth * maturity)
//
// The median is the honest part and its weak part, stated plainly in the
// dashboard: some categories have only one or two live protocols, so their
// median is one protocol's ratio, clamped. The dashboard shows, for every
// row, how many live protocols its category median rests on.

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
  multiple_floor: number;
  multiple_cap: number;
  chain_bonus_per_chain: number;
  chain_bonus_cap: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
}

export const MODEL: ModelConstants = {
  fallback_multiple: 0.25,
  multiple_floor: 0.05,
  multiple_cap: 0.6,
  chain_bonus_per_chain: 0.02,
  chain_bonus_cap: 0.1,
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
};

export const MODEL_VERSION = 'radar-2';
export const EARLY_ROWS = 160;
export const LIVE_ROWS = 24;

export interface FarmStep {
  text: string;
  cost: string;
  time: string;
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
    base_multiple: number;
    base_multiple_raw: number;
    live_comparables: number;
    chain_multiplier: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
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
  base_multiple: number;
  base_multiple_raw: number;
  live_comparables: number;
  chain_multiplier: number;
  growth_multiplier: number;
  maturity_multiplier: number;
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

export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a sorted list; the middle value, or the mean of the two middles. */
export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export interface CategoryMultiple {
  category: string;
  raw: number;
  multiple: number;
  live_count: number;
}

/**
 * One base multiple per category: the median mcap/TVL of the live-token
 * protocols in that category. A category with no live protocol falls back
 * to 0.25; every multiple is clamped to 0.05..0.60 so one outlier protocol
 * cannot price a whole category. Computed from the snapshot on every run,
 * never hard-coded, and never by protocol name.
 */
export function categoryMultiples(snapshot: Snapshot, model: ModelConstants = MODEL): Map<string, CategoryMultiple> {
  const ratios = new Map<string, number[]>();
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    if (p.category === null) continue;
    const list = ratios.get(p.category) ?? [];
    list.push(p.mcap_usd / p.tvl_usd);
    ratios.set(p.category, list);
  }
  const out = new Map<string, CategoryMultiple>();
  for (const [category, values] of ratios) {
    const raw = median(values);
    const multiple = Math.min(model.multiple_cap, Math.max(model.multiple_floor, raw));
    out.set(category, { category, raw: round4(raw), multiple: round4(multiple), live_count: values.length });
  }
  return out;
}

export interface ImpliedBreakdown {
  implied: number;
  baseMultiple: number;
  baseMultipleRaw: number;
  liveComparables: number;
  chainMultiplier: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  age: number | null;
}

/** The full breakdown for one protocol, under the category multiples. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  multiples: Map<string, CategoryMultiple>,
  model: ModelConstants = MODEL,
): ImpliedBreakdown {
  const age = ageDays(asOf, protocol.listed_at);
  const entry = protocol.category === null ? undefined : multiples.get(protocol.category);
  const baseMultipleRaw = entry === undefined ? model.fallback_multiple : entry.raw;
  const baseMultiple = entry === undefined
    ? model.fallback_multiple
    : Math.min(model.multiple_cap, Math.max(model.multiple_floor, entry.raw));
  const liveComparables = entry === undefined ? 0 : entry.live_count;
  const extraChains = Math.max(0, protocol.chains.length - 1);
  const chainMultiplier = 1 + Math.min(model.chain_bonus_cap, extraChains * model.chain_bonus_per_chain);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor
    + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const implied = Math.max(
    1,
    Math.round(protocol.tvl_usd * baseMultiple * chainMultiplier * growthMult * maturityMult),
  );
  return {
    implied,
    baseMultiple: round4(baseMultiple),
    baseMultipleRaw: round4(baseMultipleRaw),
    liveComparables,
    chainMultiplier: round4(chainMultiplier),
    growthPct: round4(growthPct),
    growthMult: round4(growthMult),
    maturityMult: round4(maturityMult),
    age,
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

export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const multiples = categoryMultiples(snapshot, model);
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
    const v = impliedValue(p, snapshot.as_of, multiples, model);
    return { p, v };
  });
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
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
      base_multiple: s.v.baseMultiple,
      base_multiple_raw: s.v.baseMultipleRaw,
      live_comparables: s.v.liveComparables,
      chain_multiplier: s.v.chainMultiplier,
      growth_pct: s.v.growthPct,
      growth_multiplier: s.v.growthMult,
      maturity_multiplier: s.v.maturityMult,
      age_days: s.v.age,
    },
    farm_steps: farmSteps(s.p, s.v.age).map(stepText),
  }));
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

/** Capital tier by TVL: $50 under $100M, $100 to $1B, $150 to $5B, $250 above. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

function categoryKey(p: SnapshotProtocol): string {
  return (p.category ?? '').toLowerCase();
}

/** The main farming action for the protocol's category, on its first chain. */
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

/** The weekly qualifying action, specific to the category and chain. */
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

/**
 * Seven farm steps, each derived from the protocol's own record (category,
 * chains, TVL, age). The main action, the capital tier, the hold and the
 * weekly action all change with the protocol; nothing is a generic repeat.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const second = secondChainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const weekly = weeklyFor(p, chain);
  const spread = second === null
    ? `Open a second, smaller $25 position in a different ${nameWord(p)} pool or vault on ${chain}, so the wallet is not tied to a single pool.`
    : `Open a second, smaller $25 position on ${second}, so the wallet shows activity on more than one of ${p.name}'s chains.`;
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm with ${p.name}, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    { text: action, cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`, time: '15 minutes to set up' },
    { text: weekly, cost: 'about $2 of gas a week', time: '10 minutes a week' },
    { text: spread, cost: '$25 of capital and about $3 of gas', time: '10 minutes' },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot, and do not withdraw and redeposit the same funds.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open ${p.name}'s own points or rewards page from its own site and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log, check the protocol's TVL each week, and unwind if its TVL falls by half or its site stops responding.`,
      cost: 'nothing but the log',
      time: '5 minutes a week',
    },
  ];
}

function nameWord(p: SnapshotProtocol): string {
  return categoryKey(p).includes('lend') ? 'lending' : categoryKey(p).includes('dex') ? 'liquidity' : 'yield';
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
    base_multiple: row.model.base_multiple,
    base_multiple_raw: row.model.base_multiple_raw,
    live_comparables: row.model.live_comparables,
    chain_multiplier: row.model.chain_multiplier,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    farm_steps: row.farm_steps,
  };
}

export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
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
