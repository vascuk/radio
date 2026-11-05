// ============================================================
//  templates.js — шаблони розкладу перерв
//  localStorage: "radio.templates"
//  [{ id, name, breaks: [{ start, end }, ...] }, ...]
// ============================================================

const LS_KEY = 'radio.templates';
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

let templates = loadTemplates();
const editingIds = new Set();

// ---------- storage ----------
function loadTemplates() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function persist() {
  localStorage.setItem(LS_KEY, JSON.stringify(templates));
}
function uid() {
  return 'tpl_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// ---------- час ----------
// Валідний формат: HH:MM (00:00–23:59)
function isValidTime(s) {
  if (!/^\d{2}:\d{2}$/.test(s)) return false;
  const [h, m] = s.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

// Автоформат: цифри → HH:MM
function formatTime(value) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return digits.slice(0, 2) + ':' + digits.slice(2);
}

// ---------- рядок перерви ----------
// editable=false → readonly (view), editable=true → активні поля + хрестик
function createBreakRow({ start = '', end = '', editable = true } = {}) {
  const ro = editable ? '' : 'readonly';
  const row = document.createElement('div');
  row.className = 'break-row';
  row.innerHTML = `
    <input type="text" class="break-start" value="${start}" placeholder="HH:MM"
           maxlength="5" inputmode="numeric" autocomplete="off" spellcheck="false" ${ro}>
    <span class="sep">—</span>
    <input type="text" class="break-end" value="${end}" placeholder="HH:MM"
           maxlength="5" inputmode="numeric" autocomplete="off" spellcheck="false" ${ro}>
    ${editable ? '<button type="button" class="btn btn-icon btn-remove-row" title="Видалити перерву">✕</button>' : ''}
  `;
  return row;
}

function collectBreaks(container) {
  const result = [];
  for (const row of $$('.break-row', container)) {
    const s = $('.break-start', row).value.trim();
    const e = $('.break-end', row).value.trim();
    if (!s && !e) continue;
    if (!s || !e) throw new Error('Заповніть обидва поля часу');
    if (!isValidTime(s)) throw new Error(`Некоректний час початку «${s}» — формат HH:MM (напр. 08:00)`);
    if (!isValidTime(e)) throw new Error(`Некоректний час кінця «${e}» — формат HH:MM (напр. 08:10)`);
    if (e <= s) throw new Error(`Кінець (${e}) має бути пізніше початку (${s})`);
    result.push({ start: s, end: e });
  }
  return result;
}

// ---------- автоформат + авто-додавання рядка ----------
document.addEventListener('input', (e) => {
  if (!e.target.matches('.break-start, .break-end')) return;
  if (e.target.readOnly) return;

  // форматуємо
  const formatted = formatTime(e.target.value);
  if (formatted !== e.target.value) {
    e.target.value = formatted;
    try { e.target.setSelectionRange(formatted.length, formatted.length); } catch {}
  }

  // авто-додавання нового рядка, якщо обидва поля останнього рядка заповнені валідним часом
  const container = e.target.closest('.breaks-editor');
  if (!container) return;
  const rows = $$('.break-row', container);
  if (!rows.length) return;
  const last = rows[rows.length - 1];
  const s = $('.break-start', last).value;
  const en = $('.break-end', last).value;
  if (isValidTime(s) && isValidTime(en)) {
    container.appendChild(createBreakRow({ editable: true }));
  }
});

// ---------- хрестик видалення рядка ----------
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-remove-row');
  if (!btn) return;
  const row = btn.closest('.break-row');
  const container = btn.closest('.breaks-editor');
  const rows = $$('.break-row', container);
  if (rows.length <= 1) {
    $$('input', row).forEach(i => i.value = '');
  } else {
    row.remove();
  }
});

// ============================================================
//  Форма створення (завжди зверху)
// ============================================================
function resetCreateForm() {
  $('#new-name').value = '';
  const c = $('#new-breaks');
  c.innerHTML = '';
  c.appendChild(createBreakRow({ editable: true }));
}

$('#btn-create').addEventListener('click', () => {
  const name = $('#new-name').value.trim();
  if (!name) return alert('Введіть назву шаблону');

  let breaks;
  try { breaks = collectBreaks($('#new-breaks')); }
  catch (err) { return alert(err.message); }
  if (!breaks.length) return alert('Додайте хоча б одну перерву');

  templates.push({ id: uid(), name, breaks });
  persist();
  resetCreateForm();
  renderList();
});

$('#btn-reset').addEventListener('click', resetCreateForm);

// ============================================================
//  Список шаблонів
// ============================================================
function renderList() {
  const list = $('#list');
  list.innerHTML = '';
  for (const t of templates) {
    list.appendChild(renderTemplateCard(t));
  }
}

function renderTemplateCard(t) {
  const isEditing = editingIds.has(t.id);
  const card = document.createElement('div');
  card.className = 'card template-card';
  card.dataset.id = t.id;

  card.innerHTML = `
    <input type="text" class="edit-name" value="${escapeHtml(t.name)}" placeholder="Назва шаблону" ${isEditing ? '' : 'readonly'}>
    <div class="breaks-editor"></div>
    <div class="actions">
      ${isEditing
        ? `<button type="button" class="btn btn-primary btn-save">Зберегти</button>
           <button type="button" class="btn btn-ghost btn-cancel">Скасувати</button>`
        : `<button type="button" class="btn btn-secondary btn-edit">Редагувати</button>
           <button type="button" class="btn btn-danger btn-delete">Видалити</button>`
      }
    </div>
  `;

  const breaksEl = card.querySelector('.breaks-editor');
  t.breaks.forEach(b =>
    breaksEl.appendChild(createBreakRow({ start: b.start, end: b.end, editable: isEditing }))
  );
  if (isEditing) {
    breaksEl.appendChild(createBreakRow({ editable: true }));
  }

  if (isEditing) {
    card.querySelector('.btn-save').addEventListener('click', () => saveEdit(t.id, card));
    card.querySelector('.btn-cancel').addEventListener('click', () => {
      editingIds.delete(t.id);
      renderList();
    });
  } else {
    card.querySelector('.btn-edit').addEventListener('click', () => {
      editingIds.add(t.id);
      renderList();
    });
    card.querySelector('.btn-delete').addEventListener('click', () => deleteTemplate(t.id));
  }

  return card;
}

function saveEdit(id, card) {
  const t = templates.find(x => x.id === id);
  if (!t) return;

  const name = card.querySelector('.edit-name').value.trim();
  if (!name) return alert('Введіть назву шаблону');

  let breaks;
  try { breaks = collectBreaks(card.querySelector('.breaks-editor')); }
  catch (err) { return alert(err.message); }
  if (!breaks.length) return alert('Додайте хоча б одну перерву');

  t.name = name;
  t.breaks = breaks;
  persist();

  editingIds.delete(id);
  renderList();
}

function deleteTemplate(id) {
  if (!confirm('Видалити цей шаблон?')) return;
  templates = templates.filter(x => x.id !== id);
  editingIds.delete(id);
  persist();
  renderList();
}

// ---------- init ----------
resetCreateForm();
renderList();