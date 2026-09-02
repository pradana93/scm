import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, ArrowRight, TrendingUp, TrendingDown, ArrowLeftRight } from "lucide-react";

const typeMeta = {
  masuk: { label: "Stok Masuk", Icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  keluar: { label: "Stok Keluar", Icon: TrendingDown, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200" },
  transfer: { label: "Transfer", Icon: ArrowLeftRight, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
};

export default function StockTransactionReviewDialog({ open, rows, onClose, onSubmit }) {
  const saving = false;
  const counts = rows.reduce((acc, r) => { acc[r.type] = (acc[r.type] || 0) + 1; return acc; }, {});

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview Impor Transaksi</DialogTitle>
          <p className="text-sm text-slate-500">
            {rows.length} transaksi terbaca
            {counts.masuk ? ` · ${counts.masuk} masuk` : ""}
            {counts.keluar ? ` · ${counts.keluar} keluar` : ""}
            {counts.transfer ? ` · ${counts.transfer} transfer` : ""}.
            Periksa data berikut sebelum diproses.
          </p>
        </DialogHeader>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
            Tidak ada transaksi valid terbaca. Pastikan format sesuai template.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r, idx) => {
              const meta = typeMeta[r.type] || typeMeta.masuk;
              return (
                <div key={idx} className={`rounded-xl border ${meta.border} ${meta.bg} p-3`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-xs font-semibold ${meta.color}`}>
                        <meta.Icon className="h-3.5 w-3.5" />{meta.label}
                      </span>
                      <span className="text-sm font-semibold text-slate-800">{r.item_name}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-800">{Number(r.quantity).toLocaleString("id-ID")} {r.unit || ""}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    <span>📅 {r.date || "-"}</span>
                    {r.type === "transfer" ? (
                      <span className="inline-flex items-center gap-1">{r.warehouse} <ArrowRight className="h-3 w-3" /> {r.transferTo}</span>
                    ) : (
                      <span>🏭 {r.warehouse || "-"}</span>
                    )}
                    {r.note && <span className="truncate">📝 {r.note}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Batal</Button>
          <Button onClick={() => onSubmit(rows)} disabled={saving || !rows.length} className="bg-indigo-600 text-white hover:bg-indigo-700">
            {saving ? "Memproses..." : `Proses ${rows.length} Transaksi`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}