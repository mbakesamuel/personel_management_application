import type {
  AppraisalSummaryRow,
  AppraisalSummarySection,
} from "@personel-management-app/shared";
import { formatDisplayDate } from "./format-date";
import { LOGO_DATA_URI } from "./logo";
import {
  buildReportFooterHtml,
  REPORT_FOOTER_PRINT_CSS,
} from "../components/ReportFooter";
import {
  buildReportHeaderHtml,
  REPORT_HEADER_PRINT_CSS,
} from "../components/ReportHeader";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

const COLGROUP = `
          <colgroup>
            <col style="width:3%" />
            <col style="width:5%" />
            <col style="width:12%" />
            <col style="width:9%" />
            <col style="width:7%" />
            <col style="width:5%" />
            <col style="width:7%" />
            <col style="width:7%" />
            <col style="width:7%" />
            <col style="width:4%" />
            <col style="width:4%" />
            <col style="width:6%" />
            <col style="width:6%" />
            <col style="width:5%" />
            <col style="width:5%" />
            <col style="width:8%" />
          </colgroup>`;

const THEAD = `
          <thead>
            <tr>
              <th rowspan="2" class="nw">SN</th>
              <th rowspan="2" class="nw">Mat No</th>
              <th rowspan="2">Name</th>
              <th rowspan="2">Design</th>
              <th rowspan="2" class="nw">D. Eng</th>
              <th rowspan="2" class="nw">Dur in Post (Yr)</th>
              <th colspan="3">Date of Last</th>
              <th colspan="2">Cat/Ech</th>
              <th colspan="2">Salary</th>
              <th colspan="2">Fin. Inc</th>
              <th rowspan="2">EM's Remarks</th>
            </tr>
            <tr>
              <th class="nw">Prom/Recl</th>
              <th class="nw">Merit</th>
              <th class="nw">Stat.</th>
              <th class="nw">Pres</th>
              <th class="nw">Pro</th>
              <th class="nw">Pres</th>
              <th class="nw">Pros</th>
              <th class="nw">Per Month</th>
              <th class="nw">Per Year</th>
            </tr>
          </thead>`;

function rowHtml(row: AppraisalSummaryRow): string {
  return `
        <tr>
          <td class="c nw">${row.sn}</td>
          <td class="c nw">${escapeHtml(row.matric)}</td>
          <td class="u wrap"><div>${escapeHtml(row.names ?? "")}</div></td>
          <td class="u wrap"><div>${escapeHtml(row.designation ?? "")}</div></td>
          <td class="c nw">${escapeHtml(formatDisplayDate(row.dateEng))}</td>
          <td class="c nw">${escapeHtml(row.lengthService ?? "")}</td>
          <td class="c nw">${escapeHtml(formatDisplayDate(row.dateLpro))}</td>
          <td class="c nw">${escapeHtml(formatDisplayDate(row.dateLmer))}</td>
          <td class="c nw">${escapeHtml(formatDisplayDate(row.dateLstat))}</td>
          <td class="c nw">${escapeHtml(row.preCat ?? "")}</td>
          <td class="c nw">${escapeHtml(row.proCat ?? "")}</td>
          <td class="r nw">${formatNumber(row.preSalary)}</td>
          <td class="r nw">${formatNumber(row.proSalary)}</td>
          <td class="r nw">${formatNumber(row.finIncMonth)}</td>
          <td class="r nw">${formatNumber(row.finIncYear)}</td>
          <td class="wrap"><div>${escapeHtml(row.award ?? "")}</div></td>
        </tr>`;
}

export function buildAppraisalSummaryPrintHtml(
  sections: AppraisalSummarySection[],
  appyear: number | null,
): string {
  const title = `${appyear ?? "—"} PERFORMANCE APPRAISALS 1 - 3`;
  const pages = sections
    .map((section) => {
      const bodyRows = section.rows.map(rowHtml).join("");
      const headerHtml = buildReportHeaderHtml({
        department: section.groupName,
        serviceName: section.unitName,
        title,
        logoDataUri: LOGO_DATA_URI,
        escapeHtml,
      });
      const signatureHtml = buildReportFooterHtml({
        name: section.signatoryName,
        label: section.signatoryTitle,
        escapeHtml,
      });

      return `
      <section class="page">
        ${headerHtml}
        <p class="section-label">SECTION: ${escapeHtml(section.sectionName)}</p>
        <table>
          ${COLGROUP}
          ${THEAD}
          <tbody>
            ${bodyRows}
            <tr class="total">
              <td colspan="11" class="r">TOTAL</td>
              <td class="r nw">${formatNumber(section.totals.preSalary)}</td>
              <td class="r nw">${formatNumber(section.totals.proSalary)}</td>
              <td class="r nw">${formatNumber(section.totals.finIncMonth)}</td>
              <td class="r nw">${formatNumber(section.totals.finIncYear)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
        ${signatureHtml}
      </section>`;
    })
    .join("");

  const fixedFooter = `
    <footer class="ftr">
      <span>ANNUAL SALARY REVIEW FOR ${appyear ?? "—"}</span>
    </footer>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Appraisal Summary ${appyear ?? ""}</title>
  <style>
    @page { size: A4 landscape; margin: 8mm 2mm 12mm 2mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Arial Narrow", Arial, sans-serif;
      color: #000;
      font-size: 8pt;
    }
    .page {
      page-break-after: always;
      padding-bottom: 12mm;
    }
    .page:last-child { page-break-after: auto; }
    ${REPORT_HEADER_PRINT_CSS}
    ${REPORT_FOOTER_PRINT_CSS}
    .rf { margin-top: 4px; }
    .rh-company-name, .rh-line, .rh-title, .rh-tiles span,
    .rf, .rf-name, .rf-label {
      font-family: "Arial Narrow", Arial, sans-serif;
      font-size: 8pt;
    }
    .section-label {
      margin: 6px 0 0;
      text-align: left;
      font-weight: 700;
      text-transform: uppercase;
      font-family: "Arial Narrow", Arial, sans-serif;
      font-size: 8pt;
    }
    table {
      width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
      margin-top: 6px;
      font-family: "Arial Narrow", Arial, sans-serif;
      font-size: 8pt;
    }
    thead { display: table-header-group; }
    tbody { display: table-row-group; }
    tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #000;
      padding: 2px 3px;
      vertical-align: middle;
      font-family: "Arial Narrow", Arial, sans-serif;
      font-size: 8pt;
    }
    th { text-transform: uppercase; }
    .c { text-align: center; }
    .r { text-align: center; }
    .u { text-transform: uppercase; }
    .nw {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    td.wrap div {
      display: block;
      width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .total { font-weight: 700; }
    .ftr {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      height: 8mm;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      border-top: 1px solid #000;
      padding-top: 2px;
      font-weight: 300;
      font-style: italic;
      text-transform: capitalize;
      font-family: "Arial Narrow", Arial, sans-serif;
      font-size: 6pt;
      background: #fff;
      z-index: 1;
    }
  </style>
</head>
<body>${pages}${fixedFooter}</body>
</html>`;
}
