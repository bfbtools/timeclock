// Back Forty Builders — Time Clock front end.
// Vanilla ESM, no framework (matches the approved preview). The UI talks to the
// Netlify Functions API (/api/*). When the API isn't reachable (e.g. static
// preview before the service account exists), it falls back to demo data so the
// whole flow stays clickable — the demo badge makes that state obvious.

/* ------------------------------------------------------------------ i18n */
const I = {
  en: {
    loc: 'en-US',
    job: 'Jobsite', who: 'Who are you?', sel: 'Select your name',
    hint: 'Scanned at the jobsite • tap to start your day',
    notyou: 'Not you?', notlisted: "My name isn't here",
    cancel: 'Cancel', done: 'Done', loading: 'Loading…',
    clockIn: 'Clock In', clockOut: 'Clock Out',
    pinEnter: 'Enter your PIN', pinSet: 'Set your PIN', pinConfirm: 'Confirm your PIN',
    pinSub4: '4-digit PIN', pinSubNew: 'Pick a 4-digit PIN', pinSubAgain: 'Re-enter to confirm',
    pinWrong: 'Wrong PIN — try again', pinNoMatch: "PINs didn't match — start over",
    statusIn: "YOU'RE<br>CLOCKED IN", statusOut: "YOU'RE<br>CLOCKED OUT",
    rec_title: 'Finish your last shift',
    rec_note: 'You clocked in but never clocked out. When did you leave?',
    rec_date: 'Day you worked', rec_time: 'Clock-out time', rec_save: 'Save clock-out',
    fb_title: 'Add yourself',
    fb_note: 'New here? Add your name and set a PIN. Your rate is set by the office.',
    fb_first: 'First name', fb_last: 'Last name', fb_sub: 'Your company / sub',
    fb_subsel: 'Select', fb_save: 'Continue & set PIN',
    err: 'Something went wrong. Try again.', errName: 'Enter your first and last name.',
    errSub: 'Pick your company.', noSite: 'No jobsite in the link. Scan the QR at the site.',
  },
  es: {
    loc: 'es',
    job: 'Obra', who: '¿Quién eres?', sel: 'Selecciona tu nombre',
    hint: 'Escaneado en la obra • toca para empezar',
    notyou: '¿No eres tú?', notlisted: 'Mi nombre no está',
    cancel: 'Cancelar', done: 'Listo', loading: 'Cargando…',
    clockIn: 'Marcar Entrada', clockOut: 'Marcar Salida',
    pinEnter: 'Ingresa tu PIN', pinSet: 'Crea tu PIN', pinConfirm: 'Confirma tu PIN',
    pinSub4: 'PIN de 4 dígitos', pinSubNew: 'Elige un PIN de 4 dígitos', pinSubAgain: 'Repite para confirmar',
    pinWrong: 'PIN incorrecto — inténtalo de nuevo', pinNoMatch: 'Los PIN no coinciden — empieza de nuevo',
    statusIn: 'ENTRADA<br>REGISTRADA', statusOut: 'SALIDA<br>REGISTRADA',
    rec_title: 'Termina tu último turno',
    rec_note: 'Marcaste entrada pero no salida. ¿A qué hora te fuiste?',
    rec_date: 'Día que trabajaste', rec_time: 'Hora de salida', rec_save: 'Guardar salida',
    fb_title: 'Agrégate',
    fb_note: '¿Eres nuevo? Agrega tu nombre y crea un PIN. La oficina define tu tarifa.',
    fb_first: 'Nombre', fb_last: 'Apellido', fb_sub: 'Tu compañía / sub',
    fb_subsel: 'Selecciona', fb_save: 'Continuar y crear PIN',
    err: 'Algo salió mal. Inténtalo de nuevo.', errName: 'Escribe tu nombre y apellido.',
    errSub: 'Selecciona tu compañía.', noSite: 'No hay obra en el enlace. Escanea el QR en la obra.',
  },
};
let lang = localStorage.getItem('bfb_lang') || 'en';
const t = (k) => I[lang][k];

/* ------------------------------------------------------------------ dom */
const $ = (id) => document.getElementById(id);
const views = {
  clock: $('view-clock'), pin: $('view-pin'),
  recovery: $('view-recovery'), fallback: $('view-fallback'),
};
function show(name) {
  Object.values(views).forEach((v) => v.classList.remove('active'));
  views[name].classList.add('active');
}

/* ------------------------------------------------------------------ state */
const state = {
  site: null,          // QRParam from ?site=
  data: null,          // { project, workers, subs, demo }
  worker: null,        // selected worker
  pinMode: 'enter',    // 'enter' | 'set' | 'confirm'
  pinBuf: '',
  pinFirst: '',        // first entry during a set
};

/* ------------------------------------------------------------------ api */
const API = {
  async site(qr) {
    try {
      const r = await fetch(`/api/site?site=${encodeURIComponent(qr)}`);
      if (!r.ok) throw new Error('bad');
      return await r.json();
    } catch {
      return demoSite();
    }
  },
  async auth(payload) {
    if (state.data?.demo) return { ok: payload.newPin ? true : payload.pin === '0000' ? false : true };
    try {
      const r = await fetch('/api/auth', { method: 'POST', headers: json, body: JSON.stringify(payload) });
      return await r.json();
    } catch { return { ok: false, error: t('err') }; }
  },
  async punch(payload) {
    if (state.data?.demo) return { ok: true, at: new Date().toISOString() };
    try {
      const r = await fetch('/api/punch', { method: 'POST', headers: json, body: JSON.stringify(payload) });
      return await r.json();
    } catch { return { ok: false, error: t('err') }; }
  },
  async worker(payload) {
    if (state.data?.demo) {
      return { ok: true, worker: { id: 'demo-new', name: payload.first, sub: subName(payload.subId), type: 'employee', status: 'out', hasPin: true } };
    }
    try {
      const r = await fetch('/api/worker', { method: 'POST', headers: json, body: JSON.stringify(payload) });
      return await r.json();
    } catch { return { ok: false, error: t('err') }; }
  },
};
const json = { 'content-type': 'application/json' };

function subName(id) { return (state.data?.subs.find((s) => s.id === id) || {}).company || ''; }

/* ------------------------------------------------------------------ demo data */
function demoSite() {
  return {
    demo: true,
    project: { siteName: 'French Hill Rd — Bldg 1', qrParam: state.site || 'demo' },
    subs: [
      { id: 'SUB-SANIG', company: 'San Ignacio' },
      { id: 'SUB-SNOW', company: 'SnowPeak' },
      { id: 'SUB-LOPEZ', company: 'Lopez' },
    ],
    workers: [
      { id: 'W1', name: 'Fredy', sub: 'San Ignacio', type: 'employee', hasPin: true, status: 'out' },
      { id: 'W2', name: 'Carlos', sub: 'San Ignacio', type: 'employee', hasPin: true, status: 'in' },
      { id: 'W3', name: 'Carlito', sub: 'San Ignacio', type: 'employee', hasPin: true, status: 'out' },
      { id: 'W4', name: 'Elman', sub: 'SnowPeak', type: 'employee', hasPin: false, status: 'out' },
      { id: 'W5', name: 'Diego', sub: 'Lopez', type: 'owner', hasPin: true, status: 'out' },
      { id: 'W6', name: 'Nelson', sub: 'SnowPeak', type: 'employee', hasPin: true, status: 'in',
        openPriorDate: true, openInfo: { date: priorDayISO(), label: priorDayLabel() } },
    ],
  };
}
function priorDayISO() { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }
function priorDayLabel() { const d = new Date(); d.setDate(d.getDate() - 1); return d.toLocaleDateString(I[lang].loc, { weekday: 'long', month: 'long', day: 'numeric' }); }

/* ------------------------------------------------------------------ i18n render */
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const k = el.getAttribute('data-i18n');
    if (I[lang][k] !== undefined) el.innerHTML = I[lang][k];
  });
  $('langEn').classList.toggle('on', lang === 'en');
  $('langEs').classList.toggle('on', lang === 'es');
  document.documentElement.lang = lang;
  if (state.worker) setMainButton();
  if (state.data) renderRemembered();
  tick();
}

/* ------------------------------------------------------------------ flip clock (from approved preview) */
let paused = false;
function pad(n) { return n < 10 ? '0' + n : '' + n; }
function flip(card, val) {
  if (card.getAttribute('data-v') === val) return;
  const old = card.getAttribute('data-v'); card.setAttribute('data-v', val);
  const sTop = card.querySelector('.s-top span'), sBot = card.querySelector('.s-bot span');
  const fTop = card.querySelector('.f-top'), fBot = card.querySelector('.f-bot');
  const fTopS = fTop.querySelector('span'), fBotS = fBot.querySelector('span');
  fTopS.textContent = old; fBotS.textContent = val;
  sTop.textContent = val; sBot.textContent = old;
  fTop.style.transition = 'none'; fTop.style.transform = 'rotateX(0deg)';
  fBot.style.transition = 'none'; fBot.style.transform = 'rotateX(90deg)';
  void card.offsetWidth;
  fTop.style.transition = 'transform .26s ease-in'; fTop.style.transform = 'rotateX(-90deg)';
  setTimeout(() => { fBot.style.transition = 'transform .26s ease-out'; fBot.style.transform = 'rotateX(0deg)'; }, 260);
  setTimeout(() => {
    sBot.textContent = val;
    fTop.style.transition = 'none'; fTop.style.transform = 'rotateX(0deg)'; fTopS.textContent = val;
    fBot.style.transition = 'none'; fBot.style.transform = 'rotateX(90deg)';
  }, 540);
}
function tick() {
  if (paused) return;
  const d = new Date(); let h = d.getHours(); const m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM'; let hh = h % 12; if (hh === 0) hh = 12;
  flip($('hh'), pad(hh)); flip($('mm'), pad(m));
  $('ampm').innerHTML = ap.charAt(0) + '<br>' + ap.charAt(1);
  $('date').textContent = d.toLocaleDateString(I[lang].loc, { weekday: 'long', month: 'long', day: 'numeric' });
}

/* ------------------------------------------------------------------ identify */
function renderRemembered() {
  const rememberedId = localStorage.getItem('bfb_worker');
  const w = state.data.workers.find((x) => x.id === rememberedId);
  if (w) {
    state.worker = w;
    $('remAv').textContent = (w.name || '?').charAt(0).toUpperCase();
    $('remName').textContent = w.name;
    $('remSub').textContent = w.sub;
    $('remembered').classList.remove('hidden');
    $('selectWrap').classList.add('hidden');
    $('notYouBtn').classList.remove('hidden');
    setMainButton();
  } else {
    $('remembered').classList.add('hidden');
    $('selectWrap').classList.remove('hidden');
    $('notYouBtn').classList.add('hidden');
  }
}
function buildDropdown() {
  const sel = $('who');
  sel.querySelectorAll('option:not([data-i18n])').forEach((o) => o.remove());
  state.data.workers.forEach((w) => {
    const o = document.createElement('option');
    o.value = w.id; o.textContent = `${w.name} — ${w.sub}`;
    sel.appendChild(o);
  });
}
function setMainButton() {
  const btn = $('mainBtn'), label = $('mainBtnLabel'), icon = $('mainBtnIcon');
  if (!state.worker) {
    btn.disabled = true; btn.classList.remove('out');
    label.textContent = t('sel'); icon.textContent = 'schedule'; return;
  }
  btn.disabled = false;
  const out = state.worker.status === 'in'; // currently in → next action is OUT
  btn.classList.toggle('out', out);
  label.textContent = out ? t('clockOut') : t('clockIn');
  icon.textContent = out ? 'logout' : 'login';
}

/* ------------------------------------------------------------------ PIN */
function openPin() {
  state.pinBuf = ''; state.pinFirst = '';
  state.pinMode = state.worker.hasPin ? 'enter' : 'set';
  $('pinName').textContent = `${state.worker.name} — ${state.worker.sub}`;
  renderPin();
  show('pin');
}
function renderPin() {
  const titleMap = { enter: 'pinEnter', set: 'pinSet', confirm: 'pinConfirm' };
  const subMap = { enter: 'pinSub4', set: 'pinSubNew', confirm: 'pinSubAgain' };
  $('pinTitle').textContent = t(titleMap[state.pinMode]);
  $('pinSub').textContent = t(subMap[state.pinMode]);
  $('pinErr').textContent = '';
  updateDots();
}
function updateDots(err) {
  const dots = $('pinDots');
  dots.classList.toggle('err', !!err);
  [...dots.children].forEach((d, i) => d.classList.toggle('on', i < state.pinBuf.length));
}
function pinKey(k) {
  if (k === 'cancel') { resetToClock(); return; }
  if (k === 'del') { state.pinBuf = state.pinBuf.slice(0, -1); updateDots(); return; }
  if (state.pinBuf.length >= 4) return;
  state.pinBuf += k; updateDots();
  if (state.pinBuf.length === 4) setTimeout(submitPin, 140);
}
async function submitPin() {
  const entered = state.pinBuf;
  if (state.pinMode === 'set') {
    state.pinFirst = entered; state.pinBuf = ''; state.pinMode = 'confirm'; renderPin(); return;
  }
  if (state.pinMode === 'confirm') {
    if (entered !== state.pinFirst) {
      updateDots(true); $('pinErr').textContent = t('pinNoMatch');
      setTimeout(() => { state.pinBuf = ''; state.pinFirst = ''; state.pinMode = 'set'; renderPin(); }, 900);
      return;
    }
    const res = await API.auth({ workerId: state.worker.id, newPin: entered });
    if (!res.ok) { pinFail(res.error); return; }
    state.worker.hasPin = true;
    afterAuth(entered); return;
  }
  // enter mode
  const res = await API.auth({ workerId: state.worker.id, pin: entered });
  if (!res.ok) { pinFail(res.error || t('pinWrong')); return; }
  afterAuth(entered);
}
function pinFail(msg) {
  updateDots(true); $('pinErr').textContent = msg || t('pinWrong');
  setTimeout(() => { state.pinBuf = ''; updateDots(); $('pinErr').textContent = ''; }, 900);
}

/* ------------------------------------------------------------------ actions */
function afterAuth(pin) {
  state.authedPin = pin;
  localStorage.setItem('bfb_worker', state.worker.id);
  if (state.worker.openPriorDate) { openRecovery(); return; }
  doPunch(state.worker.status === 'in' ? 'OUT' : 'IN');
}
function openRecovery() {
  $('recDay').value = state.worker.openInfo?.label || '';
  $('recTime').value = '';
  show('recovery');
}
async function submitRecovery() {
  const time = $('recTime').value;
  if (!time) { $('recTime').focus(); return; }
  const at = `${state.worker.openInfo.date}T${time}:00`;
  const res = await API.punch({ workerId: state.worker.id, pin: state.authedPin, action: 'OUT', at, missed: true });
  if (!res.ok) { alert(res.error || t('err')); return; }
  // Prior shift closed → they are now clocked out; start today's shift.
  state.worker.openPriorDate = false; state.worker.status = 'out';
  doPunch('IN');
}
async function doPunch(action) {
  const res = await API.punch({ workerId: state.worker.id, pin: state.authedPin, action });
  if (!res.ok) { showFail(res.error); return; }
  state.worker.status = action === 'IN' ? 'in' : 'out';
  showConfirm(action, res.at);
}
function showFail(msg) { alert(msg || t('err')); resetToClock(); }

/* ------------------------------------------------------------------ confirmation */
function showConfirm(action, atIso) {
  const isIn = action === 'IN';
  const d = atIso ? new Date(atIso) : new Date();
  let h = d.getHours(); const m = d.getMinutes(); const ap = h >= 12 ? 'PM' : 'AM'; let hh = h % 12; if (hh === 0) hh = 12;
  const c = $('confirm');
  c.classList.toggle('out', !isIn);
  $('cIcon').textContent = isIn ? 'check' : 'logout';
  $('cStatus').innerHTML = isIn ? t('statusIn') : t('statusOut');
  $('cWho').textContent = state.worker.name;
  $('cStamp').textContent = `${hh}:${pad(m)} ${ap}`;
  $('cDate').textContent = d.toLocaleDateString(I[lang].loc, { weekday: 'long', month: 'long', day: 'numeric' });
  c.classList.add('show');
}
function closeConfirm() {
  $('confirm').classList.remove('show');
  resetToClock();
}

/* ------------------------------------------------------------------ fallback (my name isn't here) */
function openFallback() {
  $('fbFirst').value = ''; $('fbLast').value = '';
  const sel = $('fbSub');
  sel.querySelectorAll('option:not([data-i18n])').forEach((o) => o.remove());
  state.data.subs.forEach((s) => {
    const o = document.createElement('option'); o.value = s.id; o.textContent = s.company; sel.appendChild(o);
  });
  sel.selectedIndex = 0;
  show('fallback');
}
async function submitFallback() {
  const first = $('fbFirst').value.trim(), last = $('fbLast').value.trim(), subId = $('fbSub').value;
  if (!first || !last) { alert(t('errName')); return; }
  if (!subId) { alert(t('errSub')); return; }
  const res = await API.worker({ first, last, subId });
  if (!res.ok) { alert(res.error || t('err')); return; }
  const w = res.worker;
  state.data.workers.push(w);
  state.worker = w;
  buildDropdown();
  openPin(); // hasPin false → set-PIN flow
}

/* ------------------------------------------------------------------ reset / nav */
function resetToClock() {
  state.pinBuf = ''; state.pinFirst = ''; state.authedPin = null;
  show('clock');
  renderRemembered();
  const sel = $('who'); sel.selectedIndex = 0; sel.classList.add('empty');
  setMainButton();
}

/* ------------------------------------------------------------------ wire up */
function bind() {
  document.querySelectorAll('.lang button').forEach((b) =>
    b.addEventListener('click', () => { lang = b.dataset.lang; localStorage.setItem('bfb_lang', lang); applyI18n(); }));

  $('who').addEventListener('change', (e) => {
    const w = state.data.workers.find((x) => x.id === e.target.value);
    if (w) { state.worker = w; e.target.classList.remove('empty'); setMainButton(); }
  });
  $('notYouBtn').addEventListener('click', () => {
    localStorage.removeItem('bfb_worker'); state.worker = null;
    renderRemembered(); setMainButton();
  });
  $('mainBtn').addEventListener('click', () => { if (state.worker) openPin(); });
  $('fallbackBtn').addEventListener('click', openFallback);

  $('keypad').addEventListener('click', (e) => {
    const b = e.target.closest('.key'); if (b) pinKey(b.dataset.k);
  });

  $('recSubmit').addEventListener('click', submitRecovery);
  $('recCancel').addEventListener('click', resetToClock);
  $('fbSubmit').addEventListener('click', submitFallback);
  $('fbCancel').addEventListener('click', resetToClock);
  $('cDone').addEventListener('click', closeConfirm);
}

/* ------------------------------------------------------------------ boot */
async function boot() {
  bind();
  applyI18n();
  tick(); setInterval(tick, 1000);

  const params = new URLSearchParams(location.search);
  state.site = params.get('site');

  $('loading').classList.remove('hidden');
  state.data = await API.site(state.site || '');
  $('loading').classList.add('hidden');

  if (state.data.demo) $('demoBadge').classList.remove('hidden');
  $('siteName').textContent = state.data.project?.siteName || (lang === 'en' ? 'Unknown site' : 'Obra desconocida');

  buildDropdown();
  renderRemembered();
  setMainButton();
  applyI18n();
}
boot();
