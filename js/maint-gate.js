/* v3.3 — رسالة الصيانة في صفحة الاختبار وصفحة التقديم (قراءة فقط من البيانات العامة لصفحة الدخول).
   الطالب الذي بدأ اختباره يكمله ويسلّمه دون انقطاع؛ ولا تُغلق الصفحة إلا قبل البدء. */
(function () {
  'use strict';
  var C = window.DMS_CONFIG || {};
  if (!window.supabase || !C.supabaseUrl) return;
  try { if (localStorage.getItem('dms-maint-owner') === '1') return; } catch (e) {}
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function css() { if (document.getElementById('mgCss')) return; var st = document.createElement('style'); st.id = 'mgCss';
    st.textContent = '#mgBar{position:fixed;inset-inline:0;bottom:0;z-index:9000;text-align:center;font:700 13.5px/1.6 Tajawal,Segoe UI,Tahoma,sans-serif;padding:7px 12px;background:#FFF4E5;color:#7A4100;border-top:1px solid #F3C98B}' +
      '#mgOv{position:fixed;inset:0;z-index:99999;background:linear-gradient(160deg,#3D1F63,#6B3FA0);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Tajawal,Segoe UI,Tahoma,sans-serif;direction:rtl}' +
      '#mgOv .b{background:#fff;border-radius:20px;max-width:460px;width:100%;padding:28px 22px;text-align:center}#mgOv h2{color:#3D1F63;margin:8px 0}#mgOv p{line-height:1.9;color:#333}#mgOv .u{font-weight:700;color:#6B3FA0}';
    document.head.appendChild(st); }
  var sb; try { sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey, { auth: { persistSession: false } }); } catch (e) { return; }
  sb.rpc('public_bootstrap').then(function (r) {
    if (r.error || !r.data) return;
    var L = ((r.data.settings || {}).labels) || {}, m = {};
    try { m = (JSON.parse(L.__dms || '{}').m) || {}; } catch (e) {}
    var msg = m.msg || 'نعمل على تحديث الموقع لتحسين خدماتكم، ونعود قريبًا بإذن الله.';
    var busy = function () { return !!(document.getElementById('qcard') || document.querySelector('.result,.res-card')); };
    css();
    if (m.mode === 'on' && !busy()) {
      var ov = document.createElement('div'); ov.id = 'mgOv';
      ov.innerHTML = '<div class="b"><div style="font-size:52px">🛠</div><h2>الموقع تحت الصيانة</h2><p>' + esc(msg) + '</p>' + (m.until ? '<p class="u">' + esc(m.until) + '</p>' : '') + '<p style="font-size:13px;color:#777">أعد فتح الرابط بعد انتهاء الصيانة.</p></div>';
      document.body.appendChild(ov);
      /* طالب استؤنف اختباره المحفوظ بعد ظهور الرسالة: يكمله */
      var n = 0, t = setInterval(function () { if (busy()) { ov.remove(); clearInterval(t); var b2 = document.createElement('div'); b2.id = 'mgBar'; b2.textContent = '🛠 الموقع في صيانة — أكمل اختبارك وسلّمه كالمعتاد.'; document.body.appendChild(b2); } if (++n > 60) clearInterval(t); }, 1000);
    } else if (m.mode === 'on' || m.mode === 'notice') {
      var b = document.createElement('div'); b.id = 'mgBar';
      b.textContent = (m.mode === 'on' ? '🛠 الموقع في صيانة — أكمل اختبارك وسلّمه كالمعتاد.' : '⚠ ' + (m.msg || 'سيتوقف الموقع قريبًا للصيانة.')) + (m.until ? ' — ' + m.until : '');
      document.body.appendChild(b);
    }
  }, function () {});
})();
