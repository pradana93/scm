import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ArrowLeftRight, History } from "lucide-react";
import { dataClient as base44 } from "@/api/dataClient";
import WarehouseSelect from "@/components/shipping/WarehouseSelect";
import { ALL_WAREHOUSES } from "@/components/shipping/shippingUtils";

const norm = (s) => (s || "").trim().toLowerCase();
const today = () => new Date().toISOString().slice(0, 10);
const formatDate = (v) => { if (!v) return "-"; try { const d = new Date(v.length <= 10 ? v + "T00:00:00" : v); return isNaN(d.getTime()) ? v : d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }); } catch { return v; } };
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export default function StockHistory() {
  const { data: movements = [], isLoading } = useQuery({ queryKey: ["stockMovements"], queryFn: () => base44.entities.StockMovement.list("-created_date", 500) });
  const { data: shipments = [] } = useQuery({ queryKey: ["shipments", "stock"], queryFn: () => base44.entities.Shipment.list("-delivery_date", 500) });
  const { data: items = [] } = useQuery({ queryKey: ["stockItems"], queryFn: () => base44.entities.StockItem.list() });
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => base44.entities.User.list() });

  const userMap = useMemo(() => { const m = new Map(); for (const u of users) m.set(u.id, u.full_name || u.email || "-"); return m; }, [users]);
  const unitMap = useMemo(() => { const m = new Map(); for (const it of items) m.set(norm(it.name), it.unit || ""); return m; }, [items]);
  const dedupItems = useMemo(() => { const seen = new Map(); for (const it of items) { const k = norm(it.name); if (!seen.has(k)) seen.set(k, it); } return [...seen.values()]; }, [items]);

  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(today());
  const [wh, setWh] = useState(ALL_WAREHOUSES);
  const [typeFilter, setTypeFilter] = useState("all");
  const [itemFilter, setItemFilter] = useState("all");
  const [search, setSearch] = useState("");

  const allTx = useMemo(() => {
    const list = [];
    for (const m of movements) {
      const isTransfer = m.reference === "transfer";
      const isImport = m.reference === "import";
      list.push({
        id: m.id,
        date: m.date || (m.created_date || "").slice(0, 10),
        itemKey: norm(m.item_name),
        itemName: m.item_name || "",
        type: isTransfer ? "transfer" : m.type,
        rawType: m.type,
        qty: Number(m.quantity || 0),
        warehouse: m.warehouse || "",
        note: m.note || "",
        by: isImport ? `Import by ${userMap.get(m.created_by_id) || "-"}` : (userMap.get(m.created_by_id) || "-"),
        ts: m.created_date || "",
      });
    }
    for (const s of shipments) {
      if (s.status !== "sudah_dikirim") continue;
      for (const it of (Array.isArray(s.do_items) ? s.do_items : [])) {
        list.push({
          id: `s-${s.id}-${it.name}`,
          date: s.delivery_date || "",
          itemKey: norm(it.name),
          itemName: it.name || "",
          type: "keluar",
          rawType: "keluar",
          qty: Number(it.quantity || 0),
          warehouse: s.warehouse || "",
          note: `${s.outlet_name || "-"} · ${s.do_number || ""}`,
          by: "-",
          ts: s.updated_date || "",
        });
      }
    }
    return list;
  }, [movements, shipments, userMap]);

  const withSaldo = useMemo(() => {
    let list = allTx;
    if (wh !== ALL_WAREHOUSES) list = list.filter((tx) => !tx.warehouse || tx.warehouse === wh);
    list = [...list].sort((a, b) => {
      const dc = String(a.date || "").localeCompare(String(b.date || ""));
      if (dc !== 0) return dc;
      return String(a.ts || "").localeCompare(String(b.ts || ""));
    });
    const balanceMap = new Map();
    for (const tx of list) {
      const k = tx.itemKey;
      const current = balanceMap.get(k) || 0;
      if (tx.rawType === "masuk") balanceMap.set(k, current + tx.qty);
      else balanceMap.set(k, current - tx.qty);
      tx.saldo = balanceMap.get(k);
    }
    return list;
  }, [allTx, wh]);

  const rows = useMemo(() => {
    let list = withSaldo;
    if (dateFrom) list = list.filter((tx) => (tx.date || "") >= dateFrom);
    if (dateTo) list = list.filter((tx) => (tx.date || "") <= dateTo);
    if (typeFilter !== "all") {
      if (typeFilter === "transfer") list = list.filter((tx) => tx.type === "transfer");
      else list = list.filter((tx) => tx.type === typeFilter);
    }
    if (itemFilter !== "all") list = list.filter((tx) => tx.itemKey === norm(itemFilter));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((tx) => tx.itemName.toLowerCase().includes(q) || (tx.note || "").toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const dc = String(b.date || "").localeCompare(String(a.date || ""));
      if (dc !== 0) return dc;
      return String(b.ts || "").localeCompare(String(a.ts || ""));
    });
  }, [withSaldo, dateFrom, dateTo, typeFilter, itemFilter, search]);

  const openingBalances = useMemo(() => {
    if (!dateFrom) return new Map();
    const before = withSaldo.filter((tx) => (tx.date || "") < dateFrom);
    const map = new Map();
    for (const tx of before) map.set(tx.itemKey, tx.saldo);
    return map;
  }, [withSaldo, dateFrom]);

  const totalIn = rows.filter((r) => r.rawType === "masuk").reduce((s, r) => s + r.qty, 0);
  const totalOut = rows.filter((r) => r.rawType === "keluar").reduce((s, r) => s + r.qty, 0);
  const uniqueItems = new Set(rows.map((r) => r.itemKey)).size;

  const selectedItemName = itemFilter !== "all" ? itemFilter : null;
  const selectedUnit = selectedItemName ? (unitMap.get(norm(selectedItemName)) || "") : null;
  const openingBalance = selectedItemName ? (openingBalances.get(norm(selectedItemName)) || 0) : null;
  const closingBalance = selectedItemName ? (rows.length > 0 ? rows[0].saldo : openingBalance) : null;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`${inputClass} w-auto`} />
          <span className="text-slate-400 text-sm">s/d</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`${inputClass} w-auto`} />
        </div>
        <WarehouseSelect value={wh} onChange={setWh} className="w-full lg:w-[200px]" includeAll />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={`w-full lg:w-[160px] ${inputClass}`}>
          <option value="all">Semua Tipe</option>
          <option value="masuk">Stok Masuk</option>
          <option value="keluar">Stok Keluar</option>
          <option value="transfer">Transfer</option>
        </select>
        <select value={itemFilter} onChange={(e) => setItemFilter(e.target.value)} className={`w-full lg:w-[200px] ${inputClass}`}>
          <option value="all">Semua Barang</option>
          {dedupItems.map((it) => <option key={it.id} value={it.name}>{it.name}</option>)}
        </select>
        <div className="relative flex-1 min-w-[140px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari barang atau keterangan..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
        </div>
      </div>

      {selectedItemName ? (
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-xs text-slate-500">Saldo Awal</p>
            <p className="text-[11px] text-slate-400">per {formatDate(dateFrom)}</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{Number(openingBalance).toLocaleString("id-ID")} <span className="text-sm font-medium text-slate-400">{selectedUnit}</span></p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-xs text-slate-500">Pergerakan</p>
            <p className="text-[11px] text-slate-400">{rows.length} transaksi</p>
            <p className="mt-1 text-sm font-semibold text-emerald-600">+{Number(totalIn).toLocaleString("id-ID")} masuk</p>
            <p className="text-sm font-semibold text-rose-600">-{Number(totalOut).toLocaleString("id-ID")} keluar</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-xs text-slate-500">Saldo Akhir</p>
            <p className="text-[11px] text-slate-400">per {formatDate(dateTo)}</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{Number(closingBalance).toLocaleString("id-ID")} <span className="text-sm font-medium text-slate-400">{selectedUnit}</span></p>
          </div>
        </div>
      ) : (
        <div className="mb-3 flex flex-wrap items-center gap-4 text-sm">
          <span className="text-slate-500">{rows.length} transaksi · {uniqueItems} barang</span>
          <span className="font-semibold text-emerald-600">+{Number(totalIn).toLocaleString("id-ID")} masuk</span>
          <span className="font-semibold text-rose-600">-{Number(totalOut).toLocaleString("id-ID")} keluar</span>
        </div>
      )}

      {isLoading ? <div className="flex justify-center py-12"><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div> :
        rows.length === 0 ? <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center"><History className="h-8 w-8 text-slate-300" /><p className="mt-3 text-sm text-slate-500">Belum ada pergerakan sesuai filter.</p></div> :
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3 whitespace-nowrap">Tanggal</th>
                  <th className="px-3 py-3">Barang</th>
                  <th className="px-3 py-3">Tipe</th>
                  <th className="px-3 py-3">Gudang</th>
                  <th className="px-3 py-3 text-right">Masuk</th>
                  <th className="px-3 py-3 text-right">Keluar</th>
                  <th className="px-3 py-3 text-right">Saldo</th>
                  <th className="px-3 py-3">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const unit = unitMap.get(r.itemKey) || "";
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{formatDate(r.date)}</td>
                      <td className="px-3 py-3 font-medium text-slate-700">{r.itemName}{unit && <span className="ml-1 text-xs text-slate-400">{unit}</span>}</td>
                      <td className="px-3 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.type === "masuk" ? "bg-emerald-50 text-emerald-700" : r.type === "transfer" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-600"}`}>{r.type === "masuk" ? "Masuk" : r.type === "transfer" ? "Transfer" : "Keluar"}</span></td>
                      <td className="px-3 py-3 text-slate-600">{r.warehouse || "-"}</td>
                      <td className="px-3 py-3 text-right font-semibold text-emerald-600">{r.rawType === "masuk" ? `+${Number(r.qty).toLocaleString("id-ID")}` : "-"}</td>
                      <td className="px-3 py-3 text-right font-semibold text-rose-600">{r.rawType === "keluar" ? `-${Number(r.qty).toLocaleString("id-ID")}` : "-"}</td>
                      <td className="px-3 py-3 text-right font-bold text-slate-800">{Number(r.saldo).toLocaleString("id-ID")}</td>
                      <td className="px-3 py-3 text-slate-500 max-w-[200px] truncate" title={r.note}>{r.note || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>}
    </div>
  );
}