import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, CircleCheck, Clock3, LoaderCircle, Target, Timer } from "lucide-react";
import { dataClient as base44 } from "@/api/dataClient";
import DateRangeBar from "@/components/shipping/DateRangeBar";
import WarehouseSelect from "@/components/shipping/WarehouseSelect";
import KomplainListDialog from "@/components/shipping/KomplainListDialog";
import ShipmentListDialog from "@/components/shipping/ShipmentListDialog";
import OtdListDialog from "@/components/shipping/OtdListDialog";
import { useWarehouseFilter } from "@/components/shipping/WarehouseFilterContext";
import { useDateFilter } from "@/components/shipping/DateFilterContext";
import { formatTonnage, ALL_WAREHOUSES } from "@/components/shipping/shippingUtils";
import DashboardChartSelector from "@/components/shipping/DashboardChartSelector";
import ProductionReviewCard from "@/components/shipping/ProductionReviewCard";
import ReceivedReviewCard from "@/components/shipping/ReceivedReviewCard";
import DistributionProductivityCard from "@/components/shipping/DistributionProductivityCard";
import { useOutletEtaMap, computeEstimatedArrival } from "@/components/shipping/etaUtils";
import PullToRefresh from "@/components/shipping/PullToRefresh";

const monthRange = () => {
  const n = new Date();
  const f = new Date(n.getFullYear(), n.getMonth(), 1);
  const l = new Date(n.getFullYear(), n.getMonth() + 1, 0);
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: fmt(f), end: fmt(l) };
};

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { dateFrom, setDateFrom, dateTo, setDateTo } = useDateFilter();
  const { warehouse, setWarehouse, queryFilter } = useWarehouseFilter();
  const [showKomplain, setShowKomplain] = useState(false);
  const [listView, setListView] = useState(null);
  const [otdView, setOtdView] = useState(null);

  const initRange = monthRange();
  const [cardFrom, setCardFrom] = useState(initRange.start);
  const [cardTo, setCardTo] = useState(initRange.end);
  const [cardWarehouse, setCardWarehouse] = useState(ALL_WAREHOUSES);

  const { data = [], isLoading } = useQuery({ queryKey: ["shipments", dateFrom, dateTo, warehouse], queryFn: () => base44.entities.Shipment.filter({ delivery_date: { $gte: dateFrom, $lte: dateTo }, ...queryFilter }, "-created_date") });
  const cardWf = cardWarehouse === ALL_WAREHOUSES ? {} : { warehouse: cardWarehouse };
  const { data: cardData = [], isLoading: cardLoading } = useQuery({ queryKey: ["shipments", "cards", cardFrom, cardTo, cardWarehouse], queryFn: () => base44.entities.Shipment.filter({ delivery_date: { $gte: cardFrom, $lte: cardTo }, ...cardWf }, "-created_date") });

  const etaMap = useOutletEtaMap();

  const count = (status) => data.filter((item) => item.status === status).length;
  const totalTonnage = data.reduce((sum, item) => sum + Number(item.tonnage || 0), 0);
  const dalamProsesStatuses = ["proses_picking", "menunggu_packing", "proses_packing", "menunggu_loading", "proses_loading"];
  const dalamProsesList = data.filter((item) => dalamProsesStatuses.includes(item.status));
  const dalamProses = dalamProsesList.length;

  // Delivery Accuracy (rentang & gudang kartu)
  const accSudah = cardData.filter((item) => item.status === "sudah_dikirim");
  const accKomplain = accSudah.filter((item) => item.accuracy === "ada_komplain");
  const accTanpa = accSudah.filter((item) => item.accuracy === "tanpa_komplain");
  const accBelum = accSudah.filter((item) => !item.accuracy || item.accuracy === "data_belum_tersedia");
  const komplainCount = accKomplain.length;
  const tanpaKomplainCount = accTanpa.length;
  const dataBelumCount = accBelum.length;
  const deliveryAccuracy = accSudah.length > 0 ? Math.round(((accSudah.length - komplainCount) / accSudah.length) * 1000) / 10 : 0;

  // On Time Delivery (rentang & gudang kartu)
  const otdDelivered = cardData.filter((item) => item.status === "sudah_dikirim");
  const otdWithActual = otdDelivered.filter((item) => item.actual_arrival_date);
  const onTimeList = otdWithActual.filter((item) => { const est = computeEstimatedArrival(item, etaMap); return est && item.actual_arrival_date <= est; });
  const lateList = otdWithActual.filter((item) => { const est = computeEstimatedArrival(item, etaMap); return est && item.actual_arrival_date > est; });
  const onTimeCount = onTimeList.length;
  const lateCount = lateList.length;
  const otd = otdWithActual.length > 0 ? Math.round((onTimeCount / otdWithActual.length) * 1000) / 10 : 0;
  const otdConclusion = otdWithActual.length === 0 ? "Belum ada data aktual tiba" : otd >= 90 ? "Sangat Baik" : otd >= 75 ? "Baik" : otd >= 50 ? "Cukup" : "Perlu Perbaikan";

  const stats = [
    { label: "Total Pengiriman", value: data.length, icon: Boxes, tone: "indigo", list: data, emptyText: "Tidak ada pengiriman." },
    { label: "Menunggu Antrian", value: count("menunggu_antrian"), icon: Clock3, tone: "amber", list: data.filter((s) => s.status === "menunggu_antrian") },
    { label: "Dalam Proses", value: dalamProses, icon: LoaderCircle, tone: "blue", rincian: `Picking: ${count("proses_picking")} · Packing: ${count("proses_packing")} · Loading: ${count("proses_loading")}`, list: dalamProsesList },
    { label: "Sudah Dikirim", value: count("sudah_dikirim"), icon: CircleCheck, tone: "emerald", list: data.filter((s) => s.status === "sudah_dikirim") },
  ];
  const tones = {
    indigo: "from-indigo-500 to-indigo-600",
    amber: "from-amber-500 to-amber-600",
    blue: "from-blue-500 to-blue-600",
    emerald: "from-emerald-500 to-emerald-600",
  };

  const handleRefresh = async () => { await queryClient.invalidateQueries({ queryKey: ["shipments"] }); };
  return <PullToRefresh onRefresh={handleRefresh}>
  <div>
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard Pengiriman</h1>
      <p className="mt-1 text-sm text-slate-500">Ringkasan distribusi per rentang tanggal.</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <WarehouseSelect value={warehouse} onChange={setWarehouse} className="w-full sm:w-[200px]" includeAll />
        <DateRangeBar dateFrom={dateFrom} dateTo={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
      {stats.map(({ label, value, icon: Icon, tone, rincian, list }) => (
        <button key={label} type="button" onClick={() => !isLoading && setListView({ title: label, icon: Icon, shipments: list })} className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:shadow-md disabled:opacity-70">
          <div className={`flex items-center gap-3 bg-gradient-to-br ${tones[tone]} px-4 py-3 text-white`}>
            <Icon className="h-5 w-5" /><span className="text-sm font-medium">{label}</span>
          </div>
          <div className="px-4 py-4">
            <p className="text-3xl font-bold tracking-tight">{isLoading ? "—" : value}</p>
            {rincian && !isLoading && <p className="mt-1 text-xs font-medium text-slate-500">{rincian}</p>}
            {!isLoading && <p className="mt-1 text-xs text-slate-400">Klik untuk lihat daftar</p>}
          </div>
        </button>
      ))}
    </div>

    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">Total Tonase</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{isLoading ? "—" : formatTonnage(totalTonnage)}</p>
    </div>

    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-slate-600">Filter Kartu Delivery Accuracy & On Time Delivery</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <WarehouseSelect value={cardWarehouse} onChange={setCardWarehouse} className="w-full sm:w-[200px]" includeAll />
          <DateRangeBar dateFrom={cardFrom} dateTo={cardTo} onFromChange={setCardFrom} onToChange={setCardTo} hideToday />
        </div>
      </div>
    </div>

    <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Delivery Accuracy</p>
          <p className="mt-1 text-2xl font-bold text-indigo-600">{cardLoading ? "—" : `${deliveryAccuracy}%`}</p>
          <p className="mt-1 text-xs text-slate-400">{cardLoading || !accSudah.length ? "" : `(Sudah Dikirim ${accSudah.length} − Ada Komplain ${komplainCount}) ÷ Sudah Dikirim`}</p>
        </div>
        <Target className="h-10 w-10 text-indigo-200" />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Total Sudah Dikirim</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{cardLoading ? "—" : accSudah.length}</p>
        </div>
        <button type="button" onClick={() => !cardLoading && setListView({ title: "Tanpa Komplain", icon: CircleCheck, iconColor: "text-emerald-600", shipments: accTanpa })} disabled={cardLoading} className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-left transition hover:bg-emerald-100/60 disabled:opacity-70">
          <p className="text-xs font-medium text-slate-500">Total Tanpa Komplain</p>
          <p className="mt-1 text-xl font-bold text-emerald-600">{cardLoading ? "—" : tanpaKomplainCount}</p>
          {!cardLoading && tanpaKomplainCount > 0 && <p className="mt-0.5 text-xs text-emerald-600">Klik untuk lihat daftar</p>}
        </button>
        <button type="button" onClick={() => !cardLoading && setShowKomplain(true)} disabled={cardLoading} className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 text-left transition hover:bg-rose-100/60 disabled:opacity-70">
          <p className="text-xs font-medium text-slate-500">Total Ada Komplain</p>
          <p className="mt-1 text-xl font-bold text-rose-600">{cardLoading ? "—" : komplainCount}</p>
          {!cardLoading && <p className="mt-0.5 text-xs text-rose-500">Klik untuk lihat daftar</p>}
        </button>
        <button type="button" onClick={() => !cardLoading && setListView({ title: "Data Belum Tersedia", icon: Clock3, iconColor: "text-slate-500", shipments: accBelum })} disabled={cardLoading} className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:bg-slate-50 disabled:opacity-70">
          <p className="text-xs font-medium text-slate-500">Total Data Belum Tersedia</p>
          <p className="mt-1 text-xl font-bold text-slate-500">{cardLoading ? "—" : dataBelumCount}</p>
          {!cardLoading && dataBelumCount > 0 && <p className="mt-0.5 text-xs text-slate-500">Klik untuk lihat daftar</p>}
        </button>
      </div>
    </div>

    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">On Time Delivery</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{cardLoading ? "—" : `${otd}%`}</p>
          <p className="mt-1 text-xs text-slate-400">{cardLoading || !otdWithActual.length ? "" : `${onTimeCount} tepat waktu · ${lateCount} terlambat dari ${otdWithActual.length} data aktual`}</p>
        </div>
        <div className="text-right">
          <Timer className="ml-auto h-8 w-8 text-emerald-300" />
          <p className="mt-2 text-xs font-medium text-slate-500">Kesimpulan</p>
          <p className="mt-0.5 text-sm font-semibold text-emerald-700">{cardLoading ? "—" : otdConclusion}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Total Sudah Dikirim</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{cardLoading ? "—" : otdDelivered.length}</p>
        </div>
        <button type="button" onClick={() => !cardLoading && onTimeCount > 0 && setOtdView({ title: "Tepat Waktu", icon: CircleCheck, iconColor: "text-emerald-600", shipments: onTimeList })} disabled={cardLoading || onTimeCount === 0} className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-left transition hover:bg-emerald-100/60 disabled:opacity-70">
          <p className="text-xs font-medium text-slate-500">Tepat Waktu</p>
          <p className="mt-1 text-xl font-bold text-emerald-600">{cardLoading ? "—" : onTimeCount}</p>
          {!cardLoading && onTimeCount > 0 && <p className="mt-0.5 text-xs text-emerald-600">Klik untuk lihat daftar</p>}
        </button>
        <button type="button" onClick={() => !cardLoading && lateCount > 0 && setOtdView({ title: "Terlambat", icon: Clock3, iconColor: "text-amber-600", shipments: lateList })} disabled={cardLoading || lateCount === 0} className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-left transition hover:bg-amber-100/60 disabled:opacity-70">
          <p className="text-xs font-medium text-slate-500">Total Terlambat</p>
          <p className="mt-1 text-xl font-bold text-amber-600">{cardLoading ? "—" : lateCount}</p>
          {!cardLoading && lateCount > 0 && <p className="mt-0.5 text-xs text-amber-600">Klik untuk lihat daftar</p>}
        </button>
      </div>
    </div>

    <DistributionProductivityCard />

    <ProductionReviewCard />
    <ReceivedReviewCard />

    <div className="mb-4 mt-9"><h2 className="text-lg font-bold">Ringkasan Data</h2><p className="text-sm text-slate-500">Pilih ringkasan data yang ingin ditampilkan berdasarkan gudang & rentang tanggal.</p></div>
    <DashboardChartSelector />

    <KomplainListDialog open={showKomplain} onClose={() => setShowKomplain(false)} shipments={cardData} />
    <ShipmentListDialog open={!!listView} onClose={() => setListView(null)} title={listView?.title} icon={listView?.icon} iconColor={listView?.iconColor} shipments={listView?.shipments || []} />
    <OtdListDialog open={!!otdView} onClose={() => setOtdView(null)} title={otdView?.title} icon={otdView?.icon} iconColor={otdView?.iconColor} shipments={otdView?.shipments || []} etaMap={etaMap} />
  </div>
  </PullToRefresh>;
}