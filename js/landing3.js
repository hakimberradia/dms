/* =====================================================================
   v3.4 — واجهة الدخول (المقترح ج): الأقسام أولًا + الوحدات المشتركة + الإدارة في الشريط العلوي
   + زر واتساب الدعم أسفل اليسار (رقم من «الهوية والمسميات»). إضافة فقط: الدخول وصلاحياته كما هي.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof renderLanding !== 'function' || !document.getElementById('tiles')) return;
  const E = (s) => (typeof esc === 'function' ? esc(s) : String(s == null ? '' : s));
  const owner = () => !!(typeof ME !== 'undefined' && ME && ME.isAdmin);
  const GR = ['linear-gradient(135deg,#4A2A8C,#7A52C7)', 'linear-gradient(135deg,#1F5F8B,#3C8DBC)', 'linear-gradient(135deg,#7A3E1D,#C27C3A)', 'linear-gradient(135deg,#1E6B52,#3AA17E)', 'linear-gradient(135deg,#8C2A4A,#C75277)'];
  const repT = () => { try { return window.dmsRepTypes ? window.dmsRepTypes() : null; } catch (e) { return null; } };
  const pub = () => { try { return window.dmsMirror ? window.dmsMirror() : {}; } catch (e) { return {}; } };
  const ico = (cid, s) => { try { return icon(scopeIcon(cid), s); } catch (e) { return ''; } };

  function build() {
    const tiles = document.getElementById('tiles'); if (!tiles) return;
    const D = DB, deps = D.departments || [], pid = (typeof primaryDept === 'function' ? primaryDept() : (deps[0] || {}).id);
    const rep = repT();
    const isShared = (c) => c.level === 'college' || (rep && c.level !== 'college' && c.dept === pid && c.type === c.id && !rep.includes(c.type));
    const sysOf = (cid) => { try { return systems().filter((x) => (x.committees || []).includes(cid)).map((x) => x.name.replace(/^نظام\s*/, '')); } catch (e) { return []; } };
    const shared = (D.committees || []).filter(isShared);
    /* بطاقات الأقسام: لجان كل قسم (عادة الجاهزية فقط). القسم الذي أُخفيت كل أنظمته لا يظهر للزوار */
    const cards = deps.map((d, i) => {
      const cs = (D.committees || []).filter((c) => c.level !== 'college' && c.dept === d.id && !isShared(c));
      const H = ((D.settings || {}).sysHidden) || pub().h || {}, hasHid = Object.values(H).some((a) => Array.isArray(a) && a.includes(d.id));
      const vis = cs.filter((c) => sysOf(c.id).length || !hasHid);
      return { d, i, cs: owner() ? cs : vis, hidden: !vis.length };
    }).filter((x) => x.cs.length && (!x.hidden || owner()));
    const n = cards.length, span = Math.min(n, 3) || 1;
    let h = '';
    if (n) {
      h += `<div class="land-h">${E(LBL('secDepts', 'اختر قسمك'))} <span class="small muted">${E(LBL('secDeptsSub', 'جاهزية الطلاب مستقلة لكل قسم'))}</span></div>`;
      h += cards.map(({ d, i, cs, hidden }) => `<button type="button" class="tile l3-dep${n === 1 ? ' one' : ''}" style="--n:${span};background:${GR[i % GR.length]}" onclick="pickScope('${E(cs[0].id)}')">
        <span class="l3-dep-ic">${ico(cs[0].id, 40)}</span><span class="l3-dep-b"><b class="tile-n">${E(d.name)}</b>
        <small>${E(cs.map((c) => c.baseName || c.name).join(' · '))}${hidden ? ' — مخفي عن الزوار' : ''}</small>
        <span class="l3-dep-go">${cs.length === 1 ? 'دخول ' + E(cs[0].baseName || cs[0].name) + ' ←' : 'اختر اللجنة ←'}</span></span></button>`).join('');
    }
    if (shared.length) {
      const k = shared.length, per = k <= 5 ? k : (k % 4 === 0 ? 4 : k % 3 === 0 ? 3 : 5), sq = per;
      h += `<div class="land-h">${E(LBL('secCollege', 'الوحدات المشتركة للكلية'))} <span class="small muted">${E(LBL('secCollegeSub', 'تخدم كل الأقسام'))}</span></div>`;
      h += shared.map((c) => { const ch = sysOf(c.id);
        return `<button type="button" class="tile l3-sq" style="--n:${sq}" onclick="pickScope('${E(c.id)}')"><span class="l3-sq-ic" style="color:${E(c.hex || '#5A33A6')}">${ico(c.id, 30)}</span>
          <b class="tile-n">${E(c.baseName || c.name)}</b>${ch.length ? `<span class="l3-ch">${ch.map((x) => `<i>${E(x)}</i>`).join('')}</span>` : ''}<span class="l3-go">دخول</span></button>`; }).join('');
    }
    tiles.classList.add('l3');
    tiles.innerHTML = h || '<div class="small muted" style="grid-column:1/-1">لا توجد لجان بعد.</div>';
    /* لجنة القسم إن كانت أكثر من واحدة: نافذة اختيار */
    tiles.querySelectorAll('.l3-dep').forEach((b, j) => { const cs = cards[j].cs; if (cs.length > 1) b.onclick = () => pickMany(cards[j].d, cs); });
  }
  function pickMany(d, cs) {
    let m = document.getElementById('l3Pick'); if (m) m.remove();
    m = document.createElement('div'); m.id = 'l3Pick';
    m.innerHTML = `<div class="l3-pk"><b>${E(d.name)}</b>${cs.map((c) => `<button type="button" data-c="${E(c.id)}">${E(c.baseName || c.name)}</button>`).join('')}<button type="button" class="x">إغلاق</button></div>`;
    m.onclick = (e) => { const c = e.target.getAttribute && e.target.getAttribute('data-c'); if (c) { m.remove(); pickScope(c); } else if (e.target === m || e.target.classList.contains('x')) m.remove(); };
    document.body.appendChild(m);
  }
  const _rl = renderLanding; renderLanding = function () { const r = _rl.apply(this, arguments); try { build(); } catch (e) { console.warn('l3', e); } return r; }; window.renderLanding = renderLanding;

  /* لوحات الإدارة في الشريط العلوي (تبقى أيضًا في قائمة ☰) */
  function topLinks() {
    const act = document.querySelector('#login .l2-act'); if (!act || act.querySelector('.l3-lead')) return;
    const L = [['head', LBL('tileHead', 'لوحة رئيس القسم'), '📊'], ['college', LBL('tileCollege', 'لوحة الكلية'), '🏛️'], ['owner', LBL('tileOwner', 'الإعدادات العامة'), '⚙️']];
    const w = document.createElement('div'); w.className = 'l3-lead';
    w.innerHTML = L.map(([s, n, i]) => `<button type="button" class="l2-btn" data-s="${s}">${i} ${E(n)}</button>`).join('');
    w.querySelectorAll('button').forEach((b) => { b.onclick = () => pickScope(b.getAttribute('data-s')); });
    act.insertBefore(w, act.firstChild);
  }

  /* زر واتساب الدعم */
  const waNum = () => { const S = (DB && DB.settings) || {}; let v = String(S.supportWa || pub().w || '').replace(/[^\d]/g, '');
    if (/^05\d{8}$/.test(v)) v = '966' + v.slice(1); else if (/^5\d{8}$/.test(v)) v = '966' + v; else if (/^00/.test(v)) v = v.slice(2); return v.length >= 9 ? v : ''; };
  const WA = '<svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><path fill="#fff" d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3zm0 23.6c-2 0-4-.6-5.7-1.6l-.4-.2-3.9 1 1-3.8-.3-.4A10.6 10.6 0 1 1 16 26.6zm5.8-7.9c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7 0a8.7 8.7 0 0 1-4.3-3.8c-.3-.6.3-.5.9-1.6.1-.2 0-.4 0-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.9.4 3.6 3.6 0 0 0-1.1 2.7 6.3 6.3 0 0 0 1.3 3.3 14.4 14.4 0 0 0 5.5 4.9c2 .9 2.8 1 3.9.8a3.3 3.3 0 0 0 2.1-1.5 2.7 2.7 0 0 0 .2-1.5c-.1-.1-.3-.2-.5-.3z"/></svg>';
  function waButton() {
    const num = waNum(), login = document.getElementById('login'), onLogin = login && !login.classList.contains('hidden');
    let b = document.getElementById('l3Wa');
    if (!num || !onLogin) { if (b) b.remove(); return; }
    const S = (DB && DB.settings) || {};
    const txt = 'السلام عليكم، لدي مشكلة في الدخول إلى منصة ' + (S.college || 'كلية الأعمال') + '.\nالاسم: \nاللجنة/القسم: ';
    const href = 'https://wa.me/' + num + '?text=' + encodeURIComponent(txt);
    if (!b) { b = document.createElement('a'); b.id = 'l3Wa'; b.target = '_blank'; b.rel = 'noopener'; b.innerHTML = '<span class="c">' + WA + '</span><span class="t">تواجه مشكلة في الدخول؟ تواصل معنا</span>'; document.body.appendChild(b); }
    b.href = href; b.setAttribute('aria-label', 'تواصل عبر واتساب');
  }
  /* إعداد الرقم: الإعدادات العامة ← الهوية والمسميات */
  if (typeof window.setIdentity === 'function') { const _si = window.setIdentity; window.setIdentity = function () {
      const h = _si.apply(this, arguments); const v = ((DB.settings || {}).supportWa) || '';
      return `<div class="panel"><h3>💬 زر واتساب الدعم في صفحة الدخول</h3><div class="body"><p class="small muted" style="margin-top:0">يظهر أسفل يسار صفحة الدخول لمن لا يستطيع الدخول، ويفتح محادثة واتساب مع هذا الرقم برسالة جاهزة. اترك الخانة فارغة لإخفاء الزر.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end"><label class="f" style="flex:1;min-width:220px">رقم الجوال (واتساب)<input id="l3WaIn" dir="ltr" value="${E(v)}" placeholder="05xxxxxxxx"></label>
        <button class="btn primary" onclick="dmsWaSave()">حفظ الرقم</button></div></div></div>` + h; }; }
  window.dmsWaSave = function () {
    if (!owner()) return; const v = (document.getElementById('l3WaIn').value || '').trim();
    if (v && !/^[+\d\s-]{9,16}$/.test(v)) { alert('اكتب رقم جوال صحيحًا، مثل 05xxxxxxxx'); return; }
    DB.settings.supportWa = v; try { audit('رقم واتساب الدعم', v ? 'تحديد' : 'إزالة', ''); } catch (e) {}
    save(); toast(v ? 'حُفظ الرقم، ويظهر الزر في صفحة الدخول' : 'أُخفي زر واتساب');
  };

  const st = document.createElement('style');
  st.textContent = `
  #login.l2 #tiles.l3{display:flex;flex-wrap:wrap;gap:20px;align-items:stretch;overflow-x:clip}
  #login.l2 .l3-dep{isolation:isolate;contain:paint}
  #login.l2 #tiles.l3>*{flex:0 0 100%;min-width:0}
  #login.l2 #tiles.l3>.tile{flex:0 0 calc((100% - (var(--n) - 1) * 20px) / var(--n));width:auto}
  #login.l2 .l3-dep{all:unset;box-sizing:border-box;cursor:pointer;border-radius:22px;padding:22px 24px;color:#fff;position:relative;overflow:hidden;min-height:168px;display:flex;flex-direction:column;gap:6px;box-shadow:0 10px 26px rgba(74,42,140,.18);transition:transform .15s}
  #login.l2 .l3-dep:hover{transform:translateY(-3px)}
  #login.l2 .l3-dep:after{content:"";position:absolute;width:190px;height:190px;border-radius:50%;background:rgba(255,255,255,.09);left:-50px;bottom:-70px;pointer-events:none}
  #login.l2 .l3-dep-ic{width:58px;height:58px;border-radius:16px;background:rgba(255,255,255,.16);display:grid;place-items:center}
  #login.l2 .l3-dep-ic svg{stroke:#fff;color:#fff}
  #login.l2 .l3-dep .tile-n{font-size:23px;font-weight:800;color:#fff}
  #login.l2 .l3-dep small{font-size:14px;opacity:.92;color:#fff}
  #login.l2 .l3-dep-go{align-self:flex-start;margin-top:10px;background:#fff;color:#3a2470;border-radius:12px;padding:10px 18px;font-weight:800;font-size:15px;position:relative;z-index:1}
  #login.l2 .l3-dep.one{flex-direction:row;align-items:center;gap:18px;min-height:120px}
  #login.l2 .l3-dep.one .l3-dep-b{display:grid;grid-template-columns:1fr auto;align-items:center;column-gap:16px;row-gap:4px;flex:1}
  #login.l2 .l3-dep.one .l3-dep-b>b,#login.l2 .l3-dep.one .l3-dep-b>small{grid-column:1}
  #login.l2 .l3-dep.one .l3-dep-go{grid-column:2;grid-row:1/3;align-self:center;margin:0}
  #login.l2 .l3-dep:not(.one) .l3-dep-b{display:flex;flex-direction:column;gap:4px}
  #login.l2 .l3-sq{all:unset;box-sizing:border-box;cursor:pointer;background:#fff;border:1px solid #E7E0F4;border-radius:18px;padding:20px 12px 16px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px;transition:box-shadow .15s,transform .15s}
  #login.l2 .l3-sq:hover{box-shadow:0 10px 24px rgba(74,42,140,.14);transform:translateY(-2px)}
  #login.l2 .l3-sq-ic{width:62px;height:62px;border-radius:16px;background:#F1ECFA;display:grid;place-items:center}
  #login.l2 .l3-sq .tile-n{font-size:17px;font-weight:800;color:#1E1240;line-height:1.5;min-height:52px;display:flex;align-items:center}
  #login.l2 .l3-ch i{font-style:normal;font-size:12px;background:#F1ECFA;color:#5A3A99;border-radius:999px;padding:2px 9px;margin:2px;display:inline-block}
  #login.l2 .l3-go{background:#5A33A6;color:#fff;border-radius:10px;padding:7px 20px;font-weight:800;font-size:14px;margin-top:auto}
  .l3-lead{display:flex;gap:8px}.l3-lead .l2-btn{font-size:16px!important;font-weight:800!important;padding:9px 18px!important}
  @media (max-width:1100px){.l3-lead .l2-btn{font-size:14.5px!important;padding:8px 12px!important}}
  @media (max-width:980px){.l3-lead{display:none}#login.l2 #tiles.l3>.l3-sq{--n:3!important}}
  @media (max-width:760px){#login.l2 #tiles.l3>.l3-dep{--n:1!important}#login.l2 #tiles.l3>.l3-sq{--n:2!important}#login.l2 #tiles.l3{gap:14px}#login.l2 #tiles.l3>.tile{flex-basis:calc((100% - (var(--n) - 1) * 14px) / var(--n))}#login.l2 .l3-dep{min-height:0}#login.l2 .l3-dep.one{flex-direction:column;align-items:flex-start}#login.l2 .l3-dep.one .l3-dep-b{display:flex;flex-direction:column;align-items:flex-start}#login.l2 .l3-sq .tile-n{font-size:15.5px;min-height:46px}}
  #l3Wa{position:fixed;left:22px;bottom:22px;z-index:8000;display:flex;align-items:center;gap:10px;text-decoration:none;font-family:inherit}
  #l3Wa .c{width:60px;height:60px;border-radius:50%;background:#25D366;display:grid;place-items:center;box-shadow:0 8px 22px rgba(37,211,102,.45);flex:none}
  #l3Wa .t{background:#fff;border:1px solid #d9f3e2;border-radius:12px;padding:8px 12px;font-size:13.5px;font-weight:700;color:#1d6b3c;box-shadow:0 6px 18px rgba(0,0,0,.08)}
  @media (max-width:640px){#l3Wa .t{display:none}#l3Wa{left:14px;bottom:14px}}
  body:has(#vzBar) #l3Wa{bottom:62px}
  #l3Pick{position:fixed;inset:0;background:rgba(30,18,64,.45);z-index:9500;display:grid;place-items:center;padding:16px}
  #l3Pick .l3-pk{background:#fff;border-radius:18px;padding:20px;min-width:280px;display:flex;flex-direction:column;gap:8px}
  #l3Pick button{border:1.5px solid #E3DAF3;background:#F7F4FC;border-radius:12px;padding:10px;font:inherit;font-weight:700;cursor:pointer}#l3Pick button.x{background:#fff}`;
  document.head.appendChild(st);

  function tick() { try { topLinks(); waButton(); } catch (e) {} }
  if (typeof go === 'function') { const _g = go; go = function () { const r = _g.apply(this, arguments); tick(); return r; }; }
  if (typeof enter === 'function') { const _en = enter; enter = function () { const r = _en.apply(this, arguments); tick(); return r; }; }
  const _rl2 = renderLanding; renderLanding = function () { const r = _rl2.apply(this, arguments); tick(); return r; }; window.renderLanding = renderLanding;
  setInterval(tick, 3000);
  try { const lg = document.getElementById('login'); if (lg && !lg.classList.contains('hidden') && DB && DB.committees) renderLanding(); else tick(); } catch (e) {}
})();

/* ======================= 3.7: الهوية البصرية — الشعار واسم الجامعة وخلفية صفحة الدخول ======================= */
/* إضافة فقط. الإعدادات في «المسميات» العامة (labels) فتُقرأ قبل الدخول:
   brandLogo: '1' لإظهار الشعار (الافتراضي مخفي) · brandName / brandSub: نص الشريط العلوي
   hideUni: '0' لإظهار اسم الجامعة (الافتراضي مخفي) من الواجهة ولوحات الموقع · bgTheme: خلفية صفحة الدخول */
(function () {
  if (window.__dmsBrand) return; window.__dmsBrand = true;
  const E = (s) => (typeof esc === 'function' ? esc(s) : String(s == null ? '' : s));
  const owner = () => !!(typeof ME !== 'undefined' && ME && ME.isAdmin);
  const _DB = () => (typeof DB !== 'undefined' ? DB : null);
  const LB = () => ((_DB() && _DB().settings && _DB().settings.labels) || {});
  const S = () => ((_DB() && _DB().settings) || {});
  const showLogo = () => LB().brandLogo === '1';
  const hideUni = () => LB().hideUni !== '0';  /* مخفي افتراضيًا */
  const brandName = () => (LB().brandName || '').trim() || (hideUni() ? (S().college || 'كلية الأعمال') : (S().university || 'جامعة الجوف'));
  const brandSub = () => { const v = LB().brandSub; if (v != null && String(v).trim()) return String(v).trim(); return hideUni() ? 'منصة أعمال اللجان والأقسام' : (showLogo() ? 'Jouf University' : (S().college || '')); };

  /* ---------- الخلفيات (رسوم SVG من إنشائنا، بلا صور خارجية) ---------- */
  const enc = (svg) => 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  const STAR = (() => { let p = ''; const c = 30, r1 = 22, r2 = 10; for (let i = 0; i < 16; i++) { const a = Math.PI / 8 * i, r = i % 2 ? r2 : r1; p += (i ? 'L' : 'M') + (c + r * Math.sin(a)).toFixed(1) + ' ' + (c - r * Math.cos(a)).toFixed(1); } return p + 'Z'; })();
  const BG = {
    none: { n: 'بدون خلفية (الحالية)', css: '' },
    geo: { n: 'زخرفة هندسية إسلامية', css: `#login.l2{background-color:#F7F4FC;background-image:${enc(`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><path d="${STAR}" fill="none" stroke="#6A3FB5" stroke-opacity=".10" stroke-width="1.2"/><circle cx="30" cy="30" r="4" fill="#6A3FB5" fill-opacity=".06"/><path d="M0 0L8 8M60 0L52 8M0 60L8 52M60 60L52 52" stroke="#6A3FB5" stroke-opacity=".08"/></svg>`)};background-attachment:fixed}` },
    najdi: { n: 'مثلثات نجدية (طابع سعودي)', css: `#login.l2{background-color:#F7F4FC;background-image:linear-gradient(#F7F4FC,#F7F4FC)}
      #login.l2 .l2-bar::after{content:"";position:absolute;left:0;right:0;top:100%;height:26px;pointer-events:none;background-image:${enc(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="26"><path d="M0 0L12 20L24 0ZM24 0L36 20L48 0Z" fill="#6A3FB5" fill-opacity=".22"/><path d="M12 0L18 10L24 0ZM36 0L42 10L48 0Z" fill="#C9A227" fill-opacity=".35"/></svg>`)};background-repeat:repeat-x;background-size:48px 26px}
      #login.l2 .l2-foot{background-image:${enc(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="26"><path d="M0 0L12 20L24 0ZM24 0L36 20L48 0Z" fill="#fff" fill-opacity=".12"/></svg>`)},linear-gradient(90deg,#4A2A8C,#6A3FB5);background-repeat:repeat-x,no-repeat}`, sw: `background-color:#F7F4FC;background-image:${enc(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="26"><path d="M0 0L12 20L24 0ZM24 0L36 20L48 0Z" fill="#6A3FB5" fill-opacity=".22"/><path d="M12 0L18 10L24 0ZM36 0L42 10L48 0Z" fill="#C9A227" fill-opacity=".35"/></svg>`)};background-repeat:repeat-x;background-size:48px 26px` },
    ledger: { n: 'دفتر محاسبي وخط بياني', css: `#login.l2{background-color:#F8F6FC;background-image:${enc(`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="520" viewBox="0 0 1400 520"><g stroke="#6A3FB5" stroke-opacity=".07"><path d="M0 60H1400M0 100H1400M0 140H1400M0 180H1400M0 220H1400M0 260H1400M0 300H1400M0 340H1400M0 380H1400M0 420H1400M0 460H1400"/><path d="M180 0V520M1220 0V520" stroke-opacity=".12"/></g><path d="M40 420L200 380L340 400L480 330L620 350L760 270L900 290L1040 200L1180 220L1360 120" fill="none" stroke="#6A3FB5" stroke-opacity=".16" stroke-width="4"/><path d="M40 420L200 380L340 400L480 330L620 350L760 270L900 290L1040 200L1180 220L1360 120V520H40Z" fill="#6A3FB5" fill-opacity=".04"/><g fill="#6A3FB5" fill-opacity=".10" font-family="monospace" font-size="18"><text x="1240" y="95">12,500</text><text x="1240" y="175">8,200</text><text x="1240" y="255">15,000</text><text x="1240" y="335">4,900</text><text x="60" y="135">%</text><text x="60" y="215">Σ</text></g></svg>`)};background-repeat:no-repeat;background-position:center 60px;background-size:1400px auto}` },
    waves: { n: 'تدرج ناعم وأمواج', css: `#login.l2{background-color:#F7F4FC;background-image:${enc(`<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="420" viewBox="0 0 1440 420" preserveAspectRatio="none"><path d="M0 0H1440V250C1200 330 1000 210 720 260C440 310 240 380 0 300Z" fill="#6A3FB5" fill-opacity=".10"/><path d="M0 0H1440V190C1180 260 960 150 700 200C430 250 220 300 0 240Z" fill="#8F6BD3" fill-opacity=".10"/></svg>`)};background-repeat:no-repeat;background-size:100% 420px;background-position:0 70px}` },
    dots: { n: 'نقاط ودوائر عصرية', css: `#login.l2{background-color:#F7F4FC;background-image:radial-gradient(circle at 12% 18%,rgba(143,107,211,.18) 0,rgba(143,107,211,0) 260px),radial-gradient(circle at 88% 30%,rgba(201,162,39,.14) 0,rgba(201,162,39,0) 240px),radial-gradient(rgba(106,63,181,.13) 1.3px,transparent 1.6px);background-size:auto,auto,22px 22px;background-attachment:fixed}` },
  };
  window.DMS_BG = BG;
  function applyBg() {
    let st = document.getElementById('dmsBgCss'); if (!st) { st = document.createElement('style'); st.id = 'dmsBgCss'; document.head.appendChild(st); }
    const k = BG[LB().bgTheme] ? LB().bgTheme : 'none'; st.textContent = BG[k].css.replace(/;(?=[a-z-]+:)/g, '!important;').replace(/([^;!])\}/g, '$1!important}');
  }

  /* ---------- الشريط العلوي لصفحة الدخول ---------- */
  function applyBrand() {
    try {
      const b = document.querySelector('#login .l2-brand'); if (!b) return;
      const lg = b.querySelector('.l2-logo'); if (lg) lg.style.display = showLogo() ? '' : 'none';
      const t = b.querySelector('.l2-uni b'), sm = b.querySelector('.l2-uni small');
      if (t) t.textContent = brandName(); if (sm) { const v = brandSub(); sm.textContent = v; sm.style.display = v ? '' : 'none'; }
      if (hideUni()) {
        const org = document.getElementById('lgOrg'); if (org) org.textContent = S().college || '';
        const ft = document.querySelector('#login .l2-foot'); if (ft) { const sp = ft.querySelectorAll('span'), sep = ft.querySelector('i'), u = (S().university || '').trim();
          if (sp.length > 2 && (sp[0].textContent.trim() === 'جامعة الجوف' || (u && sp[0].textContent.trim() === u))) { sp[0].remove(); if (sep) sep.remove(); } }
      }
      applyBg();
    } catch (e) { console.warn('brand', e); }
  }
  /* اسم الجامعة يُخفى من العرض فقط (يبقى محفوظًا في «الإعدادات ← عام») */
  const onSettings = (a) => (a && a[0] === 'settings') || (!(a && a.length) && typeof VIEW !== 'undefined' && VIEW && VIEW.page === 'settings');
  const blankUni = (fn) => function () {
    if (!hideUni() || !_DB() || !DB.settings || onSettings(arguments)) return fn.apply(this, arguments);
    const s = DB.settings, u = s.university; s.university = '';
    try { return fn.apply(this, arguments); } finally { s.university = u; }
  };
  const fixUniText = () => { if (!hideUni()) return;
    const so = document.getElementById('sideOrg'), un = (S().university || '').trim(); if (so && un) so.textContent = so.textContent.split(un).join(''); if (so) so.textContent = so.textContent.replace(/\s*[–-]\s*$/, '').replace(/^\s*[–-]\s*/, '').trim();
    const org = document.getElementById('lgOrg'); if (org) org.textContent = org.textContent.replace(/^\s*·\s*/, '').trim();
    document.querySelectorAll('#main .filters .small, #main .small.muted').forEach((el) => { if (el.children.length) return; const t = el.textContent, n = t.replace(/\s*[–-]\s*(?=·|$)/g, ' ').replace(/^\s*[–-]\s*/, '').replace(/\s{2,}/g, ' ').trim(); if (n !== t.trim()) el.textContent = n; }); };
  if (typeof renderLanding === 'function') { const _r = renderLanding; renderLanding = blankUni(function () { const x = _r.apply(this, arguments); applyBrand(); fixUniText(); return x; }); window.renderLanding = renderLanding; }
  if (typeof enter === 'function') { const _e = enter; enter = blankUni(function () { const x = _e.apply(this, arguments); fixUniText(); return x; }); }
  if (typeof go === 'function') { const _g = go; go = blankUni(function () { const x = _g.apply(this, arguments); fixUniText(); return x; }); window.go = go; }
  if (typeof refresh === 'function') { const _f = refresh; refresh = blankUni(function () { const x = _f.apply(this, arguments); fixUniText(); return x; }); }

  /* ---------- الإعدادات: الإعدادات العامة ← الهوية والمسميات ---------- */
  if (typeof window.setIdentity === 'function') { const _si = window.setIdentity; window.setIdentity = function () {
      const h = _si.apply(this, arguments), L = LB(), cur = BG[L.bgTheme] ? L.bgTheme : 'none';
      const swCss = Object.keys(BG).map((k) => BG[k].sw ? `.bgsw-${k}{${BG[k].sw}}` : BG[k].css.replace(/#login\.l2 \.l2-foot\{[^}]*\}/, '').split('#login.l2').join('.bgsw-' + k).replace(/background-attachment:fixed/g, '') + `.bgsw-${k}{background-position:0 0!important;background-size:${k === 'ledger' ? '420px auto' : k === 'waves' ? '100% 90px' : k === 'najdi' ? '48px 26px,100% 100%' : ''}}`).join('\n');
      const sw = (k) => `<label style="cursor:pointer;display:flex;flex-direction:column;gap:6px;width:150px"><span class="bgsw-${k}" style="display:block;height:84px;border-radius:10px;border:2px solid ${k === cur ? '#6A3FB5' : '#ddd'};${k === 'none' ? 'background:#F7F4FC' : ''}"></span><span style="display:flex;gap:6px;align-items:center;font-size:13px"><input type="radio" name="dmsBg" value="${k}" ${k === cur ? 'checked' : ''} style="width:auto;flex:0 0 auto" onchange="document.querySelectorAll('[class^=bgsw-]').forEach(function(x){x.style.borderColor='#ddd'});this.closest('label').querySelector('span').style.borderColor='#6A3FB5'"> ${E(BG[k].n)}</span></label>`;
      return `<div class="panel"><h3>🏛 الشعار واسم الجامعة وخلفية صفحة الدخول</h3><div class="body">
        <label class="check"><input type="checkbox" id="brLogo" ${L.brandLogo === '1' ? 'checked' : ''}> إظهار شعار الجامعة في الشريط العلوي لصفحة الدخول</label>
        <label class="check"><input type="checkbox" id="brUni" ${L.hideUni !== '0' ? 'checked' : ''}> إخفاء اسم الجامعة من صفحة الدخول ولوحات الموقع (يبقى محفوظًا في تبويب «عام» ويعود بإلغاء هذا الخيار)</label>
        <div class="formgrid" style="margin-top:8px"><label class="f">النص الرئيسي في الشريط العلوي<input id="brName" value="${E(L.brandName || '')}" placeholder="${E(brandName())}"></label>
          <label class="f">النص الصغير تحته (اتركه فارغًا للافتراضي)<input id="brSub" value="${E(L.brandSub || '')}" placeholder="${E(brandSub())}"></label></div>
        <style>${swCss}</style><div style="margin:12px 0 6px;font-weight:700">خلفية صفحة الدخول</div><div style="display:flex;gap:12px;flex-wrap:wrap">${Object.keys(BG).map(sw).join('')}</div>
        <div style="display:flex;gap:8px;margin-top:12px"><button class="btn primary" onclick="dmsBrandSave()">حفظ</button><button class="btn" onclick="dmsBrandPreview()">👁 معاينة صفحة الدخول</button></div>
        <p class="small muted" style="margin-bottom:0">التغيير يظهر للجميع في صفحة الدخول بعد الحفظ مباشرة. الخلفيات رسوم مصممة داخل الموقع، فلا تحتاج إلى صور خارجية ولا تبطئ التحميل.</p></div></div>` + h; }; }
  window.dmsBrandSave = function () {
    if (!owner()) return; const g = (id) => document.getElementById(id); DB.settings.labels = DB.settings.labels || {}; const L = DB.settings.labels;
    L.brandLogo = g('brLogo').checked ? '1' : '0'; L.hideUni = g('brUni').checked ? '1' : '0';
    L.brandName = g('brName').value.trim(); L.brandSub = g('brSub').value.trim();
    const r = document.querySelector('input[name="dmsBg"]:checked'); L.bgTheme = r ? r.value : 'none';
    try { audit('الهوية البصرية', 'الشعار: ' + (L.brandLogo === '1' ? 'ظاهر' : 'مخفي') + '، اسم الجامعة: ' + (L.hideUni ? 'مخفي' : 'ظاهر') + '، الخلفية: ' + BG[L.bgTheme].n, ''); } catch (e) {}
    save(); applyBrand(); refresh(); toast('حُفظت الهوية البصرية');
  };
  window.dmsBrandPreview = function () { const u = location.origin + location.pathname; window.open(u + (u.includes('?') ? '&' : '?') + 'preview=' + Date.now(), '_blank'); };
  applyBrand(); setTimeout(applyBrand, 800); setTimeout(applyBrand, 2500);
})();
