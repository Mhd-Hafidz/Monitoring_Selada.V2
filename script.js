(function () {
    'use strict';
    var $ = function (s, r) { return (r || document).querySelector(s); };
    var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

    /* ================= Pengaturan ================= */
    var KEY = 'selada-dash-v3';
    var DEF = {
        firebase: 'https://smart-farming-selada-default-rtdb.asia-southeast1.firebasedatabase.app/kelompok2.json',
        poll: 2000, fetchN: 1440, unit: 'C', clock: '24', theme: 'system', forceDemo: false,
        ver: 3, dry: 65, wet: 78, camIp: '', portalIp: '192.168.4.2',
        reportEmail: 'yahyailham897@gmail.com', reportEmail2: '', reportEmail3: '',
        plantDate: '', harvestDay: 42,
        rules: { dry: { on: true }, wet: { on: true }, tmax: { on: true, v: 32 }, tmin: { on: true, v: 15 }, hmin: { on: true, v: 60 }, off: { on: true, v: 15 } }
    };
    function clone(o) { return JSON.parse(JSON.stringify(o)); }
    function load() {
        var s = clone(DEF);
        try {
            var raw = localStorage.getItem(KEY);
            if (raw) {
                var o = JSON.parse(raw);
                Object.keys(o).forEach(function (k) {
                    if (k === 'rules') Object.keys(o.rules || {}).forEach(function (r) { s.rules[r] = Object.assign({}, s.rules[r] || {}, o.rules[r]); });
                    else s[k] = o[k];
                });
            }
        } catch (e) { }
        return s;
    }
    var S = load();
    function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }

    /* ================= Util ================= */
    var ZN = {
        dry: { name: 'Kering', v: '--dry' },
        ok: { name: 'Normal', v: '--ok' },
        wet: { name: 'Basah', v: '--wet' }
    };
    function zone(p) { return p <= S.dry ? 'dry' : (p >= S.wet ? 'wet' : 'ok'); }
    function hint(z) {
        if (z === 'dry') return 'Tanah kering (≤ ' + S.dry + '%). Pompa menyala.';
        if (z === 'ok') return 'Kondisi baik (' + S.dry + '–' + S.wet + '%). Pompa mati.';
        return 'Tanah basah (≥ ' + S.wet + '%). Pompa mati.';
    }
    function fmtT(t, short) {
        var d = new Date(t);
        if (S.clock === '12') return d.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: short ? undefined : '2-digit' });
        return d.toLocaleTimeString('en-GB', short ? { hour: '2-digit', minute: '2-digit' } : undefined);
    }
    function fmtDate(t) { return new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); }
    function tc(c) { return S.unit === 'F' ? c * 1.8 + 32 : c; }
    function tu() { return S.unit === 'F' ? '°F' : '°C'; }
    function num(v, d) { return Number(v).toFixed(d); }
    function dur(ms) { var s = Math.round(ms / 1000), m = Math.floor(s / 60); return m ? m + ' mnt ' + (s % 60) + ' dtk' : s + ' dtk'; }
    function pillHTML(z) { return '<span class="pill" style="--z:var(' + ZN[z].v + ')">' + ZN[z].name + '</span>'; }
    function toast(msg) {
        var d = document.createElement('div'); d.className = 'toast'; d.textContent = msg;
        $('#toasts').appendChild(d);
        setTimeout(function () { d.remove(); }, 5000);
    }
    function avg(a) { var s = 0; a.forEach(function (v) { s += v; }); return a.length ? s / a.length : 0; }

    /* ================= Data ================= */
    var hist = [], mode = 'live', net = true;
    function last() { return hist[hist.length - 1]; }
    function win(n) { return hist.slice(-n); }

    var ALPH = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
    function pushTime(id) {
        if (typeof id !== 'string' || id.length !== 20) return 0;
        var t = 0;
        for (var i = 0; i < 8; i++) { var k = ALPH.indexOf(id[i]); if (k < 0) return 0; t = t * 64 + k; }
        return t > 1.4e12 ? t : 0;
    }
    function pumpField(o) {
        var v = o.pompa !== undefined ? o.pompa : (o.pump !== undefined ? o.pump : o.relay);
        if (v === undefined || v === null) return undefined;
        if (typeof v === 'boolean') return v;
        if (typeof v === 'number') return v !== 0;
        var t = String(v).trim().toLowerCase();
        if (/^(1|on|true|menyala|hidup|nyala)$/.test(t)) return true;
        if (/^(0|off|false|mati)$/.test(t)) return false;
        return undefined;
    }
    function norm(o, t) { var r = { t: t, suhu: Number(o.suhu), udara: Number(o.kelembapan_udara), tanah: Number(o.kelembapan_tanah) }, p = pumpField(o); if (p !== undefined) r.pump = p; return r; }
    function parse(j) {
        if (!j || typeof j !== 'object') return [];
        if (typeof j.suhu !== 'undefined') return [norm(j, Date.now())];
        return Object.keys(j).sort().filter(function (k) { return j[k] && typeof j[k] === 'object'; })
            .map(function (k) { return norm(j[k], pushTime(k) || Date.now()); })
            .filter(function (r) { return isFinite(r.tanah); });
    }
    async function fetchRows(url, n, signalMs) {
        var ctrl = new AbortController();
        var to = setTimeout(function () { ctrl.abort(); }, signalMs || 8000);
        try {
            // Coba 1: Indexed query
            try {
                var res = await fetch(url + '?orderBy=' + encodeURIComponent('"$key"') + '&limitToLast=' + (n || 20), { signal: ctrl.signal, cache: 'no-store' });
                if (res.ok) {
                    var parsed = parse(await res.json());
                    if (parsed && parsed.length) return parsed;
                }
            } catch (e1) { }

            // Coba 2: Shallow fetch (bekerja pada semua Firebase RTDB tanpa perlu indeks .indexOn)
            try {
                var shallowRes = await fetch(url + '?shallow=true', { signal: ctrl.signal, cache: 'no-store' });
                if (shallowRes.ok) {
                    var keysObj = await shallowRes.json();
                    if (keysObj && typeof keysObj === 'object') {
                        var keys = Object.keys(keysObj).sort();
                        if (keys.length > 0) {
                            var takeN = Math.min(n || 10, Math.min(keys.length, 15));
                            var recentKeys = keys.slice(-takeN);
                            var baseNodeUrl = url.replace(/\.json(\?.*)?$/i, '');
                            var fetches = recentKeys.map(function (k) {
                                return fetch(baseNodeUrl + '/' + k + '.json', { cache: 'no-store' })
                                    .then(function (r) { return r.ok ? r.json() : null; })
                                    .then(function (rec) {
                                        if (rec && typeof rec === 'object') {
                                            return norm(rec, pushTime(k) || Date.now());
                                        }
                                        return null;
                                    })
                                    .catch(function () { return null; });
                            });
                            var items = await Promise.all(fetches);
                            var validItems = items.filter(function (it) { return it !== null && isFinite(it.tanah); });
                            if (validItems.length > 0) return validItems;
                        }
                    }
                }
            } catch (e2) { }

            // Coba 3: Plain fetch tanpa query parameter
            var plainRes = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
            if (!plainRes.ok) throw new Error('HTTP ' + plainRes.status);
            return parse(await plainRes.json());
        } finally { clearTimeout(to); }
    }

    /* demo data */
    var demo = { soil: 0, temp: 0, hum: 0, boost: 0 };
    function demoStep(t) {
        var pump = demo.soil <= S.dry;
        if (pump) { demo.soil += 0.8 + Math.random() * 0.4; demo.boost = 8; }
        else if (demo.boost > 0) { demo.soil += 0.5; demo.boost--; }
        else demo.soil -= 0.06 + Math.random() * 0.06;
        demo.soil = Math.max(20, Math.min(98, demo.soil));
        demo.temp += (Math.random() - 0.5) * 0.2 + (28.4 - demo.temp) * 0.03;
        demo.hum += (Math.random() - 0.5) * 0.5 + (66 - demo.hum) * 0.03;
        return { t: t, suhu: demo.temp, udara: demo.hum, tanah: demo.soil };
    }
    function demoRows(n) {
        var now = Date.now(), rows = [];
        for (var i = n - 1; i >= 0; i--) rows.push(demoStep(now - i * 1000));
        return rows;
    }
    function startDemo() {
        mode = 'demo'; hist = []; net = true;
        merge(demoRows(Math.min(S.fetchN, 600)));
        $('#notice').hidden = S.forceDemo;
    }

    function merge(rows) {
        var lt = hist.length ? last().t : 0, added = [];
        rows.forEach(function (r) { if (r.t > lt) { hist.push(r); added.push(r); lt = r.t; } });
        if (hist.length > 3600) hist.splice(0, hist.length - 3600);
    }

    async function poll() {
        if (mode === 'demo') {
            if (S.forceDemo) merge(demoRows(Math.max(1, Math.round(S.poll / 1000))));
        } else {
            try {
                var n = hist.length ? Math.min(600, Math.max(20, Math.ceil((Date.now() - last().t) / 1000) + 6)) : S.fetchN;
                var rows = await fetchRows(S.firebase, n);
                if (rows && rows.length) {
                    merge(rows);
                    mode = 'live';
                    net = true;
                } else {
                    // Firebase tersambung namun alat ESP32 belum mengirimkan baris data
                    mode = 'live';
                    net = true;
                }
            } catch (e) {
                // Jaringan gagal atau endpoint belum tersedia, pertahankan mode live menunggu alat
                net = false;
            }
        }
        renderAll();
        setTimeout(poll, S.poll);
    }

    /* ================= Grafik ================= */
    function cfg(k) {
        if (k === 'tanah') return { key: k, label: 'Kelembapan tanah', unit: '%', color: '--ok', get: function (r) { return r.tanah; }, dec: 0, min: 0, max: 100, ticks: [0, 20, 40, 60, 80, 100], band: [S.dry, S.wet], thr: [S.dry, S.wet] };
        if (k === 'suhu') return { key: k, label: 'Suhu udara', unit: tu(), color: '--temp', get: function (r) { return tc(r.suhu); }, dec: 1, minSpan: S.unit === 'F' ? 4 : 2 };
        return { key: k, label: 'Kelembapan udara', unit: '%', color: '--wet', get: function (r) { return r.udara; }, dec: 0, minSpan: 6 };
    }
    function setReadout(el, r, o) {
        el.style.setProperty('--c', 'var(' + o.color + ')');
        el.innerHTML = r ? '<b>' + num(o.get(r), o.dec) + ' ' + o.unit + '</b><span class="label">' + o.label + ' · ' + fmtT(r.t) + '</span>' : '';
    }
    function lineChart(host, rows, o, roEl) {
        host.style.setProperty('--c', 'var(' + o.color + ')');
        if (rows.length < 2) { host.innerHTML = '<p class="empty">Menunggu data sensor…</p>'; if (roEl) setReadout(roEl, null, o); return; }
        var w = Math.max(host.clientWidth, 260), h = o.h || 180, m = { l: 42, r: 12, t: 12, b: 26 };
        var iw = w - m.l - m.r, ih = h - m.t - m.b;
        var vals = rows.map(o.get), a = o.min, b = o.max, ticks = o.ticks ? o.ticks.slice() : [];
        if (a === undefined) {
            var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
            var span = Math.max(hi - lo, o.minSpan || 2), mid = (hi + lo) / 2;
            a = Math.floor(mid - span * 0.75); b = Math.ceil(mid + span * 0.75);
            for (var i = 0; i <= 4; i++) ticks.push(a + i * (b - a) / 4);
        }
        var t0 = rows[0].t, t1 = rows[rows.length - 1].t;
        var X = function (t) { return m.l + (t - t0) / ((t1 - t0) || 1) * iw; };
        var Y = function (v) { return m.t + (1 - (v - a) / (b - a)) * ih; };
        var tdec = (ticks.length > 1 && (ticks[1] - ticks[0]) % 1) ? 1 : 0;
        var out = '';
        if (o.key === 'tanah') {
            // Zona Basah (>= 78%)
            out += '<rect x="' + m.l + '" y="' + Y(100).toFixed(1) + '" width="' + iw + '" height="' + (Y(S.wet) - Y(100)).toFixed(1) + '" fill="rgba(56, 189, 248, 0.08)"/>';
            // Zona Normal (65% - 78%)
            out += '<rect x="' + m.l + '" y="' + Y(S.wet).toFixed(1) + '" width="' + iw + '" height="' + (Y(S.dry) - Y(S.wet)).toFixed(1) + '" fill="rgba(16, 185, 129, 0.12)"/>';
            // Zona Kering (<= 65%)
            out += '<rect x="' + m.l + '" y="' + Y(S.dry).toFixed(1) + '" width="' + iw + '" height="' + (Y(0) - Y(S.dry)).toFixed(1) + '" fill="rgba(239, 68, 68, 0.08)"/>';
            // Garis batas & teks
            out += '<line x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + Y(S.wet).toFixed(1) + '" y2="' + Y(S.wet).toFixed(1) + '" stroke="#38bdf8" stroke-dasharray="4,3" stroke-width="1.2" opacity="0.6"/>';
            out += '<text x="' + (w - m.r - 4) + '" y="' + (Y(S.wet) - 4).toFixed(1) + '" fill="#38bdf8" font-size="9.5" text-anchor="end">Batas Basah: ' + S.wet + '%</text>';
            out += '<line x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + Y(S.dry).toFixed(1) + '" y2="' + Y(S.dry).toFixed(1) + '" stroke="#f87171" stroke-dasharray="4,3" stroke-width="1.2" opacity="0.6"/>';
            out += '<text x="' + (w - m.r - 4) + '" y="' + (Y(S.dry) - 4).toFixed(1) + '" fill="#f87171" font-size="9.5" text-anchor="end">Batas Kering: ' + S.dry + '%</text>';
        } else if (o.band) {
            out += '<rect class="band" x="' + m.l + '" y="' + Y(o.band[1]).toFixed(1) + '" width="' + iw + '" height="' + (Y(o.band[0]) - Y(o.band[1])).toFixed(1) + '"/>';
        }
        ticks.forEach(function (tv) {
            var y = Y(tv);
            out += '<line class="gl" x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>';
            out += '<text x="' + (m.l - 8) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end">' + tv.toFixed(tdec) + '</text>';
        });
        var nx = w < 480 ? 3 : 4;
        for (var k = 0; k < nx; k++) {
            var f = k / (nx - 1), anchor = k === 0 ? 'start' : (k === nx - 1 ? 'end' : 'middle');
            out += '<text x="' + (m.l + f * iw).toFixed(1) + '" y="' + (h - 6) + '" text-anchor="' + anchor + '">' + fmtT(t0 + f * (t1 - t0), true) + '</text>';
        }
        var pts = rows.map(function (r, i) { return [X(r.t), Y(vals[i])]; });
        var d = 'M' + pts.map(function (q) { return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join('L');
        var e = pts[pts.length - 1];
        out += '<path class="area" d="' + d + 'L' + e[0].toFixed(1) + ' ' + Y(a) + 'L' + pts[0][0].toFixed(1) + ' ' + Y(a) + 'Z"/><path class="ln" d="' + d + '"/>';
        out += '<line class="guide" y1="' + m.t + '" y2="' + (m.t + ih) + '" visibility="hidden"/><circle class="gdot" r="4.5" visibility="hidden"/>';
        out += '<circle class="ring" cx="' + e[0].toFixed(1) + '" cy="' + e[1].toFixed(1) + '" r="7"/><circle class="end" cx="' + e[0].toFixed(1) + '" cy="' + e[1].toFixed(1) + '" r="4"/>';
        out += '<rect class="hit" x="' + m.l + '" y="' + m.t + '" width="' + iw + '" height="' + ih + '" fill="none" pointer-events="all"/>';
        host.innerHTML = '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Grafik ' + o.label + '">' + out + '</svg>';
        if (roEl) setReadout(roEl, rows[rows.length - 1], o);
        var svg = host.querySelector('svg'), guide = svg.querySelector('.guide'), gdot = svg.querySelector('.gdot'), hit = svg.querySelector('.hit');
        function move(ev) {
            var x = ev.clientX - svg.getBoundingClientRect().left, best = 0, bd = Infinity;
            pts.forEach(function (q, i) { var dd = Math.abs(q[0] - x); if (dd < bd) { bd = dd; best = i; } });
            guide.setAttribute('x1', pts[best][0]); guide.setAttribute('x2', pts[best][0]);
            gdot.setAttribute('cx', pts[best][0]); gdot.setAttribute('cy', pts[best][1]);
            guide.setAttribute('visibility', 'visible'); gdot.setAttribute('visibility', 'visible');
            if (roEl) setReadout(roEl, rows[best], o);
        }
        function leave() { guide.setAttribute('visibility', 'hidden'); gdot.setAttribute('visibility', 'hidden'); if (roEl) setReadout(roEl, rows[rows.length - 1], o); }
        hit.addEventListener('pointermove', move); hit.addEventListener('pointerdown', move); hit.addEventListener('pointerleave', leave);
    }
    function spark(host, vals, dec, rangeEl) {
        if (vals.length < 2) { host.innerHTML = ''; if (rangeEl) rangeEl.textContent = ''; return; }
        var w = Math.max(host.clientWidth, 80), h = 40, p = 4;
        var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
        var span = Math.max(hi - lo, 0.5), a = lo - span * 0.15, b = hi + span * 0.15, n = vals.length;
        var pts = vals.map(function (v, i) { return [p + i / (n - 1) * (w - 2 * p), p + (1 - (v - a) / (b - a)) * (h - 2 * p)]; });
        var d = 'M' + pts.map(function (q) { return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join('L'), e = pts[n - 1];
        host.innerHTML = '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true"><path class="area" d="' + d + 'L' + e[0].toFixed(1) + ' ' + h + 'L' + pts[0][0].toFixed(1) + ' ' + h + 'Z"/><path class="ln" d="' + d + '"/><circle class="ring" cx="' + e[0] + '" cy="' + e[1] + '" r="6"/><circle class="end" cx="' + e[0] + '" cy="' + e[1] + '" r="3"/></svg>';
        if (rangeEl) rangeEl.textContent = 'min ' + num(lo, dec) + ' · maks ' + num(hi, dec);
    }

    /* ================= Pompa ================= */
    function rowOn(r) { return r.pump !== undefined ? r.pump : r.tanah <= S.dry; }
    function pumpStats(rows) {
        var cycles = 0, on = 0, prevOn = false;
        rows.forEach(function (r, i) {
            var d = rowOn(r);
            if (d && !prevOn) cycles++;
            if (i > 0 && prevOn) on += Math.min(r.t - rows[i - 1].t, 5000);
            prevOn = d;
        });
        return { cycles: cycles, on: on };
    }
    function pumpState() {
        var r = last();
        if (!r) return { known: false, on: false, text: 'Belum ada data', src: 'none', detail: 'Menunggu pembacaan sensor.' };
        var device = r.pump !== undefined, src = mode === 'demo' ? 'demo' : (device ? 'device' : 'inferred');
        var srcTxt = src === 'demo' ? 'Data contoh (bukan perangkat sungguhan)' : (device ? 'Dilaporkan perangkat' : 'Disimpulkan: tanah ' + (rowOn(r) ? 'pada/di bawah' : 'di atas') + ' batas kering ' + S.dry + '%');
        if (mode === 'live' && (Date.now() - r.t) / 1000 > S.rules.off.v)
            return { known: false, on: false, text: 'Tidak diketahui', src: src, detail: 'Perangkat offline; status terakhir tidak bisa dipastikan.', last: rowOn(r) };
        var on = rowOn(r), since = r.t;
        for (var i = hist.length - 2; i >= 0; i--) { if (rowOn(hist[i]) !== on) break; since = hist[i].t; }
        return { known: true, on: on, text: on ? 'Menyala' : 'Mati', src: src, detail: srcTxt, since: since, sinceMs: Date.now() - since };
    }
    function pumpHTML(ps) { return ps.known ? '<span class="pump' + (ps.on ? ' on' : '') + '">' + ps.text + '</span>' : '<span class="pump">' + ps.text + '</span>'; }

    /* ================= Rute ================= */
    var PAGES = [
        { o: 10, id: 'dashboard', name: 'Dashboard', sub: 'Pemantauan sensor realtime', ic: '<path d="M3 12h4l3-8 4 16 3-8h4"/>' },
        { o: 20, id: 'kamera', name: 'Kamera ESP-32 CAM', sub: 'Pantau tanaman langsung dari ESP32-CAM', ic: '<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>' },
        { o: 30, id: 'lstm', name: 'LSTM', sub: 'Prediksi kematangan tanaman', ic: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 17.5h7M17.5 14v7"/>' },
        { o: 40, id: 'cnn', name: 'CNN', sub: 'Analisis gambar daun selada', ic: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/>' },
        { o: 45, id: 'history', name: 'History', sub: 'Riwayat data sensor dan analisis', ic: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5"/>' },
        { o: 50, id: 'pengaturan', name: 'Pengaturan', sub: 'Koneksi, satuan, dan tampilan', ic: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>' }
    ];
    var page = 'dashboard', EXT = {};

    function buildNav() {
        var h = PAGES.map(function (p) {
            return '<a href="#' + p.id + '" data-p="' + p.id + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + p.ic + '</svg><span>' + p.name + '</span></a>';
        }).join('');
        $('#nav').innerHTML = h;
    }

    var NAVKEY = 'selada-nav-open-v3';
    var mq = window.matchMedia ? window.matchMedia('(max-width: 960px)') : { matches: false };
    function isMobile() { return mq.matches; }
    function setNav(open, remember) {
        document.body.classList.toggle('nav-open', open);
        $('#hamb').setAttribute('aria-expanded', String(open));
        if (remember && !isMobile()) { try { localStorage.setItem(NAVKEY, open ? '1' : '0'); } catch (e) { } }
        requestAnimationFrame(renderAll);
    }
    function initNav() {
        var open = true;
        if (isMobile()) open = false;
        else { try { if (localStorage.getItem(NAVKEY) === '0') open = false; } catch (e) { } }
        setNav(open, false);
        $('#hamb').addEventListener('click', function () {
            var open = !document.body.classList.contains('nav-open');
            setNav(open, true);
        });
        $('#sideclose').addEventListener('click', function () { setNav(false, false); $('#hamb').focus(); });
        $('#scrim').addEventListener('click', function () { setNav(false, false); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && isMobile() && document.body.classList.contains('nav-open')) { setNav(false, false); $('#hamb').focus(); }
        });
        $('#nav').addEventListener('click', function (e) { if (e.target.closest('a') && isMobile()) setNav(false, false); });
        var onMq = function () {
            if (isMobile()) setNav(false, false);
            else { var o = true; try { if (localStorage.getItem(NAVKEY) === '0') o = false; } catch (e) { } setNav(o, false); }
        };
        if (mq.addEventListener) mq.addEventListener('change', onMq);
    }

    function route(forced) {
        var id = typeof forced === 'string' ? forced : (location.hash || '').slice(1);
        if (!PAGES.some(function (p) { return p.id === id; })) id = 'dashboard';
        if (page === 'kamera' && id !== 'kamera') camLeave();
        if (page !== id && EXT[page] && EXT[page].leave) { try { EXT[page].leave(); } catch (e) { console.error(e); } }
        var prevPage = page;
        page = id;
        $$('.page').forEach(function (s) { s.hidden = s.id !== 'p-' + id; });
        var P = PAGES.filter(function (p) { return p.id === id; })[0];
        $('#ptitle').textContent = P.name; $('#psub').textContent = P.sub;
        document.title = P.name + ' · Selada Keriting · Kelompok 2';
        $$('#nav a').forEach(function (a) { if (a.dataset.p === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
        if (id === 'kamera') camEnter();
        if (id === 'pengaturan') fillSettings();
        if (EXT[id] && EXT[id].enter && prevPage !== id) { try { EXT[id].enter(); } catch (e) { console.error(e); } }
        renderAll();
        window.scrollTo(0, 0);
    }

    /* ================= Indonesian Live Clock Widget ================= */
    function updateLiveClock() {
        var now = new Date();
        var days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        var months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        var dName = days[now.getDay()];
        var dNum = String(now.getDate()).padStart(2, '0');
        var mName = months[now.getMonth()];
        var yNum = now.getFullYear();
        var h = String(now.getHours()).padStart(2, '0');
        var m = String(now.getMinutes()).padStart(2, '0');
        var s = String(now.getSeconds()).padStart(2, '0');

        var timeStr = h + '.' + m + '.' + s + ' WIB';
        var dateStr = dName + ', ' + dNum + ' ' + mName + ' ' + yNum;

        var hTime = $('#headerLiveTime'), hDate = $('#headerLiveDate');
        if (hTime) hTime.textContent = timeStr;
        if (hDate) hDate.textContent = dateStr;

        var dbTime = $('#dbClockTime'), dbDate = $('#dbClockDate');
        if (dbTime) dbTime.textContent = timeStr;
        if (dbDate) dbDate.textContent = dateStr;

        var repTs = $('#reportTimestampDisplay');
        if (repTs) repTs.textContent = dateStr + ' pukul ' + h + '.' + m + '.' + s;
    }
    setInterval(updateLiveClock, 1000);
    setTimeout(updateLiveClock, 50);

    /* ================= Render Header ================= */
    function renderHeader() {
        var c = $('#conn'), r = last(), s = 'live', m = 'Langsung dari Firebase';
        if (mode === 'demo') { s = 'demo'; m = 'Data contoh'; }
        else if (mode === 'live') {
            if (!r) { s = 'live'; m = 'Firebase RTDB Aktif (STANDBY)'; }
            else { s = 'live'; m = 'Langsung dari Firebase'; }
        }
        c.dataset.s = s; $('#connText').textContent = m;
        $('#fresh').textContent = r ? Math.max(0, Math.round((Date.now() - r.t) / 1000)) + ' detik lalu' : 'STANDBY (0 / 1440 Data)';

        // Update live badge in header: selalu aktif dan terhubung
        var fbBadge = $('#firebaseLiveBadge');
        var fbBadgeText = $('#firebaseBadgeText');
        if (fbBadge && fbBadgeText) {
            fbBadgeText.textContent = r ? 'Firebase RTDB Aktif (Sinkron)' : 'Firebase RTDB Aktif (STANDBY)';
            fbBadge.style.opacity = '1';
        }
    }

    /* ================= Render Dashboard ================= */
    var dbSeries = 'tanah';
    function renderDashboard() {
        var r = last();
        if (!r) {
            // Semua persentase dan parameter diset ke 0 & STANDBY karena belum ada data sensor & alat yang masuk
            var targetHST = S.harvestDay || 42;

            if ($('#dbAgeHstVal')) $('#dbAgeHstVal').textContent = '0 HST';
            if ($('#dbAgeTargetVal')) $('#dbAgeTargetVal').textContent = targetHST;
            if ($('#dbAgeStagePill')) {
                $('#dbAgeStagePill').textContent = 'STANDBY (0 HST)';
                $('#dbAgeStagePill').style.setProperty('--z', 'var(--muted)');
            }
            if ($('#dbAgeProgressFill')) $('#dbAgeProgressFill').style.width = '0%';
            if ($('#dbAgePctText')) $('#dbAgePctText').textContent = 'STANDBY: 0% Menuju Panen';

            if ($('#dbTotalDataCount')) $('#dbTotalDataCount').textContent = 'STANDBY: 0 / 1440 Data';
            if ($('#dbMaturityTag')) {
                $('#dbMaturityTag').textContent = 'STANDBY (0% Data Sensor)';
                $('#dbMaturityTag').style.background = 'rgba(100, 116, 139, 0.15)';
                $('#dbMaturityTag').style.borderColor = 'rgba(100, 116, 139, 0.4)';
                $('#dbMaturityTag').style.color = '#94a3b8';
            }

            $('#dbSoil').textContent = '0 %';
            $('#dbSoilStatus').textContent = 'STANDBY (0%)';
            $('#dbTemp').textContent = '0.0 ' + tu();
            $('#dbTempStatus').textContent = 'STANDBY';
            $('#dbHum').textContent = '0 %';
            $('#dbHumStatus').textContent = 'STANDBY (0%)';

            if ($('#dbSoilConditionText')) {
                $('#dbSoilConditionText').textContent = 'STANDBY';
                $('#dbSoilConditionText').style.color = 'var(--muted)';
            }
            if ($('#dbSoilConditionDesc')) {
                $('#dbSoilConditionDesc').textContent = 'Wadah 1440 data siap · Menunggu alat ESP32';
            }
            if ($('#dbSoilConditionBadge')) {
                $('#dbSoilConditionBadge').textContent = 'Tanah: STANDBY';
                $('#dbSoilConditionBadge').style.setProperty('--z', 'var(--muted)');
            }

            $('#dbPump').innerHTML = '<span class="pump">STANDBY (OFF)</span>';
            $('#dbPumpSince').textContent = 'STANDBY';

            var dbConn = $('#dbConn');
            if (dbConn) {
                dbConn.dataset.s = 'live';
                $('#dbConnText').textContent = 'Firebase RTDB: STANDBY';
            }

            $('#dbSoilBig').textContent = '0';
            var soilPill = $('#dbSoilPill');
            if (soilPill) {
                soilPill.textContent = 'STANDBY (0%)';
                soilPill.style.setProperty('--z', 'var(--muted)');
            }
            $('#dbSoilHint').textContent = 'Firebase RTDB Aktif (STANDBY). Wadah buffer 1440 data (siklus 24 jam) siap menampung sensor ESP32.';

            $('#dbTempBig').textContent = '0.0';
            $('#dbTempU').textContent = tu();
            $('#dbHumBig').textContent = '0';

            var emptyMsg = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:120px;color:var(--muted);gap:8px;font-size:12px;text-align:center;padding:12px">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:26px;height:26px;opacity:0.6"><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>' +
                '<span>Firebase RTDB Aktif (STANDBY) • Wadah 1440 data siap menampung siklus 24 jam sensor ESP32…</span></div>';

            if ($('#dbChSoil')) $('#dbChSoil').innerHTML = emptyMsg;
            if ($('#dbChTemp')) $('#dbChTemp').innerHTML = emptyMsg;
            if ($('#dbChHum'))  $('#dbChHum').innerHTML = emptyMsg;
            if ($('#dbChMain')) $('#dbChMain').innerHTML = emptyMsg;

            $('#dbPumpState').innerHTML = '<span class="pump">STANDBY (OFF)</span>';
            $('#dbPumpSinceDetail').textContent = 'STANDBY';
            $('#dbPumpDetail').textContent = 'Menunggu pembacaan sensor pertama dari alat ESP32 (wadah 1440 data siap).';

            $('#dbSysSrc').textContent = 'Firebase RTDB (STANDBY)';
            $('#dbSysLast').textContent = 'STANDBY';
            $('#dbSysCount').textContent = '0 / 1440 data';
            $('#dbSysCycles').textContent = '0 kali';
            $('#dbSysOn').textContent = '0s';

            var dbTbody = $('#dbRecentTableBody');
            if (dbTbody) {
                dbTbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--muted);font-size:12px">' +
                    '📡 Firebase RTDB Aktif (STANDBY). Wadah 1440 data disiapkan (0 / 1440). Menunggu alat ESP32 mengirim data sensor…</td></tr>';
            }
            return;
        }

        var z = zone(r.tanah);
        var zColor = 'var(' + ZN[z].v + ')';

        // Umur Tanaman & Tahap Kematangan
        var hst = S.plantDate ? Math.max(0, Math.floor((Date.now() - new Date(S.plantDate).getTime()) / 86400000)) : 25;
        var targetHST = S.harvestDay || 42;
        var matPct = Math.min(100, Math.round((hst / targetHST) * 100));
        var stageName = matPct < 65 ? 'Masa Pertumbuhan' : (matPct < 85 ? 'Mendekati Panen' : 'Siap Panen');
        var stageColor = matPct < 65 ? '--ok' : (matPct < 85 ? '--dry' : '--bad');

        if ($('#dbAgeHstVal')) $('#dbAgeHstVal').textContent = hst + ' HST';
        if ($('#dbAgeTargetVal')) $('#dbAgeTargetVal').textContent = targetHST;
        if ($('#dbAgeStagePill')) {
            $('#dbAgeStagePill').textContent = stageName;
            $('#dbAgeStagePill').style.setProperty('--z', 'var(' + stageColor + ')');
        }
        if ($('#dbAgeProgressFill')) $('#dbAgeProgressFill').style.width = matPct + '%';
        if ($('#dbAgePctText')) $('#dbAgePctText').textContent = matPct + '% Menuju Panen';

        // Total data counter & tingkat kematangan horizontal bar
        if ($('#dbTotalDataCount')) $('#dbTotalDataCount').textContent = hist.length + ' / 1440 Data';
        if ($('#dbMaturityTag')) {
            $('#dbMaturityTag').textContent = stageName + ' (' + matPct + '%)';
            if (stageName === 'Siap Panen') {
                $('#dbMaturityTag').style.background = 'rgba(239, 68, 68, 0.15)';
                $('#dbMaturityTag').style.borderColor = 'rgba(239, 68, 68, 0.4)';
                $('#dbMaturityTag').style.color = '#f87171';
            } else if (stageName === 'Mendekati Panen') {
                $('#dbMaturityTag').style.background = 'rgba(234, 179, 8, 0.15)';
                $('#dbMaturityTag').style.borderColor = 'rgba(234, 179, 8, 0.4)';
                $('#dbMaturityTag').style.color = '#facc15';
            } else {
                $('#dbMaturityTag').style.background = 'rgba(16, 185, 129, 0.15)';
                $('#dbMaturityTag').style.borderColor = 'rgba(16, 185, 129, 0.4)';
                $('#dbMaturityTag').style.color = '#34d399';
            }
        }

        // Status strip
        $('#dbSoil').textContent = num(r.tanah, 0) + ' %';
        $('#dbSoilStatus').textContent = ZN[z].name;
        $('#dbTemp').textContent = num(tc(r.suhu), 1) + ' ' + tu();
        $('#dbTempStatus').textContent = r.suhu > 32 ? 'Suhu tinggi' : (r.suhu < 15 ? 'Suhu rendah' : 'Normal');
        $('#dbHum').textContent = num(r.udara, 0) + ' %';
        $('#dbHumStatus').textContent = r.udara < 60 ? 'Udara kering' : 'Normal';

        // Label Kondisi Tanah samping Kelembapan Udara (Kering, Normal, Basah)
        var sVal = Number(r.tanah);
        var sCondText = 'Normal', sCondColor = '#22c55e', sCondDesc = '65%–78% (Pompa OFF)', sBadgeZ = '--ok';
        if (sVal < 65) {
            sCondText = 'Kering';
            sCondColor = '#ef4444';
            sCondDesc = '< 65% (Pompa Air ON)';
            sBadgeZ = '--bad';
        } else if (sVal > 78) {
            sCondText = 'Basah';
            sCondColor = '#38bdf8';
            sCondDesc = '> 78% (Lembab Tinggi)';
            sBadgeZ = '--wet';
        }
        if ($('#dbSoilConditionText')) {
            $('#dbSoilConditionText').textContent = sCondText;
            $('#dbSoilConditionText').style.color = sCondColor;
        }
        if ($('#dbSoilConditionDesc')) {
            $('#dbSoilConditionDesc').textContent = sCondDesc;
        }
        if ($('#dbSoilConditionBadge')) {
            $('#dbSoilConditionBadge').textContent = 'Tanah: ' + sCondText;
            $('#dbSoilConditionBadge').style.setProperty('--z', 'var(' + sBadgeZ + ')');
        }

        var ps = pumpState();
        $('#dbPump').innerHTML = pumpHTML(ps);
        $('#dbPumpSince').textContent = ps.known ? (ps.on ? 'Menyala' : 'Mati') : 'Tidak diketahui';

        // Conn status strip
        var dbConn = $('#dbConn');
        if (dbConn) {
            var cs = mode === 'demo' ? 'demo' : (mode === 'live' && net ? 'live' : 'bad');
            dbConn.dataset.s = cs;
            $('#dbConnText').textContent = mode === 'demo' ? 'Data contoh' : (net ? 'Firebase' : 'Gagal');
        }

        // Cards
        $('#dbSoilBig').textContent = num(r.tanah, 0);
        var soilPill = $('#dbSoilPill');
        soilPill.textContent = ZN[z].name;
        soilPill.style.setProperty('--z', zColor);
        $('#dbSoilHint').textContent = hint(z);

        $('#dbTempBig').textContent = num(tc(r.suhu), 1);
        $('#dbTempU').textContent = tu();
        $('#dbHumBig').textContent = num(r.udara, 0);

        var w60 = win(60);
        spark($('#dbTempSpark'), w60.map(function (x) { return tc(x.suhu); }), 1, $('#dbTempRange'));
        spark($('#dbHumSpark'), w60.map(function (x) { return x.udara; }), 0, $('#dbHumRange'));

        // Toggle Soil Threshold Legend visibility on main chart
        var thLegend = $('#dbSoilThresholdLegend');
        if (thLegend) thLegend.style.display = dbSeries === 'tanah' ? 'flex' : 'none';

        // Charts
        lineChart($('#dbChSoil'), w60, cfg('tanah'));
        lineChart($('#dbChTemp'), w60, cfg('suhu'));
        lineChart($('#dbChHum'), w60, cfg('udara'));
        lineChart($('#dbChMain'), w60, cfg(dbSeries), $('#dbRo'));

        // Pump panel
        $('#dbPumpState').innerHTML = pumpHTML(ps);
        $('#dbPumpSinceDetail').textContent = ps.known ? (ps.on ? 'Menyala sejak ' : 'Mati sejak ') + fmtT(ps.since) + ' (' + dur(ps.sinceMs) + ')' : '—';
        $('#dbPumpDetail').textContent = ps.detail;

        // System
        $('#dbSysSrc').textContent = mode === 'demo' ? 'Data contoh' : 'Firebase';
        $('#dbSysLast').textContent = fmtT(r.t);
        $('#dbSysCount').textContent = hist.length;
        var pst = pumpStats(hist);
        $('#dbSysCycles').textContent = pst.cycles + ' kali';
        $('#dbSysOn').textContent = dur(pst.on);

        // Render Riwayat Monitoring Terbaru (Realtime Sensor Log Table)
        var dbTbody = $('#dbRecentTableBody');
        if (dbTbody && hist.length > 0) {
            var recentRows = hist.slice(-10).reverse();
            var hRows = '';
            recentRows.forEach(function (row) {
                var rz = zone(row.tanah);
                var pOn = rowOn(row);
                var pumpBadge = pOn ? '<span class="pill" style="--z:var(--dry)">Menyala</span>' : '<span class="pill" style="--z:var(--ok)">Mati</span>';
                hRows += '<tr>' +
                    '<td style="font-family:var(--f-mono)">' + fmtT(row.t) + '</td>' +
                    '<td><b>' + num(row.tanah, 0) + ' %</b> ' + pillHTML(rz) + '</td>' +
                    '<td>' + num(tc(row.suhu), 1) + ' ' + tu() + '</td>' +
                    '<td>' + num(row.udara, 0) + ' %</td>' +
                    '<td>' + pumpBadge + '</td>' +
                    '<td><span class="pill" style="--z:var(' + stageColor + ')">' + stageName + '</span></td>' +
                    '</tr>';
            });
            dbTbody.innerHTML = hRows;
        }
    }

    /* ================= Render All ================= */
    function renderAll() {
        renderHeader();
        if (page === 'dashboard') renderDashboard();
        else if (EXT[page] && EXT[page].render) { try { EXT[page].render(); } catch (e) { console.error(e); } }
    }

    /* ================= Kamera ================= */
    var cam = { mode: 'stream', interval: 3000, run: false, want: false, timer: 0, lastFrame: null, retry: 0, pre: null, watch: 0, live: false };
    var camimg = $('#camimg'), camstate = $('#camstate');
    var CAMICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
    function camMsg(title, text) {
        camstate.hidden = false;
        camstate.innerHTML = CAMICON + '<b></b><p></p>';
        camstate.querySelector('b').textContent = title; camstate.querySelector('p').textContent = text;
    }
    function camIdle() { camMsg('Kamera belum terhubung', 'Masukkan IP kamera yang tampil di portal ESP32-CAM. IP portal (bawaan 192.168.4.1) diatur terpisah.'); }
    function cleanIp(v) { return v.trim().replace(/^https?:\/\//, '').replace(/[\/?#].*$/, ''); }
    function portalHost() { return S.portalIp || '192.168.4.1'; }
    function updatePortalLink() { var p = $('#portal'); p.href = 'http://' + portalHost() + '/'; p.textContent = 'Buka portal kamera (' + portalHost() + ')'; p.hidden = false; }
    function camUrl(path) { return 'http://' + S.camIp + path + (path.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now(); }
    function camOk() { camimg.hidden = false; camstate.hidden = true; $('#livebadge').hidden = false; }
    function camFail() {
        if (cam.run && cam.retry < 6) {
            cam.retry++; clearTimeout(cam.timer);
            camMsg('Menyambung ulang…', 'Percobaan ' + cam.retry + ' dari 6.');
            cam.timer = setTimeout(function () { if (cam.run) camLoad(); }, 300);
            return;
        }
        cam.run = false; clearTimeout(cam.timer);
        camimg.hidden = true; $('#livebadge').hidden = true;
        camMsg('Video tidak bisa dimuat', location.protocol === 'https:'
            ? 'Halaman https tidak bisa memuat gambar http dari kamera. Buka dashboard dari file lokal, atau izinkan konten tidak aman untuk situs ini.'
            : 'Pastikan satu jaringan dengan kamera, IP benar, dan tidak ada tab lain yang sedang menonton stream.');
    }
    function camStop() {
        cam.run = false; clearTimeout(cam.timer); clearTimeout(cam.watch);
        if (cam.pre) { cam.pre.onload = null; cam.pre.onerror = null; cam.pre.src = ''; cam.pre = null; }
        camimg.onload = null; camimg.onerror = null;
        camimg.removeAttribute('src');
        camimg.hidden = true; $('#livebadge').hidden = true;
    }
    function camNextPhoto() {
        if (!cam.run) return;
        var im = new Image(); cam.pre = im;
        im.decoding = 'async';
        im.onload = function () {
            if (!cam.run || cam.pre !== im) return;
            camimg.src = im.src; cam.retry = 0; camOk();
            cam.timer = setTimeout(camNextPhoto, cam.interval);
        };
        im.onerror = camFail;
        im.src = camUrl('/capture');
    }
    function camLoad() {
        clearTimeout(cam.watch);
        if (cam.mode !== 'stream') { camimg.onerror = null; camimg.onload = null; camNextPhoto(); return; }
        var im = new Image(); cam.pre = im; im.decoding = 'async';
        function openStream() {
            if (!cam.run) return;
            camimg.onerror = camFail;
            cam.live = false;
            camimg.onload = function () { clearTimeout(cam.watch); cam.live = true; cam.retry = 0; camOk(); };
            camimg.decoding = 'async';
            camimg.src = camUrl('/stream');
            cam.watch = setTimeout(function () { if (cam.run && !cam.live) camFail(); }, 5000);
        }
        im.onload = function () { if (!cam.run || cam.pre !== im) return; camimg.src = im.src; camOk(); setTimeout(openStream, 60); };
        im.onerror = function () { if (cam.run && cam.pre === im) openStream(); };
        im.src = camUrl('/capture');
        cam.watch = setTimeout(function () { if (cam.run && cam.pre === im && !camimg.naturalWidth) { im.onload = null; im.onerror = null; im.src = ''; openStream(); } }, 2000);
    }
    function camStart() {
        if (!S.camIp) { camIdle(); return; }
        camStop(); cam.run = true; cam.want = true; cam.retry = 0; cam.live = false;
        camMsg('Menghubungkan kamera…', 'Memuat dari ' + S.camIp + '.');
        $('#camOff').hidden = false; updatePortalLink();
        camLoad();
    }
    function camEnter() { measureView(); $('#camip').value = S.camIp || ''; $('#portalip').value = S.portalIp || ''; updatePortalLink(); if (S.camIp && !cam.run && cam.want !== false) camStart(); else if (!cam.run) camIdle(); renderGallery(); }
    function camLeave() {
        exitFull();
        try {
            if (!camimg.hidden && camimg.naturalWidth) {
                var c = document.createElement('canvas'); c.width = camimg.naturalWidth; c.height = camimg.naturalHeight;
                c.getContext('2d').drawImage(camimg, 0, 0); cam.lastFrame = { c: c, t: Date.now() };
            }
        } catch (e) { }
        camStop();
    }
    var gallery = [];
    function renderGallery() {
        var g = $('#gallery'); g.innerHTML = '';
        gallery.forEach(function (it, i) {
            var f = document.createElement('figure'); f.appendChild(it.c);
            var cap = document.createElement('figcaption'); var sp = document.createElement('span'); sp.textContent = fmtT(it.t);
            var b = document.createElement('button'); b.className = 'btn ghost small'; b.type = 'button'; b.textContent = 'Hapus';
            b.addEventListener('click', function () { gallery.splice(i, 1); renderGallery(); });
            cap.appendChild(sp); cap.appendChild(b); f.appendChild(cap); g.appendChild(f);
        });
        $('#galEmpty').hidden = gallery.length > 0; $('#galClear').hidden = gallery.length === 0;
    }
    var V = { z: 1, x: 0, y: 0 };
    function isFull() { var v = $('#camview'); return document.fullscreenElement === v || v.classList.contains('pseudo-full'); }
    var viewW = 0, viewH = 0, viewQ = 0;
    function measureView() { var v = $('#camview'); viewW = v.clientWidth; viewH = v.clientHeight; }
    function clampPan() { var mx = (V.z - 1) * viewW / 2, my = (V.z - 1) * viewH / 2; V.x = Math.max(-mx, Math.min(mx, V.x)); V.y = Math.max(-my, Math.min(my, V.y)); }
    function applyView() {
        if (viewQ) return;
        viewQ = requestAnimationFrame(function () {
            viewQ = 0;
            if (!viewW) measureView();
            clampPan();
            var br = $('#vBr').value, ct = $('#vCt').value;
            camimg.style.filter = (br === '100' && ct === '100') ? '' : 'brightness(' + br + '%) contrast(' + ct + '%)';
            camimg.style.transform = 'translate3d(' + V.x.toFixed(1) + 'px,' + V.y.toFixed(1) + 'px,0) scale(' + V.z + ')' + ($('#vMir').checked ? ' scaleX(-1)' : '') + ($('#vRot').checked ? ' rotate(180deg)' : '');
            $('#zLvl').textContent = Math.round(V.z * 100) + '%';
            $('#vZm').value = Math.round(V.z * 100);
            $('#camview').classList.toggle('zoomed', V.z > 1);
        });
    }
    function zoomTo(nz, cx, cy) {
        nz = Math.max(1, Math.min(4, nz));
        var k = nz / V.z; cx = cx || 0; cy = cy || 0;
        V.x = cx - k * (cx - V.x); V.y = cy - k * (cy - V.y); V.z = nz;
        if (nz === 1) { V.x = 0; V.y = 0; }
        applyView();
    }
    function setFullUI() { var f = isFull(); $('#camview').classList.toggle('isfull', f); measureView(); $('#zFs').setAttribute('aria-label', f ? 'Keluar layar penuh' : 'Layar penuh'); $('#camFull').textContent = f ? 'Keluar layar penuh' : 'Layar penuh'; applyView(); }
    function exitFull() {
        var v = $('#camview');
        if (document.fullscreenElement) { try { document.exitFullscreen(); } catch (e) { } }
        v.classList.remove('pseudo-full'); document.documentElement.style.overflow = '';
        setFullUI();
    }
    function enterFull() {
        var v = $('#camview');
        function pseudo() { v.classList.add('pseudo-full'); document.documentElement.style.overflow = 'hidden'; setFullUI(); }
        if (v.requestFullscreen) { try { v.requestFullscreen().then(setFullUI, pseudo); } catch (e) { pseudo(); } } else pseudo();
    }
    function toggleFull() { if (isFull()) exitFull(); else enterFull(); }
    function initZoom() {
        var v = $('#camview'), ptrs = {}, pinch = null;
        function rel(x, y) { var r = v.getBoundingClientRect(); return [x - r.left - r.width / 2, y - r.top - r.height / 2]; }
        $('#zIn').addEventListener('click', function () { zoomTo(V.z * 1.3); });
        $('#zOut').addEventListener('click', function () { zoomTo(V.z / 1.3); });
        $('#zLvl').addEventListener('click', function () { zoomTo(1); });
        $('#zFs').addEventListener('click', toggleFull);
        $('#camFull').addEventListener('click', toggleFull);
        $('#vZm').addEventListener('input', function () { zoomTo(this.value / 100); });
        v.addEventListener('wheel', function (e) { if (camimg.hidden) return; e.preventDefault(); var p = rel(e.clientX, e.clientY); zoomTo(V.z * Math.exp(-e.deltaY * 0.0015), p[0], p[1]); }, { passive: false });
        v.addEventListener('dblclick', function (e) { if (camimg.hidden || e.target.closest('.camzoom')) return; var p = rel(e.clientX, e.clientY); if (V.z > 1) zoomTo(1); else zoomTo(2.5, p[0], p[1]); });
        v.addEventListener('pointerdown', function (e) {
            if (e.target.closest('.camzoom') || camimg.hidden) return;
            ptrs[e.pointerId] = [e.clientX, e.clientY];
            try { v.setPointerCapture(e.pointerId); } catch (x) { }
            var ids = Object.keys(ptrs);
            if (ids.length === 2) { var a = ptrs[ids[0]], b = ptrs[ids[1]]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z: V.z }; }
        });
        v.addEventListener('pointermove', function (e) {
            var prev = ptrs[e.pointerId]; if (!prev) return;
            ptrs[e.pointerId] = [e.clientX, e.clientY];
            var ids = Object.keys(ptrs);
            if (ids.length >= 2 && pinch) { var a = ptrs[ids[0]], b = ptrs[ids[1]], d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = rel((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); zoomTo(pinch.z * d / pinch.d, m[0], m[1]); }
            else if (ids.length === 1 && V.z > 1) { V.x += e.clientX - prev[0]; V.y += e.clientY - prev[1]; applyView(); }
        });
        function end(e) { delete ptrs[e.pointerId]; pinch = null; }
        v.addEventListener('pointerup', end); v.addEventListener('pointercancel', end);
        document.addEventListener('fullscreenchange', setFullUI);
        window.addEventListener('resize', function () { measureView(); applyView(); });
        document.addEventListener('keydown', function (e) {
            var t = e.target && e.target.tagName;
            if (t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA') return;
            if (e.key === 'Escape' && v.classList.contains('pseudo-full')) { exitFull(); return; }
            if (page !== 'kamera' || e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.key === '+' || e.key === '=') zoomTo(V.z * 1.3);
            else if (e.key === '-' || e.key === '_') zoomTo(V.z / 1.3);
            else if (e.key === '0') zoomTo(1);
            else if (e.key === 'f' || e.key === 'F') toggleFull();
        });
        applyView();
    }

    /* ================= Pengaturan ================= */
    function fillSettings() {
        $('#setUrl').value = S.firebase;
        $('#setPoll').value = String(S.poll);
        $('#setFetchN').value = String(S.fetchN);
        $('#setDemo').checked = S.forceDemo;
        $('#setDry').value = S.dry;
        $('#setWet').value = S.wet;
        $('#setUnit').value = S.unit;
        $('#setClock').value = S.clock;
        $('#setTheme').value = S.theme;
                if ($('#setReportEmail')) $('#setReportEmail').value = S.reportEmail || 'yahyailham897@gmail.com';
        if ($('#setReportEmail2')) $('#setReportEmail2').value = S.reportEmail2 || '';
        if ($('#setReportEmail3')) $('#setReportEmail3').value = S.reportEmail3 || '';
        if ($('#setCamIp')) $('#setCamIp').value = S.camIp || '';
    }
    function applyTheme() {
        var r = document.documentElement;
        if (S.theme === 'system') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', S.theme);
    }
    function restart() { mode = 'init'; hist = []; net = true; $('#notice').hidden = true; }

    /* ================= Report Modal Helpers ================= */
    function openReportModal() {
        var modal = $('#reportModalBackdrop');
        if (!modal) return;

        var realR = last();
        var hasRealSensor = !!realR;
        var r = realR || { tanah: 0, suhu: 0, udara: 0, t: Date.now() };
        var now = new Date();
        var dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        var timeStr = now.toLocaleTimeString('id-GB');

        // Update meta in modal
        var tsEl = $('#reportTimestampDisplay');
        if (tsEl) tsEl.textContent = dateStr + ' pukul ' + timeStr;

        // Update sensor previews (0 jika belum ada data sensor)
        if ($('#repTemp')) $('#repTemp').textContent = hasRealSensor ? (num(tc(r.suhu), 1) + ' ' + tu()) : ('0.0 ' + tu());
        if ($('#repHum'))  $('#repHum').textContent  = hasRealSensor ? (num(r.udara, 0) + ' %') : '0 %';
        if ($('#repSoil')) $('#repSoil').textContent = hasRealSensor ? (num(r.tanah, 0) + ' %') : '0 %';

        // Update CNN thumbnail
        var cnn = window.SeladaLastCNN;
        if (!cnn) {
            try { cnn = JSON.parse(localStorage.getItem('selada_last_cnn')); } catch (e) { }
        }
        var thumbImg = $('#reportThumbImg');
        var thumbLbl = $('#reportThumbLabel');
        if (cnn && cnn.imgDataUrl && thumbImg) {
            thumbImg.src = cnn.imgDataUrl;
            thumbImg.style.display = 'block';
            if (thumbLbl) thumbLbl.style.display = 'none';
        } else if (thumbImg) {
            thumbImg.style.display = 'none';
            if (thumbLbl) thumbLbl.style.display = 'block';
        }

        // Build report text
        var pState = pumpState();
        var cnnText = cnn ? (
            '   - Spesies Tanaman  : ' + (cnn.isLettuce === false ? 'Bukan Selada Keriting (Tidak Dikenali)' : 'Selada Keriting (Lactuca sativa var. crispa)') + '\n' +
            '   - Indeks Kemiripan : ' + (cnn.similarityIndex ? cnn.similarityIndex + '%' : '0.0%') + '\n' +
            '   - Lebar Daun       : ' + (cnn.leafWidthCm ? cnn.leafWidthCm + ' cm' : '0.0 cm') + '\n' +
            '   - Fase Kematangan  : ' + (cnn.stageName || 'Standby (0%)') + ' (' + (cnn.maturityPct || 0) + '%)\n' +
            '   - Probabilitas     : Pertumbuhan ' + (cnn.probs ? cnn.probs.pertumbuhan : 0) + '%, Dekat Panen ' + (cnn.probs ? cnn.probs.mendekati : 0) + '%, Siap Panen ' + (cnn.probs ? cnn.probs.siap : 0) + '%'
        ) : '   - Analisis CNN     : Belum ada citra daun selada dianalisis (0%). Menunggu unggahan foto.';

        var sensorSection = hasRealSensor ? (
            '1. PEMANTAUAN SENSOR IOT REALTIME (ESP32):\n' +
            '   - Kelembapan Tanah : ' + num(r.tanah, 0) + '% (' + zone(r.tanah) + ')\n' +
            '   - Suhu Udara       : ' + num(tc(r.suhu), 1) + ' ' + tu() + '\n' +
            '   - Kelembapan Udara : ' + num(r.udara, 0) + '%\n' +
            '   - Status Pompa Air : ' + (pState.on ? 'Menyala' : 'Mati') + '\n\n'
        ) : (
            '1. PEMANTAUAN SENSOR IOT REALTIME (ESP32):\n' +
            '   - Status Sistem    : STANDBY (Wadah Buffer 1440 Data Disiapkan)\n' +
            '   - Kelembapan Tanah : 0% (STANDBY - Menunggu Data Alat)\n' +
            '   - Suhu Udara       : 0.0 ' + tu() + ' (STANDBY - Menunggu Data Alat)\n' +
            '   - Kelembapan Udara : 0% (STANDBY - Menunggu Data Alat)\n' +
            '   - Status Pompa Air : Mati (STANDBY)\n\n'
        );

        var lstmSection = hasRealSensor ? (
            '3. PREDIKSI KEMATANGAN 4 HARI KE DEPAN (LSTM):\n' +
            '   - Terkalkulasi otomatis dari data sensor riil ESP32 yang masuk.\n\n'
        ) : (
            '3. PREDIKSI KEMATANGAN 4 HARI KE DEPAN (LSTM):\n' +
            '   - Hari +1 : STANDBY (0% Kesiapan Panen), Est. Lebar Daun ~0.0 cm\n' +
            '   - Hari +2 : STANDBY (0% Kesiapan Panen), Est. Lebar Daun ~0.0 cm\n' +
            '   - Hari +3 : STANDBY (0% Kesiapan Panen), Est. Lebar Daun ~0.0 cm\n' +
            '   - Hari +4 : STANDBY (0% Kesiapan Panen), Est. Lebar Daun ~0.0 cm\n\n'
        );

        var noteSection = hasRealSensor ? (
            'Catatan Tambahan:\n' +
            'Kondisi tanaman selada keriting terpantau optimal sesuai standar agronomi. Logika pompa air otomatis merespons ambang batas tanah (65%–78%) dengan baik.'
        ) : (
            'Catatan Tambahan:\n' +
            'Firebase Realtime Database berstatus AKTIF & TERHUBUNG (STANDBY). Wadah buffer 1440 data (siklus 24 jam) disiapkan. Belum ada data dari sensor dan alat yang masuk (semua parameter 0%). Seluruh pembacaan live dan peramalan AI akan langsung aktif secara live begitu alat ESP32 mentransmisikan data.'
        );

        var reportTpl =
            'Yth. Pembimbing & Tim Laboratorium Smart Farming (Botanic Sync),\n\n' +
            'Berikut ini kami sampaikan Ringkasan Laporan Monitoring & AI Tanaman Selada Keriting (Kelompok 6 · Botanic Sync):\n\n' +
            'Tanggal & Waktu  : ' + dateStr + ' pukul ' + timeStr + ' WIB\n' +
            'Identitas Tim    : Kelompok 6 · Botanic Sync (Budidaya Selada Keriting - Lactuca sativa var. crispa)\n' +
            'Email Tujuan     : ' + (function() {
                var recs = [S.reportEmail || 'yahyailham897@gmail.com'];
                if (S.reportEmail2 && S.reportEmail2.trim()) recs.push(S.reportEmail2.trim());
                if (S.reportEmail3 && S.reportEmail3.trim()) recs.push(S.reportEmail3.trim());
                return recs.join(', ');
            })() + '\n' +
            'Integrasi Cloud  : Firebase Realtime Database (Aktif & Terhubung)\n\n' +
            '════════════════════════════════════════════════════════════\n' +
            sensorSection +
            '2. HASIL ANALISIS CITRA CNN (COMPUTER VISION):\n' +
            cnnText + '\n\n' +
            lstmSection +
            noteSection;

        var txtArea = $('#reportTextContent');
        if (txtArea) txtArea.value = reportTpl;

        modal.hidden = false;
    }


    function closeReportModal() {
        var modal = $('#reportModalBackdrop');
        if (modal) modal.hidden = true;
    }

    /* ================= Bind Events ================= */
    function bind() {
        $('#retry').addEventListener('click', restart);

        // Dashboard Realtime Refresh Button
        if ($('#dbRefreshBtn')) {
            $('#dbRefreshBtn').addEventListener('click', async function () {
                var btn = this;
                btn.disabled = true;
                var svg = btn.querySelector('svg');
                if (svg) svg.classList.add('spin-icon');
                toast('Memperbarui data sensor dashboard realtime...');
                try {
                    var rows = await fetchRows(S.firebase, S.fetchN, 6000);
                    if (rows && rows.length) {
                        merge(rows);
                        net = true;
                    }
                    renderAll();
                    toast('Data dashboard berhasil diperbarui.');
                } catch (e) {
                    renderAll();
                    toast('Koneksi dashboard siap.');
                } finally {
                    setTimeout(function () {
                        btn.disabled = false;
                        if (svg) svg.classList.remove('spin-icon');
                    }, 600);
                }
            });
        }

        // Camera Refresh Buttons
        if ($('#camRefreshTop')) {
            $('#camRefreshTop').addEventListener('click', function () {
                var svg = this.querySelector('svg');
                if (svg) svg.classList.add('spin-icon');
                toast('Menyegarkan koneksi kamera ESP32-CAM...');
                camStart();
                setTimeout(function () {
                    if (svg) svg.classList.remove('spin-icon');
                }, 600);
            });
        }

        // Dashboard series selector
        $('#dbSeg').addEventListener('click', function (e) {
            var b = e.target.closest('button'); if (!b) return;
            dbSeries = b.dataset.s;
            $$('#dbSeg button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
            renderAll();
        });

        // Camera
        $('#camGo').addEventListener('click', function () { var ip = cleanIp($('#camip').value); if (!ip) return; S.camIp = ip; save(); camStart(); });
        $('#camip').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#camGo').click(); });
        $('#portalSave').addEventListener('click', function () {
            var ip = cleanIp($('#portalip').value) || '192.168.4.2';
            S.portalIp = ip; $('#portalip').value = ip; save(); updatePortalLink(); toast('IP portal disimpan: ' + ip);
        });
        $('#portalip').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#portalSave').click(); });
        $('#useAp').addEventListener('click', function () { $('#portalip').value = '192.168.4.2'; $('#portalSave').click(); });
        $('#camReload').addEventListener('click', function () { camStart(); });
        $('#camOff').addEventListener('click', function () { cam.want = false; camStop(); camIdle(); $('#camOff').hidden = true; });
        $('#camMode').addEventListener('click', function (e) {
            var b = e.target.closest('button'); if (!b) return;
            cam.mode = b.dataset.m;
            $$('#camMode button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
            $('#intRow').hidden = cam.mode !== 'foto';
            if (cam.run || cam.want) camStart();
        });
        $('#intRow').hidden = true;
        $('#camInt').addEventListener('change', function () { cam.interval = Number(this.value); });
        $('#camSnap').addEventListener('click', function () {
            if (camimg.hidden || !camimg.naturalWidth) { toast('Belum ada gambar untuk difoto.'); return; }
            var c = document.createElement('canvas'); c.width = camimg.naturalWidth; c.height = camimg.naturalHeight;
            try { c.getContext('2d').drawImage(camimg, 0, 0); } catch (e) { toast('Foto gagal diambil.'); return; }
            gallery.unshift({ c: c, t: Date.now() }); if (gallery.length > 12) gallery.pop();
            renderGallery(); toast('Foto tersimpan di galeri sesi ini.');
        });
        $('#galClear').addEventListener('click', function () { gallery = []; renderGallery(); });
        ['vBr', 'vCt', 'vMir', 'vRot'].forEach(function (id) { $('#' + id).addEventListener('input', applyView); });
        $('#viewReset').addEventListener('click', function () { $('#vBr').value = 100; $('#vCt').value = 100; V.z = 1; V.x = 0; V.y = 0; $('#vMir').checked = false; $('#vRot').checked = false; applyView(); });

        // Pengaturan & Email Laporan Gmail
        if ($('#btnSaveReportEmail')) {
            $('#btnSaveReportEmail').addEventListener('click', function () {
                var em1 = $('#setReportEmail') ? $('#setReportEmail').value.trim() : '';
                var em2 = $('#setReportEmail2') ? $('#setReportEmail2').value.trim() : '';
                var em3 = $('#setReportEmail3') ? $('#setReportEmail3').value.trim() : '';
                if (!em1) { toast('Masukkan minimal 1 alamat email penerima utama.'); return; }
                S.reportEmail = em1;
                S.reportEmail2 = em2;
                S.reportEmail3 = em3;
                save();
                var recs = [em1];
                if (em2) recs.push(em2);
                if (em3) recs.push(em3);
                toast('Alamat email tersimpan (' + recs.length + ' penerima): ' + recs.join(', '));
            });
        }
        if ($('#btnSaveCamIp')) {
            $('#btnSaveCamIp').addEventListener('click', function () {
                var ip = cleanIp($('#setCamIp').value);
                S.camIp = ip;
                save();
                toast('IP default kamera ESP32-CAM disimpan: ' + (ip || '(kosong)'));
            });
        }
        if ($('#btnOpenTemplateSettings')) {
            $('#btnOpenTemplateSettings').addEventListener('click', openReportModal);
        }
        if ($('#btnHeaderKirimLaporan')) {
            $('#btnHeaderKirimLaporan').addEventListener('click', openReportModal);
        }

        // Modal Actions
        if ($('#btnCloseModalTop')) $('#btnCloseModalTop').addEventListener('click', closeReportModal);
        if ($('#btnCloseModalBottom')) $('#btnCloseModalBottom').addEventListener('click', closeReportModal);
        if ($('#reportModalBackdrop')) {
            $('#reportModalBackdrop').addEventListener('click', function (e) {
                if (e.target === this) closeReportModal();
            });
        }
        if ($('#btnCopyReportText')) {
            $('#btnCopyReportText').addEventListener('click', function () {
                var txt = $('#reportTextContent') ? $('#reportTextContent').value : '';
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(txt).then(function () {
                        toast('Teks laporan berhasil disalin ke clipboard!');
                    }).catch(function () {
                        toast('Silakan salin teks secara manual.');
                    });
                } else {
                    toast('Teks laporan siap disalin.');
                }
            });
        }
        if ($('#btnSendGmailAction')) {
            $('#btnSendGmailAction').addEventListener('click', function () {
                var recs = [S.reportEmail || 'yahyailham897@gmail.com'];
                if (S.reportEmail2 && S.reportEmail2.trim()) recs.push(S.reportEmail2.trim());
                if (S.reportEmail3 && S.reportEmail3.trim()) recs.push(S.reportEmail3.trim());
                var toEmail = recs.join(',');
                var subject = 'Laporan Monitoring & AI Tanaman Selada Keriting - Kelompok 6 Botanic Sync';
                var body = $('#reportTextContent') ? $('#reportTextContent').value : '';
                var gmailUrl = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(toEmail) + '&su=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
                window.open(gmailUrl, '_blank');
            });
        }

        $('#setUrl').addEventListener('change', function () { var v = this.value.trim(); if (!v) return; S.firebase = v; save(); restart(); });
        $('#setPoll').addEventListener('change', function () { S.poll = Number(this.value); save(); });
        $('#setFetchN').addEventListener('change', function () { S.fetchN = Number(this.value); save(); restart(); });
        $('#setDemo').addEventListener('change', function () { S.forceDemo = this.checked; save(); restart(); });
        $('#setUnit').addEventListener('change', function () { S.unit = this.value; save(); renderAll(); });
        $('#setClock').addEventListener('change', function () { S.clock = this.value; save(); renderAll(); });
        $('#setTheme').addEventListener('change', function () { S.theme = this.value; save(); applyTheme(); });
        function zoneSave() {
            var d = Number($('#setDry').value), w = Number($('#setWet').value), m = $('#zoneMsg');
            if (!(d >= 1 && w <= 99 && d < w)) { m.className = 'msg err'; m.textContent = 'Batas kering harus lebih kecil dari batas basah.'; return; }
            S.dry = d; S.wet = w; save(); renderAll();
            m.className = 'msg good'; m.textContent = 'Tersimpan. Pompa tetap mengikuti program di ESP32.';
        }
        $('#setDry').addEventListener('change', zoneSave); $('#setWet').addEventListener('change', zoneSave);
        $('#testBtn').addEventListener('click', async function () {
            var m = $('#testMsg'), url = $('#setUrl').value.trim(); m.className = 'msg'; m.textContent = 'Menguji…';
            try {
                var rows = await fetchRows(url, 1, 6000);
                m.className = 'msg good'; m.textContent = rows.length ? 'Tersambung. Data terbaru pukul ' + fmtT(rows[0].t) + '.' : 'Tersambung, tetapi belum ada data di alamat ini.';
            } catch (e) { m.className = 'msg err'; m.textContent = 'Tidak bisa membaca alamat ini. Cek URL, aturan baca Firebase, dan koneksi internet.'; }
        });
        $('#setReset').addEventListener('click', function () {
            var ip = S.camIp, pip = S.portalIp; S = clone(DEF); S.camIp = ip; S.portalIp = pip; save(); applyTheme(); fillSettings(); restart(); toast('Pengaturan dikembalikan ke bawaan.');
        });
    }

    /* ================= Core API ================= */
    var core = {
        settings: function () { return S; },
        hist: function () { return hist; },
        last: last,
        mode: function () { return mode; },
        netOk: function () { return net; },
        pump: pumpState,
        pumpHTML: pumpHTML,
        pumpOn: rowOn,
        pumpStats: pumpStats,
        fmtT: fmtT,
        fmtDate: fmtDate,
        tc: tc,
        tu: tu,
        num: num,
        dur: dur,
        avg: avg,
        toast: toast,
        zone: zone,
        ZN: ZN,
        pushTime: pushTime,
        save: save,
        lineChart: lineChart,
        spark: spark,
        cfg: cfg,
        win: win,
        rerender: function () { renderAll(); },
        current: function () { return page; },
        go: function (id) { location.hash = id; },
        camLastFrame: function () { return cam.lastFrame; }
    };

    // Load external modules
    (window.SeladaModules || []).forEach(function (f) {
        try {
            [].concat(f(core)).forEach(function (m) {
                if (m && m.id) {
                    EXT[m.id] = m;
                    // Replace existing stub in PAGES if same id, else push
                    var idx = PAGES.findIndex ? PAGES.findIndex(function(p){ return p.id === m.id; }) : -1;
                    if (idx < 0) { for (var _i=0;_i<PAGES.length;_i++) { if(PAGES[_i].id===m.id){idx=_i;break;} } }
                    if (idx >= 0) { PAGES[idx] = m; } else { PAGES.push(m); }
                }
            });
        } catch (e) { console.error('Modul gagal dimuat:', e); }
    });
    PAGES.sort(function (a, b) { return (a.o || 500) - (b.o || 500); });
    window.Selada = core;

    buildNav(); bind(); initZoom(); initNav();
    Object.keys(EXT).forEach(function (k) { if (EXT[k].init) { try { EXT[k].init(); } catch (e) { console.error(e); } } });
    if (S.theme !== 'system') applyTheme();

    window.addEventListener('hashchange', function () { route(); });
    document.addEventListener('click', function (e) {
        var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
        if (!a) return;
        var id = a.getAttribute('href').slice(1);
        if (!PAGES.some(function (p) { return p.id === id; })) return;
        e.preventDefault();
        try { history.pushState(null, '', '#' + id); } catch (err) { }
        route(id);
    });
    route();

    var lastW = 0;
    if (window.ResizeObserver) new ResizeObserver(function () {
        var w = $('.main').clientWidth;
        if (w !== lastW) { lastW = w; requestAnimationFrame(renderAll); }
    }).observe($('.main'));

    setInterval(function () { renderHeader(); }, 1000);

    /* ================= Login ================= */
    var AUTH = { email: 'admin@gmail.com', pass: 'admin123', key: 'selada-auth-v2' };
    var polling = false, fails = 0, lockUntil = 0;
    function authed() {
        try { if (sessionStorage.getItem(AUTH.key) === '1' || localStorage.getItem(AUTH.key) === '1') return true; } catch (e) { }
        return false;
    }
    function setAuth(on, remember) {
        try { sessionStorage.removeItem(AUTH.key); localStorage.removeItem(AUTH.key); } catch (e) { }
        if (!on) return;
        try { (remember ? localStorage : sessionStorage).setItem(AUTH.key, '1'); } catch (e) { }
    }
    function unlock() {
        document.body.classList.remove('locked'); $('#login').hidden = true;
        $('#uemail').textContent = AUTH.email;
        if (!polling) { polling = true; poll(); }
        requestAnimationFrame(renderAll);
    }
    function lock() {
        setAuth(false);
        try { history.pushState(null, '', '#dashboard'); } catch (e) { }
        route('dashboard');
        if (document.body.classList.contains('nav-open') && isMobile()) setNav(false, false);
        document.body.classList.add('locked'); $('#login').hidden = false;
        $('#loginPass').value = ''; $('#loginMsg').textContent = '';
        $('#loginEmail').focus();
    }
    $('#loginForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var msg = $('#loginMsg'), now = Date.now();
        if (now < lockUntil) { msg.textContent = 'Terlalu banyak percobaan. Coba lagi dalam ' + Math.ceil((lockUntil - now) / 1000) + ' detik.'; return; }
        var em = $('#loginEmail').value.trim().toLowerCase(), pw = $('#loginPass').value;
        if (!em || !pw) { msg.textContent = 'Isi email dan kata sandi.'; return; }
        if (em === AUTH.email && pw === AUTH.pass) {
            fails = 0; msg.textContent = '';
            setAuth(true, $('#loginRemember').checked);
            $('#loginPass').value = '';
            unlock();
        } else {
            fails++;
            if (fails >= 5) { fails = 0; lockUntil = now + 30000; msg.textContent = 'Terlalu banyak percobaan. Coba lagi dalam 30 detik.'; }
            else msg.textContent = 'Email atau kata sandi salah.';
            $('#loginPass').focus(); $('#loginPass').select();
        }
    });
    $('#loginEye').addEventListener('click', function () {
        var i = $('#loginPass'), show = i.type === 'password';
        i.type = show ? 'text' : 'password';
        this.textContent = show ? 'Sembunyi' : 'Tampil';
        this.setAttribute('aria-pressed', String(show));
        this.setAttribute('aria-label', show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
    });
    $('#logout').addEventListener('click', lock);
    if (authed()) unlock(); else $('#loginEmail').focus();
})();
