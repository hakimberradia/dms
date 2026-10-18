/* =====================================================================
   v3.2 — التقارير والمتابعة لرئيس القسم ولوحة الكلية (قراءة فقط)
   إضافة مستقلة: لا تعدّل أي بيانات، وتعتمد على صلاحيات القراءة في قاعدة البيانات.
   - اختيار القسم ← بطاقات اللجان ← تقرير اللجنة: الإنجاز، المهام، المؤشرات، نتائج النظام، المقارنة.
   - نتائج الأنظمة: الجاهزية (الطلاب والاختبارات والنتائج والدورات)، التدريب، قياس المخرجات، الزيارات.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof go !== 'function') return;
  const $q = (s) => document.querySelector(s);
  const E = (s) => (typeof esc === 'function' ? esc(s) : String(s == null ? '' : s));
  const R1 = (x) => (Math.round(x * 10) / 10).toLocaleString('en-US');
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const T = (c) => c.type || c.id;
  const TYPE_ICON = { readiness: '🎯', training: '💼', exams: '📝', quality: '🏅', receptions: '🤝' };
  const allowed = () => { try { return !!ME && (canHeadDash() || (typeof canCollege === 'function' && canCollege())); } catch (e) { return false; } };
  const collegeView = () => { try { return isAdmin() || !!ME.collegeRole || SCOPE === 'college'; } catch (e) { return false; } };
  const depts = () => (DB.departments || []);
  const dName = (id) => { const d = depts().find((x) => x.id === id); return d ? d.name : (id === 'college' ? 'الكلية' : id || ''); };
  function selDept() {
    if (!collegeView()) return (typeof curDept === 'function' && curDept()) || (ME && ME.headDept) || (depts()[0] || {}).id || '';
    const v = VIEW.dept; if (v && (v === 'college' || depts().some((d) => d.id === v))) return v;
    return (typeof curDept === 'function' && curDept()) || (depts()[0] || {}).id || '';
  }
  const commsOf = (dept) => dept === 'college' ? DB.committees.filter((c) => c.level === 'college') : DB.committees.filter((c) => c.level !== 'college' && c.dept === dept);
  const tasksOf = (cid) => DB.tasks.filter((t) => t.committee === cid && t.status !== 'arch');
  const kpisOf = (cid) => (DB.kpis || []).filter((k) => k.committee === cid);
  function cStats(c) {
    const s = commStats(c.id), k = kpisOf(c.id), km = k.filter((x) => x.actual !== '' && x.actual != null);
    return { avg: s.avg, n: s.n, done: s.done, late: s.late, pend: s.pend || 0, kpi: k.length, kpiOk: k.filter(kpiMet).length, kpiMeasured: km.length, members: membersOf(c.id).length };
  }

  /* ---------- قراءة بيانات الأنظمة (للقراءة فقط) ---------- */
  const CACHE = new Map();
  async function readApp(app, scope, key) {
    const ck = app + '|' + scope + '|' + key; if (CACHE.has(ck)) return CACHE.get(ck);
    const p = (async () => {
      if (!window.SB) throw new Error('لا يوجد اتصال بقاعدة البيانات');
      const { data, error } = await SB.from('app_storage').select('value,updated_at').eq('app_key', app).eq('scope', scope).eq('key', key).maybeSingle();
      if (error) throw error; if (!data) return null;
      try { return { v: JSON.parse(data.value), at: data.updated_at }; } catch (e) { return null; }
    })();
    CACHE.set(ck, p); p.catch(() => CACHE.delete(ck)); return p;
  }
  /* الجاهزية */
  function readinessMetrics(db) {
    const th = (db.settings && db.settings.thresholds) || {}, ready = +(th.ready != null ? th.ready : 80), partial = +(th.partial != null ? th.partial : 60);
    const st = (db.students || []).filter((s) => s.active !== false), byId = new Map(st.map((s) => [s.id, s]));
    const res = (db.results || []).filter((r) => r && r.score != null && !isNaN(+r.score));
    const sc = res.map((r) => +r.score), avg = sc.length ? sc.reduce((a, b) => a + b, 0) / sc.length : null;
    const cat = { ready: sc.filter((x) => x >= ready).length, partial: sc.filter((x) => x >= partial && x < ready).length, not: sc.filter((x) => x < partial).length };
    const g = { m: [], f: [] }; res.forEach((r) => { const s = byId.get(r.studentId); if (s) (s.gender === 'طالبة' ? g.f : g.m).push(+r.score); });
    const gAvg = (L) => L.length ? L.reduce((a, b) => a + b, 0) / L.length : null;
    const exams = (db.exams || []).map((e) => { const L = res.filter((r) => r.examId === e.id).map((r) => +r.score);
      return { name: e.name, date: e.date || (e.createdAt || '').slice(0, 10), n: L.length, avg: L.length ? L.reduce((a, b) => a + b, 0) / L.length : null, ready: L.filter((x) => x >= ready).length }; })
      .filter((x) => x.n).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    /* الأداء حسب المقرر (الوحدة) من درجات العناصر */
    const el = new Map((db.elements || []).map((e) => [e.id, e])), tp = new Map((db.topics || []).map((t) => [t.id, t])), un = new Map((db.units || []).map((u) => [u.id, u]));
    const uAgg = {}; res.forEach((r) => Object.entries(r.elementScores || {}).forEach(([eid, v]) => { const e = el.get(eid), t = e && tp.get(e.topicId), u = t && un.get(t.unitId);
      const k = u ? (u.code ? u.code + ' — ' : '') + u.name : 'أخرى'; (uAgg[k] = uAgg[k] || []).push(+v); }));
    const units = Object.entries(uAgg).map(([k, L]) => ({ label: k, value: L.reduce((a, b) => a + b, 0) / L.length })).sort((a, b) => a.value - b.value);
    /* الدورات والحضور */
    const sts = (db.settings && db.settings.attStatuses) || [{ name: 'حاضر', kind: 'present' }, { name: 'غائب', kind: 'absent' }];
    const kind = (n) => (sts.find((x) => x.name === n) || {}).kind || (n === 'حاضر' || n === 'متأخر' ? 'present' : n === 'غائب' ? 'absent' : 'excused');
    let pr = 0, ab = 0; Object.values(db.attendance || {}).forEach((A) => Object.values(A || {}).forEach((x) => { const k = x && x.st ? kind(x.st) : ''; if (k === 'present') pr++; else if (k === 'absent') ab++; }));
    const ag = db.agencyTests || [], agR = db.agencyResults || {};
    const agAvg = (() => { const L = []; ag.forEach((t) => Object.values(agR[t.id] || {}).forEach((x) => { if (x && x.score !== '' && x.score != null) L.push((+x.score) / (t.maxScore || 100) * 100); })); return L.length ? L.reduce((a, b) => a + b, 0) / L.length : null; })();
    return { students: st.length, male: st.filter((s) => s.gender !== 'طالبة').length, female: st.filter((s) => s.gender === 'طالبة').length, questions: (db.questions || []).length,
      examsN: (db.exams || []).length, results: res.length, takers: new Set(res.map((r) => r.studentId)).size, avg, ready, partial, cat, mAvg: gAvg(g.m), fAvg: gAvg(g.f), exams, units,
      courses: (db.courses || []).length, present: pr, absent: ab, attRate: pr + ab ? pr / (pr + ab) * 100 : null, agencyN: ag.length, agAvg };
  }
  async function readinessOf(dept) { const r = await readApp('readiness', dept, 'academia:data'); return r && r.v ? Object.assign(readinessMetrics(r.v), { at: r.at }) : null; }
  /* التدريب (بيانات الكلية) — الطلاب حسب تخصص القسم */
  function deptRe(dept) { const n = dName(dept); if (/محاسب/.test(n)) return /محاسب/; if (/تمويل|استثمار|إستثمار/.test(n)) return /تمويل|استثمار|إستثمار/; if (/إدارة الأعمال|ادارة الاعمال|تسويق/.test(n)) return /تسويق|إدارة الأعمال|ادارة الاعمال|الموارد/;
    const w = n.replace(/^قسم\s+/, '').split(/\s+/)[0]; return w ? new RegExp(w) : null; }
  async function trainingOf(dept) {
    const r = await readApp('training', 'college', 'tms-data'); if (!r || !r.v) return null; const S = r.v, re = dept && dept !== 'college' ? deptRe(dept) : null;
    const L = (S.students || []).filter((s) => !re || re.test(s.program || '')), st = { ok: 0, wait: 0, no: 0, none: 0 };
    L.forEach((s) => { if (s.status === 'مقبول') st.ok++; else if (s.status === 'مرفوض') st.no++; else if (s.agency) st.wait++; else st.none++; });
    const ag = {}; L.forEach((s) => { if (s.agency) ag[s.agency] = (ag[s.agency] || 0) + 1; });
    const br = {}; L.forEach((s) => { const b = s.branch || 'غير محدد'; br[b] = (br[b] || 0) + 1; });
    return { n: L.length, st, agencies: Object.keys(ag).length, topAg: Object.entries(ag).sort((a, b) => b[1] - a[1]).slice(0, 8), branches: Object.entries(br), at: r.at };
  }

  /* قياس مخرجات التعلم (نظام مشترك لكل البرامج؛ يُفرز حسب البرنامج) */
  let CLOP = null;
  async function cloSysRaw() {
    if (CLOP) return CLOP;
    CLOP = (async () => { if (!window.SB) return null;
      const { data, error } = await SB.from('app_storage').select('app_key,scope,value,updated_at').eq('key', 'clo-system-jouf-v1');
      if (error) throw error; const L = (data || []).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
      for (const r of L) { try { return { v: JSON.parse(r.value), at: r.updated_at }; } catch (e) {} } return null; })();
    CLOP.catch(() => { CLOP = null; }); return CLOP;
  }
  async function cloSysOf(dept) {
    const r = await cloSysRaw(); if (!r || !r.v) return null; const S = r.v, re = dept && dept !== 'college' ? deptRe(dept) : null;
    const progs = (S.programs || []).filter((p) => !re || re.test(p.name || '')), pid = new Set(progs.map((p) => p.id));
    const courses = (S.courses || []).filter((c) => !re || pid.has(c.programId)), cid = new Set(courses.map((c) => c.id));
    const secs = (S.sections || []).filter((x) => cid.has(x.courseId));
    const st = { accepted: 0, submitted: 0, returned: 0, draft: 0 }; secs.forEach((x) => { const k = x.status in st ? x.status : 'draft'; st[k]++; });
    const per = progs.map((p) => { const cs = courses.filter((c) => c.programId === p.id), ci = new Set(cs.map((c) => c.id)), ss = secs.filter((x) => ci.has(x.courseId));
      return { name: p.name, courses: cs.length, secs: ss.length, acc: ss.filter((x) => x.status === 'accepted').length, sub: ss.filter((x) => x.status === 'submitted').length, ret: ss.filter((x) => x.status === 'returned').length }; });
    return { programs: progs.length, courses: courses.length, secs: secs.length, faculty: new Set(secs.map((x) => x.facultyId).filter(Boolean)).size, st, per, at: r.at, filtered: !!re };
  }
  const SHARED = { training: 'مشترك بين الأقسام', quality: 'مشترك بين البرامج' };
  const sharedChip = (c) => SHARED[T(c)] ? `<span style="display:inline-block;font-size:11px;font-weight:700;background:#EEF4FF;color:#2F5FA8;border-radius:10px;padding:1px 8px;margin-inline-start:6px">🔗 ${SHARED[T(c)]}</span>` : '';

  /* ---------- عناصر العرض ---------- */
  const CSS = `<style id="lead-css">
  .ld-page{--lp:#5B34A6;--lp2:#7C55D0;--ink:#1E1640;margin:-4px -2px 0;padding:0 0 24px;background:radial-gradient(1200px 380px at 85% -60px,rgba(124,85,208,.10),transparent 70%),linear-gradient(180deg,#F6F3FC 0,#F4F6F5 520px);border-radius:16px}
  .ld-hero{position:relative;overflow:hidden;border-radius:18px;padding:22px 24px 20px;color:#fff;background:linear-gradient(120deg,#3B2272 0%,#5B34A6 45%,#7C55D0 100%);box-shadow:0 14px 34px rgba(59,34,114,.28);margin-bottom:18px}
  .ld-hero::before,.ld-hero::after{content:'';position:absolute;border-radius:50%;background:rgba(255,255,255,.08)}
  .ld-hero::before{width:260px;height:260px;left:-70px;top:-110px}.ld-hero::after{width:180px;height:180px;left:140px;bottom:-120px;background:rgba(255,255,255,.06)}
  .ld-hero.cm{background:linear-gradient(120deg,color-mix(in srgb,var(--c) 80%,#000) 0%,var(--c) 55%,color-mix(in srgb,var(--c) 70%,#fff) 100%)}
  .ld-hero-top{position:relative;z-index:1;display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap}
  .ld-hero h2{margin:0;font-size:25px;font-weight:800;line-height:1.35;color:#fff;font-family:var(--display)}
  .ld-hero .sub{opacity:.9;font-size:13.5px;margin-top:4px}
  .ld-hero .ic{width:54px;height:54px;border-radius:14px;background:rgba(255,255,255,.16);display:grid;place-items:center;font-size:28px;flex:0 0 auto;border:1px solid rgba(255,255,255,.25)}
  .ld-hbtn{all:unset;cursor:pointer;box-sizing:border-box;border:1.5px solid rgba(255,255,255,.5);background:rgba(255,255,255,.12);color:#fff;border-radius:10px;padding:7px 14px;font-size:13.5px;font-weight:700;white-space:nowrap}
  .ld-hbtn:hover,.ld-hbtn:focus-visible{background:rgba(255,255,255,.24)}
  .ld-chips{position:relative;z-index:1;display:flex;gap:6px;flex-wrap:wrap;margin-top:14px}
  .ld-chips button{border:1.5px solid rgba(255,255,255,.45);background:rgba(255,255,255,.1);color:#fff;border-radius:20px;padding:6px 15px;cursor:pointer;font:inherit;font-size:13.5px;font-weight:700}
  .ld-chips button.on{background:#fff;color:var(--lp);border-color:#fff}
  .ld-tabs{position:relative;z-index:1;display:flex;gap:6px;flex-wrap:wrap;margin-top:16px}
  .ld-tabs a{cursor:pointer;border-radius:10px;padding:7px 14px;font-size:14px;font-weight:700;color:#fff;background:rgba(255,255,255,.12);text-decoration:none}
  .ld-tabs a.on{background:#fff;color:var(--ink)}
  .ld-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:18px}
  .ld-kpi{background:#fff;border:1px solid #E6E1F0;border-radius:14px;padding:12px 14px;display:flex;gap:12px;align-items:center;box-shadow:0 6px 16px rgba(30,22,64,.05);position:relative;overflow:hidden}
  .ld-kpi::after{content:'';position:absolute;inset-inline-start:0;top:0;bottom:0;width:4px;background:var(--t,#7C55D0)}
  .ld-kpi .i{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;font-size:21px;background:color-mix(in srgb,var(--t,#7C55D0) 13%,#fff);flex:0 0 auto}
  .ld-kpi b{display:block;font-size:23px;line-height:1.15;color:#1E1640;font-weight:800}.ld-kpi span{font-size:12.5px;color:#5E5873}
  .ld-kpi.good{--t:#2E7D32}.ld-kpi.bad{--t:#C62828}.ld-kpi.bad b{color:#C62828}.ld-kpi.good b{color:#2E7D32}
  .ld-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:16px;margin-bottom:20px}
  .ld-card{all:unset;box-sizing:border-box;cursor:pointer;background:#fff;border:1px solid #E6E1F0;border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:10px;box-shadow:0 8px 20px rgba(30,22,64,.06);position:relative;overflow:hidden;transition:box-shadow .15s,transform .15s}
  .ld-card::before{content:'';position:absolute;inset:0 0 auto 0;height:5px;background:linear-gradient(90deg,var(--c),color-mix(in srgb,var(--c) 55%,#fff))}
  .ld-card:hover,.ld-card:focus-visible{box-shadow:0 16px 32px rgba(30,22,64,.13);transform:translateY(-3px)}
  .ld-card-h{display:flex;gap:12px;align-items:center}
  .ld-card-h .t{flex:1;min-width:0}.ld-card-h h4{margin:0;font-size:16.5px;font-weight:800;color:#1E1640}.ld-card-h small{color:#6B6585;font-size:12px}
  .ld-ring{flex:0 0 auto}
  .ld-mini{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font-size:12px;color:#6B6585;background:#F8F7FB;border-radius:10px;padding:8px}.ld-mini b{display:block;font-size:16px;color:#1E1640}
  .ld-sys{font-size:12.5px;background:color-mix(in srgb,var(--c,#7C55D0) 8%,#fff);border:1px dashed color-mix(in srgb,var(--c,#7C55D0) 35%,#fff);border-radius:10px;padding:7px 9px;color:#3F3A55;min-height:22px}
  .ld-go{font-size:13px;font-weight:800;color:var(--c);align-self:flex-start}
  .ld-sec{display:flex;align-items:center;gap:8px;font-size:17px;font-weight:800;color:#1E1640;margin:4px 0 10px}.ld-sec::before{content:'';width:6px;height:20px;border-radius:3px;background:linear-gradient(#7C55D0,#5B34A6)}
  .ld-page .panel{border-radius:16px;border-color:#E6E1F0;box-shadow:0 8px 20px rgba(30,22,64,.05);overflow:hidden}
  .ld-page .panel>h3{background:linear-gradient(90deg,#FBFAFE,#fff);border-bottom:1px solid #EEEAF6}
  .ld-note{font-size:12.5px;color:#6B6585;margin:-6px 0 12px}
  .ld-load{color:#6B6585;font-size:13px;padding:10px 0}
  .ld-cmp-m{display:inline-block;padding:1px 8px;border-radius:10px;background:#F1ECFA;color:#5B34A6;font-weight:700}
  @media (max-width:820px){.grid2.ld{grid-template-columns:1fr}.ld-hero{padding:16px}.ld-hero h2{font-size:20px}.ld-kpis{grid-template-columns:1fr 1fr}.ld-kpi b{font-size:19px}}
  @media print{.ld-hero,.ld-kpi,.ld-card{box-shadow:none}}
  </style>`;
  const ICONS = [[/أعيد/, '↩️'], [/معتمد/, '✅'], [/البرامج/, '🎓'], [/الشعب/, '🏫'], [/هيئة التدريس|أعضاء/, '👨‍🏫'], [/لجان|اللجان/, '🗂️'], [/إنجاز/, '📈'], [/مكتمل|مقبول|المنفذة|حققت/, '✅'], [/متأخر|غياب|مرفوض|دون/, '⏰'], [/المؤشرات/, '🎯'], [/طلاب|طالب|اختبروا/, '👥'], [/الاختبارات/, '📝'], [/نسبة الجاهزين|جاهز/, '🏆'], [/متوسط/, '📊'], [/حضور|الحضور/, '🙋'], [/الأعضاء/, '🧑‍💼'], [/اعتماد|بانتظار|القادمة/, '⏳'], [/جهات/, '🏢'], [/الدورات/, '🎓'], [/الزيارات/, '🤝'], [/مقررات/, '📚'], [/المهام/, '📋'], [/بلا جهة/, '❔']];
  const icOf = (l) => (ICONS.find(([re]) => re.test(l)) || [0, '•'])[1];
  const stats = (L) => `<div class="ld-kpis">${L.map(([v, l, c]) => `<div class="ld-kpi ${c || ''}"><span class="i">${icOf(l)}</span><div><b>${v}</b><span>${E(l)}</span></div></div>`).join('')}</div>`;
  function ring(p, col, size) { size = size || 58; const r = (size - 8) / 2, C = 2 * Math.PI * r, L = Math.max(0, Math.min(100, p)) / 100 * C;
    return `<svg class="ld-ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-label="${p}%"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#EEEAF6" stroke-width="7"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${L} ${C - L}" transform="rotate(-90 ${size / 2} ${size / 2})"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-size="${size / 4.2}" font-weight="800" fill="#1E1640">${p}%</text></svg>`; }
  const panel = (title, body, extra) => `<div class="panel"><h3>${title}${extra || ''}</h3><div class="body">${body}</div></div>`;
  const table = (head, rows) => rows.length ? `<div class="tbl-wrap"><table class="t"><tr>${head.map((h) => `<th>${E(h)}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((x) => `<td>${x}</td>`).join('')}</tr>`).join('')}</table></div>` : '<div class="small muted">لا توجد بيانات.</div>';
  const nav = (o) => `go('lead',${JSON.stringify(Object.assign({}, { dept: VIEW.dept }, o)).replace(/"/g, "'")})`;

  function deptChips(cur) {
    if (!collegeView()) return '';
    const L = depts().map((d) => [d.id, d.name]); if (DB.committees.some((c) => c.level === 'college')) L.push(['college', 'وحدات الكلية']);
    if (L.length < 2) return '';
    return `<div class="ld-chips" role="tablist">${L.map(([id, n]) => `<button role="tab" aria-selected="${id === cur}" class="${id === cur ? 'on' : ''}" onclick="go('lead',{dept:'${id}'})">${E(n)}</button>`).join('')}</div>`;
  }
  function sysLine(c, dept) { const t = T(c); return t === 'readiness' || t === 'training' || t === 'quality' ? `<div class="ld-sys" data-sys="${t}" data-dept="${E(dept)}">جارٍ تحميل النتائج…</div>` : t === 'quality' ? `<div class="ld-sys">${cloLine(c)}</div>` : t === 'receptions' ? `<div class="ld-sys">${visLine()}</div>` : ''; }
  function sysBox(c, dept) { const t = T(c); return t === 'readiness' || t === 'training' || t === 'quality' ? `<div class="ld-sys" style="min-height:60px" data-sys="${t}" data-dept="${E(dept)}">جارٍ تحميل النتائج…</div>` : t === 'quality' ? `<div class="ld-sys" style="min-height:60px">${cloLine(c)}</div>` : t === 'receptions' ? `<div class="ld-sys" style="min-height:60px">${visLine()}</div>` : '<div class="small muted">لا يرتبط بهذه اللجنة نظام له مؤشرات آلية؛ التقرير يعتمد على المهام والمؤشرات.</div>'; }
  function cloList(c) { return (DB.clo || []).filter((m) => !m.committee || m.committee === c.id); }
  function cloLine(c) { const L = cloList(c).map((m) => ({ m, x: cloCalc(m) })).filter((o) => o.x.n); if (!L.length) return 'قياس المخرجات: لا توجد مقررات بدرجات بعد';
    const t = (DB.settings && DB.settings.cloTarget) || 75; const ok = L.filter((o) => { const r = o.x.res.filter(Boolean); return r.length && r.reduce((a, y) => a + y.avg, 0) / r.length >= (o.m.target || t); }).length;
    return `قياس المخرجات: <b>${L.length}</b> مقرر · المحقق للمستهدف <b>${ok}</b>`; }
  function visLine() { const V = DB.visits || []; return `الزيارات: <b>${V.length}</b> · المنفذة <b>${V.filter((v) => v.status === 'done').length}</b> · القادمة <b>${V.filter((v) => v.status === 'plan' && v.date >= today()).length}</b>`; }
  function card(c, dept) { const s = cStats(c);
    return `<button class="ld-card" style="--c:${c.hex}" onclick="${nav({ cid: c.id, tab: 'sum' })}"><div class="ld-card-h">${ring(s.avg, c.hex)}<div class="t"><h4>${TYPE_ICON[T(c)] || '📁'} ${E(c.baseName || c.name)}</h4>${sharedChip(c)}<small>${s.members} عضو · ${s.kpiOk}/${s.kpi} مؤشر محقق</small></div></div>
      <div class="ld-mini"><span><b>${s.n}</b>المهام</span><span><b>${s.done}</b>مكتملة</span><span><b class="${s.late ? 'bad' : ''}">${s.late}</b>متأخرة</span></div>${sysLine(c, dept)}<span class="ld-go">عرض التقرير الكامل ←</span></button>`; }

  /* ---------- الصفحة الرئيسية للتقارير ---------- */
  function pgLeadHome() {
    const dept = selDept(); VIEW.dept = dept; const cs = commsOf(dept);
    const S = cs.map(cStats), tot = (k) => S.reduce((a, s) => a + s[k], 0), avg = S.length ? Math.round(S.reduce((a, s) => a + s.avg, 0) / S.length) : 0;
    const when = new Date().toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    let h = CSS + `<div class="ld-page"><div class="ld-hero"><div class="ld-hero-top"><span class="ic">📊</span><div style="flex:1;min-width:200px"><h2>التقارير والمتابعة — ${E(dName(dept))}</h2><div class="sub">لوحة قيادة للعرض فقط · ${E(when)} · اختر لجنة لعرض تقاريرها ونتائجها ومقارنتها</div></div>
      <button class="ld-hbtn" onclick="printDoc('التقارير والمتابعة – ${E(dName(dept))}',document.getElementById('leadBody').innerHTML)">🖨️ طباعة / PDF</button></div>${deptChips(dept)}</div><div id="leadBody">`;
    h += stats([[cs.length, 'اللجان'], [avg + '%', 'متوسط الإنجاز'], [tot('n'), 'المهام'], [tot('done'), 'المكتملة', 'good'], [tot('late'), 'المتأخرة', tot('late') ? 'bad' : ''], [tot('kpiOk') + '/' + tot('kpi'), 'المؤشرات المحققة']]);
    h += cs.length ? `<div class="ld-sec">لجان ${E(dName(dept))}</div><div class="ld-cards">${cs.map((c) => card(c, dept)).join('')}</div>` : '<div class="empty">لا توجد لجان لهذا القسم.</div>';
    if (cs.length > 1) h += `<div class="grid2 ld">${panel('مقارنة الإنجاز بين اللجان', hbars(cs.map((c, i) => ({ label: c.baseName || c.name, value: S[i].avg, color: c.hex })), { max: 100 }))}
      ${panel('المهام حسب الحالة', hstack(cs.map((c, i) => ({ label: c.baseName || c.name, done: S[i].done, open: S[i].n - S[i].done - S[i].late, late: S[i].late })), [{ k: 'done', l: 'مكتملة', c: 'var(--ok)' }, { k: 'open', l: 'مفتوحة', c: '#9DB9CF' }, { k: 'late', l: 'متأخرة', c: 'var(--late)' }]))}</div>`;
    if (collegeView() && depts().length > 1) h += deptCompare();
    return h + '</div></div>';
  }
  /* مقارنة الأقسام (للعميد والوكلاء) */
  function deptCompare() {
    const rows = depts().map((d) => { const cs = commsOf(d.id), S = cs.map(cStats), n = S.reduce((a, s) => a + s.n, 0), done = S.reduce((a, s) => a + s.done, 0), late = S.reduce((a, s) => a + s.late, 0), ko = S.reduce((a, s) => a + s.kpiOk, 0), k = S.reduce((a, s) => a + s.kpi, 0);
      const avg = S.length ? Math.round(S.reduce((a, s) => a + s.avg, 0) / S.length) : 0; return { d, cs: cs.length, n, done, late, ko, k, avg }; });
    return panel('مقارنة الأقسام', `<div class="grid2 ld"><div>${hbars(rows.map((r) => ({ label: r.d.name, value: r.avg, color: 'var(--ledger)', sub: r.n + ' مهمة · ' + r.late + ' متأخرة' })), { max: 100 })}</div>
      <div>${table(['القسم', 'اللجان', 'المهام', 'المكتمل', 'المتأخر', 'المؤشرات'], rows.map((r) => [E(r.d.name), r.cs, r.n, r.done, r.late ? `<b class="bad">${r.late}</b>` : 0, r.ko + '/' + r.k]))}</div></div>
      <h4 style="margin:16px 0 6px">الجاهزية في الأقسام</h4><div id="ldReadyCmp" class="ld-load">جارٍ تحميل نتائج الجاهزية…</div>`);
  }

  /* ---------- تقرير لجنة ---------- */
  function pgLeadComm() {
    const c = comm(VIEW.cid); if (!c || !c.id) return pgLeadHome(); const dept = c.level === 'college' ? 'college' : c.dept; VIEW.dept = VIEW.dept || dept;
    const t = T(c), tab = VIEW.tab || 'sum', s = cStats(c);
    const tabs = [['sum', 'الملخص'], ['tasks', 'المهام والأعضاء'], ['kpis', 'المؤشرات']];
    if (['readiness', 'training', 'quality', 'receptions'].includes(t)) tabs.push(['sys', 'نتائج النظام']);
    tabs.push(['cmp', 'المقارنة']);
    let h = CSS + `<div class="ld-page"><div class="ld-hero cm" style="--c:${c.hex}"><div class="ld-hero-top"><span class="ic">${TYPE_ICON[t] || '📁'}</span><div style="flex:1;min-width:200px"><h2>${E(c.name)}</h2><div class="sub">${E(dName(dept))} · ${E(c.desc || '')}${SHARED[t] ? ' · 🔗 ' + SHARED[t] + ': الأرقام مفروزة حسب برامج القسم المختار' : ''}</div>
      <div class="sub" style="margin-top:6px">الإنجاز <b>${s.avg}%</b> · ${s.n} مهمة · ${s.late} متأخرة · المؤشرات ${s.kpiOk}/${s.kpi} · للعرض فقط</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="ld-hbtn" onclick="${nav({})}">→ كل اللجان</button><button class="ld-hbtn" onclick="printDoc('تقرير ${E(c.name)}',document.getElementById('leadBody').innerHTML)">🖨️ طباعة / PDF</button></div></div>
      <div class="ld-tabs">${tabs.map(([k, l]) => `<a class="${tab === k ? 'on' : ''}" onclick="${nav({ cid: c.id, tab: k })}">${l}</a>`).join('')}</div></div><div id="leadBody">`;
    const ts = tasksOf(c.id);
    if (tab === 'sum') {
      const st = { not: 0, prog: 0, pend: 0, done: 0, late: 0 }; ts.forEach((x) => { if (isLate(x)) st.late++; else st[x.status] = (st[x.status] || 0) + 1; });
      h += stats([[s.avg + '%', 'متوسط الإنجاز'], [s.n, 'المهام'], [s.done, 'مكتملة', 'good'], [s.late, 'متأخرة', s.late ? 'bad' : ''], [s.pend, 'بانتظار الاعتماد'], [s.members, 'الأعضاء']]);
      h += `<div class="grid2 ld">${panel('حالة المهام', donut([{ label: 'مكتمل', value: st.done, color: 'var(--ok)' }, { label: 'جاري', value: st.prog, color: '#2F6F9F' }, { label: 'يحتاج اعتماد', value: st.pend, color: '#C9962B' }, { label: 'لم يبدأ', value: st.not, color: '#AEB8B4' }, { label: 'متأخر', value: st.late, color: 'var(--late)' }], 'مهمة'))}
        ${panel('نتائج النظام باختصار', sysBox(c, dept))}</div>`;
      const late = ts.filter(isLate).sort((a, b) => String(a.end).localeCompare(String(b.end)));
      h += panel('الأعمال المتأخرة (' + late.length + ')', late.length ? taskMiniList(late.slice(0, 20), false) : '<div class="small good">لا توجد أعمال متأخرة 👍</div>');
    }
    if (tab === 'tasks') {
      const months = []; for (let i = 5; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); months.push(d.toISOString().slice(0, 7)); }
      const lbl = months.map((m) => new Date(m + '-01T00:00:00').toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { month: 'short' })), done = ts.filter((x) => x.status === 'done');
      const people = membersOf(c.id).map((u) => { const l = ts.filter((x) => x.assignee === u.id); return { label: u.name, done: l.filter((x) => x.status === 'done').length, open: l.filter((x) => x.status !== 'done' && !isLate(x)).length, late: l.filter(isLate).length }; }).filter((p) => p.done + p.open + p.late);
      h += `<div class="grid2 ld">${panel('حركة العمل آخر 6 أشهر', columns(lbl, [{ name: 'أُنشئت', color: '#AEB8B4', values: months.map((m) => ts.filter((x) => (x.createdAt || '').slice(0, 7) === m).length) }, { name: 'اكتملت', color: 'var(--ledger)', values: months.map((m) => done.filter((x) => (x.approvedAt || x.updatedAt || '').slice(0, 7) === m).length) }]))}
        ${panel('أداء الأعضاء', hstack(people, [{ k: 'done', l: 'مكتملة', c: 'var(--ok)' }, { k: 'open', l: 'مفتوحة', c: '#9DB9CF' }, { k: 'late', l: 'متأخرة', c: 'var(--late)' }]))}</div>`;
      const SL = { not: 'لم يبدأ', prog: 'جاري', pend: 'يحتاج اعتماد', done: 'مكتمل' };
      h += panel('كل المهام (' + ts.length + ')', table(['المهمة', 'المسؤول', 'الاستحقاق', 'الإنجاز', 'الحالة'], ts.slice().sort((a, b) => String(a.end || '').localeCompare(String(b.end || ''))).map((x) => [E(x.title), E(uname(x.assignee) || '—'), x.end ? fmtD(x.end) : '—', (x.status === 'done' ? 100 : +x.progress || 0) + '%', isLate(x) ? '<b class="bad">متأخر</b>' : E(SL[x.status] || x.status || '')])));
    }
    if (tab === 'kpis') {
      const k = kpisOf(c.id);
      h += k.length ? `<div class="grid2 ld">${panel('حالة المؤشرات', donut([{ label: 'محقق', value: k.filter(kpiMet).length, color: 'var(--ok)' }, { label: 'غير محقق', value: k.filter((x) => x.actual !== '' && x.actual != null && !kpiMet(x)).length, color: 'var(--late)' }, { label: 'لم يُقس', value: k.filter((x) => x.actual === '' || x.actual == null).length, color: '#C9D0CD' }], 'مؤشر'))}
        ${panel('المستهدف والفعلي', hbars(k.filter((x) => x.actual !== '' && x.actual != null && +x.target).map((x) => ({ label: x.name || x.title || '', value: Math.min(150, (+x.actual / +x.target) * 100), color: kpiMet(x) ? 'var(--ok)' : 'var(--late)' })), { max: 150, target: 100 }))}</div>`
        + panel('جدول المؤشرات', table(['المؤشر', 'المستهدف', 'الفعلي', 'النتيجة'], k.map((x) => [E(x.name || x.title || ''), E(x.target), E(x.actual === '' || x.actual == null ? '—' : x.actual), x.actual === '' || x.actual == null ? '<span class="muted">لم يُقس</span>' : kpiMet(x) ? '<b class="good">محقق</b>' : '<b class="bad">غير محقق</b>'])))
        : '<div class="empty">لا توجد مؤشرات مسجلة لهذه اللجنة.</div>';
    }
    if (tab === 'sys') {
      if (t === 'quality') h += `<div id="ldSys" data-type="quality" data-dept="${E(dept)}" class="ld-load">جارٍ تحميل نتائج قياس مخرجات التعلم…</div>` + (cloList(c).some((m) => cloCalc(m).n) ? '<div class="ld-sec" style="margin-top:10px">قياس المخرجات المسجل في الموقع</div>' + qualityPanel(c) : '');
      else if (t === 'receptions') h += visitsPanel();
      else h += `<div id="ldSys" data-type="${t}" data-dept="${E(dept)}" class="ld-load">جارٍ تحميل نتائج النظام…</div>`;
    }
    if (tab === 'cmp') h += comparePanel(c, dept);
    return h + '</div></div>';
  }
  function qualityPanel(c) {
    const t = (DB.settings && DB.settings.cloTarget) || 75, L = cloList(c).map((m) => ({ m, x: cloCalc(m) })).filter((o) => o.x.n);
    if (!L.length) return '<div class="empty">لا توجد مقررات بدرجات في قياس مخرجات التعلم بعد.</div>';
    const rows = L.map((o) => { const r = o.x.res.filter(Boolean), a = r.reduce((s, y) => s + y.avg, 0) / r.length; return { o, a }; });
    return `<div class="grid2 ld">${panel('تحقق المخرجات حسب المقرر', hbars(rows.map((r) => ({ label: (r.o.m.courseName || '—') + (r.o.m.section ? ' (' + r.o.m.section + ')' : ''), value: r.a, color: r.a >= (r.o.m.target || t) ? 'var(--ok)' : 'var(--late)' })), { max: 100, target: t }))}
      ${panel('الملخص', stats([[L.length, 'مقررات مقيسة'], [rows.filter((r) => r.a >= (r.o.m.target || t)).length, 'حققت المستهدف', 'good'], [rows.filter((r) => r.a < (r.o.m.target || t)).length, 'دون المستهدف', 'bad'], [R1(rows.reduce((s, r) => s + r.a, 0) / rows.length) + '%', 'المتوسط']]))}</div>`
      + panel('التفاصيل', table(['المقرر', 'الشعبة', 'الطلاب', 'المخرجات', 'المتوسط'], rows.map((r) => [E(r.o.m.courseName || '—'), E(r.o.m.section || ''), r.o.x.n, E(cloSummary(r.o.m)), `<b class="${r.a >= (r.o.m.target || t) ? 'good' : 'bad'}">${R1(r.a)}%</b>`])));
  }
  function visitsPanel() { const V = DB.visits || []; return stats([[V.length, 'الزيارات'], [V.filter((v) => v.status === 'done').length, 'المنفذة', 'good'], [V.filter((v) => v.status === 'plan' && v.date >= today()).length, 'القادمة']])
    + panel('الزيارات', table(['الزيارة', 'الضيف', 'التاريخ', 'الحالة'], V.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 30).map((v) => [E(v.title), E(v.guest || ''), v.date ? fmtD(v.date) : '—', E(v.status === 'done' ? 'منفذة' : v.status === 'plan' ? 'مخطط لها' : v.status || '')]))); }
  function comparePanel(c, dept) {
    const same = commsOf(dept), S = same.map(cStats);
    let h = panel('مقارنة اللجنة باللجان الأخرى في ' + E(dName(dept)), `<div class="grid2 ld"><div>${hbars(same.map((x, i) => ({ label: (x.id === c.id ? '◀ ' : '') + (x.baseName || x.name), value: S[i].avg, color: x.id === c.id ? c.hex : '#AEB8B4' })), { max: 100 })}</div>
      <div>${table(['اللجنة', 'الإنجاز', 'المهام', 'المتأخر', 'المؤشرات'], same.map((x, i) => [(x.id === c.id ? '<b>' : '') + E(x.baseName || x.name) + (x.id === c.id ? '</b>' : ''), S[i].avg + '%', S[i].n, S[i].late, S[i].kpiOk + '/' + S[i].kpi]))}</div></div>`);
    if (collegeView() && c.level !== 'college') { const sib = DB.committees.filter((x) => T(x) === T(c) && x.level !== 'college');
      if (sib.length > 1) { const S2 = sib.map(cStats); h += panel('اللجنة نفسها في الأقسام', table(['القسم', 'الإنجاز', 'المهام', 'المتأخر', 'المؤشرات'], sib.map((x, i) => [E(dName(x.dept)), S2[i].avg + '%', S2[i].n, S2[i].late, S2[i].kpiOk + '/' + S2[i].kpi])) + (T(c) === 'readiness' ? '<h4 style="margin:16px 0 6px">نتائج الجاهزية في الأقسام</h4><div id="ldReadyCmp" class="ld-load">جارٍ التحميل…</div>' : '')); } }
    return h;
  }

  /* ---------- تعبئة النتائج بعد الرسم ---------- */
  const fmtAvg = (x) => x == null ? '—' : '<bdi>' + R1(x) + '%</bdi>';
  const bp = (a, b) => '<bdi>' + pct(a, b) + '%</bdi>';
  async function fillSys() {
    document.querySelectorAll('[data-sys]').forEach(async (el) => { const t = el.dataset.sys, d = el.dataset.dept;
      try { if (t === 'readiness') { const m = await readinessOf(d); el.innerHTML = m ? `الجاهزية: <b>${m.students}</b> طالب · <b>${m.results}</b> نتيجة · المتوسط <b>${fmtAvg(m.avg)}</b> · جاهز <b>${bp(m.cat.ready, m.results)}</b>` : 'الجاهزية: لا توجد بيانات لهذا القسم بعد'; }
        else if (t === 'quality') { const m = await cloSysOf(d); el.innerHTML = m ? `مخرجات التعلم: <b>${m.courses}</b> مقرر · <b>${m.secs}</b> شعبة · معتمد <b>${m.st.accepted}</b> · مرسل <b>${m.st.submitted}</b> · لم يُرسل <b>${m.st.draft}</b>` : 'مخرجات التعلم: لا توجد بيانات من نظام القياس بعد'; }
        else if (t === 'training') { const m = await trainingOf(d); el.innerHTML = m ? `التدريب: <b>${m.n}</b> طالب · مقبول <b>${m.st.ok}</b> · بانتظار <b>${m.st.wait}</b> · بلا جهة <b>${m.st.none}</b>` : 'التدريب: لا توجد بيانات بعد'; } }
      catch (e) { el.textContent = 'تعذّر تحميل النتائج (' + (e.message || e) + ')'; } });
    const box = $q('#ldSys'); if (box) { const t = box.dataset.type, d = box.dataset.dept;
      try { box.className = ''; box.innerHTML = t === 'readiness' ? readinessHtml(await readinessOf(d)) : t === 'training' ? trainingHtml(await trainingOf(d), d) : t === 'quality' ? cloSysHtml(await cloSysOf(d), d) : ''; }
      catch (e) { box.innerHTML = '<div class="empty">تعذّر تحميل نتائج النظام: ' + E(e.message || e) + '</div>'; } }
    const cmp = $q('#ldReadyCmp'); if (cmp) {
      const L = await Promise.all(depts().map(async (d) => { try { return { d, m: await readinessOf(d.id) }; } catch (e) { return { d, m: null, err: e.message || String(e) }; } }));
      cmp.className = ''; cmp.innerHTML = `<div class="grid2 ld"><div>${hbars(L.filter((x) => x.m && x.m.avg != null).map((x) => ({ label: x.d.name, value: x.m.avg, color: 'var(--ledger)' })), { max: 100, target: (L.find((x) => x.m) || { m: { ready: 80 } }).m.ready })}</div>
        <div>${table(['القسم', 'الطلاب', 'النتائج', 'المتوسط', 'جاهز', 'الحضور'], L.map((x) => x.m ? [E(x.d.name), x.m.students, x.m.results, fmtAvg(x.m.avg), bp(x.m.cat.ready, x.m.results), fmtAvg(x.m.attRate)] : [E(x.d.name), '—', '—', '—', '—', '—']))}</div></div>`;
    }
  }
  function readinessHtml(m) {
    if (!m) return '<div class="empty">لا توجد بيانات جاهزية لهذا القسم بعد (لم يُستخدم نظام الجاهزية فيه).</div>';
    let h = `<p class="ld-note">آخر تحديث للبيانات: ${m.at ? fmtDT(m.at) : '—'} · حد الجاهزية ${m.ready}% والجاهزية الجزئية ${m.partial}% (من إعدادات النظام)</p>`;
    h += stats([[m.students, 'الطلاب'], [m.male + ' / ' + m.female, 'طلاب / طالبات'], [m.examsN, 'الاختبارات'], [m.takers, 'اختبروا'], [fmtAvg(m.avg), 'متوسط الدرجات'], [bp(m.cat.ready, m.results), 'نسبة الجاهزين', 'good']]);
    h += `<div class="grid2 ld">${panel('توزيع النتائج', donut([{ label: 'جاهز', value: m.cat.ready, color: 'var(--ok)' }, { label: 'جاهزية جزئية', value: m.cat.partial, color: '#C9962B' }, { label: 'غير جاهز', value: m.cat.not, color: 'var(--late)' }], 'نتيجة'))}
      ${panel('المقارنة بين الشطرين', hbars([{ label: 'الطلاب', value: m.mAvg || 0, color: '#2F6F9F' }, { label: 'الطالبات', value: m.fAvg || 0, color: '#8E3B78' }], { max: 100, target: m.ready }) + `<div class="small muted" style="margin-top:6px">المتوسط: الطلاب ${fmtAvg(m.mAvg)} · الطالبات ${fmtAvg(m.fAvg)}</div>`)}</div>`;
    if (m.exams.length) h += `<div class="grid2 ld">${panel('تطور المتوسط عبر الاختبارات', columns(m.exams.slice(-8).map((e) => e.name.length > 14 ? e.name.slice(0, 13) + '…' : e.name), [{ name: 'المتوسط %', color: 'var(--ledger)', values: m.exams.slice(-8).map((e) => Math.round(e.avg || 0)) }]))}
      ${panel('الأداء حسب المقرر (الأضعف أولًا)', hbars(m.units.slice(0, 10).map((u) => ({ label: u.label, value: u.value, color: u.value >= m.ready ? 'var(--ok)' : u.value >= m.partial ? '#C9962B' : 'var(--late)' })), { max: 100, target: m.ready }))}</div>`;
    h += panel('نتائج الاختبارات', table(['الاختبار', 'التاريخ', 'المختبرون', 'المتوسط', 'الجاهزون'], m.exams.slice().reverse().map((e) => [E(e.name), E(e.date || '—'), e.n, fmtAvg(e.avg), e.ready + ' (' + bp(e.ready, e.n) + ')'])));
    h += `<div class="grid2 ld">${panel('الدورات التدريبية والحضور', stats([[m.courses, 'الدورات'], [m.present, 'حضور'], [m.absent, 'غياب', m.absent ? 'bad' : ''], [fmtAvg(m.attRate), 'نسبة الحضور']]))}
      ${panel('اختبارات الوكالة', stats([[m.agencyN, 'الاختبارات'], [fmtAvg(m.agAvg), 'متوسط النتائج']]))}</div>`;
    return h;
  }
  function cloSysHtml(m, d) {
    if (!m) return '<div class="empty">لا توجد بيانات من نظام قياس مخرجات التعلم بعد.</div>';
    let h = `<p class="ld-note">نظام قياس مخرجات التعلم مشترك بين البرامج؛ ${m.filtered ? 'المعروض هنا مقررات برامج ' + E(dName(d)) + ' فقط (أيًّا كان القسم الذي ينتمي إليه الدكتور)' : 'المعروض كل البرامج'} · آخر تحديث: ${m.at ? fmtDT(m.at) : '—'}</p>`;
    h += stats([[m.programs, 'البرامج'], [m.courses, 'المقررات'], [m.secs, 'الشعب'], [m.faculty, 'أعضاء هيئة التدريس'], [m.st.accepted, 'معتمد من لجنة الجودة', 'good'], [m.st.returned, 'أعيد للتعديل', m.st.returned ? 'bad' : '']]);
    h += `<div class="grid2 ld">${panel('حالة ملفات الشعب', donut([{ label: 'معتمد', value: m.st.accepted, color: 'var(--ok)' }, { label: 'مرسل للمراجعة', value: m.st.submitted, color: '#C9962B' }, { label: 'أعيد للتعديل', value: m.st.returned, color: 'var(--late)' }, { label: 'لم يُرسل', value: m.st.draft, color: '#AEB8B4' }], 'شعبة'))}
      ${panel('نسبة الاعتماد حسب البرنامج', hbars(m.per.filter((p) => p.secs).map((p) => ({ label: p.name, value: pct(p.acc, p.secs), color: '#5B34A6', sub: p.acc + ' من ' + p.secs + ' شعبة' })), { max: 100 }))}</div>`;
    h += panel('التفاصيل حسب البرنامج', table(['البرنامج', 'المقررات', 'الشعب', 'معتمد', 'مرسل', 'أعيد'], m.per.map((p) => [E(p.name), p.courses, p.secs, p.acc, p.sub, p.ret ? `<b class="bad">${p.ret}</b>` : 0])));
    return h;
  }
  function trainingHtml(m, d) {
    if (!m) return '<div class="empty">لا توجد بيانات تدريب بعد.</div>';
    let h = `<p class="ld-note">بيانات نظام التدريب (مستوى الكلية)${d && d !== 'college' ? '، مصفّاة على تخصص ' + E(dName(d)) : ''} · آخر تحديث: ${m.at ? fmtDT(m.at) : '—'}</p>`;
    h += stats([[m.n, 'الطلاب'], [m.st.ok, 'مقبول', 'good'], [m.st.wait, 'بانتظار الرد'], [m.st.no, 'مرفوض', m.st.no ? 'bad' : ''], [m.st.none, 'بلا جهة'], [m.agencies, 'جهات التدريب']]);
    h += `<div class="grid2 ld">${panel('حالة الطلاب', donut([{ label: 'مقبول', value: m.st.ok, color: 'var(--ok)' }, { label: 'بانتظار', value: m.st.wait, color: '#C9962B' }, { label: 'مرفوض', value: m.st.no, color: 'var(--late)' }, { label: 'بلا جهة', value: m.st.none, color: '#AEB8B4' }], 'طالب'))}
      ${panel('أكثر الجهات استقبالًا', hbars(m.topAg.map(([n, v]) => ({ label: n, value: v, color: '#2F6F9F' })), { unit: ' طالب' }))}</div>`;
    h += panel('الطلاب حسب الفرع', hbars(m.branches.map(([n, v]) => ({ label: n, value: v, color: 'var(--ledger)' })), { unit: ' طالب' }));
    return h;
  }

  /* ---------- الربط بالموقع ---------- */
  const _goL = go;
  go = function (page, opts) {
    if (page === 'lead') {
      if (!allowed()) { _goL('home'); return; }
      VIEW = Object.assign({ page }, opts || {});
      try { $q('#side').classList.remove('open'); $q('#main').classList.remove('hidden'); const th = $q('#toolHost'); if (th) th.classList.add('hidden'); } catch (e) {}
      renderNav(); $q('#title').textContent = 'التقارير والمتابعة';
      $q('#main').innerHTML = VIEW.cid ? pgLeadComm() : pgLeadHome(); $q('#main').scrollTop = 0;
      fillSys(); return;
    }
    return _goL.apply(this, arguments);
  };
  window.go = go;
  /* رابط في القائمة الجانبية لرئيس القسم والكلية */
  const _rn = renderNav;
  renderNav = function () {
    const r = _rn.apply(this, arguments);
    try { if (allowed() && (SCOPE === 'head' || SCOPE === 'college' || SCOPE === 'owner')) { const nv = $q('#nav'); if (nv && !nv.querySelector('[data-lead]')) {
      const a = document.createElement('a'); a.setAttribute('data-lead', '1'); if (VIEW.page === 'lead') a.className = 'on';
      a.innerHTML = '<span class="nav-ic">📊</span>التقارير والمتابعة'; a.onclick = () => go('lead', { dept: VIEW.dept });
      const first = nv.querySelector('a'); if (first && first.nextSibling) nv.insertBefore(a, first.nextSibling); else nv.appendChild(a); } } } catch (e) {}
    return r;
  };
  window.renderNav = renderNav;
  /* زر واضح في أعلى لوحة رئيس القسم ولوحة الكلية */
  function banner() { return `<div style="position:relative;overflow:hidden;border-radius:16px;padding:16px 18px;margin-bottom:18px;color:#fff;background:linear-gradient(120deg,#3B2272,#5B34A6 55%,#7C55D0);box-shadow:0 12px 28px rgba(59,34,114,.25);display:flex;gap:14px;align-items:center;flex-wrap:wrap"><span style="width:50px;height:50px;border-radius:14px;background:rgba(255,255,255,.16);display:grid;place-items:center;font-size:26px">📊</span><div style="flex:1;min-width:200px"><b style="font-size:17px">لوحة القيادة: التقارير والمتابعة حسب اللجنة</b><div style="font-size:13px;opacity:.9">الإنجاز والمؤشرات ونتائج الأنظمة (الجاهزية والتدريب ومخرجات التعلم) والمقارنات، في صفحة واحدة</div></div><button onclick="go('lead')" style="all:unset;cursor:pointer;background:#fff;color:#5B34A6;font-weight:800;border-radius:10px;padding:9px 18px">فتح لوحة القيادة ←</button></div>`; }
  if (typeof pgHead === 'function') { const _ph = pgHead; pgHead = function () { const h = _ph.apply(this, arguments); return allowed() ? banner() + h : h; }; window.pgHead = pgHead; }
  if (typeof window.pgCollege === 'function') { const _pc = window.pgCollege; window.pgCollege = function () { const h = _pc.apply(this, arguments); return allowed() ? banner() + h : h; }; try { pgCollege = window.pgCollege; } catch (e) {} }

  /* =====================================================================
     v3.5 — مقارنة الأقسام والتحليلات (رسوم وجداول وتقارير قابلة للطباعة والتصدير)
     ===================================================================== */
  const PAL = ['#5B34A6', '#2F6F9F', '#C27C3A', '#1E6B52', '#8C2A4A', '#6B7A8F'];
  const CONC = [['أساسيات الاقتصاد', /اقتصاد/], ['أساسيات المحاسبة', /(أساسيات|مبادئ) المحاسبة/], ['أساسيات المالية', /أساسيات المالية|المالية في الأعمال|مبادئ المالية/],
    ['القانون والأخلاقيات', /قانون/], ['الإدارة والمنظمات', /الإدارة والمنظمات|(أساسيات|مبادئ) الإدارة$|إدارة المنظمات/], ['إدارة العمليات', /إدارة العمليات/],
    ['الإدارة الاستراتيجية', /استراتيج/], ['نظم المعلومات الإدارية', /نظم المعلومات الإدارية/], ['مبادئ التسويق', /(أساسيات|مبادئ) التسويق/]];
  const concept = (n) => { const c = CONC.find(([, re]) => re.test(String(n || ''))); return c ? c[0] : null; };
  const avgOf = (L) => L.length ? L.reduce((a, b) => a + b, 0) / L.length : null;
  /* نتائج الاختبارات الإلكترونية (جدول مستقل) تُضاف إلى نتائج النظام */
  const ONL = new Map();
  function onlineOf(dept) {
    if (ONL.has(dept)) return ONL.get(dept);
    const p = (async () => { if (!window.SB) return []; let all = [];
      for (let from = 0; ; from += 1000) { const { data, error } = await SB.from('online_submissions').select('exam_id,student_uid,student_name,score,element_scores,submitted_at').eq('scope', dept).range(from, from + 999);
        if (error) return all; all = all.concat(data || []); if (!data || data.length < 1000) break; }
      return all; })();
    ONL.set(dept, p); p.catch(() => ONL.delete(dept)); return p;
  }
  /* بيانات تحليلية كاملة لقسم: نتائج النظام + الإلكترونية، شهرية، حسب المفهوم المشترك */
  async function deptAnalytics(dept) {
    const r = await readApp('readiness', dept, 'academia:data'); const db = r && r.v; if (!db) return null;
    const th = (db.settings && db.settings.thresholds) || {}, ready = +(th.ready != null ? th.ready : 80), partial = +(th.partial != null ? th.partial : 60);
    const st = (db.students || []), byUid = new Map(st.map((s) => [String(s.uid), s])), byId = new Map(st.map((s) => [s.id, s]));
    const R = (db.results || []).filter((x) => x && x.score != null && !isNaN(+x.score) && x.source !== 'online').map((x) => ({ exam: x.examId, s: byId.get(x.studentId), score: +x.score, es: x.elementScores || {}, at: x.submittedAt || x.date || '' }));
    let onl = []; try { onl = await onlineOf(dept); } catch (e) {}
    onl.forEach((x) => { if (x.score == null) return; R.push({ exam: x.exam_id, s: byUid.get(String(x.student_uid)), score: +x.score, es: x.element_scores || {}, at: x.submitted_at || '', online: true }); });
    const el = new Map((db.elements || []).map((e) => [e.id, e])), tp = new Map((db.topics || []).map((t) => [t.id, t])), un = new Map((db.units || []).map((u) => [u.id, u]));
    const unitAgg = {}, concAgg = {};
    R.forEach((x) => Object.entries(x.es).forEach(([eid, v]) => { const e = el.get(eid), t = e && tp.get(e.topicId), u = t && un.get(t.unitId); if (!u || v == null || isNaN(+v)) return;
      const k = (u.code ? u.code + ' — ' : '') + u.name; (unitAgg[k] = unitAgg[k] || []).push(+v); const c = concept(u.name); if (c) (concAgg[c] = concAgg[c] || []).push(+v); }));
    const months = {}; R.forEach((x) => { const m = String(x.at).slice(0, 7); if (/^\d{4}-\d{2}$/.test(m)) (months[m] = months[m] || []).push(x.score); });
    const sc = R.map((x) => x.score), takers = new Set(R.map((x) => x.s ? x.s.id : 'u' + Math.random())).size;
    const g = { m: R.filter((x) => x.s && x.s.gender !== 'طالبة').map((x) => x.score), f: R.filter((x) => x.s && x.s.gender === 'طالبة').map((x) => x.score) };
    const bins = [0, 0, 0, 0, 0]; sc.forEach((v) => { bins[Math.min(4, Math.floor(v / 20))]++; });
    const exams = (db.exams || []).map((e) => { const L = R.filter((x) => x.exam === e.id).map((x) => x.score); return { name: e.name, date: e.date || (e.createdAt || '').slice(0, 10), n: L.length, avg: avgOf(L), ready: L.filter((v) => v >= ready).length }; }).filter((x) => x.n);
    /* الطلاب الأضعف (آخر نتيجة لكل طالب) */
    const last = new Map(); R.slice().sort((a, b) => String(a.at).localeCompare(String(b.at))).forEach((x) => { if (x.s) last.set(x.s.id, x); });
    const atRisk = [...last.values()].filter((x) => x.score < partial).sort((a, b) => a.score - b.score).slice(0, 15).map((x) => ({ name: x.s.name, uid: x.s.uid, score: x.score }));
    let pr = 0, ab = 0; Object.values(db.attendance || {}).forEach((A) => Object.values(A || {}).forEach((x) => { const s = x && x.st; if (s === 'حاضر' || s === 'حاضرة' || s === 'متأخر' || s === 'متأخرة') pr++; else if (s === 'غائب' || s === 'غائبة') ab++; }));
    return { dept, at: r.at, ready, partial, students: st.filter((s) => s.active !== false).length, questions: (db.questions || []).length, examsN: (db.exams || []).length, results: R.length, online: onl.length, takers,
      avg: avgOf(sc), cat: { ready: sc.filter((v) => v >= ready).length, partial: sc.filter((v) => v >= partial && v < ready).length, not: sc.filter((v) => v < partial).length },
      mAvg: avgOf(g.m), fAvg: avgOf(g.f), bins, exams, atRisk, attRate: pr + ab ? pr / (pr + ab) * 100 : null, courses: (db.courses || []).length,
      units: Object.entries(unitAgg).map(([k, L]) => ({ label: k, value: avgOf(L), n: L.length })).sort((a, b) => a.value - b.value),
      conc: Object.fromEntries(Object.entries(concAgg).map(([k, L]) => [k, avgOf(L)])), months: Object.fromEntries(Object.entries(months).map(([k, L]) => [k, avgOf(L)])) };
  }
  /* رسم خطي بسيط (تطور شهري لعدة أقسام) */
  function lineChart(labels, series, o) { o = o || {}; const W = 560, H = 220, pl = 46, pr = 50, pt = 18, pb = 34, max = o.max || 100, n = labels.length;
    if (!n) return '<div class="small muted">لا توجد بيانات كافية.</div>';
    const x = (i) => W - pr - (n === 1 ? (W - pl - pr) / 2 : i * (W - pl - pr) / (n - 1)), y = (v) => pt + (H - pt - pb) * (1 - v / max); let g = '';
    [0, .25, .5, .75, 1].forEach((f) => { const yy = y(max * f); g += `<line x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}" stroke="#E4E9E6"/><text x="${W - pr + 4}" y="${yy + 4}" font-size="10" fill="#6B6584">${Math.round(max * f)}</text>`; });
    if (o.target != null) g += `<line x1="${pl}" x2="${W - pr}" y1="${y(o.target)}" y2="${y(o.target)}" stroke="#1B5E20" stroke-dasharray="5 4"/><text x="${(W - pr + pl) / 2}" y="${y(o.target) - 5}" font-size="10" text-anchor="middle" fill="#1B5E20">حد الجاهزية ${o.target}%</text>`;
    labels.forEach((lb, i) => { g += `<text x="${x(i)}" y="${H - pb + 16}" font-size="11" text-anchor="middle" fill="#6B6584">${E(lb)}</text>`; });
    series.forEach((s) => { const pts = s.values.map((v, i) => v == null ? null : [x(i), y(v), v]).filter(Boolean);
      if (pts.length > 1) g += `<polyline fill="none" stroke="${s.color}" stroke-width="2.5" points="${pts.map((p) => p[0] + ',' + p[1]).join(' ')}"/>`;
      pts.forEach((p) => { g += `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${s.color}"><title>${E(s.name)}: ${R1(p[2])}%</title></circle>`; }); });
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px" role="img">${g}</svg>${legend(series.map((s) => ({ label: s.name, color: s.color })))}`; }
  /* خريطة حرارية: صفوف × أعمدة بقيم نسبية */
  function heat(rows, cols, get, o) { o = o || {}; const col = (v) => v == null ? '#F3F1F8' : v >= (o.ok || 80) ? '#CDEBD3' : v >= (o.mid || 60) ? '#FFE9B8' : '#F8CFCB';
    return `<div class="tbl-wrap"><table class="t ld-heat"><tr><th></th>${cols.map((c) => `<th>${E(c.label)}</th>`).join('')}</tr>${rows.map((r) => `<tr><td><b>${E(r.label)}</b></td>${cols.map((c) => { const v = get(r, c); return `<td style="background:${col(v)};text-align:center;font-weight:700">${v == null ? '—' : '<bdi>' + R1(v) + '%</bdi>'}</td>`; }).join('')}</tr>`).join('')}</table></div>
      <div class="lgd"><span><i style="background:#CDEBD3"></i>≥ ${o.ok || 80}%</span><span><i style="background:#FFE9B8"></i>${o.mid || 60}–${(o.ok || 80) - 1}%</span><span><i style="background:#F8CFCB"></i>&lt; ${o.mid || 60}%</span><span><i style="background:#F3F1F8"></i>لا توجد بيانات</span></div>`; }
  /* تصدير الجداول إلى Excel (CSV بترميز يقرؤه Excel) */
  window.ldExportCsv = function (id, name) { const t = document.getElementById(id); if (!t) return; const rows = [];
    t.querySelectorAll('table').forEach((tb, k) => { if (k) rows.push([]); const cap = tb.closest('.panel'); if (cap) rows.push([(cap.querySelector('h3') || {}).textContent || '']); tb.querySelectorAll('tr').forEach((tr) => rows.push([...tr.children].map((td) => td.textContent.trim()))); });
    const csv = '﻿' + rows.map((r) => r.map((x) => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = (name || 'تقرير') + '.csv'; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 800); };
  const viewTabs = (cur) => { const L = [['', '🗂️ اللجان']]; if (collegeView() && depts().length > 1) L.push(['cmp', '📈 مقارنة الأقسام']); L.push(['ana', '🎯 تحليل الجاهزية']);
    return `<div class="ld-tabs">${L.map(([k, l]) => `<a class="${(cur || '') === k ? 'on' : ''}" onclick="go('lead',{dept:'${E(VIEW.dept || '')}'${k ? ",view:'" + k + "'" : ''}})">${l}</a>`).join('')}</div>`; };
  const heroBtns = (title) => `<button class="ld-hbtn" onclick="printDoc('${E(title)}',document.getElementById('leadBody').innerHTML)">🖨️ طباعة / PDF</button><button class="ld-hbtn" onclick="ldExportCsv('leadBody','${E(title)}')">⬇️ Excel</button>`;
  const hero = (title, sub, cur) => CSS + `<div class="ld-page"><div class="ld-hero"><div class="ld-hero-top"><span class="ic">📈</span><div style="flex:1;min-width:200px"><h2>${E(title)}</h2><div class="sub">${E(sub)}</div></div><div style="display:flex;gap:8px;flex-wrap:wrap">${heroBtns(title)}</div></div>${cur === 'ana' ? deptChips(selDept()) : ''}${viewTabs(cur)}</div><div id="leadBody">`;

  /* ---------- صفحة مقارنة الأقسام ---------- */
  function pgCompare() {
    const D = depts(); let h = hero('مقارنة الأقسام', 'الإنجاز والمؤشرات ونتائج الأنظمة جنبًا إلى جنب · ' + new Date().toLocaleDateString('ar-SA', { day: 'numeric', month: 'long', year: 'numeric' }), 'cmp');
    const W = D.map((d, i) => { const cs = commsOf(d.id), S = cs.map(cStats), sum = (k) => S.reduce((a, s) => a + s[k], 0); return { d, i, cs: cs.length, n: sum('n'), done: sum('done'), late: sum('late'), ko: sum('kpiOk'), k: sum('kpi'), avg: S.length ? Math.round(S.reduce((a, s) => a + s.avg, 0) / S.length) : 0 }; });
    h += '<div class="ld-sec">أعمال اللجان</div>';
    h += `<div class="grid2 ld">${panel('متوسط إنجاز لجان كل قسم', hbars(W.map((r) => ({ label: r.d.name, value: r.avg, color: PAL[r.i % PAL.length], sub: r.cs + ' لجنة · ' + r.n + ' مهمة' })), { max: 100 }))}
      ${panel('المهام حسب الحالة', hstack(W.map((r) => ({ label: r.d.name, done: r.done, open: r.n - r.done - r.late, late: r.late })), [{ k: 'done', l: 'مكتملة', c: 'var(--ok)' }, { k: 'open', l: 'مفتوحة', c: '#9DB9CF' }, { k: 'late', l: 'متأخرة', c: 'var(--late)' }]))}</div>`;
    h += panel('جدول أعمال اللجان', table(['القسم', 'اللجان', 'المهام', 'المكتمل', 'نسبة الإكمال', 'المتأخر', 'المؤشرات المحققة'], W.map((r) => [E(r.d.name), r.cs, r.n, r.done, bp(r.done, r.n), r.late ? `<b class="bad">${r.late}</b>` : 0, r.ko + '/' + r.k + ' (' + bp(r.ko, r.k) + ')'])));
    h += '<div class="ld-sec">نتائج الجاهزية</div><div id="ldCmpReady" class="ld-load">جارٍ تحميل نتائج الجاهزية للأقسام (ومعها نتائج الاختبارات الإلكترونية)…</div>';
    h += '<div class="ld-sec">الأنظمة المشتركة</div><div id="ldCmpShared" class="ld-load">جارٍ تحميل التدريب وقياس مخرجات التعلم…</div>';
    return h + '</div></div>';
  }
  async function fillCompare() {
    const box = $q('#ldCmpReady'); if (!box) return; const D = depts();
    const A = await Promise.all(D.map(async (d, i) => { try { return { d, i, m: await deptAnalytics(d.id) }; } catch (e) { return { d, i, m: null, err: e.message || String(e) }; } }));
    const ok = A.filter((x) => x.m && x.m.results), ready = (A.find((x) => x.m) || { m: { ready: 80, partial: 60 } }).m;
    let h = table(['القسم', 'الطلاب', 'اختبروا', 'النتائج', 'منها إلكترونية', 'المتوسط', 'جاهز', 'جزئي', 'غير جاهز', 'الحضور', 'الأسئلة في البنك'], A.map((x) => x.m ? [E(x.d.name), x.m.students, x.m.takers, x.m.results, x.m.online, fmtAvg(x.m.avg), bp(x.m.cat.ready, x.m.results), bp(x.m.cat.partial, x.m.results), bp(x.m.cat.not, x.m.results), fmtAvg(x.m.attRate), x.m.questions] : [E(x.d.name), '—', '—', '—', '—', '—', '—', '—', '—', '—', x.err ? '<span class="small bad">تعذّر</span>' : '—']));
    h = panel('ملخص الجاهزية حسب القسم', h);
    if (ok.length) {
      h += `<div class="grid2 ld">${panel('متوسط الدرجات ونسبة الجاهزين', columns(ok.map((x) => x.d.name.replace(/^قسم\s+/, '')), [{ name: 'المتوسط %', color: '#5B34A6', values: ok.map((x) => Math.round(x.m.avg || 0)) }, { name: 'الجاهزون %', color: '#1E6B52', values: ok.map((x) => pct(x.m.cat.ready, x.m.results)) }]))}
        ${panel('توزيع مستويات الجاهزية (%)', hstack(ok.map((x) => ({ label: x.d.name, r: pct(x.m.cat.ready, x.m.results), p: pct(x.m.cat.partial, x.m.results), n: pct(x.m.cat.not, x.m.results) })), [{ k: 'r', l: 'جاهز', c: 'var(--ok)' }, { k: 'p', l: 'جاهزية جزئية', c: '#C9962B' }, { k: 'n', l: 'غير جاهز', c: 'var(--late)' }]))}</div>`;
      const months = [...new Set(ok.flatMap((x) => Object.keys(x.m.months)))].sort().slice(-8);
      h += `<div class="grid2 ld">${panel('تطور متوسط الدرجات شهريًا', lineChart(months.map((m) => new Date(m + '-01T00:00:00').toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { month: 'short', year: '2-digit' })), ok.map((x) => ({ name: x.d.name.replace(/^قسم\s+/, ''), color: PAL[x.i % PAL.length], values: months.map((m) => x.m.months[m] == null ? null : x.m.months[m]) })), { target: ready.ready }))}
        ${panel('الطلاب والطالبات', columns(ok.map((x) => x.d.name.replace(/^قسم\s+/, '')), [{ name: 'الطلاب', color: '#2F6F9F', values: ok.map((x) => Math.round(x.m.mAvg || 0)) }, { name: 'الطالبات', color: '#8E3B78', values: ok.map((x) => Math.round(x.m.fAvg || 0)) }]))}</div>`;
      const cols = CONC.map(([c]) => ({ label: c })).filter((c) => ok.some((x) => x.m.conc[c.label] != null));
      if (cols.length) h += panel('المقررات المشتركة: متوسط الأداء في كل قسم', heat(ok.map((x) => ({ label: x.d.name, m: x.m })), cols, (r, c) => r.m.conc[c.label], { ok: ready.ready, mid: ready.partial })
        + '<div class="small muted" style="margin-top:6px">تُقارن المقررات المتشابهة في الأقسام بالمفهوم (مثل «أساسيات الاقتصاد» في المحاسبة = 1.1 في التمويل وإدارة الأعمال).</div>');
      const best = ok.slice().sort((a, b) => (b.m.avg || 0) - (a.m.avg || 0)), ins = [];
      ins.push('أعلى متوسط: <b>' + E(best[0].d.name) + '</b> (' + fmtAvg(best[0].m.avg) + ')' + (best.length > 1 ? '، وأدناه: <b>' + E(best[best.length - 1].d.name) + '</b> (' + fmtAvg(best[best.length - 1].m.avg) + ')' : '') + '.');
      ok.forEach((x) => { const w = x.m.units[0]; if (w) ins.push('أضعف مقرر في ' + E(x.d.name) + ': <b>' + E(w.label) + '</b> (' + fmtAvg(w.value) + ').'); });
      cols.forEach((c) => { const L = ok.filter((x) => x.m.conc[c.label] != null); if (L.length > 1) { const s = L.slice().sort((a, b) => a.m.conc[c.label] - b.m.conc[c.label]); const gap = s[s.length - 1].m.conc[c.label] - s[0].m.conc[c.label]; if (gap >= 10) ins.push('فجوة ' + R1(gap) + ' نقطة في «' + E(c.label) + '» بين ' + E(s[s.length - 1].d.name) + ' و' + E(s[0].d.name) + '.'); } });
      h += panel('🔎 قراءات سريعة', '<ul class="ld-ins">' + ins.map((t) => '<li>' + t + '</li>').join('') + '</ul>');
    } else h += '<div class="empty">لا توجد نتائج جاهزية بعد في الأقسام للمقارنة.</div>';
    box.className = ''; box.innerHTML = h;
    const sh = $q('#ldCmpShared'); if (!sh) return;
    const T2 = await Promise.all(D.map(async (d, i) => { let t = null, c = null; try { t = await trainingOf(d.id); } catch (e) {} try { c = await cloSysOf(d.id); } catch (e) {} return { d, i, t, c }; }));
    let s = `<div class="grid2 ld">${panel('التدريب الميداني حسب القسم', hstack(T2.filter((x) => x.t).map((x) => ({ label: x.d.name, ok: x.t.st.ok, wait: x.t.st.wait, no: x.t.st.no, none: x.t.st.none })), [{ k: 'ok', l: 'مقبول', c: 'var(--ok)' }, { k: 'wait', l: 'بانتظار', c: '#C9962B' }, { k: 'no', l: 'مرفوض', c: 'var(--late)' }, { k: 'none', l: 'بلا جهة', c: '#AEB8B4' }]))}
      ${panel('قياس مخرجات التعلم: نسبة الشعب المعتمدة', hbars(T2.filter((x) => x.c && x.c.secs).map((x) => ({ label: x.d.name, value: pct(x.c.st.accepted, x.c.secs), color: PAL[x.i % PAL.length], sub: x.c.st.accepted + ' من ' + x.c.secs + ' شعبة' })), { max: 100 }))}</div>`;
    s += panel('جدول الأنظمة المشتركة', table(['القسم', 'طلاب التدريب', 'مقبول', 'بانتظار', 'بلا جهة', 'مقررات القياس', 'الشعب', 'المعتمد', 'أعيد للتعديل'], T2.map((x) => [E(x.d.name), x.t ? x.t.n : '—', x.t ? x.t.st.ok : '—', x.t ? x.t.st.wait : '—', x.t ? x.t.st.none : '—', x.c ? x.c.courses : '—', x.c ? x.c.secs : '—', x.c ? x.c.st.accepted : '—', x.c ? x.c.st.returned : '—'])));
    sh.className = ''; sh.innerHTML = s;
  }

  /* ---------- صفحة تحليل الجاهزية لقسم ---------- */
  function pgAnalysis() { const dept = selDept(); VIEW.dept = dept;
    return hero('تحليل الجاهزية — ' + dName(dept), 'توزيع الدرجات، المقررات، الاختبارات، الطلاب الأكثر حاجة للدعم', 'ana') + `<div id="ldAna" data-dept="${E(dept)}" class="ld-load">جارٍ التحليل…</div></div></div>`; }
  async function fillAnalysis() {
    const box = $q('#ldAna'); if (!box) return; let m = null; try { m = await deptAnalytics(box.dataset.dept); } catch (e) { box.innerHTML = '<div class="empty">تعذّر التحميل: ' + E(e.message || e) + '</div>'; return; }
    if (!m || !m.results) { box.className = ''; box.innerHTML = '<div class="empty">لا توجد نتائج جاهزية لهذا القسم بعد.</div>'; return; }
    let h = `<p class="ld-note">آخر تحديث: ${m.at ? fmtDT(m.at) : '—'} · يشمل ${m.online} نتيجة من الاختبارات الإلكترونية · حد الجاهزية ${m.ready}% والجزئية ${m.partial}%</p>`;
    h += stats([[m.students, 'الطلاب'], [m.takers, 'اختبروا'], [m.results, 'النتائج'], [fmtAvg(m.avg), 'متوسط الدرجات'], [bp(m.cat.ready, m.results), 'نسبة الجاهزين', 'good'], [m.atRisk.length, 'دون الجاهزية الجزئية', m.atRisk.length ? 'bad' : '']]);
    h += `<div class="grid2 ld">${panel('توزيع الدرجات', columns(['0–19', '20–39', '40–59', '60–79', '80–100'], [{ name: 'عدد النتائج', color: '#5B34A6', values: m.bins }]))}
      ${panel('مستويات الجاهزية', donut([{ label: 'جاهز', value: m.cat.ready, color: 'var(--ok)' }, { label: 'جاهزية جزئية', value: m.cat.partial, color: '#C9962B' }, { label: 'غير جاهز', value: m.cat.not, color: 'var(--late)' }], 'نتيجة'))}</div>`;
    h += `<div class="grid2 ld">${panel('الأداء حسب المقرر (الأضعف أولًا)', hbars(m.units.slice(0, 12).map((u) => ({ label: u.label, value: u.value, color: u.value >= m.ready ? 'var(--ok)' : u.value >= m.partial ? '#C9962B' : 'var(--late)' })), { max: 100, target: m.ready }))}
      ${panel('تطور المتوسط شهريًا', lineChart(Object.keys(m.months).sort().slice(-8).map((k) => new Date(k + '-01T00:00:00').toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { month: 'short', year: '2-digit' })), [{ name: 'المتوسط', color: '#5B34A6', values: Object.keys(m.months).sort().slice(-8).map((k) => m.months[k]) }], { target: m.ready }))}</div>`;
    h += panel('نتائج الاختبارات', table(['الاختبار', 'التاريخ', 'المختبرون', 'المتوسط', 'الجاهزون'], m.exams.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map((e) => [E(e.name), E(e.date || '—'), e.n, fmtAvg(e.avg), e.ready + ' (' + bp(e.ready, e.n) + ')'])));
    h += `<div class="grid2 ld">${panel('المقررات بالتفصيل', table(['المقرر', 'عدد الإجابات', 'المتوسط'], m.units.map((u) => [E(u.label), u.n, `<b class="${u.value >= m.ready ? 'good' : u.value < m.partial ? 'bad' : ''}">${fmtAvg(u.value)}</b>`])))}
      ${panel('الطلاب الأكثر حاجة للدعم (آخر نتيجة)', table(['الطالب', 'الرقم الجامعي', 'الدرجة'], m.atRisk.map((s) => [E(s.name), '<bdi>' + E(s.uid) + '</bdi>', `<b class="bad">${fmtAvg(s.score)}</b>`])))}</div>`;
    box.className = ''; box.innerHTML = h;
  }
  /* الربط: تبويبات في الصفحة الرئيسية للوحة، وتوجيه العرضين الجديدين */
  { const _home = pgLeadHome; pgLeadHome = function () { return _home.apply(this, arguments).replace('<div id="leadBody">', viewTabs('') + '<div id="leadBody">'); }; }
  { const _g2 = go; go = function (page, opts) {
      if (page === 'lead' && opts && (opts.view === 'cmp' || opts.view === 'ana') && allowed()) {
        VIEW = Object.assign({ page }, opts); try { $q('#side').classList.remove('open'); $q('#main').classList.remove('hidden'); const th = $q('#toolHost'); if (th) th.classList.add('hidden'); } catch (e) {}
        renderNav(); $q('#title').textContent = 'التقارير والمتابعة';
        $q('#main').innerHTML = opts.view === 'cmp' ? (collegeView() ? pgCompare() : pgAnalysis()) : pgAnalysis(); $q('#main').scrollTop = 0;
        if (opts.view === 'cmp' && collegeView()) fillCompare(); else fillAnalysis(); return; }
      return _g2.apply(this, arguments); }; window.go = go; }
  { const st = document.createElement('style'); st.textContent = '.ld-heat td,.ld-heat th{min-width:90px}.ld-ins{margin:0;padding-inline-start:20px;line-height:2}.ld-ins li{margin:2px 0}'; document.head.appendChild(st); }

})();
