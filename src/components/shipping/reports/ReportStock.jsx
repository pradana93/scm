import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const norm = (s) => (s || "").trim().toLowerCase();

export default function ReportStock({ shipments, warehouse, dateFrom, dateTo }) {
  const [selected, setSelected] = useState(null);
  const { data: items = [], isLoading } = useQuery({ queryKey: ["stockItems"], queryFn: () => base44.entities.StockItem.list() });
  const { data: movements = [] } = useQuery({ queryKey: ["stockMovements"], queryFn: () => base44.entities.StockMovement.list("-created_date", 500) });
  const { data: allShipments = [] } = useQuery({ queryKey: ["shipments", "stockReport", "all"], queryFn: () => base44.entities.Shipment.list("-delivery_date", 500) });

  const inRange = (d) => (!dateFrom || (d || "") >= dateFrom) && (!dateTo || (d || "") <= dateTo);
  const whOk = (mwh) => !warehouse || !mwh || mwh === warehouse;
  const whLabel = warehouse || "Semua Gudang";

  const rows = useMemo(() => {
    const masukAll = new Map();
    for (const m of movements) {
      if (m.type !== "masuk" || !whOk(m.warehouse)) continue;
      const mDate = m.date || (m.created_date || "").slice(0, 10);
      if (dateTo && mDate > dateTo) continue;
      const k = norm(m.item_name);
      if (!k) continue;
      masukAll.set(k, (masukAll.get(k) || 0) + Number(m.quantity || 0));
    }
    const keluarAll = new Map();
    for (const s of allShipments) {
      if (s.status !== "sudah_dikirim") continue;
      if (warehouse && s.warehouse !== warehouse) continue;
      if (dateTo && (s.delivery_date || "") > dateTo) continue;
      for (const it of (Array.isArray(s.do_items) ? s.do_items : [])) {
        const k = norm(it.name);
        if (!k) continue;
        keluarAll.set(k, (keluarAll.get(k) || 0) + Number(it.quantity || 0));
      }
    }
    for (const m of movements) {
      if (m.type !== "keluar" || !whOk(m.warehouse)) continue;
      const mDate = m.date || (m.created_date || "").slice(0, 10);
      if (dateTo && mDate > dateTo) continue;
      const k = norm(m.item_name);
      if (!k) continue;
      keluarAll.set(k, (keluarAll.get(k) || 0) + Number(m.quantity || 0));
    }
    return items
      .map((it) => {
        const k = norm(it.name);
        const masuk = masukAll.get(k) || 0;
        const keluar = keluarAll.get(k) || 0;
        return { id: it.id, name: it.name, unit: it.unit || "", available: masuk - keluar };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [items, movements, allShipments, warehouse, dateTo]);

  const historyFor = (item) => {
    const k = norm(item.name);
    const ins = movements
      .filter((m) => m.type === "masuk" && whOk(m.warehouse) && norm(m.item_name) === k && inRange(m.date || (m.created_date || "").slice(0, 10)))
      .map((m) => ({ date: m.date || (m.created_date || "").slice(0, 10), type: "Masuk", qty: Number(m.quantity || 0), note: m.note || "Stok masuk" }));
    const outs = [];
    for (const s of shipments) {
      if (s.status !== "sudah_dikirim") continue;
      for (const it of (Array.isArray(s.do_items) ? s.do_items : [])) {
        if (norm(it.name) === k) outs.push({ date: s.delivery_date || "", type: "Keluar", qty: Number(it.quantity || 0), note: `${s.outlet_name || "-"} · ${s.do_number || ""}` });
      }
    }
    for (const m of movements) {
      if (m.type === "keluar" && whOk(m.warehouse) && norm(m.item_name) === k && inRange(m.date || (m.created_date || "").slice(0, 10))) {
        outs.push({ date: m.date || (m.created_date || "").slice(0, 10), type: "Keluar", qty: Number(m.quantity || 0), note: m.note || "Stok keluar (manual)" });
      }
    }
    return [...ins, ...outs].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  };

  const selectedItem = selected ? rows.find((r) => r.id === selected) : null;
  const selectedHistory = selectedItem ? historyFor(selectedItem) : [];

  const downloadItem = (item) => {
    const h = historyFor(item);
    const titleRows = [[`History Stok - ${item.name}`], [`Gudang: ${whLabel}`], [`Periode: ${dateFrom || "-"} s/d ${dateTo || "-"}`], [], ["Tanggal", "Tipe", "Kuantitas", "Satuan", "Keterangan"]];
    const data = h.map((x) => [x.date, x.type, x.qty, item.unit || "", x.note]);
    const ws = XLSX.utils.aoa_to_sheet([...titleRows, ...data]);
    ws["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "History");
    XLSX.writeFile(wb, `history-stok-${String(item.name).replace(/[^\w-]/g, "_")}.xlsx`);
  };

  const downloadAll = () => {
    const titleRows = [["Rekap Stok Barang"], [`Gudang: ${whLabel}`], [`Saldo per: ${dateTo || "semua tanggal"}`], [`Dibuat: ${new Date().toLocaleString("id-ID")}`], [], ["No", "Nama Stock", "Satuan", "Kuantitas Tersedia"]];
    const data = rows.map((r, i) => [i + 1, r.name, r.unit || "-", Number(r.available).toLocaleString("id-ID")]);
    const ws = XLSX.utils.aoa_to_sheet([...titleRows, ...data]);
    ws["!cols"] = [{ wch: 6 }, { wch: 28 }, { wch: 12 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Stok");
    XLSX.writeFile(wb, "rekap-stok-barang.xlsx");
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">{rows.length} barang · Gudang: {whLabel}{dateTo ? ` · Saldo per ${dateTo}` : ""}</p>
        <button onClick={downloadAll} disabled={!rows.length} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"><Download className="h-4 w-4" />Download Rekap Stok</button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-10"><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">Tidak ada data stok.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Nama Stock</th>
                <th className="px-4 py-3">Satuan</th>
                <th className="px-4 py-3 text-right">Kuantitas Tersedia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="cursor-pointer transition hover:bg-indigo-50/40" onClick={() => setSelected(r.id)}>
                  <td className="px-4 py-3 font-medium text-indigo-700">{r.name}</td>
                  <td className="px-4 py-3 text-slate-500">{r.unit || "-"}</td>
                  <td className="px-4 py-3 text-right font-semibold">{Number(r.available).toLocaleString("id-ID")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>History Stok · {selectedItem?.name}</DialogTitle></DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">Gudang: {whLabel} · Periode {dateFrom || "-"} s/d {dateTo || "-"} · {selectedHistory.length} transaksi</p>
            <button onClick={() => selectedItem && downloadItem(selectedItem)} disabled={!selectedHistory.length} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"><Download className="h-3.5 w-3.5" />Download (barang ini)</button>
          </div>
          <div className="mt-3 max-h-[55vh] space-y-2 overflow-y-auto">
            {selectedHistory.length === 0 ? <p className="text-sm text-slate-400">Tidak ada transaksi pada rentang ini.</p> : selectedHistory.map((x, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{x.note || "-"}</p><p className="text-xs text-slate-400">{x.date || "-"}</p></div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${x.type === "Masuk" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>{x.type === "Masuk" ? "+" : "-"}{Number(x.qty).toLocaleString("id-ID")} {selectedItem?.unit || ""}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}