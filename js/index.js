// ============================================================
//  index.js — головна сторінка
//  - годинник Київ
//  - відліки до увімкнення/вимкнення радіо
//  - хвилина мовчання о 9:00 (один раз на день, без повторів)
//  - дні тижня → вибір шаблону → перерви
//  - плеєр: радіо (авто) + гімн (тільки 9:00) + аварійне вимкнення
// ============================================================

const LS_TPL       = 'radio.templates';
const LS_DAYS      = 'radio.days';
const LS_HYMN_DATE = 'radio.hymnPlayedDate';

const DAYS = [
  { key: 'mon', name: 'Понеділок', en: 'Mon' },
  { key: 'tue', name: 'Вівторок',  en: 'Tue' },
  { key: 'wed', name: 'Середа',    en: 'Wed' },
  { key: 'thu', name: 'Четвер',    en: 'Thu' },
  { key: 'fri', name: "П'ятниця",  en: 'Fri' }
];

const $ = (s) => document.querySelector(s);

// ---------- storage ----------
function loadTemplates() {
  try {
    const raw = localStorage.getItem(LS_TPL);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function loadDays() {
  try {
    const raw = localStorage.getItem(LS_DAYS);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveDays(d) {
  localStorage.setItem(LS_DAYS, JSON.stringify(d));
}

function getHymnPlayedDate() {
  return localStorage.getItem(LS_HYMN_DATE);
}
function setHymnPlayedDate(date) {
  localStorage.setItem(LS_HYMN_DATE, date);
}

// ---------- дата/час Київ ----------
function kyivNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kyiv',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    weekday: 'short',
    hour12: false
  }).formatToParts(new Date());
  const p = {};
  parts.forEach(x => p[x.type] = x.value);
  return {
    h: Number(p.hour),
    m: Number(p.minute),
    s: Number(p.second),
    wd: p.weekday
  };
}

function todayString() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const p = {};
  parts.forEach(x => p[x.type] = x.value);
  return `${p.year}-${p.month}-${p.day}`;
}

function timeToSec(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 3600 + m * 60;
}

function fmtCountdown(sec) {
  if (sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = n => String(n).padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  if (m > 0) return `${pad(m)}:${pad(s)}`;
  return `${s} с`;
}

function dayKeyFromWd(wd) {
  return { Mon:'mon', Tue:'tue', Wed:'wed', Thu:'thu', Fri:'fri', Sat:'sat', Sun:'sun' }[wd] || 'mon';
}

// ---------- шаблон на сьогодні ----------
function getTodayTemplate() {
  const now = kyivNow();
  const dayKey = dayKeyFromWd(now.wd);
  const tplId = loadDays()[dayKey];
  if (!tplId) return { dayKey, tpl: null };
  const tpl = loadTemplates().find(t => t.id === tplId) || null;
  return { dayKey, tpl };
}

// ---------- відліки радіо ----------
function getRadioCountdowns() {
  const now = kyivNow();
  const nowSec = now.h * 3600 + now.m * 60 + now.s;
  const { tpl } = getTodayTemplate();

  const res = { onText: '—', onSub: '', offText: '—', offSub: '' };

  if (!tpl || !tpl.breaks.length) {
    res.onText = 'немає розкладу';
    res.offText = '—';
    return res;
  }

  const breaks = [...tpl.breaks]
    .map(b => ({ ...b, sSec: timeToSec(b.start), eSec: timeToSec(b.end) }))
    .sort((a, b) => a.sSec - b.sSec);

  const current = breaks.find(b => nowSec >= b.sSec && nowSec < b.eSec);

  if (current) {
    res.offText = `о ${current.end}`;
    res.offSub  = `через ${fmtCountdown(current.eSec - nowSec)}`;
    const nextOn = breaks.find(b => b.sSec > current.eSec);
    if (nextOn) {
      res.onText = `о ${nextOn.start}`;
      res.onSub  = `через ${fmtCountdown(nextOn.sSec - nowSec)}`;
    } else {
      res.onText = '—';
      res.onSub  = 'більше не буде';
    }
  } else {
    const nextOn = breaks.find(b => b.sSec > nowSec);
    if (nextOn) {
      res.onText = `о ${nextOn.start}`;
      res.onSub  = `через ${fmtCountdown(nextOn.sSec - nowSec)}`;
      res.offText = `о ${nextOn.end}`;
      res.offSub  = `через ${fmtCountdown(nextOn.eSec - nowSec)}`;
    } else {
      res.onText = '—';
      res.onSub  = 'перерви закінчились';
      res.offText = '—';
    }
  }

  return res;
}

// ---------- хвилина мовчання ----------
function getSilenceStatus() {
  const now = kyivNow();
  const nowSec = now.h * 3600 + now.m * 60 + now.s;

  const T9_00 = 9 * 3600;
  const T8_59 = T9_00 - 60;
  const T9_10 = T9_00 + 10 * 60;

  if (nowSec >= T8_59 && nowSec < T9_00) {
    return { value: 'Радіо стоп', sub: `через ${fmtCountdown(T9_00 - nowSec)}` };
  }
  if (nowSec >= T9_00 && nowSec < T9_10) {
    const played = getHymnPlayedDate() === todayString();
    return {
      value: played ? 'Триває' : 'Пропущено',
      sub: `до ${fmtCountdown(T9_10 - nowSec)}`
    };
  }
  let diff;
  if (nowSec < T9_00) diff = T9_00 - nowSec;
  else diff = (24 * 3600 - nowSec) + T9_00;
  return { value: 'о 9:00', sub: `через ${fmtCountdown(diff)}` };
}

// ---------- рендер годинника ----------
function renderClock() {
  const now = kyivNow();
  const pad = n => String(n).padStart(2, '0');

  $('#clock-time').textContent = `${pad(now.h)}:${pad(now.m)}:${pad(now.s)}`;

  const dayKey = dayKeyFromWd(now.wd);
  const dayName = DAYS.find(d => d.key === dayKey)?.name || '';
  $('#clock-day').textContent = dayName;

  const r = getRadioCountdowns();
  $('#radio-on').textContent = r.onText;
  $('#radio-on-sub').textContent = r.onSub;
  $('#radio-off').textContent = r.offText;
  $('#radio-off-sub').textContent = r.offSub;

  const s = getSilenceStatus();
  $('#silence-value').textContent = s.value;
  $('#silence-sub').textContent = s.sub;
}

// ---------- рендер днів ----------
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function renderDays() {
  const templates = loadTemplates();
  const daysMap = loadDays();
  const todayKey = dayKeyFromWd(kyivNow().wd);

  const container = $('#days-list');
  container.innerHTML = '';

  for (const d of DAYS) {
    const selectedId = daysMap[d.key] || '';
    const tpl = selectedId ? templates.find(t => t.id === selectedId) : null;

    const row = document.createElement('div');
    row.className = 'day-row' + (d.key === todayKey ? ' is-today' : '');

    const breaksHtml = tpl
      ? tpl.breaks.map(b => `<span class="break-chip">${b.start} — ${b.end}</span>`).join('')
      : `<span class="muted">${templates.length ? 'Оберіть шаблон' : 'Спочатку створіть шаблон на сторінці «Шаблони»'}</span>`;

    const optionsHtml = templates.map(t =>
      `<option value="${t.id}" ${t.id === selectedId ? 'selected' : ''}>${escapeHtml(t.name)}</option>`
    ).join('');

    row.innerHTML = `
      <div class="day-name">${d.name}</div>
      <select class="day-select">
        <option value="">— не вибрано —</option>
        ${optionsHtml}
      </select>
      <div class="day-breaks">${breaksHtml}</div>
    `;

    row.querySelector('.day-select').addEventListener('change', (e) => {
      const newDays = loadDays();
      if (e.target.value) newDays[d.key] = e.target.value;
      else delete newDays[d.key];
      saveDays(newDays);
      renderDays();
      renderClock();
      updatePlayerStatus();
    });

    container.appendChild(row);
  }
}

// ============================================================
//  Плеєр
//  - радіо: авто за перервами
//  - гімн: тільки в 9:00, ОДИН РАЗ на день (без повторів)
//  - аварійне вимкнення: пауза всього; при продовженні — тільки радіо
// ============================================================

const player = {
  radioEl:        null,
  hymnEl:         null,
  unlocked:       false,
  inSilence:      false,
  emergencyStop:  false,
  currentSrc:     null,
  lastSec:        null,
  pendingHymn:    false
};

function initPlayer() {
  player.radioEl = $('#radio-audio');
  player.hymnEl  = $('#hymn-audio');

  const rt = RadioSettings.getRuntime();
  player.radioEl.src = rt.audioSrc;
  player.radioEl.volume = rt.radioVolume;
  player.hymnEl.volume  = rt.hymnVolume;
  player.currentSrc = rt.audioSrc;

  // оновлення налаштувань з іншої вкладки
  window.addEventListener('storage', (e) => {
    if (e.key === 'radio.settings') {
      const rt2 = RadioSettings.getRuntime();
      if (rt2.audioSrc !== player.currentSrc) {
        player.radioEl.src = rt2.audioSrc;
        player.currentSrc = rt2.audioSrc;
      }
      player.radioEl.volume = rt2.radioVolume;
      player.hymnEl.volume  = rt2.hymnVolume;
    }
  });

  // якщо сторінку відкрито протягом першої хвилини 9:00 — поставити гімн у чергу
  const now0 = kyivNow();
  const nowSec0 = now0.h * 3600 + now0.m * 60 + now0.s;
  const T9_00 = 9 * 3600;
  const today0 = todayString();
  if (nowSec0 >= T9_00 && nowSec0 < T9_00 + 60 && getHymnPlayedDate() !== today0) {
    player.pendingHymn = true;
  }

  // розблокування звуку
  const overlay = $('#unlock-overlay');
  $('#btn-unlock').addEventListener('click', () => {
    player.unlocked = true;
    overlay.classList.add('hidden');
    player.radioEl.load();
    player.hymnEl.load();

    if (player.pendingHymn) {
      const now = kyivNow();
      const nowSec = now.h * 3600 + now.m * 60 + now.s;
      if (nowSec >= T9_00 && nowSec < T9_00 + 60) {
        setHymnPlayedDate(todayString());
        player.hymnEl.currentTime = 0;
        player.hymnEl.play().catch(() => {});
      }
      player.pendingHymn = false;
    }

    updatePlayerStatus();
  });

  $('#btn-emergency').addEventListener('click', toggleEmergency);
}

function toggleEmergency() {
  player.emergencyStop = !player.emergencyStop;

  if (player.emergencyStop) {
    // пауза всього
    if (!player.radioEl.paused) player.radioEl.pause();
    if (!player.hymnEl.paused)  player.hymnEl.pause();
  } else {
    // продовження
    const now = kyivNow();
    const nowSec = now.h * 3600 + now.m * 60 + now.s;
    const today = todayString();
    const T9_00 = 9 * 3600;
    const T8_59 = T9_00 - 60;
    const T9_10 = T9_00 + 600;

    // Якщо ми вже пройшли 9:00 сьогодні, але гімн ще не грав —
    // значить аварійка його "з'їла". Фіксуємо це: гімн сьогодні не гратиме.
    if (nowSec >= T9_00 && getHymnPlayedDate() !== today) {
      setHymnPlayedDate(today);
      player.pendingHymn = false;
    }

    // Відновлення радіо — тільки якщо не вікно тиші (8:59–9:10)
    if (nowSec < T8_59 || nowSec >= T9_10) {
      if (isInBreakNow()) {
        player.radioEl.play().catch(() => {});
      }
    }
  }

  updatePlayerStatus();
}

function updateEmergencyBtn() {
  const btn = $('#btn-emergency');
  if (player.emergencyStop) {
    btn.textContent = '▶ Продовжити';
    btn.classList.add('active');
  } else {
    btn.textContent = '⏸ Аварійне вимкнення';
    btn.classList.remove('active');
  }
}

function isInBreakNow() {
  const { tpl } = getTodayTemplate();
  if (!tpl || !tpl.breaks.length) return false;
  const now = kyivNow();
  const nowSec = now.h * 3600 + now.m * 60 + now.s;
  return tpl.breaks.some(b => {
    const s = timeToSec(b.start), e = timeToSec(b.end);
    return nowSec >= s && nowSec < e;
  });
}

function playRadio() {
  if (!player.unlocked) return;
  if (player.emergencyStop) return;
  if (player.radioEl.paused) {
    player.radioEl.play().catch(() => {
      $('#unlock-overlay').classList.remove('hidden');
    });
  }
}

function stopRadio() {
  if (!player.radioEl.paused) player.radioEl.pause();
}

function updatePlayerStatus() {
  const dot = $('#status-dot');
  const txt = $('#status-text');
  dot.className = 'status-dot';

  if (!player.unlocked) {
    txt.textContent = 'Очікування';
    return;
  }
  if (player.emergencyStop) {
    dot.classList.add('emergency');
    txt.textContent = 'Аварійно зупинено';
    return;
  }
  if (!player.hymnEl.paused) {
    dot.classList.add('silence');
    txt.textContent = 'Хвилина мовчання';
    return;
  }
  if (!player.radioEl.paused) {
    dot.classList.add('playing');
    txt.textContent = 'Грає радіо';
    return;
  }
  dot.classList.add('paused');
  txt.textContent = 'Тиша';
}

// ---------- щосекундна логіка ----------
function tickPlayer() {
  if (!player.unlocked) return;

  updateEmergencyBtn();

  const now = kyivNow();
  const nowSec = now.h * 3600 + now.m * 60 + now.s;
  const today = todayString();

  const T8_59 = 9 * 3600 - 60;
  const T9_00 = 9 * 3600;
  const T9_10 = 9 * 3600 + 600;

  // детекція переходу через 9:00:00
  const prevSec = player.lastSec;
  player.lastSec = nowSec;
  const crossing900 = prevSec !== null && prevSec < T9_00 && nowSec >= T9_00;

  // --- аварійне вимкнення ---
  if (player.emergencyStop) {
    // якщо ми пройшли 9:00 під час аварійного — гімн скасовується назавжди на сьогодні
    if (crossing900 && getHymnPlayedDate() !== today) {
      setHymnPlayedDate(today);
    }
    updatePlayerStatus();
    return;
  }

  // --- перехід через 9:00: запуск гімну (тільки один раз на день) ---
  if (crossing900 && getHymnPlayedDate() !== today && !player.pendingHymn) {
    setHymnPlayedDate(today);
    stopRadio();
    player.hymnEl.currentTime = 0;
    player.hymnEl.play().catch(() => {});
  }

  // --- 8:59–9:00: підготовка, радіо стоп ---
  if (nowSec >= T8_59 && nowSec < T9_00) {
    player.inSilence = true;
    stopRadio();
    updatePlayerStatus();
    return;
  }

  // --- 9:00–9:10: вікно тиші, радіо не грає ---
  if (nowSec >= T9_00 && nowSec < T9_10) {
    player.inSilence = true;
    stopRadio();
    updatePlayerStatus();
    return;
  }

  // --- поза вікном тиші ---
  if (player.inSilence) {
    player.inSilence = false;
    if (!player.hymnEl.paused) {
      player.hymnEl.pause();
      player.hymnEl.currentTime = 0;
    }
  }

  if (isInBreakNow()) {
    playRadio();
  } else {
    stopRadio();
  }

  updatePlayerStatus();
}

// ---------- ініціалізація ----------
function refreshAll() {
  renderClock();
  renderDays();
}

initPlayer();
refreshAll();
updateEmergencyBtn();
setInterval(() => {
  renderClock();
  tickPlayer();
}, 1000);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    renderDays();
    updatePlayerStatus();
  }
});