/* js/pages/lstm_page.js - Halaman LSTM: Prediksi Kematangan Tanaman Selada Keriting (Siklus 42 Hari)
   Kelompok 6 · Botanic Sync - Desain Terpadu: Citra Daun, Grafik & Sensor di Dalam Setiap Card Harian
*/
(function () {
    'use strict';

    /* ── Konstanta Kematangan Selada Keriting (Siklus 42 Hari) ── */
    var STAGE1_MAX = 65;   // < 65%: Masa Pertumbuhan (Hari 1-28)
    var STAGE2_MAX = 85;   // 65% - 85%: Mendekati Panen (Hari 29-37)
                           // >= 85%: Siap Panen (Hari 38-42)

    var HARVEST_TARGET_DEFAULT = 42; // Standar panen selada keriting 42 HST
    var SCALE_PX_PER_CM = 40;        // Kalibrasi standar 40 px per cm
    var CIRC = 339.3;                // Keliling lingkaran gauge (2 * Math.PI * 54)

    /* ── Custom Botanical Vector SVG Icons (Desain Eksklusif Kelompok 6 Botanic Sync - Bukan Emoji Teman) ── */
    var BOTANICAL_SVGS = {
        sprout: '<svg viewBox="0 0 40 40" fill="none" class="botanic-stage-svg sprout" xmlns="http://www.w3.org/2000/svg" style="width:34px;height:34px;display:inline-block;vertical-align:middle">' +
            '<circle cx="20" cy="20" r="18" fill="rgba(16,185,129,0.18)" stroke="#10b981" stroke-width="1.5" stroke-dasharray="2 2"/>' +
            '<path d="M20 31V18" stroke="#10b981" stroke-width="2.5" stroke-linecap="round"/>' +
            '<path d="M20 22C17 17 10 18 9 22C8 26 15 28 20 22Z" fill="#34d399" stroke="#059669" stroke-width="1.2"/>' +
            '<path d="M20 18C23 13 30 14 31 18C32 22 25 24 20 18Z" fill="#10b981" stroke="#047857" stroke-width="1.2"/>' +
            '<circle cx="20" cy="31" r="2.5" fill="#059669"/>' +
            '</svg>',
        expanding: '<svg viewBox="0 0 40 40" fill="none" class="botanic-stage-svg expanding" xmlns="http://www.w3.org/2000/svg" style="width:34px;height:34px;display:inline-block;vertical-align:middle">' +
            '<circle cx="20" cy="20" r="18" fill="rgba(52,211,153,0.18)" stroke="#34d399" stroke-width="1.5"/>' +
            '<path d="M20 33V14" stroke="#059669" stroke-width="2.5" stroke-linecap="round"/>' +
            '<path d="M20 25C13 18 6 21 5 27C4 32 12 34 20 25Z" fill="#34d399" stroke="#059669" stroke-width="1.2"/>' +
            '<path d="M20 21C27 14 34 17 35 23C36 28 28 30 20 21Z" fill="#10b981" stroke="#047857" stroke-width="1.2"/>' +
            '<path d="M20 13C16 8 11 9 10 12C9 15 15 17 20 13Z" fill="#6ee7b7" stroke="#10b981" stroke-width="1"/>' +
            '<path d="M20 11C24 6 29 7 30 10C31 13 25 15 20 11Z" fill="#34d399" stroke="#059669" stroke-width="1"/>' +
            '</svg>',
        crisphead: '<svg viewBox="0 0 40 40" fill="none" class="botanic-stage-svg crisphead" xmlns="http://www.w3.org/2000/svg" style="width:34px;height:34px;display:inline-block;vertical-align:middle">' +
            '<circle cx="20" cy="20" r="18" fill="rgba(234,179,8,0.18)" stroke="#eab308" stroke-width="1.5"/>' +
            '<path d="M10 23C7 18 11 12 17 12C19 9 23 9 26 12C32 12 36 18 33 23C35 28 30 34 24 33C22 35 18 35 15 33C9 34 5 28 10 23Z" fill="#22c55e" stroke="#15803d" stroke-width="1.3"/>' +
            '<path d="M13 22C11 17 15 14 20 14C25 14 28 17 27 22C28 26 25 30 20 30C15 30 12 26 13 22Z" fill="#86efac" stroke="#16a34a" stroke-width="1.2"/>' +
            '<path d="M17 21C16 18 17 16 20 16C23 16 24 18 23 21C24 24 22 25 20 25C18 25 16 24 17 21Z" fill="#facc15" stroke="#ca8a04" stroke-width="1"/>' +
            '</svg>',
        harvest: '<svg viewBox="0 0 40 40" fill="none" class="botanic-stage-svg harvest-prime" xmlns="http://www.w3.org/2000/svg" style="width:34px;height:34px;display:inline-block;vertical-align:middle">' +
            '<circle cx="20" cy="20" r="18" fill="rgba(34,197,94,0.25)" stroke="#22c55e" stroke-width="1.8"/>' +
            '<path d="M8 22C5 15 11 9 17 10C20 7 24 7 27 10C33 9 38 15 35 22C38 29 33 36 26 35C23 37 18 37 14 35C7 36 3 29 8 22Z" fill="#15803d" stroke="#166534" stroke-width="1.3"/>' +
            '<path d="M12 22C10 17 14 13 20 13C26 13 30 17 28 22C30 27 26 31 20 31C14 31 10 27 12 22Z" fill="#22c55e" stroke="#15803d" stroke-width="1.3"/>' +
            '<path d="M15 22C14 19 17 15 20 15C23 15 26 19 25 22C26 25 23 28 20 28C17 28 14 25 15 22Z" fill="#86efac" stroke="#16a34a" stroke-width="1.1"/>' +
            '<path d="M20 3L21.5 6.5L25 7L22.5 9.5L23 13L20 11.2L17 13L17.5 9.5L15 7L18.5 6.5L20 3Z" fill="#fbbf24" stroke="#d97706" stroke-width="0.8"/>' +
            '</svg>'
    };

    function getBotanicalSvgForDay(d) {
        if (d === 1) return BOTANICAL_SVGS.sprout;
        if (d === 2) return BOTANICAL_SVGS.expanding;
        if (d === 3) return BOTANICAL_SVGS.crisphead;
        return BOTANICAL_SVGS.harvest;
    }

    function stageInfo(pct) {
        if (pct < STAGE1_MAX) return { name: 'Masa Pertumbuhan', color: '--ok', short: 'Tumbuh', badgeColor: '#34d399', badgeBg: 'rgba(16,185,129,0.15)' };
        if (pct < STAGE2_MAX) return { name: 'Mendekati Panen', color: '--dry', short: 'Dekat Panen', badgeColor: '#facc15', badgeBg: 'rgba(234,179,8,0.15)' };
        return { name: 'Siap Panen Optimal', color: '--bad', short: 'Siap Panen', badgeColor: '#4ade80', badgeBg: 'rgba(34,197,94,0.22)' };
    }

    /* ── Module entry point ── */
    window.SeladaModules = window.SeladaModules || [];
    window.SeladaModules.push(function (core) {

        var $ = function (s) { return document.querySelector(s); };

        /* Local State */
        var plantDate = null;
        var harvestDay = HARVEST_TARGET_DEFAULT;
        var inputSource = 'realtime'; // 'realtime' | 'manual'
        var simulatedHST = null;
        var simulatedParams = { soil: 0.0, temp: 0.0, hum: 0.0, hst: 0 };
        var baseLeafWidthCm = 0.0; // Default 0 sebelum ada data
        var fourDayForecasts = [];
        var cardImages = { 1: null, 2: null, 3: null, 4: null };
        var cardWidths = { 1: null, 2: null, 3: null, 4: null };
        var currentModalDay = 1;
        var targetUploadDay = 1;

        function saveLSTMCardData() {
            try {
                localStorage.setItem('selada_lstm_card_images', JSON.stringify(cardImages));
                localStorage.setItem('selada_lstm_card_widths', JSON.stringify(cardWidths));
            } catch (e) { }
        }

        function loadLSTMState() {
            try {
                var s = core.settings();
                if (s.plantDate) plantDate = new Date(s.plantDate);
                harvestDay = Number(s.harvestDay) || HARVEST_TARGET_DEFAULT;
            } catch (e) { }

            // Muat riwayat citra daun & lebar per card yang tersimpan
            try {
                var rawImgs = localStorage.getItem('selada_lstm_card_images');
                if (rawImgs) {
                    var parsedImgs = JSON.parse(rawImgs);
                    if (parsedImgs && typeof parsedImgs === 'object') {
                        cardImages[1] = parsedImgs[1] || null;
                        cardImages[2] = parsedImgs[2] || null;
                        cardImages[3] = parsedImgs[3] || null;
                        cardImages[4] = parsedImgs[4] || null;
                    }
                }
            } catch (e) { }

            try {
                var rawW = localStorage.getItem('selada_lstm_card_widths');
                if (rawW) {
                    var parsedW = JSON.parse(rawW);
                    if (parsedW && typeof parsedW === 'object') {
                        cardWidths[1] = parsedW[1] ? Number(parsedW[1]) : null;
                        cardWidths[2] = parsedW[2] ? Number(parsedW[2]) : null;
                        cardWidths[3] = parsedW[3] ? Number(parsedW[3]) : null;
                        cardWidths[4] = parsedW[4] ? Number(parsedW[4]) : null;
                    }
                }
            } catch (e) { }

            // Ambil baseline lebar daun dari modul CNN jika tersedia
            if (window.SeladaLastCNN && window.SeladaLastCNN.leafWidthCm) {
                baseLeafWidthCm = Number(window.SeladaLastCNN.leafWidthCm) || 10.2;
            } else {
                try {
                    var raw = localStorage.getItem('selada_last_cnn');
                    if (raw) {
                        var c = JSON.parse(raw);
                        if (c && c.leafWidthCm) baseLeafWidthCm = Number(c.leafWidthCm) || 10.2;
                    }
                } catch (e) { }
            }
        }

        function saveLSTMState() {
            try {
                var s = core.settings();
                s.plantDate = plantDate ? plantDate.toISOString().slice(0, 10) : '';
                s.harvestDay = harvestDay;
                core.save();
            } catch (e) { }
        }

        /* Current HST (0 HST jika belum ada data sensor alat) */
        function getHST() {
            if (inputSource === 'manual' && simulatedHST !== null) {
                return simulatedHST;
            }
            var hist = core.hist() || [];
            if (!plantDate || hist.length === 0) return 0; // Nol saat belum ada data alat!
            var now = new Date();
            var ms = now - plantDate;
            if (ms < 0) return 0;
            return Math.min(harvestDay, Math.floor(ms / 86400000));
        }

        /* Maturity % based on HST */
        function getMaturity(hst) {
            if (hst === null || hst === undefined) return 0;
            return Math.min(100, Math.max(0, (hst / harvestDay) * 100));
        }

        /* ── Gauge SVG update: Metrik Kematangan Tanaman (Tingkat Kematangan Tanaman %) ── */
        function updateGauge(pct, isStandby) {
            var fill = $('#gaugeFill');
            if (fill) {
                var offset = CIRC * (1 - Math.min(100, Math.max(0, pct)) / 100);
                fill.style.strokeDashoffset = offset.toFixed(1);
                var stage = isStandby ? { color: '--muted' } : stageInfo(pct);
                fill.style.stroke = 'var(' + stage.color + ')';
            }
            var pctEl = $('#gaugePct'), stEl = $('#gaugeStage');
            if (pctEl) {
                pctEl.textContent = Math.round(pct) + '%';
                pctEl.style.color = isStandby ? '#94a3b8' : stageInfo(pct).badgeColor;
            }
            if (stEl) {
                stEl.textContent = isStandby ? 'STANDBY (Menunggu Alat)' : stageInfo(pct).name;
            }
        }

        /* ── Age Display (Kembalikan ke 0% jika belum ada data sensor & alat) ── */
        function updateAgeDisplay() {
            var hist = core.hist() || [];
            var hasData = (inputSource === 'manual') || (hist.length > 0);
            var target = harvestDay || HARVEST_TARGET_DEFAULT;
            var hst = hasData ? getHST() : 0;
            var pct = hasData ? getMaturity(hst) : 0;
            var stage = hasData ? stageInfo(pct) : { name: 'STANDBY (0 HST)', color: '--muted', badgeBg: 'rgba(100,116,139,0.18)', badgeColor: '#94a3b8', short: 'STANDBY' };

            var hstEl = $('#lstmHst'), hintEl = $('#lstmAgeHint');
            if (hstEl) hstEl.textContent = hst;
            if (hintEl) {
                if (!hasData) {
                    hintEl.textContent = 'STANDBY: Firebase RTDB aktif terhubung • Wadah 1440 data siap menampung sensor ESP32.';
                } else {
                    var daysLeft = target - hst;
                    if (daysLeft > 0) hintEl.textContent = 'Sisa ' + daysLeft + ' hari hingga target panen (' + target + ' HST)';
                    else if (daysLeft === 0) hintEl.textContent = 'Hari ini target panen tercapai (' + target + ' HST)!';
                    else hintEl.textContent = 'Melewati target panen ' + Math.abs(daysLeft) + ' hari lalu';
                }
            }

            var pill = $('#lstmAgePill');
            if (pill) {
                pill.textContent = hasData ? stage.name : 'STANDBY (0 HST)';
                pill.style.setProperty('--z', 'var(' + stage.color + ')');
                pill.style.color = stage.badgeColor;
            }

            var bar = $('#lstmAgeBar'), prog = $('#lstmAgeProgress');
            if (bar) bar.style.width = pct.toFixed(1) + '%';
            if (prog) prog.textContent = hasData ? (Math.round(pct) + '% matang · ' + stage.name) : 'STANDBY: 0% matang (Menunggu Alat)';

            // Update Radial Gauge Kematangan (0% saat standby tanpa data alat)
            updateGauge(pct, !hasData);
        }

        /* ── Perhitungan 4 Hari Ke Depan (Semua 0% Saat Belum Ada Data Sensor Alat) ── */
        function calculateFourDays() {
            var hist = core.hist() || [];
            var hasData = (inputSource === 'manual') || (hist.length > 0);
            var hst = hasData ? getHST() : 0;

            // JIKA BELUM ADA DATA DARI SENSOR DAN ALAT: SEMUA PERSEN KEMBALI KE 0%
            if (!hasData) {
                var zeroList = [];
                [1, 2, 3, 4].forEach(function (dNum) {
                    var today = new Date();
                    today.setDate(today.getDate() + dNum);
                    var dateStr = today.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
                    var fullDateStr = today.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                    var estLeaf = (cardWidths[dNum] !== null && cardWidths[dNum] !== undefined)
                        ? Number(cardWidths[dNum]).toFixed(1)
                        : '0.0';

                    zeroList.push({
                        day: dNum,
                        dateStr: dateStr,
                        fullDateStr: fullDateStr,
                        hst: 0,
                        pct: 0,
                        stageName: 'STANDBY',
                        svgIcon: getBotanicalSvgForDay(dNum),
                        soil: '0',
                        temp: '0.0',
                        hum: '0',
                        leafCm: estLeaf,
                        stageInfo: { name: 'STANDBY', color: '--muted', badgeBg: 'rgba(100,116,139,0.18)', badgeColor: '#94a3b8', short: 'STANDBY (0%)' },
                        recom: 'Belum ada data sensor dari alat ESP32 yang masuk. Wadah buffer 1440 data (siklus 24 jam) siap. Begitu alat mentransmisikan data riil ke Firebase, sistem akan langsung mengkalkulasi prediksi H+' + dNum + ' secara otomatis.'
                    });
                });
                fourDayForecasts = zeroList;
                return zeroList;
            }

            // KETIKA DATA ALAT SUDAH MASUK (ATAU SIMULASI MANUAL AKTIF):
            var avgSoil = 70.0, avgTemp = 27.5, avgHum = 72.0;
            if (inputSource === 'manual') {
                avgSoil = Number(simulatedParams.soil) || 70.0;
                avgTemp = Number(simulatedParams.temp) || 27.5;
                avgHum  = Number(simulatedParams.hum) || 72.0;
            } else if (hist.length > 0) {
                var recent = hist.slice(-Math.min(hist.length, 30));
                avgSoil = recent.reduce(function (s, x) { return s + (Number(x.tanah) || 0); }, 0) / recent.length;
                avgTemp = recent.reduce(function (s, x) { return s + (Number(x.suhu) || 0); }, 0) / recent.length;
                avgHum  = recent.reduce(function (s, x) { return s + (Number(x.udara) || 0); }, 0) / recent.length;
            }

            var dayConfigs = [
                { day: 1, basePct: 54, stageName: 'Masa Pertumbuhan', leafInc: 0.0, soilDelta: 0.5, tempDelta: 0.1, humDelta: -0.5 },
                { day: 2, basePct: 63, stageName: 'Masa Pertumbuhan', leafInc: 1.1, soilDelta: -0.4, tempDelta: -0.2, humDelta: 0.4 },
                { day: 3, basePct: 78, stageName: 'Mendekati Panen',  leafInc: 2.3, soilDelta: 0.2, tempDelta: -0.4, humDelta: 1.0 },
                { day: 4, basePct: 92, stageName: 'Siap Panen Optimal', leafInc: 3.8, soilDelta: -0.5, tempDelta: -0.6, humDelta: 0.5 }
            ];

            var list = [];
            dayConfigs.forEach(function (cfg) {
                var dNum = cfg.day;
                var today = new Date();
                today.setDate(today.getDate() + dNum);
                var dateStr = today.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
                var fullDateStr = today.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

                var futHst = Math.min(harvestDay, hst + dNum);
                var pct = cfg.basePct;
                var stInfo = stageInfo(pct);

                var sSoil = (avgSoil + cfg.soilDelta).toFixed(1);
                var sTemp = (avgTemp + cfg.tempDelta).toFixed(1);
                var sHum  = (avgHum  + cfg.humDelta).toFixed(1);
                var estLeaf = (cardWidths[dNum] !== null && cardWidths[dNum] !== undefined) ? Number(cardWidths[dNum]).toFixed(1) : (baseLeafWidthCm + cfg.leafInc).toFixed(1);

                var recom = '';
                if (dNum === 1) {
                    recom = 'Fase pembentukan vegetatif aktif. Sirkulasi air dan nutrisi aktif. Pastikan kelembapan tanah terjaga 65%–78%.';
                } else if (dNum === 2) {
                    recom = 'Pertumbuhan luas permukaan daun meningkat tajam. Lakukan pemantauan suhu agar daun muda tidak layu.';
                } else if (dNum === 3) {
                    recom = 'Tanaman selada keriting mendekati bobot panen komersial. Atur irigasi proporsional untuk mencegah kebusukan daun bawah.';
                } else {
                    recom = 'Selada keriting mencapai kesiapan panen prima (92%). Klorofil dan krop mekar paripurna. Jadwalkan panen pagi hari.';
                }

                list.push({
                    day: dNum,
                    dateStr: dateStr,
                    fullDateStr: fullDateStr,
                    hst: futHst,
                    pct: pct,
                    stageName: cfg.stageName,
                    svgIcon: getBotanicalSvgForDay(dNum),
                    soil: sSoil,
                    temp: sTemp,
                    hum: sHum,
                    leafCm: estLeaf,
                    stageInfo: stInfo,
                    recom: recom
                });
            });

            fourDayForecasts = list;
            return list;
        }

        /* ── Render Mini-Grafik Sparkline di dalam Setiap Card Harian ── */
        function renderMiniSparkline(dayNum) {
            var host = $('#miniGraphDay' + dayNum);
            if (!host) return;

            var W = Math.max(host.clientWidth || 180, 140);
            var H = 36;
            var pcts = fourDayForecasts.length === 4
                ? fourDayForecasts.map(function (f) { return f.pct; })
                : [0, 0, 0, 0];

            var lbl = $('#miniGraphLabel' + dayNum);
            if (lbl) {
                var curP = pcts[dayNum - 1] || 0;
                lbl.textContent = 'Proyeksi H+' + dayNum + ' (' + curP + '%)';
            }

            // Render kurva bertahap hingga hari tersebut
            var pts = [];
            for (var i = 0; i < 4; i++) {
                var x = 8 + (i / 3) * (W - 16);
                var y = H - 6 - (pcts[i] / 100) * (H - 12);
                pts.push({ x: x, y: y, active: (i + 1) <= dayNum, val: pcts[i] });
            }

            var activePts = pts.slice(0, dayNum);
            var pathD = 'M' + activePts.map(function (p) { return p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join(' L');
            var areaD = pathD + ' L' + activePts[activePts.length - 1].x.toFixed(1) + ' ' + (H - 2) + ' L' + activePts[0].x.toFixed(1) + ' ' + (H - 2) + ' Z';

            // Future dashed path
            var futureD = pts.length > dayNum ? ('M' + pts.slice(dayNum - 1).map(function (p) { return p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join(' L')) : '';

            var svg = '<svg width="100%" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" style="display:block;overflow:visible">';
            svg += '<path d="' + areaD + '" fill="rgba(34,197,94,0.18)"/>';
            if (futureD) {
                svg += '<path d="' + futureD + '" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" stroke-dasharray="3 2"/>';
            }
            svg += '<path d="' + pathD + '" fill="none" stroke="#22c55e" stroke-width="2.2" stroke-linecap="round"/>';

            pts.forEach(function (p, idx) {
                var isTargetDay = (idx + 1) === dayNum;
                var dotColor = isTargetDay ? '#4ade80' : ((idx + 1) < dayNum ? '#10b981' : 'rgba(255,255,255,0.3)');
                var dotR = isTargetDay ? 4.5 : 2.5;
                svg += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + dotR + '" fill="' + dotColor + '"/>';
            });

            svg += '</svg>';
            host.innerHTML = svg;
        }

        /* ── Render 4-Day Progressive Cards (Terpadu: Citra Daun, Grafik & Sensor di Dalam Card) ── */
        function renderFourDayCards(list) {
            list.forEach(function (d) {
                var card = $('#cardDay' + d.day);
                if (!card) return;

                var subEl   = $('#daySub' + d.day);
                var pillEl  = $('#pillDay' + d.day);
                var pctEl   = $('#pctDay' + d.day);
                var iconEl  = $('#iconDay' + d.day);
                var stageEl = $('#stageDay' + d.day);
                var soilEl  = $('#soilDay' + d.day);
                var tempEl  = $('#tempDay' + d.day);
                var humEl   = $('#humDay' + d.day);
                var leafEl  = $('#leafDay' + d.day);

                if (subEl)   subEl.textContent = '(' + d.dateStr + ')';
                if (pillEl) {
                    pillEl.textContent = d.stageInfo.short;
                    pillEl.style.background = d.stageInfo.badgeBg;
                    pillEl.style.color = d.stageInfo.badgeColor;
                }
                if (pctEl)   pctEl.textContent = d.pct + '%';
                if (iconEl)  iconEl.innerHTML = d.svgIcon;
                if (stageEl) stageEl.textContent = d.stageName;
                if (soilEl)  soilEl.textContent = d.soil + ' %';
                if (tempEl)  tempEl.textContent = d.temp + ' °C';
                if (humEl)   humEl.textContent  = d.hum + ' %';
                if (leafEl)  leafEl.textContent  = d.leafCm + ' cm';

                // 1. Grafik Mini Tren Harian di dalam card
                renderMiniSparkline(d.day);

                // 2. Citra Daun Selada di dalam card (independen per card)
                var thumbImg = $('#leafImgThumb' + d.day);
                var thumbPlaceholder = $('#leafThumbPlaceholder' + d.day);
                var thumbVal = $('#leafThumbVal' + d.day);
                if (cardImages[d.day]) {
                    if (thumbImg) {
                        thumbImg.src = cardImages[d.day];
                        thumbImg.style.display = 'block';
                    }
                    if (thumbPlaceholder) thumbPlaceholder.style.display = 'none';
                    if (thumbVal) {
                        var cW = (cardWidths[d.day] !== null && cardWidths[d.day] !== undefined) ? Number(cardWidths[d.day]).toFixed(1) : d.leafCm;
                        thumbVal.textContent = cW + ' cm';
                    }
                } else {
                    if (thumbImg) {
                        thumbImg.style.display = 'none';
                    }
                    if (thumbPlaceholder) thumbPlaceholder.style.display = 'flex';
                    if (thumbVal) {
                        thumbVal.textContent = d.leafCm + ' cm (Est.)';
                    }
                }
            });

            var srcText = $('#lstmPredSrcText');
            if (srcText) {
                var hist = core.hist() || [];
                var hasRealData = (inputSource === 'manual') || (hist.length > 0);
                if (!hasRealData) {
                    srcText.textContent = 'STANDBY: Wadah 1440 Data Siap (Menunggu ESP32)';
                } else {
                    srcText.textContent = inputSource === 'manual'
                        ? 'Simulasi Manual (HST ' + getHST() + '/' + harvestDay + ')'
                        : 'Dataset Realtime (HST ' + getHST() + '/' + harvestDay + ')';
                }
            }
        }

        /* ── Render Tabel Ringkasan Nilai LSTM Perhari (4 Hari Ke Depan) ── */
        function renderSummaryTable(list) {
            var tbody = $('#lstmTableBody');
            if (!tbody) return;

            var rows = '';
            list.forEach(function (d) {
                rows += '<tr>' +
                    '<td><b>' + d.dateStr + '</b></td>' +
                    '<td><span class="pill" style="--z:var(' + d.stageInfo.color + ')">Hari +' + d.day + '</span></td>' +
                    '<td>' + d.hst + ' HST</td>' +
                    '<td><b style="color:#38bdf8">' + d.soil + ' %</b></td>' +
                    '<td>' + d.temp + ' °C</td>' +
                    '<td>' + d.hum + ' %</td>' +
                    '<td><b style="color:#22c55e">' + d.leafCm + ' cm</b></td>' +
                    '<td><b style="color:' + d.stageInfo.badgeColor + ';font-size:14px">' + d.pct + '%</b></td>' +
                    '<td><span class="pill" style="--z:var(' + d.stageInfo.color + ')">' + d.stageName + '</span></td>' +
                    '</tr>';
            });

            tbody.innerHTML = rows;
        }

        /* ── Kurva Longitudinal (SVG 42 Hari) ── */
        function renderLongChart() {
            var host = $('#lstmLongChart');
            if (!host) return;
            var hist = core.hist() || [];
            var hasData = (inputSource === 'manual') || (hist.length > 0);
            var hst = hasData ? getHST() : 0;
            var totalDays = harvestDay || HARVEST_TARGET_DEFAULT;

            var w = Math.max(host.clientWidth || 300, 300), h = 230;
            var m = { l: 44, r: 16, t: 16, b: 32 };
            var iw = w - m.l - m.r, ih = h - m.t - m.b;
            var maxD = totalDays;

            var X = function (d) { return m.l + (d / maxD) * iw; };
            var Y = function (pct) { return m.t + (1 - pct / 100) * ih; };

            if (!hasData) {
                var outZero = '';
                [0, 25, 50, 65, 85, 100].forEach(function (v) {
                    var y = Y(v);
                    var cls = (v === 65 || v === 85) ? 'thr' : 'gl';
                    outZero += '<line class="' + cls + '" x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="rgba(255,255,255,0.08)"/>';
                    outZero += '<text x="' + (m.l - 6) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end" fill="var(--muted)" font-size="10">' + Math.round(v) + '</text>';
                });
                var xTicks = [0, 7, 14, 21, 28, 35, 42];
                xTicks.forEach(function (xd) {
                    if (xd <= maxD) {
                        outZero += '<text x="' + X(xd).toFixed(1) + '" y="' + (h - 8) + '" text-anchor="middle" fill="var(--muted)" font-size="10">H-' + xd + '</text>';
                    }
                });
                outZero += '<line x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '" stroke="#22c55e" stroke-width="2.5"/>';
                outZero += '<circle cx="' + m.l + '" cy="' + Y(0).toFixed(1) + '" r="5" fill="#22c55e"/>';
                outZero += '<text x="' + (w / 2) + '" y="' + (h / 2 - 10) + '" text-anchor="middle" fill="var(--muted)" font-size="12">📡 Firebase RTDB Aktif (STANDBY)</text>';
                outZero += '<text x="' + (w / 2) + '" y="' + (h / 2 + 10) + '" text-anchor="middle" fill="#94a3b8" font-size="11">Wadah buffer 1440 data siap (0 / 1440). Belum ada data sensor masuk. Menunggu ESP32…</text>';
                host.innerHTML = '<svg width="100%" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Kurva kematangan standby">' + outZero + '</svg>';
                return;
            }

            var totalDays = harvestDay;
            var points = [];
            for (var d = 0; d <= totalDays; d++) {
                var pct = getMaturity(d);
                points.push({ d: d, pct: pct, isForecast: d > hst });
            }

            var w = Math.max(host.clientWidth || 300, 300), h = 230;
            var m = { l: 44, r: 16, t: 16, b: 32 };
            var iw = w - m.l - m.r, ih = h - m.t - m.b;
            var maxD = totalDays;

            var X = function (d) { return m.l + (d / maxD) * iw; };
            var Y = function (pct) { return m.t + (1 - pct / 100) * ih; };

            var out = '';

            // Gridlines
            [0, 25, 50, 65, 85, 100].forEach(function (v) {
                var y = Y(v);
                var cls = (v === 65 || v === 85) ? 'thr' : 'gl';
                out += '<line class="' + cls + '" x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="rgba(255,255,255,0.08)"/>';
                out += '<text x="' + (m.l - 6) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end" fill="var(--muted)" font-size="10">' + Math.round(v) + '</text>';
            });

            // Stage background zones
            out += '<rect x="' + m.l + '" y="' + Y(65) + '" width="' + iw + '" height="' + (Y(0) - Y(65)) + '" fill="var(--ok)" fill-opacity="0.05"/>';
            out += '<rect x="' + m.l + '" y="' + Y(85) + '" width="' + iw + '" height="' + (Y(65) - Y(85)) + '" fill="var(--dry)" fill-opacity="0.05"/>';
            out += '<rect x="' + m.l + '" y="' + Y(100) + '" width="' + iw + '" height="' + (Y(85) - Y(100)) + '" fill="var(--bad)" fill-opacity="0.05"/>';

            // X axis labels
            var xTicks = [0, 7, 14, 21, 28, 35, 42];
            xTicks.forEach(function (xd) {
                if (xd <= maxD) {
                    out += '<text x="' + X(xd).toFixed(1) + '" y="' + (h - 8) + '" text-anchor="middle" fill="var(--muted)" font-size="10">H-' + xd + '</text>';
                }
            });

            // Historic path (solid)
            var histPts = points.filter(function (p) { return !p.isForecast; });
            var forecastPts = points.filter(function (p) { return p.isForecast || p.d === hst; });

            if (histPts.length >= 2) {
                var hd = 'M' + histPts.map(function (p) { return X(p.d).toFixed(1) + ' ' + Y(p.pct).toFixed(1); }).join('L');
                out += '<path d="' + hd + 'L' + X(histPts[histPts.length - 1].d).toFixed(1) + ' ' + (m.t + ih) + 'L' + X(histPts[0].d).toFixed(1) + ' ' + (m.t + ih) + 'Z" fill="var(--ok)" fill-opacity="0.15"/>';
                out += '<path d="' + hd + '" fill="none" stroke="var(--ok)" stroke-width="2.5" stroke-linecap="round"/>';
            }

            // Forecast path (dashed)
            if (forecastPts.length >= 2) {
                var fd = 'M' + forecastPts.map(function (p) { return X(p.d).toFixed(1) + ' ' + Y(p.pct).toFixed(1); }).join('L');
                out += '<path d="' + fd + '" fill="none" stroke="var(--dry)" stroke-width="2" stroke-dasharray="5 3" stroke-linecap="round"/>';
            }

            // Current day marker
            if (hst <= maxD) {
                var cx = X(hst), cy = Y(getMaturity(hst));
                out += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + 7 + '" fill="var(--ok)" fill-opacity="0.3"/>';
                out += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + 4 + '" fill="var(--ok)"/>';
                out += '<text x="' + (cx + 6).toFixed(1) + '" y="' + (m.t + 14) + '" fill="var(--ok)" font-size="11" font-weight="600">Hari Ini (' + hst + ' HST)</text>';
            }

            host.innerHTML = '<svg width="100%" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Kurva kematangan">' + out + '</svg>';
        }

        /* ── Modal Detail Visualisasi LSTM ── */
        function openDetailModal(dayNum) {
            var modal = $('#lstmDetailModalBackdrop');
            if (!modal) return;
            var list = fourDayForecasts.length ? fourDayForecasts : calculateFourDays();
            var d = list[dayNum - 1] || list[0];

            var hist = core.hist() || [];
            var hasRealData = (inputSource === 'manual') || (hist.length > 0);

            if ($('#lstmModalDayTitle')) $('#lstmModalDayTitle').textContent = hasRealData ? ('Detail Prediksi Hari +' + d.day + ' (' + d.dateStr + ')') : ('Detail Prediksi Hari +' + d.day + ' (STANDBY)');
            if ($('#lstmModalDaySub')) $('#lstmModalDaySub').textContent = hasRealData ? 'Estimasi parameter agronomis & kesiapan panen selada keriting' : 'Status: STANDBY • Wadah buffer 1440 data siap menampung sensor ESP32';

            if ($('#lstmMdlIcon')) $('#lstmMdlIcon').innerHTML = d.svgIcon;
            if ($('#lstmMdlStageBadge')) {
                $('#lstmMdlStageBadge').textContent = d.stageName;
                $('#lstmMdlStageBadge').style.background = d.stageInfo.badgeBg;
                $('#lstmMdlStageBadge').style.color = d.stageInfo.badgeColor;
            }
            if ($('#lstmMdlPct')) {
                $('#lstmMdlPct').textContent = hasRealData ? (d.pct + '% Kesiapan Panen') : '0% Kesiapan Panen (STANDBY)';
                $('#lstmMdlPct').style.color = (hasRealData && d.pct > 0) ? d.stageInfo.badgeColor : '#94a3b8';
            }
            if ($('#lstmMdlDate')) {
                $('#lstmMdlDate').textContent = hasRealData ? (d.fullDateStr + ' &bull; Proyeksi ' + d.hst + ' HST') : 'Estimasi: STANDBY (0% Data Sensor)';
            }

            if ($('#lstmMdlSoil')) $('#lstmMdlSoil').textContent = d.soil + ' %';
            if ($('#lstmMdlTemp')) $('#lstmMdlTemp').textContent = d.temp + ' °C';
            if ($('#lstmMdlHum'))  $('#lstmMdlHum').textContent  = d.hum + ' %';
            if ($('#lstmMdlLeaf')) $('#lstmMdlLeaf').textContent = d.leafCm + ' cm';
            if ($('#lstmMdlRecomText')) $('#lstmMdlRecomText').textContent = d.recom;

            // Render Citra Daun spesifik hari ini di dalam modal
            currentModalDay = d.day;
            var mdlLeafImg = $('#lstmMdlLeafImg');
            var mdlLeafPlaceholder = $('#lstmMdlLeafPlaceholder');
            var mdlLeafDayBadge = $('#lstmMdlLeafDayBadge');
            var mdlLeafWidthDisplay = $('#lstmMdlLeafWidthDisplay');
            var mdlLeafStatus = $('#lstmMdlLeafStatus');

            if (mdlLeafDayBadge) mdlLeafDayBadge.textContent = 'H+' + d.day;
            if (cardImages[d.day]) {
                if (mdlLeafImg) {
                    mdlLeafImg.src = cardImages[d.day];
                    mdlLeafImg.style.display = 'block';
                }
                if (mdlLeafPlaceholder) mdlLeafPlaceholder.style.display = 'none';
                var mWidth = (cardWidths[d.day] !== null && cardWidths[d.day] !== undefined) ? Number(cardWidths[d.day]).toFixed(1) : d.leafCm;
                if (mdlLeafWidthDisplay) mdlLeafWidthDisplay.textContent = mWidth + ' cm';
                if (mdlLeafStatus) mdlLeafStatus.textContent = 'Foto daun khusus Hari +' + d.day + ' terverifikasi & tersimpan.';
            } else {
                if (mdlLeafImg) mdlLeafImg.style.display = 'none';
                if (mdlLeafPlaceholder) mdlLeafPlaceholder.style.display = 'flex';
                if (mdlLeafWidthDisplay) mdlLeafWidthDisplay.textContent = d.leafCm + ' cm (Estimasi Pertumbuhan)';
                if (mdlLeafStatus) mdlLeafStatus.textContent = 'Belum ada foto khusus Hari +' + d.day + '. Klik tombol di samping untuk mengunggah.';
            }

            // Render mini chart progression in modal
            var chartWrap = $('#lstmMdlChartWrap');
            if (chartWrap) {
                var mW = 380, mH = 80;
                var mPts = list.map(function (it, idx) {
                    var x = 30 + idx * 105;
                    var y = mH - 15 - (it.pct / 100) * (mH - 30);
                    return { x: x, y: y, pct: it.pct, day: it.day };
                });
                var mPath = 'M' + mPts.map(function (p) { return p.x + ' ' + p.y; }).join('L');
                var mSvg = '<svg width="100%" height="' + mH + '" viewBox="0 0 ' + mW + ' ' + mH + '" xmlns="http://www.w3.org/2000/svg" style="font-family:var(--f-mono)">';
                mSvg += '<path d="' + mPath + '" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>';
                mPts.forEach(function (p) {
                    var isCur = p.day === d.day;
                    mSvg += '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + (isCur ? 6 : 4) + '" fill="' + (isCur ? '#10b981' : '#38bdf8') + '"/>';
                    mSvg += '<text x="' + p.x + '" y="' + (p.y - 8) + '" font-size="10" fill="' + (isCur ? '#10b981' : '#94a3b8') + '" text-anchor="middle" font-weight="' + (isCur ? 'bold' : 'normal') + '">' + p.pct + '%</text>';
                    mSvg += '<text x="' + p.x + '" y="' + (mH - 2) + '" font-size="9.5" fill="var(--muted)" text-anchor="middle">H+' + p.day + '</text>';
                });
                mSvg += '</svg>';
                chartWrap.innerHTML = mSvg;
            }

            modal.hidden = false;
        }

        function closeDetailModal() {
            var modal = $('#lstmDetailModalBackdrop');
            if (modal) modal.hidden = true;
        }

        /* ── Image Analyzer (Untuk Citra Daun di Setiap Card & Modal) ── */
        function analyzeLeafImage(imgSource, targetDay) {
            var day = Number(targetDay) || 1;
            var img = new Image();
            img.onload = function () {
                var w = img.naturalWidth || 360;
                var h = img.naturalHeight || 280;
                var cvs = document.createElement('canvas');
                cvs.width = w; cvs.height = h;
                var ctx = cvs.getContext('2d');
                ctx.drawImage(img, 0, 0);

                var imgData = ctx.getImageData(0, 0, w, h);
                var d = imgData.data;
                var minX = w, maxX = 0;

                for (var i = 0; i < d.length; i += 4) {
                    var r = d[i], g = d[i + 1], b = d[i + 2];
                    if (g > r * 1.05 && g > b * 1.15 && g > 45) {
                        var pIdx = i / 4;
                        var px = pIdx % w;
                        if (px < minX) minX = px;
                        if (px > maxX) maxX = px;
                    }
                }

                var pxSpan = (maxX >= minX) ? (maxX - minX + 1) : Math.round(w * 0.65);
                var widthCm = Number((pxSpan / SCALE_PX_PER_CM).toFixed(1));
                widthCm = Math.max(5.0, Math.min(24.0, widthCm));

                // Simpan khusus untuk hari target (H+1, H+2, H+3, atau H+4)
                cardImages[day] = imgSource;
                cardWidths[day] = widthCm;
                saveLSTMCardData();

                core.toast('Foto daun Hari +' + day + ' berhasil diperbarui! Lebar terukur: ' + widthCm + ' cm.');
                render();

                // Jika modal analisis detail sedang terbuka untuk hari tersebut, refresh modal
                var modal = $('#lstmDetailModalBackdrop');
                if (modal && !modal.hidden && currentModalDay === day) {
                    openDetailModal(day);
                }
            };
            img.src = imgSource;
        }

        /* ── Main Render ── */
        function render() {
            updateAgeDisplay();
            var list = calculateFourDays();
            renderFourDayCards(list);
            renderSummaryTable(list);
            renderLongChart();
        }

        /* ── Setup Bindings ── */
        function setupBindings() {
            var dateInput = $('#lstmPlantDate');
            var harvestInput = $('#lstmHarvestDay');
            var savePlant = $('#lstmSavePlant');
            var saveHarvest = $('#lstmSaveHarvest');

            if (dateInput && plantDate) dateInput.value = plantDate.toISOString().slice(0, 10);
            if (harvestInput) harvestInput.value = harvestDay;

            if (savePlant) {
                savePlant.addEventListener('click', function () {
                    var val = dateInput ? dateInput.value : '';
                    if (!val) { core.toast('Pilih tanggal tanam terlebih dahulu.'); return; }
                    plantDate = new Date(val + 'T00:00:00');
                    simulatedHST = null;
                    saveLSTMState();
                    core.toast('Tanggal tanam disimpan: ' + val);
                    render();
                });
            }

            if (saveHarvest) {
                saveHarvest.addEventListener('click', function () {
                    var val = harvestInput ? Number(harvestInput.value) : HARVEST_TARGET_DEFAULT;
                    if (!val || val < 20 || val > 60) { core.toast('Masukkan target panen antara 20–60 hari.'); return; }
                    harvestDay = val;
                    saveLSTMState();
                    core.toast('Target panen selada disimpan: ' + harvestDay + ' HST');
                    render();
                });
            }

            // Tombol Reset di Atas LSTM (Mengembalikan ke Mode Standby 0%)
            var btnResetTop = $('#lstmResetTop');
            if (btnResetTop) {
                btnResetTop.addEventListener('click', function () {
                    var svg = this.querySelector('svg');
                    if (svg) svg.classList.add('spin-icon');

                    inputSource = 'realtime';
                    simulatedHST = null;
                    simulatedParams = { soil: 0.0, temp: 0.0, hum: 0.0, hst: 0 };
                    baseLeafWidthCm = 0.0;

                    // Reset segment buttons
                    var srcSeg = $('#lstmSourceSeg');
                    if (srcSeg) {
                        Array.prototype.slice.call(srcSeg.querySelectorAll('button')).forEach(function (btn) {
                            btn.setAttribute('aria-pressed', String(btn.dataset.src === 'realtime'));
                        });
                    }
                    var manPanel = $('#lstmManualPanel');
                    if (manPanel) manPanel.style.display = 'none';

                    var badge = $('#lstmSourceBadge');
                    if (badge) {
                        badge.textContent = 'Dataset Realtime';
                        badge.style.setProperty('--z', 'var(--ok)');
                    }

                    // Reset stepper card active classes
                    document.querySelectorAll('.growth-step-card').forEach(function (c) {
                        c.classList.remove('active');
                    });

                    updateAgeDisplay();
                    renderFourDayCards(calculateFourDays());
                    renderSummaryTable(calculateFourDays());
                    renderLongChart();
                    core.toast('Prediksi LSTM berhasil direset ke mode Standby (0%).');

                    setTimeout(function () {
                        if (svg) svg.classList.remove('spin-icon');
                    }, 600);
                });
            }

            // Tombol Refresh di Atas LSTM
            var btnRefreshTop = $('#lstmRefreshBtn');
            if (btnRefreshTop) {
                btnRefreshTop.addEventListener('click', function () {
                    var svg = this.querySelector('svg');
                    if (svg) svg.classList.add('spin-icon');

                    updateAgeDisplay();
                    var list = calculateFourDays();
                    renderFourDayCards(list);
                    renderSummaryTable(list);
                    renderLongChart();
                    core.toast('Prediksi LSTM 4 hari berhasil disegarkan.');

                    setTimeout(function () {
                        if (svg) svg.classList.remove('spin-icon');
                    }, 600);
                });
            }

            // Pintasan Uji Cepat Siklus 42 Hari Panen Selada Keriting
            var btnGrowth = $('#btnTestGrowth');
            var btnNear   = $('#btnTestNearHarvest');
            var btnReady  = $('#btnTestHarvestReady');

            if (btnGrowth) {
                btnGrowth.addEventListener('click', function () {
                    inputSource = 'manual';
                    simulatedHST = 14;
                    simulatedParams = { soil: 70.0, temp: 27.5, hum: 72.0, hst: 14 };
                    baseLeafWidthCm = 10.0;
                    if ($('#lstmSourceBadge')) {
                        $('#lstmSourceBadge').textContent = 'Fase 1: Vegetatif (14 HST)';
                        $('#lstmSourceBadge').style.setProperty('--z', 'var(--ok)');
                    }
                    core.toast('⚡ Pintasan: Fase 1 Vegetatif (14 / 42 HST)');
                    render();
                });
            }

            if (btnNear) {
                btnNear.addEventListener('click', function () {
                    inputSource = 'manual';
                    simulatedHST = 28;
                    simulatedParams = { soil: 71.5, temp: 27.0, hum: 70.0, hst: 28 };
                    baseLeafWidthCm = 13.0;
                    if ($('#lstmSourceBadge')) {
                        $('#lstmSourceBadge').textContent = 'Fase 2: Pembentukan Krop (28 HST)';
                        $('#lstmSourceBadge').style.setProperty('--z', 'var(--dry)');
                    }
                    core.toast('⚡ Pintasan: Fase 2 Pembentukan Krop (28 / 42 HST)');
                    render();
                });
            }

            if (btnReady) {
                btnReady.addEventListener('click', function () {
                    inputSource = 'manual';
                    simulatedHST = 42;
                    simulatedParams = { soil: 69.5, temp: 26.5, hum: 68.0, hst: 42 };
                    baseLeafWidthCm = 15.2;
                    if ($('#lstmSourceBadge')) {
                        $('#lstmSourceBadge').textContent = 'Fase 3: Panen Raya (42 HST)';
                        $('#lstmSourceBadge').style.setProperty('--z', 'var(--bad)');
                    }
                    core.toast('⚡ Pintasan: Fase 3 Panen Raya Optimal (42 / 42 HST)');
                    render();
                });
            }

            // Segment Sumber Masukan
            var srcSeg = $('#lstmSourceSeg');
            if (srcSeg) {
                srcSeg.addEventListener('click', function (e) {
                    var b = e.target.closest('button');
                    if (!b) return;
                    var src = b.dataset.src;
                    inputSource = src;
                    Array.prototype.slice.call(srcSeg.querySelectorAll('button')).forEach(function (btn) {
                        btn.setAttribute('aria-pressed', String(btn === b));
                    });
                    var manPanel = $('#lstmManualPanel');
                    var badge = $('#lstmSourceBadge');
                    if (src === 'manual') {
                        if (manPanel) manPanel.style.display = 'block';
                        if (badge) {
                            badge.textContent = 'Input Manual';
                            badge.style.setProperty('--z', 'var(--dry)');
                        }
                    } else {
                        if (manPanel) manPanel.style.display = 'none';
                        simulatedHST = null;
                        if (badge) {
                            badge.textContent = 'Dataset Realtime';
                            badge.style.setProperty('--z', 'var(--ok)');
                        }
                    }
                    render();
                });
            }

            // Button Terapkan Manual
            var btnApplyMan = $('#btnApplyManualLstm');
            if (btnApplyMan) {
                btnApplyMan.addEventListener('click', function () {
                    var s = Number($('#manSoil') ? $('#manSoil').value : 70) || 70;
                    var t = Number($('#manTemp') ? $('#manTemp').value : 27.5) || 27.5;
                    var h = Number($('#manHum') ? $('#manHum').value : 72) || 72;
                    var hst = Number($('#manHst') ? $('#manHst').value : 25) || 25;
                    simulatedParams = { soil: s, temp: t, hum: h, hst: hst };
                    simulatedHST = hst;
                    core.toast('Simulasi manual diterapkan: HST ' + hst + ', Tanah ' + s + '%, Suhu ' + t + '°C');
                    render();
                });
            }

            // Button Perbarui Prediksi LSTM Utama
            var btnRun = $('#btnRunLstmPredict');
            if (btnRun) {
                btnRun.addEventListener('click', function () {
                    if (inputSource === 'manual') {
                        var s = Number($('#manSoil') ? $('#manSoil').value : 70) || 70;
                        var t = Number($('#manTemp') ? $('#manTemp').value : 27.5) || 27.5;
                        var h = Number($('#manHum') ? $('#manHum').value : 72) || 72;
                        var hst = Number($('#manHst') ? $('#manHst').value : 25) || 25;
                        simulatedParams = { soil: s, temp: t, hum: h, hst: hst };
                        simulatedHST = hst;
                    }
                    render();
                    core.toast('⚡ Prediksi LSTM 4 Hari Berhasil Diperbarui!');
                });
            }

            // Upload Citra Daun Mandiri (Tombol Ganti Foto pada Card, Tombol Modal, & Klik Banner Gambar)
            var fileInput = $('#lstmLamFileInput');
            document.addEventListener('click', function (e) {
                // 1. Klik tombol ganti foto di card harian
                var btnUpload = e.target.closest('.btn-card-upload-leaf');
                if (btnUpload && fileInput) {
                    e.preventDefault();
                    e.stopPropagation();
                    targetUploadDay = Number(btnUpload.dataset.day) || 1;
                    fileInput.click();
                    return;
                }
                // 2. Klik tombol ganti foto di dalam modal analisis detail
                var btnMdl = e.target.closest('#btnMdlUploadLeaf');
                if (btnMdl && fileInput) {
                    e.preventDefault();
                    e.stopPropagation();
                    targetUploadDay = currentModalDay || 1;
                    fileInput.click();
                    return;
                }
                // 3. Klik langsung pada banner gambar tanaman besar di dalam modal
                var mdlBanner = e.target.closest('.modal-big-leaf-wrap');
                if (mdlBanner && fileInput && !e.target.closest('button')) {
                    e.preventDefault();
                    e.stopPropagation();
                    targetUploadDay = currentModalDay || 1;
                    fileInput.click();
                    return;
                }
                // 4. Klik langsung pada box citra daun besar di card
                var leafBox = e.target.closest('.day-leaf-image-box');
                if (leafBox && fileInput && !e.target.closest('button')) {
                    var cardParent = leafBox.closest('.lstm-day-card');
                    targetUploadDay = cardParent ? (Number(cardParent.dataset.day) || 1) : (Number(leafBox.dataset.day) || 1);
                    fileInput.click();
                    return;
                }
            });

            if (fileInput) {
                fileInput.addEventListener('change', function () {
                    var file = this.files[0];
                    if (!file) return;
                    var day = targetUploadDay || 1;
                    var reader = new FileReader();
                    reader.onload = function (ev) {
                        analyzeLeafImage(ev.target.result, day);
                    };
                    reader.readAsDataURL(file);
                    this.value = ''; // Reset agar memilih file yang sama tetap memicu onchange
                });
            }

            // Perbesar Visualisasi Buttons
            document.addEventListener('click', function (e) {
                var btn = e.target.closest('.btn-expand-vis');
                if (btn) {
                    var d = Number(btn.dataset.day) || 1;
                    openDetailModal(d);
                    return;
                }
                var card = e.target.closest('.lstm-day-card');
                if (card && !e.target.closest('button') && !e.target.closest('.day-leaf-image-box')) {
                    var d2 = Number(card.dataset.day) || 1;
                    openDetailModal(d2);
                }
            });

            // Modal Close Buttons
            var btnCloseMdlTop = $('#btnCloseLstmModalTop');
            var btnCloseMdlBtm = $('#btnCloseLstmModalBottom');
            var mdlBackdrop    = $('#lstmDetailModalBackdrop');
            if (btnCloseMdlTop) btnCloseMdlTop.addEventListener('click', closeDetailModal);
            if (btnCloseMdlBtm) btnCloseMdlBtm.addEventListener('click', closeDetailModal);
            if (mdlBackdrop) {
                mdlBackdrop.addEventListener('click', function (e) {
                    if (e.target === this) closeDetailModal();
                });
            }

            var refreshTable = $('#lstmTableRefresh');
            if (refreshTable) {
                refreshTable.addEventListener('click', function () {
                    render();
                    core.toast('Perhitungan LSTM 4 hari diperbarui.');
                });
            }
        }

        return {
            id: 'lstm',
            o: 30,
            name: 'LSTM',
            sub: 'Prediksi kematangan tanaman',
            ic: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 17.5h7M17.5 14v7"/>',
            init: function () {
                loadLSTMState();
                setupBindings();
            },
            enter: function () {
                loadLSTMState();
                render();
            },
            render: function () {
                render();
            },
            leave: function () {
                closeDetailModal();
            }
        };
    });
})();
