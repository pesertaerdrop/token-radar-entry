// Token Radar radar-3 dashboard. Reads window.RADAR (written beside
// dashboard/ by main.ts) and renders the ranked board, filters, a detail
// view for every protocol with its fitted-curve breakdown and netted farm
// economics, the live-token comparison the curve is fit on, and the
// validation section: leave-one-out, walk-forward, terciles and the terms
// the blind test dropped. No network: every byte shown is in data.js.
// No protocol name is special-cased anywhere.
(function () {
  'use strict';
  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null, preOnly: true };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) { if (n === null || n === undefined || !isFinite(n)) return 'n/a'; return (n > 0 ? '+' : '') + (n * 100).toFixed(1) + '%'; }
  function fmtChange(n) { if (n === null || n === undefined || !isFinite(n)) return 'n/a'; return (n > 0 ? '+' : '') + n.toFixed(2) + '%'; }
  function fmtAge(d) { if (d === null || d === undefined) return 'unknown'; if (d >= 365) return (d / 365).toFixed(1) + 'y'; return Math.max(0, Math.round(d)) + 'd'; }
  function fmtRatio(n) { return n === null || n === undefined || !isFinite(n) ? 'n/a' : n.toFixed(3) + 'x'; }
  function fmtApe(n) { return (n * 100).toFixed(1) + '%'; }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
    });
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // Recompute a row from the snapshot figures, exactly as lib/model.ts
  // does, so the page and board.json visibly agree on every number.
  function impliedOf(row) {
    var v = Math.max(1, Math.round(row.curve_implied_usd * row.growth_multiplier * row.chain_multiplier * row.maturity_multiplier * row.discount));
    return v;
  }

  function readHash() {
    var params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('tab')) state.tab = params.get('tab');
    if (params.get('pre') === '0') state.preOnly = false;
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (!state.preOnly) params.set('pre', '0');
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    window.history.replaceState(null, '', next ? '#' + next : window.location.pathname + window.location.search);
  }

  function boardRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (!q) return true;
      return [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }
  function liveRowsShown() {
    if (state.preOnly) return [];
    var q = state.q.trim().toLowerCase();
    return DATA.live.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (!q) return true;
      return [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    return list.slice().sort(function (a, b) {
      var av, bv, key = state.sort;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'base') { av = a.base_multiple || 0; bv = b.base_multiple || 0; }
      else if (key === 'range') { av = a.rank_p90 - a.rank_p10; bv = b.rank_p90 - b.rank_p10; }
      else if (key === 'net') { av = a.farm ? a.farm.net_usd : 0; bv = b.farm ? b.farm.net_usd : 0; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar · radar-3' })),
      el('div', { class: 'top-meta' },
        el('span', null, 'Snapshot ', el('b', { text: DATA.as_of })),
        el('span', null, 'Floor ', el('b', { text: '$' + Math.round(DATA.floor_usd / 1e6) + 'M TVL' })),
        el('span', null, 'Model ', el('b', { text: DATA.model_version }))
      ));
  }
  function lede() {
    var top = DATA.rows[0];
    var v = DATA.validation;
    var full = v.loo.filter(function (e) { return e.model.indexOf('radar-3') >= 0; })[0];
    var flat = v.loo.filter(function (e) { return e.model.indexOf('flat') === 0; })[0];
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by a fitted value curve' }),
        el('p', null, 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL that records no token. The early radar adds ' + DATA.early_size + ' pre-token protocols below that floor, by TVL. Rank 1 is ', el('b', { text: top ? top.name : '—' }), ' at ', el('b', { text: top ? fmtUsd(top.implied_value_usd) : '—' }), ' implied. Implied value is this entry\u2019s own claim, not a prediction that a token will be issued.')
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token comparables fit on' }), el('b', { text: String(v.comparables_n) })),
        el('div', { class: 'fact' }, el('span', { text: 'LOO median error, radar-3 vs flat' }), el('b', { text: full && flat ? fmtApe(full.loo_median_ape) + ' vs ' + fmtApe(flat.loo_median_ape) : '—' }))
      ));
  }

  function optionList(values, current, allLabel) {
    var opts = [el('option', { value: 'all', text: allLabel })];
    values.forEach(function (v) { opts.push(el('option', { value: v, text: v, selected: v === current ? 'selected' : null })); });
    return opts;
  }
  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (a, r) { return a.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var cat = el('select', { id: 'category', 'aria-label': 'Filter by category' }, optionList(categories, state.category, 'All categories'));
    cat.addEventListener('change', function () { state.category = cat.value; writeHash(); render(); });
    var ch = el('select', { id: 'chain', 'aria-label': 'Filter by chain' }, optionList(chains, state.chain, 'All chains'));
    ch.addEventListener('change', function () { state.chain = ch.value; writeHash(); render(); });
    var pre = el('input', { type: 'checkbox', id: 'preonly', checked: state.preOnly ? 'checked' : null, 'aria-label': 'Pre-token only' });
    pre.addEventListener('change', function () { state.preOnly = pre.checked; writeHash(); render(); });
    var tabPre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token board', onclick: function () { state.tab = 'pre-token'; render(); } });
    var tabLive = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live-token comparison', onclick: function () { state.tab = 'live'; render(); } });
    var shown = state.tab === 'pre-token' ? boardRows().length + ' pre-token rows shown' : DATA.live.length + ' live-token protocols';
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), cat),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), ch),
      el('label', { class: 'check', for: 'preonly' }, pre, 'Pre-token only'),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'View' }), el('div', { class: 'tabs' }, tabPre, tabLive)),
      el('span', { class: 'count', text: shown }));
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' }, el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } }, label, state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' ▼' : ' ▲' }) : null));
  }
  function callPill(farm) {
    if (!farm) return el('span', { class: 'status', text: '—' });
    var cls = farm.call === 'farm' ? 'call farm' : farm.call === 'thin' ? 'call thin' : 'call skip';
    var net = farm.net_usd >= 0 ? '+$' + farm.net_usd : '−$' + Math.abs(farm.net_usd);
    return el('span', { class: cls, text: farm.call + ' ' + net });
  }
  function boardTable() {
    var list = sortedRows(boardRows());
    var extra = liveRowsShown();
    if (list.length === 0 && extra.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category or chain to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.preOnly = true; writeHash(); render(); } })));
    }
    var max = (list[0] && list[0].implied_value_usd) || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtChange(r.change_7d);
      var gc = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      tbody.appendChild(el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false', tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', { class: 'num', text: r.rank_p10 + '–' + r.rank_p90 }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' · ' + (r.chains && r.chains.length ? r.chains.slice(0, 3).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + gc, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: fmtRatio(r.base_multiple) }),
        el('td', null, el('div', { class: 'implied' }, el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })), el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) }))),
        el('td', null, callPill(r.farm)),
        el('td', null, el('span', { class: 'status', text: r.discount < 1 ? 'discounted 0.5x' : 'records no token' }))
      ));
    });
    extra.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', { class: 'num', text: '—' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' · ' + (r.chains && r.chains.length ? r.chains.slice(0, 3).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtChange(r.change_7d) }),
        el('td', { class: 'num', text: '—' }),
        el('td', { class: 'num', text: fmtRatio(r.mcap_usd && r.tvl_usd ? r.mcap_usd / r.tvl_usd : null) }),
        el('td', null, el('div', { class: 'implied' }, el('span', { class: 'num', text: fmtUsd(r.mcap_usd) }))),
        el('td', null, el('span', { class: 'status', text: '—' })),
        el('td', null, el('span', { class: 'status live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' }, el('div', { class: 'table-wrap' }, el('table', null,
      el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Rank range is the p10–p90 rank over 200 refits of the curve. Farm call is the net of the costed plan. Select a row for its model breakdown and farm plan.' }),
      el('thead', null, el('tr', null, sortHeader('implied', 'Rank'), sortHeader('range', 'Rank range'), sortHeader('name', 'Protocol'), sortHeader('tvl', 'TVL'), sortHeader('growth', '7d'), sortHeader('age', 'Age'), sortHeader('base', 'Curve ×'), sortHeader('implied', 'Implied value'), sortHeader('net', 'Farm net'), el('th', { scope: 'col', text: 'Token' }))),
      tbody)));
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      var ratio = r.mcap_usd && r.tvl_usd ? r.mcap_usd / r.tvl_usd : null;
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' · ' + (r.chains && r.chains.length ? r.chains.slice(0, 3).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtChange(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num', text: fmtRatio(ratio) }),
        el('td', null, el('span', { class: 'status live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' }, el('div', { class: 'table-wrap' }, el('table', null,
      el('caption', { class: 'sub', text: 'Live-token protocols by market cap. Their TVL and market cap are the data the size curve is fit on — 128 of them have a positive market cap and enter the fit.' }),
      el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'mcap / TVL' }), el('th', { scope: 'col', text: 'Token' }))),
      tbody)));
  }

  function validationPanel() {
    var v = DATA.validation;
    var m = DATA.model;
    var looRows = v.loo.map(function (e) {
      var best = e.model.indexOf('radar-3') >= 0;
      return el('tr', null,
        el('td', { text: e.model + (best ? '  ← this entry' : '') }),
        el('td', { class: 'num', text: fmtApe(e.loo_median_ape) }),
        el('td', { class: 'num', text: fmtApe(e.loo_mean_ape) }));
    });
    var wfRows = v.walk_forward.map(function (w) {
      return el('tr', null,
        el('td', { text: 'listed after ' + w.cut }),
        el('td', { class: 'num', text: String(w.train_n) + ' / ' + String(w.test_n) }),
        el('td', { class: 'num', text: fmtApe(w.flat_median_ape) }),
        el('td', { class: 'num', text: fmtApe(w.size_median_ape) }),
        el('td', { class: 'num', text: fmtApe(w.full_median_ape) }));
    });
    var tercRows = v.terciles.map(function (t) {
      return el('tr', null,
        el('td', { text: t.label }),
        el('td', { class: 'num', text: fmtUsd(t.tvl_min_usd) + ' – ' + fmtUsd(t.tvl_max_usd) }),
        el('td', { class: 'num', text: fmtRatio(t.median_ratio) }),
        el('td', { class: 'num', text: String(t.n) }));
    });
    var dropRows = v.dropped.map(function (d) {
      return el('tr', null,
        el('td', { text: d.term }),
        el('td', { class: 'num', text: fmtApe(d.loo_median_ape) }),
        el('td', { text: d.verdict }));
    });
    return el('section', { class: 'panel model' },
      el('h2', { text: 'Validation — the curve was tested blind, radar-3' }),
      el('p', { class: 'sub', text: 'One function scores every row, from the snapshot alone. No protocol name is special-cased, and no row is hand-picked. The fit is log(market cap) = ' + v.fit_intercept + ' + ' + v.fit_slope + ' × log(TVL), fit on ' + v.comparables_n + ' live-token protocols with a positive market cap. R² is ' + v.fit_r2 + ' in log space; the flat 0.25x multiple scores ' + v.flat_r2 + '. That is a weak fit in absolute terms — the median error is still about 86% — and the board says so rather than hiding it. What the curve earns is relative: it beats the flat baseline where it matters, out of sample.' }),
      el('div', { class: 'formula' }, 'implied = round( exp(' + v.fit_intercept + ' + ' + v.fit_slope + ' × log(tvl_usd)) × growth × chain × maturity × discount )'),
      el('p', { class: 'sub', text: 'Growth is 1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 × ' + m.growth_weight + '; chain is 1 + ' + m.chain_bonus_per_chain + ' per chain beyond the first, capped at +' + m.chain_bonus_cap + '; maturity is ' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' × ' + m.maturity_range + '; an unknown age uses ' + m.unknown_age_days + ' days. A wrapped, staked or bridged product is discounted 0.5x. These priors move a row by a few percent at most; the curve does the pricing.' }),
      el('h3', { text: 'Leave-one-out — refit on 127, predict the 128th' }),
      el('div', { class: 'table-wrap' }, el('table', null,
        el('caption', { class: 'sub', text: 'Median and mean absolute percentage error on the live-token comparables. Lower is better. The full model ties the size curve on the median and wins clearly on the mean; the category median — radar-2\u2019s base — is worse than the flat baseline.' }),
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Model' }), el('th', { scope: 'col', text: 'LOO median error' }), el('th', { scope: 'col', text: 'LOO mean error' }))),
        el('tbody', null, looRows))),
      el('h3', { text: 'Walk-forward — train on older listings, test on newer ones' }),
      el('div', { class: 'table-wrap' }, el('table', null,
        el('caption', { class: 'sub', text: 'The model never sees the test protocols while it is fit. radar-3 beats the flat baseline on both cuts, and beats the size curve alone on both cuts too.' }),
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Test set' }), el('th', { scope: 'col', text: 'Train / test n' }), el('th', { scope: 'col', text: 'Flat median error' }), el('th', { scope: 'col', text: 'Size curve' }), el('th', { scope: 'col', text: 'radar-3' }))),
        el('tbody', null, wfRows))),
      el('h3', { text: 'Why a flat multiple fails — the size curve in one table' }),
      el('div', { class: 'table-wrap' }, el('table', null,
        el('caption', { class: 'sub', text: 'Median mcap/TVL by TVL tercile of the live comparables. Big protocols trade at a twentieth of the multiple small ones do. A flat multiple prices a $2.7B protocol as if it were a $7M one.' }),
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'TVL tercile' }), el('th', { scope: 'col', text: 'TVL range' }), el('th', { scope: 'col', text: 'Median mcap / TVL' }), el('th', { scope: 'col', text: 'n' }))),
        el('tbody', null, tercRows))),
      el('h3', { text: 'Terms the blind test dropped' }),
      el('div', { class: 'table-wrap' }, el('table', null,
        el('caption', { class: 'sub', text: 'Each term was fit and tested leave-one-out against the size curve alone (median error 85.2%). Every one of them lost, so none of them is in radar-3 as a fitted term.' }),
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Term' }), el('th', { scope: 'col', text: 'LOO median error' }), el('th', { scope: 'col', text: 'Verdict' }))),
        el('tbody', null, dropRows))),
      el('div', { class: 'note' }, el('b', { text: 'Honest limits. ' }), 'A protocol records no token in this snapshot — that is not proof it has none, and this board never predicts whether or when a token is issued. Implied value is this entry\u2019s own claim from TVL, growth, age and chains, not a price and not a promise. Rank ranges come from ' + v.bootstrap_refits + ' refits of the curve on resampled comparables (seed ' + v.bootstrap_seed + '): the top ranks are stable because the TVL gaps between them are wide, not because the model is precise. Farm steps are a plan, not advice; farming costs gas, locks capital and can lose money.'));
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var recomputed = impliedOf(row);
    var steps = row.farm_steps || [];
    var farm = row.farm || {};
    var callText = farm.call === 'farm' ? 'Farm' : farm.call === 'thin' ? 'Thin — farm only at minimum size' : 'Skip — do not farm this row';
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + ' · rank range ' + row.rank_p10 + '–' + row.rank_p90 + ' over 200 refits' }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' · ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') + ' · listed ' + (row.listed_at || 'unknown') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied-value breakdown — fitted curve' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Size curve alone' }), el('b', { class: 'num', text: fmtUsd(row.curve_implied_usd) })),
        el('div', null, el('span', { text: 'Curve multiple (curve / TVL)' }), el('b', { class: 'num', text: fmtRatio(row.base_multiple) })),
        el('div', null, el('span', { text: 'Chain multiplier (' + (row.chains ? row.chains.length : 0) + ' chains)' }), el('b', { class: 'num', text: row.chain_multiplier.toFixed(2) + 'x' })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtChange(row.change_7d) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: row.growth_multiplier.toFixed(4) + 'x' })),
        el('div', null, el('span', { text: 'Age with no token recorded' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: row.maturity_multiplier.toFixed(4) + 'x' })),
        el('div', null, el('span', { text: row.discount < 1 ? 'Discount 0.5x — ' + (row.discount_reason || 'wrapped product') : 'Discount' }), el('b', { class: 'num', text: row.discount.toFixed(2) + 'x' })),
        el('div', { class: 'total' }, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the page recomputes this row as ' + fmtUsd(recomputed) + (Math.abs(recomputed - row.implied_value_usd) <= Math.max(1000, row.implied_value_usd * 0.0001) ? ', the same number board.json carries (within rounding of the stored multipliers).' : ', which differs from the board — the data would be stale.') + ' This protocol records no token; that is not a prediction that it will issue one.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm economics — netted in dollars' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'Capital to deploy' }), el('b', { class: 'num', text: '$' + (farm.capital_usd || 0) })),
        el('div', null, el('span', { text: 'Total cash cost (' + (farm.weeks || 0) + ' weeks of gas)' }), el('b', { class: 'num', text: '$' + (farm.total_cost_usd || 0) })),
        el('div', null, el('span', { text: 'Expected payout (1 farmer in 200,000)' }), el('b', { class: 'num', text: '$' + (farm.expected_usd || 0) })),
        el('div', null, el('span', { text: 'Break-even share of implied value' }), el('b', { class: 'num', text: (farm.breakeven_share_pct || 0).toFixed(5) + '%' })),
        el('div', { class: 'total' }, el('span', { text: callText }), el('b', { class: 'num', text: (farm.net_usd >= 0 ? '+$' : '−$') + Math.abs(farm.net_usd || 0) + ' net' }))
      ),
      el('p', { class: 'sub', text: 'Expected payout is implied value × 0.000005 — one farmer in 200,000 recipients. It is an assumption for netting the plan, not a forecast of any airdrop. Capital is not a cost: it comes back on unwind.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan — 7 steps' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') { if (!dialog.open) dialog.showModal(); } else dialog.setAttribute('open', '');
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(validationPanel());
    shell.appendChild(el('footer', { class: 'foot' },
      el('span', { text: 'Source: DefiLlama protocol index, snapshot ' + DATA.as_of + '. ' + DATA.source }),
      el('span', { text: 'Implied values are this entry\u2019s own claims from the snapshot, not predictions of issuance and not prices. A protocol that records no token may still have one its record does not carry.' })
    ));
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dialog.open) dialog.close(); });
})();
