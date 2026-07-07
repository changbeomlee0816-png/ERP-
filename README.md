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

## 구조

- `src/App.jsx` — 전체 UI · 라우팅 · 회계 통합 전기(Posting) 로직 · 로그인 게이트
- `src/backend.js` — 인증 · 상태 저장 · Realtime 추상화 (Supabase / localStorage 자동 전환)
- `src/supabaseClient.js` — Supabase 클라이언트 초기화
- `src/storage.js` — localStorage 폴백 어댑터
- `supabase/schema.sql` — 데이터베이스 스키마 · RLS · Realtime
