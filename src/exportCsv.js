/* CSV 내보내기 유틸 — 의존성 없음.
   UTF-8 BOM 을 붙여 Excel 에서 한글이 깨지지 않고 바로 열립니다. */

function esc(v) {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/* headers: ["문서번호", ...] 또는 [{label}], rows: 2차원 배열 */
export function toCSV(headers, rows) {
  const head = headers.map((h) => esc(h && h.label != null ? h.label : h)).join(",");
  const body = rows.map((r) => r.map(esc).join(",")).join("\r\n");
  return head + "\r\n" + body;
}

export function downloadCSV(filename, headers, rows) {
  const csv = toCSV(headers, rows);
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : filename + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}
