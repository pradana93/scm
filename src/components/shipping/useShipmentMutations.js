import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export function useShipmentMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["shipments"] });
  const updateStatus = async (id, payload) => { await base44.entities.Shipment.update(id, payload); refresh(); };
  const deliverShipment = async (item, { file, checker_name, crew_count, tonnage }) => {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const now = new Date().toISOString();
    const update = {
      status: "sudah_dikirim",
      timestamp_sudah_dikirim: now,
      proof_file_url: file_url,
      checker_name,
      crew_count,
    };
    if (item.timestamp_proses_loading && !item.timestamp_proses_loading_end) update.timestamp_proses_loading_end = now;
    if (tonnage != null && !Number.isNaN(Number(tonnage))) update.tonnage = Number(tonnage);
    await base44.entities.Shipment.update(item.id, update);
    refresh();
  };
  const deleteShipment = async (id) => { await base44.entities.Shipment.delete(id); refresh(); };
  const deleteShipments = async (ids) => { await base44.entities.Shipment.deleteMany({ id: { $in: ids } }); refresh(); };
  return { updateStatus, deliverShipment, deleteShipment, deleteShipments };
}