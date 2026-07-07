# FlexERP

SAP 구조(FI · CO · MM · SD · PP · HR)를 참고한 단일 조직용 ERP 프로토타입입니다. React + Vite로 동작하며, 데이터는 브라우저 `localStorage`에 저장됩니다.

## 실행

```bash
npm install
npm run dev
```

## 빌드

```bash
npm run build
```

## 구조

- `src/App.jsx` — 전체 UI · 라우팅 · 회계 통합 전기(Posting) 로직
- `src/storage.js` — `localStorage` 기반 영속성 어댑터
