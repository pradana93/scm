import { useMemo } from "react";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";

const fmtTotal = (n) => Number(n || 0).toLocaleString("id-ID");
const fmtAvg = (n) => Number(n || 0).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const formatDate = (v) => { if (!v) return "-"; try { const d = new Date(v + "T00:00:00"); return isNaN(d.getTime()) ? v : d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }); } catch { return v; } };

export default function ReportProductivity({ shipments = [], dateFrom, dateTo }) {
  const rows = useMemo(() => {
    const delivered = (shipments || []).filter((s) => s.status === "sudah_dikirim");
    const byDate = new Map();
    for (const s of delivered) {
      const d = s.delivery_date || "(Tanpa Tanggal)";
      if (!byDate.has(d)) byDate.set(d, { date: d, totalDo: 0, totalTonnage: 0, pickingCrew: 0, packingCrew: 0, loadingCrew: 0 });
      const r = byDate.get(d);
      r.totalDo += 1;
      r.totalTonnage += Number(s.tonnage || 0);
      r.pickingCrew += Number(s.picking_crew_count || 0);
      r.packingCrew += Number(s.packing_crew_count || 0);
      r.loadingCrew += Number(s.loading_crew_count || 0);
    }
    const list = Array.from(byDate.values()).map((r) => ({
      ...r,
      avgPicking: r.pickingCrew > 0 ? r.totalTonnage / r.pickingCrew : 0,
      avgPacking: r.packingCrew > 0 ? r.totalTonnage / r.packingCrew : 0,
      avgLoading: r.loadingCrew > 0 ? r.totalTonnage / r.loadingCrew : 0,
    }));
    list.sort((a, b) => a.date.localeCompare(b.date));
    return list;
  }, [shipments]);

  const totalDo = rows.reduce((s, r) => s + r.totalDo, 0);

  const download = () => {
    const header = ["Date", "Total DO", "Total Tonase", "Avg Tonase / Crew Picking", "Avg Tonase / Crew Packing", "Avg Tonase / Crew Loading"];
    const data = rows.map((r) => [r.date, r.totalDo, r.totalTonnage, r.avgPicking, r.avgPacking, r.avgLoading]);
    const summary = [[`Laporan Distribution Productivity`], [`Periode: ${formatDate(dateFrom)} - ${formatDate(dateTo)}`], [`Total Hari: ${rows.length}`], [`Total DO: ${totalDo}`], [], []];
    const ws = XLSX.utils.aoa_to_sheet([...summary, header, ...data]);
    ws["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 24 }, { wch: 24 }, { wch: 24 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Productivity");
    XLSX.writeFile(wb, "laporan-productivity.xlsx");
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">{rows.length} hari · {totalDo} total DO</p>
        <button onClick={download} disabled={!rows.length} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"><Download className="h-4 w-4" />Download</button>
      </div>
      {rows.length === 0 ? <p className="text-sm text-slate-400">Tidak ada data pengiriman dengan status Sudah Dikirim pada rentang ini.</p> :
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Total DO</th>
                <th className="px-4 py-3 text-right">Total Tonase</th>
                <th className="px-4 py-3 text-right">Avg Tonase / Crew Picking</th>
                <th className="px-4 py-3 text-right">Avg Tonase / Crew Packing</th>
                <th className="px-4 py-3 text-right">Avg Tonase / Crew Loading</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.date} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-700">{r.date}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{r.totalDo}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">{fmtTotal(r.totalTonnage)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{fmtAvg(r.avgPicking)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{fmtAvg(r.avgPacking)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{fmtAvg(r.avgLoading)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
    </div>
  );
}