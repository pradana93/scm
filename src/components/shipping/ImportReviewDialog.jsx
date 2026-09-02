import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import WarehouseSelect from "@/components/shipping/WarehouseSelect";
import { WAREHOUSES } from "./shippingUtils";

const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export default function ImportReviewDialog({ open, dos, defaultWarehouse, onClose, onSubmit }) {
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && dos?.length) {
      setRows(dos.map((d) => ({
        do_number: d.do_number || "",
        outlet_name: d.outlet_name || "",
        delivery_date: d.delivery_date || "",
        do_items: Array.isArray(d.do_items) ? d.do_items : [],
        document_type: d.document_type || "delivery_order",
        tonnage: 0,
        warehouse: d.warehouse || defaultWarehouse || WAREHOUSES[0],
        fleet: "",
      })));
    }
  }, [open, dos, defaultWarehouse]);

  const update = (idx, field, value) => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  const removeRow = (idx) => setRows((prev) => prev.filter((_, i) => i !== idx));

  const submit = async () => {
    setSaving(true);
    try {
      const payload = rows.map((r) => ({
        outlet_name: r.outlet_name,
        tonnage: Number(r.tonnage) || 0,
        status: "menunggu_antrian",
        fleet: r.fleet || "",
        delivery_date: r.delivery_date,
        warehouse: r.warehouse,
        checker_name: "",
        crew_count: 0,
        do_number: r.do_number || "",
        document_type: r.document_type || "delivery_order",
        do_items: r.do_items,
      }));
      await onSubmit(payload);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Konfirmasi Data Impor</DialogTitle>
          <p className="text-sm text-slate-500">{rows.length} pengiriman terbaca. Gudang asal terbaca otomatis. Tonase dapat diisi sekarang atau diperbaiki nanti pada detail DO.</p>
        </DialogHeader>

        <div className="space-y-4">
          {rows.map((r, idx) => (
            <div key={idx} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.outlet_name || "(tanpa nama)"}</p>
                  <p className="text-xs text-slate-500">{r.do_number ? `${r.do_number} · ` : ""}{r.delivery_date || "Tanpa tanggal"} · {r.do_items.length} item · {r.warehouse || "-"}</p>
                </div>
                <button onClick={() => removeRow(idx)} disabled={saving} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              {r.do_items.length > 0 && (
                <div className="mt-2 max-h-32 overflow-y-auto rounded-lg bg-slate-50 p-2">
                  {r.do_items.map((it, i) => (
                    <div key={i} className="flex justify-between py-0.5 text-xs">
                      <span className="text-slate-600">{it.name}</span>
                      <span className="font-semibold text-slate-700">{it.quantity} {it.unit}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-medium text-slate-600">Gudang Asal<div className="mt-1.5"><WarehouseSelect value={r.warehouse} onChange={(v) => update(idx, "warehouse", v)} className="w-full" /></div></label>
                <label className="text-xs font-medium text-slate-600">Armada<input value={r.fleet} onChange={(e) => update(idx, "fleet", e.target.value)} placeholder="No. armada / plat (opsional)" className={inputClass} /></label>
                <label className="text-xs font-medium text-slate-600">Tonase (kg)<input type="number" min="0" inputMode="numeric" value={r.tonnage} onChange={(e) => update(idx, "tonnage", e.target.value)} placeholder="0" className={inputClass} /></label>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Batal</Button>
          <Button onClick={submit} disabled={saving || !rows.length} className="bg-indigo-600 text-white hover:bg-indigo-700">{saving ? "Menyimpan..." : `Simpan ${rows.length} Pengiriman`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}