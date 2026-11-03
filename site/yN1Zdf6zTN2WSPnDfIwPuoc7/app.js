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
const BOT = "Topfloorwunnabot";
const tg = (cmd, arg) => `https://t.me/${BOT}?start=${encodeURIComponent(cmd + (arg ? "_" + arg : ""))}`;
const tgBtn = (cmd, label, arg, cls = "") => `<a class="tgb ${cls}" href="${tg(cmd, arg)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
const fomo = mint => `https://fomo.family/coin?address=${encodeURIComponent(mint)}&chainId=1399811149&source=share_link`;
function stale(ts) {
  if (!ts) return "";
  const m = (Date.now() - new Date(ts)) / 60000;
  return m > 10 ? `<div class="warnbox">Data is ${ago(ts)} old — the desk only runs while its computer is awake, so numbers may be stale. Signals and alerts resume when it wakes.</div>` : "";
}
const ACT = {SELL: "down", TRIM: "warn", HOLD: "up", WATCH: "mut"};
const actBadge = a => `<span class="act ${ACT[a] || "mut"}">${esc(a)}</span>`;
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
  const [s, ag, act, real] = await Promise.all([get("summary.json"), get("agents.json"), get("activity.json"), get("account_real.json")]);
  if (!s) return view.innerHTML = `<div class="empty">The desk hasn't written a snapshot yet.</div>`;
  const cut = Date.now() - RANGES[range];
  const pts = s.series.filter(p => p[0] >= cut);
  const first = pts.length ? pts[0][1] : s.start;
  const chgR = range === "All" ? s.change_usd : s.balance - first;
  const pctR = range === "All" ? s.change_pct : (first ? 100 * (s.balance - first) / first : 0);
  const arrow = chgR > 0 ? "⬆" : chgR < 0 ? "⬇" : "•";
  const nodes = s.nodes.map(n => ({...n}));
  const adv = (real && real.advice) || [], snap = real && real.snapshot;
  const urgent = adv.filter(a => a.advice.action === "SELL" || a.advice.action === "TRIM");
  const realHome = `<a class="card real homereal" href="#/signals"><h3><span class="realtag">REAL — read-only</span> Your FOMO wallet</h3>
    <div class="kv"><span>Value (quoted prices)</span><span>${snap ? usd(snap.total_usd) : "—"}</span></div>
    <div class="kv"><span>Holdings advised</span><span>${adv.length}</span></div>
    <div class="kv"><span>Sell / trim suggestions</span><span class="${urgent.length ? "down" : "mut"}">${urgent.length ? urgent.map(a => esc(a.symbol)).join(", ") : "none"}</span></div>
    <div class="mut" style="font-size:12px;margin-top:6px">Suggestions only — you execute manually in FOMO. Tap for details ›</div></a>`;
  view.innerHTML = `<div class="fade">
   ${stale(s.generated_at)}
   ${s.goal && s.goal.hit ? `<div class="warnbox">Rule 5: goal ${usd(s.goal.usd, 0)} hit — the desk stopped buying and is waiting for you. ${tgBtn("goal", "Set a new goal")}</div>` : ""}
   ${s.signal_mode === "REAL-SIGNALS" ? sizingBox(s.real_sizing) : ""}
   ${s.pause_all ? `<div class="warnbox">PAUSE ALL is on. No new coins or signals; Risk is still guarding open positions.</div>` : ""}
   <div class="sec"><div class="lbl">Paper balance · started at ${usd(s.start)}</div>
    <div class="big">${usd(s.balance)}</div>
    <div class="chg ${tone(chgR)}">${arrow} ${usd(Math.abs(chgR))} (${Math.abs(pctR).toFixed(2)}%) <span class="mut">[${s.multiple.toFixed(2)}x]</span> <span class="mut" style="font-weight:400">${range === "All" ? "all time" : range}</span></div></div>
   ${chart(pts, {nodes, base: s.start, hlines: s.goal ? [{y: s.goal.usd, color: "var(--blue)", label: "rule 5 goal " + usd(s.goal.usd, 0)}] : [], aria: "paper balance", empty: "Balance history starts with the first snapshot"})}
   <div class="ranges">${Object.keys(RANGES).map(r => `<button class="${r === range ? "on" : ""}" data-r="${r}">${r}</button>`).join("")}</div>
   <div class="tgrow">${tgBtn("status", "Status")}${tgBtn("signals", "Signals in Telegram")}${s.pause_all ? tgBtn("resume", "Resume") : tgBtn("pause", "Pause all", null, "danger")}</div>
   ${realHome}
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
  if (!c) return view.innerHTML = `<a class="back" href="javascript:history.back()">‹ Back</a><div class="empty">The dashboard only keeps pages for coins from the last 24 h, open/closed positions and your real holdings. Ask the desk why it stopped this coin, or open it on FOMO.</div>
    <div class="tgrow">${tgBtn("why", "Why? (Telegram)", mint)}<a class="tgb" href="${fomo(mint)}" target="_blank" rel="noopener noreferrer">Open on FOMO</a></div>
    <div class="note" style="word-break:break-all">${esc(mint)}</div>`;
  const p = c.position, open = p && p.status === "open";
  const since = p && c.price ? 100 * (c.price / p.entry_price - 1) : null;
  const hl = [];
  if (p) hl.push({y: p.entry_price, color: "#71767b", label: "entry " + price(p.entry_price)});
  if (open) hl.push({y: p.stop_price, color: "var(--down)", label: (p.trail_active ? "Risk trailing stop " : "Risk stop ") + price(p.stop_price)});
  if (open && p.tp1) hl.push({y: p.tp1, color: "var(--up)", label: "TP1 " + price(p.tp1)}, {y: p.tp2, color: "var(--up)", label: "TP2 " + price(p.tp2)});
  const R = c.real, RL = R && R.advice && R.advice.levels;
  if (R && R.entry && R.entry.ok) hl.push({y: R.entry.avg_price, color: "var(--blue)", label: "your avg entry " + price(R.entry.avg_price)});
  if (RL) hl.push({y: RL.stop, color: "var(--down)", label: "stop " + price(RL.stop)}, {y: RL.tp1, color: "var(--up)", label: "TP1 " + price(RL.tp1)});
  if (open && p.trail_active && !p.strategy) hl.push({y: p.peak_price * (1 - p.trail_pct/100), color: "var(--warn)", label: "Risk trailing stop " + price(p.peak_price * (1 - p.trail_pct/100))});
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
   ${R ? realPos(R) : ""}
   ${c.watch ? `<div class="card"><h3>Strategist <span class="paper" style="margin-left:6px">PAPER</span> <span class="mut" style="font-size:13px">${esc(c.watch.status)}</span></h3>
     ${(c.watch.reasons || []).map(r => `<div class="lv">${esc(r)}</div>`).join("") || `<div class="mut">not checked yet</div>`}
     <div class="note" style="padding:6px 0 0">Watching since ${dt(c.watch.added)} · until ${dt(c.watch.expires)} · last check ${ago(c.watch.last_check)}</div></div>` : ""}
   <div class="grid">
    <div class="c"><div class="k">Market cap</div><div class="x">${big(c.stats.market_cap)}</div></div>
    <div class="c"><div class="k">Liquidity</div><div class="x">${big(c.stats.liquidity)}</div></div>
    <div class="c"><div class="k">Holders</div><div class="x">${c.stats.holders == null ? "—" : c.stats.holders.toLocaleString()}</div></div>
    <div class="c"><div class="k">24h volume</div><div class="x">${big(c.stats.volume_24h)}</div></div></div>
   ${c.mode === "REAL" ? "" : `<div class="card"><h3>Your position <span class="paper" style="margin-left:6px">PAPER</span></h3>${p ? `
     <div class="kv"><span>Status</span><span>${esc(p.status)}${p.exit_reason ? " · " + esc(p.exit_reason) : ""}</span></div>
     <div class="kv"><span>Size</span><span>${usd(p.size_usd)}</span></div>
     <div class="kv"><span>Entry</span><span>${price(p.entry_price)} · ${dt(p.opened_at)}</span></div>
     ${p.strategy ? `<div class="kv"><span>Strategy</span><span>momentum · stop ${price(p.stop_price)} · TP1 ${price(p.tp1)} · TP2 ${price(p.tp2)}</span></div>
     <div class="kv"><span>Take-profits hit</span><span>${p.tp_stage || 0} of 2${p.trim_proceeds ? " · banked " + usd(p.trim_proceeds) : ""}</span></div>` : ""}
     ${p.closed_at ? `<div class="kv"><span>Exit</span><span>${price(p.exit_price)} · ${dt(p.closed_at)}</span></div>
     <div class="kv"><span>P&amp;L after fees</span><span class="${tone(p.pnl_usd)}">${sUsd(p.pnl_usd)}</span></div>` : `<div class="kv"><span>Value now</span><span>${usd(p.tokens * (c.price || p.entry_price))}</span></div>`}` : `<div class="mut">No paper position in this coin</div>`}</div>`}
   ${c.mode === "REAL" ? "" : `<div class="card"><h3>Auditor · 8 layers ${c.audit ? `<span class="${c.audit.passed ? "up" : "down"}" style="font-size:13px">${c.audit.passed ? "passed" : "rejected"}</span>` : `<span class="mut" style="font-size:13px">not audited</span>`}</h3>
     ${layers.map(l => `<div class="layer"><span class="sq ${l.state}">${l.layer === 0 ? "D" : l.layer}</span><div><div>${esc(l.name)}${l.layer === 0 ? ' <span class="mut" style="font-size:12px">pre-check</span>' : ""}</div><div class="lv">${esc(l.value_text)}</div></div></div>`).join("")}</div>
   <div class="card"><h3>Analyst (rules) ${v ? `<span class="badge ${v.pass ? "g" : "r"}">${v.score ?? "—"}</span>` : ""}</h3>
     ${v ? sc("Alive", v.alive_6h) + sc("Organic", v.organic) + sc("Flush", v.flush) + sc("Chase", v.chase) + (v.failed.length ? `<div class="lv down" style="margin-top:8px">${v.failed.map(esc).join(" · ")}</div>` : "") : `<div class="mut">Not scored (only coins that pass all 8 audit layers are scored)</div>`}</div>`}
   ${p && p.strategy ? "" : `<div class="card"><h3>Exit levels${R ? ' <span class="mut" style="font-size:12px">(paper desk rules)</span>' : ""}</h3>
     <div class="kv"><span>Stop</span><span class="down">-${plan.stop_pct}%${ref ? " · " + price(open ? p.stop_price : ref * (1 - plan.stop_pct/100)) : ""}</span></div>
     <div class="kv"><span>Trailing stop on at</span><span class="up">+${plan.trail_start_pct}%${ref ? " · " + price(ref * (1 + plan.trail_start_pct/100)) : ""}</span></div>
     <div class="kv"><span>Trail distance</span><span>${plan.trail_pct}% below peak${open && p.trail_active ? " · active" : ""}</span></div>
     <div class="kv"><span>Time exit</span><span>${plan.timeout_h}h if under +${plan.timeout_min_gain_pct}%</span></div></div>`}
   <a class="cta ${open || (R && (R.advice.action === "SELL" || R.advice.action === "TRIM")) ? "sell" : ""}" href="${esc(c.link)}" target="_blank" rel="noopener noreferrer">${R ? (R.advice.action === "SELL" ? "Sell manually on FOMO" : R.advice.action === "TRIM" ? "Trim manually on FOMO" : "Open on FOMO") : open ? "Sell on FOMO" : "Buy on FOMO"}</a>
   <div class="tgrow">${tgBtn("why", "Why? (Telegram)", c.mint)}${tgBtn("signals", "Signals")}</div>
   <div class="note" style="word-break:break-all">${esc(c.mint)}<br>FOMO has no official API: trades are manual in the FOMO app. Snapshot ${ago(c.generated_at)}.</div></div>`;
}

function realPos(R) {
  const a = R.advice, e = R.entry || {}, ch = R.checks || {}, lv = a.levels;
  const rule = (ok, txt) => `<div class="layer"><span class="sq ${ok == null ? "grey" : ok ? "green" : "red"}">${ok == null ? "?" : ok ? "✓" : "✕"}</span><div>${txt}</div></div>`;
  const f1 = v => v == null ? "not reported" : v.toFixed(1) + "%";
  return `<div class="card real"><h3><span class="realtag">REAL</span> Your holding ${actBadge(a.action)}</h3>
   <div class="advice ${ACT[a.action] || ""}">${esc(a.why)}</div>
   <div class="kv"><span>Amount</span><span>${amt(R.amount)}</span></div>
   <div class="kv"><span>Value at quoted price</span><span>${usd(R.value_usd)}</span></div>
   <div class="kv"><span>If you sold all now (pool maths)</span><span class="${R.thin_pool ? "down" : ""}">${R.realizable_usd == null ? "—" : "≈ " + usd(R.realizable_usd)}${R.thin_pool ? " · thin pool" : ""}</span></div>
   <div class="kv"><span>24h change</span><span class="${tone(R.h24_change)}">${pct(R.h24_change)}</span></div>
   <div class="kv"><span>Your avg entry (estimate)</span><span>${e.ok ? price(e.avg_price) + " · cost " + usd(e.cost_usd) : "unknown — buy not found in recent on-chain history"}</span></div>
   ${e.ok ? `<div class="kv"><span>Unrealized P/L (quoted)</span><span class="${tone(R.pnl_usd)}">${sUsd(R.pnl_usd)} (${pct(R.pnl_pct, 0)})</span></div>
   <div class="kv"><span>Unrealized P/L (if sold now)</span><span class="${tone(R.realizable_pnl_usd)}">${R.realizable_pnl_usd == null ? "—" : sUsd(R.realizable_pnl_usd)}</span></div>` : ""}
   ${lv ? `<div class="kv"><span>Stop (${esc(lv.stop_kind)})</span><span class="down">${price(lv.stop)}</span></div>
   <div class="kv"><span>TP1 / TP2</span><span class="up">${price(lv.tp1)} / ${price(lv.tp2)}</span></div>` : ""}
   <div class="lbl" style="margin-top:10px">Your rules on this coin</div>
   ${rule(ch.dev_pct == null ? null : ch.dev_pct <= 10, `Rule 1 · dev holds ${f1(ch.dev_pct)} (max 10%)`)}
   ${rule(ch.bundle_pct == null ? null : ch.bundle_pct <= 25, `Rule 2 · bundles ${f1(ch.bundle_pct)} (max 25%)`)}
   ${rule(ch.prior_rug == null ? null : !ch.prior_rug, `Rule 3 · dev rug history: ${ch.prior_rug == null ? "unknown" : ch.prior_rug ? "same dev as an old rug" : "none found"}`)}
   ${rule(!R.dev_moved, `Rule 4 · dev wallet ${R.dev_moved ? "MOVED — " + esc(R.dev_moved_why || "") : "not moved since watching"}`)}
   ${(e.approx_sol ? `<div class="note" style="padding:6px 0 0">Entry partly paid in SOL, valued at today's SOL price (approximate).</div>` : "")}
   <div class="note" style="padding:6px 0 0">${esc(R.label)} · updated ${ago(R.updated)}</div></div>`;
}

async function signals() {
  setTab("signals");
  const sd = await get("strategy.json");
  if (!sd) return view.innerHTML = `<div class="empty">No strategy snapshot yet.</div>`;
  const bt = sd.backtest, fw = sd.forward;
  const stRow = (k, u) => { const x = u && u.stats; if (!x || !x.n) return `<tr><td>${esc(k)}</td><td colspan="5" class="mut">no trades</td></tr>`;
    return `<tr><td>${esc(k)}</td><td>${x.n}</td><td>${(x.win_rate*100).toFixed(0)}%</td><td class="up">${pct(x.avg_win_pct,1)}</td><td class="down">${pct(x.avg_loss_pct,1)}</td><td class="down">${x.max_dd_pct.toFixed(1)}%</td></tr>`; };
  view.innerHTML = `<div class="fade"><div class="hdr"><h2>Signals</h2></div>
   ${stale(sd.generated_at)}
   <div class="warnbox">${esc(sd.disclaimer)}</div>
   ${realSignals(sd.real_signals)}
   <div class="hdr"><h2>Your real holdings <span class="realtag">REAL</span></h2></div>
   <div class="feed realfeed">${sd.real.length ? sd.real.map(r => `<a class="row" href="#/coin/${encodeURIComponent(r.mint)}"><div class="l"><div class="t">${actBadge(r.advice.action)} ${esc(r.symbol)}</div><div class="sub">${esc(r.advice.why)}</div></div><div class="r"><div class="v">${usd(r.value_usd)}</div><div class="v2 ${tone(r.pnl_pct)}">${r.pnl_pct == null ? "entry unknown" : pct(r.pnl_pct, 0)}</div></div></a>`).join("") : `<div class="empty">No real holdings advised yet</div>`}</div>
   <div class="note">REAL — suggestion, execute manually in FOMO. The desk cannot trade your wallet.</div>
   <div class="hdr"><h2>Watching for entries <span class="paper">PAPER</span></h2></div>
   ${sd.goal.hit ? `<div class="warnbox">Rule 5: goal ${usd(sd.goal.usd, 0)} hit — no new buys. ${tgBtn("goal", "Set a new goal")}</div>` : ""}
   <div class="feed">${sd.watch.length ? sd.watch.map(w => `<a class="row" href="#/coin/${encodeURIComponent(w.mint)}"><div class="l"><div class="t">${esc(w.symbol)} <span class="mut" style="font-weight:400">${esc(w.status)}</span></div><div class="sub">${esc((w.reasons || []).join(" · ") || "not checked yet")}</div></div><div class="r"><div class="v2">${w.levels ? "stop " + price(w.levels.stop) : ""}</div><div class="v2">${ago(w.last_check)}</div></div></a>`).join("") : `<div class="empty">Nothing on the watchlist. Coins appear here after passing the Auditor (8/8) and the Analyst.</div>`}</div>
   <div class="hdr"><h2>PAPER scorecard (forward test, for comparison) <span class="paper">PAPER</span></h2></div>
   <div class="card"><div class="kv"><span>Closed strategy trades</span><span>${fw.trades}</span></div>
    <div class="kv"><span>Open</span><span>${fw.open}</span></div>
    <div class="kv"><span>Win rate</span><span>${fw.win_rate == null ? "—" : (fw.win_rate*100).toFixed(0) + "%"}</span></div>
    <div class="kv"><span>P&amp;L after fees</span><span class="${tone(fw.pnl_usd)}">${sUsd(fw.pnl_usd)}</span></div>
    <div class="note" style="padding:6px 0 0">${esc(fw.note)}</div></div>
   <div class="hdr"><h2>Backtest</h2></div>
   ${bt ? `<div class="card"><div class="lbl">${esc(bt.period || "")} · 5-min GeckoTerminal candles · fees $0.95/$47.50 each side + ${bt.assumptions.slippage_pct}% slippage each side</div>
    <table class="bt"><tr><th>Universe</th><th>n</th><th>win</th><th>avg win</th><th>avg loss</th><th>max DD</th></tr>
    ${Object.entries(bt.universes).map(([k, u]) => stRow(k + " · " + (u.label || ""), u)).join("")}</table>
    ${bt.baseline ? `<div class="kv"><span>Baseline: buy first candle &amp; hold (A+B)</span><span class="${tone(bt.baseline.avg_pct)}">${bt.baseline.median_pct!=null?pct(bt.baseline.median_pct,1)+" median":pct(bt.baseline.avg_pct,1)+" avg"} · ${(bt.baseline.win_rate*100).toFixed(0)}% up</span></div>` : ""}
    <div class="advice">${esc(bt.verdict || "")}</div>
    ${(bt.caveats || []).map(x => `<div class="lv">• ${esc(x)}</div>`).join("")}</div>` : `<div class="empty">Backtest not run yet</div>`}
   <div class="hdr"><h2>Strategy rules</h2></div>
   <div class="card rules">${esc(sd.plain_rules).replace(/\n/g, "<br><br>")}</div>
   <div class="hdr"><h2>Evidence &amp; sources</h2></div>
   <div class="feed">${sd.sources.map(x => `<a class="row" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer"><div class="l"><div class="t" style="white-space:normal">${esc(x.what)}</div><div class="sub" style="white-space:normal;max-width:none">${esc(x.cite)}${x.finding ? " — " + esc(x.finding) : ""}</div></div></a>`).join("")}</div>
   <div class="tgrow">${tgBtn("signals", "Signals in Telegram")}${tgBtn("strategy", "Strategy in Telegram")}${tgBtn("goal", "Goal")}</div>
   <div class="note">Snapshot ${ago(sd.generated_at)}</div></div>`;
}

async function agents() {
  setTab("agents");
  const ag = await get("agents.json");
  if (!ag) return view.innerHTML = `<div class="empty">No agent data yet</div>`;
  view.innerHTML = `<div class="fade"><div class="hdr"><h2>Agents<span class="pill">${ag.running} running</span></h2></div>
   ${ag.pause_all ? `<div class="warnbox">PAUSE ALL is on. Risk keeps guarding open positions.</div>` : ""}
   ${stale(ag.generated_at)}
   <div class="agentlist">${ag.agents.map(a => agentCard(a, ag.pause_all)).join("")}</div>
   <div class="tgrow">${tgBtn("status", "Status")}${ag.pause_all ? tgBtn("resume", "Resume all") : tgBtn("pause", "Pause all", null, "danger")}</div>
   <div class="note">Buttons open Telegram (@${BOT}) — the desk only takes commands from your chat.</div>
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
  const advOf = m => (r.advice || []).find(a => a.mint === m);
  const hs = s.holdings.map(h => { const a = advOf(h.mint); return `<a class="row" href="#/coin/${encodeURIComponent(h.mint)}"><div class="l"><div class="t">${a ? actBadge(a.advice.action) + " " : ""}${esc(h.symbol || h.mint.slice(0, 6))}</div><div class="sub">${amt(h.amount)} · ${h.price != null ? price(h.price) : "no price"}${h.program === "token-2022" ? " · Token-2022" : ""}</div></div><div class="r"><div class="v">${h.value_usd != null ? usd(h.value_usd) : "—"}</div><div class="v2 ${a ? tone(a.pnl_pct) : ""}">${a && a.pnl_pct != null ? pct(a.pnl_pct, 0) : ""}</div></div></a>`; }).join("");
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
   ${stale(s && s.generated_at)}
   ${realCard(real)}
   <div class="hdr"><h2>Paper desk <span class="paper">PAPER</span></h2></div>
   <div class="card"><div class="kv"><span>Signal mode</span><span class="paper ${s && s.signal_mode === "REAL-SIGNALS" ? "realmode" : ""}">${esc(s ? s.signal_mode : "—")}</span></div>
    <div class="kv"><span>Real account</span><span>${esc(s ? s.account_status : "—")}</span></div>
    <div class="kv"><span>Execution</span><span>${esc(s ? s.execution : "—")}</span></div>
    <div class="kv"><span>Paper engine</span><span class="paper">PAPER</span></div>
    <div class="kv"><span>Status</span><span>Simulated trades on real market data</span></div>
    <div class="kv"><span>Paper stack</span><span>${s ? usd(s.balance) : "—"}</span></div>
    <div class="kv"><span>Free</span><span>${s ? usd(s.free) : "—"}</span></div>
    <div class="kv"><span>Realized P&amp;L</span><span class="${tone(s && s.realized)}">${s ? sUsd(s.realized) : "—"}</span></div>
    <div class="kv"><span>Open / closed</span><span>${pos ? pos.open.length + " / " + pos.closed.length : "—"}</span></div>
    <div class="kv"><span>Alerts</span><span>${esc(st ? st.notifier : "—")}</span></div></div>
   ${pos && pos.closed.length ? `<div class="hdr"><h2>Closed paper trades <span class="paper">PAPER</span></h2></div><div class="feed">${pos.closed.map(p => `<a class="row" href="#/coin/${encodeURIComponent(p.mint)}"><div class="l"><div class="t">${esc(p.symbol)}</div><div class="sub">${esc(p.exit_reason)} · ${dt(p.closed_at)}</div></div><div class="r"><div class="v ${tone(p.pnl_usd)}">${sUsd(p.pnl_usd)}</div><div class="v2">fees ${usd(p.fees_usd)}</div></div></a>`).join("")}</div>` : `<div class="empty">No paper trades yet</div>`}
   <div class="hdr"><h2>Settings</h2></div>
   ${Object.entries(groups).map(([g, kv]) => `<div class="card"><h3 style="text-transform:capitalize">${esc(g)}</h3>${Object.entries(kv).map(([k, val]) => `<div class="kv"><span>${esc(k)}</span><span>${esc(typeof val === "boolean" ? (val ? "on" : "off") : val)}</span></div>`).join("")}</div>`).join("")}
   <div class="tgrow">${tgBtn("pause", "Pause all", null, "danger")}${tgBtn("resume", "Resume")}${tgBtn("goal", "Goal")}${tgBtn("wallet", "Wallet in Telegram")}</div>
   <div class="note">Settings are read-only here. Change them in Telegram (buttons above open @${BOT}) or ask Grok Bot.</div></div>`;
}

async function modeHeader() {
  const s = await get("summary.json");
  const tag = $("#modetag"), ban = $("#modebanner");
  if (!s || !tag) return;
  const real = s.signal_mode === "REAL-SIGNALS";
  tag.textContent = real ? "REAL SIGNALS" : "PAPER";
  tag.classList.toggle("realmode", real);
  tag.title = real ? s.banner : "Simulated trades on real market data";
  document.title = "Grok Bot · Desk (" + (real ? "REAL SIGNALS — manual" : "PAPER") + ")";
  ban.hidden = !real;
  if (real) ban.innerHTML = `${esc(s.banner)} <span class="mut">· Account ${esc(s.account_status)} · LIVE auto-trading off</span>`;
}
const sizingBox = z => !z ? "" : z.status === "insufficient" || z.status === "no_balance"
  ? `<div class="warnbox"><b>REAL buy sizing: ${esc(z.text)}.</b> BUY signals arrive as “insufficient balance — deposit needed” until your wallet holds at least ${usd(z.min_ticket)} USDC.<div class="mut" style="font-size:12px;margin-top:4px">${esc(z.min_ticket_note || "")}</div></div>`
  : `<div class="card real"><div class="kv"><span>REAL buy sizing</span><span>${esc(z.text)}</span></div></div>`;
const sigRow = r => {
  const z = r.sizing || {};
  const amt = r.suggested_usd ? usd(r.suggested_usd) : (z.status === "insufficient" ? "deposit needed" : "no size");
  const st = r.status === "confirmed" ? `<span class="up">confirmed on-chain${r.confirmed_sig_short ? " · tx " + esc(r.confirmed_sig_short) : ""}</span>`
    : r.status === "not_seen" ? `<span class="warn">not seen on-chain</span>` : r.status === "tapped" ? `<span class="warn">you tapped ${esc(r.tapped)} — checking chain</span>`
    : esc(r.status === "insufficient" ? "insufficient balance — deposit needed" : r.status);
  return `<a class="row sig" href="${esc(r.link)}" target="_blank" rel="noopener noreferrer"><div class="l"><div class="t"><span class="side ${esc(r.side)}">${esc(r.side)}</span> ${esc(r.name)}</div><div class="sub" style="white-space:normal;max-width:none">${esc(r.reason)}<br>stop ${price(r.stop)}${r.tp1 ? " · TP1 " + price(r.tp1) + " · TP2 " + price(r.tp2) : ""} · ${st}</div></div><div class="r"><div class="v">${amt}</div><div class="v2">${ago(r.ts)}</div></div></a>`;
};
function realSignals(R) {
  if (!R) return "";
  const sc = (R.ledger && R.ledger.score) || {}, led = (R.ledger && R.ledger.rows) || [], all = R.ledger_all || {};
  const on = R.mode === "REAL-SIGNALS";
  return `<div class="hdr"><h2>REAL signals <span class="realtag">REAL</span></h2></div>
   ${on ? "" : `<div class="warnbox">Signal mode is PAPER — no REAL signals are sent. Send /mode real in Telegram to switch. ${tgBtn("mode", "Mode in Telegram")}</div>`}
   ${sizingBox(R.sizing)}
   ${R.goal && R.goal.hit ? `<div class="warnbox">Rule 5 (REAL): goal ${usd(R.goal.usd, 0)} hit — no BUY signals until you set a new one. ${tgBtn("goal", "Goal")}</div>` : ""}
   <div class="card real"><div class="kv"><span>Account</span><span>${esc(R.account_status)}</span></div>
    <div class="kv"><span>Execution</span><span>you, manually in FOMO · desk never trades</span></div>
    <div class="kv"><span>REAL goal (rule 5)</span><span>${R.goal && R.goal.usd ? usd(R.goal.usd, 0) + (R.goal.hit ? " · HIT" : "") : "not set — /goal real &lt;usd&gt;"}</span></div></div>
   <div class="feed realfeed">${R.signals.length ? R.signals.map(sigRow).join("") : `<div class="empty">No REAL signals yet. BUY signals need a confirmed entry that passes rules 1-3; SELL/TRIM signals come from your real holdings.</div>`}</div>
   <div class="hdr"><h2>REAL scorecard <span class="realtag">REAL · on-chain</span></h2></div>
   <div class="card real"><div class="kv"><span>Since REAL-SIGNALS started</span><span>${sc.since ? dt(sc.since) : "—"}</span></div>
    <div class="kv"><span>Signals sent / confirmed on-chain</span><span>${sc.signals ?? 0} / ${sc.confirmed ?? 0}</span></div>
    <div class="kv"><span>Your on-chain trades</span><span>${sc.trades ?? 0}</span></div>
    <div class="kv"><span>Coins with a sell · wins</span><span>${sc.coins_with_sells ?? 0} · ${sc.wins ?? 0}</span></div>
    <div class="kv"><span>Realized P/L (avg cost)</span><span class="${tone(sc.realized_usd)}">${sUsd(sc.realized_usd ?? 0)}</span></div>
    <div class="kv"><span>All on-chain history read (estimate)</span><span class="${tone(all.realized_usd)}">${all.trades ?? 0} trades · ${sUsd(all.realized_usd ?? 0)}</span></div>
    <div class="note" style="padding:6px 0 0">${esc(sc.note || "")}</div></div>
   <div class="hdr"><h2>REAL ledger <span class="realtag">REAL · on-chain</span></h2></div>
   <div class="feed realfeed">${led.length ? led.map(x => `<div class="row"><div class="l"><div class="t">${esc(x.kind)} ${esc(x.tokens > 0 ? "+" : "")}${amt(x.tokens)}</div><div class="sub">${esc(x.mint.slice(0, 6))}… · tx ${esc(x.sig)}${x.signal_id ? " · matched signal #" + x.signal_id : ""}</div></div><div class="r"><div class="v">${x.usdc ? sUsd(x.usdc) + " USDC" : x.sol ? x.sol.toFixed(4) + " SOL" : "—"}</div><div class="v2">${dt(x.ts * 1000)}</div></div></div>`).join("") : `<div class="empty">No on-chain trades since REAL-SIGNALS started</div>`}</div>`;
}

async function route() {
  modeHeader();
  const h = location.hash.replace(/^#\/?/, "") || "home";
  const [name, arg] = h.split("/");
  window.scrollTo(0, 0);
  if (name === "coin" && arg) return coin(decodeURIComponent(arg));
  return ({home, agents, activity, account, signals}[name] || home)();
}
window.addEventListener("hashchange", route);
route();
setInterval(() => { if (!document.hidden) { const y = window.scrollY; route().then(() => window.scrollTo(0, y)); } }, 60000);
})();
