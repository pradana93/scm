import { useAuth } from "@/lib/AuthContext";
import { isSuperAdmin, canEditMaster } from "@/components/shipping/shippingUtils";
import { usePermissions } from "@/components/shipping/usePermissions";
import MasterWarehouseList from "@/components/shipping/master/MasterWarehouseList";
import MasterOutletList from "@/components/shipping/master/MasterOutletList";
import MasterVendorList from "@/components/shipping/master/MasterVendorList";

export default function Admin() {
  const { user } = useAuth();
  const canDelete = isSuperAdmin(user);
  const canEdit = canEditMaster(user);
  const { can } = usePermissions();
  const canMasterAdd = can("master.add");
  const canMasterEdit = can("master.edit");
  const canMasterDelete = can("master.delete");
  return <div>
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Master Data</h1>
      <p className="mt-1 text-sm text-slate-500">Kelola data gudang, outlet tujuan, dan kartu nama vendor. Pengelolaan nama barang ada di Stock Control, dan pengguna di Super Admin.</p>
    </div>
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2">
      <MasterWarehouseList canDelete={canMasterDelete} canEdit={canMasterEdit} canAdd={canMasterAdd} />
      <MasterOutletList canDelete={canMasterDelete} canEdit={canMasterEdit} canAdd={canMasterAdd} />
      <MasterVendorList canDelete={canMasterDelete} canEdit={canMasterEdit} canAdd={canMasterAdd} />
    </div>
    {!canDelete && <p className="mt-5 text-xs text-slate-400">Semua role dapat menambahkan dan mengubah data gudang dan outlet. Pengelolaan nama barang ada di Stock Control, dan pengguna di halaman Super Admin.</p>}
  </div>;
}