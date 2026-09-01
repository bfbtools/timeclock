/* slab-gcbill.js — THE GC BILL ARITHMETIC. One file, pure arithmetic, no I/O.

   ⚠ WHY THIS FILE EXISTS ──────────────────────────────────────────────────────────────
   Adrienne, 2026-09-01: "timeclock tools layout exactly." The Time Clock owns the GC
   invoice document; Slab stopped rendering a rival. But the Time Clock's renderer needs the
   numbers Slab computes — her hand-typed lunch total and per-row rate overrides — and the
   first plan was for it to REPLICATE this arithmetic by reading timeclock.html.

   That is the same drift one layer down, and worse in one way: a layout difference is
   visible the moment anyone opens the PDF, while an allocation difference shows up as a
   line item a few cents off, months later, in a document a GC has already paid.

   So this is the ONLY definition, the way public/slab-dayrate.js is the only definition of
   the guaranteed-day rule, and for the reason its header records first-hand: two copies of
   a money rule drift, and past fixes landed on one copy while the other stayed wrong.

   The Time Clock lives in a separate repo (bfbtools/timeclock) and vendors a byte-identical
   copy rather than reaching across repos. Same file, synced on change — never a parallel
   implementation. If you are editing this file, the other copy changes too.

   NO DOM, NO FETCH, NO STATE. Pure arithmetic, so both halves can run it.

   ══════════════════════════════════════════════════════════════════════════════════════
   THE TWO THINGS THAT ARE SUBTLE, AND WHY

   1. LUNCH IS REALLOCATED ACROSS THE LINES, NOT SUBTRACTED AT THE BOTTOM.

      A GC invoice bills net hours per row. When she raises the lunch total, every row's
      hours have to come down so the rows still sum to the billed total. Subtracting a lump
      at the foot would make the total right and every line item wrong — and the line items
      are what the GC reads and checks.

      The reallocation covers only the lines at the GC's own rate (`inPool`). A row at a
      different rate — Carlito's $40 general labor — is somebody's whole day at a rate lunch
      was never computed against, so it keeps its hours untouched.

   2. THE SPLIT IS EXACT, IN INTEGER HUNDREDTHS.

      Floating-point shares of an hour do not sum back to the target, and the usual fix —
      let the last row absorb the difference — makes one arbitrary row wrong by everyone
      else's rounding. So gcAllocate() floors each share in hundredths of an hour and hands
      the leftover units to the largest fractional remainders, ties broken by position. The
      parts sum to the total exactly, and no row carries another row's error.

   ══════════════════════════════════════════════════════════════════════════════════════
   compute(gi, adj) → { gcRate, lunch, lunchBase, lunchMax, poolNet, poolHours,
                        days:[{date, lines:[…]}], lines:[…],
                        totalHours, total, baseTotal,
                        lunchEdited, lunchSource, rateEdited, dirty }

     gi   the GC invoice as the Time Clock generated it: { days:[{date, lines:[{item, rate,
          hours, onsite[]}]}], lunchHours, total }
     adj  { lunch: <total net-lunch HOURS | null>, rates: { "<dayIdx>:<lineIdx>": <rate> } }
          `lunch` is the total for the whole bill and wins outright; null means "use what the
          Time Clock generated". `rates` is keyed by LINE POSITION, so repricing one row on
          one day leaves every other row at that rate alone.

   Tests: test/timeclock-gc-export.test.js — 277 assertions, including the documented case
   (French 1, lunch 41.25 → 57.50, prints $32,703.00, the difference exactly 16.25 hr × $68).
*/
(function (root) {
  'use strict';

  var GC_LUNCH_DEFAULT = 0.75;

  function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function num(v) { return (v == null || v === '' || isNaN(Number(v))) ? null : Number(v); }

  /* THE GC'S RATE is the one the most hours sit at — read off the bill rather than
     configured, so a project billed at something other than $68 needs no setting. Ties go
     to the higher rate. */
  function rateOf(gi) {
    var by = {};
    ((gi && gi.days) || []).forEach(function (d) {
      ((d && d.lines) || []).forEach(function (l) {
        var r = r2(l && l.rate); by[r] = (by[r] || 0) + r2(l && l.hours);
      });
    });
    var keys = Object.keys(by);
    if (!keys.length) return 0;
    keys.sort(function (a, b) { return by[b] - by[a] || Number(b) - Number(a); });
    return Number(keys[0]);
  }

  /* Spread `total` (an integer — hundredths of an hour) over `weights` so the parts sum to
     `total` EXACTLY: floor each share, then hand the leftover units to the largest
     remainders. No drift, and no line silently absorbing everyone else's rounding. */
  function allocate(weights, total) {
    var n = weights.length, out = new Array(n).fill(0);
    if (!n || !(total > 0)) return out;
    var sum = weights.reduce(function (a, b) { return a + (Number(b) || 0); }, 0);
    if (!(sum > 0)) { out[0] = total; return out; }
    var raw = weights.map(function (w) { return (Number(w) || 0) / sum * total; });
    raw.forEach(function (x, i) { out[i] = Math.floor(x); });
    var rem = total - out.reduce(function (a, b) { return a + b; }, 0);
    var order = raw.map(function (x, i) { return { f: x - Math.floor(x), i: i }; })
      .sort(function (a, b) { return b.f - a.f || a.i - b.i; });
    for (var k = 0; rem > 0 && k < order.length; k++, rem--) out[order[k].i]++;
    return out;
  }

  /* THE LUNCH RULE, as levers rather than a typed total: `per` hours off each worked shift,
     skipping shifts under `min` hours. Only offered when the generator's own default rule
     (0.75 × worked shifts) reproduces the lunch the bill arrived with — `usable` — because
     if it does not, the shift list Slab is holding is not the one the figure came from and
     any derived number would be a guess dressed as arithmetic. */
  function lunchRule(gi, adj, shifts) {
    adj = adj || {};
    var perIn = num(adj.lunchPerShift), minIn = num(adj.lunchMinShift);
    var ruleSet = (perIn != null || minIn != null);
    var per = (perIn == null) ? GC_LUNCH_DEFAULT : Math.max(0, r2(perIn));
    var min = (minIn == null) ? 0 : Math.max(0, r2(minIn));
    var all = shifts || null;
    var worked = all ? all.filter(function (x) { return (Number(x.hours) || 0) > 0; }) : [];
    var eligible = worked.filter(function (x) { return (Number(x.hours) || 0) >= min; });
    var check = all ? r2(worked.length * GC_LUNCH_DEFAULT) : null;
    var matches = !!all && check === r2(gi && gi.lunchHours);
    return { per: per, min: min, ruleSet: ruleSet, perSet: perIn != null, minSet: minIn != null,
      worked: worked.length, eligible: eligible.length, skipped: worked.length - eligible.length,
      derived: all ? r2(eligible.length * per) : null,
      haveShifts: !!all, matches: matches, check: check, usable: !!all && matches };
  }

  /* ONE expression decides precedence, and everything else reads it. A typed total wins;
     the rule applies only when nothing was typed AND the rule is derivable; otherwise the
     lunch stays null and compute() falls back to what the Time Clock generated. */
  function lunchAdj(gi, adj, shifts) {
    adj = adj || {};
    var r = lunchRule(gi, adj, shifts);
    var typed = num(adj.lunch);
    var useRule = (typed == null) && r.ruleSet && r.usable;
    var out = {};
    Object.keys(adj).forEach(function (k) { out[k] = adj[k]; });
    out.lunch = useRule ? r.derived : typed;
    out._rule = r;
    out._src = (typed != null) ? 'typed' : (useRule ? 'rule' : 'generated');
    return out;
  }

  function compute(gi, adj) {
    adj = adj || {};
    var rates = adj.rates || {};
    var gcRate = rateOf(gi);
    var lunchBase = r2(gi && gi.lunchHours);
    var lunchIn = adj.lunch;
    var lunch = (lunchIn == null || lunchIn === '' || isNaN(Number(lunchIn)))
      ? lunchBase : Math.max(0, r2(lunchIn));
    var flat = [];
    ((gi && gi.days) || []).forEach(function (d, di) {
      ((d && d.lines) || []).forEach(function (l, li) {
        var baseRate = r2(l && l.rate);
        flat.push({ di: di, li: li, key: di + ':' + li, date: (d && d.date) || '',
          item: (l && l.item) || 'Labor', onsite: (l && l.onsite) || [],
          baseRate: baseRate, baseHours: r2(l && l.hours), inPool: baseRate === gcRate });
      });
    });
    var pool = flat.filter(function (f) { return f.inPool; });
    var poolNet = r2(pool.reduce(function (a, f) { return a + f.baseHours; }, 0));
    var poolGross = r2(poolNet + lunchBase);
    var targetC = Math.max(0, Math.round((poolGross - lunch) * 100));
    var alloc = allocate(pool.map(function (f) { return f.baseHours; }), targetC);
    pool.forEach(function (f, i) { f.hours = r2(alloc[i] / 100); });
    flat.forEach(function (f) {
      if (!f.inPool) f.hours = f.baseHours;
      var ov = rates[f.key];
      f.rate = (ov == null || ov === '' || isNaN(Number(ov))) ? f.baseRate : Math.max(0, r2(ov));
      f.rateEdited = f.rate !== f.baseRate;
      f.amount = r2(f.rate * f.hours);
    });
    var days = ((gi && gi.days) || []).map(function (d, di) {
      return { date: (d && d.date) || '', lines: flat.filter(function (f) { return f.di === di; }) };
    });
    return {
      gcRate: gcRate, lunch: lunch, lunchBase: lunchBase, lunchMax: poolGross,
      poolNet: poolNet, poolHours: r2(targetC / 100),
      days: days, lines: flat,
      totalHours: r2(flat.reduce(function (a, f) { return a + f.hours; }, 0)),
      total: r2(flat.reduce(function (a, f) { return a + f.amount; }, 0)),
      baseTotal: (gi && gi.total != null) ? r2(gi.total) : null,
      lunchEdited: lunch !== lunchBase,
      lunchSource: (adj._src || ((lunchIn == null || lunchIn === '' || isNaN(Number(lunchIn))) ? 'generated' : 'typed')),
      rule: adj._rule || null,
      rateEdited: flat.some(function (f) { return f.rateEdited; }),
      dirty: lunch !== lunchBase || flat.some(function (f) { return f.rateEdited; }),
    };
  }

  var API = { compute: compute, allocate: allocate, rateOf: rateOf,
    lunchRule: lunchRule, lunchAdj: lunchAdj, r2: r2, num: num,
    GC_LUNCH_DEFAULT: GC_LUNCH_DEFAULT };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else root.SLAB_GCBILL = API;
}(typeof globalThis !== 'undefined' ? globalThis : this));
