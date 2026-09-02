import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import WarehouseSelect from "@/components/shipping/WarehouseSelect";
import { useStockCurrent } from "@/components/shipping/useStockCurrent";

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
const today = () => new Date().toISOString().slice(0, 10);

export default function ProductionRequestDialog({ open, onClose, onSave, items, editing, busy }) {
  const { currentFor, unitFor } = useStockCurrent();
  const [reqDate, setReqDate] = useState(today());
  const [warehouse, setWarehouse] = useState("Gudang Jakarta");
  const [itemName, setItemName] = useState("");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setReqDate(editing.request_date || today());
      setWarehouse(editing.warehouse || "Gudang Jakarta");
      setItemName(editing.item_name || "");
      setQty(String(editing.requested_quantity ?? ""));
      setNote(editing.note || "");
    } else {
      setReqDate(today()); setWarehouse("Gudang Jakarta"); setItemName(""); setQty(""); setNote("");
    }
  }, [open, editing]);

  const onItem = (name) => setItemName(name);
  const unit = unitFor(itemName);
  const currentStock = itemName ? currentFor(itemName, warehouse) : 0;
  const sortedItems = useMemo(() => [...(items || [])].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "id")), [items]);

  const submit = () => {
    if (!reqDate || !itemName.trim() || !qty) return;
    onSave({
      request_date: reqDate,
      warehouse,
      item_name: itemName.trim(),
      unit,
      requested_quantity: Number(qty) || 0,
      current_stock: currentStock,
      note: note.trim(),
      status: editing?.status || "open",
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{editing ? "Edit Permintaan Produksi" : "Tambah Permintaan Produksi"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm font-medium">Tanggal Permintaan<input type="date" value={reqDate} onChange={(e) => setReqDate(e.target.value)} className={`mt-1.5 ${inputClass}`} /></label>
          <label className="block text-sm font-medium">Gudang<div className="mt-1.5"><WarehouseSelect value={warehouse} onChange={setWarehouse} className="w-full" /></div></label>
          <label className="block text-sm font-medium">Nama Barang
            <select value={itemName} onChange={(e) => onItem(e.target.value)} className={`mt-1.5 ${inputClass}`}>
              <option value="" disabled>Pilih barang</option>
              {sortedItems.map((it) => <option key={it.id} value={it.name}>{it.name}</option>)}
            </select>
          </label>
          {itemName && (
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs">
              <div><p className="text-slate-400">Sisa Stok Terkini</p><p className="text-sm font-bold text-slate-800">{Number(currentStock).toLocaleString("id-ID")} <span className="text-xs font-normal text-slate-400">{unit || "-"}</span></p></div>
              <div><p className="text-slate-400">Satuan</p><p className="text-sm font-bold text-slate-800">{unit || "-"}</p></div>
            </div>
          )}
          <label className="block text-sm font-medium">Kuantitas Diminta untuk Produksi<input type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="0" /></label>
          <label className="block text-sm font-medium">Catatan<input value={note} onChange={(e) => setNote(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="Catatan (opsional)" /></label>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Batal</Button><Button onClick={submit} disabled={busy || !reqDate || !itemName.trim() || !qty}>{busy ? "Menyimpan..." : "Simpan"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}