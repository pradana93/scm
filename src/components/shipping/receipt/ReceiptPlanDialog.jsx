import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import WarehouseSelect from "@/components/shipping/WarehouseSelect";
import { dataClient as base44 } from "@/api/dataClient";
import { useStockCurrent } from "@/components/shipping/useStockCurrent";

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
const today = () => new Date().toISOString().slice(0, 10);
const norm = (s) => (s || "").trim().toLowerCase();

export default function ReceiptPlanDialog({ open, onClose, onSave, editing, busy }) {
  const { unitFor, items } = useStockCurrent();
  const { data: vendors = [] } = useQuery({ queryKey: ["vendors"], queryFn: () => base44.entities.Vendor.list() });
  const [arrivalDate, setArrivalDate] = useState(today());
  const [warehouse, setWarehouse] = useState("Gudang Jakarta");
  const [sender, setSender] = useState("");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState([{ item_name: "", quantity: "", unit: "", note: "" }]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setArrivalDate(editing.arrival_date || today());
      setWarehouse(editing.warehouse || "Gudang Jakarta");
      setSender(editing.sender_name || "");
      setNote(editing.note || "");
      setRows(Array.isArray(editing.items) && editing.items.length ? editing.items.map((it) => ({ item_name: it.item_name || "", quantity: String(it.quantity ?? ""), unit: it.unit || "", note: it.note || "" })) : [{ item_name: "", quantity: "", unit: "", note: "" }]);
    } else {
      setArrivalDate(today()); setWarehouse("Gudang Jakarta"); setSender(""); setNote("");
      setRows([{ item_name: "", quantity: "", unit: "", note: "" }]);
    }
  }, [open, editing]);

  const sortedItems = useMemo(() => [...(items || [])].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "id")), [items]);
  const vendorNames = useMemo(() => vendors.map((v) => v.name).sort((a, b) => a.localeCompare(b, "id")), [vendors]);

  const setRow = (i, field, value) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  const onItem = (i, name) => {
    const u = unitFor(name);
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, item_name: name, unit: u || r.unit || "" } : r)));
  };
  const addRow = () => setRows((p) => [...p, { item_name: "", quantity: "", unit: "", note: "" }]);
  const removeRow = (i) => setRows((p) => p.filter((_, idx) => idx !== i));

  const submit = () => {
    if (!arrivalDate || !warehouse || !sender.trim()) return;
    const validRows = rows.filter((r) => r.item_name.trim() && Number(r.quantity) > 0);
    if (!validRows.length) return;
    if (validRows.some((r) => !r.unit.trim())) return;
    onSave({
      arrival_date: arrivalDate,
      warehouse,
      sender_name: sender.trim(),
      note: note.trim(),
      items: validRows.map((r) => ({ item_name: r.item_name.trim(), quantity: Number(r.quantity) || 0, unit: r.unit.trim(), note: r.note.trim() })),
      status: editing?.status || "rencana",
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>{editing ? "Edit Rencana Kedatangan" : "Tambah Rencana Kedatangan"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">Tanggal Kedatangan<input type="date" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} className={`mt-1.5 ${inputClass}`} /></label>
            <label className="block text-sm font-medium">Gudang<div className="mt-1.5"><WarehouseSelect value={warehouse} onChange={setWarehouse} className="w-full" /></div></label>
          </div>
          <label className="block text-sm font-medium">Nama Pengirim (Vendor)
            <input list="vendor-list" value={sender} onChange={(e) => setSender(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="Nama pengirim / vendor" />
            <datalist id="vendor-list">{vendorNames.map((v) => <option key={v} value={v} />)}</datalist>
            <p className="mt-1 text-[11px] text-slate-400">Nama baru otomatis tersimpan ke Master Data Vendor.</p>
          </label>
          <div>
            <p className="mb-1.5 text-sm font-medium">Daftar Barang</p>
            <p className="mb-2 text-[11px] text-slate-400">Barang baru otomatis tersimpan ke Master Data. Satuan wajib diisi.</p>
            <datalist id="stock-items-list">{sortedItems.map((it) => <option key={it.id} value={it.name} />)}</datalist>
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start gap-2">
                    <input list="stock-items-list" value={r.item_name} onChange={(e) => onItem(i, e.target.value)} className={`flex-1 ${inputClass}`} placeholder="Pilih atau ketik nama barang" />
                    {rows.length > 1 && <button type="button" onClick={() => removeRow(i)} className="mt-0.5 rounded-lg p-2 text-red-600 transition hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <label className="text-xs font-medium">Kuantitas<input type="number" min="0" value={r.quantity} onChange={(e) => setRow(i, "quantity", e.target.value)} className={`mt-1 ${inputClass}`} placeholder="0" /></label>
                    <label className="text-xs font-medium">Satuan<input value={r.unit} onChange={(e) => setRow(i, "unit", e.target.value)} className={`mt-1 ${inputClass}`} placeholder="sak, kg, dll" /></label>
                    <label className="text-xs font-medium sm:col-span-1 col-span-2">Keterangan<input value={r.note} onChange={(e) => setRow(i, "note", e.target.value)} className={`mt-1 ${inputClass}`} placeholder="Catatan (opsional)" /></label>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={addRow} className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"><Plus className="h-4 w-4" />Tambah Baris Barang</button>
          </div>
          <label className="block text-sm font-medium">Keterangan Umum<input value={note} onChange={(e) => setNote(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="Catatan umum (opsional)" /></label>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Batal</Button><Button onClick={submit} disabled={busy || !arrivalDate || !warehouse || !sender.trim() || !rows.some((r) => r.item_name.trim() && Number(r.quantity) > 0) || rows.some((r) => r.item_name.trim() && Number(r.quantity) > 0 && !r.unit.trim())}>{busy ? "Menyimpan..." : "Simpan"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}