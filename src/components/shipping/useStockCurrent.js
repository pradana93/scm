import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ALL_WAREHOUSES } from "./shippingUtils";

const norm = (s) => (s || "").trim().toLowerCase();

// Hook untuk menghitung sisa stok terkini per barang per gudang.
// Mengikuti logika yang sama dengan halaman Stock Control.
export function useStockCurrent() {
  const { data: items = [] } = useQuery({ queryKey: ["stockItems"], queryFn: () => base44.entities.StockItem.list() });
  const { data: movements = [] } = useQuery({ queryKey: ["stockMovements"], queryFn: () => base44.entities.StockMovement.list("-created_date", 500) });
  const { data: shipments = [] } = useQuery({ queryKey: ["shipments", "stock"], queryFn: () => base44.entities.Shipment.list("-delivery_date", 500) });

  const currentFor = (name, warehouse = ALL_WAREHOUSES) => {
    const k = norm(name);
    if (!k) return 0;
    let masuk = 0;
    let keluar = 0;
    for (const m of movements) {
      if (m.type !== "masuk") continue;
      if (!(warehouse === ALL_WAREHOUSES || !m.warehouse || m.warehouse === warehouse)) continue;
      if (norm(m.item_name) === k) masuk += Number(m.quantity || 0);
    }
    for (const s of shipments) {
      if (s.status !== "sudah_dikirim") continue;
      if (!(warehouse === ALL_WAREHOUSES || s.warehouse === warehouse)) continue;
      for (const it of (Array.isArray(s.do_items) ? s.do_items : [])) {
        if (norm(it.name) === k) keluar += Number(it.quantity || 0);
      }
    }
    for (const m of movements) {
      if (m.type !== "keluar") continue;
      if (!(warehouse === ALL_WAREHOUSES || !m.warehouse || m.warehouse === warehouse)) continue;
      if (norm(m.item_name) === k) keluar += Number(m.quantity || 0);
    }
    return masuk - keluar;
  };

  const unitFor = (name) => {
    const it = items.find((i) => norm(i.name) === norm(name));
    return it?.unit || "";
  };

  return { currentFor, unitFor, items };
}