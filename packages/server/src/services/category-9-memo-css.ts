export const CATEGORY_9_MEMO_CSS = `
@page { size: A4; margin: 16mm; }
body { font-family: "Arial Narrow", Arial, sans-serif; font-size: 12pt; color: #000; margin: 0; line-height: 2; }
.cat9-address { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
.cat9-to { margin-left: auto; width: max-content; text-align: right; }
.cat9-under { text-align: center; }
.cat9-name { font-weight: 700; }
.cat9-role { font-size: 10pt; }
.cat9-meta { display: grid; grid-template-columns: 1fr auto 1fr; align-items: start; margin-top: 28px; }
.cat9-meta h1 { margin: 0; }
.cat9-date { text-align: right; }
.ref { font-weight: 700; }
h1 { text-align: center; text-decoration: underline; font-size: 14pt; margin: 22px 0; }
p { margin: 0 0 12px; text-align: justify; }
table { width: 100%; border-collapse: collapse; margin: 8px 0 14px; }
td { padding: 2px 0; vertical-align: bottom; }
td.days { text-align: right; width: 70px; font-weight: 700; white-space: nowrap; }
td.leave-item { display: flex; align-items: flex-end; gap: 8px; }
.leader { flex: 1; border-bottom: 1px dotted #000; margin: 0 4px 4px; min-width: 24px; }
.sign-right { margin-top: 28px; text-align: right; font-weight: 700; }
.cc { margin-top: 28px; }
`