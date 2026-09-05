import { useQuery } from "@tanstack/react-query";
import { dataClient as base44 } from "@/api/dataClient";
import { useAuth } from "@/lib/AuthContext";
import { isSuperAdmin } from "./shippingUtils";

export const PERMISSION_GROUPS = [
  { group: "Akses Halaman", items: [
    { key: "page.dashboard", label: "Dashboard" },
    { key: "page.pengiriman", label: "Daftar Pengiriman" },
    { key: "page.master_data", label: "Master Data" },
    { key: "page.report", label: "Report" },
    { key: "page.stock", label: "Stock Control" },
    { key: "page.production", label: "Production" },
    { key: "page.penerimaan", label: "Penerimaan" },
    { key: "page.super_admin", label: "Halaman Super Admin" },
  ]},
  { group: "Dashboard", items: [
    { key: "dashboard.view_details", label: "Lihat rincian kartu (pop-up daftar)" },
  ]},
  { group: "Daftar Pengiriman", items: [
    { key: "pengiriman.add", label: "Tambah pengiriman" },
    { key: "pengiriman.edit_status", label: "Ubah status pengiriman" },
    { key: "pengiriman.reschedule", label: "Reschedule pengiriman" },
    { key: "pengiriman.delete", label: "Hapus pengiriman" },
    { key: "pengiriman.edit_tonnage", label: "Edit tonase di detail DO" },
    { key: "pengiriman.edit_customer", label: "Edit nama customer/outlet" },
    { key: "pengiriman.edit_warehouse", label: "Edit gudang asal" },
    { key: "pengiriman.edit_fleet", label: "Edit armada di detail DO" },
    { key: "pengiriman.upload_packing", label: "Upload packing list" },
    { key: "pengiriman.set_accuracy", label: "Atur akurasi DO" },
    { key: "pengiriman.set_actual_arrival", label: "Isi aktual tiba" },
    { key: "pengiriman.view_do_detail", label: "Lihat detail DO" },
    { key: "pengiriman.print_do", label: "Cetak / download DO & packing list" },
  ]},
  { group: "Master Data", items: [
    { key: "master.add", label: "Tambah data gudang & outlet" },
    { key: "master.edit", label: "Edit data gudang & outlet" },
    { key: "master.delete", label: "Hapus data gudang & outlet" },
  ]},
  { group: "Stok Barang", items: [
    { key: "stock.in", label: "Input stok masuk" },
    { key: "stock.manage", label: "Kelola data barang stok" },
  ]},
  { group: "Transaksi Stok", crud: true, items: [
    { key: "stock.transaction", label: "Riwayat / Kartu Stock" },
  ]},
  { group: "Produksi", items: [
    { key: "production.create", label: "Tambah rencana produksi" },
    { key: "production.edit", label: "Input aktual & ubah rencana produksi" },
    { key: "production.delete", label: "Hapus rencana produksi" },
    { key: "production.delete_selesai", label: "Hapus data produksi selesai (stok masuk)" },
  ]},
  { group: "Penerimaan", items: [
    { key: "penerimaan.create", label: "Tambah rencana kedatangan" },
    { key: "penerimaan.edit", label: "Proses penerimaan & ubah rencana" },
    { key: "penerimaan.delete", label: "Hapus rencana kedatangan" },
    { key: "penerimaan.delete_selesai", label: "Hapus data penerimaan selesai (stok masuk)" },
  ]},
  { group: "Manajemen Pengguna", items: [
    { key: "user.invite", label: "Undang pengguna" },
    { key: "user.change_role", label: "Ubah role pengguna" },
    { key: "user.delete", label: "Hapus pengguna" },
    { key: "user.view_status", label: "Lihat status kehadiran pengguna (Online/Away/Offline)" },
  ]},
];

export function usePermissions() {
  const { user } = useAuth();
  const { data = [] } = useQuery({ queryKey: ["permissions"], queryFn: () => base44.entities.FeaturePermission.list() });

  const roleOf = () => (user ? user.role : "public");

  const resolve = (key, field) => {
    const rec = data.find((p) => p.key === key);
    if (!rec) return null;
    const v = rec[field];
    if (Array.isArray(v) && v.length) return v;
    return rec.allowed_roles || [];
  };

  const check = (key, field) => {
    if (isSuperAdmin(user)) return true;
    const roles = resolve(key, field);
    if (!roles) return true;
    return roles.includes(roleOf());
  };

  const can = (key) => check(key, "view_roles");
  const canEdit = (key) => check(key, "edit_roles");
  const canDelete = (key) => check(key, "delete_roles");

  return { can, canEdit, canDelete, permissions: data };
}