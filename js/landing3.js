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
