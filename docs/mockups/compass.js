// Compass mockups: shared chrome, formatting and charts.
(function () {
  const C = (window.Compass = {});

  // ── Formatting ───────────────────────────────────────────────
  C.fmt = (n) => Number(n).toLocaleString("en-IN");
  C.esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  C.TICKS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 400000];
  C.tick = (t) => (t >= 1000 ? t / 1000 + "k" : String(t));
  const QUOTA = { G: "General", L: "Ladies", DEF: "Defence", DEFR: "Defence, common", PWD: "Disability (PWD)", PWDR: "PWD, common" };
  const CAT = { OPEN: "open", OBC: "OBC", SEBC: "SEBC", SC: "SC", ST: "ST", VJ: "VJ/DT", NT1: "NT-B", NT2: "NT-C", NT3: "NT-D" };
  const LEVEL = { S: "state", H: "home university", O: "other university" };
  const STANDALONE = { TFWS: "TFWS (fee waiver)", EWS: "EWS", ORPHANN: "Orphan", ORPHANI: "Orphan", MI: "Minority" };
  C.seatLabel = (t, withLevel) => {
    if (STANDALONE[t]) return STANDALONE[t];
    const m = t.match(/^(PWDR|PWD|DEFR|DEF|G|L)(OPEN|OBC|SEBC|SC|ST|VJ|NT1|NT2|NT3)([HOS])$/);
    if (!m) return t;
    return `${QUOTA[m[1]]} ${CAT[m[2]]}` + (withLevel && m[3] !== "S" ? `, ${LEVEL[m[3]]}` : "");
  };
  C.initials = (name) => {
    const words = name.replace(/\(.*?\)/g, "").split(/[\s,.'-]+/).filter((w) => w.length > 2 && !/^(of|and|the|for|college|institute|engineering|technology|education|society|trust)$/i.test(w));
    return ((words[0]?.[0] ?? name[0]) + (words[1]?.[0] ?? "")).toUpperCase();
  };
  const TINTS = ["#dbeafe", "#e0e7ff", "#fef3c7", "#dcfce7", "#fce7f3", "#e0f2fe", "#ede9fe", "#ffedd5"];
  C.tint = (code) => TINTS[[...code].reduce((s, c) => s + c.charCodeAt(0), 0) % TINTS.length];
  C.SHORT_BRANCH = {
    "Computer Engineering": "Computer", "Computer Science and Engineering": "CSE", "Information Technology": "IT",
    "Electronics and Telecommunication Engg": "E&TC", "Electronics Engineering": "Electronics", "Electrical Engineering": "Electrical",
    "Mechanical Engineering": "Mechanical", "Civil Engineering": "Civil", "Textile Technology": "Textile",
    "Production Engineering[Sandwich]": "Production", "Chemical Engineering": "Chemical",
    "Artificial Intelligence and Data Science": "AI & DS", "Computer Science and Engineering(Artificial Intelligence and Machine Learning)": "CSE (AI-ML)",
  };
  C.short = (b) => C.SHORT_BRANCH[b] ?? b;

  // ── Log scale ────────────────────────────────────────────────
  C.bounds = (vals) => {
    const lo = Math.min(...vals), hi = Math.max(...vals);
    return [C.TICKS.filter((t) => t <= lo).at(-1) ?? C.TICKS[0], C.TICKS.find((t) => t >= hi) ?? C.TICKS.at(-1)];
  };
  C.scale = ([a, z], x0, w) => {
    const f = (v) => x0 + ((Math.log(Math.min(Math.max(v, a), z)) - Math.log(a)) / (Math.log(z) - Math.log(a))) * w;
    f.invert = (px) => Math.exp(Math.log(a) + ((px - x0) / w) * (Math.log(z) - Math.log(a)));
    return f;
  };
  C.roundMerit = (v) => { const s = v < 200 ? 1 : v < 1000 ? 5 : v < 20000 ? 10 : 50; return Math.max(1, Math.round(v / s) * s); };

  // ── Dumbbell chart (same encoding as the app's CutoffChart) ──
  // series: [{ label, r1, last, sub? }]
  C.dumbbell = (wrap, series, o = {}) => {
    const width = wrap.clientWidth || 600, narrow = width < 520;
    const LEFT = o.left ?? (narrow ? 108 : 196), RIGHT = narrow ? 14 : 22, ROW = o.row ?? 34, TOP = 8, BTM = o.axisTitle === false ? 26 : 40;
    const CW = Math.max(width - LEFT - RIGHT, 1), H = TOP + series.length * ROW + BTM, yAxis = H - BTM;
    const dom = o.domain ?? C.bounds(series.flatMap((s) => [s.r1, s.last]).concat(o.merit ?? []));
    const x = C.scale(dom, LEFT, CW);
    let ticks = C.TICKS.filter((t) => t >= dom[0] && t <= dom[1]);
    if (narrow) ticks = ticks.filter((_, i) => i % 2 === 0 || i === ticks.length - 1);
    const max = narrow ? 14 : Math.floor(LEFT / 7.2);
    let s = `<svg viewBox="0 0 ${width} ${H}" style="height:${H}px" role="img" aria-label="${C.esc(o.aria ?? "Closing rank chart")}">`;
    series.forEach((d, i) => { if (i % 2 === 0) s += `<rect x="0" y="${TOP + i * ROW}" width="${width}" height="${ROW}" fill="#fafbfd"/>`; });
    for (const t of ticks) s += `<line x1="${x(t)}" x2="${x(t)}" y1="${TOP}" y2="${yAxis}" stroke="var(--line)"/><text x="${x(t)}" y="${yAxis + 16}" text-anchor="middle" font-size="11" fill="var(--muted-2)" font-family="var(--mono)">${C.tick(t)}</text>`;
    if (o.axisTitle !== false) s += `<text x="${LEFT + CW / 2}" y="${H - 4}" text-anchor="middle" font-size="11" fill="var(--muted-2)" font-family="var(--body)">Closing rank (log scale)</text>`;
    series.forEach((d, i) => {
      const cy = TOP + i * ROW + ROW / 2, x1 = x(d.r1), x2 = x(d.last), reach = o.merit != null && o.merit <= d.last;
      const lbl = d.label.length > max ? d.label.slice(0, max - 1) + "…" : d.label;
      s += `<g class="row" data-i="${i}" ${o.onRow ? 'tabindex="0" role="button"' : ""} style="cursor:${o.onRow ? "pointer" : "default"};outline:none">
        <rect class="hit" x="0" y="${cy - ROW / 2}" width="${width}" height="${ROW}" fill="transparent"/>
        <text x="${LEFT - 12}" y="${cy + 4}" text-anchor="end" font-size="12" font-weight="${reach ? 600 : 400}" fill="${reach ? "var(--blue-deep)" : "var(--muted)"}" font-family="var(--body)" pointer-events="none">${C.esc(lbl)}</text>
        ${d.r1 !== d.last ? `<line x1="${x1}" x2="${x2}" y1="${cy}" y2="${cy}" stroke="var(--amber)" stroke-width="3" stroke-linecap="round" opacity=".45" pointer-events="none"/>` : ""}
        <circle cx="${x1}" cy="${cy}" r="5" fill="#fff" stroke="var(--blue)" stroke-width="2" pointer-events="none"/>
        ${d.r1 !== d.last ? `<circle cx="${x2}" cy="${cy}" r="5" fill="var(--amber)" pointer-events="none"/>` : ""}
      </g>`;
    });
    if (o.merit != null) s += `<line x1="${x(o.merit)}" x2="${x(o.merit)}" y1="${TOP - 4}" y2="${yAxis}" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="4 3" pointer-events="none"/>`;
    s += `</svg><div class="tip" hidden></div>`;
    wrap.innerHTML = s;
    const tip = wrap.querySelector(".tip");
    wrap.querySelectorAll("g.row").forEach((g) => {
      const d = series[+g.dataset.i], hit = g.querySelector(".hit");
      const show = () => { hit.setAttribute("fill", "rgba(219,234,254,.55)"); tip.innerHTML = `<b>${C.esc(d.tipTitle ?? d.label)}</b><div><span>Round I</span><span>${C.fmt(d.r1)}</span></div><div><span>Latest round</span><span>${C.fmt(d.last)}</span></div>`; tip.hidden = false; };
      const hide = () => { hit.setAttribute("fill", "transparent"); tip.hidden = true; };
      g.onmouseenter = show; g.onmouseleave = hide; g.onfocus = show; g.onblur = hide;
      g.onmousemove = (e) => { const r = wrap.getBoundingClientRect(); tip.style.left = Math.min(e.clientX - r.left + 14, r.width - 180) + "px"; tip.style.top = e.clientY - r.top + 14 + "px"; };
      if (o.onRow) { g.onclick = () => o.onRow(d); g.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); o.onRow(d); } }; }
    });
  };

  // ── Merit ruler (the signature) ──────────────────────────────
  // marks: [{ value, label? }]; labelled marks get stacked text, unlabelled ones draw as a barcode.
  // o: { merit, onChange(merit), domain?, barcode?: bool, height? }
  C.ruler = (wrap, marks, o) => {
    wrap.classList.add("ruler");
    const W = wrap.clientWidth || 700, narrow = W < 520, PAD = 14;
    const dom = o.domain ?? C.bounds(marks.map((m) => m.value).concat(o.merit));
    const x = C.scale(dom, PAD, W - PAD * 2);
    const labelled = marks.filter((m) => m.label);
    const LANE = 16, LANES = labelled.length ? 3 : 0;
    const top = LANES * LANE + 8, band = o.barcode ? 46 : 26, base = top + band;
    const chipY = base + (labelled.length ? LANES * LANE + 12 : 14), H = chipY + 22;
    const pinX = x(o.merit);

    let ticks = "", labels = "";
    if (o.barcode) {
      for (const m of marks) {
        const reach = o.merit <= m.value;
        ticks += `<line x1="${x(m.value).toFixed(1)}" x2="${x(m.value).toFixed(1)}" y1="${top + 3}" y2="${base - 3}" stroke="${reach ? "var(--blue)" : "#cbd5e1"}" stroke-width="1" opacity="${reach ? 0.55 : 0.8}"/>`;
      }
    }
    const ends = { up: Array(LANES).fill(-1e9), dn: Array(LANES).fill(-1e9) };
    const charW = narrow ? 5.6 : 6.4;
    labelled.sort((p, q) => p.value - q.value).forEach((m, i) => {
      const tx = x(m.value), reach = o.merit <= m.value, w = `${m.label} ${C.fmt(m.value)}`.length * charW;
      let side = i % 2 ? "dn" : "up", lane = ends[side].findIndex((e) => e < tx - w / 2 - 6);
      if (lane < 0) { side = side === "up" ? "dn" : "up"; lane = ends[side].findIndex((e) => e < tx - w / 2 - 6); }
      if (lane < 0) lane = LANES - 1;
      ends[side][lane] = tx + w / 2;
      const ly = side === "up" ? top - 8 - lane * LANE : base + 16 + lane * LANE;
      const anchor = tx - w / 2 < 0 ? "start" : tx + w / 2 > W ? "end" : "middle";
      const lx = anchor === "start" ? Math.max(tx - 4, 0) : anchor === "end" ? Math.min(tx + 4, W) : tx;
      ticks += `<line x1="${tx}" x2="${tx}" y1="${side === "up" ? ly + 4 : top}" y2="${side === "up" ? base : ly - 11}" stroke="${reach ? "var(--blue)" : "#cbd5e1"}" stroke-width="${reach ? 2 : 1.5}"/>`;
      labels += `<text x="${lx}" y="${ly}" text-anchor="${anchor}" font-size="${narrow ? 10.5 : 11.5}" fill="${reach ? "var(--blue-deep)" : "var(--muted-2)"}" font-family="var(--body)" font-weight="${reach ? 600 : 400}" stroke="#fff" stroke-width="4" paint-order="stroke" stroke-linejoin="round">${C.esc(m.label)} <tspan font-family="var(--mono)" font-weight="500">${C.fmt(m.value)}</tspan></text>`;
    });
    let axis = "";
    let axisTicks = C.TICKS.filter((t) => t >= dom[0] && t <= dom[1]);
    if (narrow) axisTicks = axisTicks.filter((_, i) => i % 2 === 0);
    for (const t of axisTicks) {
      axis += `<line x1="${x(t)}" x2="${x(t)}" y1="${base}" y2="${base + 5}" stroke="#94a3b8"/>`;
      if (!labelled.length) axis += `<text x="${x(t)}" y="${base + 17}" text-anchor="middle" font-size="10.5" fill="var(--muted-2)" font-family="var(--mono)">${C.tick(t)}</text>`;
    }
    const chipW = 8 + `You ${C.fmt(o.merit)}`.length * 6.7;
    const chipX = Math.min(Math.max(pinX - chipW / 2, 0), W - chipW);
    wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="height:${H}px" role="img" aria-label="${C.esc(o.aria ?? "Your merit against closing ranks")}">
      <rect x="${PAD}" y="${top}" width="${Math.max(pinX - PAD, 0)}" height="${band}" rx="4" fill="#f1f5f9"/>
      <rect x="${pinX}" y="${top}" width="${Math.max(W - PAD - pinX, 0)}" height="${band}" rx="4" fill="var(--tint)"/>
      ${ticks}${axis}
      <g class="handle" tabindex="0" role="slider" aria-label="Your merit number" aria-valuemin="${dom[0]}" aria-valuemax="${dom[1]}" aria-valuenow="${o.merit}" aria-valuetext="${C.fmt(o.merit)}">
        <rect x="${pinX - 16}" y="${top - 14}" width="32" height="${H - top + 14}" fill="transparent"/>
        <line x1="${pinX}" x2="${pinX}" y1="${labelled.length ? 10 : top - 6}" y2="${base + 4}" stroke="var(--ink)" stroke-width="2.5"/>
        <line x1="${pinX}" x2="${pinX}" y1="${base + 4}" y2="${chipY}" stroke="var(--ink)" stroke-width="1" stroke-dasharray="2 3"/>
        <rect x="${chipX}" y="${chipY}" width="${chipW}" height="21" rx="10.5" fill="var(--ink)"/>
        <text x="${chipX + chipW / 2}" y="${chipY + 14.5}" text-anchor="middle" font-size="11" fill="#fff" font-family="var(--mono)" font-weight="600">You ${C.fmt(o.merit)}</text>
        <circle cx="${pinX}" cy="${labelled.length ? 6 : top - 8}" r="6" fill="#fff" stroke="var(--ink)" stroke-width="2"/>
      </g>
      <g pointer-events="none">${labels}</g>
    </svg>`;
    const svg = wrap.querySelector("svg"), handle = wrap.querySelector(".handle");
    wrap._toMerit = (e) => {
      const r = svg.getBoundingClientRect();
      return C.roundMerit(x.invert(Math.min(Math.max((e.clientX - r.left) * (W / r.width), PAD), W - PAD)));
    };
    wrap._onChange = o.onChange;
    handle.onkeydown = (e) => {
      const step = e.shiftKey ? 1000 : o.merit < 1000 ? 10 : o.merit < 20000 ? 100 : 500;
      let v = null;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") v = Math.max(1, o.merit - step);
      if (e.key === "ArrowRight" || e.key === "ArrowUp") v = o.merit + step;
      if (v != null) { e.preventDefault(); o.onChange(v); wrap.querySelector(".handle")?.focus(); }
    };
  };
  // dragging survives re-renders because it listens on the document
  let dragWrap = null;
  document.addEventListener("pointerdown", (e) => { const w = e.target.closest?.(".ruler"); if (w?._toMerit) { dragWrap = w; e.preventDefault(); w._onChange(w._toMerit(e)); } });
  document.addEventListener("pointermove", (e) => { if (dragWrap) dragWrap._onChange(dragWrap._toMerit(e)); });
  document.addEventListener("pointerup", () => { dragWrap = null; });

  // ── Small ladder: one choice against the student, zoomed to x4 either side ──
  C.ladder = (r1, last, merit, W = 240) => {
    const x = C.scale([merit / 4, merit * 4], 4, W - 8), x1 = x(r1), x2 = x(last), you = x(merit);
    return `<svg viewBox="0 0 ${W} 22" preserveAspectRatio="none" style="display:block;width:100%;height:22px" aria-label="Round I ${C.fmt(r1)}, latest ${C.fmt(last)}, you ${C.fmt(merit)}">
      <line x1="4" x2="${W - 4}" y1="11" y2="11" stroke="#e2e8f0" stroke-width="2"/>
      ${r1 !== last ? `<line x1="${x1}" x2="${x2}" y1="11" y2="11" stroke="#f59e0b" stroke-width="3" stroke-linecap="round" opacity=".45"/>` : ""}
      <circle cx="${x1}" cy="11" r="4.5" fill="#fff" stroke="#2563eb" stroke-width="2"/>
      ${r1 !== last ? `<circle cx="${x2}" cy="11" r="4.5" fill="#f59e0b"/>` : ""}
      <line x1="${you}" x2="${you}" y1="1" y2="21" stroke="#0f172a" stroke-width="1.5" stroke-dasharray="3 2"/>
    </svg>`;
  };
  C.status = (r1, last, merit) => (merit <= r1 ? "r1" : merit <= last ? "later" : "out");
  C.BADGE = { r1: '<span class="badge badge-safe">✓ Round I</span>', later: '<span class="badge badge-later">◷ Later round</span>', out: '<span class="badge badge-out">– Out of reach</span>' };

  // ── "My CAP plan" steps: a real sequence, so it is numbered ──
  const STEPS = [["list.html", "Option form"], ["simulator.html", "Test in simulator"], ["export.html", "Export for CAP portal"], ["allotment.html", "After allotment"], ["summary.html", "Family summary"]];
  C.planSteps = (el, active) => {
    el.className = "plansteps";
    el.innerHTML = `<ol>${STEPS.map(([h, t], i) => `<li${i === active ? ' aria-current="step"' : i < active ? ' class="done"' : ""}><a href="${h}"><span class="n">${i + 1}</span>${t}</a></li>`).join("")}</ol>`;
  };

  // ── Chrome: toolbar, nav, footer, device toggle, re-render on resize ──
  const ICON = {
    compass: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5z"/></svg>',
  };
  C.icon = ICON;
  const NAV = [["find.html", "Find colleges", "find"], ["colleges.html", "Colleges", "colleges"], ["branches.html", "Branches", "branches"], ["list.html", "My option form", "list"], ["guide.html", "CAP guide", "guide"]];
  const renders = [];
  C.onRender = (fn) => { renders.push(fn); fn(); };
  const rerender = () => renders.forEach((f) => f());

  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page;
    const tb = document.createElement("div");
    tb.className = "toolbar";
    tb.innerHTML = `<strong>${C.esc(document.body.dataset.mock ?? "Compass mockup")}</strong>
      <a href="index.html">All mockups</a>
      <div class="seg" role="group" aria-label="Device"><button type="button" data-dev="desktop" aria-pressed="true">Desktop</button><button type="button" data-dev="phone" aria-pressed="false">Phone</button></div>
      <label><input type="checkbox" id="notes-toggle" checked> Design notes</label>`;
    document.body.prepend(tb);
    tb.querySelectorAll("[data-dev]").forEach((b) => (b.onclick = () => {
      document.body.classList.toggle("phone", b.dataset.dev === "phone");
      tb.querySelectorAll("[data-dev]").forEach((x) => x.setAttribute("aria-pressed", x === b));
    }));
    tb.querySelector("#notes-toggle").onchange = (e) => document.body.classList.toggle("no-notes", !e.target.checked);

    const nav = document.querySelector("[data-nav]");
    if (nav) {
      nav.className = "topnav";
      nav.innerHTML = `<a class="brand" href="landing.html"><span class="brand-mark">${ICON.compass}</span>Compass</a>
        <span class="brand-sub">MHT-CET CAP cutoffs</span>
        <nav class="navlinks" aria-label="Main">${NAV.map(([h, t, k]) => `<a href="${h}"${k === page ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</nav>
        <span class="menu" aria-hidden="true">≡</span>`;
    }
    const foot = document.querySelector("[data-foot]");
    if (foot) {
      foot.className = "site-foot";
      foot.innerHTML = `<span>Based on last year's official closing merit numbers. A guide, not a guarantee of admission.</span>
        <nav aria-label="Footer"><a href="guide.html">CAP guide</a><a href="data.html">Where our numbers come from</a><a href="legal.html">Disclaimer &amp; privacy</a></nav>`;
    }
    const dev = document.querySelector(".device");
    let t, lastW = 0;
    if (dev) new ResizeObserver(([e]) => { const w = Math.round(e.contentRect.width); if (w === lastW) return; lastW = w; clearTimeout(t); t = setTimeout(rerender, 60); }).observe(dev);
    document.fonts?.ready.then(rerender);
  });
})();
