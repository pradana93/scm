import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Warehouse } from "lucide-react";
import { dataClient as base44 } from "@/api/dataClient";
import { ALL_WAREHOUSES, WAREHOUSES } from "./shippingUtils";

export default function WarehouseSelect({ value, onChange, className = "", includeAll = false }) {
  const { data = [] } = useQuery({ queryKey: ["warehouses"], queryFn: () => base44.entities.Warehouse.list() });
  const list = (data.length ? data.map((w) => w.name) : WAREHOUSES).slice().sort((a, b) => a.localeCompare(b, "id"));
  const options = includeAll ? [ALL_WAREHOUSES, ...list] : list;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`gap-2 ${className}`}>
        <Warehouse className="h-4 w-4 text-slate-400" />
        <SelectValue placeholder="Pilih gudang" />
      </SelectTrigger>
      <SelectContent>
        {options.map((w) => (
          <SelectItem key={w} value={w}>{w}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}