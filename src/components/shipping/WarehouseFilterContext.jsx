import { createContext, useContext, useState } from "react";
import { ALL_WAREHOUSES } from "./shippingUtils";

const WarehouseFilterContext = createContext(null);

export function WarehouseFilterProvider({ children }) {
  const [warehouse, setWarehouse] = useState(ALL_WAREHOUSES);
  const isAll = warehouse === ALL_WAREHOUSES;
  const queryFilter = isAll ? {} : { warehouse };
  return (
    <WarehouseFilterContext.Provider value={{ warehouse, setWarehouse, isAll, queryFilter }}>
      {children}
    </WarehouseFilterContext.Provider>
  );
}

export function useWarehouseFilter() {
  const ctx = useContext(WarehouseFilterContext);
  if (!ctx) throw new Error("useWarehouseFilter must be used within WarehouseFilterProvider");
  return ctx;
}