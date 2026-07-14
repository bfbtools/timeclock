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
    hint: 'Scanned at the Jobsite • Tap to Start Your Workday',
    hintOut: 'Scanned at the Jobsite • Tap to End Your Workday',
    notyou: 'Not you?', notlisted: "My name isn't here",
    cancel: 'Cancel', done: 'Done', loading: 'Loading…',
    clockIn: 'Clock In', clockOut: 'Clock Out',
    pinEnter: 'Enter your PIN', pinSet: 'Set your PIN', pinConfirm: 'Confirm your PIN',
    pinSub4: '4-digit PIN', pinSubNew: 'Pick a 4-digit PIN', pinSubAgain: 'Re-enter to confirm',
    pinWrong: 'Wrong PIN — try again', pinNoMatch: "PINs didn't match — start over",
    statusIn: "YOU'RE<br>CLOCKED IN", statusOut: "YOU'RE<br>CLOCKED OUT",
    rec_done_note: "We closed your unfinished shift from {day}. You've now started a NEW shift at {site} — remember to clock out when you leave.",
    switchJobShort: 'Switch Jobsite',
    sw_scanTo: "Scan the QR at the jobsite you're switching to.",
    sw_already: "You're already clocked in at this jobsite.",
    wrongTitle: 'Wrong jobsite code',
    wrongMsg: "You're clocked in at {open}, but this code is for {scanned}. Scan {open}'s QR code to clock out.",
    wrongTip: 'Clock out — or switch jobsites — before you leave a site.',
    scanAgain: 'Scan Again',
    rec_title: 'Finish your last shift',
    rec_note: 'You clocked in but never clocked out. When did you leave?',
    rec_date: 'Day you worked', rec_time: 'Clock-out time', rec_save: 'Save clock-out',
    fb_title: 'Add yourself',
    fb_note: 'New here? Add your name and set a PIN. Your rate is set by the office.',
    fb_first: 'First name', fb_last: 'Last name', fb_sub: 'Your company / sub',
    fb_subsel: 'Select', fb_save: 'Continue & set PIN',
    scan_title: 'Scan Jobsite QR Code', scan_hint: 'Point your camera at the QR posted at the jobsite.',
    scan_nocam: "Can't open the camera. Allow camera access, or use your phone's camera app to scan the QR.",
    scan_bad: "That code isn't a BFB jobsite QR. Try the one posted at the site.",
    myhours: 'View my hours', viewInvoice: 'View Invoice Draft', logout: 'Log Out', back: 'Back',
    tl_title: 'My time', tl_locked: 'Locked — the week closed Sunday',
    tl_total: 'Current Week Total', tl_add: 'Add a missed punch', weekTotal: 'Week Total', todayTotal: 'Today Total',
    tl_submit: 'Submit Edits', tl_addHours: 'Add Hours',
    editsSubmitted: 'EDITS<br>SUBMITTED',
    warn_edit: 'Heads up — repeated manual edits are reviewed. Please clock in with the jobsite QR when you can.',
    block_edit: 'Too many manual edits at once. Call the office for approval: 314-598-7226',
    ap_title: 'Add a missed punch', ap_edit: 'Edit punch',
    ap_note: 'This will be flagged as a manual entry for the office to review.',
    ap_which: 'Clock in or out?', ap_site: 'Jobsite', ap_day: 'Day', ap_time: 'Time', ap_save: 'Save',
    ap_in: 'Clock In', ap_out: 'Clock Out',
    ap_editIn: 'Edit Clock In', ap_editOut: 'Edit Clock Out',
    removePunch: 'Remove Punch', removeConfirmTitle: 'Remove this punch?',
    removeConfirmMsg: "This deletes the entry and can't be undone.", removeYes: 'Remove',
    apMissingBoth: 'Enter both a clock-in and a clock-out time.',
    apOrder: 'Clock-out must be after clock-in.',
    atSite: 'at', tapEdit: 'Tap a punch to fix its time',
    inv_title: 'Invoice draft', inv_total: 'Total', inv_hint: 'Draft • auto-sends Sunday night',
    invEmpty: 'No hours logged this week yet.', pickFirst: 'Pick your name first.',
    apMissing: 'Enter a time.', locale: 'en-US',
    mat_title: 'Materials?', mat_note: 'Bought materials for this job today? Add them here. Optional.',
    mat_amount: 'Amount ($)', mat_noteL: 'Note (optional)', mat_receipt: 'Receipt photo (optional)',
    mat_save: 'Save & clock out', mat_skip: 'Skip & clock out',
    mat_saveSwitch: 'Save & switch', mat_skipSwitch: 'Skip & switch',
    choice_clockTitle: 'Clock Out', choice_switchTitle: 'Switch Jobsite',
    choice_note: 'Add materials for this jobsite, or continue.',
    clockOutNoMat: 'Clock Out Without Materials', switchNoMat: 'Switch Without Materials',
    switchJob: 'Switch Jobsite',
    sw_note: "You'll clock out here and clock in at the site you pick — your time keeps running.",
    sw_site: 'New jobsite', sw_confirm: 'Switch Jobsite',
    sw_none: 'No other active jobsites to switch to.',
    editHoursMat: 'Edit Hours & Materials',
    team_title: 'My Team', team_note: 'Tap a person to fix their hours. Add materials below.',
    addMaterials: 'Add Materials', matAmountNeeded: 'Enter a materials amount.',
    changeRate: 'Change my pay rate', rate_title: 'Your pay rate',
    rate_note: 'What BFB pays you per hour. Changes are logged and the office is notified.',
    rate_new: 'New rate ($/hr)', rate_save: 'Save rate', rateSaved: 'Rate updated.',
    rateBad: 'Enter a valid rate.',
    err: 'Something went wrong. Try again.', errName: 'Enter your first and last name.',
    errSub: 'Pick your company.', noSite: 'Scan Jobsite QR Code to Clock In.',
    noSiteOut: 'Scan Jobsite QR Code to Clock Out.',
    noSiteShort: 'Scan the jobsite QR',
  },
  es: {
    loc: 'es',
    job: 'Obra', who: '¿Quién eres?', sel: 'Selecciona tu nombre',
    hint: 'Escaneado en la obra • Toca para empezar tu jornada',
    hintOut: 'Escaneado en la obra • Toca para terminar tu jornada',
    notyou: '¿No eres tú?', notlisted: 'Mi nombre no está',
    cancel: 'Cancelar', done: 'Listo', loading: 'Cargando…',
    clockIn: 'Marcar Entrada', clockOut: 'Marcar Salida',
    pinEnter: 'Ingresa tu PIN', pinSet: 'Crea tu PIN', pinConfirm: 'Confirma tu PIN',
    pinSub4: 'PIN de 4 dígitos', pinSubNew: 'Elige un PIN de 4 dígitos', pinSubAgain: 'Repite para confirmar',
    pinWrong: 'PIN incorrecto — inténtalo de nuevo', pinNoMatch: 'Los PIN no coinciden — empieza de nuevo',
    statusIn: 'ENTRADA<br>REGISTRADA', statusOut: 'SALIDA<br>REGISTRADA',
    rec_done_note: 'Cerramos tu turno sin salida del {day}. Ahora empezaste un NUEVO turno en {site} — recuerda marcar salida al irte.',
    switchJobShort: 'Cambiar de obra',
    sw_scanTo: 'Escanea el código QR de la obra a la que vas a cambiar.',
    sw_already: 'Ya tienes tu entrada en esta obra.',
    wrongTitle: 'Código de obra equivocado',
    wrongMsg: 'Tienes tu entrada en {open}, pero este código es de {scanned}. Escanea el código QR de {open} para marcar salida.',
    wrongTip: 'Marca salida — o cambia de obra — antes de dejar una obra.',
    scanAgain: 'Escanear de nuevo',
    rec_title: 'Termina tu último turno',
    rec_note: 'Marcaste entrada pero no salida. ¿A qué hora te fuiste?',
    rec_date: 'Día que trabajaste', rec_time: 'Hora de salida', rec_save: 'Guardar salida',
    fb_title: 'Agrégate',
    fb_note: '¿Eres nuevo? Agrega tu nombre y crea un PIN. La oficina define tu tarifa.',
    fb_first: 'Nombre', fb_last: 'Apellido', fb_sub: 'Tu compañía / sub',
    fb_subsel: 'Selecciona', fb_save: 'Continuar y crear PIN',
    scan_title: 'Escanear Código QR de Obra', scan_hint: 'Apunta la cámara al QR colocado en la obra.',
    scan_nocam: 'No se puede abrir la cámara. Permite el acceso o usa la app de cámara de tu teléfono para escanear.',
    scan_bad: 'Ese código no es un QR de obra BFB. Usa el que está colocado en la obra.',
    myhours: 'Ver mis horas', viewInvoice: 'Ver borrador de factura', logout: 'Cerrar sesión', back: 'Atrás',
    tl_title: 'Mi tiempo', tl_locked: 'Cerrado — la semana terminó el domingo',
    tl_total: 'Total semana actual', tl_add: 'Agregar marca olvidada', weekTotal: 'Total semana', todayTotal: 'Total de hoy',
    tl_submit: 'Enviar cambios', tl_addHours: 'Agregar horas',
    editsSubmitted: 'CAMBIOS<br>ENVIADOS',
    warn_edit: 'Atención — las ediciones manuales se revisan. Por favor marca con el código QR de la obra cuando puedas.',
    block_edit: 'Demasiadas ediciones manuales a la vez. Llama a la oficina para aprobación: 314-598-7226',
    ap_title: 'Agregar marca olvidada', ap_edit: 'Editar marca',
    ap_note: 'Se marcará como entrada manual para que la oficina la revise.',
    ap_which: '¿Entrada o salida?', ap_site: 'Obra', ap_day: 'Día', ap_time: 'Hora', ap_save: 'Guardar',
    ap_in: 'Entrada', ap_out: 'Salida',
    ap_editIn: 'Editar entrada', ap_editOut: 'Editar salida',
    removePunch: 'Eliminar marca', removeConfirmTitle: '¿Eliminar esta marca?',
    removeConfirmMsg: 'Esto borra la entrada y no se puede deshacer.', removeYes: 'Eliminar',
    apMissingBoth: 'Ingresa la hora de entrada y de salida.',
    apOrder: 'La salida debe ser después de la entrada.',
    atSite: 'en', tapEdit: 'Toca una marca para corregir la hora',
    inv_title: 'Borrador de factura', inv_total: 'Total', inv_hint: 'Borrador • se envía el domingo por la noche',
    invEmpty: 'Aún no hay horas esta semana.', pickFirst: 'Selecciona tu nombre primero.',
    apMissing: 'Ingresa una hora.', locale: 'es',
    mat_title: '¿Materiales?', mat_note: '¿Compraste materiales para esta obra hoy? Agrégalos aquí. Opcional.',
    mat_amount: 'Monto ($)', mat_noteL: 'Nota (opcional)', mat_receipt: 'Foto del recibo (opcional)',
    mat_save: 'Guardar y marcar salida', mat_skip: 'Omitir y marcar salida',
    mat_saveSwitch: 'Guardar y cambiar', mat_skipSwitch: 'Omitir y cambiar',
    choice_clockTitle: 'Marcar Salida', choice_switchTitle: 'Cambiar de obra',
    choice_note: 'Agrega materiales para esta obra, o continúa.',
    clockOutNoMat: 'Marcar salida sin materiales', switchNoMat: 'Cambiar sin materiales',
    switchJob: 'Cambiar de obra',
    sw_note: 'Marcarás salida aquí y entrada en la obra que elijas — tu tiempo sigue corriendo.',
    sw_site: 'Nueva obra', sw_confirm: 'Cambiar de obra',
    sw_none: 'No hay otras obras activas para cambiar.',
    editHoursMat: 'Editar horas y materiales',
    team_title: 'Mi equipo', team_note: 'Toca a una persona para corregir sus horas. Agrega materiales abajo.',
    addMaterials: 'Agregar materiales', matAmountNeeded: 'Ingresa un monto de materiales.',
    changeRate: 'Cambiar mi tarifa', rate_title: 'Tu tarifa',
    rate_note: 'Lo que BFB te paga por hora. Los cambios se registran y se notifica a la oficina.',
    rate_new: 'Nueva tarifa ($/hr)', rate_save: 'Guardar tarifa', rateSaved: 'Tarifa actualizada.',
    rateBad: 'Ingresa una tarifa válida.',
    err: 'Algo salió mal. Inténtalo de nuevo.', errName: 'Escribe tu nombre y apellido.',
    errSub: 'Selecciona tu compañía.', noSite: 'Escanea el código QR de la obra para marcar entrada.',
    noSiteOut: 'Escanea el código QR de la obra para marcar salida.',
    noSiteShort: 'Escanea el QR de la obra',
  },
};
let lang = localStorage.getItem('bfb_lang') || 'es'; // gate is shown until a choice is made
const langChosen = () => localStorage.getItem('bfb_lang') !== null;
const t = (k) => I[lang][k];
function chooseLang(l) { lang = l; localStorage.setItem('bfb_lang', l); applyI18n(); }

/* ------------------------------------------------------------------ dom */
const $ = (id) => document.getElementById(id);
const views = {
  clock: $('view-clock'), pin: $('view-pin'),
  recovery: $('view-recovery'), fallback: $('view-fallback'),
  timelog: $('view-timelog'), addpunch: $('view-addpunch'), invoice: $('view-invoice'),
  materials: $('view-materials'), rate: $('view-rate'), scan: $('view-scan'),
  switch: $('view-switch'), team: $('view-team'), choice: $('view-choice'), lang: $('view-lang'),
  wrongsite: $('view-wrongsite'),
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
  intent: 'clock',     // 'clock' | 'secondary' | 'addpunch' | 'switch'
  timelog: null,       // last-loaded time log (for the add-punch day list)
  apAction: 'IN',
  switchTo: null,      // destination QRParam while switching jobsites
  matMode: 'clockout', // 'clockout' | 'switch' | 'day' | 'team' — where Materials came from
  matDate: null,       // day a per-day material attaches to
  choiceMode: 'clockout', // 'clockout' | 'switch' — the clock-out/switch choice screen
  editTarget: null,    // worker whose Time Log is shown (self, or a crew member for owners)
  editReturn: 'clock', // where the Time Log "Back" goes: 'clock' | 'invoice' | 'team'
  showDayMaterials: false, // per-day "Add Materials" button in the Time Log (independent)
  team: null,          // last-loaded team roster (owner)
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
      const r = await fetch('/api/punch', { method: 'POST', headers: json, body: JSON.stringify({ site: state.site, ...payload }) });
      return await r.json();
    } catch { return { ok: false, error: t('err') }; }
  },
  async punchEdit(payload) {
    if (state.data?.demo) return { ok: true };
    try {
      const r = await fetch('/api/punch-edit', { method: 'POST', headers: json, body: JSON.stringify(payload) });
      return await r.json();
    } catch { return { ok: false, error: t('err') }; }
  },
  async punchDelete(payload) {
    if (state.data?.demo) return { ok: true };
    try {
      const r = await fetch('/api/punch-delete', { method: 'POST', headers: json, body: JSON.stringify(payload) });
      return await r.json();
    } catch { return { ok: false, error: t('err') }; }
  },
  async worker(payload) {
    if (state.data?.demo) {
      // hasPin:false so a self-added worker goes through the set-PIN flow, matching
      // the real /api/worker (netlify/functions/worker.js), not the enter-PIN flow.
      return { ok: true, worker: { id: 'demo-new', name: [payload.first, payload.last].filter(Boolean).join(' '), sub: subName(payload.subId), type: 'employee', status: 'out', hasPin: false } };
    }
    try {
      const r = await fetch('/api/worker', { method: 'POST', headers: json, body: JSON.stringify(payload) });
      return await r.json();
    } catch { return { ok: false, error: t('err') }; }
  },
  // targetId = whose log; actingId = who's authenticated (owner may edit crew).
  async timelog(targetId, actingId, pin) {
    if (state.data?.demo) return demoTimelog(targetId);
    try {
      const q = `workerId=${encodeURIComponent(targetId)}&actingId=${encodeURIComponent(actingId)}&pin=${encodeURIComponent(pin)}`;
      const r = await fetch(`/api/timelog?${q}`);
      return await r.json();
    } catch { return { ok: false, error: t('err') }; }
  },
  async team(ownerId, pin) {
    if (state.data?.demo) return demoTeam();
    try {
      const r = await fetch(`/api/team?ownerId=${encodeURIComponent(ownerId)}&pin=${encodeURIComponent(pin)}`);
      return await r.json();
    } catch { return { ok: false, error: t('err') }; }
  },
  async invoice(workerId, pin) {
    if (state.data?.demo) return demoInvoice();
    try {
      const r = await fetch(`/api/invoice?workerId=${encodeURIComponent(workerId)}&pin=${encodeURIComponent(pin)}`);
      return await r.json();
    } catch { return { ok: false, error: t('err') }; }
  },
  async material(payload) {
    if (state.data?.demo) return { ok: true };
    try {
      const r = await fetch('/api/material', { method: 'POST', headers: json, body: JSON.stringify({ ...payload, site: state.site }) });
      return await r.json();
    } catch { return { ok: false, error: t('err') }; }
  },
  async switchJob(payload) {
    if (state.data?.demo) {
      const s = (state.data.sites || []).find((x) => x.qrParam === payload.toSite);
      return { ok: true, at: new Date().toISOString(), site: s ? s.siteName : '' };
    }
    try {
      const r = await fetch('/api/switch', { method: 'POST', headers: json, body: JSON.stringify(payload) });
      return await r.json();
    } catch { return { ok: false, error: t('err') }; }
  },
  async rate(payload) {
    if (state.data?.demo) return { ok: true, newRate: payload.newRate };
    try {
      const r = await fetch('/api/rate', { method: 'POST', headers: json, body: JSON.stringify(payload) });
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
    sites: [
      { qrParam: 'french1', siteName: 'French Hill Rd — Bldg 1' },
      { qrParam: 'campjohnson', siteName: 'Camp Johnson' },
      { qrParam: 'appletree', siteName: 'Apple Tree Learning Center' },
    ],
    workers: [
      // Three test types for the demo: Employee (Time Log), Sub/Owner (Invoice),
      // Independent Sub (Invoice).
      { id: 'W1', name: 'Fredy (Employee)', sub: 'San Ignacio', type: 'employee', hasPin: true, status: 'out', todayHours: 8, weekHours: 32 },
      { id: 'W5', name: 'Diego (Sub/Owner)', sub: 'Diego Exterior LLC', type: 'owner', hasPin: true, status: 'out', todayHours: 0, weekHours: 18.5 },
      { id: 'W7', name: 'Sofia (Independent)', sub: 'Sofia Drywall', type: 'independent', hasPin: true, status: 'out', todayHours: 4, weekHours: 22 },
      { id: 'W2', name: 'Carlos', sub: 'San Ignacio', type: 'employee', hasPin: true, status: 'in', todayHours: 6.25, weekHours: 24.25 },
      { id: 'W3', name: 'Carlito', sub: 'San Ignacio', type: 'employee', hasPin: true, status: 'out', todayHours: 0, weekHours: 40 },
      { id: 'W4', name: 'Elman', sub: 'SnowPeak', type: 'employee', hasPin: false, status: 'out', todayHours: 0, weekHours: 0 },
      { id: 'W6', name: 'Nelson', sub: 'SnowPeak', type: 'employee', hasPin: true, status: 'in', todayHours: 5, weekHours: 16,
        openPriorDate: true, openInfo: { date: priorDayISO(), label: priorDayLabel() } },
    ],
  };
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function priorDayISO() { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }
function priorDayLabel() { const d = new Date(); d.setDate(d.getDate() - 1); return d.toLocaleDateString(I[lang].loc, { weekday: 'long', month: 'long', day: 'numeric' }); }
function weekMondayISO() { const d = new Date(); const delta = (d.getDay() + 6) % 7; d.setDate(d.getDate() - delta); return d.toISOString().slice(0, 10); }
function addDaysISO(iso, n) { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function datesInclusive(a, b) { const out = []; let d = a; while (d <= b) { out.push(d); d = addDaysISO(d, 1); } return out; }
// Demo team roster for a Sub/Owner (self + crew).
function demoTeam() {
  return {
    ok: true,
    members: [
      { id: 'W5', name: 'Diego', type: 'owner', self: true, weekHours: 18.5, todayHours: 0 },
      { id: 'WC1', name: 'Mateo', type: 'employee', weekHours: 40, todayHours: 8 },
      { id: 'WC2', name: 'Luis', type: 'employee', weekHours: 22.5, todayHours: 0 },
    ],
  };
}
function demoTimelog(target) {
  const w = target || { id: 'W1', name: 'Fredy', type: 'employee' };
  // Rolling 14-day window ending today; a few worked days, the rest empty
  // (so the "Add Hours" buttons and scroll are exercised).
  const end = todayISO(), start = addDaysISO(end, -13);
  const worked = {
    [addDaysISO(end, -1)]: { hours: 8, punches: [
      { id: 'P-d1', time: '07:00', action: 'IN', manual: false, edited: false },
      { id: 'P-d2', time: '15:00', action: 'OUT', manual: false, edited: false }] },
    [addDaysISO(end, -2)]: { hours: 8.25, punches: [
      { id: 'P-d3', time: '07:15', action: 'IN', manual: false, edited: false },
      { id: 'P-d4', time: '15:30', action: 'OUT', manual: true, edited: true }] },
    [addDaysISO(end, -3)]: { hours: 4, punches: [
      { id: 'P-d5', time: '08:00', action: 'IN', manual: false, edited: false },
      { id: 'P-d6', time: '12:00', action: 'OUT', manual: false, edited: false }] },
  };
  const weekMon = weekMondayISO();
  let total = 0, weekTotal = 0;
  const days = [];
  for (let i = 0; i < 14; i++) {
    const date = addDaysISO(start, i);
    const w = worked[date];
    if (w) { total += w.hours; if (date >= weekMon) weekTotal += w.hours; }
    days.push(w ? { date, hours: w.hours, unpaired: 0, punches: w.punches } : { date, hours: 0, unpaired: 0, punches: [] });
  }
  days.reverse(); // newest first, matching the backend
  return {
    ok: true, worker: { id: w.id, name: String(w.name).replace(/\s*\(.*\)$/, ''), type: w.type },
    weekStart: start, weekEnd: end, windowStart: start, windowEnd: end,
    locked: false, weekHours: Math.round(total * 100) / 100,
    currentWeekHours: Math.round(weekTotal * 100) / 100, flags: [],
    days,
  };
}
function demoInvoice() {
  const ws = weekMondayISO(), we = addDaysISO(ws, 6); // Mon–Sun
  const w = state.worker || { name: 'Diego', sub: 'Diego Exterior LLC', type: 'owner' };
  const firstName = String(w.name).replace(/\s*\(.*\)$/, ''); // strip the "(Owner)" demo tag
  // Owner (company sub) shows multiple worker lines; independent shows just self.
  const workerLines = w.type === 'owner'
    ? [{ worker: firstName, hours: 24, rate: 55, amount: 1320 }, { worker: 'Mateo', hours: 16, rate: 50, amount: 800 }]
    : [{ worker: firstName, hours: 24, rate: 55, amount: 1320 }];
  const laborTotal = workerLines.reduce((s, l) => s + l.amount, 0);
  return {
    ok: true, invoice: {
      company: w.sub, subId: 'demo', weekStart: ws, weekEnd: we,
      projects: [{
        projectId: 'PRJ_A', name: 'French Hill Rd — Bldg 1', hours: workerLines.reduce((s, l) => s + l.hours, 0), rate: w.type === 'owner' ? null : 55, amount: laborTotal,
        perDay: [{ date: ws, hours: 8 }, { date: addDaysISO(ws, 1), hours: 8 }, { date: addDaysISO(ws, 2), hours: 8 }],
      }],
      workerLines,
      laborTotal, materials: [{ amount: 145.30, note: 'fasteners + blades', project: 'PRJ_A' }],
      materialsTotal: 145.30, total: laborTotal + 145.30, flags: [],
    },
  };
}

/* ------------------------------------------------------------------ i18n render */
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const k = el.getAttribute('data-i18n');
    if (I[lang][k] !== undefined) el.innerHTML = I[lang][k];
  });
  $('langEn').classList.toggle('on', lang === 'en');
  $('langEs').classList.toggle('on', lang === 'es');
  document.documentElement.lang = lang;
  if (state.data) updateAuthLinks(); // secondary/fallback labels are dynamic
  if (state.worker) setMainButton();
  if (state.data) { renderRemembered(); updateSiteName(); }
  // Re-render whatever dynamic screen is open so it picks up the new language.
  if (views.timelog.classList.contains('active') && state.timelog) renderTimeLog(state.timelog);
  if (views.invoice.classList.contains('active') && state.invoiceData) renderInvoice(state.invoiceData);
  tick();
}

// Jobsite banner text — depends on language, so re-run on every language change.
function updateSiteName() {
  if (!state.data) return;
  // At the scan-home, prompt for the next action: clock OUT if they're on the
  // clock, otherwise clock IN.
  const noSiteMsg = (state.worker && state.worker.status === 'in') ? t('noSiteOut') : t('noSite');
  $('siteName').textContent = state.data.project?.siteName
    || (state.noSite ? noSiteMsg : (lang === 'en' ? 'Unknown site' : 'Obra desconocida'));
  // With no jobsite, the card becomes a tappable "scan the QR" button (camera icon).
  $('jobsiteCard').classList.toggle('scannable', state.noSite);
  $('jobsiteIcon').textContent = state.noSite ? 'photo_camera' : 'distance';
}
// The gray X on the jobsite card: drop the scanned site and return to the
// "scan a QR code" state so a different code can be scanned.
function clearJobsite() {
  state.site = null;
  if (state.data) state.data.project = null;
  state.noSite = true;
  updateSiteName();
  setMainButton();
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
// "Today Total: Xh" (left) and "Week Total: Xh" (right) under the flip clock,
// for the selected/remembered worker (from the roster). Hidden with no worker.
// Decimal hours → human "Xh Ym" (e.g. 0.79 → "47m", 8.5 → "8h 30m", 8 → "8h").
// Workers read the clock/Time Log totals; "0.79h" gets misread as minutes.
function fmtHrs(hours) {
  const totalMin = Math.round((Number(hours) || 0) * 60);
  if (!totalMin) return '0h';
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  return (h ? `${h}h` : '') + (h && m ? ' ' : '') + (m ? `${m}m` : '');
}
function updateWeekTotal() {
  const wk = $('weekTotal'), td = $('todayTotal');
  const w = state.worker;
  if (w && typeof w.weekHours === 'number') {
    wk.textContent = `${t('weekTotal')}: ${fmtHrs(w.weekHours)}`; wk.classList.remove('hidden');
  } else { wk.classList.add('hidden'); wk.textContent = ''; }
  if (w && typeof w.todayHours === 'number') {
    td.textContent = `${t('todayTotal')}: ${fmtHrs(w.todayHours)}`; td.classList.remove('hidden');
  } else { td.classList.add('hidden'); td.textContent = ''; }
}
// The secondary link says "View Invoice Draft" for owners/independents and
// "View my hours" for employees. The fallback link is "My name isn't here" when
// logged out, and "Log Out" once a worker is remembered on the device.
function updateAuthLinks() {
  const type = state.worker && state.worker.type;
  $('secondaryBtn').textContent = (type === 'owner' || type === 'independent') ? t('viewInvoice') : t('myhours');
  // Once a worker is identified (picked or remembered), show "Log Out"; the
  // "My name isn't here" fallback is only for the no-worker (logged-out) screen.
  const loggedIn = !!state.worker;
  const fb = $('fallbackBtn');
  fb.textContent = loggedIn ? t('logout') : t('notlisted');
  fb.dataset.mode = loggedIn ? 'logout' : 'fallback';
}
function logout() {
  localStorage.removeItem('bfb_worker');
  state.worker = null;
  const sel = $('who'); if (sel) { sel.selectedIndex = 0; sel.classList.add('empty'); }
  renderRemembered(); setMainButton();
  show('clock');
}
function setMainButton() {
  const btn = $('mainBtn'), label = $('mainBtnLabel'), icon = $('mainBtnIcon');
  updateWeekTotal();
  updateAuthLinks();
  // Hide the jobsite "X" (clear/re-scan) while clocked in: re-scanning mid-shift
  // is what "Switch to Different Jobsite" is for, and clearing here would strand
  // them at scan-home while still on the clock. The X still shows before you
  // clock in, so a mistaken scan can be corrected then.
  $('jobsiteCard').classList.toggle('clocked-in', !!(state.worker && state.worker.status === 'in'));
  $('switchBtn').classList.add('hidden'); // shown only in the clocked-in branch below
  if (state.noSite) {
    btn.disabled = true; btn.classList.remove('out');
    label.textContent = t('noSiteShort'); icon.textContent = 'qr_code_scanner';
    $('hint').textContent = ''; // no "tap to start/end your workday" line at the scan-home
    // At the scan-home, a clocked-in worker can still switch jobsites: the button
    // opens the scanner so they scan the site they're moving to (see switchBtn).
    const canSwitchScan = state.worker && state.worker.status === 'in' && !state.worker.openPriorDate;
    $('switchBtn').classList.toggle('hidden', !canSwitchScan);
    return;
  }
  if (!state.worker) {
    btn.disabled = true; btn.classList.remove('out');
    label.textContent = t('sel'); icon.textContent = 'schedule'; return;
  }
  btn.disabled = false;
  const out = state.worker.status === 'in'; // currently in → next action is OUT
  btn.classList.toggle('out', out);
  label.textContent = out ? t('clockOut') : t('clockIn');
  icon.textContent = out ? 'logout' : 'login';
  $('hint').textContent = out ? t('hintOut') : t('hint'); // end vs start your workday
  // "Switch to Different Jobsite" only makes sense while clocked in today; a
  // prior-date open punch must be resolved via the normal clock-out first.
  const canSwitch = out && !state.noSite && !state.worker.openPriorDate;
  $('switchBtn').classList.toggle('hidden', !canSwitch);
}

/* ------------------------------------------------------------------ PIN */
function openPin(intent = 'clock') {
  state.intent = intent;
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
    showLoading(true);
    const res = await API.auth({ workerId: state.worker.id, newPin: entered });
    if (!res.ok) { showLoading(false); pinFail(res.error); return; }
    state.worker.hasPin = true;
    afterAuth(entered); return;
  }
  // enter mode
  showLoading(true); // the Sheet round-trip can take a couple seconds — show it
  const res = await API.auth({ workerId: state.worker.id, pin: entered });
  if (!res.ok) { showLoading(false); pinFail(res.error || t('pinWrong')); return; }
  afterAuth(entered);
}
function pinFail(msg) {
  updateDots(true); $('pinErr').textContent = msg || t('pinWrong');
  setTimeout(() => { state.pinBuf = ''; updateDots(); $('pinErr').textContent = ''; }, 900);
}

/* ------------------------------------------------------------------ actions */
// True when the worker is clocked in at a different jobsite than the one now
// scanned — a live clock-out here would tag the OUT to the wrong project. The
// roster (loaded fresh on every scan) carries `open.projectId` for the open shift.
function outSiteMismatch() {
  const o = state.worker && state.worker.open;
  return !!(o && o.projectId && state.data && state.data.project
    && String(state.data.project.id) !== String(o.projectId));
}
// The QR param of the jobsite the worker is currently clocked in at (resolved
// from the open shift's projectId via the sites list). Used as the switch
// origin so a switch always clocks OUT of the open site, not the scanned one.
function openSiteQR() {
  const o = state.worker && state.worker.open;
  if (!o || !o.projectId) return null;
  const site = (state.data?.sites || []).find((s) => String(s.id) === String(o.projectId));
  return site ? site.qrParam : null;
}
// Show the "wrong jobsite code" page: they scanned a site they're NOT clocked
// in at while trying to clock out. Names both sites; the tip is a warning banner.
function showWrongSite() {
  const open = (state.worker.open && state.worker.open.siteName) || '—';
  const scanned = (state.data?.project?.siteName) || '—';
  $('wrongMsg').textContent = t('wrongMsg').replace(/\{open\}/g, open).replace('{scanned}', scanned);
  show('wrongsite');
}
function afterAuth(pin) {
  state.authedPin = pin;
  localStorage.setItem('bfb_worker', state.worker.id);
  if (state.intent === 'secondary') { openSecondary(); return; }
  if (state.intent === 'switch') {
    // Direct switch (scanned the destination): skip the picker. Owners/independents
    // still get the "with or without materials" step, same as the picker path.
    if (state.switchDirect) {
      if (state.worker.type && state.worker.type !== 'employee') { openClockChoice('switch'); }
      else { doSwitch(); }
    } else { openSwitch(); }
    return;
  }
  if (state.worker.openPriorDate) { openRecovery(); return; }
  const action = state.worker.status === 'in' ? 'OUT' : 'IN';
  // Owners/independents get a "clock out with or without materials" choice.
  if (action === 'OUT' && (state.worker.type && state.worker.type !== 'employee')) { openClockChoice('clockout'); return; }
  doPunch(action);
}
// The live backend sends openInfo = { date } (an ISO day) with no label; only
// the offline demo supplies a prebuilt `label`. Format the day from the date so
// both the recovery field and the post-recovery confirmation always show it.
function recDayLabel(info) {
  info = info || {};
  return info.label
    || (info.date ? new Date(info.date + 'T00:00:00').toLocaleDateString(I[lang].loc, { weekday: 'long', month: 'long', day: 'numeric' }) : '');
}
function openRecovery() {
  showLoading(false);
  $('recDay').value = recDayLabel(state.worker.openInfo);
  writeTime('recTime', '');
  show('recovery');
}
// Owner/independent clock-out (and switch): choose to add materials or not.
function openClockChoice(mode) {
  showLoading(false);
  state.choiceMode = mode;
  $('choiceTitle').textContent = mode === 'switch' ? t('choice_switchTitle') : t('choice_clockTitle');
  $('choicePrimaryLabel').textContent = mode === 'switch' ? t('switchNoMat') : t('clockOutNoMat');
  $('choicePrimaryIcon').textContent = mode === 'switch' ? 'swap_horiz' : 'logout';
  show('choice');
}
async function submitRecovery() {
  const time = readTime('recTime');
  if (!time) { alert(t('apMissing')); return; }
  const at = `${state.worker.openInfo.date}T${time}:00`;
  const res = await API.punch({ workerId: state.worker.id, pin: state.authedPin, action: 'OUT', at, missed: true });
  if (!res.ok) { alert(res.error || t('err')); return; }
  // Prior shift closed → they are now clocked out; auto-start today's shift, and
  // flag the confirmation so it explains we closed the old shift + started a new
  // one (otherwise landing on "You're Clocked In" after tapping Clock Out is a
  // surprise).
  state.recoveryClosedDay = recDayLabel(state.worker.openInfo);
  state.worker.openPriorDate = false; state.worker.status = 'out';
  doPunch('IN');
}
async function doPunch(action) {
  showLoading(true);
  const res = await API.punch({ workerId: state.worker.id, pin: state.authedPin, action });
  if (!res.ok) { showFail(res.error); return; }
  state.worker.status = action === 'IN' ? 'in' : 'out';
  showConfirm(action, res.at);
}
function showFail(msg) { showLoading(false); alert(msg || t('err')); resetToClock(); }

/* ------------------------------------------------------------------ confirmation */
function showConfirm(action, atIso, siteOverride) {
  showLoading(false);
  state.lastAction = action;
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
  // Reminder: show which jobsite this punch landed on, so a wrong site is obvious.
  // On a switch, the destination site is passed in (state.site is still origin).
  const siteName = siteOverride || state.data?.project?.siteName;
  const cSite = $('cSite');
  if (siteName) { cSite.innerHTML = `<span class="material-symbols-rounded" style="font-size:16px">distance</span> ${siteName}`; cSite.style.display = ''; }
  else { cSite.style.display = 'none'; }
  // After a missed-clock-out recovery, this IN follows an auto-close of the old
  // shift — spell that out in a gold banner at the top (so "You're Clocked In"
  // isn't a surprise and the new jobsite is clear). .banner top-aligns the view.
  const cNote = $('cNote');
  if (isIn && state.recoveryClosedDay) {
    $('cNoteText').textContent = t('rec_done_note')
      .replace('{day}', state.recoveryClosedDay)
      .replace('{site}', siteName || t('job'));
    cNote.style.display = '';
    c.classList.add('banner');
  } else {
    cNote.style.display = 'none';
    c.classList.remove('banner');
  }
  state.recoveryClosedDay = null;
  c.classList.add('show');
}
function closeConfirm() {
  $('confirm').classList.remove('show');
  // Every clock punch (IN or OUT) returns to the "scan a jobsite" home, so the
  // NEXT punch needs its own fresh scan — presence proof for both in and out.
  // (Submit Edits stays put.)
  if (state.lastAction === 'IN' || state.lastAction === 'OUT') {
    state.site = null;
    if (state.data) state.data.project = null;
    state.noSite = true;
    updateSiteName();
  }
  state.lastAction = null;
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

/* ------------------------------------------------------------- secondary tab */
function showLoading(on) { $('loading').classList.toggle('hidden', !on); }
function fmtDayLong(iso) { return new Date(iso + 'T00:00:00').toLocaleDateString(I[lang].locale, { weekday: 'long', month: 'short', day: 'numeric' }); }
function fmtShort(iso) { return new Date(iso + 'T00:00:00').toLocaleDateString(I[lang].locale, { month: 'short', day: 'numeric' }); }
function fmtRange(a, b) { return `${fmtShort(a)} – ${fmtShort(b)}`; }
function money(n) { return '$' + (Math.round(n * 100) / 100).toLocaleString(I[lang].locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
// "HH:mm" (24h, as stored) → "h:mm AM/PM" for display on the Time Log.
function fmtTime12(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  if (!Number.isFinite(h)) return hhmm;
  const ap = h >= 12 ? 'PM' : 'AM'; let hh = h % 12; if (hh === 0) hh = 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
}

// Central Time Log loader. `target` = whose log; opts.return = where Back goes
// ('clock' | 'invoice' | 'team'); opts.dayMaterials = per-day Add Materials.
async function openTimelogFor(target, opts = {}) {
  state.editTarget = target;
  state.editReturn = opts.return || 'clock';
  state.showDayMaterials = !!opts.dayMaterials;
  showLoading(true);
  const data = await API.timelog(target.id, state.worker.id, state.authedPin);
  showLoading(false);
  if (!data.ok) { alert(data.error || t('err')); resetToClock(); return; }
  resetEditSession();
  state.timelog = data; renderTimeLog(data); show('timelog');
}
async function refreshTimelog() {
  const data = await API.timelog(state.editTarget.id, state.worker.id, state.authedPin);
  if (data.ok) { state.timelog = data; renderTimeLog(data); }
  return data;
}

async function openSecondary() {
  const w = state.worker;
  const type = w.type || 'employee';
  if (type === 'employee') { openTimelogFor(w, { return: 'clock' }); return; }
  // Owner / independent → Invoice Draft (which has the Edit button).
  showLoading(true);
  const data = await API.invoice(w.id, state.authedPin);
  if (data.ok && data.notOwner) { showLoading(false); openTimelogFor(w, { return: 'clock' }); return; }
  showLoading(false);
  if (!data.ok) { alert(data.error || t('err')); resetToClock(); return; }
  renderInvoice(data.invoice); show('invoice');
}

// Invoice "Edit Hours & Materials": owner → Team screen; independent → own log.
function openInvoiceEdit() {
  if ((state.worker.type || 'employee') === 'owner') { openTeam(); return; }
  openTimelogFor(state.worker, { return: 'invoice', dayMaterials: true });
}
async function openTeam() {
  showLoading(true);
  const data = await API.team(state.worker.id, state.authedPin);
  showLoading(false);
  if (!data.ok) { alert(data.error || t('err')); return; }
  state.team = data.members;
  renderTeam(data.members);
  show('team');
}
function renderTeam(members) {
  const wrap = $('teamList'); wrap.innerHTML = '';
  (members || []).forEach((m, i) => {
    const el = document.createElement('div'); el.className = 'team-row'; el.dataset.i = i;
    const you = m.self ? (lang === 'en' ? ' · You' : ' · Tú') : '';
    el.innerHTML = `<div><div class="tname">${m.name}${you}</div>`
      + `<div class="tsub">${t('weekTotal')}: ${fmtHrs(m.weekHours)}</div></div>`
      + '<span class="material-symbols-rounded go">chevron_right</span>';
    wrap.appendChild(el);
  });
}
async function reopenInvoice() {
  showLoading(true);
  const data = await API.invoice(state.worker.id, state.authedPin);
  showLoading(false);
  if (data.ok && data.invoice) { renderInvoice(data.invoice); show('invoice'); return; }
  resetToClock();
}
// Time Log "Back" routes to wherever the log was opened from.
function tlBackNav() {
  if (state.editReturn === 'team') { renderTeam(state.team); show('team'); return; }
  if (state.editReturn === 'invoice') { reopenInvoice(); return; }
  resetToClock();
}

// Review flags come from the backend in English; translate the known ones.
const FLAG_ES = {
  'missing clock-out': 'falta marcar salida',
  'clock-out with no clock-in': 'salida sin entrada',
  'clock-out not after clock-in': 'la salida no es después de la entrada',
  'worked Sunday — outside the Mon–Sat week; not counted, please review': 'trabajó domingo — fuera de la semana lun–sáb; no contado, revisar',
  'Sunday counted in week (Sundays are enabled)': 'domingo contado en la semana',
};
function translateFlag(reason) { return lang === 'es' ? (FLAG_ES[reason] || reason) : reason; }

function renderFlags(el, flags) {
  el.innerHTML = '';
  (flags || []).forEach((f) => {
    const d = document.createElement('div'); d.className = 'flagline';
    const who = f.worker ? `${f.worker}, ` : '';
    d.innerHTML = `<span class="material-symbols-rounded">flag</span><span>${who}${fmtShort(f.date)} — ${translateFlag(f.reason)}</span>`;
    el.appendChild(d);
  });
}

function renderTimeLog(d) {
  // When an owner edits a crew member, title with their name; else "My time".
  const editingOther = state.editTarget && state.worker && state.editTarget.id !== state.worker.id;
  $('tlTitle').textContent = editingOther ? String(state.editTarget.name).replace(/\s*\(.*\)$/, '') : t('tl_title');
  $('tlWeek').textContent = fmtRange(d.weekStart, d.weekEnd);
  const wrap = $('tlDays'); wrap.innerHTML = '';
  d.days.forEach((day, di) => {
    const empty = !day.punches.length;
    const el = document.createElement('div');
    el.className = 'tl-day' + (empty ? ' empty' : '');
    const chips = day.punches.map((p, pi) => {
      const flagged = p.manual || p.edited ? ' flagged' : '';
      const icon = p.action === 'IN' ? 'login' : 'logout';
      const mark = (p.manual || p.edited) ? ' ✎' : '';
      return `<span class="chip ${p.action === 'IN' ? 'in' : 'out'}${flagged} tappable" role="button" data-di="${di}" data-pi="${pi}"><span class="material-symbols-rounded">${icon}</span>${fmtTime12(p.time)}${mark}</span>`;
    }).join('');
    // Days with no punches get an "Add Hours" button right in the box.
    const hoursBody = empty
      ? `<button class="addhours" data-date="${day.date}"><span class="material-symbols-rounded">add_circle</span>${t('tl_addHours')}</button>`
      : `<div class="punches">${chips}</div>`;
    // Independents can also add materials to a day (flows onto their invoice).
    const matBtn = state.showDayMaterials
      ? `<button class="addhours addmat" data-date="${day.date}"><span class="material-symbols-rounded">receipt_long</span>${t('addMaterials')}</button>`
      : '';
    el.innerHTML = `<div class="drow"><span class="dname">${fmtDayLong(day.date)}</span>`
      + `<span class="dhrs ${day.hours ? '' : 'zero'}">${day.hours ? fmtHrs(day.hours) : '—'}</span></div>`
      + hoursBody + matBtn;
    wrap.appendChild(el);
  });
  $('tlTotal').textContent = fmtHrs(d.currentWeekHours ?? d.weekHours);
  const hasPunches = d.days.some((x) => x.punches.length);
  $('tlEditHint').textContent = hasPunches ? t('tapEdit') : '';
  renderFlags($('tlFlags'), d.flags);
}

/* ---- Time Log edit session: guardrail + reassurance ------------------ */
// A "submission" = one open My Time session. A worker may add/edit hours on up
// to 3 distinct days per session; a warning appears on the 2nd day, and a 4th
// day is blocked with the office number (a nudge to use the jobsite QR).
function resetEditSession() { state.editDays = new Set(); hideWarn(); }
// The edit guardrail (warn on the 2nd day, lock on the 4th) is an anti-abuse
// nudge for EMPLOYEES only. Independent subs and owners manage their own
// hours/invoices — no warning, no lockout.
function guardrailApplies() {
  return (state.worker?.type || 'employee') === 'employee';
}
function dayWithinLimit(date) {
  if (!guardrailApplies()) return true;
  const s = state.editDays || (state.editDays = new Set());
  const projected = s.has(date) ? s.size : s.size + 1;
  return projected <= 3;
}
function noteEdit(date) {
  if (!guardrailApplies()) return;
  const s = state.editDays || (state.editDays = new Set());
  const before = s.size;
  s.add(date);
  if (s.size === 2 && before < 2) showWarn('soft', t('warn_edit')); // 2nd distinct day
}
function showWarn(kind, msg) {
  const el = $('tlWarn');
  el.className = 'tl-warn ' + (kind === 'hard' ? 'hard' : 'soft');
  el.innerHTML = `<span class="material-symbols-rounded">${kind === 'hard' ? 'block' : 'info'}</span><span>${msg}</span>`;
}
function hideWarn() { const el = $('tlWarn'); el.className = 'tl-warn hidden'; el.innerHTML = ''; }
// "Submit Edits" — edits already saved live; this just reassures the worker.
function showSubmitted() {
  state.lastAction = 'submit';
  const c = $('confirm'); c.classList.remove('out');
  $('cIcon').textContent = 'check_circle';
  $('cStatus').innerHTML = t('editsSubmitted');
  $('cWho').textContent = state.worker ? state.worker.name : '';
  $('cStamp').textContent = ''; $('cDate').textContent = '';
  $('cSite').style.display = 'none';
  c.classList.add('show');
}

function renderInvoice(inv) {
  state.invoiceData = inv; // kept so a language toggle can re-render it
  $('invMeta').innerHTML = `<div class="co">${inv.company}</div><div class="wk">${fmtRange(inv.weekStart, inv.weekEnd)}</div>`;
  const lines = $('invLines'); lines.innerHTML = '';
  const matLabel = lang === 'en' ? 'Materials' : 'Materiales';
  if (!inv.projects.length && !inv.materials.length) {
    lines.innerHTML = `<div class="inv-empty">${t('invEmpty')}</div>`;
    $('invTotalRow').classList.add('hidden');
    renderFlags($('invFlags'), inv.flags); return;
  }
  inv.projects.forEach((p) => {
    const el = document.createElement('div'); el.className = 'inv-line';
    const rate = p.rate ? ` @ ${money(p.rate)}/hr` : '';
    const days = p.perDay.map((d) => `${fmtShort(d.date)} ${d.hours}h`).join(' · ');
    el.innerHTML = `<div class="top"><span class="pname">${p.name}</span><span class="pamt">${money(p.amount)}</span></div>`
      + `<div class="sub">${p.hours}h${rate}</div><div class="inv-days">${days}</div>`;
    lines.appendChild(el);
  });
  inv.materials.forEach((m) => {
    const el = document.createElement('div'); el.className = 'inv-line';
    el.innerHTML = `<div class="top"><span class="pname">${matLabel}${m.note ? ' — ' + m.note : ''}</span><span class="pamt">${money(m.amount)}</span></div>`;
    lines.appendChild(el);
  });
  $('invTotal').textContent = money(inv.total);
  $('invTotalRow').classList.remove('hidden');
  renderFlags($('invFlags'), inv.flags);
}

function fillSiteOptions() {
  const sel = $('apSite'); sel.innerHTML = '';
  (state.data?.sites || []).forEach((s) => { const o = document.createElement('option'); o.value = s.qrParam; o.textContent = s.siteName; sel.appendChild(o); });
  if (state.site) sel.value = state.site; // default to the scanned site if present
}

/* ---- 15-minute time dropdowns (a time <select> + an AM/PM <select>) ---- */
function buildTimeSelect(sel) {
  sel.innerHTML = '';
  const ph = document.createElement('option'); ph.value = ''; ph.textContent = '—'; ph.disabled = true; ph.selected = true; sel.appendChild(ph);
  [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].forEach((h) => {
    ['00', '15', '30', '45'].forEach((m) => {
      const o = document.createElement('option'); o.value = `${h}:${m}`; o.textContent = `${h}:${m}`; sel.appendChild(o);
    });
  });
}
function initTimeSelects() { document.querySelectorAll('select.time-sel').forEach(buildTimeSelect); }
// 12-hour "h:mm" + AM/PM  →  "HH:mm" (24h) for the API.
function to24(h12mm, ampm) {
  const [h, m] = h12mm.split(':');
  let hh = Number(h) % 12; if (ampm === 'PM') hh += 12;
  return `${String(hh).padStart(2, '0')}:${m}`;
}
// "HH:mm" (24h) → { time:"h:mm", ampm }, snapping minutes to the nearest 15.
function from24(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12; if (h12 === 0) h12 = 12;
  const mm = [0, 15, 30, 45].reduce((a, b) => (Math.abs(b - m) < Math.abs(a - m) ? b : a), 0);
  return { time: `${h12}:${String(mm).padStart(2, '0')}`, ampm };
}
// Read/write a time control (baseId = the time <select>; baseId+'AP' = AM/PM).
function readTime(baseId) {
  const v = $(baseId).value;
  return v ? to24(v, $(baseId + 'AP').value) : '';
}
function writeTime(baseId, hhmm) {
  if (hhmm) { const { time, ampm } = from24(hhmm); $(baseId).value = time; $(baseId + 'AP').value = ampm; }
  else { $(baseId).value = ''; $(baseId + 'AP').value = 'AM'; }
}

/* ---- add hours to a day: one Clock In + one Clock Out (from "Add Hours") ---- */
function openAddPunchForDay(date) {
  state.apMode = 'add';
  state.apDate = date;
  state.editPunchId = null;
  $('apTitle').textContent = t('tl_addHours');
  $('apDayLabel').textContent = fmtDayLong(date);
  $('apAddFields').style.display = '';
  $('apEditFields').style.display = 'none';
  $('apRemove').classList.add('hidden'); // nothing to remove on a fresh add
  fillSiteOptions();
  writeTime('apTimeIn', ''); writeTime('apTimeOut', '');
  show('addpunch');
}
/* ---- edit one existing punch's time; the title says which one (IN/OUT) ---- */
function openEditPunch(punch, date) {
  state.apMode = 'edit';
  state.apDate = date;
  state.editPunchId = punch.id;
  state.editAction = punch.action; // fixed — editing time only, not IN↔OUT
  $('apTitle').textContent = punch.action === 'IN' ? t('ap_editIn') : t('ap_editOut');
  $('apDayLabel').textContent = fmtDayLong(date);
  $('apAddFields').style.display = 'none';
  $('apEditFields').style.display = '';
  $('apRemove').classList.remove('hidden'); // editing an existing punch → can remove it
  writeTime('apTime', punch.time);
  show('addpunch');
}
// Small confirm dialog for destructive actions. Resolves true/false.
function askConfirm({ title, msg, yes }) {
  return new Promise((resolve) => {
    $('cdTitle').textContent = title || t('removeConfirmTitle');
    $('cdMsg').textContent = msg || '';
    $('cdYesLabel').textContent = yes || t('removeYes');
    const dlg = $('confirmDialog');
    const done = (val) => {
      dlg.classList.add('hidden');
      $('cdYes').onclick = null; $('cdNo').onclick = null;
      resolve(val);
    };
    $('cdYes').onclick = () => done(true);
    $('cdNo').onclick = () => done(false);
    dlg.classList.remove('hidden');
  });
}
async function removePunch() {
  const ok = await askConfirm({ title: t('removeConfirmTitle'), msg: t('removeConfirmMsg'), yes: t('removeYes') });
  if (!ok) return;
  showLoading(true);
  const res = await API.punchDelete({
    workerId: state.editTarget ? state.editTarget.id : state.worker.id,
    actingId: state.worker.id, pin: state.authedPin, punchId: state.editPunchId,
  });
  if (!res.ok) { showLoading(false); alert(res.error || t('err')); return; }
  await refreshTimelog();
  showLoading(false);
  show('timelog');
}
async function submitAddPunch() {
  const date = state.apDate;
  if (!date) return;
  // Guardrail: block a 4th distinct day in this session (nudge to use the QR).
  if (!dayWithinLimit(date)) { alert(t('block_edit')); return; }
  // Target = whose punches (self, or a crew member); acting = who's authed.
  const targetId = state.editTarget ? state.editTarget.id : state.worker.id;
  const auth = { actingId: state.worker.id, pin: state.authedPin };
  if (state.apMode === 'edit') {
    const time = readTime('apTime');
    if (!time) { alert(t('apMissing')); return; }
    showLoading(true);
    const res = await API.punchEdit({ workerId: targetId, ...auth, punchId: state.editPunchId, at: `${date}T${time}:00`, action: state.editAction });
    if (!res.ok) { showLoading(false); alert(res.error || t('err')); return; }
  } else {
    const inT = readTime('apTimeIn'), outT = readTime('apTimeOut');
    if (!inT || !outT) { alert(t('apMissingBoth')); return; }
    if (outT <= inT) { alert(t('apOrder')); return; }
    const site = $('apSite').value;
    showLoading(true);
    // Add both punches for the day; if the IN saves but the OUT fails, surface it.
    const inRes = await API.punch({ workerId: targetId, ...auth, action: 'IN', at: `${date}T${inT}:00`, missed: true, site });
    if (!inRes.ok) { showLoading(false); alert(inRes.error || t('err')); return; }
    const outRes = await API.punch({ workerId: targetId, ...auth, action: 'OUT', at: `${date}T${outT}:00`, missed: true, site });
    if (!outRes.ok) { showLoading(false); alert(outRes.error || t('err')); return; }
  }
  noteEdit(date); // count this day toward the session limit; warn on the 2nd
  await refreshTimelog();
  showLoading(false);
  show('timelog');
}

/* ------------------------------------------------- materials */
// mode: 'clockout' (owner clock-out) | 'switch' (jobsite switch) |
//       'day' (independent, per Time Log day) | 'team' (owner, onto invoice).
// clockout/switch offer a "Skip"; day/team require an amount and just Save.
function openMaterials(mode = 'clockout', date = null) {
  showLoading(false);
  state.matMode = mode;
  state.matDate = date;
  $('matAmount').value = ''; $('matNote').value = ''; $('matReceipt').value = '';
  $('matSaveLabel').textContent = mode === 'switch' ? t('mat_saveSwitch')
    : mode === 'clockout' ? t('mat_save') : t('ap_save'); // day/team → "Save"
  // The "clock out / switch without materials" choice now lives on the choice
  // screen, so the old inline Skip button is no longer needed.
  $('matSkip').classList.add('hidden');
  show('materials');
}
function fileToBase64(file) {
  return new Promise((resolve) => {
    if (!file) { resolve(null); return; }
    const r = new FileReader();
    r.onload = () => { const s = String(r.result); resolve({ filename: file.name, mimeType: file.type, base64: s.slice(s.indexOf(',') + 1) }); };
    r.onerror = () => resolve(null);
    r.readAsDataURL(file);
  });
}
async function saveMaterials() {
  const amount = parseFloat($('matAmount').value);
  const file = $('matReceipt').files[0];
  const perDay = state.matMode === 'day' || state.matMode === 'team';
  if (perDay && !(Number.isFinite(amount) && amount > 0)) { alert(t('matAmountNeeded')); return; }
  if (Number.isFinite(amount) && amount > 0) {
    showLoading(true);
    const receipt = await fileToBase64(file);
    const res = await API.material({
      workerId: state.editTarget ? state.editTarget.id : state.worker.id,
      actingId: state.worker.id, pin: state.authedPin,
      amount, note: $('matNote').value.trim(), receipt, date: state.matDate,
    });
    showLoading(false);
    if (!res.ok) { alert(res.error || t('err')); return; }
  }
  finishMaterials();
}
function skipMaterials() { finishMaterials(); }
async function finishMaterials() {
  if (state.matMode === 'switch') { doSwitch(); return; }
  if (state.matMode === 'day') { showLoading(true); await refreshTimelog(); showLoading(false); show('timelog'); return; }
  if (state.matMode === 'team') { show('team'); return; }
  doPunch('OUT'); // clockout
}
function matBackNav() {
  if (state.matMode === 'day') { show('timelog'); return; }
  if (state.matMode === 'team') { show('team'); return; }
  if (state.matMode === 'clockout' || state.matMode === 'switch') { show('choice'); return; }
  resetToClock();
}

/* ------------------------------------------------- switch to a different jobsite */
function openSwitch() {
  showLoading(false);
  const sel = $('swSite');
  sel.innerHTML = '';
  // Every active jobsite except the one they're standing on (matched by the
  // scanned QR param and, as a fallback, the loaded project's own qrParam).
  const here = new Set([state.site, state.data?.project?.qrParam].filter(Boolean));
  const sites = (state.data?.sites || []).filter((s) => !here.has(s.qrParam));
  if (!sites.length) { alert(t('sw_none')); resetToClock(); return; }
  sites.forEach((s) => {
    const o = document.createElement('option'); o.value = s.qrParam; o.textContent = s.siteName; sel.appendChild(o);
  });
  sel.selectedIndex = 0;
  show('switch');
}
function confirmSwitch() {
  state.switchTo = $('swSite').value;
  if (!state.switchTo) { alert(t('sw_none')); return; }
  // Owners/independents choose "switch with or without materials" first.
  if (state.worker.type && state.worker.type !== 'employee') { openClockChoice('switch'); return; }
  doSwitch();
}
async function doSwitch() {
  showLoading(true);
  // Always clock OUT of the site the worker is actually clocked in at (their open
  // shift), not whatever QR is loaded — otherwise the OUT is tagged to the wrong
  // project. Falls back to the scanned site when the open site can't be resolved.
  const fromSite = openSiteQR() || state.site;
  const res = await API.switchJob({
    workerId: state.worker.id, pin: state.authedPin, fromSite, toSite: state.switchTo,
  });
  state.switchDirect = false; state.switchTo = null;
  showLoading(false);
  if (!res.ok) { showFail(res.error); return; }
  state.worker.status = 'in'; // now clocked in at the destination
  showConfirm('IN', res.at, res.site);
}
// Entry from the scan-home "Switch Jobsite" scanner: the scanned QR is the
// destination. Switch straight to it (clock out of the open site + in here).
function startSwitchTo(qrParam) {
  const o = state.worker && state.worker.open;
  const dest = (state.data?.sites || []).find((s) => String(s.qrParam) === String(qrParam));
  if (o && dest && String(dest.id) === String(o.projectId)) { alert(t('sw_already')); show('clock'); return; }
  state.switchTo = qrParam;
  state.switchDirect = true; // skip the picker in afterAuth
  openPin('switch');
}

/* ---------------------------------------------------- change pay rate (owner) */
function openRate() { $('rateInput').value = ''; show('rate'); }
async function saveRate() {
  const rate = parseFloat($('rateInput').value);
  if (!Number.isFinite(rate) || rate <= 0) { alert(t('rateBad')); return; }
  showLoading(true);
  const res = await API.rate({ workerId: state.worker.id, pin: state.authedPin, newRate: rate });
  showLoading(false);
  if (!res.ok) { alert(res.error || t('err')); return; }
  alert(t('rateSaved'));
  const inv = await API.invoice(state.worker.id, state.authedPin); // refresh draft
  if (inv.ok && inv.invoice) renderInvoice(inv.invoice);
  show('invoice');
}

/* ------------------------------------------------------- QR scanner (no site) */
let scanStream = null, scanRAF = null, scanCanvas = null, scanCtx = null;
// Load the QR-decoding library on demand (keeps it off the normal page load).
function loadJsQR() {
  return new Promise((resolve, reject) => {
    if (window.jsQR) return resolve();
    const s = document.createElement('script');
    s.src = '/js/jsQR.js'; s.onload = resolve; s.onerror = () => reject(new Error('load'));
    document.head.appendChild(s);
  });
}
async function openScanner() {
  $('scanMsg').textContent = state.scanForSwitch ? t('sw_scanTo') : t('scan_hint');
  show('scan');
  try {
    await loadJsQR();
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch {
    $('scanMsg').textContent = t('scan_nocam');
    return;
  }
  const video = $('scanVideo');
  video.srcObject = scanStream;
  video.setAttribute('playsinline', 'true');
  try { await video.play(); } catch { /* iOS autoplay quirk — the stream still renders */ }
  scanCanvas = document.createElement('canvas');
  scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });
  scanLoop();
}
function scanLoop() {
  if (!scanStream) return; // cancelled
  const video = $('scanVideo');
  if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
    scanCanvas.width = video.videoWidth; scanCanvas.height = video.videoHeight;
    scanCtx.drawImage(video, 0, 0, scanCanvas.width, scanCanvas.height);
    const img = scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
    const code = window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
    if (code && code.data) { handleScan(code.data); return; }
  }
  scanRAF = requestAnimationFrame(scanLoop);
}
function stopScanner() {
  if (scanRAF) { cancelAnimationFrame(scanRAF); scanRAF = null; }
  if (scanStream) { scanStream.getTracks().forEach((tr) => tr.stop()); scanStream = null; }
  const v = $('scanVideo'); if (v) v.srcObject = null;
}
function handleScan(text) {
  // The QR encodes a URL like https://timeclock.backforty.builders/?site=french1
  let site = null;
  try { site = new URL(text, location.origin).searchParams.get('site'); } catch { /* not a URL */ }
  if (site) {
    stopScanner();
    // Switch mode (from the scan-home "Switch Jobsite" button): the scanned site
    // is the destination — switch straight to it in-page, no reload.
    if (state.scanForSwitch) { state.scanForSwitch = false; startSwitchTo(site); return; }
    location.href = '/?site=' + encodeURIComponent(site);
    return;
  }
  // Not one of ours — say so, then resume scanning after a beat.
  $('scanMsg').textContent = t('scan_bad');
  setTimeout(() => { if (scanStream) { $('scanMsg').textContent = t('scan_hint'); scanLoop(); } }, 1500);
}

/* ------------------------------------------------------------------ reset / nav */
function resetToClock() {
  state.pinBuf = ''; state.pinFirst = ''; state.authedPin = null;
  state.switchDirect = false; state.scanForSwitch = false; // clear any pending switch
  show('clock');
  renderRemembered();
  const sel = $('who'); sel.selectedIndex = 0; sel.classList.add('empty');
  setMainButton();
}

/* ------------------------------------------------------------------ wire up */
function bind() {
  // header EN/ES toggle
  document.querySelectorAll('.lang button').forEach((b) =>
    b.addEventListener('click', () => {
      chooseLang(b.dataset.lang);
      if (views.lang.classList.contains('active')) show('clock'); // if still on the gate, proceed
    }));
  // language gate (first step): pick a language, then go to the clock
  document.querySelectorAll('.lg-btn').forEach((b) =>
    b.addEventListener('click', () => { chooseLang(b.dataset.lang); show('clock'); }));

  $('who').addEventListener('change', (e) => {
    const w = state.data.workers.find((x) => x.id === e.target.value);
    if (w) { state.worker = w; e.target.classList.remove('empty'); setMainButton(); }
  });
  $('notYouBtn').addEventListener('click', () => {
    localStorage.removeItem('bfb_worker'); state.worker = null;
    renderRemembered(); setMainButton();
  });
  $('mainBtn').addEventListener('click', () => {
    if (!state.worker) return;
    // A live clock-out must be at the SAME jobsite you clocked in — otherwise the
    // OUT gets tagged to the wrong project. A mismatched QR shows the "wrong
    // jobsite code" page instead. (Prior-day recovery is exempt — it closes an
    // old shift from wherever you are.)
    if (state.worker.status === 'in' && !state.worker.openPriorDate && outSiteMismatch()) {
      showWrongSite();
      return;
    }
    openPin('clock');
  });
  // "Switch Jobsite": at the scan-home (no site scanned yet) it opens the scanner
  // so you scan the jobsite you're switching TO; on a loaded site page it opens
  // the destination picker. Either way doSwitch() clocks you out of your OPEN site.
  $('switchBtn').addEventListener('click', () => {
    if (!state.worker || state.worker.status !== 'in' || state.worker.openPriorDate) return;
    if (state.noSite) { state.scanForSwitch = true; openScanner(); }
    else { openPin('switch'); }
  });
  $('wrongScanAgain').addEventListener('click', () => { clearJobsite(); openScanner(); });
  $('fallbackBtn').addEventListener('click', () => {
    if ($('fallbackBtn').dataset.mode === 'logout') logout();
    else openFallback();
  });
  $('secondaryBtn').addEventListener('click', () => {
    if (!state.worker) { alert(t('pickFirst')); return; }
    openPin('secondary');
  });
  // No-jobsite card doubles as a "scan the QR" button.
  $('jobsiteCard').addEventListener('click', () => { if (state.noSite) openScanner(); });
  $('jobsiteClear').addEventListener('click', (e) => { e.stopPropagation(); clearJobsite(); });
  $('scanCancel').addEventListener('click', () => { state.scanForSwitch = false; stopScanner(); show('clock'); });

  // secondary tab nav
  $('tlBack').addEventListener('click', tlBackNav);
  $('invBack').addEventListener('click', resetToClock);
  $('invEditBtn').addEventListener('click', openInvoiceEdit);
  $('tlSubmit').addEventListener('click', showSubmitted); // reassurance; edits save live
  $('tlDays').addEventListener('click', (e) => {
    const mat = e.target.closest('.addmat'); // check materials before hours (shares .addhours)
    if (mat) { openMaterials('day', mat.dataset.date); return; }
    const add = e.target.closest('.addhours');
    if (add) {
      const date = add.dataset.date;
      if (!dayWithinLimit(date)) { showWarn('hard', t('block_edit')); return; }
      openAddPunchForDay(date);
      return;
    }
    const chip = e.target.closest('.chip.tappable'); if (!chip) return;
    const day = state.timelog?.days[+chip.dataset.di];
    const punch = day?.punches[+chip.dataset.pi];
    if (!day || !punch) return;
    if (!dayWithinLimit(day.date)) { showWarn('hard', t('block_edit')); return; }
    openEditPunch(punch, day.date);
  });
  $('apBack').addEventListener('click', () => show('timelog'));
  $('apCancel').addEventListener('click', () => show('timelog'));
  $('apSubmit').addEventListener('click', submitAddPunch);
  $('apRemove').addEventListener('click', removePunch);

  // team (Sub/Owner edits crew)
  $('teamBack').addEventListener('click', reopenInvoice);
  $('teamList').addEventListener('click', (e) => {
    const row = e.target.closest('.team-row'); if (!row) return;
    const m = state.team[+row.dataset.i];
    if (m) openTimelogFor(m, { return: 'team' });
  });
  $('teamAddMat').addEventListener('click', () => openMaterials('team'));
  $('teamSubmit').addEventListener('click', showSubmitted);

  // clock-out / switch choice (owner/independent)
  $('choicePrimary').addEventListener('click', () => {
    if (state.choiceMode === 'switch') doSwitch(); else doPunch('OUT');
  });
  $('choiceAddMat').addEventListener('click', () => openMaterials(state.choiceMode));
  $('choiceBack').addEventListener('click', resetToClock);
  // materials (owner clock-out / switch)
  $('matSave').addEventListener('click', saveMaterials);
  $('matSkip').addEventListener('click', skipMaterials);
  $('matBack').addEventListener('click', matBackNav);
  // switch to a different jobsite
  $('swConfirm').addEventListener('click', confirmSwitch);
  $('swCancel').addEventListener('click', resetToClock);
  $('swBack').addEventListener('click', resetToClock);
  // change pay rate
  $('invRateBtn').addEventListener('click', openRate);
  $('rateSave').addEventListener('click', saveRate);
  $('rateCancel').addEventListener('click', () => show('invoice'));
  $('rateBack').addEventListener('click', () => show('invoice'));

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
  initTimeSelects(); // populate the 15-min time dropdowns
  applyI18n();
  tick(); setInterval(tick, 1000);

  // First step: if no language has been chosen on this device, show the gate.
  if (!langChosen()) show('lang');

  const params = new URLSearchParams(location.search);
  state.site = params.get('site');

  $('loading').classList.remove('hidden');
  state.data = await API.site(state.site || '');
  $('loading').classList.add('hidden');

  if (state.data.demo) $('demoBadge').classList.remove('hidden');
  // Presence proof: real use requires a valid jobsite from the scanned QR.
  state.noSite = !state.data.demo && !state.data.project;
  updateSiteName();

  buildDropdown();
  renderRemembered();
  setMainButton();
  applyI18n();
}
boot();
