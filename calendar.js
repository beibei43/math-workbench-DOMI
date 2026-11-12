/* 学校日历与阶段时间线 · 纯数据（无逻辑）
   说明：
   - S1 / S2 / S3 的起止日期由家长提供（南宁校历口径）。
   - S4–S8 按南宁校历规律推算，标注为「预测」；官方公布后可在 calendar.js 里直接改 start/end。
   - holidays 内的区间在排课/算「有效学习周数」时自动跳过（例如春节不排新课）。
   - mode：'term' = 学期内（严格 1 任务/周，难的项给 2 周）；'break' = 寒暑假（无课时间多，密集排，每周可含多项）。
   每周节奏（见 app.js 的 WEEK_STUDY_DAYS 等常量）：约 2 小时/周，周一/三/五学新，周六日复习+本周错题。 */
window.SCHOOL_CAL = [
  { stage:'S1', name:'过渡打底期',            start:'2026-11-16', end:'2027-01-22', mode:'term',
    predicted:false, holidays:[] },
  { stage:'S2', name:'三年级寒假强化期',       start:'2027-01-23', end:'2027-02-21', mode:'break',
    predicted:false, holidays:[ {from:'2027-02-04', to:'2027-02-17', label:'春节假期（不排课）'} ] },
  { stage:'S3', name:'三下系统进阶期',         start:'2027-02-22', end:'2027-07-03', mode:'term',
    predicted:false, holidays:[] },
  { stage:'S4', name:'三年级暑假几何+行程突破期',start:'2027-07-04', end:'2027-08-31', mode:'break',
    predicted:true,  holidays:[] },
  { stage:'S5', name:'四上分百与方程深化期',     start:'2027-09-01', end:'2028-01-22', mode:'term',
    predicted:true,  holidays:[] },
  { stage:'S6', name:'四年级寒假综合突破期',     start:'2028-01-23', end:'2028-02-21', mode:'break',
    predicted:true,  holidays:[ {from:'2028-01-24', to:'2028-02-06', label:'春节假期（不排课）'} ] },
  { stage:'S7', name:'四下二轮深化与结业期',     start:'2028-02-22', end:'2028-07-03', mode:'term',
    predicted:true,  holidays:[] },
  { stage:'S8', name:'四年级暑假 · 小学总复习 + 小升初模拟', start:'2028-07-04', end:'2028-08-31', mode:'break',
    predicted:true,  holidays:[] },
  { stage:'S9', name:'五年级 · 初中数学（上）',   start:'2028-09-01', end:'2029-07-03', mode:'term',
    predicted:true,  holidays:[] },
  { stage:'S10', name:'六年级 · 初中数学（下）',  start:'2029-09-01', end:'2030-07-03', mode:'term',
    predicted:true,  holidays:[] }
];
