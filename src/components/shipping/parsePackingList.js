import * as XLSX from "xlsx";

const extractAfter = (cell, prefix) => {
  if (cell == null) return "";
  const s = String(cell).trim();
  const idx = s.toLowerCase().indexOf(prefix.toLowerCase());
  if (idx === -1) return "";
  return s.slice(idx + prefix.length).replace(/^[\s:]+/, "").trim();
};

const HEADER_MAP = [
  { match: "no. koli", key: "no_koli" },
  { match: "description", key: "description" },
  { match: "qty", key: "qty" },
  { match: "satuan gramasi", key: "satuan_gramasi" },
  { match: "total gramasi", key: "total_gramasi" },
  { match: "item unit", key: "item_unit" },
  { match: "notes", key: "notes" },
];

const ALL_KEYS = ["no_koli", "description", "qty", "satuan_gramasi", "total_gramasi", "item_unit", "notes"];

export async function parsePackingListFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheets = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
    if (!aoa.length) continue;

    let headerRow = -1;
    let colMap = {};
    for (let i = 0; i < Math.min(aoa.length, 10); i++) {
      const row = aoa[i] || [];
      const map = {};
      row.forEach((cell, ci) => {
        if (cell == null) return;
        const label = String(cell).trim().toLowerCase();
        const found = HEADER_MAP.find((h) => label === h.match || label.startsWith(h.match));
        if (found && map[found.key] == null) map[found.key] = ci;
      });
      if (map.no_koli != null && map.description != null) { headerRow = i; colMap = map; break; }
    }
    if (headerRow === -1) continue;

    const columns = ALL_KEYS.filter((k) => colMap[k] != null);

    const headerInfo = { ship_to: name, delivery_no: "", ship_via: "", delivery_date: "" };
    for (let i = 0; i < headerRow; i++) {
      for (const cell of (aoa[i] || [])) {
        if (cell == null) continue;
        const s = String(cell);
        const st = extractAfter(s, "Ship To"); if (st) headerInfo.ship_to = st;
        const dn = extractAfter(s, "Delivery No"); if (dn) headerInfo.delivery_no = dn;
        const sv = extractAfter(s, "Ship Via"); if (sv) headerInfo.ship_via = sv;
        const dd = extractAfter(s, "Delivery Date"); if (dd) headerInfo.delivery_date = dd;
      }
    }

    const items = [];
    for (let i = headerRow + 1; i < aoa.length; i++) {
      const r = aoa[i] || [];
      const desc = colMap.description != null ? r[colMap.description] : null;
      if (desc == null || String(desc).trim() === "") continue;
      items.push({
        no_koli: colMap.no_koli != null && r[colMap.no_koli] != null ? String(r[colMap.no_koli]) : "",
        description: String(desc).trim(),
        qty: colMap.qty != null ? Number(r[colMap.qty]) || 0 : 0,
        satuan_gramasi: colMap.satuan_gramasi != null && r[colMap.satuan_gramasi] != null ? String(r[colMap.satuan_gramasi]) : "",
        total_gramasi: colMap.total_gramasi != null ? Number(r[colMap.total_gramasi]) || 0 : 0,
        item_unit: colMap.item_unit != null && r[colMap.item_unit] != null ? String(r[colMap.item_unit]).trim() : "",
        notes: colMap.notes != null && r[colMap.notes] != null ? String(r[colMap.notes]).trim() : "",
      });
    }
    sheets.push({ sheet_name: name, ...headerInfo, columns, items });
  }
  return sheets;
}