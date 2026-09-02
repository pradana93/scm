import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, PackagePlus, Boxes, AlertTriangle, Pencil, Trash2, Search, ArrowLeftRight, History } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/components/shipping/usePermissions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ConfirmDeleteDialog from "@/components/shipping/master/ConfirmDeleteDialog";
import * as XLSX from "xlsx";
import StockImportButton from "@/components/shipping/StockImportButton";
import WarehouseSelect from "@/components/shipping/WarehouseSelect";
import StockAnalysis from "@/components/shipping/StockAnalysis";
import StockMovementDialog from "@/components/shipping/StockMovementDialog";
import StockHistory from "@/components/shipping/StockHistory";
import StockTransactionReviewDialog from "@/components/shipping/StockTransactionReviewDialog";
import { ALL_WAREHOUSES, WAREHOUSES } from "@/components/shipping/shippingUtils";

const today = () => new Date().toISOString().slice(0, 10);
const norm = (s) => (s || "").trim().toLowerCase();
const normKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const parseExcelDate = (value) => {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "number") {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(value).trim();
  if (!s) return "";
  const m1 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m1) return `${m1[1]}-${m1[2].padStart(2, "0")}-${m1[3].padStart(2, "0")}`;
  const m2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
  return s;
};
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export default function Stock() {
  const { can } = usePermissions();
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({ queryKey: ["stockItems"], queryFn: () => base44.entities.StockItem.list() });
  const { data: movements = [] } = useQuery({ queryKey: ["stockMovements"], queryFn: () => base44.entities.StockMovement.list("-created_date", 200) });
  const { data: shipments = [] } = useQuery({ queryKey: ["shipments", "stock"], queryFn: () => base44.entities.Shipment.list("-delivery_date", 500) });
  const { data: master = [] } = useQuery({ queryKey: ["masterPackingItems"], queryFn: () => base44.entities.MasterPackingItem.list() });
  const { data: warehouseList = [] } = useQuery({ queryKey: ["warehouses"], queryFn: () => base44.entities.Warehouse.list() });

  const canManage = can("stock.manage");
  const canIn = can("stock.in");
  const canViewTx = can("stock.transaction");
  const [itemDialog, setItemDialog] = useState(false);
  const [historyItem, setHistoryItem] = useState(null);
  const [wh, setWh] = useState(ALL_WAREHOUSES);
  const [stockDate, setStockDate] = useState(today());
  const [whCtrl, setWhCtrl] = useState("");
  const destWarehouses = useMemo(() => (warehouseList.length ? warehouseList.map((w) => w.name) : WAREHOUSES).filter((w) => w !== whCtrl).slice().sort((a, b) => a.localeCompare(b, "id")), [warehouseList, whCtrl]);
  const [tab, setTab] = useState("items");
  const [ctrlOpen, setCtrlOpen] = useState(false);
  const [ctrlRows, setCtrlRows] = useState([]);
  const [ctrlType, setCtrlType] = useState("masuk");
  const [whCtrlTo, setWhCtrlTo] = useState("");
  const blankRow = () => ({ itemId: "", qty: "", date: today(), note: "" });
  const [confirmId, setConfirmId] = useState(null);
  const [txPreview, setTxPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [fName, setFName] = useState("");
  const [fCode, setFCode] = useState("");
  const [fUnit, setFUnit] = useState("");
  const [fMin, setFMin] = useState("");
  const [fCat, setFCat] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["stockItems"] });
    qc.invalidateQueries({ queryKey: ["stockMovements"] });
  };

  // Auto-sync daftar barang dari item pada pengiriman (menggabungkan master barang)
  useEffect(() => {
    if (isLoading) return;
    const existing = new Set(items.map((o) => normKey(o.name)));
    const masterMap = new Map();
    for (const m of master) if (m && m.name) masterMap.set(normKey(m.name), m);
    const missing = [];
    const seen = new Set();
    for (const s of shipments) {
      for (const it of (Array.isArray(s.do_items) ? s.do_items : [])) {
        const nm = String(it?.name || "").trim();
        if (!nm) continue;
        const k = normKey(nm);
        if (existing.has(k) || seen.has(k)) continue;
        seen.add(k);
        const m = masterMap.get(k);
        const unit = m?.satuan || String(it?.unit || "").trim() || "";
        missing.push({ name: nm, unit });
      }
    }
    if (!missing.length) return;
    let cancelled = false;
    base44.entities.StockItem.bulkCreate(missing).then(() => { if (!cancelled) refresh(); }).catch(() => {});
    return () => { cancelled = true; };
  }, [items, shipments, isLoading, master]);

  const getCurrentMap = (warehouse, asOfDate) => {
    const masukMap = new Map();
    for (const m of movements) {
      if (m.type !== "masuk") continue;
      if (!(warehouse === ALL_WAREHOUSES || !m.warehouse || m.warehouse === warehouse)) continue;
      const mDate = m.date || (m.created_date || "").slice(0, 10);
      if (asOfDate && mDate > asOfDate) continue;
      const k = norm(m.item_name);
      if (!k) continue;
      masukMap.set(k, (masukMap.get(k) || 0) + Number(m.quantity || 0));
    }
    const keluarMap = new Map();
    for (const s of shipments) {
      if (s.status !== "sudah_dikirim") continue;
      if (!(warehouse === ALL_WAREHOUSES || s.warehouse === warehouse)) continue;
      if (asOfDate && (s.delivery_date || "") > asOfDate) continue;
      for (const it of (Array.isArray(s.do_items) ? s.do_items : [])) {
        const k = norm(it.name);
        if (!k) continue;
        keluarMap.set(k, (keluarMap.get(k) || 0) + Number(it.quantity || 0));
      }
    }
    for (const m of movements) {
      if (m.type !== "keluar") continue;
      if (!(warehouse === ALL_WAREHOUSES || !m.warehouse || m.warehouse === warehouse)) continue;
      const mDate = m.date || (m.created_date || "").slice(0, 10);
      if (asOfDate && mDate > asOfDate) continue;
      const k = norm(m.item_name);
      if (!k) continue;
      keluarMap.set(k, (keluarMap.get(k) || 0) + Number(m.quantity || 0));
    }
    return { masukMap, keluarMap };
  };
  const rows = useMemo(() => {
    const { masukMap, keluarMap } = getCurrentMap(wh, stockDate);
    const seen = new Map();
    for (const it of items) {
      const k = norm(it.name);
      if (!k) continue;
      const masuk = masukMap.get(k) || 0;
      const keluar = keluarMap.get(k) || 0;
      const current = masuk - keluar;
      const min = Number(it.min_stock || 0);
      if (seen.has(k)) {
        const prev = seen.get(k);
        prev.min_stock = Math.max(prev.min_stock || 0, min);
      } else {
        seen.set(k, { ...it, masuk, keluar, current, low: current < min, min_stock: min });
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [items, movements, shipments, wh, stockDate]);
  const ctrlStock = useMemo(() => getCurrentMap(whCtrl || ALL_WAREHOUSES), [whCtrl, movements, shipments]);
  const currentFor = (name) => { const k = norm(name); return (ctrlStock.masukMap.get(k) || 0) - (ctrlStock.keluarMap.get(k) || 0); };

  const openAdd = () => {
    setEditing(null);
    setFName(""); setFCode(""); setFUnit(""); setFMin(""); setFCat("");
    setItemDialog(true);
  };
  const openEdit = (it) => {
    setEditing(it);
    setFName(it.name || ""); setFCode(it.code || ""); setFUnit(it.unit || ""); setFMin(String(it.min_stock ?? "")); setFCat(it.category || "");
    setItemDialog(true);
  };

  const saveItem = async () => {
    if (!fName.trim()) return;
    setBusy(true);
    try {
      const payload = { name: fName.trim(), code: fCode.trim(), unit: fUnit.trim(), min_stock: Number(fMin) || 0, category: fCat.trim() };
      if (editing) await base44.entities.StockItem.update(editing.id, payload);
      else await base44.entities.StockItem.create(payload);
      setItemDialog(false);
      refresh();
    } finally { setBusy(false); }
  };

  const removeItem = async () => {
    const id = confirmId;
    setConfirmId(null);
    if (!id) return;
    setBusy(true);
    try { await base44.entities.StockItem.delete(id); refresh(); } finally { setBusy(false); }
  };

  const openCtrl = () => { setCtrlRows([blankRow()]); setWhCtrl(wh === ALL_WAREHOUSES ? "" : wh); setCtrlType("masuk"); setWhCtrlTo(""); setCtrlOpen(true); };
  const onSourceWhChange = (v) => { setWhCtrl(v); if (v === whCtrlTo) setWhCtrlTo(""); };
  const addCtrlRow = () => setCtrlRows((p) => [...p, blankRow()]);
  const removeCtrlRow = (i) => setCtrlRows((p) => p.filter((_, idx) => idx !== i));
  const setCtrlField = (i, field, value) => setCtrlRows((p) => p.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  const submitCtrl = async () => {
    const valid = ctrlRows.filter((r) => r.itemId && Number(r.qty) > 0);
    if (!valid.length) return;
    if (ctrlType === "transfer" && (!whCtrl || !whCtrlTo || whCtrl === whCtrlTo)) return;
    setBusy(true);
    try {
      const payload = [];
      for (const r of valid) {
        const it = items.find((i) => i.id === r.itemId);
        const name = it?.name || "";
        const unit = it?.unit || "";
        const qty = Number(r.qty);
        const date = r.date || today();
        const note = r.note.trim();
        if (ctrlType === "transfer") {
          payload.push({ item_name: name, type: "keluar", quantity: qty, unit, note: `Transfer ke ${whCtrlTo}${note ? " - " + note : ""}`, reference: "transfer", date, warehouse: whCtrl });
          payload.push({ item_name: name, type: "masuk", quantity: qty, unit, note: `Transfer dari ${whCtrl}${note ? " - " + note : ""}`, reference: "transfer", date, warehouse: whCtrlTo });
        } else {
          payload.push({ item_name: name, type: ctrlType, quantity: qty, unit, note, reference: "manual", date, warehouse: whCtrl });
        }
      }
      await base44.entities.StockMovement.bulkCreate(payload);
      setCtrlOpen(false);
      setCtrlRows([]);
      refresh();
    } finally { setBusy(false); }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([["Nama Barang", "Kode", "Satuan", "Min Stok", "Kategori"], ["Contoh Barang", "BRG001", "sak", 10, "Sembako"]]);
    ws["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Barang");
    XLSX.writeFile(wb, "template-import-barang.xlsx");
  };

  const downloadTransactionTemplate = () => {
    const wb = XLSX.utils.book_new();
    const cols = (c) => c.map(() => ({ wch: 18 }));
    const wsMasuk = XLSX.utils.aoa_to_sheet([["Tanggal", "Gudang", "Nama Barang", "Jumlah", "Satuan", "Keterangan"], ["2026-01-01", "Gudang Jakarta", "Tepung Terigu", 100, "sak", "Pembelian"]]);
    wsMasuk["!cols"] = cols([0, 0, 0, 0, 0, 0]);
    XLSX.utils.book_append_sheet(wb, wsMasuk, "Stock Masuk");
    const wsKeluar = XLSX.utils.aoa_to_sheet([["Tanggal", "Gudang", "Nama Barang", "Jumlah", "Satuan", "Keterangan"], ["2026-01-01", "Gudang Jakarta", "Tepung Terigu", 20, "sak", "Pemakaian internal"]]);
    wsKeluar["!cols"] = cols([0, 0, 0, 0, 0, 0]);
    XLSX.utils.book_append_sheet(wb, wsKeluar, "Stock Keluar");
    const wsTransfer = XLSX.utils.aoa_to_sheet([["Tanggal", "Gudang Asal", "Gudang Tujuan", "Nama Barang", "Jumlah", "Satuan", "Keterangan"], ["2026-01-01", "Gudang Jakarta", "Gudang Surabaya", "Tepung Terigu", 50, "sak", "Mutasi antar gudang"]]);
    wsTransfer["!cols"] = cols([0, 0, 0, 0, 0, 0, 0]);
    XLSX.utils.book_append_sheet(wb, wsTransfer, "Transfer Stock");
    XLSX.writeFile(wb, "template-transaksi-stok.xlsx");
  };

  const handleImport = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const existing = new Set(items.map((o) => normKey(o.name)));
      const toCreate = [];
      for (const row of data) {
        const name = String(row["Nama Barang"] || row["name"] || row["Nama"] || "").trim();
        if (!name || existing.has(normKey(name))) continue;
        existing.add(normKey(name));
        toCreate.push({
          name,
          code: String(row["Kode"] || row["code"] || "").trim(),
          unit: String(row["Satuan"] || row["satuan"] || row["unit"] || "").trim(),
          min_stock: Number(row["Min Stok"] || row["min_stock"] || row["Min"] || 0) || 0,
          category: String(row["Kategori"] || row["category"] || "").trim(),
        });
      }
      if (toCreate.length) await base44.entities.StockItem.bulkCreate(toCreate);
      refresh();
      alert(toCreate.length ? `${toCreate.length} barang berhasil diimpor.` : "Tidak ada barang baru untuk diimpor.");
    } catch {
      alert("Gagal mengimpor file. Pastikan format sesuai template.");
    } finally { setBusy(false); }
  };

  const handleImportTransaction = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const preview = [];
      const readSheet = (sheetName, type) => {
        const ws = wb.Sheets[sheetName];
        if (!ws) return;
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        for (const row of rows) {
          const name = String(row["Nama Barang"] || "").trim();
          if (!name) continue;
          const qty = Number(row["Jumlah"] || 0);
          if (!qty) continue;
          const date = parseExcelDate(row["Tanggal"]) || today();
          const unit = String(row["Satuan"] || "").trim();
          const note = String(row["Keterangan"] || "").trim();
          if (type === "transfer") {
            const from = String(row["Gudang Asal"] || "").trim();
            const to = String(row["Gudang Tujuan"] || "").trim();
            if (!from || !to || from === to) continue;
            preview.push({ item_name: name, type: "transfer", quantity: qty, unit, note, date, warehouse: from, transferTo: to });
          } else {
            const wh = String(row["Gudang"] || "").trim();
            if (!wh) continue;
            preview.push({ item_name: name, type, quantity: qty, unit, note, date, warehouse: wh });
          }
        }
      };
      readSheet("Stock Masuk", "masuk");
      readSheet("Stock Keluar", "keluar");
      readSheet("Transfer Stock", "transfer");
      setTxPreview(preview);
    } catch {
      alert("Gagal mengimpor file. Pastikan format sesuai template transaksi.");
    } finally { setBusy(false); }
  };

  const submitTxPreview = async (rows) => {
    if (!rows?.length) return;
    setBusy(true);
    try {
      const payload = [];
      for (const r of rows) {
        if (r.type === "transfer") {
          payload.push({ item_name: r.item_name, type: "keluar", quantity: r.quantity, unit: r.unit, note: `Transfer ke ${r.transferTo}${r.note ? " - " + r.note : ""}`, reference: "transfer", date: r.date, warehouse: r.warehouse });
          payload.push({ item_name: r.item_name, type: "masuk", quantity: r.quantity, unit: r.unit, note: `Transfer dari ${r.warehouse}${r.note ? " - " + r.note : ""}`, reference: "transfer", date: r.date, warehouse: r.transferTo });
        } else {
          payload.push({ item_name: r.item_name, type: r.type, quantity: r.quantity, unit: r.unit, note: r.note, reference: "import", date: r.date, warehouse: r.warehouse });
        }
      }
      await base44.entities.StockMovement.bulkCreate(payload);
      setTxPreview(null);
      refresh();
      alert(`${payload.length} transaksi berhasil diproses.`);
    } catch {
      alert("Gagal memproses transaksi.");
    } finally { setBusy(false); }
  };

  const q = search.trim().toLowerCase();
  const filtered = rows.filter((r) => !q || String(r.name || "").toLowerCase().includes(q) || String(r.code || "").toLowerCase().includes(q));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-indigo-600">Inventory</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Stock Control</h1>
          <p className="mt-2 text-sm text-slate-500">Kelola daftar barang dan stok. Stok bertambah saat input masuk dan berkurang otomatis saat pengiriman berstatus Sudah Dikirim, sesuai gudang terkait.</p>
        </div>
        <div className="flex gap-2">
          {canManage && <StockImportButton label="Tambah Barang" icon={<Plus className="h-4 w-4" />} onMainClick={openAdd} onImport={handleImport} onDownloadTemplate={downloadTemplate} disabled={busy} />}
          {canIn && <StockImportButton label="Buat Transaksi" icon={<PackagePlus className="h-4 w-4" />} variant="primary" onMainClick={openCtrl} onImport={handleImportTransaction} onDownloadTemplate={downloadTransactionTemplate} disabled={busy} importLabel="Import Transaksi (.xlsx)" templateLabel="Download Template (.xlsx)" />}
        </div>
      </div>

      <div className="mb-4 inline-flex rounded-xl border border-slate-200 bg-white p-1">
        <button onClick={() => setTab("items")} className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${tab === "items" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>Daftar Barang</button>
        <button onClick={() => setTab("analysis")} className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${tab === "analysis" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>Analisis Stock</button>
        {canViewTx && <button onClick={() => setTab("riwayat")} className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${tab === "riwayat" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}><History className="h-3.5 w-3.5" />Riwayat</button>}
      </div>
      {tab !== "riwayat" && (
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <WarehouseSelect value={wh} onChange={setWh} className="w-full sm:w-[220px]" includeAll />
        <label className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Kondisi per</span>
          <input type="date" value={stockDate} onChange={(e) => setStockDate(e.target.value || today())} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
        </label>
        {tab === "items" && <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama atau kode barang..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
        </div>}
      </div>
      )}

      {tab === "riwayat" ? (
        <StockHistory />
      ) : tab === "analysis" ? (
        <StockAnalysis rows={rows} movements={movements} shipments={shipments} wh={wh} asOfDate={stockDate} />
      ) : isLoading ? (
        <div className="flex justify-center py-16"><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <Boxes className="h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">Belum ada data barang. {canManage && "Klik Tambah Barang untuk memulai."}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <div key={r.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <button type="button" onClick={() => setHistoryItem(r)} className="flex flex-col text-left transition hover:bg-slate-50/60 -mx-1 -mt-1 px-1 pt-1 rounded-xl">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">{r.name}</p>
                    <p className="text-xs text-slate-400">{r.code || "tanpa kode"} · {r.category || "-"}</p>
                  </div>
                  {r.low && <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600"><AlertTriangle className="h-3 w-3" />Menipis</span>}
                </div>
                <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{Number(r.current).toLocaleString("id-ID")} <span className="text-sm font-medium text-slate-400">{r.unit || ""}</span></p>
                <div className="mt-3 flex items-center gap-3 text-xs">
                  <span className="text-emerald-600">+{Number(r.masuk).toLocaleString("id-ID")} masuk</span>
                  <span className="text-rose-500">-{Number(r.keluar).toLocaleString("id-ID")} keluar</span>
                  <span className="ml-auto text-slate-400">min {Number(r.min_stock || 0).toLocaleString("id-ID")}</span>
                </div>
                <p className="mt-1.5 text-[11px] font-medium text-indigo-500">Klik untuk lihat riwayat pergerakan →</p>
              </button>
              {canManage && (
                <div className="mt-3 flex items-center justify-end gap-1 border-t border-slate-100 pt-2">
                  <button onClick={() => openEdit(r)} disabled={busy} className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setConfirmId(r.id)} disabled={busy} className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50" title="Hapus"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={itemDialog} onOpenChange={(o) => !o && setItemDialog(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Barang" : "Tambah Barang"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium">Nama Barang<input value={fName} onChange={(e) => setFName(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="Nama barang" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium">Kode<input value={fCode} onChange={(e) => setFCode(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="Kode" /></label>
              <label className="text-sm font-medium">Satuan<input value={fUnit} onChange={(e) => setFUnit(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="kg, pcs, dll" /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium">Min Stok<input type="number" min="0" value={fMin} onChange={(e) => setFMin(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="0" /></label>
              <label className="text-sm font-medium">Kategori<input value={fCat} onChange={(e) => setFCat(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="Kategori" /></label>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setItemDialog(false)}>Batal</Button><Button onClick={saveItem} disabled={busy || !fName.trim()}>{busy ? "Menyimpan..." : "Simpan"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ctrlOpen} onOpenChange={(o) => !o && setCtrlOpen(false)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Buat Transaksi</DialogTitle></DialogHeader>
          <p className="-mt-2 text-xs text-slate-500">Tambah, kurangi, atau transfer stok untuk satu atau beberapa barang sekaligus.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">Gudang<div className="mt-1.5"><WarehouseSelect value={whCtrl} onChange={onSourceWhChange} className="w-full" /></div></label>
            <label className="block text-sm font-medium">Tipe<select value={ctrlType} onChange={(e) => setCtrlType(e.target.value)} className={`mt-1.5 w-full ${inputClass}`}><option value="masuk">Stok Masuk</option><option value="keluar">Stok Keluar</option><option value="transfer">Transfer Stock</option></select></label>
            {ctrlType === "transfer" && <label className="block text-sm font-medium sm:col-span-2">Gudang Tujuan<div className="mt-1.5"><select value={whCtrlTo} onChange={(e) => setWhCtrlTo(e.target.value)} className={`w-full ${inputClass}`} disabled={!whCtrl}><option value="" disabled>Pilih gudang tujuan</option>{destWarehouses.map((w) => <option key={w} value={w}>{w}</option>)}</select></div></label>}
          </div>
          {ctrlType === "transfer" && <p className="-mt-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">Transfer akan mengurangi stok dari <b>{whCtrl || "gudang asal"}</b> dan menambah stok ke <b>{whCtrlTo || "gudang tujuan"}</b>.</p>}
          <div className="max-h-[50vh] space-y-3 overflow-y-auto">
            {ctrlRows.map((row, i) => {
              const sel = items.find((it) => it.id === row.itemId);
              return (
                <div key={i} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <select value={row.itemId} onChange={(e) => setCtrlField(i, "itemId", e.target.value)} className={`flex-1 ${inputClass}`}>
                      <option value="" disabled>Pilih barang</option>
                      {rows.map((it) => <option key={it.id} value={it.id}>{it.name} — Stok: {Number(currentFor(it.name)).toLocaleString("id-ID")} {it.unit || ""}</option>)}
                    </select>
                    {ctrlRows.length > 1 && <button type="button" onClick={() => removeCtrlRow(i)} className="rounded-lg p-2 text-red-600 transition hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                  {row.itemId && <p className="mt-1 text-xs text-slate-500">Stok saat ini (gudang {whCtrl || "Semua"}): <span className="font-semibold text-slate-700">{Number(currentFor(sel?.name || "")).toLocaleString("id-ID")} {sel?.unit || ""}</span></p>}
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <label className="text-xs font-medium">Jumlah<input type="number" min="0" value={row.qty} onChange={(e) => setCtrlField(i, "qty", e.target.value)} className={`mt-1 ${inputClass}`} placeholder="0" /></label>
                    <label className="text-xs font-medium">Satuan<input value={sel?.unit || ""} readOnly className={`mt-1 ${inputClass} bg-slate-50 text-slate-500`} placeholder="-" /></label>
                    <label className="text-xs font-medium">Tanggal<input type="date" value={row.date} onChange={(e) => setCtrlField(i, "date", e.target.value)} className={`mt-1 ${inputClass}`} /></label>
                  </div>
                  <label className="mt-2 block text-xs font-medium">Keterangan<input value={row.note} onChange={(e) => setCtrlField(i, "note", e.target.value)} className={`mt-1 ${inputClass}`} placeholder="Catatan (opsional)" /></label>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={addCtrlRow} className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"><Plus className="h-4 w-4" />Tambah Baris</button>
          <DialogFooter><Button variant="outline" onClick={() => setCtrlOpen(false)}>Batal</Button><Button onClick={submitCtrl} disabled={busy || !whCtrl || (ctrlType === "transfer" && (!whCtrlTo || whCtrlTo === whCtrl)) || !ctrlRows.some((r) => r.itemId && Number(r.qty) > 0)}>{busy ? "Menyimpan..." : "Simpan"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog open={!!confirmId} onClose={() => setConfirmId(null)} onConfirm={removeItem} />

      <StockMovementDialog open={!!historyItem} onClose={() => setHistoryItem(null)} itemName={historyItem?.name || ""} warehouse={wh} asOfDate={stockDate} />
      <StockTransactionReviewDialog open={!!txPreview} rows={txPreview || []} onClose={() => setTxPreview(null)} onSubmit={submitTxPreview} />
    </div>
  );
}