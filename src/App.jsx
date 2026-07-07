import { useState, useEffect, useRef, useMemo } from "react";
import {
  LayoutDashboard, PenLine, FileText, Scale, PieChart, ShoppingCart, PackageCheck,
  Boxes, ClipboardList, Truck, Receipt, Factory, Users, Landmark, Building2,
  Package, Target, Settings, Search, Plus, X, Trash2, Menu, Check, Download,
  Upload, RotateCcw, Wallet, TrendingUp, CircleDollarSign, ChevronRight,
  BookOpen, CreditCard, Layers, Banknote, GitBranch, LogOut, Cloud, Lock,
  Printer, Shield, TrendingDown, UserCog, Minus
} from "lucide-react";
import { auth, store, mode, TABLE_MISSING } from "./backend.js";
import { downloadCSV } from "./exportCsv.js";

/* ============================================================
   FlexERP — SAP 구조를 참고한 단일 파일 ERP 프로토타입
   - 모듈: FI(재무회계) CO(관리회계) MM(자재관리) SD(영업관리) PP(생산관리) HR(인사관리)
   - SAP 개념: 문서 원칙 / 번호범위 / 마스터·트랜잭션 분리 / 모듈 통합 자동 전표 / T-code
   - 디자인: Apple 스타일 (SF 시스템 폰트, 필 버튼, 반투명 사이드바, ⌘K 팔레트)
   ============================================================ */

/* ---------- 상수 ---------- */

const MODULE_INFO = {
  FI: { name: "재무회계", en: "Financial Accounting", desc: "전표 · 시산표 · 채권채무" },
  CO: { name: "관리회계", en: "Controlling", desc: "코스트센터 비용 분석" },
  MM: { name: "자재관리", en: "Materials Management", desc: "구매 · 입고 · 재고" },
  SD: { name: "영업관리", en: "Sales & Distribution", desc: "수주 · 출고 · 청구" },
  PP: { name: "생산관리", en: "Production Planning", desc: "생산오더 · 자재 투입" },
  HR: { name: "인사관리", en: "Human Resources", desc: "사원 마스터" },
};

const INDUSTRIES = [
  { id: "mfg", name: "제조업", desc: "구매 · 생산 · 판매 전 과정", modules: { FI: true, CO: true, MM: true, SD: true, PP: true, HR: true } },
  { id: "dist", name: "유통 · 도소매", desc: "매입과 판매 중심", modules: { FI: true, CO: true, MM: true, SD: true, PP: false, HR: true } },
  { id: "svc", name: "서비스업", desc: "용역 · 프로젝트 중심", modules: { FI: true, CO: true, MM: false, SD: true, PP: false, HR: true } },
  { id: "custom", name: "직접 구성", desc: "필요한 모듈만 선택", modules: { FI: true, CO: true, MM: true, SD: true, PP: true, HR: true } },
];

const DEFAULT_ACCOUNTS = [
  { code: "10100", name: "현금", type: "자산" },
  { code: "10300", name: "보통예금", type: "자산" },
  { code: "10800", name: "외상매출금", type: "자산" },
  { code: "12000", name: "미수금", type: "자산" },
  { code: "14600", name: "상품", type: "자산" },
  { code: "14900", name: "원재료", type: "자산" },
  { code: "15000", name: "제품", type: "자산" },
  { code: "20600", name: "기계장치", type: "자산" },
  { code: "21200", name: "비품", type: "자산" },
  { code: "25100", name: "외상매입금", type: "부채" },
  { code: "25300", name: "미지급금", type: "부채" },
  { code: "25400", name: "예수금", type: "부채" },
  { code: "26000", name: "단기차입금", type: "부채" },
  { code: "33100", name: "자본금", type: "자본" },
  { code: "37500", name: "이월이익잉여금", type: "자본" },
  { code: "40100", name: "상품매출", type: "수익" },
  { code: "40400", name: "제품매출", type: "수익" },
  { code: "42000", name: "용역매출", type: "수익" },
  { code: "90100", name: "이자수익", type: "수익" },
  { code: "45100", name: "매출원가", type: "비용" },
  { code: "50100", name: "급여", type: "비용" },
  { code: "51100", name: "복리후생비", type: "비용" },
  { code: "81200", name: "여비교통비", type: "비용" },
  { code: "81300", name: "접대비", type: "비용" },
  { code: "82100", name: "통신비", type: "비용" },
  { code: "83100", name: "지급수수료", type: "비용" },
  { code: "84000", name: "소모품비", type: "비용" },
];

const MAT_TYPES = ["원자재", "상품", "제품", "서비스"];
const INV_ACCT = { 원자재: "14900", 상품: "14600", 제품: "15000" };       // 재고자산 계정
const REV_ACCT = { 상품: "40100", 제품: "40400", 서비스: "42000", 원자재: "40100" }; // 매출 계정
const ACCT_TYPES = ["자산", "부채", "자본", "수익", "비용"];

const MENU = [
  { section: "개요", items: [{ id: "dashboard", label: "대시보드", icon: LayoutDashboard, tcode: "HOME" }] },
  { section: "FI · 재무회계", module: "FI", items: [
    { id: "fi-je", label: "전표 입력", icon: PenLine, tcode: "FB50" },
    { id: "fi-list", label: "전표 조회", icon: FileText, tcode: "FB03" },
    { id: "fi-tb", label: "시산표", icon: Scale, tcode: "F.08" },
    { id: "fi-fs", label: "재무제표", icon: BookOpen, tcode: "F.01" },
    { id: "fi-ar", label: "채권 · 채무", icon: CreditCard, tcode: "FBL5N" },
  ]},
  { section: "CO · 관리회계", module: "CO", items: [
    { id: "co-cc", label: "코스트센터 리포트", icon: PieChart, tcode: "S_ALR_87013611" },
  ]},
  { section: "MM · 자재관리", module: "MM", items: [
    { id: "mm-po", label: "구매발주", icon: ShoppingCart, tcode: "ME21N" },
    { id: "mm-gr", label: "입고 처리", icon: PackageCheck, tcode: "MIGO" },
    { id: "mm-stock", label: "재고 현황", icon: Boxes, tcode: "MMBE" },
  ]},
  { section: "SD · 영업관리", module: "SD", items: [
    { id: "sd-so", label: "판매주문", icon: ClipboardList, tcode: "VA01" },
    { id: "sd-dl", label: "출고 처리", icon: Truck, tcode: "VL01N" },
    { id: "sd-iv", label: "청구 · 수금", icon: Receipt, tcode: "VF01" },
  ]},
  { section: "PP · 생산관리", module: "PP", items: [
    { id: "pp-ord", label: "생산오더", icon: Factory, tcode: "CO01" },
    { id: "pp-bom", label: "BOM 관리", icon: Layers, tcode: "CS01" },
  ]},
  { section: "HR · 인사관리", module: "HR", items: [
    { id: "hr-emp", label: "사원 관리", icon: Users, tcode: "PA30" },
    { id: "hr-pay", label: "급여 지급", icon: Banknote, tcode: "PC00" },
  ]},
  { section: "마스터데이터", items: [
    { id: "md-acct", label: "계정과목", icon: Landmark, tcode: "FS00" },
    { id: "md-partner", label: "거래처", icon: Building2, tcode: "BP" },
    { id: "md-mat", label: "자재", icon: Package, tcode: "MM01" },
    { id: "md-cc", label: "코스트센터", icon: Target, tcode: "KS01" },
  ]},
  { section: "시스템", items: [
    { id: "settings", label: "설정", icon: Settings, tcode: "SPRO" },
  ]},
];

/* SAP식 문서 번호범위 (Number Range) */
const SEQ_INIT = { JE: 1900000000, PO: 4500000000, GR: 5000000000, SO: 2000000000, DL: 8000000000, IV: 9000000000, PR: 1000000000 };

/* ---------- 유틸 ---------- */

const uid = () => "id_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n) => "₩" + Math.round(Number(n) || 0).toLocaleString("ko-KR");
const fmtN = (n) => (Number(n) || 0).toLocaleString("ko-KR");
const pad = (n, w) => String(n).padStart(w, "0");

function acctIdByCode(data, code) {
  const a = data.accounts.find((x) => x.code === code);
  return a ? a.id : null;
}
function acctById(data, id) {
  return data.accounts.find((x) => x.id === id);
}
function matById(data, id) {
  return data.materials.find((x) => x.id === id);
}
function partnerById(data, id) {
  return data.partners.find((x) => x.id === id);
}
function ccById(data, id) {
  return data.costCenters.find((x) => x.id === id);
}

/* 전표에서 계정별 차/대 합계 */
function accountBalances(data) {
  const map = {};
  data.journals.forEach((j) =>
    j.lines.forEach((l) => {
      if (!l.accountId) return;
      if (!map[l.accountId]) map[l.accountId] = { dr: 0, cr: 0 };
      map[l.accountId].dr += Number(l.dr) || 0;
      map[l.accountId].cr += Number(l.cr) || 0;
    })
  );
  return map;
}
function balanceOfCode(data, code, side) {
  const id = acctIdByCode(data, code);
  const bals = accountBalances(data);
  const b = (id && bals[id]) || { dr: 0, cr: 0 };
  return side === "cr" ? b.cr - b.dr : b.dr - b.cr;
}

/* ---------- Apple 스타일 CSS ---------- */

const CSS = `
.erp-root, .erp-root * { box-sizing: border-box; margin: 0; }
.erp-root {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
    "Apple SD Gothic Neo", Pretendard, "Noto Sans KR", "Segoe UI", Roboto, sans-serif;
  background: #f5f5f7; color: #1d1d1f; height: 100vh; display: flex; overflow: hidden;
  -webkit-font-smoothing: antialiased; font-size: 14px; line-height: 1.5;
}
.erp-root ::selection { background: rgba(0,113,227,.2); }

/* 사이드바 */
.a-side {
  width: 252px; flex-shrink: 0; height: 100%; overflow-y: auto;
  background: rgba(248,248,250,.86); backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border-right: 1px solid rgba(0,0,0,.07); padding: 16px 12px 20px;
  display: flex; flex-direction: column; z-index: 40; transition: transform .28s cubic-bezier(.4,0,.2,1);
}
.a-side-logo { display: flex; align-items: center; gap: 10px; padding: 4px 8px 14px; }
.a-side-logo .dot { width: 30px; height: 30px; border-radius: 9px; background: linear-gradient(135deg,#0a84ff,#0055cc); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800; font-size:14px; letter-spacing:-.02em; box-shadow: 0 2px 6px rgba(0,90,220,.35); }
.a-side-logo .nm { font-size: 15px; font-weight: 700; letter-spacing: -.01em; }
.a-side-logo .sub { font-size: 11px; color: #86868b; margin-top: -1px; }
.a-sec { font-size: 11px; font-weight: 600; color: #86868b; padding: 14px 10px 5px; letter-spacing: .02em; }
.a-nav { width: 100%; display: flex; align-items: center; gap: 9px; padding: 7px 10px; border: 0; background: transparent; border-radius: 9px; font-size: 13.5px; color: #1d1d1f; cursor: pointer; text-align: left; transition: background .15s; font-family: inherit; }
.a-nav:hover { background: rgba(0,0,0,.05); }
.a-nav.on { background: #0071e3; color: #fff; }
.a-nav.on:hover { background: #0071e3; }
.a-side-foot { margin-top: auto; padding: 14px 8px 0; border-top: 1px solid rgba(0,0,0,.06); display:flex; align-items:center; gap:10px; }
.a-side-foot .av { width: 32px; height: 32px; border-radius: 50%; background:#e8e8ed; color:#515154; font-weight:700; font-size:13px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.a-side-foot .cn { font-size: 13px; font-weight: 600; line-height:1.25; }
.a-side-foot .cc { font-size: 11px; color: #86868b; }

/* 메인 */
.a-main { flex: 1; height: 100%; overflow-y: auto; position: relative; }
.a-topbar { position: sticky; top: 0; z-index: 30; height: 52px; display: flex; align-items: center; gap: 10px; padding: 0 22px; background: rgba(245,245,247,.78); backdrop-filter: blur(20px) saturate(180%); -webkit-backdrop-filter: blur(20px) saturate(180%); border-bottom: 1px solid rgba(0,0,0,.06); }
.a-topbar .sp { flex: 1; }
.a-search { display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px; border-radius: 9px; border: 1px solid rgba(0,0,0,.09); background: rgba(255,255,255,.75); color: #86868b; font-size: 13px; cursor: pointer; font-family: inherit; transition: all .15s; }
.a-search:hover { background: #fff; border-color: rgba(0,0,0,.15); }
.a-kbd { font-size: 11px; background: rgba(0,0,0,.05); border: 1px solid rgba(0,0,0,.08); border-radius: 5px; padding: 1px 6px; color: #6e6e73; }
.a-burger { display: none; border: 0; background: transparent; cursor: pointer; color: #1d1d1f; padding: 6px; border-radius: 8px; }
.a-burger:hover { background: rgba(0,0,0,.05); }

.a-page { padding: 26px 24px 60px; max-width: 1120px; margin: 0 auto; animation: fadeUp .3s ease; }
@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.a-h1 { font-size: 27px; font-weight: 700; letter-spacing: -.022em; }
.a-h1sub { font-size: 13.5px; color: #86868b; margin-top: 3px; }
.a-phead { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; margin-bottom: 20px; flex-wrap: wrap; }

/* 카드 */
.a-card { background: #fff; border-radius: 18px; border: 1px solid rgba(0,0,0,.055); box-shadow: 0 1px 2px rgba(0,0,0,.03); }
.a-card + .a-card { margin-top: 16px; }
.a-card-h { padding: 16px 20px 0; }
.a-card-t { font-size: 16px; font-weight: 700; letter-spacing: -.01em; }
.a-card-s { font-size: 12.5px; color: #86868b; margin-top: 2px; }

/* 버튼 */
.a-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 0; cursor: pointer; font-family: inherit; font-size: 14px; font-weight: 500; border-radius: 980px; padding: 8px 18px; transition: all .15s; white-space: nowrap; }
.a-btn:disabled { opacity: .4; cursor: default; }
.a-btn-pri { background: #0071e3; color: #fff; }
.a-btn-pri:hover:not(:disabled) { background: #0077ed; }
.a-btn-sec { background: rgba(0,0,0,.055); color: #1d1d1f; }
.a-btn-sec:hover:not(:disabled) { background: rgba(0,0,0,.09); }
.a-btn-danger { background: rgba(255,59,48,.1); color: #ff3b30; }
.a-btn-danger:hover:not(:disabled) { background: rgba(255,59,48,.16); }
.a-btn-sm { font-size: 12.5px; padding: 5px 13px; }
.a-icon-btn { border: 0; background: transparent; cursor: pointer; color: #86868b; padding: 6px; border-radius: 8px; display: inline-flex; transition: all .15s; }
.a-icon-btn:hover { background: rgba(0,0,0,.06); color: #1d1d1f; }
.a-icon-btn.red:hover { background: rgba(255,59,48,.1); color: #ff3b30; }

/* 입력 */
.a-label { display: block; font-size: 12px; font-weight: 600; color: #6e6e73; margin-bottom: 6px; }
.a-input, .a-select { width: 100%; height: 38px; border: 1px solid #d2d2d7; border-radius: 10px; padding: 0 12px; font-size: 14px; font-family: inherit; background: #fff; color: #1d1d1f; outline: none; transition: all .15s; }
.a-input:focus, .a-select:focus { border-color: #0071e3; box-shadow: 0 0 0 3.5px rgba(0,113,227,.18); }
.a-select { appearance: none; -webkit-appearance: none; background-image: url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2386868b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 11px center; padding-right: 30px; }
.a-input.num { text-align: right; font-variant-numeric: tabular-nums; }
.a-field { margin-bottom: 14px; }

/* 테이블 */
.a-tablewrap { overflow-x: auto; }
.a-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.a-table th { text-align: left; font-size: 12px; font-weight: 600; color: #86868b; padding: 11px 16px; border-bottom: 1px solid rgba(0,0,0,.07); white-space: nowrap; }
.a-table td { padding: 12px 16px; border-bottom: 1px solid rgba(0,0,0,.045); vertical-align: middle; }
.a-table tr:last-child td { border-bottom: 0; }
.a-table tr.click { cursor: pointer; transition: background .12s; }
.a-table tr.click:hover { background: rgba(0,0,0,.022); }
.a-table .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.a-table tfoot td { font-weight: 700; border-top: 1px solid rgba(0,0,0,.09); border-bottom: 0; background: rgba(0,0,0,.015); }

/* 배지 · 스위치 · 세그먼트 */
.a-badge { display: inline-flex; align-items: center; font-size: 11.5px; font-weight: 600; padding: 3px 9px; border-radius: 980px; white-space: nowrap; }
.a-switch { width: 46px; height: 28px; border-radius: 980px; border: 0; background: rgba(120,120,128,.28); position: relative; cursor: pointer; transition: background .2s; flex-shrink: 0; padding: 0; }
.a-switch.on { background: #34c759; }
.a-switch .knob { position: absolute; top: 2px; left: 2px; width: 24px; height: 24px; border-radius: 50%; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,.2); transition: transform .2s cubic-bezier(.3,.9,.4,1.2); }
.a-switch.on .knob { transform: translateX(18px); }
.a-seg { display: inline-flex; background: rgba(0,0,0,.055); border-radius: 10px; padding: 2px; gap: 2px; }
.a-seg button { border: 0; background: transparent; font-family: inherit; font-size: 13px; font-weight: 500; padding: 6px 14px; border-radius: 8px; cursor: pointer; color: #1d1d1f; transition: all .15s; }
.a-seg button.on { background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.1); font-weight: 600; }

/* 모달 · 팔레트 */
.a-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.3); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); z-index: 90; display: flex; align-items: flex-start; justify-content: center; padding: 6vh 16px 16px; animation: fadeIn .18s ease; overflow-y: auto; }
@keyframes fadeIn { from { opacity: 0; } }
.a-modal { background: #fff; border-radius: 20px; width: 100%; box-shadow: 0 24px 70px rgba(0,0,0,.22); animation: popUp .26s cubic-bezier(.3,1.1,.4,1); }
@keyframes popUp { from { opacity: 0; transform: translateY(14px) scale(.985); } to { opacity: 1; transform: none; } }
.a-modal-h { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px 12px; }
.a-modal-t { font-size: 18px; font-weight: 700; letter-spacing: -.015em; }
.a-modal-b { padding: 4px 20px 20px; }
.a-palette { background: rgba(252,252,253,.92); backdrop-filter: blur(28px) saturate(180%); -webkit-backdrop-filter: blur(28px) saturate(180%); border-radius: 16px; width: 100%; max-width: 560px; box-shadow: 0 28px 80px rgba(0,0,0,.3); overflow: hidden; animation: popUp .22s cubic-bezier(.3,1.1,.4,1); border: 1px solid rgba(0,0,0,.06); }
.a-pal-in { display: flex; align-items: center; gap: 10px; padding: 15px 18px; border-bottom: 1px solid rgba(0,0,0,.07); }
.a-pal-in input { flex: 1; border: 0; background: transparent; outline: none; font-size: 17px; font-family: inherit; color: #1d1d1f; }
.a-pal-list { max-height: 320px; overflow-y: auto; padding: 7px; }
.a-pal-item { width: 100%; display: flex; align-items: center; gap: 11px; padding: 10px 12px; border: 0; background: transparent; border-radius: 10px; cursor: pointer; font-family: inherit; text-align: left; }
.a-pal-item.hl { background: #0071e3; color: #fff; }
.a-pal-item .tl { flex: 1; font-size: 14px; font-weight: 500; }
.a-pal-item .tc { font-size: 11px; font-variant-numeric: tabular-nums; opacity: .55; font-weight: 600; letter-spacing: .02em; }

/* 토스트 */
.a-toasts { position: fixed; top: 18px; left: 50%; transform: translateX(-50%); z-index: 120; display: flex; flex-direction: column; gap: 8px; align-items: center; pointer-events: none; }
.a-toast { background: rgba(28,28,30,.92); backdrop-filter: blur(14px); color: #fff; font-size: 13.5px; font-weight: 500; padding: 10px 18px; border-radius: 980px; box-shadow: 0 8px 26px rgba(0,0,0,.28); display: flex; align-items: center; gap: 8px; animation: popUp .25s ease; max-width: 90vw; }

/* 대시보드 */
.a-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; margin-bottom: 16px; }
.a-stat { background: #fff; border-radius: 18px; border: 1px solid rgba(0,0,0,.055); padding: 18px; }
.a-stat .lb { font-size: 12.5px; color: #86868b; font-weight: 500; display: flex; align-items: center; gap: 6px; }
.a-stat .vl { font-size: 24px; font-weight: 700; letter-spacing: -.02em; margin-top: 7px; font-variant-numeric: tabular-nums; }
.a-stat .sb { font-size: 12px; color: #86868b; margin-top: 3px; }
.a-quick { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.a-quick button { display: flex; align-items: center; gap: 9px; padding: 13px 14px; border-radius: 13px; border: 1px solid rgba(0,0,0,.06); background: #fafafa; cursor: pointer; font-family: inherit; font-size: 13.5px; font-weight: 600; color: #1d1d1f; transition: all .15s; text-align: left; }
.a-quick button:hover { background: #fff; border-color: rgba(0,113,227,.4); color: #0071e3; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,.06); }
.a-bars { display: flex; align-items: flex-end; gap: 14px; height: 130px; padding: 8px 4px 0; }
.a-barcol { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; }
.a-barpair { flex: 1; display: flex; align-items: flex-end; gap: 4px; width: 100%; justify-content: center; }
.a-bar { width: 16px; border-radius: 6px 6px 3px 3px; min-height: 3px; transition: height .4s ease; }
.a-barlb { font-size: 11px; color: #86868b; }

.a-cols2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
.a-cols2 .a-card { margin-top: 0; }
.a-todos { display: flex; flex-wrap: wrap; gap: 8px; }
.a-todo { display: inline-flex; align-items: center; gap: 8px; border: 1px solid rgba(0,0,0,.08); background: #fafafa; border-radius: 980px; padding: 6px 8px 6px 14px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; color: #1d1d1f; transition: all .15s; }
.a-todo:hover { border-color: rgba(0,113,227,.45); color: #0071e3; background: #fff; }
.a-todo .n { background: #ff9500; color: #fff; border-radius: 980px; font-size: 11.5px; padding: 2px 8px; font-weight: 700; }
.a-fsrow { display: flex; justify-content: space-between; gap: 10px; font-size: 13.5px; padding: 7px 0; border-bottom: 1px solid rgba(0,0,0,.04); font-variant-numeric: tabular-nums; }
.a-fssub { display: flex; justify-content: space-between; gap: 10px; font-size: 13.5px; padding: 9px 0 3px; font-weight: 700; border-top: 1px solid rgba(0,0,0,.1); margin-top: 4px; font-variant-numeric: tabular-nums; }
.a-fshead { font-size: 12px; font-weight: 700; color: #86868b; margin: 14px 0 2px; }

/* 빈 상태 · 기타 */
.a-empty { padding: 44px 20px; text-align: center; color: #86868b; }
.a-empty .ic { display: inline-flex; padding: 14px; border-radius: 50%; background: rgba(0,0,0,.04); margin-bottom: 10px; color: #a1a1a6; }
.a-empty .t { font-size: 14px; font-weight: 600; color: #515154; }
.a-empty .s { font-size: 12.5px; margin-top: 3px; }
.a-hint { font-size: 12px; color: #86868b; }
.a-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px; }
.a-bal-ok { color: #34c759; font-weight: 700; }
.a-bal-no { color: #ff3b30; font-weight: 700; }
.a-cobar { height: 8px; border-radius: 980px; background: rgba(0,113,227,.15); overflow: hidden; }
.a-cobar > div { height: 100%; background: #0071e3; border-radius: 980px; }
.a-mask { display: none; }

/* 설정 마법사 */
.a-wiz { min-height: 100vh; width: 100%; display: flex; align-items: center; justify-content: center; padding: 24px; background: #f5f5f7; }
.a-wiz-card { width: 100%; max-width: 560px; background: #fff; border-radius: 24px; border: 1px solid rgba(0,0,0,.06); box-shadow: 0 20px 60px rgba(0,0,0,.08); padding: 34px 32px 28px; animation: popUp .35s cubic-bezier(.3,1.1,.4,1); }
.a-dots { display: flex; gap: 6px; justify-content: center; margin-bottom: 22px; }
.a-dots span { width: 7px; height: 7px; border-radius: 50%; background: rgba(0,0,0,.12); transition: all .25s; }
.a-dots span.on { background: #0071e3; width: 22px; }
.a-ind { border: 1.5px solid rgba(0,0,0,.08); border-radius: 15px; padding: 15px 16px; cursor: pointer; transition: all .15s; background: #fff; text-align: left; font-family: inherit; width: 100%; }
.a-ind:hover { border-color: rgba(0,113,227,.4); }
.a-ind.on { border-color: #0071e3; background: rgba(0,113,227,.045); box-shadow: 0 0 0 3px rgba(0,113,227,.12); }
.a-ind .n { font-size: 14.5px; font-weight: 700; }
.a-ind .d { font-size: 12.5px; color: #86868b; margin-top: 2px; }

@media (max-width: 860px) {
  .a-side { position: fixed; left: 0; top: 0; transform: translateX(-104%); box-shadow: 0 0 60px rgba(0,0,0,.15); }
  .a-side.open { transform: translateX(0); }
  .a-burger { display: inline-flex; }
  .a-mask { display: block; position: fixed; inset: 0; background: rgba(0,0,0,.3); z-index: 35; animation: fadeIn .2s; }
  .a-page { padding: 20px 16px 60px; }
  .a-grid2 { grid-template-columns: 1fr; }
  .a-cols2 { grid-template-columns: 1fr; }
  .a-search .lbl { display: none; }
}

/* 휴대폰 (≤560px) — 좁은 화면 최적화 */
@media (max-width: 560px) {
  .erp-root { font-size: 13.5px; }
  .a-page { padding: 16px 12px 48px; }
  .a-h1 { font-size: 22px; }
  .a-h1sub { font-size: 12.5px; }
  .a-phead { gap: 10px; margin-bottom: 16px; }
  .a-topbar { padding: 0 14px; gap: 8px; }
  .a-topbar .a-hint { display: none; }        /* 좁은 상단바에서 '코드 XXXX' 숨김 */
  .a-stats { gap: 10px; }
  .a-stat { padding: 15px; border-radius: 15px; }
  .a-stat .vl { font-size: 21px; }
  .a-card { border-radius: 15px; }
  .a-card + .a-card { margin-top: 12px; }

  /* 넓은 표는 셀을 한 줄로 유지하고 가로 스크롤 — 줄바꿈으로 뭉개지지 않게 */
  .a-table th, .a-table td { padding: 10px 12px; font-size: 13px; white-space: nowrap; }
  .a-tablewrap { -webkit-overflow-scrolling: touch; }

  /* 모달 · 버튼 · 팔레트 */
  .a-modal-t { font-size: 16px; }
  .a-modal-h { padding: 16px 16px 10px; }
  .a-modal-b { padding: 4px 16px 16px; }
  .a-btn { padding: 8px 15px; }
  .a-overlay { padding: 4vh 10px 10px; }
  .a-palette { max-width: 100%; }
}

/* 인쇄 · PDF 저장 — 현재 열려 있는 리포트만 깔끔하게 출력 */
@media print {
  .a-side, .a-topbar, .a-toasts, .a-mask, .a-burger, .a-btn, .a-seg, .no-print { display: none !important; }
  .erp-root { display: block !important; height: auto !important; overflow: visible !important; background: #fff !important; }
  .a-main { overflow: visible !important; height: auto !important; }
  .a-page { max-width: none !important; padding: 0 !important; margin: 0 !important; animation: none !important; }
  .a-card { box-shadow: none !important; border: 1px solid #ccc !important; break-inside: avoid; margin-top: 12px !important; }
  .a-cols2 { grid-template-columns: 1fr 1fr !important; }
  .a-h1 { font-size: 22px !important; }
}
`;

/* ---------- 공통 UI 컴포넌트 ---------- */

const BADGE_COLORS = {
  blue:   { bg: "rgba(0,113,227,.1)",  fg: "#0071e3" },
  green:  { bg: "rgba(52,199,89,.13)", fg: "#248a3d" },
  orange: { bg: "rgba(255,149,0,.14)", fg: "#c93400" },
  red:    { bg: "rgba(255,59,48,.12)", fg: "#d70015" },
  gray:   { bg: "rgba(120,120,128,.13)", fg: "#6e6e73" },
  purple: { bg: "rgba(175,82,222,.12)", fg: "#8944ab" },
};
function Badge({ color = "gray", children }) {
  const c = BADGE_COLORS[color] || BADGE_COLORS.gray;
  return <span className="a-badge" style={{ background: c.bg, color: c.fg }}>{children}</span>;
}
const STATUS_BADGE = {
  개설: ["blue", "개설"], 입고완료: ["green", "입고완료"], 출고완료: ["orange", "출고완료"],
  청구완료: ["green", "청구완료"], 생성: ["blue", "생성"], 완료: ["green", "완료"],
};
function StatusBadge({ s }) {
  const [c, t] = STATUS_BADGE[s] || ["gray", s];
  return <Badge color={c}>{t}</Badge>;
}

function Field({ label, children, style }) {
  return (
    <div className="a-field" style={style}>
      <label className="a-label">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children, width = 560 }) {
  return (
    <div className="a-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="a-modal" style={{ maxWidth: width }}>
        <div className="a-modal-h">
          <div className="a-modal-t">{title}</div>
          <button className="a-icon-btn" onClick={onClose}><X size={19} /></button>
        </div>
        <div className="a-modal-b">{children}</div>
      </div>
    </div>
  );
}

function Empty({ icon: Icon = FileText, title, sub }) {
  return (
    <div className="a-empty">
      <div className="ic"><Icon size={22} /></div>
      <div className="t">{title}</div>
      {sub && <div className="s">{sub}</div>}
    </div>
  );
}

function Table({ cols, rows, onRow, empty }) {
  if (!rows.length) return empty || <Empty title="데이터가 없습니다" sub="오른쪽 위 버튼으로 새 항목을 추가하세요" />;
  return (
    <div className="a-tablewrap">
      <table className="a-table">
        <thead>
          <tr>{cols.map((c) => <th key={c.key} className={c.align === "right" ? "num" : ""} style={{ textAlign: c.align || "left" }}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={onRow ? "click" : ""} onClick={onRow ? () => onRow(r) : undefined}>
              {cols.map((c) => (
                <td key={c.key} className={c.align === "right" ? "num" : ""} style={{ textAlign: c.align || "left" }}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Seg({ options, value, onChange }) {
  return (
    <div className="a-seg">
      {options.map((o) => (
        <button key={o.v} className={value === o.v ? "on" : ""} onClick={() => onChange(o.v)}>{o.label}</button>
      ))}
    </div>
  );
}

function Switch({ on, onChange }) {
  return (
    <button className={"a-switch" + (on ? " on" : "")} onClick={onChange} aria-pressed={on}>
      <span className="knob" />
    </button>
  );
}

function PageHead({ title, sub, action }) {
  return (
    <div className="a-phead">
      <div>
        <div className="a-h1">{title}</div>
        {sub && <div className="a-h1sub">{sub}</div>}
      </div>
      {action}
    </div>
  );
}

/* CSV 내보내기 버튼 — build(): [headers, rows] 를 반환. 데이터가 없으면 비활성화 */
function ExportBtn({ filename, build, disabled, label = "CSV 내보내기", T }) {
  return (
    <button
      className="a-btn a-btn-sec a-btn-sm"
      disabled={disabled}
      onClick={() => {
        const [headers, rows] = build();
        if (!rows || rows.length === 0) { T && T("내보낼 데이터가 없습니다"); return; }
        downloadCSV(filename + "-" + today(), headers, rows);
        T && T("CSV 파일을 내려받았습니다");
      }}
    >
      <Download size={14} /> {label}
    </button>
  );
}

/* 인쇄 / PDF 버튼 — 브라우저 인쇄 대화상자에서 'PDF로 저장' 선택 */
function PrintBtn({ label = "인쇄 · PDF" }) {
  return (
    <button className="a-btn a-btn-sec a-btn-sm" onClick={() => window.print()}>
      <Printer size={14} /> {label}
    </button>
  );
}

/* ============================================================
   초기 설정 마법사 (회사코드 · 업종 → 모듈 자동 구성, SAP SPRO 개념 단순화)
   ============================================================ */

function buildInitialData(company, modules, withSample) {
  const accounts = DEFAULT_ACCOUNTS.map((a) => ({ id: uid(), ...a }));
  const d = {
    version: 1,
    company,
    modules,
    seq: { ...SEQ_INIT },
    accounts,
    partners: [], materials: [], employees: [], costCenters: [],
    journals: [], purchaseOrders: [], goodsReceipts: [],
    salesOrders: [], deliveries: [], invoices: [], productionOrders: [],
    boms: [], payrollMonths: [],
    createdAt: Date.now(),
  };
  if (withSample) {
    d.partners = [
      { id: uid(), code: "BP-0001", name: "한빛전자", type: "고객", bizNo: "124-81-00998", contact: "김민수 과장 / 031-555-0101" },
      { id: uid(), code: "BP-0002", name: "그린테크", type: "고객", bizNo: "215-86-33210", contact: "박서연 대리 / 02-777-0202" },
      { id: uid(), code: "BP-0003", name: "대한부품", type: "공급업체", bizNo: "606-81-12345", contact: "이정호 부장 / 051-333-0303" },
      { id: uid(), code: "BP-0004", name: "서울산업자재", type: "공급업체", bizNo: "101-81-67890", contact: "최유진 팀장 / 02-222-0404" },
    ];
    d.materials = [
      { id: uid(), code: "RM-1001", name: "알루미늄 프레임", type: "원자재", unit: "EA", cost: 12000, price: 0, stock: 120 },
      { id: uid(), code: "RM-1002", name: "제어 모듈 PCB", type: "원자재", unit: "EA", cost: 45000, price: 0, stock: 60 },
      { id: uid(), code: "FG-2001", name: "스마트 분전반", type: "제품", unit: "SET", cost: 320000, price: 850000, stock: 4 },
      { id: uid(), code: "MD-3001", name: "산업용 케이블 (100m)", type: "상품", unit: "ROLL", cost: 60000, price: 95000, stock: 25 },
      { id: uid(), code: "SV-4001", name: "현장 설치 용역", type: "서비스", unit: "건", cost: 0, price: 500000, stock: 0 },
    ];
    d.employees = [
      { id: uid(), code: "EMP-001", name: "홍길동", dept: "경영지원", position: "부장", hireDate: "2019-03-02", salary: 5200000 },
      { id: uid(), code: "EMP-002", name: "이수진", dept: "영업", position: "과장", hireDate: "2021-07-12", salary: 4300000 },
      { id: uid(), code: "EMP-003", name: "박준형", dept: "생산", position: "대리", hireDate: "2023-01-16", salary: 3600000 },
    ];
    d.costCenters = [
      { id: uid(), code: "CC-100", name: "경영지원", owner: "홍길동" },
      { id: uid(), code: "CC-200", name: "생산", owner: "박준형" },
      { id: uid(), code: "CC-300", name: "영업", owner: "이수진" },
    ];
    d.boms = [{ id: uid(), productId: d.materials[2].id, components: [
      { materialId: d.materials[0].id, qty: 4 },
      { materialId: d.materials[1].id, qty: 1 },
    ] }];
    d.seq.JE = SEQ_INIT.JE + 1;
    d.journals = [{
      id: uid(), docNo: String(d.seq.JE), date: today(),
      desc: "자본금 출자 (기초 설정)", source: "수동", ref: null, createdAt: Date.now(),
      lines: [
        { accountId: acctIdByCode(d, "10300"), dr: 50000000, cr: 0 },
        { accountId: acctIdByCode(d, "33100"), dr: 0, cr: 50000000 },
      ],
    }];
  }
  return d;
}

function SetupWizard({ onDone }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [code, setCode] = useState("1000");
  const [ceo, setCeo] = useState("");
  const [bizNo, setBizNo] = useState("");
  const [industry, setIndustry] = useState("mfg");
  const [modules, setModules] = useState({ ...INDUSTRIES[0].modules });
  const [withSample, setWithSample] = useState(true);

  const pickIndustry = (ind) => { setIndustry(ind.id); setModules({ ...ind.modules }); };
  const finish = () => {
    const company = { name: name.trim(), code: code.trim() || "1000", ceo: ceo.trim(), bizNo: bizNo.trim(), industry, currency: "KRW" };
    onDone(buildInitialData(company, modules, withSample));
  };

  return (
    <div className="a-wiz">
      <div className="a-wiz-card">
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div className="dot" style={{ width: 46, height: 46, borderRadius: 13, background: "linear-gradient(135deg,#0a84ff,#0055cc)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 20, boxShadow: "0 4px 14px rgba(0,90,220,.35)" }}>F</div>
          <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-.02em", marginTop: 12 }}>FlexERP 시작하기</div>
          <div style={{ fontSize: 13, color: "#86868b", marginTop: 3 }}>SAP 구조를 참고한 유연한 ERP · 회사에 맞게 구성합니다</div>
        </div>
        <div className="a-dots">{[0, 1, 2].map((i) => <span key={i} className={i === step ? "on" : ""} />)}</div>

        {step === 0 && (
          <div>
            <Field label="회사명 *"><input className="a-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 주식회사 플렉스" autoFocus /></Field>
            <div className="a-grid2">
              <Field label="회사코드 (SAP Company Code)"><input className="a-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="1000" /></Field>
              <Field label="대표자"><input className="a-input" value={ceo} onChange={(e) => setCeo(e.target.value)} placeholder="홍길동" /></Field>
            </div>
            <Field label="사업자등록번호"><input className="a-input" value={bizNo} onChange={(e) => setBizNo(e.target.value)} placeholder="000-00-00000" /></Field>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button className="a-btn a-btn-pri" disabled={!name.trim()} onClick={() => setStep(1)}>다음 <ChevronRight size={15} /></button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>업종을 선택하세요</div>
            <div style={{ display: "grid", gap: 9 }}>
              {INDUSTRIES.map((ind) => (
                <button key={ind.id} className={"a-ind" + (industry === ind.id ? " on" : "")} onClick={() => pickIndustry(ind)}>
                  <div className="n">{ind.name}</div>
                  <div className="d">{ind.desc}</div>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#6e6e73", margin: "16px 0 8px" }}>사용할 모듈 (나중에 설정에서 변경 가능)</div>
            <div style={{ display: "grid", gap: 6 }}>
              {Object.keys(MODULE_INFO).map((k) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 4px" }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>{k} · {MODULE_INFO[k].name}</span>
                    <span className="a-hint" style={{ marginLeft: 8 }}>{MODULE_INFO[k].desc}</span>
                  </div>
                  <Switch on={!!modules[k]} onChange={() => setModules((m) => ({ ...m, [k]: !m[k] }))} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
              <button className="a-btn a-btn-sec" onClick={() => setStep(0)}>이전</button>
              <button className="a-btn a-btn-pri" onClick={() => setStep(2)}>다음 <ChevronRight size={15} /></button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>시작 데이터</div>
            <div className="a-hint" style={{ marginBottom: 14 }}>표준 계정과목 27개는 항상 기본 제공됩니다.</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", border: "1.5px solid rgba(0,0,0,.08)", borderRadius: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>샘플 마스터데이터 포함</div>
                <div className="a-hint">거래처 4 · 자재 5 · 사원 3 · 코스트센터 3 · 자본금 전표 1</div>
              </div>
              <Switch on={withSample} onChange={() => setWithSample((v) => !v)} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
              <button className="a-btn a-btn-sec" onClick={() => setStep(1)}>이전</button>
              <button className="a-btn a-btn-pri" onClick={finish}><Check size={15} /> 시스템 생성</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   커맨드 팔레트 — Spotlight 스타일 + SAP T-code
   ============================================================ */

function CommandPalette({ data, onGo, onClose }) {
  const [q, setQ] = useState("");
  const [hl, setHl] = useState(0);
  const items = useMemo(() => {
    const all = [];
    MENU.forEach((sec) => {
      if (sec.module && !data.modules[sec.module]) return;
      sec.items.forEach((it) => all.push({ ...it, sec: sec.section }));
    });
    const t = q.trim().toLowerCase();
    if (!t) return all;
    return all.filter((i) => i.label.toLowerCase().includes(t) || i.tcode.toLowerCase().includes(t) || i.sec.toLowerCase().includes(t));
  }, [q, data.modules]);

  useEffect(() => { setHl(0); }, [q]);

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHl((h) => Math.min(h + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHl((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter" && items[hl]) { onGo(items[hl].id); onClose(); }
    else if (e.key === "Escape") onClose();
  };

  return (
    <div className="a-overlay" style={{ paddingTop: "12vh" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="a-palette">
        <div className="a-pal-in">
          <Search size={18} color="#86868b" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="메뉴 또는 T-code 검색  (예: 전표, FB50, ME21N)" />
          <span className="a-kbd">esc</span>
        </div>
        <div className="a-pal-list">
          {items.length === 0 && <div className="a-empty" style={{ padding: 24 }}><div className="s">일치하는 메뉴가 없습니다</div></div>}
          {items.map((it, i) => {
            const Icon = it.icon;
            return (
              <button key={it.id} className={"a-pal-item" + (i === hl ? " hl" : "")}
                onMouseEnter={() => setHl(i)} onClick={() => { onGo(it.id); onClose(); }}>
                <Icon size={16} style={{ opacity: i === hl ? 1 : 0.55 }} />
                <span className="tl">{it.label}<span style={{ opacity: .5, fontWeight: 400, fontSize: 12, marginLeft: 8 }}>{it.sec}</span></span>
                <span className="tc">{it.tcode}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   마스터데이터 — 스키마 기반 범용 CRUD (SAP 마스터데이터 개념)
   ============================================================ */

const ENTITIES = {
  accounts: {
    key: "accounts", title: "계정과목", tcode: "FS00", sub: "계정과목표 (Chart of Accounts) — 모든 전표의 기준",
    codeGen: () => "",
    fields: [
      { key: "code", label: "계정코드", type: "text", req: true, w: 1 },
      { key: "name", label: "계정과목명", type: "text", req: true, w: 1 },
      { key: "type", label: "구분", type: "select", options: ACCT_TYPES, req: true, w: 1 },
    ],
    cols: [
      { key: "code", label: "코드" },
      { key: "name", label: "계정과목명" },
      { key: "type", label: "구분", render: (r) => <Badge color={{ 자산: "blue", 부채: "orange", 자본: "purple", 수익: "green", 비용: "red" }[r.type] || "gray"}>{r.type}</Badge> },
    ],
    sort: (a, b) => a.code.localeCompare(b.code),
  },
  partners: {
    key: "partners", title: "거래처", tcode: "BP", sub: "고객 · 공급업체 통합 마스터 (SAP Business Partner)",
    codeGen: (d) => "BP-" + pad(d.partners.length + 1, 4),
    fields: [
      { key: "code", label: "거래처코드", type: "text", req: true, w: 1 },
      { key: "name", label: "거래처명", type: "text", req: true, w: 1 },
      { key: "type", label: "유형", type: "select", options: ["고객", "공급업체", "고객+공급업체"], req: true, w: 1 },
      { key: "bizNo", label: "사업자번호", type: "text", w: 1 },
      { key: "contact", label: "담당자 · 연락처", type: "text", w: 2 },
    ],
    cols: [
      { key: "code", label: "코드" },
      { key: "name", label: "거래처명" },
      { key: "type", label: "유형", render: (r) => <Badge color={r.type === "고객" ? "blue" : r.type === "공급업체" ? "orange" : "purple"}>{r.type}</Badge> },
      { key: "bizNo", label: "사업자번호" },
      { key: "contact", label: "담당자" },
    ],
  },
  materials: {
    key: "materials", title: "자재", tcode: "MM01", sub: "원자재 · 상품 · 제품 · 서비스 마스터 (표준원가 기준)",
    codeGen: (d) => "MAT-" + pad(d.materials.length + 1, 4),
    fields: [
      { key: "code", label: "자재코드", type: "text", req: true, w: 1 },
      { key: "name", label: "자재명", type: "text", req: true, w: 1 },
      { key: "type", label: "자재유형", type: "select", options: MAT_TYPES, req: true, w: 1 },
      { key: "unit", label: "단위", type: "text", w: 1, ph: "EA / SET / 건" },
      { key: "cost", label: "표준원가 (구매단가)", type: "number", w: 1 },
      { key: "price", label: "판매단가", type: "number", w: 1 },
      { key: "stock", label: "기초재고 수량", type: "number", w: 1 },
    ],
    cols: [
      { key: "code", label: "코드" },
      { key: "name", label: "자재명" },
      { key: "type", label: "유형", render: (r) => <Badge color={{ 원자재: "gray", 상품: "blue", 제품: "green", 서비스: "purple" }[r.type]}>{r.type}</Badge> },
      { key: "unit", label: "단위" },
      { key: "cost", label: "표준원가", align: "right", render: (r) => fmt(r.cost) },
      { key: "price", label: "판매단가", align: "right", render: (r) => fmt(r.price) },
      { key: "stock", label: "현재고", align: "right", render: (r) => (r.type === "서비스" ? "—" : fmtN(r.stock)) },
    ],
  },
  employees: {
    key: "employees", title: "사원 관리", tcode: "PA30", sub: "HR 사원 마스터",
    codeGen: (d) => "EMP-" + pad(d.employees.length + 1, 3),
    fields: [
      { key: "code", label: "사번", type: "text", req: true, w: 1 },
      { key: "name", label: "이름", type: "text", req: true, w: 1 },
      { key: "dept", label: "부서", type: "text", w: 1 },
      { key: "position", label: "직급", type: "text", w: 1 },
      { key: "hireDate", label: "입사일", type: "date", w: 1 },
      { key: "salary", label: "월 급여", type: "number", w: 1 },
    ],
    cols: [
      { key: "code", label: "사번" },
      { key: "name", label: "이름" },
      { key: "dept", label: "부서" },
      { key: "position", label: "직급" },
      { key: "hireDate", label: "입사일" },
      { key: "salary", label: "월 급여", align: "right", render: (r) => fmt(r.salary) },
    ],
  },
  costCenters: {
    key: "costCenters", title: "코스트센터", tcode: "KS01", sub: "부서 · 조직 단위 비용 귀속 (CO 모듈 기준)",
    codeGen: (d) => "CC-" + pad((d.costCenters.length + 1) * 100, 3),
    fields: [
      { key: "code", label: "코스트센터 코드", type: "text", req: true, w: 1 },
      { key: "name", label: "이름", type: "text", req: true, w: 1 },
      { key: "owner", label: "책임자", type: "text", w: 2 },
    ],
    cols: [
      { key: "code", label: "코드" },
      { key: "name", label: "이름" },
      { key: "owner", label: "책임자" },
    ],
  },
};

function MasterForm({ entity, initial, data, onSave, onClose }) {
  const [v, setV] = useState(() => {
    if (initial) return { ...initial };
    const base = {};
    entity.fields.forEach((f) => { base[f.key] = f.type === "number" ? 0 : ""; });
    base.code = entity.codeGen(data);
    return base;
  });
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }));
  const valid = entity.fields.every((f) => !f.req || String(v[f.key] || "").trim());
  return (
    <Modal title={(initial ? "수정 — " : "신규 — ") + entity.title} onClose={onClose} width={520}>
      <div className="a-grid2">
        {entity.fields.map((f) => (
          <Field key={f.key} label={f.label + (f.req ? " *" : "")} style={f.w === 2 ? { gridColumn: "1 / -1" } : null}>
            {f.type === "select" ? (
              <select className="a-select" value={v[f.key]} onChange={(e) => set(f.key, e.target.value)}>
                <option value="">선택</option>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input className={"a-input" + (f.type === "number" ? " num" : "")}
                type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                value={v[f.key]} placeholder={f.ph || ""}
                onChange={(e) => set(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)} />
            )}
          </Field>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
        <button className="a-btn a-btn-sec" onClick={onClose}>취소</button>
        <button className="a-btn a-btn-pri" disabled={!valid} onClick={() => onSave(v)}><Check size={15} /> 저장</button>
      </div>
    </Modal>
  );
}

function MasterPage({ entityKey, data, api, T }) {
  const entity = ENTITIES[entityKey];
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null); // null | 'new' | row
  const rows = useMemo(() => {
    let list = [...data[entity.key]];
    if (entity.sort) list.sort(entity.sort);
    const t = q.trim().toLowerCase();
    if (t) list = list.filter((r) => Object.values(r).some((val) => String(val).toLowerCase().includes(t)));
    return list;
  }, [data, q, entityKey]);

  const cols = [
    ...entity.cols,
    { key: "_del", label: "", align: "right", render: (r) => (
      <button className="a-icon-btn red" onClick={(e) => { e.stopPropagation(); api.deleteMaster(entity.key, r.id); T(entity.title + " 항목을 삭제했습니다"); }}>
        <Trash2 size={15} />
      </button>
    )},
  ];

  return (
    <div className="a-page">
      <PageHead title={entity.title} sub={entity.sub + "  ·  T-code " + entity.tcode}
        action={<div style={{ display: "flex", gap: 8 }}>
          <ExportBtn filename={entity.key} T={T} disabled={rows.length === 0}
            build={() => [entity.fields.map((f) => f.label), rows.map((r) => entity.fields.map((f) => r[f.key]))]} />
          <button className="a-btn a-btn-pri" onClick={() => setModal("new")}><Plus size={15} /> 신규 등록</button>
        </div>} />
      <div className="a-card">
        <div style={{ padding: "14px 16px 4px" }}>
          <input className="a-input" style={{ maxWidth: 300 }} placeholder="검색" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Table cols={cols} rows={rows} onRow={(r) => setModal(r)} />
      </div>
      {modal && (
        <MasterForm entity={entity} data={data} initial={modal === "new" ? null : modal}
          onClose={() => setModal(null)}
          onSave={(v) => {
            if (modal === "new") { api.addMaster(entity.key, v); T(entity.title + "에 등록했습니다"); }
            else { api.updateMaster(entity.key, modal.id, v); T("수정했습니다"); }
            setModal(null);
          }} />
      )}
    </div>
  );
}

/* ============================================================
   FI 재무회계 — 전표 입력(FB50) · 조회(FB03) · 시산표(F.08)
   문서 원칙: 모든 거래는 차대 균형이 맞는 회계문서로 기록됨
   ============================================================ */

function blankJELine() { return { key: uid(), accountId: "", dr: "", cr: "", costCenterId: "", partnerId: "" }; }

function JEPage({ data, api, T, go }) {
  const [date, setDate] = useState(today());
  const [desc, setDesc] = useState("");
  const [lines, setLines] = useState([blankJELine(), blankJELine()]);

  const setLine = (key, k, v) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, [k]: v } : l)));
  const valid = lines.filter((l) => l.accountId && (Number(l.dr) > 0 || Number(l.cr) > 0));
  const totDr = valid.reduce((s, l) => s + (Number(l.dr) || 0), 0);
  const totCr = valid.reduce((s, l) => s + (Number(l.cr) || 0), 0);
  const balanced = totDr > 0 && totDr === totCr;

  const save = () => {
    api.postJournal({
      date, desc: desc.trim() || "수동 전표",
      lines: valid.map((l) => ({ accountId: l.accountId, dr: Number(l.dr) || 0, cr: Number(l.cr) || 0, costCenterId: l.costCenterId || null, partnerId: l.partnerId || null })),
    });
    T("전표가 전기되었습니다 (문서번호 자동 채번)");
    setDesc(""); setLines([blankJELine(), blankJELine()]);
    go("fi-list");
  };

  const accSorted = [...data.accounts].sort((a, b) => a.code.localeCompare(b.code));

  return (
    <div className="a-page">
      <PageHead title="전표 입력" sub="차변과 대변의 합계가 일치해야 전기됩니다  ·  T-code FB50" />
      <div className="a-card" style={{ padding: 20 }}>
        <div className="a-grid2">
          <Field label="전기일"><input type="date" className="a-input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="적요"><input className="a-input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="예: 6월 사무실 임차료 지급" /></Field>
        </div>
        <div className="a-tablewrap">
          <table className="a-table">
            <thead><tr><th style={{ minWidth: 190 }}>계정과목</th><th className="num" style={{ minWidth: 130 }}>차변</th><th className="num" style={{ minWidth: 130 }}>대변</th><th style={{ minWidth: 130 }}>코스트센터</th><th style={{ minWidth: 130 }}>거래처</th><th></th></tr></thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key}>
                  <td>
                    <select className="a-select" value={l.accountId} onChange={(e) => setLine(l.key, "accountId", e.target.value)}>
                      <option value="">계정 선택</option>
                      {accSorted.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                    </select>
                  </td>
                  <td><input type="number" className="a-input num" value={l.dr} placeholder="0" onChange={(e) => setLine(l.key, "dr", e.target.value)} /></td>
                  <td><input type="number" className="a-input num" value={l.cr} placeholder="0" onChange={(e) => setLine(l.key, "cr", e.target.value)} /></td>
                  <td>
                    <select className="a-select" value={l.costCenterId} onChange={(e) => setLine(l.key, "costCenterId", e.target.value)}>
                      <option value="">—</option>
                      {data.costCenters.map((c) => <option key={c.id} value={c.id}>{c.code} {c.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="a-select" value={l.partnerId} onChange={(e) => setLine(l.key, "partnerId", e.target.value)}>
                      <option value="">—</option>
                      {data.partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="a-icon-btn red" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
          <button className="a-btn a-btn-sec a-btn-sm" onClick={() => setLines((ls) => [...ls, blankJELine()])}><Plus size={14} /> 라인 추가</button>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 13.5, fontVariantNumeric: "tabular-nums" }}>
            차변 <b>{fmt(totDr)}</b> &nbsp;·&nbsp; 대변 <b>{fmt(totCr)}</b> &nbsp;
            {balanced
              ? <span className="a-bal-ok"><Check size={13} style={{ verticalAlign: -2 }} /> 균형</span>
              : <span className="a-bal-no">차액 {fmt(Math.abs(totDr - totCr))}</span>}
          </div>
          <button className="a-btn a-btn-pri" disabled={!balanced} onClick={save}>전기 (Post)</button>
        </div>
      </div>
    </div>
  );
}

function JEDetailModal({ je, data, api, onClose }) {
  return (
    <Modal title={"전표 " + je.docNo} onClose={onClose} width={620}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <Badge color={je.source === "수동" ? "gray" : je.source === "역분개" ? "purple" : "blue"}>{je.source === "수동" ? "수동 전표" : je.source === "역분개" ? "역분개 전표" : je.source + " 자동 전표"}</Badge>
        {je.reversed && <Badge color="red">역분개됨 → {je.reversedBy}</Badge>}
        <span className="a-hint">{je.date} · {je.desc}{je.ref ? " · 참조 " + je.ref : ""}</span>
      </div>
      <div className="a-tablewrap">
        <table className="a-table">
          <thead><tr><th>계정과목</th><th className="num">차변</th><th className="num">대변</th><th>코스트센터</th><th>거래처</th></tr></thead>
          <tbody>
            {je.lines.map((l, i) => {
              const a = acctById(data, l.accountId);
              return (
                <tr key={i}>
                  <td>{a ? a.code + " · " + a.name : "(삭제된 계정)"}</td>
                  <td className="num">{l.dr ? fmt(l.dr) : ""}</td>
                  <td className="num">{l.cr ? fmt(l.cr) : ""}</td>
                  <td>{l.costCenterId ? (ccById(data, l.costCenterId) || {}).name || "—" : "—"}</td>
                  <td>{l.partnerId ? (partnerById(data, l.partnerId) || {}).name || "—" : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {api && !je.reversed && je.source !== "역분개" && (
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <span className="a-hint">회계만 반전됩니다 (재고 수량은 유지)</span>
          <button className="a-btn a-btn-danger a-btn-sm" onClick={() => { api.reverseJournal(je.id); onClose(); }}><RotateCcw size={13} /> 역분개 (FB08)</button>
        </div>
      )}
    </Modal>
  );
}

function JEListPage({ data, api, T }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return data.journals.filter((j) => !t || j.docNo.includes(t) || (j.desc || "").toLowerCase().includes(t));
  }, [data.journals, q]);

  /* 전표 라인 단위로 내보내기 (회계 분석에 유용) */
  const exportJE = () => {
    const headers = ["문서번호", "전기일", "적요", "출처", "역분개여부", "계정코드", "계정과목", "차변", "대변", "코스트센터", "거래처"];
    const out = [];
    rows.forEach((j) => j.lines.forEach((l) => {
      const a = acctById(data, l.accountId);
      out.push([
        j.docNo, j.date, j.desc, j.source, j.reversed ? "역분개됨" : "",
        a ? a.code : "", a ? a.name : "(삭제된 계정)",
        Number(l.dr) || 0, Number(l.cr) || 0,
        l.costCenterId ? (ccById(data, l.costCenterId) || {}).name || "" : "",
        l.partnerId ? (partnerById(data, l.partnerId) || {}).name || "" : "",
      ]);
    }));
    return [headers, out];
  };
  const cols = [
    { key: "docNo", label: "문서번호", render: (r) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{r.docNo}</span> },
    { key: "date", label: "전기일" },
    { key: "desc", label: "적요" },
    { key: "source", label: "출처", render: (r) => (
      <span style={{ display: "inline-flex", gap: 5, flexWrap: "wrap" }}>
        <Badge color={{ 수동: "gray", 역분개: "purple" }[r.source] || "blue"}>{r.source}</Badge>
        {r.reversed && <Badge color="red">역분개됨</Badge>}
      </span>
    )},
    { key: "amt", label: "금액", align: "right", render: (r) => fmt(r.lines.reduce((s, l) => s + (Number(l.dr) || 0), 0)) },
  ];
  return (
    <div className="a-page">
      <PageHead title="전표 조회" sub={"총 " + data.journals.length + "건 · 행을 누르면 상세 · 역분개(FB08) 가능 · T-code FB03"}
        action={<ExportBtn filename="전표" T={T} disabled={rows.length === 0} label="전표 라인 CSV" build={exportJE} />} />
      <div className="a-card">
        <div style={{ padding: "14px 16px 4px" }}>
          <input className="a-input" style={{ maxWidth: 300 }} placeholder="문서번호 · 적요 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Table cols={cols} rows={rows} onRow={setSel}
          empty={<Empty icon={FileText} title="전표가 없습니다" sub="전표 입력에서 수동 전기하거나, 입고·청구 시 자동 생성됩니다" />} />
      </div>
      {sel && <JEDetailModal je={sel} data={data} api={api} onClose={() => setSel(null)} />}
    </div>
  );
}

function TrialBalancePage({ data, T }) {
  const bals = accountBalances(data);
  const rows = [...data.accounts].sort((a, b) => a.code.localeCompare(b.code))
    .map((a) => ({ a, b: bals[a.id] })).filter((x) => x.b);
  const tot = rows.reduce((s, x) => ({ dr: s.dr + x.b.dr, cr: s.cr + x.b.cr }), { dr: 0, cr: 0 });
  const exportTB = () => [
    ["계정코드", "계정과목", "구분", "차변합계", "대변합계", "차변잔액", "대변잔액"],
    rows.map(({ a, b }) => {
      const net = b.dr - b.cr;
      return [a.code, a.name, a.type, b.dr, b.cr, net > 0 ? net : 0, net < 0 ? -net : 0];
    }),
  ];
  return (
    <div className="a-page">
      <PageHead title="시산표" sub="누적 합계잔액시산표 · 모든 자동/수동 전표 반영 · T-code F.08"
        action={<div style={{ display: "flex", gap: 8 }}><PrintBtn /><ExportBtn filename="시산표" T={T} disabled={rows.length === 0} build={exportTB} /></div>} />
      <div className="a-card">
        {rows.length === 0 ? <Empty icon={Scale} title="집계할 전표가 없습니다" /> : (
          <div className="a-tablewrap">
            <table className="a-table">
              <thead><tr><th>계정</th><th>구분</th><th className="num">차변 합계</th><th className="num">대변 합계</th><th className="num">차변 잔액</th><th className="num">대변 잔액</th></tr></thead>
              <tbody>
                {rows.map(({ a, b }) => {
                  const net = b.dr - b.cr;
                  return (
                    <tr key={a.id}>
                      <td>{a.code} · {a.name}</td>
                      <td><Badge color={{ 자산: "blue", 부채: "orange", 자본: "purple", 수익: "green", 비용: "red" }[a.type]}>{a.type}</Badge></td>
                      <td className="num">{b.dr ? fmt(b.dr) : ""}</td>
                      <td className="num">{b.cr ? fmt(b.cr) : ""}</td>
                      <td className="num">{net > 0 ? fmt(net) : ""}</td>
                      <td className="num">{net < 0 ? fmt(-net) : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr><td>합계</td><td></td><td className="num">{fmt(tot.dr)}</td><td className="num">{fmt(tot.cr)}</td>
                  <td className="num" colSpan={2} style={{ textAlign: "right" }}>
                    {tot.dr === tot.cr ? <span className="a-bal-ok">차대 균형 일치</span> : <span className="a-bal-no">불일치</span>}
                  </td></tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   공통 — 주문(발주/수주) 라인 입력 폼 & 상세 모달
   ============================================================ */

function blankOrdLine() { return { key: uid(), materialId: "", qty: 1, price: "" }; }

function OrderForm({ title, partnerLabel, partners, materials, priceField, data, onSave, onClose }) {
  const [partnerId, setPartnerId] = useState("");
  const [date, setDate] = useState(today());
  const [lines, setLines] = useState([blankOrdLine()]);
  const setLine = (key, k, v) => setLines((ls) => ls.map((l) => {
    if (l.key !== key) return l;
    const nl = { ...l, [k]: v };
    if (k === "materialId") {
      const m = matById(data, v);
      nl.price = m ? m[priceField] || 0 : "";
    }
    return nl;
  }));
  const valid = lines.filter((l) => l.materialId && Number(l.qty) > 0);
  const total = valid.reduce((s, l) => s + Number(l.qty) * (Number(l.price) || 0), 0);
  const ok = partnerId && valid.length > 0;
  return (
    <Modal title={title} onClose={onClose} width={640}>
      <div className="a-grid2">
        <Field label={partnerLabel + " *"}>
          <select className="a-select" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
            <option value="">선택</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
          </select>
        </Field>
        <Field label="문서일자"><input type="date" className="a-input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <div className="a-tablewrap">
        <table className="a-table">
          <thead><tr><th style={{ minWidth: 200 }}>자재</th><th className="num" style={{ width: 90 }}>수량</th><th className="num" style={{ width: 130 }}>단가</th><th className="num">금액</th><th></th></tr></thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.key}>
                <td>
                  <select className="a-select" value={l.materialId} onChange={(e) => setLine(l.key, "materialId", e.target.value)}>
                    <option value="">자재 선택</option>
                    {materials.map((m) => <option key={m.id} value={m.id}>{m.code} · {m.name}</option>)}
                  </select>
                </td>
                <td><input type="number" className="a-input num" value={l.qty} min="1" onChange={(e) => setLine(l.key, "qty", e.target.value)} /></td>
                <td><input type="number" className="a-input num" value={l.price} onChange={(e) => setLine(l.key, "price", e.target.value)} /></td>
                <td className="num">{fmt(Number(l.qty) * (Number(l.price) || 0))}</td>
                <td style={{ textAlign: "right" }}>
                  <button className="a-icon-btn red" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
        <button className="a-btn a-btn-sec a-btn-sm" onClick={() => setLines((ls) => [...ls, blankOrdLine()])}><Plus size={14} /> 라인 추가</button>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 14 }}>합계 <b>{fmt(total)}</b></div>
        <button className="a-btn a-btn-pri" disabled={!ok}
          onClick={() => onSave({ partnerId, date, lines: valid.map((l) => ({ materialId: l.materialId, qty: Number(l.qty), price: Number(l.price) || 0 })) })}>
          <Check size={15} /> 저장
        </button>
      </div>
    </Modal>
  );
}

function OrderDetailModal({ title, order, partnerName, data, flow, onClose }) {
  const total = order.lines.reduce((s, l) => s + l.qty * l.price, 0);
  return (
    <Modal title={title} onClose={onClose} width={560}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <StatusBadge s={order.status} />
        <span className="a-hint">{order.date} · {partnerName}</span>
      </div>
      <div className="a-tablewrap">
        <table className="a-table">
          <thead><tr><th>자재</th><th className="num">수량</th><th className="num">단가</th><th className="num">금액</th></tr></thead>
          <tbody>
            {order.lines.map((l, i) => {
              const m = matById(data, l.materialId);
              return (
                <tr key={i}>
                  <td>{m ? m.code + " · " + m.name : "(삭제된 자재)"}</td>
                  <td className="num">{fmtN(l.qty)}</td>
                  <td className="num">{fmt(l.price)}</td>
                  <td className="num">{fmt(l.qty * l.price)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot><tr><td colSpan={3}>합계</td><td className="num">{fmt(total)}</td></tr></tfoot>
        </table>
      </div>
      {flow && flow.length > 1 && (
        <div style={{ marginTop: 16 }}>
          <div className="a-label" style={{ display: "flex", alignItems: "center", gap: 6 }}><GitBranch size={13} /> 문서 흐름 (Document Flow)</div>
          <div style={{ display: "grid", gap: 6 }}>
            {flow.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, padding: "7px 11px", background: "rgba(0,0,0,.025)", borderRadius: 10 }}>
                <Badge color={f.c}>{f.t}</Badge>
                <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{f.docNo}</span>
                <span className="a-hint">{f.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

/* MM 자재관리 — 구매발주(ME21N) · 입고(MIGO) · 재고(MMBE)
   입고 시 재고 증가 + 회계전표(재고자산/외상매입금) 자동 생성 */

function POPage({ data, api, T }) {
  const [modal, setModal] = useState(false);
  const [sel, setSel] = useState(null);
  const vendors = data.partners.filter((p) => p.type !== "고객");
  const cols = [
    { key: "docNo", label: "발주번호" },
    { key: "date", label: "발주일" },
    { key: "vendor", label: "공급업체", render: (r) => (partnerById(data, r.vendorId) || {}).name || "—" },
    { key: "amt", label: "금액", align: "right", render: (r) => fmt(r.lines.reduce((s, l) => s + l.qty * l.price, 0)) },
    { key: "status", label: "상태", render: (r) => <StatusBadge s={r.status} /> },
  ];
  return (
    <div className="a-page">
      <PageHead title="구매발주" sub="공급업체에 대한 발주 문서 · 입고 처리에서 재고와 회계에 반영 · T-code ME21N"
        action={<button className="a-btn a-btn-pri" onClick={() => setModal(true)}><Plus size={15} /> 발주 생성</button>} />
      <div className="a-card">
        <Table cols={cols} rows={data.purchaseOrders} onRow={setSel}
          empty={<Empty icon={ShoppingCart} title="발주가 없습니다" sub="발주 생성 → 입고 처리 순서로 진행하세요" />} />
      </div>
      {modal && (
        <OrderForm title="구매발주 생성" partnerLabel="공급업체" partners={vendors}
          materials={data.materials} priceField="cost" data={data}
          onClose={() => setModal(false)}
          onSave={(v) => { api.createPO(v); T("구매발주가 생성되었습니다"); setModal(false); }} />
      )}
      {sel && <OrderDetailModal title={"발주 " + sel.docNo} order={sel} data={data} flow={poFlow(data, sel)}
        partnerName={(partnerById(data, sel.vendorId) || {}).name || "—"} onClose={() => setSel(null)} />}
    </div>
  );
}

function GRPage({ data, api, T }) {
  const [tab, setTab] = useState("wait");
  const open = data.purchaseOrders.filter((p) => p.status === "개설");
  const waitCols = [
    { key: "docNo", label: "발주번호" },
    { key: "date", label: "발주일" },
    { key: "vendor", label: "공급업체", render: (r) => (partnerById(data, r.vendorId) || {}).name || "—" },
    { key: "amt", label: "금액", align: "right", render: (r) => fmt(r.lines.reduce((s, l) => s + l.qty * l.price, 0)) },
    { key: "_a", label: "", align: "right", render: (r) => (
      <button className="a-btn a-btn-pri a-btn-sm" onClick={(e) => { e.stopPropagation(); api.postGR(r.id); }}>
        <PackageCheck size={14} /> 입고 처리
      </button>
    )},
  ];
  const histCols = [
    { key: "docNo", label: "입고번호" },
    { key: "date", label: "입고일" },
    { key: "vendor", label: "공급업체", render: (r) => (partnerById(data, r.vendorId) || {}).name || "—" },
    { key: "amount", label: "금액", align: "right", render: (r) => fmt(r.amount) },
    { key: "_p", label: "대금", align: "right", render: (r) => r.paid
      ? <Badge color="green">지급완료</Badge>
      : <button className="a-btn a-btn-sec a-btn-sm" onClick={(e) => { e.stopPropagation(); api.payGR(r.id); T("지급 전표가 생성되었습니다 (보통예금 → 외상매입금)"); }}>지급</button> },
  ];
  return (
    <div className="a-page">
      <PageHead title="입고 처리" sub="발주 기준 입고 → 재고 증가 + 자동 회계전표 · T-code MIGO"
        action={<Seg options={[{ v: "wait", label: "입고 대기 " + open.length }, { v: "hist", label: "입고 이력 " + data.goodsReceipts.length }]} value={tab} onChange={setTab} />} />
      <div className="a-card">
        {tab === "wait"
          ? <Table cols={waitCols} rows={open} empty={<Empty icon={PackageCheck} title="입고 대기 발주가 없습니다" sub="구매발주를 먼저 생성하세요" />} />
          : <Table cols={histCols} rows={data.goodsReceipts} empty={<Empty icon={PackageCheck} title="입고 이력이 없습니다" />} />}
      </div>
    </div>
  );
}

function StockPage({ data, T }) {
  const rows = data.materials.filter((m) => m.type !== "서비스");
  const total = rows.reduce((s, m) => s + (Number(m.stock) || 0) * (Number(m.cost) || 0), 0);
  const exportStock = () => [
    ["자재코드", "자재명", "유형", "단위", "현재고", "표준원가", "재고금액"],
    rows.map((m) => [m.code, m.name, m.type, m.unit, Number(m.stock) || 0, Number(m.cost) || 0, (Number(m.stock) || 0) * (Number(m.cost) || 0)]),
  ];
  return (
    <div className="a-page">
      <PageHead title="재고 현황" sub="표준원가 기준 재고 평가 · 입고 · 출고 · 생산으로 자동 증감 · T-code MMBE"
        action={<ExportBtn filename="재고현황" T={T} disabled={rows.length === 0} build={exportStock} />} />
      <div className="a-card">
        {rows.length === 0 ? <Empty icon={Boxes} title="재고 자재가 없습니다" sub="마스터데이터 > 자재에서 등록하세요" /> : (
          <div className="a-tablewrap">
            <table className="a-table">
              <thead><tr><th>자재</th><th>유형</th><th>단위</th><th className="num">현재고</th><th className="num">표준원가</th><th className="num">재고금액</th></tr></thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td>{m.code} · {m.name}</td>
                    <td><Badge color={{ 원자재: "gray", 상품: "blue", 제품: "green" }[m.type]}>{m.type}</Badge></td>
                    <td>{m.unit}</td>
                    <td className="num" style={Number(m.stock) <= 0 ? { color: "#ff3b30", fontWeight: 700 } : null}>{fmtN(m.stock)}</td>
                    <td className="num">{fmt(m.cost)}</td>
                    <td className="num">{fmt((Number(m.stock) || 0) * (Number(m.cost) || 0))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={5}>재고자산 합계</td><td className="num">{fmt(total)}</td></tr></tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   SD 영업관리 — 판매주문(VA01) · 출고(VL01N) · 청구/수금(VF01)
   출고: 재고 차감 + 매출원가 전표 / 청구: 매출채권 · 매출 전표
   ============================================================ */

function SOPage({ data, api, T }) {
  const [modal, setModal] = useState(false);
  const [sel, setSel] = useState(null);
  const customers = data.partners.filter((p) => p.type !== "공급업체");
  const cols = [
    { key: "docNo", label: "수주번호" },
    { key: "date", label: "수주일" },
    { key: "cust", label: "고객", render: (r) => (partnerById(data, r.customerId) || {}).name || "—" },
    { key: "amt", label: "금액", align: "right", render: (r) => fmt(r.lines.reduce((s, l) => s + l.qty * l.price, 0)) },
    { key: "status", label: "상태", render: (r) => <StatusBadge s={r.status} /> },
  ];
  return (
    <div className="a-page">
      <PageHead title="판매주문" sub="수주 → 출고 → 청구 · 수금 순서로 흐릅니다 · T-code VA01"
        action={<button className="a-btn a-btn-pri" onClick={() => setModal(true)}><Plus size={15} /> 주문 생성</button>} />
      <div className="a-card">
        <Table cols={cols} rows={data.salesOrders} onRow={setSel}
          empty={<Empty icon={ClipboardList} title="판매주문이 없습니다" sub="주문 생성 후 출고 처리에서 재고와 원가에 반영됩니다" />} />
      </div>
      {modal && (
        <OrderForm title="판매주문 생성" partnerLabel="고객" partners={customers}
          materials={data.materials} priceField="price" data={data}
          onClose={() => setModal(false)}
          onSave={(v) => { api.createSO(v); T("판매주문이 생성되었습니다"); setModal(false); }} />
      )}
      {sel && <OrderDetailModal title={"수주 " + sel.docNo} order={sel} data={data} flow={soFlow(data, sel)}
        partnerName={(partnerById(data, sel.customerId) || {}).name || "—"} onClose={() => setSel(null)} />}
    </div>
  );
}

function DeliveryPage({ data, api }) {
  const [tab, setTab] = useState("wait");
  const open = data.salesOrders.filter((s) => s.status === "개설");
  const waitCols = [
    { key: "docNo", label: "수주번호" },
    { key: "date", label: "수주일" },
    { key: "cust", label: "고객", render: (r) => (partnerById(data, r.customerId) || {}).name || "—" },
    { key: "amt", label: "금액", align: "right", render: (r) => fmt(r.lines.reduce((s, l) => s + l.qty * l.price, 0)) },
    { key: "_a", label: "", align: "right", render: (r) => (
      <button className="a-btn a-btn-pri a-btn-sm" onClick={(e) => { e.stopPropagation(); api.postDelivery(r.id); }}>
        <Truck size={14} /> 출고 처리
      </button>
    )},
  ];
  const histCols = [
    { key: "docNo", label: "출고번호" },
    { key: "date", label: "출고일" },
    { key: "cust", label: "고객", render: (r) => (partnerById(data, r.customerId) || {}).name || "—" },
    { key: "amount", label: "출고 금액", align: "right", render: (r) => fmt(r.amount) },
  ];
  return (
    <div className="a-page">
      <PageHead title="출고 처리" sub="재고 차감 + 매출원가 자동 전표 · 재고 부족 시 출고 불가 · T-code VL01N"
        action={<Seg options={[{ v: "wait", label: "출고 대기 " + open.length }, { v: "hist", label: "출고 이력 " + data.deliveries.length }]} value={tab} onChange={setTab} />} />
      <div className="a-card">
        {tab === "wait"
          ? <Table cols={waitCols} rows={open} empty={<Empty icon={Truck} title="출고 대기 주문이 없습니다" sub="판매주문을 먼저 생성하세요" />} />
          : <Table cols={histCols} rows={data.deliveries} empty={<Empty icon={Truck} title="출고 이력이 없습니다" />} />}
      </div>
    </div>
  );
}

function BillingPage({ data, api }) {
  const [tab, setTab] = useState("wait");
  const open = data.salesOrders.filter((s) => s.status === "출고완료");
  const waitCols = [
    { key: "docNo", label: "수주번호" },
    { key: "date", label: "수주일" },
    { key: "cust", label: "고객", render: (r) => (partnerById(data, r.customerId) || {}).name || "—" },
    { key: "amt", label: "금액", align: "right", render: (r) => fmt(r.lines.reduce((s, l) => s + l.qty * l.price, 0)) },
    { key: "_a", label: "", align: "right", render: (r) => (
      <button className="a-btn a-btn-pri a-btn-sm" onClick={(e) => { e.stopPropagation(); api.postInvoice(r.id); }}>
        <Receipt size={14} /> 청구서 발행
      </button>
    )},
  ];
  const listCols = [
    { key: "docNo", label: "청구번호" },
    { key: "date", label: "발행일" },
    { key: "cust", label: "고객", render: (r) => (partnerById(data, r.customerId) || {}).name || "—" },
    { key: "amount", label: "청구 금액", align: "right", render: (r) => fmt(r.amount) },
    { key: "_p", label: "수금", align: "right", render: (r) => r.paid
      ? <Badge color="green">수금완료</Badge>
      : <button className="a-btn a-btn-sec a-btn-sm" onClick={(e) => { e.stopPropagation(); api.collectInvoice(r.id); }}>수금 처리</button> },
  ];
  return (
    <div className="a-page">
      <PageHead title="청구 · 수금" sub="청구 시 외상매출금/매출 전표, 수금 시 예금 입금 전표가 자동 생성됩니다 · T-code VF01"
        action={<Seg options={[{ v: "wait", label: "청구 대기 " + open.length }, { v: "list", label: "청구서 " + data.invoices.length }]} value={tab} onChange={setTab} />} />
      <div className="a-card">
        {tab === "wait"
          ? <Table cols={waitCols} rows={open} empty={<Empty icon={Receipt} title="청구 대기 건이 없습니다" sub="출고 완료된 주문이 여기에 표시됩니다" />} />
          : <Table cols={listCols} rows={data.invoices} empty={<Empty icon={Receipt} title="발행된 청구서가 없습니다" />} />}
      </div>
    </div>
  );
}

/* ============================================================
   PP 생산관리 — 생산오더(CO01)
   완료 시 부품 재고 차감 → 제품 입고 + 원가 대체 전표
   ============================================================ */

function ProductionForm({ data, onSave, onClose }) {
  const boms = data.boms || [];
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [date, setDate] = useState(today());
  const [comps, setComps] = useState([{ key: uid(), materialId: "", qty: 1 }]);
  const products = data.materials.filter((m) => m.type === "제품");
  const parts = data.materials.filter((m) => m.type === "원자재" || m.type === "상품");
  const bom = boms.find((b) => b.productId === productId);

  const fillFromBOM = (pid, q) => {
    const b = boms.find((x) => x.productId === pid);
    if (b && b.components.length) {
      setComps(b.components.map((c) => ({ key: uid(), materialId: c.materialId, qty: c.qty * (Number(q) || 1) })));
    }
  };
  const pickProduct = (pid) => { setProductId(pid); fillFromBOM(pid, qty); };
  const changeQty = (q) => { setQty(q); fillFromBOM(productId, q); };

  const setComp = (key, k, v) => setComps((cs) => cs.map((c) => (c.key === key ? { ...c, [k]: v } : c)));
  const valid = comps.filter((c) => c.materialId && Number(c.qty) > 0);
  const cost = valid.reduce((s, c) => s + Number(c.qty) * ((matById(data, c.materialId) || {}).cost || 0), 0);
  const ok = productId && Number(qty) > 0 && valid.length > 0;
  return (
    <Modal title="생산오더 생성" onClose={onClose} width={600}>
      <div className="a-grid2">
        <Field label="생산할 제품 *">
          <select className="a-select" value={productId} onChange={(e) => pickProduct(e.target.value)}>
            <option value="">선택 (자재유형 '제품')</option>
            {products.map((m) => <option key={m.id} value={m.id}>{m.code} · {m.name}</option>)}
          </select>
          {productId ? (bom
            ? <div className="a-hint" style={{ marginTop: 5 }}>BOM 적용됨 — 수량 변경 시 소요량 자동 재계산</div>
            : <div className="a-hint" style={{ marginTop: 5 }}>등록된 BOM 없음 — PP › BOM 관리에서 등록하면 자동으로 채워집니다</div>) : null}
        </Field>
        <Field label="생산 수량 *"><input type="number" className="a-input num" min="1" value={qty} onChange={(e) => changeQty(e.target.value)} /></Field>
      </div>
      <Field label="오더 일자"><input type="date" className="a-input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <div className="a-label" style={{ marginBottom: 6 }}>투입 자재 (총 소요량)</div>
      <div className="a-tablewrap">
        <table className="a-table">
          <thead><tr><th style={{ minWidth: 200 }}>자재</th><th className="num" style={{ width: 100 }}>투입 수량</th><th className="num">투입 원가</th><th></th></tr></thead>
          <tbody>
            {comps.map((c) => {
              const m = matById(data, c.materialId);
              return (
                <tr key={c.key}>
                  <td>
                    <select className="a-select" value={c.materialId} onChange={(e) => setComp(c.key, "materialId", e.target.value)}>
                      <option value="">자재 선택</option>
                      {parts.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name} (재고 {fmtN(p.stock)})</option>)}
                    </select>
                  </td>
                  <td><input type="number" className="a-input num" min="1" value={c.qty} onChange={(e) => setComp(c.key, "qty", e.target.value)} /></td>
                  <td className="num">{fmt(Number(c.qty) * ((m || {}).cost || 0))}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="a-icon-btn red" onClick={() => setComps((cs) => cs.filter((x) => x.key !== c.key))}><Trash2 size={15} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
        <button className="a-btn a-btn-sec a-btn-sm" onClick={() => setComps((cs) => [...cs, { key: uid(), materialId: "", qty: 1 }])}><Plus size={14} /> 자재 추가</button>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 14 }}>예상 투입원가 <b>{fmt(cost)}</b></div>
        <button className="a-btn a-btn-pri" disabled={!ok}
          onClick={() => onSave({ productId, qty: Number(qty), date, components: valid.map((c) => ({ materialId: c.materialId, qty: Number(c.qty) })), cost })}>
          <Check size={15} /> 저장
        </button>
      </div>
    </Modal>
  );
}

function ProductionPage({ data, api, T }) {
  const [modal, setModal] = useState(false);
  const [sel, setSel] = useState(null);
  const cols = [
    { key: "docNo", label: "오더번호" },
    { key: "date", label: "일자" },
    { key: "prod", label: "제품", render: (r) => ((matById(data, r.productId) || {}).name) || "—" },
    { key: "qty", label: "수량", align: "right", render: (r) => fmtN(r.qty) },
    { key: "cost", label: "투입원가", align: "right", render: (r) => fmt(r.cost) },
    { key: "status", label: "상태", render: (r) => <StatusBadge s={r.status} /> },
    { key: "_a", label: "", align: "right", render: (r) => r.status === "생성"
      ? <button className="a-btn a-btn-pri a-btn-sm" onClick={(e) => { e.stopPropagation(); api.completeProd(r.id); }}><Factory size={14} /> 생산 완료</button>
      : null },
  ];
  return (
    <div className="a-page">
      <PageHead title="생산오더" sub="완료 시 투입 자재 차감 → 제품 재고 증가 + 원가 대체 전표 · T-code CO01"
        action={<button className="a-btn a-btn-pri" onClick={() => setModal(true)}><Plus size={15} /> 오더 생성</button>} />
      <div className="a-card">
        <Table cols={cols} rows={data.productionOrders} onRow={setSel}
          empty={<Empty icon={Factory} title="생산오더가 없습니다" sub="제품 자재를 먼저 등록하고 오더를 생성하세요" />} />
      </div>
      {modal && <ProductionForm data={data} onClose={() => setModal(false)}
        onSave={(v) => { api.createProd(v); T("생산오더가 생성되었습니다"); setModal(false); }} />}
      {sel && (
        <Modal title={"생산오더 " + sel.docNo} onClose={() => setSel(null)} width={520}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
            <StatusBadge s={sel.status} />
            <span className="a-hint">{sel.date} · {((matById(data, sel.productId) || {}).name) || "—"} × {fmtN(sel.qty)}</span>
          </div>
          <div className="a-tablewrap">
            <table className="a-table">
              <thead><tr><th>투입 자재</th><th className="num">수량</th></tr></thead>
              <tbody>
                {sel.components.map((c, i) => {
                  const m = matById(data, c.materialId);
                  return <tr key={i}><td>{m ? m.code + " · " + m.name : "(삭제된 자재)"}</td><td className="num">{fmtN(c.qty)}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ============================================================
   CO 관리회계 — 코스트센터별 비용 리포트
   ============================================================ */

function CostCenterPage({ data, T }) {
  const rows = useMemo(() => {
    const map = {};
    data.journals.forEach((j) => j.lines.forEach((l) => {
      const a = acctById(data, l.accountId);
      if (!a || a.type !== "비용") return;
      const key = l.costCenterId || "_none";
      map[key] = (map[key] || 0) + ((Number(l.dr) || 0) - (Number(l.cr) || 0));
    }));
    const list = Object.entries(map).map(([k, v]) => ({
      id: k,
      name: k === "_none" ? "미배부" : ((ccById(data, k) || {}).code || "") + " " + ((ccById(data, k) || {}).name || "(삭제됨)"),
      amt: v,
    })).filter((r) => r.amt !== 0);
    list.sort((a, b) => b.amt - a.amt);
    return list;
  }, [data]);
  const max = Math.max(1, ...rows.map((r) => r.amt));
  const total = rows.reduce((s, r) => s + r.amt, 0);
  const exportCC = () => [
    ["코스트센터", "비용금액", "비율(%)"],
    rows.map((r) => [r.name, r.amt, total ? Math.round((r.amt / total) * 100) : 0]),
  ];
  return (
    <div className="a-page">
      <PageHead title="코스트센터 리포트" sub="비용 계정 전표를 코스트센터별로 집계 (누적) · T-code S_ALR_87013611"
        action={<ExportBtn filename="코스트센터" T={T} disabled={rows.length === 0} build={exportCC} />} />
      <div className="a-card" style={{ padding: 20 }}>
        {rows.length === 0 ? <Empty icon={PieChart} title="집계할 비용이 없습니다" sub="전표 입력 시 비용 라인에 코스트센터를 지정하세요" /> : (
          <div style={{ display: "grid", gap: 14 }}>
            {rows.map((r) => (
              <div key={r.id}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 5 }}>
                  <span style={{ fontWeight: 600 }}>{r.name}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(r.amt)} <span className="a-hint">({Math.round((r.amt / total) * 100)}%)</span></span>
                </div>
                <div className="a-cobar"><div style={{ width: Math.max(3, (r.amt / max) * 100) + "%" }} /></div>
              </div>
            ))}
            <div style={{ borderTop: "1px solid rgba(0,0,0,.07)", paddingTop: 12, display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
              <span>비용 합계</span><span>{fmt(total)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   설정 — 회사 정보 · 모듈 구성 · 데이터 관리 (SPRO 단순화)
   ============================================================ */

function SettingsPage({ data, api, T, isAdmin, me, myRole }) {
  const [c, setC] = useState({ ...data.company });
  const [resetArm, setResetArm] = useState(false);
  const fileRef = useRef(null);
  const members = data.members || [];
  const adminCount = members.filter((m) => m.role === "관리자").length;

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "flexerp-backup-" + today() + ".json"; a.click();
    URL.revokeObjectURL(url);
    T("백업 파일을 내려받았습니다");
  };
  const importJson = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const obj = JSON.parse(rd.result);
        if (!obj || !obj.company || !Array.isArray(obj.accounts)) throw new Error("bad");
        api.importData(obj);
        T("백업을 복원했습니다");
      } catch { T("가져오기 실패 — 올바른 백업 파일이 아닙니다"); }
    };
    rd.readAsText(f);
    e.target.value = "";
  };

  return (
    <div className="a-page">
      <PageHead title="설정" sub={"회사 · 모듈 · 권한 · 데이터 구성 · T-code SPRO"}
        action={mode === "supabase" ? <Badge color={isAdmin ? "blue" : "gray"}>{isAdmin ? "관리자" : "일반 사용자"}</Badge> : null} />

      {!isAdmin && (
        <div className="a-card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 9 }}>
          <Lock size={15} color="#86868b" />
          <span className="a-hint">일반 사용자 권한입니다. 회사 정보 · 모듈 · 권한 · 데이터 초기화는 관리자만 변경할 수 있습니다.</span>
        </div>
      )}

      <div className="a-card" style={{ padding: 20 }}>
        <div className="a-card-t" style={{ marginBottom: 14 }}>회사 정보</div>
        <div className="a-grid2">
          <Field label="회사명"><input className="a-input" value={c.name} disabled={!isAdmin} onChange={(e) => setC({ ...c, name: e.target.value })} /></Field>
          <Field label="회사코드"><input className="a-input" value={c.code} disabled={!isAdmin} onChange={(e) => setC({ ...c, code: e.target.value })} /></Field>
          <Field label="대표자"><input className="a-input" value={c.ceo} disabled={!isAdmin} onChange={(e) => setC({ ...c, ceo: e.target.value })} /></Field>
          <Field label="사업자등록번호"><input className="a-input" value={c.bizNo} disabled={!isAdmin} onChange={(e) => setC({ ...c, bizNo: e.target.value })} /></Field>
        </div>
        {isAdmin && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="a-btn a-btn-pri a-btn-sm" onClick={() => { api.updateCompany(c); T("회사 정보를 저장했습니다"); }}><Check size={14} /> 저장</button>
          </div>
        )}
      </div>

      {mode === "supabase" && (
        <div className="a-card" style={{ padding: 20 }}>
          <div className="a-card-t" style={{ display: "flex", alignItems: "center", gap: 7 }}><Shield size={16} /> 사용자 권한</div>
          <div className="a-card-s" style={{ marginBottom: 12 }}>
            {isAdmin
              ? "가입한 직원이 자동으로 목록에 추가됩니다. 관리자만 역할을 변경할 수 있습니다."
              : "현재 회사에 등록된 사용자 목록입니다. 역할 변경은 관리자 권한이 필요합니다."}
          </div>
          {members.length === 0 ? (
            <div className="a-hint">아직 등록된 사용자가 없습니다.</div>
          ) : (
            <div style={{ display: "grid", gap: 2 }}>
              {members.slice().sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0)).map((m) => {
                const isSelf = me && m.userId === me.id;
                const lastAdmin = m.role === "관리자" && adminCount <= 1;
                return (
                  <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 2px", borderBottom: "1px solid rgba(0,0,0,.04)" }}>
                    <div className="av" style={{ width: 30, height: 30, borderRadius: "50%", background: "#e8e8ed", color: "#515154", fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{(m.email || "?").slice(0, 1).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email}{isSelf && <span className="a-hint" style={{ fontWeight: 400 }}> (나)</span>}</div>
                    </div>
                    {isAdmin ? (
                      <>
                        <Seg options={[{ v: "관리자", label: "관리자" }, { v: "일반", label: "일반" }]} value={m.role}
                          onChange={(v) => {
                            if (v === m.role) return;
                            if (lastAdmin && v === "일반") { T("최소 1명의 관리자가 필요합니다"); return; }
                            api.setMemberRole(m.userId, v); T(m.email + " → " + v);
                          }} />
                        {!isSelf && (
                          <button className="a-icon-btn red" title="제거" onClick={() => { api.removeMember(m.userId); T("사용자를 제거했습니다"); }}><Trash2 size={15} /></button>
                        )}
                      </>
                    ) : (
                      <Badge color={m.role === "관리자" ? "blue" : "gray"}>{m.role}</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="a-card" style={{ padding: 20 }}>
        <div className="a-card-t">모듈 구성</div>
        <div className="a-card-s" style={{ marginBottom: 12 }}>업체 상황에 맞게 켜고 끕니다 — 메뉴와 대시보드에 즉시 반영됩니다.{!isAdmin && " (관리자 전용)"}</div>
        <div style={{ display: "grid", gap: 4 }}>
          {Object.keys(MODULE_INFO).map((k) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 2px", borderBottom: "1px solid rgba(0,0,0,.04)", opacity: isAdmin ? 1 : 0.7 }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{k} · {MODULE_INFO[k].name}</span>
                <div className="a-hint">{MODULE_INFO[k].en} — {MODULE_INFO[k].desc}</div>
              </div>
              <Switch on={!!data.modules[k]} onChange={() => { if (isAdmin) api.toggleModule(k); else T("모듈 구성은 관리자만 변경할 수 있습니다"); }} />
            </div>
          ))}
        </div>
      </div>

      <div className="a-card" style={{ padding: 20 }}>
        <div className="a-card-t" style={{ marginBottom: 12 }}>데이터 관리</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="a-btn a-btn-sec" onClick={exportJson}><Download size={15} /> JSON 백업</button>
          {isAdmin && <>
            <button className="a-btn a-btn-sec" onClick={() => fileRef.current && fileRef.current.click()}><Upload size={15} /> 백업 가져오기</button>
            <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }} onChange={importJson} />
            <div style={{ flex: 1 }} />
            {resetArm ? (
              <>
                <button className="a-btn a-btn-sec" onClick={() => setResetArm(false)}>취소</button>
                <button className="a-btn a-btn-danger" onClick={() => api.resetAll()}><RotateCcw size={15} /> 정말 초기화</button>
              </>
            ) : (
              <button className="a-btn a-btn-danger" onClick={() => setResetArm(true)}><RotateCcw size={15} /> 전체 초기화</button>
            )}
          </>}
        </div>
        <div className="a-hint" style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
          {mode === "supabase"
            ? <><Cloud size={13} /> Supabase 클라우드에 자동 저장됩니다 — 여러 사용자가 실시간으로 같은 데이터를 공유합니다.</>
            : <>데이터는 이 브라우저(localStorage)에 자동 저장됩니다. .env 에 Supabase 정보를 넣으면 멀티유저 · 실시간 모드로 전환됩니다.</>}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   대시보드
   ============================================================ */

function monthKey(dateStr) { return (dateStr || "").slice(0, 7); }

function Dashboard({ data, go }) {
  const nowKey = monthKey(today());
  const sales = data.invoices.filter((i) => monthKey(i.date) === nowKey).reduce((s, i) => s + i.amount, 0);
  const purch = data.goodsReceipts.filter((g) => monthKey(g.date) === nowKey).reduce((s, g) => s + g.amount, 0);
  const invVal = data.materials.filter((m) => m.type !== "서비스").reduce((s, m) => s + (Number(m.stock) || 0) * (Number(m.cost) || 0), 0);
  const cash = balanceOfCode(data, "10100", "dr") + balanceOfCode(data, "10300", "dr");

  /* 전월 대비 비교 — 매출 · 매입 · 영업손익 (해당 월 전표 기준) */
  const lastKey = (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })();
  const salesOf = (k) => data.invoices.filter((i) => monthKey(i.date) === k).reduce((s, i) => s + i.amount, 0);
  const purchOf = (k) => data.goodsReceipts.filter((g) => monthKey(g.date) === k).reduce((s, g) => s + g.amount, 0);
  const profitOf = (k) => {
    let rev = 0, exp = 0;
    data.journals.filter((j) => monthKey(j.date) === k).forEach((j) => j.lines.forEach((l) => {
      const a = acctById(data, l.accountId);
      if (!a) return;
      if (a.type === "수익") rev += (Number(l.cr) || 0) - (Number(l.dr) || 0);
      else if (a.type === "비용") exp += (Number(l.dr) || 0) - (Number(l.cr) || 0);
    }));
    return rev - exp;
  };
  const compare = [
    { label: "매출", now: salesOf(nowKey), prev: salesOf(lastKey), good: "up" },
    { label: "매입", now: purchOf(nowKey), prev: purchOf(lastKey), good: "down" },
    { label: "영업손익", now: profitOf(nowKey), prev: profitOf(lastKey), good: "up" },
  ];

  const months = [];
  { const d = new Date(); for (let i = 5; i >= 0; i--) { const t = new Date(d.getFullYear(), d.getMonth() - i, 1); months.push({ key: t.toISOString().slice(0, 7), label: (t.getMonth() + 1) + "월" }); } }
  const chart = months.map((m) => ({
    ...m,
    s: data.invoices.filter((i) => monthKey(i.date) === m.key).reduce((s, i) => s + i.amount, 0),
    p: data.goodsReceipts.filter((g) => monthKey(g.date) === m.key).reduce((s, g) => s + g.amount, 0),
  }));
  const cmax = Math.max(1, ...chart.map((c) => Math.max(c.s, c.p)));

  const recent = [
    ...data.journals.map((j) => ({ id: j.id, no: j.docNo, t: "전표", c: "gray", date: j.date, amt: j.lines.reduce((s, l) => s + (Number(l.dr) || 0), 0), at: j.createdAt })),
    ...data.purchaseOrders.map((p) => ({ id: p.id, no: p.docNo, t: "발주", c: "orange", date: p.date, amt: p.lines.reduce((s, l) => s + l.qty * l.price, 0), at: p.createdAt })),
    ...data.goodsReceipts.map((g) => ({ id: g.id, no: g.docNo, t: "입고", c: "blue", date: g.date, amt: g.amount, at: g.createdAt })),
    ...data.salesOrders.map((s0) => ({ id: s0.id, no: s0.docNo, t: "수주", c: "blue", date: s0.date, amt: s0.lines.reduce((s, l) => s + l.qty * l.price, 0), at: s0.createdAt })),
    ...data.deliveries.map((d0) => ({ id: d0.id, no: d0.docNo, t: "출고", c: "orange", date: d0.date, amt: d0.amount, at: d0.createdAt })),
    ...data.invoices.map((v) => ({ id: v.id, no: v.docNo, t: "청구", c: "green", date: v.date, amt: v.amount, at: v.createdAt })),
    ...data.productionOrders.map((p) => ({ id: p.id, no: p.docNo, t: "생산", c: "purple", date: p.date, amt: p.cost, at: p.createdAt })),
  ].sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 8);

  const todo = [
    { label: "입고 대기", n: data.purchaseOrders.filter((p) => p.status === "개설").length, v: "mm-gr", m: "MM" },
    { label: "출고 대기", n: data.salesOrders.filter((s) => s.status === "개설").length, v: "sd-dl", m: "SD" },
    { label: "청구 대기", n: data.salesOrders.filter((s) => s.status === "출고완료").length, v: "sd-iv", m: "SD" },
    { label: "미수금", n: data.invoices.filter((i) => !i.paid).length, v: "sd-iv", m: "SD" },
    { label: "미지급", n: data.goodsReceipts.filter((g) => !g.paid).length, v: "mm-gr", m: "MM" },
    { label: "생산 진행", n: data.productionOrders.filter((p) => p.status === "생성").length, v: "pp-ord", m: "PP" },
  ].filter((t) => (!t.m || data.modules[t.m]) && t.n > 0);

  const quick = [
    { v: "fi-je", label: "전표 입력", icon: PenLine, m: "FI" },
    { v: "mm-po", label: "구매발주", icon: ShoppingCart, m: "MM" },
    { v: "sd-so", label: "판매주문", icon: ClipboardList, m: "SD" },
    { v: "pp-ord", label: "생산오더", icon: Factory, m: "PP" },
    { v: "md-partner", label: "거래처 등록", icon: Building2 },
    { v: "md-mat", label: "자재 등록", icon: Package },
  ].filter((q) => !q.m || data.modules[q.m]);

  return (
    <div className="a-page">
      <PageHead title={data.company.name} sub={"회사코드 " + data.company.code + " · " + today() + " · 활성 모듈 " + Object.keys(data.modules).filter((k) => data.modules[k]).join(" · ")} />
      <div className="a-stats">
        <div className="a-stat"><div className="lb"><TrendingUp size={14} /> 이번 달 매출 (청구 기준)</div><div className="vl">{fmt(sales)}</div><div className="sb">SD 청구서 합계</div></div>
        <div className="a-stat"><div className="lb"><ShoppingCart size={14} /> 이번 달 매입 (입고 기준)</div><div className="vl">{fmt(purch)}</div><div className="sb">MM 입고 합계</div></div>
        <div className="a-stat"><div className="lb"><Boxes size={14} /> 재고자산</div><div className="vl">{fmt(invVal)}</div><div className="sb">표준원가 × 현재고</div></div>
        <div className="a-stat"><div className="lb"><Wallet size={14} /> 현금 · 예금</div><div className="vl">{fmt(cash)}</div><div className="sb">FI 총계정원장 잔액</div></div>
      </div>

      <div className="a-card" style={{ padding: 20 }}>
        <div className="a-card-t" style={{ marginBottom: 4 }}>전월 대비</div>
        <div className="a-card-s" style={{ marginBottom: 14 }}>{lastKey} → {nowKey} · 매출·매입은 문서, 영업손익은 전표 기준</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          {compare.map((c) => {
            const diff = c.now - c.prev;
            const pct = c.prev !== 0 ? Math.round((diff / Math.abs(c.prev)) * 100) : (c.now !== 0 ? 100 : 0);
            const positive = c.good === "up" ? diff > 0 : diff < 0;
            const flat = diff === 0;
            const color = flat ? "#86868b" : positive ? "#248a3d" : "#d70015";
            const Ico = flat ? Minus : diff > 0 ? TrendingUp : TrendingDown;
            return (
              <div key={c.label} style={{ border: "1px solid rgba(0,0,0,.06)", borderRadius: 14, padding: "14px 16px" }}>
                <div style={{ fontSize: 12.5, color: "#86868b", fontWeight: 500 }}>{c.label}</div>
                <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-.02em", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>{fmt(c.now)}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5, fontSize: 12.5, color, fontWeight: 600 }}>
                  <Ico size={13} /> {diff >= 0 ? "+" : "−"}{fmt(Math.abs(diff))} <span style={{ opacity: .8 }}>({diff >= 0 ? "+" : "−"}{Math.abs(pct)}%)</span>
                </div>
                <div className="a-hint" style={{ marginTop: 3 }}>전월 {fmt(c.prev)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {todo.length > 0 && (
        <div className="a-card" style={{ padding: 20 }}>
          <div className="a-card-t" style={{ marginBottom: 10 }}>처리할 작업</div>
          <div className="a-todos">
            {todo.map((t) => (
              <button key={t.label} className="a-todo" onClick={() => go(t.v)}>{t.label} <span className="n">{t.n}</span></button>
            ))}
          </div>
        </div>
      )}

      <div className="a-card" style={{ padding: 20 }}>
        <div className="a-card-t" style={{ marginBottom: 10 }}>빠른 작업</div>
        <div className="a-quick">
          {quick.map((q) => { const I = q.icon; return <button key={q.v} onClick={() => go(q.v)}><I size={16} /> {q.label}</button>; })}
        </div>
      </div>

      <div className="a-card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div className="a-card-t">최근 6개월 매출 · 매입</div>
          <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#6e6e73" }}>
            <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: "#0071e3", marginRight: 5 }} />매출</span>
            <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: "rgba(0,0,0,.2)", marginRight: 5 }} />매입</span>
          </div>
        </div>
        <div className="a-bars">
          {chart.map((c) => (
            <div key={c.key} className="a-barcol">
              <div className="a-barpair">
                <div className="a-bar" style={{ height: Math.max(3, (c.s / cmax) * 100) + "%", background: "#0071e3" }} title={fmt(c.s)} />
                <div className="a-bar" style={{ height: Math.max(3, (c.p / cmax) * 100) + "%", background: "rgba(0,0,0,.18)" }} title={fmt(c.p)} />
              </div>
              <div className="a-barlb">{c.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="a-card">
        <div className="a-card-h" style={{ paddingBottom: 6 }}><div className="a-card-t">최근 문서</div><div className="a-card-s">문서 원칙 — 모든 거래는 번호가 부여된 문서로 남습니다</div></div>
        {recent.length === 0 ? <Empty icon={FileText} title="아직 문서가 없습니다" sub="빠른 작업에서 첫 거래를 만들어보세요" /> : (
          <div className="a-tablewrap">
            <table className="a-table">
              <thead><tr><th>유형</th><th>문서번호</th><th>일자</th><th className="num">금액</th></tr></thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.t + r.id}>
                    <td><Badge color={r.c}>{r.t}</Badge></td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{r.no}</td>
                    <td>{r.date}</td>
                    <td className="num">{fmt(r.amt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   앱 셸 — 사이드바 · 탑바 · 라우팅 · 저장 · API
   ============================================================ */

function Sidebar({ data, view, go, open, me, myRole }) {
  return (
    <aside className={"a-side" + (open ? " open" : "")}>
      <div className="a-side-logo">
        <div className="dot">F</div>
        <div>
          <div className="nm">FlexERP</div>
          <div className="sub">SAP 구조 · Apple 디자인</div>
        </div>
      </div>
      {MENU.filter((sec) => !sec.module || data.modules[sec.module]).map((sec) => (
        <div key={sec.section}>
          <div className="a-sec">{sec.section}</div>
          {sec.items.map((it) => {
            const I = it.icon;
            return (
              <button key={it.id} className={"a-nav" + (view === it.id ? " on" : "")} onClick={() => go(it.id)}>
                <I size={16} /> {it.label}
              </button>
            );
          })}
        </div>
      ))}
      <div className="a-side-foot">
        <div className="av">{((me && me.email) || data.company.name || "F").slice(0, 1).toUpperCase()}</div>
        <div style={{ minWidth: 0 }}>
          <div className="cn" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{me ? me.email : data.company.name}</div>
          <div className="cc">{me ? (data.company.name + " · " + (myRole || "일반")) : ("코드 " + data.company.code + " · v1.0 프로토타입")}</div>
        </div>
      </div>
    </aside>
  );
}

/* ============================================================
   로그인 · 회원가입 (Supabase Auth · 이메일)
   ============================================================ */

function AuthGate({ onToast }) {
  const [tab, setTab] = useState("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setInfo(""); setBusy(true);
    try {
      if (tab === "signin") {
        await auth.signIn(email.trim(), pw);
        onToast("로그인되었습니다");
      } else {
        const { needsConfirm } = await auth.signUp(email.trim(), pw);
        if (needsConfirm) setInfo("확인 메일을 보냈습니다. 메일의 링크를 눌러 인증한 뒤 로그인하세요.");
        else onToast("가입되어 로그인되었습니다");
      }
    } catch (e2) {
      setErr(e2.message || "요청을 처리하지 못했습니다");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="a-wiz">
      <div className="a-wiz-card" style={{ maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div className="dot" style={{ width: 46, height: 46, borderRadius: 13, background: "linear-gradient(135deg,#0a84ff,#0055cc)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 20, boxShadow: "0 4px 14px rgba(0,90,220,.35)" }}>F</div>
          <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-.02em", marginTop: 12 }}>FlexERP</div>
          <div style={{ fontSize: 13, color: "#86868b", marginTop: 3, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Cloud size={13} /> 클라우드 · 여러 사용자 공유
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <Seg options={[{ v: "signin", label: "로그인" }, { v: "signup", label: "회원가입" }]} value={tab} onChange={(v) => { setTab(v); setErr(""); setInfo(""); }} />
        </div>
        <form onSubmit={submit}>
          <Field label="이메일"><input className="a-input" type="email" value={email} autoFocus autoComplete="email" onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" /></Field>
          <Field label="비밀번호"><input className="a-input" type="password" value={pw} autoComplete={tab === "signin" ? "current-password" : "new-password"} onChange={(e) => setPw(e.target.value)} placeholder="6자 이상" /></Field>
          {err && <div style={{ color: "#d70015", fontSize: 12.5, marginBottom: 10 }}>{err}</div>}
          {info && <div style={{ color: "#248a3d", fontSize: 12.5, marginBottom: 10 }}>{info}</div>}
          <button className="a-btn a-btn-pri" type="submit" disabled={busy || !email.trim() || pw.length < 6} style={{ width: "100%" }}>
            <Lock size={14} /> {busy ? "처리 중…" : tab === "signin" ? "로그인" : "가입하고 시작"}
          </button>
        </form>
        <div className="a-hint" style={{ textAlign: "center", marginTop: 14 }}>
          같은 회사 데이터를 여러 직원이 공유합니다. 변경 사항은 실시간으로 반영됩니다.
        </div>
      </div>
    </div>
  );
}

/* Supabase 테이블이 아직 생성되지 않았을 때 안내 */
function SupabaseSetupNotice({ onSignOut }) {
  return (
    <div className="a-wiz">
      <div className="a-wiz-card" style={{ maxWidth: 520 }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>한 가지만 더 설정하면 됩니다</div>
        <div className="a-hint" style={{ marginBottom: 14, lineHeight: 1.6 }}>
          Supabase 프로젝트에 <b>erp_state</b> 테이블이 아직 없습니다. 저장소의
          <code style={{ background: "rgba(0,0,0,.06)", padding: "1px 6px", borderRadius: 6, margin: "0 4px" }}>supabase/schema.sql</code>
          내용을 복사해 Supabase 대시보드의 <b>SQL Editor</b>에 붙여넣고 한 번 실행한 뒤, 이 페이지를 새로고침하세요.
        </div>
        <ol style={{ fontSize: 13, color: "#515154", lineHeight: 1.9, paddingLeft: 18, marginBottom: 16 }}>
          <li>Supabase 대시보드 → SQL Editor 열기</li>
          <li><code>supabase/schema.sql</code> 전체 붙여넣기 → Run</li>
          <li>이 페이지 새로고침 → 설정 마법사가 나타납니다</li>
        </ol>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="a-btn a-btn-sec" onClick={onSignOut}>로그아웃</button>
          <button className="a-btn a-btn-pri" onClick={() => window.location.reload()}><RotateCcw size={14} /> 새로고침</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(undefined); // undefined=로딩, null=마법사
  const [session, setSession] = useState(mode === "local" ? { local: true } : undefined); // undefined=확인중, null=로그인필요
  const [setupError, setSetupError] = useState(null); // 테이블 미생성 등
  const [me, setMe] = useState(null); // 현재 로그인 사용자 { id, email } (Supabase)
  const [view, setView] = useState("dashboard");
  const [palette, setPalette] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const saveT = useRef(null);
  const lastJson = useRef(null); // Realtime 에코(내 저장이 되돌아오는 것) 무시용

  const T = (msg) => {
    const id = uid();
    setToasts((ts) => [...ts, { id, msg }]);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 2600);
  };

  /* 세션 확인 · 구독 (Supabase 모드) */
  useEffect(() => {
    if (mode === "local") return;
    let off = () => {};
    (async () => {
      setSession(await auth.getSession());
      off = auth.onChange((s) => setSession(s));
    })();
    return () => off();
  }, []);

  /* 로그인된 뒤 상태 로드 */
  useEffect(() => {
    if (session === undefined || session === null) return;
    let cancelled = false;
    (async () => {
      try {
        const s = await store.getState();
        if (cancelled) return;
        lastJson.current = s ? JSON.stringify(s) : null;
        setData(s);
        setSetupError(null);
      } catch (e) {
        if (cancelled) return;
        if (e && e.code === TABLE_MISSING) setSetupError("table");
        else setSetupError("load");
        setData(null);
      }
    })();
    return () => { cancelled = true; };
  }, [session]);

  /* 현재 로그인 사용자 정보 로드 */
  useEffect(() => {
    if (mode === "local" || !session) { setMe(null); return; }
    auth.currentUser().then((u) => setMe(u));
  }, [session]);

  /* 로그인 사용자를 회사 멤버 명부에 자동 등록.
     첫 사용자(명부 비어있음)는 관리자, 이후 가입자는 일반 사용자로 등록된다. */
  useEffect(() => {
    if (mode === "local" || !me || !data) return;
    const members = data.members || [];
    if (members.some((m) => m.userId === me.id)) return;
    setData((d) => {
      const cur = d.members || [];
      if (cur.some((m) => m.userId === me.id)) return d;
      const role = cur.length === 0 ? "관리자" : "일반";
      return { ...d, members: [...cur, { userId: me.id, email: me.email, role, addedAt: Date.now() }] };
    });
  }, [me, data]);

  /* 다른 사용자의 저장을 Realtime 으로 수신 */
  useEffect(() => {
    if (mode === "local" || !session) return;
    const off = store.subscribe((remote) => {
      const j = remote ? JSON.stringify(remote) : null;
      if (j === lastJson.current) return; // 내가 방금 저장한 것 → 무시
      lastJson.current = j;
      setData(remote);
    });
    return () => off();
  }, [session]);

  /* 디바운스 저장 */
  useEffect(() => {
    if (!data) return;
    const json = JSON.stringify(data);
    if (json === lastJson.current) return; // 원격에서 받은 값이면 다시 저장하지 않음
    if (saveT.current) clearTimeout(saveT.current);
    saveT.current = setTimeout(async () => {
      try { lastJson.current = json; await store.setState(data); }
      catch (e) { T("저장 실패 — 네트워크 또는 권한을 확인하세요"); }
    }, 700);
    return () => { if (saveT.current) clearTimeout(saveT.current); };
  }, [data]);

  /* ⌘K */
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const go = (v) => { setView(v); setSideOpen(false); };

  /* ---------- 비즈니스 API (SAP 통합 전기 로직) ---------- */
  const api = {
    postJournal: ({ date, desc, lines }) => setData((d) => {
      const seq = { ...d.seq, JE: d.seq.JE + 1 };
      const je = { id: uid(), docNo: String(seq.JE), date, desc, lines, source: "수동", ref: null, createdAt: Date.now() };
      return { ...d, seq, journals: [je, ...d.journals] };
    }),

    createPO: ({ partnerId, date, lines }) => setData((d) => {
      const seq = { ...d.seq, PO: d.seq.PO + 1 };
      const po = { id: uid(), docNo: String(seq.PO), date, vendorId: partnerId, lines, status: "개설", createdAt: Date.now() };
      return { ...d, seq, purchaseOrders: [po, ...d.purchaseOrders] };
    }),

    postGR: (poId) => {
      setData((d) => {
        const po = d.purchaseOrders.find((p) => p.id === poId);
        if (!po || po.status !== "개설") return d;
        const seq = { ...d.seq, GR: d.seq.GR + 1, JE: d.seq.JE + 1 };
        const total = po.lines.reduce((s, l) => s + l.qty * l.price, 0);
        const materials = d.materials.map((m) => {
          const l = po.lines.find((x) => x.materialId === m.id);
          return l && m.type !== "서비스" ? { ...m, stock: (Number(m.stock) || 0) + l.qty } : m;
        });
        const jeLines = po.lines.map((l) => {
          const m = d.materials.find((x) => x.id === l.materialId);
          const code = m ? INV_ACCT[m.type] || "83100" : "83100";
          return { accountId: acctIdByCode(d, code), dr: l.qty * l.price, cr: 0, costCenterId: null, partnerId: null };
        });
        jeLines.push({ accountId: acctIdByCode(d, "25100"), dr: 0, cr: total, costCenterId: null, partnerId: po.vendorId });
        const gr = { id: uid(), docNo: String(seq.GR), date: today(), poId, vendorId: po.vendorId, amount: total, paid: false, createdAt: Date.now() };
        const je = { id: uid(), docNo: String(seq.JE), date: today(), desc: "입고 " + gr.docNo + " (발주 " + po.docNo + ")", lines: jeLines, source: "MM", ref: gr.docNo, createdAt: Date.now() };
        return {
          ...d, seq, materials,
          goodsReceipts: [gr, ...d.goodsReceipts],
          journals: [je, ...d.journals],
          purchaseOrders: d.purchaseOrders.map((p) => (p.id === poId ? { ...p, status: "입고완료" } : p)),
        };
      });
      T("입고 완료 — 재고 반영 · 회계전표 자동 생성");
    },

    payGR: (grId) => setData((d) => {
      const gr = d.goodsReceipts.find((g) => g.id === grId);
      if (!gr || gr.paid) return d;
      const seq = { ...d.seq, JE: d.seq.JE + 1 };
      const je = {
        id: uid(), docNo: String(seq.JE), date: today(), desc: "매입대금 지급 (입고 " + gr.docNo + ")",
        source: "FI", ref: gr.docNo, createdAt: Date.now(),
        lines: [
          { accountId: acctIdByCode(d, "25100"), dr: gr.amount, cr: 0, costCenterId: null, partnerId: gr.vendorId },
          { accountId: acctIdByCode(d, "10300"), dr: 0, cr: gr.amount, costCenterId: null, partnerId: null },
        ],
      };
      return { ...d, seq, journals: [je, ...d.journals], goodsReceipts: d.goodsReceipts.map((g) => (g.id === grId ? { ...g, paid: true } : g)) };
    }),

    createSO: ({ partnerId, date, lines }) => setData((d) => {
      const seq = { ...d.seq, SO: d.seq.SO + 1 };
      const so = { id: uid(), docNo: String(seq.SO), date, customerId: partnerId, lines, status: "개설", createdAt: Date.now() };
      return { ...d, seq, salesOrders: [so, ...d.salesOrders] };
    }),

    postDelivery: (soId) => {
      const so = data.salesOrders.find((s) => s.id === soId);
      if (!so || so.status !== "개설") return;
      for (const l of so.lines) {
        const m = matById(data, l.materialId);
        if (m && m.type !== "서비스" && (Number(m.stock) || 0) < l.qty) {
          T("재고 부족 — " + m.name + " (현재고 " + fmtN(m.stock) + " / 필요 " + fmtN(l.qty) + ")");
          return;
        }
      }
      setData((d) => {
        const s0 = d.salesOrders.find((s) => s.id === soId);
        if (!s0 || s0.status !== "개설") return d;
        let cogs = 0;
        const cogsLines = [];
        s0.lines.forEach((l) => {
          const m = d.materials.find((x) => x.id === l.materialId);
          if (!m || m.type === "서비스") return;
          const amt = l.qty * (Number(m.cost) || 0);
          cogs += amt;
          if (amt > 0) cogsLines.push({ accountId: acctIdByCode(d, INV_ACCT[m.type]), dr: 0, cr: amt, costCenterId: null, partnerId: null });
        });
        const seq = { ...d.seq, DL: d.seq.DL + 1 };
        let journals = d.journals;
        if (cogs > 0) {
          seq.JE = d.seq.JE + 1;
          const je = {
            id: uid(), docNo: String(seq.JE), date: today(), desc: "출고 매출원가 (수주 " + s0.docNo + ")",
            source: "SD", ref: String(seq.DL), createdAt: Date.now(),
            lines: [{ accountId: acctIdByCode(d, "45100"), dr: cogs, cr: 0, costCenterId: null, partnerId: null }, ...cogsLines],
          };
          journals = [je, ...d.journals];
        }
        const materials = d.materials.map((m) => {
          const l = s0.lines.find((x) => x.materialId === m.id);
          return l && m.type !== "서비스" ? { ...m, stock: (Number(m.stock) || 0) - l.qty } : m;
        });
        const amount = s0.lines.reduce((s, l) => s + l.qty * l.price, 0);
        const dl = { id: uid(), docNo: String(seq.DL), date: today(), soId, customerId: s0.customerId, amount, createdAt: Date.now() };
        return {
          ...d, seq, materials, journals,
          deliveries: [dl, ...d.deliveries],
          salesOrders: d.salesOrders.map((s) => (s.id === soId ? { ...s, status: "출고완료" } : s)),
        };
      });
      T("출고 완료 — 재고 차감 · 매출원가 전표 생성");
    },

    postInvoice: (soId) => {
      setData((d) => {
        const so = d.salesOrders.find((s) => s.id === soId);
        if (!so || so.status !== "출고완료") return d;
        const seq = { ...d.seq, IV: d.seq.IV + 1, JE: d.seq.JE + 1 };
        const amount = so.lines.reduce((s, l) => s + l.qty * l.price, 0);
        const revLines = so.lines.map((l) => {
          const m = d.materials.find((x) => x.id === l.materialId);
          const code = m ? REV_ACCT[m.type] || "40100" : "40100";
          return { accountId: acctIdByCode(d, code), dr: 0, cr: l.qty * l.price, costCenterId: null, partnerId: null };
        });
        const je = {
          id: uid(), docNo: String(seq.JE), date: today(), desc: "매출 청구 " + String(seq.IV) + " (수주 " + so.docNo + ")",
          source: "SD", ref: String(seq.IV), createdAt: Date.now(),
          lines: [{ accountId: acctIdByCode(d, "10800"), dr: amount, cr: 0, costCenterId: null, partnerId: so.customerId }, ...revLines],
        };
        const iv = { id: uid(), docNo: String(seq.IV), date: today(), soId, customerId: so.customerId, amount, paid: false, createdAt: Date.now() };
        return {
          ...d, seq, journals: [je, ...d.journals], invoices: [iv, ...d.invoices],
          salesOrders: d.salesOrders.map((s) => (s.id === soId ? { ...s, status: "청구완료" } : s)),
        };
      });
      T("청구서 발행 — 외상매출금 · 매출 전표 생성");
    },

    collectInvoice: (invId) => {
      setData((d) => {
        const iv = d.invoices.find((v) => v.id === invId);
        if (!iv || iv.paid) return d;
        const seq = { ...d.seq, JE: d.seq.JE + 1 };
        const je = {
          id: uid(), docNo: String(seq.JE), date: today(), desc: "매출대금 수금 (청구 " + iv.docNo + ")",
          source: "FI", ref: iv.docNo, createdAt: Date.now(),
          lines: [
            { accountId: acctIdByCode(d, "10300"), dr: iv.amount, cr: 0, costCenterId: null, partnerId: null },
            { accountId: acctIdByCode(d, "10800"), dr: 0, cr: iv.amount, costCenterId: null, partnerId: iv.customerId },
          ],
        };
        return { ...d, seq, journals: [je, ...d.journals], invoices: d.invoices.map((v) => (v.id === invId ? { ...v, paid: true } : v)) };
      });
      T("수금 완료 — 입금 전표 생성");
    },

    createProd: ({ productId, qty, date, components, cost }) => setData((d) => {
      const seq = { ...d.seq, PR: d.seq.PR + 1 };
      const pr = { id: uid(), docNo: String(seq.PR), date, productId, qty, components, cost, status: "생성", createdAt: Date.now() };
      return { ...d, seq, productionOrders: [pr, ...d.productionOrders] };
    }),

    completeProd: (id) => {
      const ord = data.productionOrders.find((p) => p.id === id);
      if (!ord || ord.status !== "생성") return;
      for (const c of ord.components) {
        const m = matById(data, c.materialId);
        if (!m || (Number(m.stock) || 0) < c.qty) {
          T("투입 자재 재고 부족 — " + (m ? m.name : "삭제된 자재"));
          return;
        }
      }
      setData((d) => {
        const o = d.productionOrders.find((p) => p.id === id);
        if (!o || o.status !== "생성") return d;
        let cost = 0;
        const crLines = [];
        o.components.forEach((c) => {
          const m = d.materials.find((x) => x.id === c.materialId);
          if (!m) return;
          const amt = c.qty * (Number(m.cost) || 0);
          cost += amt;
          if (amt > 0) crLines.push({ accountId: acctIdByCode(d, INV_ACCT[m.type] || "14900"), dr: 0, cr: amt, costCenterId: null, partnerId: null });
        });
        const materials = d.materials.map((m) => {
          const c = o.components.find((x) => x.materialId === m.id);
          if (c) return { ...m, stock: (Number(m.stock) || 0) - c.qty };
          if (m.id === o.productId) return { ...m, stock: (Number(m.stock) || 0) + o.qty };
          return m;
        });
        const seq = { ...d.seq };
        let journals = d.journals;
        if (cost > 0) {
          seq.JE = d.seq.JE + 1;
          const je = {
            id: uid(), docNo: String(seq.JE), date: today(), desc: "생산 완료 " + o.docNo + " — 원가 대체",
            source: "PP", ref: o.docNo, createdAt: Date.now(),
            lines: [{ accountId: acctIdByCode(d, "15000"), dr: cost, cr: 0, costCenterId: null, partnerId: null }, ...crLines],
          };
          journals = [je, ...d.journals];
        }
        return {
          ...d, seq, materials, journals,
          productionOrders: d.productionOrders.map((p) => (p.id === id ? { ...p, status: "완료", cost } : p)),
        };
      });
      T("생산 완료 — 제품 입고 · 원가 대체 전표 생성");
    },

    reverseJournal: (jeId) => {
      const je0 = data.journals.find((j) => j.id === jeId);
      if (!je0 || je0.reversed || je0.source === "역분개") return;
      setData((d) => {
        const j0 = d.journals.find((j) => j.id === jeId);
        if (!j0 || j0.reversed) return d;
        const seq = { ...d.seq, JE: d.seq.JE + 1 };
        const rev = {
          id: uid(), docNo: String(seq.JE), date: today(), desc: "역분개 — " + j0.desc + " (" + j0.docNo + ")",
          source: "역분개", ref: j0.docNo, createdAt: Date.now(),
          lines: j0.lines.map((l) => ({ accountId: l.accountId, dr: Number(l.cr) || 0, cr: Number(l.dr) || 0, costCenterId: l.costCenterId || null, partnerId: l.partnerId || null })),
        };
        return { ...d, seq, journals: [rev, ...d.journals.map((j) => (j.id === jeId ? { ...j, reversed: true, reversedBy: rev.docNo } : j))] };
      });
      T("역분개 전표가 생성되었습니다 (FB08)");
    },

    saveBOM: (productId, components) => setData((d) => {
      const boms = d.boms || [];
      const ex = boms.find((b) => b.productId === productId);
      const next = ex ? boms.map((b) => (b.productId === productId ? { ...b, components } : b)) : [...boms, { id: uid(), productId, components }];
      return { ...d, boms: next };
    }),
    deleteBOM: (productId) => setData((d) => ({ ...d, boms: (d.boms || []).filter((b) => b.productId !== productId) })),

    payPayroll: () => {
      const key = monthKey(today());
      if ((data.payrollMonths || []).includes(key)) { T("이번 달 급여는 이미 전기되었습니다"); return; }
      const total = data.employees.reduce((s, e) => s + (Number(e.salary) || 0), 0);
      if (total <= 0) { T("급여가 등록된 사원이 없습니다"); return; }
      setData((d) => {
        const pm = d.payrollMonths || [];
        if (pm.includes(key)) return d;
        const seq = { ...d.seq, JE: d.seq.JE + 1 };
        const byDept = {};
        d.employees.forEach((e) => { const dep = e.dept || "기타"; byDept[dep] = (byDept[dep] || 0) + (Number(e.salary) || 0); });
        const drLines = Object.entries(byDept).map(([dep, amt]) => {
          const cc = d.costCenters.find((c) => c.name === dep);
          return { accountId: acctIdByCode(d, "50100"), dr: amt, cr: 0, costCenterId: cc ? cc.id : null, partnerId: null };
        });
        const je = {
          id: uid(), docNo: String(seq.JE), date: today(), desc: key + " 급여 지급 (" + d.employees.length + "명)",
          source: "HR", ref: null, createdAt: Date.now(),
          lines: [...drLines, { accountId: acctIdByCode(d, "10300"), dr: 0, cr: total, costCenterId: null, partnerId: null }],
        };
        return { ...d, seq, journals: [je, ...d.journals], payrollMonths: [...pm, key] };
      });
      T("급여 전표가 전기되었습니다 — 부서별 코스트센터 자동 배부");
    },

    addMaster: (key, v) => setData((d) => ({ ...d, [key]: [...d[key], { id: uid(), ...v }] })),
    updateMaster: (key, id, v) => setData((d) => ({ ...d, [key]: d[key].map((r) => (r.id === id ? { ...r, ...v } : r)) })),
    deleteMaster: (key, id) => setData((d) => ({ ...d, [key]: d[key].filter((r) => r.id !== id) })),

    updateCompany: (c) => setData((d) => ({ ...d, company: { ...d.company, ...c } })),
    toggleModule: (k) => {
      setData((d) => ({ ...d, modules: { ...d.modules, [k]: !d.modules[k] } }));
      const sec = MENU.find((s) => s.module === k);
      if (sec && data.modules[k] && sec.items.some((it) => it.id === view)) setView("dashboard");
    },
    importData: (obj) => setData(obj),
    resetAll: async () => {
      try { await store.deleteState(); } catch (e) { /* 무시 */ }
      lastJson.current = null;
      setView("dashboard");
      setData(null);
    },

    setMemberRole: (userId, role) => setData((d) => ({
      ...d, members: (d.members || []).map((m) => (m.userId === userId ? { ...m, role } : m)),
    })),
    removeMember: (userId) => setData((d) => ({
      ...d, members: (d.members || []).filter((m) => m.userId !== userId),
    })),
  };

  /* 권한 — 로컬 모드는 단독 사용이므로 항상 관리자 */
  const myRole = mode === "local" ? "관리자" : ((data && data.members) || []).find((m) => me && m.userId === me.id)?.role;
  const isAdmin = mode === "local" || myRole === "관리자";

  /* ---------- 렌더 ---------- */

  /* 세션 확인 중 (Supabase) */
  if (session === undefined) {
    return (
      <div className="erp-root" style={{ alignItems: "center", justifyContent: "center" }}>
        <style>{CSS}</style>
        <div style={{ color: "#86868b", fontSize: 14, animation: "fadeUp .5s ease" }}>세션 확인 중…</div>
      </div>
    );
  }

  /* 로그인 필요 (Supabase) */
  if (session === null) {
    return (
      <div className="erp-root" style={{ display: "block", overflow: "auto" }}>
        <style>{CSS}</style>
        <AuthGate onToast={T} />
        <div className="a-toasts">{toasts.map((t) => <div key={t.id} className="a-toast"><Check size={14} color="#34c759" /> {t.msg}</div>)}</div>
      </div>
    );
  }

  /* Supabase 테이블 미생성 안내 */
  if (setupError === "table") {
    return (
      <div className="erp-root" style={{ display: "block", overflow: "auto" }}>
        <style>{CSS}</style>
        <SupabaseSetupNotice onSignOut={async () => { await auth.signOut(); }} />
      </div>
    );
  }

  if (data === undefined) {
    return (
      <div className="erp-root" style={{ alignItems: "center", justifyContent: "center" }}>
        <style>{CSS}</style>
        <div style={{ color: "#86868b", fontSize: 14, animation: "fadeUp .5s ease" }}>FlexERP 불러오는 중…</div>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="erp-root" style={{ display: "block", overflow: "auto" }}>
        <style>{CSS}</style>
        <SetupWizard onDone={(d) => { setData(d); setView("dashboard"); T("시스템이 생성되었습니다 — 환영합니다!"); }} />
        <div className="a-toasts">{toasts.map((t) => <div key={t.id} className="a-toast"><Check size={14} color="#34c759" /> {t.msg}</div>)}</div>
      </div>
    );
  }

  const props = { data, api, T, go };
  const adminProps = { isAdmin, me, myRole };
  let page = null;
  switch (view) {
    case "dashboard": page = <Dashboard data={data} go={go} />; break;
    case "fi-je": page = <JEPage {...props} />; break;
    case "fi-list": page = <JEListPage {...props} />; break;
    case "fi-tb": page = <TrialBalancePage data={data} T={T} />; break;
    case "fi-fs": page = <FinancialStatementsPage data={data} T={T} />; break;
    case "fi-ar": page = <ARAPPage data={data} T={T} />; break;
    case "co-cc": page = <CostCenterPage data={data} T={T} />; break;
    case "mm-po": page = <POPage {...props} />; break;
    case "mm-gr": page = <GRPage {...props} />; break;
    case "mm-stock": page = <StockPage data={data} T={T} />; break;
    case "sd-so": page = <SOPage {...props} />; break;
    case "sd-dl": page = <DeliveryPage {...props} />; break;
    case "sd-iv": page = <BillingPage {...props} />; break;
    case "pp-ord": page = <ProductionPage {...props} />; break;
    case "pp-bom": page = <BOMPage {...props} />; break;
    case "hr-emp": page = <MasterPage entityKey="employees" {...props} />; break;
    case "hr-pay": page = <PayrollPage {...props} />; break;
    case "md-acct": page = <MasterPage entityKey="accounts" {...props} />; break;
    case "md-partner": page = <MasterPage entityKey="partners" {...props} />; break;
    case "md-mat": page = <MasterPage entityKey="materials" {...props} />; break;
    case "md-cc": page = <MasterPage entityKey="costCenters" {...props} />; break;
    case "settings": page = <SettingsPage {...props} {...adminProps} />; break;
    default: page = <Dashboard data={data} go={go} />;
  }

  return (
    <div className="erp-root">
      <style>{CSS}</style>
      <Sidebar data={data} view={view} go={go} open={sideOpen} me={me} myRole={myRole} />
      {sideOpen && <div className="a-mask" onClick={() => setSideOpen(false)} />}
      <div className="a-main">
        <div className="a-topbar">
          <button className="a-burger" onClick={() => setSideOpen(true)}><Menu size={19} /></button>
          <div style={{ fontSize: 13.5, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.company.name}<span className="a-hint" style={{ marginLeft: 7 }}>코드 {data.company.code}</span></div>
          <div className="sp" />
          <button className="a-search" onClick={() => setPalette(true)}>
            <Search size={14} /> <span className="lbl">메뉴 · T-code 검색</span> <span className="a-kbd">⌘K</span>
          </button>
          {mode === "supabase" && (
            <button className="a-icon-btn" title="로그아웃" onClick={async () => { await auth.signOut(); }}>
              <LogOut size={17} />
            </button>
          )}
        </div>
        {page}
      </div>
      {palette && <CommandPalette data={data} onGo={go} onClose={() => setPalette(false)} />}
      <div className="a-toasts">{toasts.map((t) => <div key={t.id} className="a-toast"><Check size={14} color="#34c759" /> {t.msg}</div>)}</div>
    </div>
  );
}

/* ============================================================
   고도화 — 재무제표(F.01) · 채권채무(FBL5N) · BOM(CS01) · 급여(PC00) · 문서흐름
   ============================================================ */

function poFlow(data, po) {
  const out = [{ t: "발주", c: "blue", docNo: po.docNo, date: po.date }];
  data.goodsReceipts.filter((g) => g.poId === po.id).forEach((g) => {
    out.push({ t: "입고", c: "green", docNo: g.docNo, date: g.date });
    data.journals.filter((j) => j.ref === g.docNo).forEach((j) =>
      out.push({ t: j.source === "FI" ? "지급 전표" : "입고 전표", c: "gray", docNo: j.docNo, date: j.date }));
  });
  return out;
}

function soFlow(data, so) {
  const out = [{ t: "수주", c: "blue", docNo: so.docNo, date: so.date }];
  data.deliveries.filter((x) => x.soId === so.id).forEach((dl) => {
    out.push({ t: "출고", c: "orange", docNo: dl.docNo, date: dl.date });
    data.journals.filter((j) => j.ref === dl.docNo && j.source === "SD").forEach((j) =>
      out.push({ t: "원가 전표", c: "gray", docNo: j.docNo, date: j.date }));
  });
  data.invoices.filter((x) => x.soId === so.id).forEach((iv) => {
    out.push({ t: "청구", c: "green", docNo: iv.docNo, date: iv.date });
    data.journals.filter((j) => j.ref === iv.docNo).forEach((j) =>
      out.push({ t: j.source === "FI" ? "수금 전표" : "매출 전표", c: "gray", docNo: j.docNo, date: j.date }));
  });
  return out;
}

function FinancialStatementsPage({ data, T }) {
  const [period, setPeriod] = useState("month");
  const nowKey = monthKey(today());
  const balsOf = (journals) => {
    const m = {};
    journals.forEach((j) => j.lines.forEach((l) => {
      if (!l.accountId) return;
      if (!m[l.accountId]) m[l.accountId] = { dr: 0, cr: 0 };
      m[l.accountId].dr += Number(l.dr) || 0;
      m[l.accountId].cr += Number(l.cr) || 0;
    }));
    return m;
  };
  const rowsOf = (bals, type, side) => data.accounts
    .filter((a) => a.type === type)
    .map((a) => {
      const b = bals[a.id];
      if (!b) return null;
      const v = side === "cr" ? b.cr - b.dr : b.dr - b.cr;
      return v !== 0 ? { a, v } : null;
    })
    .filter(Boolean)
    .sort((x, y) => x.a.code.localeCompare(y.a.code));

  const plB = balsOf(period === "month" ? data.journals.filter((j) => monthKey(j.date) === nowKey) : data.journals);
  const allB = balsOf(data.journals);
  const rev = rowsOf(plB, "수익", "cr");
  const exp = rowsOf(plB, "비용", "dr");
  const totRev = rev.reduce((s, r) => s + r.v, 0);
  const totExp = exp.reduce((s, r) => s + r.v, 0);
  const ni = totRev - totExp;
  const assets = rowsOf(allB, "자산", "dr");
  const liabs = rowsOf(allB, "부채", "cr");
  const eqs = rowsOf(allB, "자본", "cr");
  const niAll = rowsOf(allB, "수익", "cr").reduce((s, r) => s + r.v, 0) - rowsOf(allB, "비용", "dr").reduce((s, r) => s + r.v, 0);
  const totA = assets.reduce((s, r) => s + r.v, 0);
  const totLE = liabs.reduce((s, r) => s + r.v, 0) + eqs.reduce((s, r) => s + r.v, 0) + niAll;

  if (data.journals.length === 0) {
    return (
      <div className="a-page">
        <PageHead title="재무제표" sub="손익계산서 · 재무상태표 · T-code F.01" />
        <div className="a-card"><Empty icon={BookOpen} title="집계할 전표가 없습니다" sub="거래가 전기되면 자동으로 작성됩니다" /></div>
      </div>
    );
  }

  const Row = ({ name, v, neg }) => (
    <div className="a-fsrow"><span>{name}</span><span style={neg ? { color: "#ff3b30" } : null}>{fmt(v)}</span></div>
  );

  const exportFS = () => {
    const out = [];
    out.push(["[손익계산서]", period === "month" ? nowKey + " (이번 달)" : "누적", ""]);
    out.push(["구분", "계정", "금액"]);
    rev.forEach((r) => out.push(["수익", r.a.code + " " + r.a.name, r.v]));
    out.push(["", "수익 합계", totRev]);
    exp.forEach((r) => out.push(["비용", r.a.code + " " + r.a.name, r.v]));
    out.push(["", "비용 합계", totExp]);
    out.push(["", "당기순이익", ni]);
    out.push(["", "", ""]);
    out.push(["[재무상태표]", "누적", ""]);
    assets.forEach((r) => out.push(["자산", r.a.code + " " + r.a.name, r.v]));
    out.push(["", "자산 총계", totA]);
    liabs.forEach((r) => out.push(["부채", r.a.code + " " + r.a.name, r.v]));
    eqs.forEach((r) => out.push(["자본", r.a.code + " " + r.a.name, r.v]));
    out.push(["자본", "당기순이익 (누적)", niAll]);
    out.push(["", "부채·자본 총계", totLE]);
    return [["구분", "계정", "금액"], out];
  };

  return (
    <div className="a-page">
      <PageHead title="재무제표" sub="손익계산서 · 재무상태표 — 총계정원장(GL) 전표 기준 · T-code F.01"
        action={<div style={{ display: "flex", gap: 8 }}><PrintBtn /><ExportBtn filename="재무제표" T={T} build={exportFS} /></div>} />
      <div className="a-cols2">
        <div className="a-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div className="a-card-t">손익계산서</div>
            <Seg options={[{ v: "month", label: "이번 달" }, { v: "all", label: "누적" }]} value={period} onChange={setPeriod} />
          </div>
          <div className="a-fshead">수익</div>
          {rev.length === 0 && <div className="a-hint" style={{ padding: "6px 0" }}>수익 없음</div>}
          {rev.map((r) => <Row key={r.a.id} name={r.a.code + " " + r.a.name} v={r.v} />)}
          <div className="a-fssub"><span>수익 합계</span><span>{fmt(totRev)}</span></div>
          <div className="a-fshead">비용</div>
          {exp.length === 0 && <div className="a-hint" style={{ padding: "6px 0" }}>비용 없음</div>}
          {exp.map((r) => <Row key={r.a.id} name={r.a.code + " " + r.a.name} v={r.v} />)}
          <div className="a-fssub"><span>비용 합계</span><span>{fmt(totExp)}</span></div>
          <div className="a-fssub" style={{ fontSize: 15, borderTop: "2px solid rgba(0,0,0,.14)" }}>
            <span>당기순이익</span><span style={{ color: ni >= 0 ? "#248a3d" : "#d70015" }}>{fmt(ni)}</span>
          </div>
        </div>
        <div className="a-card" style={{ padding: 20 }}>
          <div className="a-card-t">재무상태표 <span className="a-hint" style={{ fontWeight: 400 }}>(누적)</span></div>
          <div className="a-fshead">자산</div>
          {assets.length === 0 && <div className="a-hint" style={{ padding: "6px 0" }}>자산 없음</div>}
          {assets.map((r) => <Row key={r.a.id} name={r.a.code + " " + r.a.name} v={r.v} neg={r.v < 0} />)}
          <div className="a-fssub"><span>자산 총계</span><span>{fmt(totA)}</span></div>
          <div className="a-fshead">부채</div>
          {liabs.length === 0 && <div className="a-hint" style={{ padding: "6px 0" }}>부채 없음</div>}
          {liabs.map((r) => <Row key={r.a.id} name={r.a.code + " " + r.a.name} v={r.v} />)}
          <div className="a-fshead">자본</div>
          {eqs.map((r) => <Row key={r.a.id} name={r.a.code + " " + r.a.name} v={r.v} />)}
          <Row name="당기순이익 (누적)" v={niAll} neg={niAll < 0} />
          <div className="a-fssub"><span>부채 · 자본 총계</span><span>{fmt(totLE)}</span></div>
          <div style={{ marginTop: 10, textAlign: "right" }}>
            {totA === totLE
              ? <Badge color="green">자산 = 부채 + 자본 균형</Badge>
              : <Badge color="red">차액 {fmt(totA - totLE)}</Badge>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ARAPPage({ data, T }) {
  const arId = acctIdByCode(data, "10800");
  const apId = acctIdByCode(data, "25100");
  const rows = useMemo(() => {
    const map = {};
    data.journals.forEach((j) => j.lines.forEach((l) => {
      if (l.accountId !== arId && l.accountId !== apId) return;
      const k = l.partnerId || "_none";
      if (!map[k]) map[k] = { ar: 0, ap: 0 };
      if (l.accountId === arId) map[k].ar += (Number(l.dr) || 0) - (Number(l.cr) || 0);
      else map[k].ap += (Number(l.cr) || 0) - (Number(l.dr) || 0);
    }));
    return Object.entries(map)
      .map(([k, v]) => ({ id: k, name: k === "_none" ? "거래처 미지정" : ((partnerById(data, k) || {}).name || "(삭제된 거래처)"), ar: v.ar, ap: v.ap }))
      .filter((r) => r.ar !== 0 || r.ap !== 0)
      .sort((a, b) => (b.ar + b.ap) - (a.ar + a.ap));
  }, [data]);
  const tot = rows.reduce((s, r) => ({ ar: s.ar + r.ar, ap: s.ap + r.ap }), { ar: 0, ap: 0 });
  const exportARAP = () => [
    ["거래처", "외상매출금", "외상매입금", "순채권"],
    rows.map((r) => [r.name, r.ar, r.ap, r.ar - r.ap]),
  ];
  return (
    <div className="a-page">
      <PageHead title="채권 · 채무" sub="거래처별 외상매출금(받을 돈) · 외상매입금(줄 돈) 잔액 · T-code FBL5N / FBL1N"
        action={<ExportBtn filename="채권채무" T={T} disabled={rows.length === 0} build={exportARAP} />} />
      <div className="a-card">
        {rows.length === 0 ? (
          <Empty icon={CreditCard} title="채권 · 채무 잔액이 없습니다" sub="청구 · 입고 · 수금 · 지급 시 거래처별로 자동 집계됩니다" />
        ) : (
          <div className="a-tablewrap">
            <table className="a-table">
              <thead><tr><th>거래처</th><th className="num">외상매출금</th><th className="num">외상매입금</th><th className="num">순채권</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td className="num">{r.ar ? fmt(r.ar) : ""}</td>
                    <td className="num">{r.ap ? fmt(r.ap) : ""}</td>
                    <td className="num" style={{ color: r.ar - r.ap >= 0 ? "#248a3d" : "#d70015", fontWeight: 600 }}>{fmt(r.ar - r.ap)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td>합계</td><td className="num">{fmt(tot.ar)}</td><td className="num">{fmt(tot.ap)}</td><td className="num">{fmt(tot.ar - tot.ap)}</td></tr></tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function BOMForm({ product, bom, data, onSave, onDelete, onClose }) {
  const parts = data.materials.filter((m) => m.type === "원자재" || m.type === "상품");
  const [comps, setComps] = useState(() =>
    bom && bom.components.length
      ? bom.components.map((c) => ({ key: uid(), materialId: c.materialId, qty: c.qty }))
      : [{ key: uid(), materialId: "", qty: 1 }]
  );
  const setComp = (key, k, v) => setComps((cs) => cs.map((c) => (c.key === key ? { ...c, [k]: v } : c)));
  const valid = comps.filter((c) => c.materialId && Number(c.qty) > 0);
  const unitCost = valid.reduce((s, c) => s + Number(c.qty) * ((matById(data, c.materialId) || {}).cost || 0), 0);
  return (
    <Modal title={"BOM — " + product.name} onClose={onClose} width={560}>
      <div className="a-hint" style={{ marginBottom: 10 }}>제품 1{product.unit || "개"} 생산에 필요한 자재 구성입니다 (SAP CS01)</div>
      <div className="a-tablewrap">
        <table className="a-table">
          <thead><tr><th style={{ minWidth: 200 }}>자재</th><th className="num" style={{ width: 115 }}>단위당 소요량</th><th className="num">재료비</th><th></th></tr></thead>
          <tbody>
            {comps.map((c) => {
              const m = matById(data, c.materialId);
              return (
                <tr key={c.key}>
                  <td>
                    <select className="a-select" value={c.materialId} onChange={(e) => setComp(c.key, "materialId", e.target.value)}>
                      <option value="">자재 선택</option>
                      {parts.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
                    </select>
                  </td>
                  <td><input type="number" className="a-input num" min="0" step="any" value={c.qty} onChange={(e) => setComp(c.key, "qty", e.target.value)} /></td>
                  <td className="num">{fmt(Number(c.qty) * ((m || {}).cost || 0))}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="a-icon-btn red" onClick={() => setComps((cs) => cs.filter((x) => x.key !== c.key))}><Trash2 size={15} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <button className="a-btn a-btn-sec a-btn-sm" onClick={() => setComps((cs) => [...cs, { key: uid(), materialId: "", qty: 1 }])}><Plus size={14} /> 자재 추가</button>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 14 }}>단위당 재료비 <b>{fmt(unitCost)}</b></div>
        {bom && <button className="a-btn a-btn-danger a-btn-sm" onClick={onDelete}><Trash2 size={13} /> BOM 삭제</button>}
        <button className="a-btn a-btn-pri" disabled={!valid.length}
          onClick={() => onSave(valid.map((c) => ({ materialId: c.materialId, qty: Number(c.qty) })))}>
          <Check size={15} /> 저장
        </button>
      </div>
    </Modal>
  );
}

function BOMPage({ data, api, T }) {
  const products = data.materials.filter((m) => m.type === "제품");
  const boms = data.boms || [];
  const [edit, setEdit] = useState(null);
  const cols = [
    { key: "code", label: "제품", render: (r) => r.code + " · " + r.name },
    { key: "_b", label: "BOM 구성", render: (r) => {
      const b = boms.find((x) => x.productId === r.id);
      return b ? b.components.length + "개 자재" : <Badge color="gray">미등록</Badge>;
    }},
    { key: "_c", label: "단위당 재료비", align: "right", render: (r) => {
      const b = boms.find((x) => x.productId === r.id);
      if (!b) return "—";
      return fmt(b.components.reduce((s, c) => s + c.qty * ((matById(data, c.materialId) || {}).cost || 0), 0));
    }},
    { key: "cost", label: "표준원가", align: "right", render: (r) => fmt(r.cost) },
    { key: "_a", label: "", align: "right", render: () => <span className="a-hint">편집 ›</span> },
  ];
  return (
    <div className="a-page">
      <PageHead title="BOM 관리" sub="제품별 자재 구성 — 생산오더 생성 시 소요량 자동 계산 · T-code CS01" />
      <div className="a-card">
        <Table cols={cols} rows={products} onRow={setEdit}
          empty={<Empty icon={Layers} title="제품이 없습니다" sub="마스터데이터 › 자재에서 유형 '제품'으로 먼저 등록하세요" />} />
      </div>
      {edit && (
        <BOMForm product={edit} bom={boms.find((b) => b.productId === edit.id)} data={data}
          onClose={() => setEdit(null)}
          onDelete={() => { api.deleteBOM(edit.id); T("BOM을 삭제했습니다"); setEdit(null); }}
          onSave={(components) => { api.saveBOM(edit.id, components); T("BOM을 저장했습니다"); setEdit(null); }} />
      )}
    </div>
  );
}

function PayrollPage({ data, api }) {
  const nowKey = monthKey(today());
  const months = data.payrollMonths || [];
  const paid = months.includes(nowKey);
  const total = data.employees.reduce((s, e) => s + (Number(e.salary) || 0), 0);
  return (
    <div className="a-page">
      <PageHead title="급여 지급" sub="당월 급여 일괄 전기 — 부서명과 같은 코스트센터가 있으면 자동 배부 · T-code PC00"
        action={paid
          ? <Badge color="green">{nowKey} 지급 완료</Badge>
          : <button className="a-btn a-btn-pri" disabled={total <= 0} onClick={() => api.payPayroll()}><Banknote size={15} /> {nowKey} 급여 일괄 전기</button>} />
      <div className="a-card">
        {data.employees.length === 0 ? (
          <Empty icon={Users} title="사원이 없습니다" sub="HR › 사원 관리에서 먼저 등록하세요" />
        ) : (
          <div className="a-tablewrap">
            <table className="a-table">
              <thead><tr><th>사번</th><th>이름</th><th>부서</th><th>직급</th><th className="num">월 급여</th></tr></thead>
              <tbody>
                {data.employees.map((e) => (
                  <tr key={e.id}><td>{e.code}</td><td>{e.name}</td><td>{e.dept}</td><td>{e.position}</td><td className="num">{fmt(e.salary)}</td></tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={4}>총 지급액 ({data.employees.length}명)</td><td className="num">{fmt(total)}</td></tr></tfoot>
            </table>
          </div>
        )}
      </div>
      {months.length > 0 && (
        <div className="a-card" style={{ padding: 20 }}>
          <div className="a-card-t" style={{ marginBottom: 10 }}>지급 이력</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[...months].sort().reverse().map((m) => <Badge key={m} color="blue">{m}</Badge>)}
          </div>
        </div>
      )}
    </div>
  );
}
