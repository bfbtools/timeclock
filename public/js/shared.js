// Pure, DOM-free helpers shared between the front end (public/js/app.js) and
// its tests. This repo has no jsdom/DOM test harness, so anything that needs
// to be unit-tested lives here instead of inline in app.js — see
// test/qr-flow.test.mjs. Keep this file free of `document`/`window`/
// `localStorage` references so `node --test` can import it directly.

// A roster row (from /api/site) requires a QR scan unless it explicitly says
// otherwise. Missing/undefined/anything but boolean false → QR required —
// matches the backend default (see docs/bfb-timeclock-spec.md "QR Required").
export function workerRequiresQr(worker) {
  return !(worker && worker.qrRequired === false);
}

// The Slab Mobile one-time message (slab-dashboard docs/plans/
// SLAB_MOBILE_CONDUCTOR_HANDOFF.md §7.6): shown once per device, gated behind
// the SLAB_MOBILE_MESSAGE flag in app.js, and never again once the
// `slab_mobile_msg_seen` localStorage key is set (by any of the three
// buttons). `seenValue` is whatever localStorage.getItem() returned — null
// when unset.
export function shouldShowSlabMessage(flagOn, seenValue) {
  return !!flagOn && !seenValue;
}
