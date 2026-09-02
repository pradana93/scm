import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gauge } from "lucide-react";
import { base44 } from "@/api/base44Client";
import WarehouseSelect from "@/components/shipping/WarehouseSelect";
import DateRangeBar from "@/components/shipping/DateRangeBar";
import { ALL_WAREHOUSES } from "@/components/shipping/shippingUtils";

const monthRange = () => {
  const n = new Date();
  const f = new Date(n.getFullYear(), n.getMonth(), 1);
  const l = new Date(n.getFullYear(), n.getMonth() + 1, 0);
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: fmt(f), end: fmt(l) };
};

const fmtTotal = (n) => Number(n || 0).toLocaleString("id-ID");
const fmtAvg = (n) => Number(n || 0).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function DistributionProductivityCard() {
  const init = monthRange();
  const [from, setFrom] = useState(init.start);
  const [to, setTo] = useState(init.end);
  const [warehouse, setWarehouse] = useState(ALL_WAREHOUSES);

  const wf = warehouse === ALL_WAREHOUSES ? {} : { warehouse };
  const { data = [], isLoading } = useQuery({
    queryKey: ["shipments", "productivity", from, to, warehouse],
    queryFn: () => base44.entities.Shipment.filter({ delivery_date: { $gte: from, $lte: to }, ...wf }, "-delivery_date"),
  });

  const rows = useMemo(() => {
    const delivered = (data || []).filter((s) => s.status === "sudah_dikirim");
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
  }, [data]);

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-slate-400" />
          <h3 className="text-base font-bold text-slate-800">Distribution Productivity Review</h3>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <WarehouseSelect value={warehouse} onChange={setWarehouse} className="w-full sm:w-[200px]" includeAll />
          <DateRangeBar dateFrom={from} dateTo={to} onFromChange={setFrom} onToChange={setTo} hideToday />
        </div>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" /></div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Tidak ada data pengiriman dengan status Sudah Dikirim pada rentang ini.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
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
        </div>
      )}
    </div>
  );
}