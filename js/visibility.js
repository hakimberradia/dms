/* =====================================================================
   v3.3 — إظهار وإخفاء الأنظمة حسب القسم + وضع الصيانة (إضافة مستقلة)
   - المالك يخفي أي نظام عن قسم معين (أو عن مستوى الكلية) ويعيد إظهاره متى شاء.
     النظام المخفي لا يظهر لمستخدمي ذلك القسم في أي مكان، ويبقى ظاهرًا للمالك للتجربة مع شارة «مخفي».
     البيانات لا تُمس إطلاقًا.
   - وضع الصيانة بثلاث حالات: تشغيل عادي / تنبيه مسبق / صيانة (الموقع مغلق لغير المالك).
   - الحالة تُحفظ في الإعدادات، ونسخة منها في المسميات العامة لتظهر في صفحة الدخول
     وصفحة الاختبار وصفحة التقديم قبل تسجيل الدخول (دون أي تعديل في قاعدة البيانات).
   ===================================================================== */
(function () {
  'use strict';
  if (typeof go !== 'function' || typeof appComms !== 'function') return;
  const E = (s) => (typeof esc === 'function' ? esc(s) : String(s == null ? '' : s));
  const owner = () => !!(typeof ME !== 'undefined' && ME && ME.isAdmin);
  const MIRROR = '__dms';
  const MODES = { off: 'تشغيل عادي', notice: 'تنبيه بصيانة قادمة', on: 'صيانة — الموقع مغلق' };

  /* ---------- قراءة الحالة: من الإعدادات بعد الدخول، أو من المسميات العامة قبل الدخول ---------- */
  function mirror() { try { const L = (DB && DB.settings && DB.settings.labels) || {}; return L[MIRROR] ? JSON.parse(L[MIRROR]) : {}; } catch (e) { return {}; } }
  function hiddenMap() { const S = (DB && DB.settings) || {}; return S.sysHidden || mirror().h || {}; }
  function maint() { const S = (DB && DB.settings) || {}; const m = S.maint || mirror().m || {}; return { mode: MODES[m.mode] ? m.mode : 'off', msg: m.msg || '', until: m.until || '', by: m.by || '', at: m.at || '' }; }
  const hid = (k) => (hiddenMap()[k] || []);
  const scopeOfComm = (cid) => { const c = ((DB && DB.committees) || []).find((x) => x.id === cid); return !c ? '' : (c.level === 'college' && !c._sharedTmp) ? 'college' : (c.dept || ''); };
  const scopeName = (sc) => sc === 'college' ? 'مستوى الكلية' : (typeof deptName === 'function' ? deptName(sc) : sc);
  window.dmsSysHiddenIn = (k, sc) => hid(k).includes(sc);

  /* نسخة الحالة في المسميات العامة (تُقرأ قبل الدخول) — تُحدَّث تلقائيًا مع كل حفظ يقوم به المالك */
  function syncMirror() {
    if (!owner() || !DB || !DB.settings) return;
    const S = DB.settings; const v = JSON.stringify(Object.assign({ h: S.sysHidden || {}, m: S.maint || { mode: 'off' } }, Array.isArray(S.repeatTypes) ? { r: S.repeatTypes } : {}, S.supportWa ? { w: String(S.supportWa) } : {}));
    S.labels = S.labels || {}; if (S.labels[MIRROR] !== v) S.labels[MIRROR] = v;
  }
  { const _sv = save; save = function () { try { syncMirror(); } catch (e) {} return _sv.apply(this, arguments); }; }

  /* ---------- الإخفاء: تُستبعد لجان القسم المخفي من ربط النظام لغير المالك ---------- */
  /* هذا وحده يخفي النظام من القائمة الجانبية وصفحة اللجنة والصفحة الرئيسية والبحث والدخول المباشر وشرائح صفحة الدخول */
  { const _ac = appComms; appComms = function (k) {
      const cs = _ac.apply(this, arguments); if (owner()) return cs;
      const H = hid(k); if (!H.length) return cs;
      return cs.filter((cid) => !H.includes(scopeOfComm(cid)));
    }; }
  /* وحدات اللجنة المدمجة (قياس المخرجات والزيارات) في تبويب «الأنظمة» */
  if (typeof toolsPanel === 'function') { const _tp = toolsPanel; toolsPanel = function (c) {
      const sc = c && (c.level === 'college' ? 'college' : c.dept);
      if (!owner()) {
        const mods = (c.modules || []); const keep = mods.filter((m) => !hid(m).includes(sc));
        if (keep.length === mods.length) return _tp.apply(this, arguments);
        return _tp.call(this, Object.assign({}, c, { modules: keep }));
      }
      let h = _tp.apply(this, arguments);
      /* المالك: شارة على الأنظمة المخفية عن هذا القسم */
      const A = allApps();
      Object.keys(A).concat(Object.keys(typeof MODULE_DEF === 'object' ? MODULE_DEF : {})).forEach((k) => {
        if (!hid(k).includes(sc)) return;
        const nm = (A[k] && A[k].name) || (MODULE_DEF[k] && MODULE_DEF[k].name);
        if (nm) h = h.split('<b>' + E(nm) + '</b>').join('<b>' + E(nm) + '</b> <span class="vz-badge" title="لا يراه مستخدمو هذا القسم">🙈 مخفي — يظهر لك فقط</span>');
      });
      return h;
    }; }
  /* فتح النظام: منع غير المالك من فتح نظام مخفي عن قسمه، وتنبيه المالك أثناء التجربة */
  if (typeof openTool === 'function') { const _ot = openTool; openTool = async function (a) {
      let sc = ''; try { const A = allApps()[a], c = A && comm(A.committee); sc = (c && c.level === 'college') ? 'college' : ((SCOPE && deptOf(SCOPE)) || curDept() || 'college'); } catch (e) {}
      const blocked = hid(a).includes(sc) || !(appComms(a) || []).length;
      if (blocked && !owner()) { toast('هذا النظام غير متاح حاليًا لقسمك.'); go('home'); return; }
      const r = await _ot.apply(this, arguments);
      if (blocked && owner()) { const bar = document.getElementById('toolBar');
        if (bar && !bar.querySelector('.vz-badge')) bar.insertAdjacentHTML('afterbegin', `<span class="vz-badge" title="من «الأنظمة والتحديثات» ← إظهار الأنظمة حسب القسم">🙈 مخفي عن ${E(scopeName(sc))} — يظهر لك فقط للتجربة</span>`); }
      return r;
    }; }

  /* ---------- لوحة المالك ---------- */
  function sysList() {
    const A = allApps(), out = [];
    Object.keys(A).forEach((k) => { if (!A[k].disabled) out.push({ k, name: A[k].name }); });
    if (typeof MODULE_DEF === 'object') Object.entries(MODULE_DEF).forEach(([k, d]) => { const m = ((DB.settings.appMeta || {})[k]) || {}; if (!m.disabled) out.push({ k, name: m.name || d.name }); });
    return out;
  }
  function scopesOf(k) { const s = new Set(); appComms(k).forEach((cid) => { const x = scopeOfComm(cid); if (x) s.add(x); }); return s; }
  function visPanel() {
    const cols = (DB.departments || []).map((d) => ({ id: d.id, name: d.name })).concat([{ id: 'college', name: 'مستوى الكلية (مشترك)' }]);
    const rows = sysList().map((s) => { const on = scopesOf(s.k);
      return `<tr><td><b>${E(s.name)}</b></td>${cols.map((c) => { if (!on.has(c.id)) return '<td class="vz-na">—</td>';
        const h = hid(s.k).includes(c.id);
        return `<td><button class="vz-tg ${h ? 'off' : 'on'}" onclick="dmsVisToggle('${E(s.k)}','${E(c.id)}')">${h ? '🙈 مخفي' : '👁 ظاهر'}</button></td>`; }).join('')}</tr>`; }).join('');
    return `<div class="panel vz-panel" id="vzVis"><h3>👁 إظهار الأنظمة وإخفاؤها حسب القسم</h3><div class="body">
      <p class="small" style="margin-top:0">اضغط الزر لتبديل الحالة. <b>النظام المخفي</b> لا يراه مستخدمو ذلك القسم في أي مكان (القائمة، صفحة اللجنة، صفحة الدخول، الدخول المباشر)،
      ويبقى <b>ظاهرًا لك وحدك</b> مع شارة «مخفي» لتجربته. <b>البيانات لا تتأثر</b>، وعند الإظهار يعود كما كان.</p>
      <div class="tbl-wrap"><table class="t vz-t"><tr><th>النظام</th>${cols.map((c) => `<th>${E(c.name)}</th>`).join('')}</tr>${rows}</table></div>
      <p class="small muted">«—» تعني أن النظام غير مرتبط بلجنة في هذا القسم. الإخفاء هنا غير «التعطيل» الذي يخفي النظام عن الجميع بمن فيهم أنت.</p></div></div>`;
  }
  window.dmsVisToggle = function (k, sc) {
    if (!owner()) return;
    const S = DB.settings; S.sysHidden = Object.assign({}, S.sysHidden || {});
    const L = new Set(S.sysHidden[k] || []), was = L.has(sc); was ? L.delete(sc) : L.add(sc);
    if (L.size) S.sysHidden[k] = [...L]; else delete S.sysHidden[k];
    const nm = (sysList().find((x) => x.k === k) || {}).name || k;
    try { audit(was ? 'إظهار نظام لقسم' : 'إخفاء نظام عن قسم', nm, scopeName(sc)); } catch (e) {}
    save(); refresh(); toast((was ? 'أصبح ظاهرًا: ' : 'أصبح مخفيًا: ') + nm + ' — ' + scopeName(sc));
  };

  function maintPanel() {
    const m = maint();
    const opt = (v) => `<label class="vz-mode ${m.mode === v ? 'sel' : ''}"><input type="radio" name="vzM" value="${v}" ${m.mode === v ? 'checked' : ''}> <b>${MODES[v]}</b><small>${
      v === 'off' ? 'الموقع يعمل للجميع.' : v === 'notice' ? 'يعمل الموقع، مع شريط تنبيه للجميع (وفي صفحة الاختبار والتقديم) بموعد الصيانة.' : 'الموقع مغلق لكل المستخدمين عدا المالك. صفحة الاختبار والتقديم تعرض رسالة الصيانة، والطالب الذي بدأ اختباره يكمله ويسلّمه.'}</small></label>`;
    return `<div class="panel vz-panel" id="vzMaint"><h3>🛠 وضع الصيانة <span class="vz-st ${m.mode}">${MODES[m.mode]}</span></h3><div class="body">
      <div class="vz-modes">${opt('off')}${opt('notice')}${opt('on')}</div>
      <div class="formgrid" style="margin-top:10px"><label class="f full">الرسالة التي تظهر للمستخدمين<input id="vzMsg" value="${E(m.msg)}" placeholder="نعمل على تحديث الموقع لتحسين خدماتكم، ونعود قريبًا بإذن الله."></label>
        <label class="f full">الموعد المتوقع (اختياري)<input id="vzUntil" value="${E(m.until)}" placeholder="مثال: يعود الموقع الساعة 10 مساءً"></label></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn primary" onclick="dmsMaintSave()">حفظ وضع الصيانة</button></div>
      ${m.at ? `<p class="small muted">آخر تغيير: ${E(m.by)} · ${E(new Date(m.at).toLocaleString('ar-SA'))}</p>` : ''}
      <p class="small muted">قبل تفعيل «صيانة» تأكد أنه لا يوجد اختبار جارٍ للطلاب الآن. أنت (المالك) تدخل وتعمل كالمعتاد أثناء الصيانة.</p></div></div>`;
  }
  window.dmsMaintSave = function () {
    if (!owner()) return;
    const r = document.querySelector('input[name="vzM"]:checked'); const mode = r ? r.value : 'off';
    if (mode === 'on' && maint().mode !== 'on' && !confirm('تفعيل وضع الصيانة؟\n\nسيُغلق الموقع لكل المستخدمين عدا المالك، وتظهر لهم رسالة الصيانة حتى تعيده إلى «تشغيل عادي».')) return;
    DB.settings.maint = { mode, msg: (document.getElementById('vzMsg').value || '').trim(), until: (document.getElementById('vzUntil').value || '').trim(), by: (ME && ME.name) || '', at: new Date().toISOString() };
    try { audit('وضع الصيانة', MODES[mode], DB.settings.maint.msg); } catch (e) {}
    save(); refresh(); gate(); toast('تم الحفظ: ' + MODES[mode]);
  };
  /* ---------- ما يتكرر لكل قسم: لجنة الجاهزية فقط، والباقي مشترك ---------- */
  /* الإعداد repeatTypes: أنواع لجان القسم التي تُنشأ لكل قسم جديد. غير محدد = السلوك القديم (كلها تتكرر).
     النسخ الزائدة في الأقسام الأخرى تُزال إن كانت فارغة (بلا مهام ولا مؤشرات ولا ملفات ولا قياسات ولا أعضاء)، ولا تُمس لجان القسم الأساسي وبياناتها. */
  const pidOf = (D) => (D.settings && D.settings.primaryDept) || ((D.departments || [])[0] || {}).id || '';
  const usedComm = (D, id) => ['tasks', 'kpis', 'files', 'clo', 'visits'].some((k) => (D[k] || []).some((x) => x && x.committee === id))
    || (D.users || []).some((u) => u && u.memberships && u.memberships[id]);
  function pruneRepeats(D) {
    let rep = D && D.settings && D.settings.repeatTypes;
    /* قبل الدخول: الإعداد يصل من النسخة العامة في المسميات */
    if (!Array.isArray(rep)) { try { const L = (D && D.settings && D.settings.labels) || {}; rep = L[MIRROR] ? JSON.parse(L[MIRROR]).r : null; } catch (e) { rep = null; } }
    if (!Array.isArray(rep) || !Array.isArray(D.committees)) return;
    const pid = pidOf(D), gone = new Set();
    D.committees = D.committees.filter((c) => {
      if (c.level === 'college' || !c.dept || c.dept === pid || c.type === c.id || rep.includes(c.type)) return true;
      if (usedComm(D, c.id)) return true; gone.add(c.id); return false; });
    if (gone.size) D.templates = (D.templates || []).filter((t) => !gone.has(t.committee));
    /* اللجنة المشتركة تحمل اسمها دون اسم القسم */
    D.committees.forEach((c) => { if (c.type === c.id && c.level !== 'college' && c.baseName && !rep.includes(c.type) && c.name !== c.baseName) c.name = c.baseName; });
  }
  if (typeof ensureDepts === 'function') { const _ed = ensureDepts; ensureDepts = function (D) { const r = _ed.apply(this, arguments); try { pruneRepeats(D); } catch (e) {} return r; }; }
  function repeatPanel() {
    const S = DB.settings, rep = S.repeatTypes, origs = (DB.committees || []).filter((c) => c.level !== 'college' && c.type === c.id);
    const on = (t) => !Array.isArray(rep) || rep.includes(t);
    return `<div class="panel vz-panel" id="vzRep"><h3>🏛 ما يتكرر لكل قسم</h3><div class="body">
      <p class="small" style="margin-top:0">اللجان المؤشَّرة <b>تُنشأ لكل قسم</b> ببيانات مستقلة. غير المؤشَّرة <b>مشتركة للكلية</b>: لجنة واحدة يُضاف إليها أعضاء من كل الأقسام، وتُحذف نسخها الفارغة من الأقسام الأخرى (لا تُحذف أي لجنة فيها مهام أو أعضاء أو بيانات).</p>
      <div class="vz-modes">${origs.map((c) => `<label class="vz-mode"><span><input type="checkbox" data-rep="${E(c.id)}" ${on(c.id) ? 'checked' : ''}> <b>${E(c.baseName || c.name)}</b></span><small>${on(c.id) ? 'تتكرر لكل قسم' : 'مشتركة للكلية'}</small></label>`).join('')}</div>
      <div style="margin-top:10px"><button class="btn primary" onclick="dmsRepeatSave()">حفظ</button></div></div></div>`;
  }
  window.dmsRepeatSave = function () {
    if (!owner()) return;
    const rep = [...document.querySelectorAll('#vzRep input[data-rep]')].filter((x) => x.checked).map((x) => x.getAttribute('data-rep'));
    const before = (DB.committees || []).length;
    DB.settings.repeatTypes = rep; pruneRepeats(DB);
    const kept = (DB.committees || []).filter((c) => c.dept && c.dept !== pidOf(DB) && c.type !== c.id && !rep.includes(c.type));
    try { audit('ما يتكرر لكل قسم', rep.map((t) => (comm(t) || {}).name || t).join('، ') || 'لا شيء', ''); } catch (e) {}
    save(); refresh();
    toast('تم الحفظ' + (before - DB.committees.length ? ' — أُزيلت ' + (before - DB.committees.length) + ' لجنة فارغة مكررة' : ''));
    if (kept.length) alert('بقيت هذه اللجان لأن فيها مهام أو أعضاء أو بيانات:\n' + kept.map((c) => '• ' + c.name).join('\n'));
  };
  if (typeof window.pgDepts === 'function') { const _pd = window.pgDepts; window.pgDepts = function () { const h = _pd.apply(this, arguments); return owner() ? repeatPanel() + h : h; }; }
  if (typeof setSystems === 'function') { const _ss = setSystems; setSystems = function () { const h = _ss.apply(this, arguments); return owner() ? maintPanel() + repeatPanel() + visPanel() + h : h; }; }

  /* ---------- البوابة: شاشة الصيانة لغير المالك، وشريط التنبيه ---------- */
  const defMsg = 'نعمل على تحديث الموقع لتحسين خدماتكم، ونعود قريبًا بإذن الله.';
  function gate() {
    const m = maint(), loggedIn = typeof ME !== 'undefined' && !!ME;
    try { if (loggedIn) { if (owner()) localStorage.setItem('dms-maint-owner', '1'); else localStorage.removeItem('dms-maint-owner'); } } catch (e) {}
    let ov = document.getElementById('vzOverlay'), bar = document.getElementById('vzBar');
    const block = m.mode === 'on' && loggedIn && !owner();
    if (block && !ov) {
      ov = document.createElement('div'); ov.id = 'vzOverlay'; document.body.appendChild(ov);
      ov.innerHTML = `<div class="vz-box"><div class="vz-ic">🛠</div><h2>الموقع تحت الصيانة</h2><p>${E(m.msg || defMsg)}</p>${m.until ? `<p class="vz-until">${E(m.until)}</p>` : ''}
        <button class="btn" onclick="logout()">تسجيل الخروج</button></div>`;
    } else if (!block && ov) ov.remove();
    let txt = '', cls = '';
    if (m.mode === 'on' && (owner() || !loggedIn)) { txt = owner() ? '🛠 الموقع في وضع الصيانة — مغلق لكل المستخدمين عداك' : '🛠 الموقع تحت الصيانة: ' + (m.msg || defMsg) + (m.until ? ' — ' + m.until : ''); cls = 'on'; }
    else if (m.mode === 'notice') { txt = '⚠ ' + (m.msg || 'سيتوقف الموقع قريبًا للصيانة. احفظ عملك.') + (m.until ? ' — ' + m.until : ''); cls = 'notice'; }
    if (!txt || block) { if (bar) bar.remove(); return; }
    if (!bar) { bar = document.createElement('div'); bar.id = 'vzBar'; document.body.appendChild(bar); }
    bar.className = cls; bar.innerHTML = E(txt) + (owner() ? ` <a onclick="go('settings',{st:'systems'});setTimeout(()=>{const x=document.getElementById('vzMaint');if(x)x.scrollIntoView({behavior:'smooth'})},80)">تغيير</a>` : '');
  }
  window.dmsMaintGate = gate;
  /* صفحة الدخول قبل تسجيل الدخول: منع غير المالك من الدخول أثناء الصيانة */
  if (typeof pickScope === 'function') { const _ps = pickScope; pickScope = function (s) { const r = _ps.apply(this, arguments);
      try { const m = maint(), n = document.getElementById('lgPNote'); if (m.mode === 'on' && n && s !== 'owner') n.innerHTML = '<b style="color:#B3261E">الموقع تحت الصيانة الآن؛ الدخول متاح للمالك فقط.</b>'; } catch (e) {}
      return r; }; }
  { const _go = go; go = function () { const r = _go.apply(this, arguments); try { gate(); } catch (e) {} return r; }; }
  /* صفحة الدخول: اللجان المشتركة تظهر في «وحدات الكلية المشتركة»، وتحت كل قسم ما يتكرر له فقط (الجاهزية) */
  window.dmsRepTypes = () => repTypes(); window.dmsMirror = () => mirror();
  function repTypes() { const S = (DB && DB.settings) || {}; if (Array.isArray(S.repeatTypes)) return S.repeatTypes; const r = mirror().r; return Array.isArray(r) ? r : null; }
  if (typeof renderLanding === 'function') { const _rl = renderLanding; renderLanding = function () {
      const rep = repTypes(), tmp = [];
      if (rep && (DB.departments || []).length > 1) (DB.committees || []).forEach((c) => { if (c.level !== 'college' && c.type === c.id && !rep.includes(c.type)) { tmp.push([c, c.level, c.dept]); c._sharedTmp = true; c.level = 'college'; } });
      let r; try { r = _rl.apply(this, arguments); } finally { tmp.forEach(([c, l, d]) => { c.level = l; c.dept = d; delete c._sharedTmp; }); }
      try { gate(); } catch (e) {} return r; }; }
  if (typeof enter === 'function') { const _en = enter; enter = function () { const r = _en.apply(this, arguments); try { gate(); } catch (e) {} return r; }; }
  setInterval(() => { try { gate(); } catch (e) {} }, 20000);

  const st = document.createElement('style');
  st.textContent = `
  .vz-badge{display:inline-block;background:#FFF4E5;color:#8A4B00;border:1px solid #F3C98B;border-radius:999px;padding:1px 9px;font-size:12px;font-weight:700;white-space:nowrap;margin-inline:4px}
  .vz-panel .vz-t td,.vz-panel .vz-t th{text-align:center}.vz-panel .vz-t td:first-child,.vz-panel .vz-t th:first-child{text-align:start}
  .vz-na{color:#aaa}
  .vz-tg{border:1.5px solid;border-radius:999px;padding:4px 12px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;min-width:84px}
  .vz-tg.on{background:#E8F5E9;color:#1B5E20;border-color:#81C784}.vz-tg.off{background:#FFF4E5;color:#8A4B00;border-color:#F3C98B}
  .vz-modes{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px}
  .vz-mode{display:flex;flex-direction:column;gap:3px;border:1.5px solid var(--line,#ddd);border-radius:12px;padding:10px 12px;cursor:pointer}
  .vz-mode:has(input:checked),.vz-mode.sel{border-color:#6B3FA0;background:#F6F1FB}
  body:has(#vzBar) #toast{bottom:52px}.vz-mode small{color:#666;line-height:1.6}
  .vz-st{font-size:12px;border-radius:999px;padding:2px 10px;margin-inline-start:8px}.vz-st.off{background:#E8F5E9;color:#1B5E20}.vz-st.notice{background:#FFF4E5;color:#8A4B00}.vz-st.on{background:#FDECEA;color:#B3261E}
  #vzBar{position:fixed;inset-inline:0;bottom:0;z-index:9000;text-align:center;font-size:13.5px;font-weight:700;padding:7px 12px;line-height:1.6}
  #vzBar.notice{background:#FFF4E5;color:#7A4100;border-top:1px solid #F3C98B}#vzBar.on{background:#B3261E;color:#fff}
  #vzBar a{color:inherit;text-decoration:underline;cursor:pointer;margin-inline-start:8px}
  #vzOverlay{position:fixed;inset:0;z-index:99999;background:linear-gradient(160deg,#3D1F63,#6B3FA0);display:flex;align-items:center;justify-content:center;padding:16px}
  #vzOverlay .vz-box{background:#fff;border-radius:20px;max-width:460px;width:100%;padding:28px 22px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3)}
  #vzOverlay .vz-ic{font-size:52px}#vzOverlay h2{margin:8px 0;color:#3D1F63}#vzOverlay p{line-height:1.9;color:#333}#vzOverlay .vz-until{font-weight:700;color:#6B3FA0}`;
  document.head.appendChild(st);
  try { gate(); } catch (e) {}
  /* واجهة الدخول 3.4 (المقترح ج) وزر واتساب الدعم — ملف مستقل */
  try { if (!document.querySelector('script[src^="js/landing3.js"]')) { const sc = document.createElement('script'); sc.src = 'js/landing3.js?v=34'; document.body.appendChild(sc); } } catch (e) {}
})();
