// ============================================================
//  settings.js — налаштування радіо (усе в одному файлі)
//
//  localStorage: "radio.settings"
//  { radioVolume: 0-100, hymnVolume: 0-100, radioUrl: string }
//
//  Дефолти при першому запуску:
//    radioVolume = 10
//    hymnVolume  = 10
//    radioUrl    = http://91.218.212.67:8000/stream
//
//  Інші сторінки читають через:
//    RadioSettings.get()         → сирі 0–100 + url
//    RadioSettings.getRuntime()  → готове для плеєра (0–1, audioSrc)
// ============================================================

window.RadioSettings = (function () {
  const LS_KEY = 'radio.settings';

const DEFAULTS = {
  radioVolume: 10,
  hymnVolume:  10,
  radioUrl:    'http://91.218.212.67:8000/stream'  // ← тут
};

  // ---------- storage ----------
  function get() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function save(patch) {
    const merged = { ...DEFAULTS, ...get(), ...patch };
    localStorage.setItem(LS_KEY, JSON.stringify(merged));
    return merged;
  }

  // ---------- для головної сторінки ----------
  function getRuntime() {
    const s = get();
    return {
      audioSrc:    s.radioUrl,
      radioVolume: Math.min(1, Math.max(0, s.radioVolume / 100)),
      hymnVolume:  Math.min(1, Math.max(0, s.hymnVolume  / 100))
    };
  }

  return { DEFAULTS, get, save, getRuntime };
})();

// ============================================================
//  UI сторінки налаштувань
// ============================================================

(function initUI() {
  const $ = (sel) => document.querySelector(sel);

  const volRadio = $('#vol-radio');
  if (!volRadio) return; // не та сторінка

  const volRadioVal = $('#vol-radio-val');
  const volHymn     = $('#vol-hymn');
  const volHymnVal  = $('#vol-hymn-val');
  const radioUrl    = $('#radio-url');
  const btnSave     = $('#btn-save');
  const status      = $('#save-status');

  const pvSrc   = $('#pv-src');
  const pvRadio = $('#pv-radio');
  const pvHymn  = $('#pv-hymn');

  // ---------- init ----------
  const current = RadioSettings.get();

  volRadio.value = current.radioVolume;
  volRadioVal.textContent = current.radioVolume + '%';

  volHymn.value = current.hymnVolume;
  volHymnVal.textContent = current.hymnVolume + '%';

  radioUrl.value = current.radioUrl;

  updatePreview();

  // ---------- live ----------
  volRadio.addEventListener('input', () => {
    volRadioVal.textContent = volRadio.value + '%';
    updatePreview();
  });
  volHymn.addEventListener('input', () => {
    volHymnVal.textContent = volHymn.value + '%';
    updatePreview();
  });
  radioUrl.addEventListener('input', updatePreview);

  // ---------- прев’ю ----------
  function updatePreview() {
    pvSrc.textContent   = radioUrl.value.trim() || '—';
    pvRadio.textContent = (Number(volRadio.value) / 100).toFixed(2);
    pvHymn.textContent  = (Number(volHymn.value)  / 100).toFixed(2);
  }

  // ---------- save ----------
  btnSave.addEventListener('click', () => {
    RadioSettings.save({
      radioVolume: Number(volRadio.value),
      hymnVolume:  Number(volHymn.value),
      radioUrl:    radioUrl.value.trim()
    });

    status.textContent = '✓ Збережено';
    status.classList.add('show');
    setTimeout(() => status.classList.remove('show'), 1800);
  });
})();