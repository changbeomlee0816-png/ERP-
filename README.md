# FlexERP

SAP 구조(FI · CO · MM · SD · PP · HR)를 참고한 ERP 시스템입니다. React + Vite로 동작하며,
**Supabase 클라우드 백엔드**를 통해 여러 사용자가 로그인해 같은 회사 데이터를 실시간으로 공유합니다.
(Supabase 설정이 없으면 자동으로 브라우저 `localStorage` 단일 기기 모드로 동작합니다.)

## 실행

```bash
npm install
npm run dev
```

## 빌드

```bash
npm run build
```

## Supabase 연동 (여러 사용자 · 실시간 공유)

1. **환경변수** — `.env` 에 프로젝트 URL과 anon key 를 넣습니다. (`.env.example` 참고)
   anon key 는 클라이언트에 노출되는 공개 키이며, 실제 접근 통제는 아래 RLS 정책이 담당합니다.

   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

2. **스키마 적용** — Supabase 대시보드 → **SQL Editor** 에서 [`supabase/schema.sql`](supabase/schema.sql)
   전체를 붙여넣고 한 번 실행합니다. 다음이 생성됩니다.
   - `erp_state` 테이블 (전체 ERP 상태를 JSONB 문서로 보관)
   - 로그인 사용자만 읽고 쓸 수 있는 RLS 정책
   - Realtime publication (다른 사용자의 변경을 실시간 수신)

3. **로그인** — 앱을 열면 로그인 화면이 나타납니다. **회원가입**으로 계정을 만든 뒤 로그인합니다.
   - 기본적으로 이메일 확인(Confirm email)이 켜져 있어, 가입 후 메일의 링크를 눌러야 로그인됩니다.
   - 사내 사용 등으로 확인 과정을 생략하려면 Supabase 대시보드
     **Authentication → Providers → Email → Confirm email** 을 꺼주세요.

> **데이터 모델 참고**: 단일 회사를 여러 사용자가 공유하는 구성으로, 전체 상태를 하나의
> JSONB 문서로 저장하고 Realtime 으로 동기화합니다. 동시에 같은 화면을 편집하면 마지막
> 저장이 우선합니다(last-write-wins). 대규모 동시 편집이 필요해지면 엔티티별 정규화 테이블로
> 확장할 수 있습니다.

## 사용자 권한 (관리자 / 일반)

Supabase 모드에서 여러 직원이 같은 회사를 공유할 때 역할로 권한을 구분합니다.

- **회사를 처음 만든 사용자 = 관리자**, 이후 가입자는 자동으로 **일반 사용자**로 등록됩니다.
- **관리자만** 회사 정보 수정 · 모듈 구성 · 백업 가져오기 · 전체 초기화 · 사용자 역할 변경이 가능합니다.
- 일반 사용자는 일상 업무(전표·발주·수주·입고·출고·청구·생산·마스터 관리·CSV 내보내기)를 그대로 수행합니다.
- 역할 관리는 **설정 → 사용자 권한**에서 합니다. (관리자는 최소 1명 유지)

> 현재 권한은 화면(UI) 단위로 적용됩니다. 더 엄격한 서버 강제가 필요하면 역할을 별도 테이블로
> 분리하고 RLS 정책으로 쓰기를 제한하는 방향으로 확장할 수 있습니다.

## 분석 (전월 대비)

대시보드에 **전월 대비** 카드가 있어 매출 · 매입 · 영업손익을 지난달과 비교하고 증감액·증감율을 보여줍니다.

## 인쇄 · PDF

재무제표 · 시산표 페이지의 **인쇄 · PDF** 버튼으로 사이드바·버튼을 제외한 리포트만 깔끔하게 인쇄하거나,
인쇄 대화상자에서 "PDF로 저장"을 선택할 수 있습니다.

## 데이터 내보내기 (CSV / Excel)

주요 리포트와 마스터 데이터에 **CSV 내보내기** 버튼이 있습니다. UTF-8 BOM 을 포함해
Excel 에서 한글이 깨지지 않고 바로 열리며, 금액은 계산 가능한 숫자 원본으로 내보냅니다.

- 전표 조회(라인 단위) · 시산표 · 재무제표 · 재고 현황 · 채권·채무 · 코스트센터
- 계정과목 · 거래처 · 자재 · 사원 · 코스트센터 (마스터 데이터)

## 구조

- `src/App.jsx` — 전체 UI · 라우팅 · 회계 통합 전기(Posting) 로직 · 로그인 게이트 · 권한 · 분석 · 인쇄
- `src/backend.js` — 인증 · 상태 저장 · Realtime 추상화 (Supabase / localStorage 자동 전환)
- `src/supabaseClient.js` — Supabase 클라이언트 초기화
- `src/storage.js` — localStorage 폴백 어댑터
- `src/exportCsv.js` — CSV 내보내기 유틸 (UTF-8 BOM)
- `supabase/schema.sql` — 데이터베이스 스키마 · RLS · Realtime
