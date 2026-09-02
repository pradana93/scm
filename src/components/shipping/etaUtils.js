import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export const parseEtaDays = (eta) => {
  if (!eta) return 0;
  const m = String(eta).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
};

export const useOutletEtaMap = () => {
  const { data = [] } = useQuery({
    queryKey: ["outlets-eta"],
    queryFn: () => base44.entities.Outlet.list("-name", 5000),
    staleTime: 5 * 60 * 1000,
  });
  const map = new Map();
  (data || []).forEach((o) => { if (o.name) map.set(o.name, parseEtaDays(o.eta)); });
  return map;
};

export const shipDateStr = (shipment) => {
  if (shipment?.timestamp_sudah_dikirim) {
    const d = new Date(shipment.timestamp_sudah_dikirim);
    if (!isNaN(d)) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
  }
  return shipment?.delivery_date || null;
};

export const computeEstimatedArrival = (shipment, etaMap) => {
  if (!shipment || shipment.status !== "sudah_dikirim") return null;
  const base = shipDateStr(shipment);
  if (!base) return null;
  const days = etaMap?.get(shipment.outlet_name) ?? 0;
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const isOnTime = (actual, estimated) => {
  if (!actual || !estimated) return null;
  return actual <= estimated;
};