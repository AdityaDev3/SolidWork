/* =====================================================================
   AarogyaSight — motion layer (runs after app.js)
   Adds: count-ups, risk "ripples" on the map, chart draw-on + hover readout,
   sliding tab/nav indicators, theme toggle, scroll reveals, live sensor ticks.
   Wraps app.js's update()/updateCharts(); remove this file to go back to static.
   ===================================================================== */
(() => {
  'use strict';
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const easeOut = t => 1 - Math.pow(1 - t, 4);
  const easeIO = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const safe = (name, fn) => { try { fn(); } catch (e) { console.warn('[motion:' + name + ']', e); } };
  const reflow = el => void el.getBoundingClientRect();
  const SVGNS = 'http://www.w3.org/2000/svg';
  const RISK = ['critical', 'high', 'medium', 'low'];
  const RISK_LABEL = ['Very high risk', 'High risk', 'Moderate risk', 'Low risk'];
  const inView = el => { const r = el.getBoundingClientRect(); return r.top < innerHeight * .95 && r.bottom > 0; };

  root.classList.add('mo');

  /* ---------- tiny tween helper ---------- */
  function tween(dur, step, done) {
    if (reduce) { step(1); done && done(); return { cancel() {} }; }
    let id, start = null;
    const frame = t => {
      if (start === null) start = t;
      const p = clamp((t - start) / dur, 0, 1);
      step(p);
      if (p < 1) id = requestAnimationFrame(frame); else done && done();
    };
    id = requestAnimationFrame(frame);
    return { cancel: () => cancelAnimationFrame(id) };
  }

  /* ---------- number count-up ---------- */
  const NUM = /^(\s*)(-?\d+(?:\.\d+)?)([\s\S]*)$/;
  const parse = t => {
    const m = NUM.exec(t || '');
    return m ? { pre: m[1], n: parseFloat(m[2]), dec: (m[2].split('.')[1] || '').length, suf: m[3] } : null;
  };
  function countTo(el, toTxt, opt = {}) {
    const { from, dur = 1100, delay = 0 } = opt;
    el._tw && el._tw.cancel();
    clearTimeout(el._to);
    const b = parse(toTxt);
    if (!b || reduce) { el.textContent = toTxt; return; }
    const a = from != null ? from : 0;
    const fmt = v => b.pre + v.toFixed(b.dec) + b.suf;
    el.textContent = fmt(a);
    el._to = setTimeout(() => {
      el._tw = tween(dur, p => { el.textContent = fmt(a + (b.n - a) * easeOut(p)); }, () => { el.textContent = toTxt; });
    }, delay);
  }
  const swap = el => { el.classList.remove('swap-in'); reflow(el); el.classList.add('swap-in'); };

  /* ================= 1. Hero: split headline, heartbeat, parallax ================= */
  safe('hero', () => {
    const hero = $('.hero');
    if (!hero) return;
    const h1 = $('h1', hero);
    if (h1) {
      h1.setAttribute('aria-label', h1.textContent);
      let c = 0;
      const split = node => {
        Array.from(node.childNodes).forEach(n => {
          if (n.nodeType === 3) {
            const frag = document.createDocumentFragment();
            for (const ch of n.textContent) {
              const s = document.createElement('span');
              s.className = 'ch'; s.setAttribute('aria-hidden', 'true');
              s.style.setProperty('--c', c++); s.textContent = ch;
              frag.appendChild(s);
            }
            n.replaceWith(frag);
          } else if (n.nodeType === 1) split(n);
        });
      };
      split(h1);
    }
    // heartbeat line over the artwork side of the banner
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'mo-ecg'); svg.setAttribute('viewBox', '0 0 1000 46');
    svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
    svg.style.left = '46%'; svg.style.width = '54%';
    let d = 'M0 30';
    for (let k = 0; k < 4; k++) d += ' h70 l6 -4 l6 4 h26 l5 5 l8 -28 l8 38 l5 -15 h40 l7 -6 l9 6 h' + (k === 3 ? 30 : 8);
    ['base', 'trace'].forEach(cls => {
      const p = document.createElementNS(SVGNS, 'path');
      p.setAttribute('class', cls); p.setAttribute('d', d); svg.appendChild(p);
    });
    hero.appendChild(svg);
    // gentle pointer parallax on the photo
    const img = $('.hero-image', hero);
    if (img && !reduce) {
      hero.addEventListener('pointermove', e => {
        const r = hero.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        img.style.translate = (-x * 18) + 'px ' + (-y * 10) + 'px';
      });
      hero.addEventListener('pointerleave', () => { img.style.translate = '0 0'; });
      img.style.transition = 'translate .6s cubic-bezier(.22,1,.36,1)';
    }
  });

  /* ================= 2. Ambient layers: aurora + scroll progress ================= */
  safe('ambient', () => {
    const a = document.createElement('div');
    a.className = 'mo-aurora'; a.setAttribute('aria-hidden', 'true');
    a.innerHTML = '<i></i><i></i><i></i>';
    document.body.prepend(a);
    const bar = document.createElement('div');
    bar.className = 'mo-progress'; bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    let tick = false;
    const upd = () => {
      const h = root.scrollHeight - innerHeight;
      bar.style.transform = 'scaleX(' + (h > 0 ? clamp(scrollY / h, 0, 1) : 0) + ')';
      tick = false;
    };
    addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
    upd();
  });

  /* ================= 3. Count-ups on load / when scrolled into view ================= */
  safe('countups', () => {
    const els = $$('.stat-value, .district-value, .weather-item strong, .sensor strong').filter(el => parse(el.textContent));
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { io.unobserve(e.target); countTo(e.target, e.target.dataset.final, { delay: 150 }); }
    }), { threshold: .4 });
    els.forEach((el, i) => {
      el.dataset.final = el.textContent;
      if (inView(el)) countTo(el, el.dataset.final, { delay: 450 + i * 70, dur: 1300 });
      else { countTo(el, el.dataset.final, { delay: 1e9 }); io.observe(el); }
    });
  });

  /* ================= 4. Scroll reveal for below-the-fold blocks ================= */
  safe('reveal', () => {
    const cands = $$('.content-grid > .panel, .bottom-grid > .panel, .data-table-wrap, .mt-4 > .panel, .page-foot, .about-content');
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('rv-in'); io.unobserve(e.target); }
    }), { threshold: .12, rootMargin: '0px 0px -6% 0px' });
    cands.forEach((el, i) => {
      if (el.getBoundingClientRect().top > innerHeight * .9) {
        el.classList.add('rv');
        el.style.setProperty('--rd', (i % 3) * 110);
        io.observe(el);
      }
    });
  });

  /* ================= 5. Sliding nav indicator ================= */
  safe('nav', () => {
    const list = $('.nav-list');
    if (!list) return;
    const ind = document.createElement('span');
    ind.className = 'nav-indicator'; ind.setAttribute('aria-hidden', 'true');
    list.appendChild(ind);
    const to = link => { if (!link) return; ind.style.height = link.offsetHeight + 'px'; ind.style.transform = 'translateY(' + link.offsetTop + 'px)'; };
    const active = () => $('.nav-link.active', list) || $('.nav-link[aria-current]', list);
    ind.style.transition = 'none'; to(active()); reflow(ind); ind.style.transition = '';
    setTimeout(() => ind.classList.add('on'), 500);
    $$('.nav-link', list).forEach(l => l.addEventListener('pointerenter', () => to(l)));
    list.addEventListener('pointerleave', () => to(active()));
    list.addEventListener('focusin', e => to(e.target.closest('.nav-link')));
    list.addEventListener('focusout', () => to(active()));
  });

  /* ================= 6. Disease tab pill ================= */
  let placePill = () => {};
  safe('tabs', () => {
    const tabs = $('.disease-tabs');
    if (!tabs) return;
    const pill = document.createElement('span');
    pill.className = 'tab-pill'; pill.setAttribute('aria-hidden', 'true');
    tabs.prepend(pill);
    placePill = (instant) => {
      const on = $('[aria-selected="true"]', tabs);
      if (!on) return;
      if (instant) pill.style.transition = 'none';
      pill.style.width = on.offsetWidth + 'px';
      pill.style.transform = 'translateX(' + on.offsetLeft + 'px)';
      if (instant) { reflow(pill); pill.style.transition = ''; }
    };
    placePill(true);
    addEventListener('resize', () => placePill(true));
    document.fonts && document.fonts.ready.then(() => placePill(true));
  });

  /* ================= 7. Spotlight + button ripple ================= */
  safe('pointer', () => {
    let pending = null;
    document.addEventListener('pointermove', e => {
      const card = e.target.closest && e.target.closest('.panel, .stat-card, .sensor');
      if (!card) return;
      pending = [card, e];
      if (pending.raf) return;
      requestAnimationFrame(() => {
        if (!pending) return;
        const [c, ev] = pending; const r = c.getBoundingClientRect();
        c.style.setProperty('--mx', (ev.clientX - r.left) + 'px');
        c.style.setProperty('--my', (ev.clientY - r.top) + 'px');
        pending = null;
      });
    }, { passive: true });
    document.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('.hero-actions button, button.bg-primary');
      if (!b) return;
      if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
      b.style.overflow = 'hidden';
      const r = b.getBoundingClientRect(), size = Math.max(r.width, r.height) * 2;
      const s = document.createElement('span');
      s.className = 'mo-ripple';
      s.style.cssText = 'width:' + size + 'px;height:' + size + 'px;left:' + (e.clientX - r.left - size / 2) + 'px;top:' + (e.clientY - r.top - size / 2) + 'px';
      b.appendChild(s);
      setTimeout(() => s.remove(), 700);
    });
  });

  /* ================= 8. Theme toggle (circular reveal) ================= */
  safe('theme', () => {
    const acct = $('.account');
    if (!acct) return;
    const bell = $('.notification', acct);
    const btn = document.createElement('button');
    btn.className = (bell ? bell.className.replace('notification', '') : 'inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-accent') + ' theme-toggle';
    btn.setAttribute('aria-label', 'Toggle dark mode'); btn.title = 'Toggle dark mode';
    const ico = (cls, body) => '<svg class="' + cls + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
    btn.innerHTML =
      ico('sun', '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-2.93 1.41-1.41m11.32-11.32 1.41-1.41M2 12h2m16 0h2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41"/>') +
      ico('moon', '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>');
    acct.prepend(btn);
    const set = t => { root.dataset.theme = t; try { localStorage.setItem('as-theme', t); } catch (_) {} };
    btn.addEventListener('click', e => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      if (reduce || !document.startViewTransition) {
        root.classList.add('theme-fade'); set(next); setTimeout(() => root.classList.remove('theme-fade'), 450); return;
      }
      const rect = btn.getBoundingClientRect();
      const x = e.detail === 0 ? rect.left + rect.width / 2 : e.clientX, y = e.detail === 0 ? rect.top + rect.height / 2 : e.clientY;
      const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      const vt = document.startViewTransition(() => set(next));
      vt.ready.then(() => root.animate(
        { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + r + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 750, easing: 'cubic-bezier(.22,1,.36,1)', pseudoElement: '::view-transition-new(root)' }
      )).catch(() => {});
    });
  });

  /* ================= 9. Notification bell badge ================= */
  safe('bell', () => {
    const bell = $('.notification');
    if (!bell) return;
    const n = typeof ALERTS !== 'undefined' ? ALERTS.filter(a => a.tone === 'danger' || a.tone === 'warm').length : 2;
    const b = document.createElement('span');
    b.className = 'mo-badge'; b.textContent = n; b.setAttribute('aria-hidden', 'true');
    bell.appendChild(b);
    setTimeout(() => { bell.classList.add('ring'); setTimeout(() => bell.classList.remove('ring'), 1100); }, 2000);
    bell.addEventListener('click', () => { b.classList.add('gone'); setTimeout(() => b.remove(), 350); });
  });

  /* ================= 10. Search shortcut ================= */
  safe('search', () => {
    const wrap = $('.search'), input = wrap && $('input', wrap);
    if (!input) return;
    const k = document.createElement('kbd'); k.textContent = '/'; k.setAttribute('aria-hidden', 'true'); k.style.marginLeft = 'auto';
    wrap.appendChild(k);
    document.addEventListener('keydown', e => {
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
    });
  });

  /* ================= 11. Map: reveal sweep, hover card, ripples, legend ================= */
  const map = $('.map-svg');
  let mapCtl = null;
  safe('map', () => {
    if (!map) return;
    const states = $$('.map-state', map);
    // names from <title>, so the custom card can show the live disease + level
    const FIX = { Orissa: 'Odisha', Uttaranchal: 'Uttarakhand' };
    const boxes = states.map(p => {
      const t = $('title', p);
      const nm = t ? t.textContent.split(' · ')[0] : '';
      p._name = FIX[nm] || nm;
      p.setAttribute('aria-label', p._name);
      t && t.remove();
      const b = p.getBBox();
      p._c = [b.x + b.width / 2, b.y + b.height / 2];
      return p._c;
    });
    const xs = boxes.map(b => b[0]), ys = boxes.map(b => b[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    states.forEach(p => p.style.setProperty('--sx', (((p._c[0] - x0) / (x1 - x0 || 1)) * .75 + ((p._c[1] - y0) / (y1 - y0 || 1)) * .25).toFixed(3)));
    map.classList.add('mp-ready');

    // markers: soft rings that spread out from the selected district
    const marks = $$('g[role="button"]', map);
    marks.forEach(g => {
      const c = $('circle', g);
      const cx = c.getAttribute('cx'), cy = c.getAttribute('cy');
      for (let i = 0; i < 3; i++) {
        const r = document.createElementNS(SVGNS, 'circle');
        r.setAttribute('class', 'mk-ring'); r.setAttribute('cx', cx); r.setAttribute('cy', cy); r.setAttribute('r', 4.5);
        g.insertBefore(r, g.firstChild);
      }
      g._xy = [parseFloat(cx), parseFloat(cy)];
      $$('circle:not(.mk-ring)', g).pop().setAttribute('fill', 'currentColor');
    });

    // hover card
    const tip = document.createElement('div');
    tip.className = 'mo-tip'; tip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tip);
    const lvOf = p => { const m = /risk-(critical|high|medium|low)/.exec(p.getAttribute('fill') || ''); return m ? RISK.indexOf(m[1]) : 3; };
    const dz = () => (typeof disease !== 'undefined' ? disease : 'Dengue');
    map.addEventListener('pointermove', e => {
      const p = e.target.closest && e.target.closest('.map-state');
      map.classList.toggle('is-hovering', !!p);
      if (!p) { tip.classList.remove('on'); return; }
      const lv = lvOf(p);
      tip.innerHTML = '<b>' + p._name + '</b><i style="background:var(--risk-' + RISK[lv] + ')"></i>' + RISK_LABEL[lv] + '<small>' + dz() + ' · illustrative</small>';
      const w = tip.offsetWidth || 130, h = tip.offsetHeight || 54;
      tip.style.left = clamp(e.clientX + 16, 8, innerWidth - w - 8) + 'px';
      tip.style.top = clamp(e.clientY + 16, 8, innerHeight - h - 8) + 'px';
      tip.classList.add('on');
    });
    map.addEventListener('pointerleave', () => { tip.classList.remove('on'); map.classList.remove('is-hovering'); });

    // legend focus
    const box = map.closest('.map-container');
    $$('.risk-legend > div', box).forEach((d, i) => {
      d.addEventListener('pointerenter', () => box.classList.add('dim-' + ['critical', 'high', 'moderate', 'low'][i]));
      d.addEventListener('pointerleave', () => box.className = box.className.replace(/\bdim-\w+/g, '').trim());
    });

    // zoom (called from app.js) eases instead of snapping
    window.__mapZoom = (g, z) => {
      const from = g._z || 1; g._z = z;
      g._tw && g._tw.cancel();
      g._tw = tween(520, p => {
        const k = from + (z - from) * easeOut(p);
        g.setAttribute('transform', 'translate(' + (400 * (1 - k)) + ' ' + (190 * (1 - k)) + ') scale(' + k + ')');
      });
    };

    mapCtl = {
      states, marks,
      refresh() {
        states.forEach(p => p.dataset.lv = lvOf(p));
        marks.forEach((g, i) => {
          const r = typeof score === 'function' ? score(i) : 70;
          const lv = r >= 60 ? 0 : r >= 45 ? 1 : r >= 30 ? 2 : 3;
          g.style.color = 'var(--risk-' + RISK[lv] + ')';
          g.classList.toggle('is-selected', typeof district !== 'undefined' && i === district);
        });
      }
    };
    mapCtl.refresh();
  });

  /* ================= 12. Charts: draw-on + hover readout ================= */
  const DAYS = [[34, 0], [90, 14], [146, 31], [202, 45], [258, 61], [314, 75]];
  const dateAt = x => {
    let i = 0; while (i < DAYS.length - 2 && x > DAYS[i + 1][0]) i++;
    const [xa, da] = DAYS[i], [xb, db] = DAYS[i + 1];
    const d = new Date(2026, 9, 1 + Math.round(da + (db - da) * ((x - xa) / (xb - xa))));
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };
  function lengthVar(el) { try { el.style.setProperty('--len', Math.ceil(el.getTotalLength()) + 2); } catch (_) { el.style.setProperty('--len', 1000); } }
  function drawChart(svg) {
    $$('.prediction-line, .historical-line', svg).forEach(lengthVar);
    $$('.prediction-dot, .historical-dot', svg).filter(d => d.style.display !== 'none').forEach((d, i) => d.style.setProperty('--k', i % 20));
    svg.classList.remove('pre', 'draw'); reflow(svg); svg.classList.add('draw');
  }
  safe('charts', () => {
    const svgs = $$('.forecast-svg');
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { io.unobserve(e.target); drawChart(e.target); }
    }), { threshold: .35 });
    svgs.forEach(svg => {
      svg.parentElement.classList.add('mo-chart-wrap');
      if (inView(svg)) setTimeout(() => drawChart(svg), 650);
      else { svg.classList.add('pre'); io.observe(svg); }

      // hover readout
      const g = document.createElementNS(SVGNS, 'g');
      const guide = document.createElementNS(SVGNS, 'line');
      guide.setAttribute('class', 'chart-guide'); guide.setAttribute('y1', 16); guide.setAttribute('y2', 104);
      const fp = document.createElementNS(SVGNS, 'circle'), fh = document.createElementNS(SVGNS, 'circle');
      fp.setAttribute('class', 'chart-focus'); fp.setAttribute('r', 3.6); fp.style.stroke = 'var(--risk-critical)';
      fh.setAttribute('class', 'chart-focus'); fh.setAttribute('r', 3.2); fh.style.stroke = 'var(--info)';
      g.append(guide, fh, fp); svg.appendChild(g);
      const tip = document.createElement('div');
      tip.className = 'mo-tip'; tip.setAttribute('aria-hidden', 'true'); tip.style.position = 'absolute';
      svg.parentElement.appendChild(tip);
      const off = () => { [guide, fp, fh].forEach(n => n.classList.remove('on')); tip.classList.remove('on'); };
      svg.addEventListener('pointermove', e => {
        const ctm = svg.getScreenCTM(); if (!ctm) return;
        const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
        const x = pt.matrixTransform(ctm.inverse()).x;
        const P = $$('.prediction-dot', svg).filter(d => d.style.display !== 'none');
        const H = $$('.historical-dot', svg).filter(d => d.style.display !== 'none');
        if (!P.length || x < 24 || x > 326) return off();
        let bi = 0, bd = 1e9;
        P.forEach((d, i) => { const dd = Math.abs(parseFloat(d.getAttribute('cx')) - x); if (dd < bd) { bd = dd; bi = i; } });
        const cx = parseFloat(P[bi].getAttribute('cx')), cyP = parseFloat(P[bi].getAttribute('cy'));
        const cyH = H[bi] ? parseFloat(H[bi].getAttribute('cy')) : null;
        guide.setAttribute('x1', cx); guide.setAttribute('x2', cx);
        fp.setAttribute('cx', cx); fp.setAttribute('cy', cyP);
        if (cyH != null) { fh.setAttribute('cx', cx); fh.setAttribute('cy', cyH); }
        [guide, fp].forEach(n => n.classList.add('on')); fh.classList.toggle('on', cyH != null);
        const pv = Math.round((104 - cyP) / .88), hv = cyH != null ? Math.round((104 - cyH) / .88) : null;
        tip.innerHTML = '<b>' + dateAt(cx) + '</b><i style="background:var(--risk-critical)"></i>Predicted ' + pv + '%' +
          (hv != null ? '<br><i style="background:var(--info)"></i>Historical ' + hv + '%' : '');
        const wr = svg.parentElement.getBoundingClientRect(), pr = P[bi].getBoundingClientRect();
        const left = pr.left + pr.width / 2 - wr.left, top = pr.top - wr.top;
        tip.style.left = clamp(left - tip.offsetWidth / 2, 4, wr.width - tip.offsetWidth - 4) + 'px';
        tip.style.top = Math.max(2, top - tip.offsetHeight - 10) + 'px';
        tip.classList.add('on');
      });
      svg.addEventListener('pointerleave', off);
    });
  });

  /* ================= 13. Table rows: stagger index ================= */
  safe('rows', () => {
    $$('.data-table tbody tr').forEach((tr, i) => tr.style.setProperty('--r', i));
    $$('.alert-row').forEach((r, i) => r.style.setProperty('--r', i));
  });

  /* ================= 14. Sparkline that follows the selected district ================= */
  const spark = $('.district-risk .sparkline');
  function sparkFor(r, change, seed) {
    const n = 11, out = [];
    let s = (seed + 3) * 9301 + 49297; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const start = clamp(r - change * 1.6, 6, 94);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const v = i === n - 1 ? r : start + (r - start) * easeIO(t) + (rnd() - .5) * 11 * (1 - t * .8);
      out.push([1 + i * 10.7, clamp(34 - v * .42, 2, 32)]);
    }
    return 'M' + out.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
  }
  safe('spark-init', () => { if (spark) { const p = $('path', spark); lengthVar(p); spark.classList.add('draw'); } });

  /* ================= 15. Wrap app.js update()/updateCharts() ================= */
  safe('wrap', () => {
    const TXT = '.stat-label, .stat-value, .district-value, .weather-item strong, .risk-badge, .factor, .district-risk .trend, .data-table td';
    const NUMERIC = '.district-value, .weather-item strong, .data-table td';
    let lastDistrict = typeof district !== 'undefined' ? district : 0;

    if (typeof updateCharts === 'function') {
      const oc = updateCharts;
      window.updateCharts = function () {
        const r = oc.apply(this, arguments);
        $$('.forecast-svg').forEach(drawChart);
        return r;
      };
    }
    if (typeof update !== 'function') return;
    const ou = update;
    window.update = function () {
      const before = $$(TXT).map(el => [el, el.textContent]);
      const tipG = map && $('.map-tooltip') && $('.map-tooltip').parentElement;
      const oldT = tipG && /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(tipG.getAttribute('transform') || '');

      // stagger the colour change outward from the selected district
      if (mapCtl && typeof district !== 'undefined') {
        const m = mapCtl.marks[district];
        if (m) {
          const [mx, my] = m._xy;
          const dist = mapCtl.states.map(p => Math.hypot(p._c[0] - mx, p._c[1] - my));
          const mx_ = Math.max(...dist) || 1;
          mapCtl.states.forEach((p, i) => p.style.setProperty('--fd', Math.round((dist[i] / mx_) * 650) + 'ms'));
        }
      }

      const result = ou.apply(this, arguments);

      // text/number changes
      before.forEach(([el, old]) => {
        const now = el.textContent;
        if (now === old) return;
        const a = parse(old), b = parse(now);
        if (b && a && a.suf === b.suf && el.matches(NUMERIC)) countTo(el, now, { from: a.n, dur: 800 });
        else swap(el);
      });

      // map tooltip glides to the new district
      if (tipG && oldT) {
        const nt = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(tipG.getAttribute('transform') || '');
        if (nt) {
          const ox = +oldT[1], oy = +oldT[2], nx = +nt[1], ny = +nt[2];
          tipG._tw && tipG._tw.cancel();
          tipG._tw = tween(650, p => {
            const k = easeOut(p);
            tipG.setAttribute('transform', 'translate(' + (ox + (nx - ox) * k) + ' ' + (oy + (ny - oy) * k) + ')');
          });
          $$('text', tipG).forEach(swap);
        }
      }
      mapCtl && mapCtl.refresh();
      placePill();

      // district extras
      const detail = $('[data-panel="district"]') || $('.district-overview') && $('.district-overview').parentElement;
      if (detail && typeof DEMO_DATA !== 'undefined') {
        const d = DEMO_DATA[district], r = score(district);
        const tr = $('.district-risk .trend', detail);
        if (tr) { tr.classList.toggle('good', d.change < 0); tr.classList.toggle('down', d.change < 0); }
        const sp = $('.sparkline', detail);
        if (sp) {
          const p = $('path', sp);
          p.setAttribute('d', sparkFor(r, d.change, district + (typeof disease !== 'undefined' ? disease.length : 0)));
          sp.style.color = 'var(--risk-' + (r >= 60 ? 'critical' : r >= 40 ? 'high' : 'low') + ')';
          lengthVar(p); sp.classList.remove('draw'); reflow(sp); sp.classList.add('draw', 'fast');
          // tint the badge + panel to the selected district's level, not always red
          const lvc = r >= 60 ? 'critical' : r >= 40 ? 'high' : 'low';
          const badge = $('.risk-badge', detail), dr = $('.district-risk', detail);
          if (badge) { badge.style.color = 'var(--risk-' + lvc + ')'; badge.style.background = 'color-mix(in oklch, var(--risk-' + lvc + ') 14%, var(--card))'; }
          if (dr) dr.style.background = 'color-mix(in oklch, var(--risk-' + lvc + ') 7%, var(--card))';
          const val = $('.district-value', detail); if (val) val.style.color = 'var(--risk-' + lvc + ')';
        }
        if (district !== lastDistrict) {
          const img = $('.district-image', detail);
          if (img) { img.classList.remove('shift'); reflow(img); img.classList.add('shift'); }
          lastDistrict = district;
        }
      }
      return result;
    };
  });

  /* ================= 17. Page-to-page fade ================= */
  safe('leave', () => {
    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || a.target === '_blank') return;
      const u = new URL(a.href, location.href);
      if (u.origin !== location.origin || !/\.html$/.test(u.pathname) || u.href === location.href) return;
      e.preventDefault();
      try { sessionStorage.setItem('as-visited', '1'); } catch (_) {}
      root.classList.add('leaving');
      setTimeout(() => { location.href = u.href; }, reduce ? 0 : 230);
    });
    addEventListener('pageshow', e => { if (e.persisted) root.classList.remove('leaving'); });
  });
})();
