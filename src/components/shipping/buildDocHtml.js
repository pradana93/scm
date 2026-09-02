import { formatDeliveryDateLong } from "./packingUtils";
import { statusMeta, formatTimestamp } from "./shippingUtils";

const COL_LABELS = {
  no_koli: "No. Koli",
  description: "Description",
  qty: "Qty",
  satuan_gramasi: "Satuan Gramasi",
  total_gramasi: "Total Gramasi (Gr)",
  item_unit: "Item Unit",
  notes: "Notes",
};
const ALL_COLS = ["no_koli", "description", "qty", "satuan_gramasi", "total_gramasi", "item_unit", "notes"];

const esc = (v) => String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function statusLabel(item) {
  return (statusMeta[item.status] || statusMeta.menunggu_antrian).label;
}

function header(title, item) {
  return `<div class="head">
    <div class="brandrow">
      <div><div class="brand">PT Bangor Berkembang Bersama</div><h1>${esc(title)}</h1></div>
      <div class="statusbox"><div class="slbl">Status</div><div class="sval">${esc(statusLabel(item))}</div></div>
    </div>
  </div>`;
}

function footer() {
  return `<div class="foot">Dokumen ini dicetak oleh Sistem Bangor Logistics · ${esc(formatTimestamp(new Date().toISOString()))}</div>`;
}

function signature(leftLabel, rightLabel, leftName = "") {
  return `<div class="sign">
    <div class="col">${esc(leftLabel)}<div class="line">${esc(leftName)}</div></div>
    <div class="col">${esc(rightLabel)}<div class="line"></div></div>
  </div>`;
}

function sheetTable(cols, items) {
  const used = cols && cols.length ? cols : ALL_COLS;
  const head = used.map((k) => `<th class="${k === "qty" || k === "total_gramasi" ? "right" : ""}">${esc(COL_LABELS[k] || k)}</th>`).join("");
  const body = (items && items.length ? items : []).map((it) => {
    const tds = used.map((k) => {
      const v = it[k];
      const txt = k === "total_gramasi" ? Number(v || 0).toLocaleString("id-ID") : (v == null || v === "" ? "-" : esc(v));
      return `<td class="${k === "qty" || k === "total_gramasi" ? "right" : ""}">${txt}</td>`;
    }).join("");
    return `<tr>${tds}</tr>`;
  }).join("") || `<tr><td class="center" colspan="${used.length}">Tidak ada item</td></tr>`;
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function editableTable(rows) {
  const head = `<tr><th>No. Koli</th><th>Description</th><th class="right">Qty</th><th>Item Unit</th><th>Notes</th></tr>`;
  const body = (rows && rows.length ? rows : []).map((r) =>
    `<tr><td>${esc(r.koli || "-")}</td><td>${esc(r.name || "-")}</td><td class="right">${esc(r.qty)}</td><td>${esc(r.unit || "-")}</td><td>${esc(r.notes || "-")}</td></tr>`
  ).join("") || `<tr><td class="center" colspan="5">Detail item tidak tersedia.</td></tr>`;
  return `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

export function buildDocHtml({ title, isPacking, item, sheets = [], editableRows = [], orientation = "portrait" }) {
  let body = "";
  if (isPacking) {
    if (sheets.length) {
      sheets.forEach((sh, i) => {
        body += `<div class="sheet${i > 0 ? " break" : ""}">`;
        body += header(title, item);
        body += `<div class="info">
          <div><span class="lbl">Ship To</span><br><span class="val">${esc(sh.ship_to || "-")}</span></div>
          <div><span class="lbl">Delivery No</span><br><span class="val">${esc(sh.delivery_no || "-")}</span></div>
          <div><span class="lbl">Ship Via</span><br><span class="val">${esc(sh.ship_via || "-")}</span></div>
          <div><span class="lbl">Delivery Date</span><br><span class="val">${esc(sh.delivery_date || "-")}</span></div>
        </div>`;
        body += sheetTable(sh.columns, sh.items);
        body += signature("Checker", "Packer");
        body += footer();
        body += `</div>`;
      });
    } else {
      body += `<div class="sheet">`;
      body += header(title, item);
      body += `<div class="info">
        <div><span class="lbl">Ship To</span><br><span class="val">${esc(item.outlet_name || "-")}</span></div>
        <div><span class="lbl">Delivery No</span><br><span class="val">${esc(item.do_number || "-")}</span></div>
        <div><span class="lbl">Ship Via</span><br><span class="val">${esc(item.fleet || "-")}</span></div>
        <div><span class="lbl">Delivery Date</span><br><span class="val">${esc(formatDeliveryDateLong(item.delivery_date))}</span></div>
      </div>`;
      body += editableTable(editableRows);
      body += signature("Checker", "Packer");
      body += footer();
      body += `</div>`;
    }
  } else {
    body += `<div class="sheet">`;
    body += header(title, item);
    body += `<div class="info">
      <div><span class="lbl">Number</span><br><span class="val">${esc(item.do_number || "-")}</span></div>
      <div><span class="lbl">Customer</span><br><span class="val">${esc(item.outlet_name || "-")}</span></div>
      <div><span class="lbl">Date</span><br><span class="val">${esc(item.delivery_date || "-")}</span></div>
      <div><span class="lbl">Tonase</span><br><span class="val">${esc(Number(item.tonnage || 0).toLocaleString("id-ID"))} kg</span></div>
      <div><span class="lbl">Gudang Asal</span><br><span class="val">${esc(item.warehouse || "-")}</span></div>
      <div><span class="lbl">Checker</span><br><span class="val">${esc(item.checker_name || "-")}</span></div>
    </div>`;
    const items = Array.isArray(item.do_items) ? item.do_items : [];
    const rows = items.length ? items.map((it) =>
      `<tr><td>${esc(it.code || "-")}</td><td>${esc(it.name || "-")}</td><td class="right">${esc(it.quantity)}</td><td>${esc(it.unit || "-")}</td></tr>`
    ).join("") : `<tr><td class="center" colspan="4">Tidak ada item</td></tr>`;
    body += `<table><thead><tr><th>Code#</th><th>Item Name</th><th class="right">Quantity</th><th>Unit</th></tr></thead><tbody>${rows}</tbody></table>`;
    body += signature("Checker", "Driver / Crew", item.checker_name);
    body += footer();
    body += `</div>`;
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@page { size: A4 ${orientation}; margin: 14mm; }
*{box-sizing:border-box}
body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1e293b;font-size:12px;margin:0}
.head{border-bottom:2px solid #1e293b;padding-bottom:10px;margin-bottom:16px}
.brandrow{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.brand{font-size:12px;font-weight:700;color:#475569;letter-spacing:.3px}
.head h1{font-size:18px;margin:2px 0 0;text-transform:uppercase;letter-spacing:.5px}
.statusbox{text-align:right;border:1px solid #cbd5e1;border-radius:6px;padding:5px 12px;min-width:110px}
.slbl{font-size:9px;text-transform:uppercase;color:#64748b;letter-spacing:.3px}
.sval{font-size:13px;font-weight:700;color:#1e293b}
.info{display:grid;grid-template-columns:1fr 1fr;gap:8px 28px;margin-bottom:14px}
.info .lbl{color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.3px}
.info .val{font-weight:600;font-size:12px}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
th,td{border:1px solid #cbd5e1;padding:5px 8px;font-size:11px;text-align:left;vertical-align:top}
th{background:#f1f5f9;font-weight:700;font-size:10px;text-transform:uppercase}
.right{text-align:right}
.center{text-align:center}
.sign{display:flex;justify-content:space-between;margin-top:42px;font-size:12px}
.sign .col{width:180px;text-align:center}
.sign .line{margin-top:34px;border-top:1px solid #475569;padding-top:4px}
.foot{margin-top:24px;border-top:1px solid #e2e8f0;padding-top:8px;font-size:10px;color:#94a3b8;text-align:center}
.break{page-break-before:always}
</style></head><body>${body}</body></html>`;
}