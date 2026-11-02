/* Grok Bot desk dashboard — static, reads ./data/*.json written by the desk (PAPER desk + REAL read-only wallet, kept separate). No mock numbers. */
(() => {
"use strict";
const $ = (s, el = document) => el.querySelector(s);
const view = $("#view");
const cache = {};
let range = localStorage.getItem("range") || "All";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const usd = (v, d = 2) => v == null ? "—" : (v < 0 ? "-" : "") + "$" + Math.abs(v).toLocaleString("en-US", {minimumFractionDigits: d, maximumFractionDigits: d});
const sUsd = v => v == null ? "—" : (v >= 0 ? "+" : "-") + "$" + Math.abs(v).toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2});
const big = v => v == null ? "—" : v >= 1e9 ? "$" + (v/1e9).toFixed(2) + "B" : v >= 1e6 ? "$" + (v/1e6).toFixed(2) + "M" : v >= 1e3 ? "$" + (v/1e3).toFixed(1) + "K" : "$" + v.toFixed(0);
const pct = (v, d = 2) => v == null ? "—" : (v >= 0 ? "+" : "") + v.toFixed(d) + "%";
const sub = "₀₁₂₃₄₅₆₇₈₉";
function price(v) {
  if (v == null) return "—";
  if (v >= 1) return "$" + v.toLocaleString("en-US", {maximumFractionDigits: 4});
  const s = v.toFixed(20), m = s.match(/^0\.(0*)(\d{1,4})/);
  if (!m) return "$" + v;
  const z = m[1].length;
  return z >= 4 ? "$0.0" + String(z).split("").map(d => sub[d]).join("") + m[2] : "$" + v.toPrecision(4).replace(/0+$/, "");
}
const t = ts => ts ? new Date(typeof ts === "number" ? ts : ts).toLocaleTimeString([], {hour: "numeric", minute: "2-digit"}) : "—";
const dt = ts => ts ? new Date(ts).toLocaleString([], {month: "short", day: "numeric", hour: "numeric", minute: "2-digit"}) : "—";
const ago = ts => { if (!ts) return "—"; const s = (Date.now() - new Date(ts)) / 1000;
  return s < 60 ? Math.round(s) + "s ago" : s < 3600 ? Math.round(s/60) + "m ago" : s < 86400 ? (s/3600).toFixed(1) + "h ago" : Math.round(s/86400) + "d ago"; };
const tone = v => v == null ? "mut" : v > 0 ? "up" : v < 0 ? "down" : "mut";

async function get(name) {
  try {
    const r = await fetch("data/" + name + "?t=" + Date.now(), {cache: "no-store"});
    if (!r.ok) throw new Error(r.status);
    return cache[name] = await r.json();
  } catch (e) { return cache[name] || null; }
}

/* ---------- SVG line chart ---------- */
function chart(points, opts = {}) {
  const W = 390, H = opts.h || 210, P = {l: 8, r: 8, t: 24, b: 18};
  if (!points || points.length < 2) return `<div class="empty" style="height:${H}px;display:flex;align-items:center;justify-content:center">${esc(opts.empty || "Not enough data yet")}</div>`;
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]).concat(opts.extraY || []);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (x1 === x0) x1 = x0 + 1;
  if (y1 === y0) { y0 -= Math.abs(y0) * 0.01 || 1; y1 += Math.abs(y1) * 0.01 || 1; }
  const pad = (y1 - y0) * 0.08; y0 -= pad; y1 += pad;
  const X = x => P.l + (x - x0) / (x1 - x0) * (W - P.l - P.r), Y = y => P.t + (1 - (y - y0) / (y1 - y0)) * (H - P.t - P.b);
  const col = opts.color || (points[points.length-1][1] >= points[0][1] ? "var(--up)" : "var(--down)");
  const d = points.map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1)).join("");
  let g = `<path d="${d}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round"/>`;
  if (opts.base != null && opts.base > y0 && opts.base < y1) g = `<line x1="${P.l}" x2="${W-P.r}" y1="${Y(opts.base)}" y2="${Y(opts.base)}" stroke="#2f3336" stroke-dasharray="2 4"/>` + g;
  for (const h of opts.hlines || []) {
    if (h.y == null || h.y < y0 || h.y > y1) continue;
    g += `<line x1="${P.l}" x2="${W-P.r}" y1="${Y(h.y)}" y2="${Y(h.y)}" stroke="${h.color}" stroke-width="1.2" stroke-dasharray="5 4"/>` +
         `<text x="${W-P.r}" y="${Y(h.y)-4}" text-anchor="end" fill="${h.color}">${esc(h.label)}</text>`;
  }
  for (const n of opts.nodes || []) {
    if (n.t < x0 || n.t > x1) continue;
    const near = points.reduce((a, p) => Math.abs(p[0]-n.t) < Math.abs(a[0]-n.t) ? p : a, points[0]);
    const y = n.y != null ? n.y : near[1], c = n.color || (n.pnl >= 0 ? "var(--up)" : "var(--down)");
    const cx = X(n.t), cy = Y(y), anchor = cx > W - 80 ? "end" : cx < 80 ? "start" : "middle";
    g += `<circle cx="${cx}" cy="${cy}" r="4.5" fill="${c}" stroke="#000" stroke-width="2"/>` +
         `<text x="${cx}" y="${cy - 9}" text-anchor="${anchor}" fill="${c}">${esc(n.label)}</text>`;
  }
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(opts.aria || "chart")}">${g}</svg>`;
}
const RANGES = {LIVE: 30*60e3, "1H": 3600e3, "4H": 4*3600e3, "1D": 86400e3, "1W": 7*86400e3, All: Infinity};

/* ---------- pieces ---------- */
function agentCard(a, pause) {
  const st = !a.running ? "off" : (pause && a.id !== "risk") ? "pause" : "";
  let h = esc(a.headline), s = esc(a.sub || "");
  if (a.id === "auditor" && a.last) s = `<span class="badge ${a.last.passed ? "g" : "r"}">${a.last.passed ? "8/8" : "✕"}</span>${esc(a.last.symbol)} ${esc(a.last.passed ? "passed" : (a.last.reason || ""))}`;
  if (a.id === "analyst") s = a.last ? `<span class="badge ${a.last.passed ? "g" : "r"}">${a.last.score ?? "—"}</span>${esc(a.last.symbol)} ${a.last.passed ? "passed" : "rejected"}` : "No coins scored yet";
  if (a.id === "executor") s = a.last ? `${esc(a.last.symbol)} · ${usd(a.last.size)} · ${t(a.last.ts)}` : "No paper signals yet";
  if (a.id === "risk") s = (a.outcomes && a.outcomes.length) ? a.outcomes.map(o => `<span class="${tone(o.pnl)}">${esc(o.symbol)} ${sUsd(o.pnl)}</span>`).join(" · ") : esc(a.sub);
  const lbl = !a.running ? "down" : (pause && a.id !== "risk") ? "paused" : "";
  return `<div class="agent"><div class="n"><span class="dot ${st}"></span>${esc(a.name)}${lbl ? ` <span class="${st === "off" ? "down" : "warn"}" style="font-size:11px">${lbl}</span>` : ""}</div>
    <div class="h">${h}</div><div class="s">${s}</div></div>`;
}
function actRow(i) {
  const href = i.mint ? `#/coin/${encodeURIComponent(i.mint)}` : "#/activity";
  const v = i.value ? `<div class="v ${i.tone === "up" ? "up" : i.tone === "down" ? "down" : ""}">${esc(i.value)}</div>` : "";
  return `<a class="row" href="${href}"><div class="l"><div class="t">${esc(i.title)}</div>
    <div class="sub">${esc(i.line2)} · ${t(i.ts)}</div></div><div class="r">${v}<div class="v2">${esc(i.value2 || "")}</div></div></a>`;
}
function setTab(name) { document.querySelectorAll("#tabs a").forEach(a => a.classList.toggle("on", a.dataset.tab === name)); }

/* ---------- views ---------- */
async function home() {
  setTab("home");
  const [s, ag, act] = await Promise.all([get("summary.json"), get("agents.json"), get("activity.json")]);
  if (!s) return view.innerHTML = `<div class="empty">The desk hasn't written a snapshot yet.</div>`;
  const cut = Date.now() - RANGES[range];
  const pts = s.series.filter(p => p[0] >= cut);
  const first = pts.length ? pts[0][1] : s.start;
  const chgR = range === "All" ? s.change_usd : s.balance - first;
  const pctR = range === "All" ? s.change_pct : (first ? 100 * (s.balance - first) / first : 0);
  const arrow = chgR > 0 ? "⬆" : chgR < 0 ? "⬇" : "•";
  const nodes = s.nodes.map(n => ({...n}));
  view.innerHTML = `<div class="fade">
   ${s.pause_all ? `<div class="warnbox">PAUSE ALL is on. No new coins or signals; Risk is still guarding open positions.</div>` : ""}
   <div class="sec"><div class="lbl">Paper balance · started at ${usd(s.start)}</div>
    <div class="big">${usd(s.balance)}</div>
    <div class="chg ${tone(chgR)}">${arrow} ${usd(Math.abs(chgR))} (${Math.abs(pctR).toFixed(2)}%) <span class="mut">[${s.multiple.toFixed(2)}x]</span> <span class="mut" style="font-weight:400">${range === "All" ? "all time" : range}</span></div></div>
   ${chart(pts, {nodes, base: s.start, aria: "paper balance", empty: "Balance history starts with the first snapshot"})}
   <div class="ranges">${Object.keys(RANGES).map(r => `<button class="${r === range ? "on" : ""}" data-r="${r}">${r}</button>`).join("")}</div>
   <div class="hdr"><h2>Agents<span class="pill">${ag ? ag.running : 0} running</span></h2><a href="#/agents">See all</a></div>
   <div class="strip">${ag ? ag.agents.map(a => agentCard(a, ag.pause_all)).join("") : `<div class="empty">No agent data</div>`}</div>
   <div class="hdr"><h2>Activity</h2><a href="#/activity">See all</a></div>
   <div class="feed">${act && act.items.length ? act.items.slice(0, 8).map(actRow).join("") : `<div class="empty">No activity yet</div>`}</div>
   ${s.closed_count === 0 && s.open_count === 0 ? `<div class="empty">No paper trades yet</div>` : ""}
   <div class="note">Snapshot ${ago(s.generated_at)} · PAPER: simulated trades on real market data</div></div>`;
  view.querySelectorAll(".ranges button").forEach(b => b.onclick = () => { range = b.dataset.r; localStorage.setItem("range", range); home(); });
}

async function coin(mint) {
  setTab("");
  const c = await get("coins/" + mint + ".json");
  if (!c) return view.innerHTML = `<a class="back" href="javascript:history.back()">‹ Back</a><div class="empty">No snapshot for this coin yet.</div>`;
  const p = c.position, open = p && p.status === "open";
  const since = p && c.price ? 100 * (c.price / p.entry_price - 1) : null;
  const hl = [];
  if (p) hl.push({y: p.entry_price, color: "#71767b", label: "entry " + price(p.entry_price)});
  if (open) hl.push({y: p.stop_price, color: "var(--down)", label: (p.trail_active ? "Risk trailing stop " : "Risk stop ") + price(p.stop_price)});
  if (open && p.trail_active) hl.push({y: p.peak_price * (1 - p.trail_pct/100), color: "var(--warn)", label: "Risk trailing stop " + price(p.peak_price * (1 - p.trail_pct/100))});
  const nodes = [];
  if (p) nodes.push({t: new Date(p.opened_at).getTime(), y: p.entry_price, label: "Executor buy", color: "var(--blue)"});
  if (p && p.closed_at) nodes.push({t: new Date(p.closed_at).getTime(), y: p.exit_price, label: `${p.exit_reason} · ${sUsd(p.pnl_usd)}`, pnl: p.pnl_usd});
  const L = c.audit ? c.audit.layers : [];
  const layerNames = ["Dev rug history","Mint authority","Freeze authority","Dev wallet","Top 10 holders","Liquidity","Pool age","Bundled wallets","Delegations"];
  const layers = layerNames.map((n, i) => L.find(x => x.layer === i) || {layer: i, name: n, state: "grey", value_text: c.audit ? "not checked" : "not audited yet"});
  const v = c.verdict, plan = c.plan;
  const sc = (k, val) => `<div><div class="kv"><span>${k}</span><span>${val == null ? "—" : val.toFixed(2)}</span></div><div class="bar"><i style="width:${Math.round(100*(val||0))}%;${k === "Chase" ? "background:var(--warn)" : ""}"></i></div></div>`;
  const ref = p ? p.entry_price : c.price;
  view.innerHTML = `<div class="fade"><a class="back" href="javascript:history.length>1?history.back():location.hash='#/home'">‹ Back</a>
   <div class="sec"><div style="font-size:22px;font-weight:800">${esc(c.name || "Unknown")} <span class="mut" style="font-weight:600">${esc(c.symbol ? "$" + c.symbol : "")}</span></div>
    <div class="lbl">Solana · migrated ${dt(c.migrated_at)} · ${esc(c.state)}</div>
    <div class="big">${price(c.price)}</div>
    <div class="chg ${tone(since)}">${p ? `${pct(since)} since entry` : `<span class="mut">No paper position · price ${ago(c.price_ts)}</span>`}</div></div>
   ${chart(c.series, {nodes, hlines: hl, extraY: open ? [p.stop_price] : [], aria: "price", color: since == null ? "var(--tx)" : undefined, empty: "Not enough price points yet"})}
   <div class="grid">
    <div class="c"><div class="k">Market cap</div><div class="x">${big(c.stats.market_cap)}</div></div>
    <div class="c"><div class="k">Liquidity</div><div class="x">${big(c.stats.liquidity)}</div></div>
    <div class="c"><div class="k">Holders</div><div class="x">${c.stats.holders == null ? "—" : c.stats.holders.toLocaleString()}</div></div>
    <div class="c"><div class="k">24h volume</div><div class="x">${big(c.stats.volume_24h)}</div></div></div>
   <div class="card"><h3>Your position <span class="paper" style="margin-left:6px">PAPER</span></h3>${p ? `
     <div class="kv"><span>Status</span><span>${esc(p.status)}${p.exit_reason ? " · " + esc(p.exit_reason) : ""}</span></div>
     <div class="kv"><span>Size</span><span>${usd(p.size_usd)}</span></div>
     <div class="kv"><span>Entry</span><span>${price(p.entry_price)} · ${dt(p.opened_at)}</span></div>
     ${p.closed_at ? `<div class="kv"><span>Exit</span><span>${price(p.exit_price)} · ${dt(p.closed_at)}</span></div>
     <div class="kv"><span>P&amp;L after fees</span><span class="${tone(p.pnl_usd)}">${sUsd(p.pnl_usd)}</span></div>` : `<div class="kv"><span>Value now</span><span>${usd(p.tokens * (c.price || p.entry_price))}</span></div>`}` : `<div class="mut">No paper position in this coin</div>`}</div>
   <div class="card"><h3>Auditor · 8 layers ${c.audit ? `<span class="${c.audit.passed ? "up" : "down"}" style="font-size:13px">${c.audit.passed ? "passed" : "rejected"}</span>` : `<span class="mut" style="font-size:13px">not audited</span>`}</h3>
     ${layers.map(l => `<div class="layer"><span class="sq ${l.state}">${l.layer === 0 ? "D" : l.layer}</span><div><div>${esc(l.name)}${l.layer === 0 ? ' <span class="mut" style="font-size:12px">pre-check</span>' : ""}</div><div class="lv">${esc(l.value_text)}</div></div></div>`).join("")}</div>
   <div class="card"><h3>Analyst (rules) ${v ? `<span class="badge ${v.pass ? "g" : "r"}">${v.score ?? "—"}</span>` : ""}</h3>
     ${v ? sc("Alive", v.alive_6h) + sc("Organic", v.organic) + sc("Flush", v.flush) + sc("Chase", v.chase) + (v.failed.length ? `<div class="lv down" style="margin-top:8px">${v.failed.map(esc).join(" · ")}</div>` : "") : `<div class="mut">Not scored (only coins that pass all 8 audit layers are scored)</div>`}</div>
   <div class="card"><h3>Exit levels</h3>
     <div class="kv"><span>Stop</span><span class="down">-${plan.stop_pct}%${ref ? " · " + price(open ? p.stop_price : ref * (1 - plan.stop_pct/100)) : ""}</span></div>
     <div class="kv"><span>Trailing stop on at</span><span class="up">+${plan.trail_start_pct}%${ref ? " · " + price(ref * (1 + plan.trail_start_pct/100)) : ""}</span></div>
     <div class="kv"><span>Trail distance</span><span>${plan.trail_pct}% below peak${open && p.trail_active ? " · active" : ""}</span></div>
     <div class="kv"><span>Time exit</span><span>${plan.timeout_h}h if under +${plan.timeout_min_gain_pct}%</span></div></div>
   <a class="cta ${open ? "sell" : ""}" href="${esc(c.link)}" target="_blank" rel="noopener noreferrer">${open ? "Sell on FOMO" : "Buy on FOMO"}</a>
   <div class="note" style="word-break:break-all">${esc(c.mint)}<br>FOMO has no official API: trades are manual in the FOMO app. Snapshot ${ago(c.generated_at)}.</div></div>`;
}

async function agents() {
  setTab("agents");
  const ag = await get("agents.json");
  if (!ag) return view.innerHTML = `<div class="empty">No agent data yet</div>`;
  view.innerHTML = `<div class="fade"><div class="hdr"><h2>Agents<span class="pill">${ag.running} running</span></h2></div>
   ${ag.pause_all ? `<div class="warnbox">PAUSE ALL is on. Risk keeps guarding open positions.</div>` : ""}
   <div class="agentlist">${ag.agents.map(a => agentCard(a, ag.pause_all)).join("")}</div>
   <div class="note">Price feed (PumpPortal): ${esc(ag.feed.pumpportal || "unknown")} · snapshot ${ago(ag.generated_at)}</div></div>`;
}

async function activity() {
  setTab("activity");
  const act = await get("activity.json");
  view.innerHTML = `<div class="fade"><div class="hdr"><h2>Activity</h2></div><div class="feed">
   ${act && act.items.length ? act.items.map(actRow).join("") : `<div class="empty">No activity yet</div>`}</div></div>`;
}

const tz = ts => ts ? new Date(ts).toLocaleString("en-US", {timeZone: "America/Toronto", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"}) + " ET" : "—";
const amt = v => v == null ? "—" : Number(v).toLocaleString("en-US", {maximumSignificantDigits: 6});
function realCard(r) {
  if (!r) return `<div class="card real"><h3><span class="realtag">REAL — read-only</span></h3><div class="mut">No real-account snapshot yet</div></div>`;
  const ok = r.status === "READ-ONLY (on-chain)", s = r.snapshot;
  const head = `<div class="card real"><h3><span class="realtag">REAL — read-only</span> FOMO wallet</h3>
    <div class="kv"><span>Status</span><span class="${ok ? "up" : "down"}">${esc(r.status)}</span></div>
    ${ok ? "" : `<div class="kv"><span>Why</span><span>${esc(r.reason)}</span></div>`}
    <div class="kv"><span>LIVE trading</span><span class="down">off</span></div>
    ${r.address_short ? `<div class="kv"><span>Wallet</span><span>${esc(r.address_short)}</span></div>` : ""}`;
  if (!s) return head + `<div class="mut" style="margin-top:8px">${r.address_short ? "Waiting for the first on-chain read." : "No wallet connected. Connect in Telegram: /connect_wallet &lt;address&gt;"}</div></div>`;
  const hs = s.holdings.map(h => `<a class="row" href="${esc(h.link)}" target="_blank" rel="noopener noreferrer"><div class="l"><div class="t">${esc(h.symbol || h.mint.slice(0, 6))}</div><div class="sub">${amt(h.amount)} · ${h.price != null ? price(h.price) : "no price"}${h.program === "token-2022" ? " · Token-2022" : ""}</div></div><div class="r"><div class="v">${h.value_usd != null ? usd(h.value_usd) : "—"}</div></div></a>`).join("");
  const tx = r.txs.map(x => { const parts = x.tokens.map(k => `${k.delta > 0 ? "+" : ""}${amt(k.delta)} ${k.symbol || k.mint.slice(0, 4)}`);
    if (x.usdc) parts.push(`${x.usdc > 0 ? "+" : "-"}$${Math.abs(x.usdc).toFixed(2)} USDC`); if (x.sol) parts.push(`${x.sol > 0 ? "+" : ""}${x.sol.toFixed(4)} SOL`);
    return `<div class="row"><div class="l"><div class="t">${esc(x.label)}${x.failed ? " (failed)" : ""}</div><div class="sub">${esc(parts.join(", ") || "no balance change")}</div></div><div class="r"><div class="v2">${tz(x.ts)}</div><div class="v2">${esc(x.sig_short)}</div></div></div>`; }).join("");
  return head + `<div class="lbl" style="margin-top:10px">Real portfolio value</div><div class="big" style="font-size:32px">${usd(s.total_usd)}</div>
    ${s.unpriced ? `<div class="note" style="padding:0">${s.unpriced} token(s) without a DexScreener price are not counted</div>` : ""}
    <div class="kv"><span>SOL</span><span>${amt(s.sol)} · ${usd(s.sol_usd)}</span></div>
    <div class="kv"><span>USDC</span><span>${usd(s.usdc)}</span></div>
    <div class="kv"><span>Tokens held</span><span>${s.holdings.length}</span></div>
    <div class="kv"><span>Last updated</span><span>${tz(s.read_at)}</span></div></div>
    <div class="hdr"><h2>Real holdings <span class="realtag">REAL</span></h2></div><div class="feed realfeed">${hs || `<div class="empty">No tokens held</div>`}</div>
    <div class="hdr"><h2>Real on-chain activity <span class="realtag">REAL</span></h2></div><div class="feed realfeed">${tx || `<div class="empty">No transactions read yet</div>`}</div>
    <div class="note">${esc(r.source)}. ${esc(r.excluded)} The desk cannot trade this wallet. Disconnect: Telegram /disconnect_wallet.</div>`;
}

async function account() {
  setTab("account");
  const [st, s, pos, real] = await Promise.all([get("settings.json"), get("summary.json"), get("positions.json"), get("account_real.json")]);
  const groups = st ? st.settings : {};
  view.innerHTML = `<div class="fade"><div class="hdr"><h2>Account</h2></div>
   ${realCard(real)}
   <div class="hdr"><h2>Paper desk <span class="paper">PAPER</span></h2></div>
   <div class="card"><div class="kv"><span>Mode</span><span class="paper">PAPER</span></div>
    <div class="kv"><span>Status</span><span>Simulated trades on real market data</span></div>
    <div class="kv"><span>Paper stack</span><span>${s ? usd(s.balance) : "—"}</span></div>
    <div class="kv"><span>Free</span><span>${s ? usd(s.free) : "—"}</span></div>
    <div class="kv"><span>Realized P&amp;L</span><span class="${tone(s && s.realized)}">${s ? sUsd(s.realized) : "—"}</span></div>
    <div class="kv"><span>Open / closed</span><span>${pos ? pos.open.length + " / " + pos.closed.length : "—"}</span></div>
    <div class="kv"><span>Alerts</span><span>${esc(st ? st.notifier : "—")}</span></div></div>
   ${pos && pos.closed.length ? `<div class="hdr"><h2>Closed paper trades <span class="paper">PAPER</span></h2></div><div class="feed">${pos.closed.map(p => `<a class="row" href="#/coin/${encodeURIComponent(p.mint)}"><div class="l"><div class="t">${esc(p.symbol)}</div><div class="sub">${esc(p.exit_reason)} · ${dt(p.closed_at)}</div></div><div class="r"><div class="v ${tone(p.pnl_usd)}">${sUsd(p.pnl_usd)}</div><div class="v2">fees ${usd(p.fees_usd)}</div></div></a>`).join("")}</div>` : `<div class="empty">No paper trades yet</div>`}
   <div class="hdr"><h2>Settings</h2></div>
   ${Object.entries(groups).map(([g, kv]) => `<div class="card"><h3 style="text-transform:capitalize">${esc(g)}</h3>${Object.entries(kv).map(([k, val]) => `<div class="kv"><span>${esc(k)}</span><span>${esc(typeof val === "boolean" ? (val ? "on" : "off") : val)}</span></div>`).join("")}</div>`).join("")}
   <div class="note">Settings are read-only here. Change them through the desk (Telegram /pause, /resume) or ask Grok Bot.</div></div>`;
}

async function route() {
  const h = location.hash.replace(/^#\/?/, "") || "home";
  const [name, arg] = h.split("/");
  window.scrollTo(0, 0);
  if (name === "coin" && arg) return coin(decodeURIComponent(arg));
  return ({home, agents, activity, account}[name] || home)();
}
window.addEventListener("hashchange", route);
route();
setInterval(() => { if (!document.hidden && !/^#\/coin/.test(location.hash)) route(); }, 60000);
setInterval(() => { if (!document.hidden && /^#\/coin/.test(location.hash)) route(); }, 60000);
})();
