import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Package } from "lucide-react";
import { dataClient as base44 } from "@/api/dataClient";
import { today, WAREHOUSES } from "./shippingUtils";

const buildInitial = (warehouse, prefill) => ({
  outlet_name: prefill?.outlet_name || "",
  tonnage: prefill?.tonnage ?? "",
  status: "menunggu_antrian",
  fleet: prefill?.fleet || "",
  delivery_date: prefill?.delivery_date || today(),
  warehouse,
  do_number: prefill?.do_number || "",
  do_items: prefill?.do_items || [],
});

export default function ShipmentForm({ onSubmit, defaultWarehouse = WAREHOUSES[0], onCancel, prefill }) {
  const [form, setForm] = useState(() => buildInitial(defaultWarehouse, prefill));
  useEffect(() => { setForm((f) => ({ ...f, warehouse: defaultWarehouse })); }, [defaultWarehouse]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { data: warehouses = [] } = useQuery({ queryKey: ["warehouses"], queryFn: () => base44.entities.Warehouse.list() });
  const warehouseOptions = warehouses.length ? warehouses.map((w) => w.name) : WAREHOUSES;
  const { data: outlets = [] } = useQuery({ queryKey: ["outlets"], queryFn: () => base44.entities.Outlet.list() });

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError("");
    try { await onSubmit({ ...form, tonnage: Number(form.tonnage), crew_count: 0, checker_name: "", do_items: form.do_items }); setForm(buildInitial(form.warehouse)); }
    catch { setError("Data gagal disimpan. Silakan coba lagi."); }
    finally { setSaving(false); }
  };
  const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
  const hasItems = Array.isArray(form.do_items) && form.do_items.length > 0;
  return <form onSubmit={submit} className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium">Nomor DO<input name="do_number" value={form.do_number} onChange={change} className={inputClass} placeholder="Contoh: DO/2026/07/003141" /></label>
      <label className="text-sm font-medium">Tanggal Pengiriman<input required type="date" name="delivery_date" value={form.delivery_date} onChange={change} className={inputClass} /></label>
      <label className="text-sm font-medium">Gudang Asal
        <select required name="warehouse" value={form.warehouse} onChange={change} className={inputClass}>
          {warehouseOptions.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium">Outlet Tujuan
        <input required name="outlet_name" value={form.outlet_name} onChange={change} className={inputClass} placeholder="Contoh: Outlet Sudirman" list="outlet-options" />
        <datalist id="outlet-options">{outlets.map((o) => <option key={o.id} value={o.name} />)}</datalist>
      </label>
      <label className="text-sm font-medium">Total Tonase (kg)<input required min="0" step="1" type="number" name="tonnage" value={form.tonnage} onChange={change} className={inputClass} placeholder="0" /></label>
      <label className="text-sm font-medium">Armada Pengiriman<input required name="fleet" value={form.fleet} onChange={change} className={inputClass} placeholder="Contoh: B 1234 XYZ" /></label>
    </div>
    {hasItems && <div className="flex items-center gap-2 rounded-xl bg-indigo-50 px-3.5 py-2.5 text-xs font-medium text-indigo-700"><Package className="h-4 w-4" />{form.do_items.length} item terdeteksi dari DO dan akan disimpan bersama pengiriman.</div>}
    {error && <p className="text-sm text-red-600">{error}</p>}
    <div className="flex justify-end gap-2 pt-1">
      {onCancel && <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Batal</button>}
      <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"><Plus className="h-4 w-4" />{saving ? "Menyimpan..." : "Tambahkan Data"}</button>
    </div>
  </form>;
}