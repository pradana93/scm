import { useEffect, useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { LayoutDashboard, PackageCheck, Settings2, Truck, FileDown, ShieldCheck, LogOut, LogIn, UserCircle, Boxes, Factory, Inbox } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { dataClient as base44 } from "@/api/dataClient";
import { isSuperAdmin } from "./shippingUtils";
import { usePermissions } from "./usePermissions";
import { presenceStatus } from "./presenceUtils";
import ProfileDialog from "@/components/ProfileDialog";
import { WarehouseFilterProvider } from "./WarehouseFilterContext";
import { DashboardDateProvider, ShipmentsDateProvider } from "./DateFilterContext";

const ROLE_LABELS = { super_admin: "Super Admin", admin: "Admin", user: "User" };

const LINKS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, key: "dashboard", end: true },
  { to: "/pengiriman", label: "Pengiriman", icon: PackageCheck, key: "pengiriman" },
  { to: "/penerimaan", label: "Penerimaan", icon: Inbox, key: "penerimaan" },
  { to: "/produksi", label: "Production", icon: Factory, key: "production" },
  { to: "/stok", label: "Stock Control", icon: Boxes, key: "stock" },
  { to: "/admin", label: "Master Data", icon: Settings2, key: "master_data" },
  { to: "/report", label: "Report", icon: FileDown, key: "report" },
];

export default function AppLayout() {
  const { user, logout, publicMode } = useAuth();
  const { can } = usePermissions();
  const [profileOpen, setProfileOpen] = useState(false);
  const links = LINKS.filter((l) => can(`page.${l.key}`));
  if (can("page.super_admin")) links.push({ to: "/super-admin", label: "Super Admin", icon: ShieldCheck, end: false });
  const statusLabel = user ? (ROLE_LABELS[user.role] || user.role) : "Public · Read Only";
  const canViewStatus = can("user.view_status");
  const [myLastActive, setMyLastActive] = useState(user?.last_active_at || null);
  useEffect(() => {
    if (!user) return;
    const tick = () => { const now = new Date().toISOString(); setMyLastActive(now); base44.auth.updateMe({ last_active_at: now }).catch(() => {}); };
    tick();
    const id = setInterval(tick, 120000);
    return () => clearInterval(id);
  }, [user?.id]);
  const myPresence = canViewStatus && user ? presenceStatus(myLastActive) : null;

  return <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 sm:pb-28">
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <span className="rounded-xl bg-indigo-600 p-2 text-white"><Truck className="h-5 w-5" /></span>
        <div><p className="font-bold leading-tight">Bangor Logistics</p><p className="text-xs text-slate-500">Monitor distribusi</p></div>
        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <button onClick={() => setProfileOpen(true)} className="flex items-center gap-2 rounded-xl px-2 py-1 text-left transition hover:bg-slate-100" title="Ubah profil">
              <span className="relative shrink-0">
                <UserCircle className="h-7 w-7 text-slate-400" />
                {myPresence && <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${myPresence.dot}`} title={myPresence.label} />}
              </span>
              <span className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-700 max-w-[160px]">{user.display_name || user.full_name || user.email}</p>
                <p className="text-[11px] text-slate-400">{statusLabel}</p>
                {myPresence && <p className={`text-[11px] font-medium ${myPresence.text}`}>{myPresence.label}</p>}
                {user.job_title && <p className="truncate text-[11px] text-slate-400 max-w-[160px]">{user.job_title}</p>}
              </span>
            </button>
          ) : publicMode ? (
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-700">Public</p>
              <p className="text-[11px] text-slate-400">{statusLabel}</p>
            </div>
          ) : null}
          {user ? (
            <button onClick={() => logout()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Keluar</span></button>
          ) : publicMode ? (
            <Link to="/login" className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"><LogIn className="h-4 w-4" /><span className="hidden sm:inline">Masuk</span></Link>
          ) : null}
        </div>
      </div>
    </header>
    <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10"><WarehouseFilterProvider><DashboardDateProvider><ShipmentsDateProvider><Outlet /></ShipmentsDateProvider></DashboardDateProvider></WarehouseFilterProvider></main>
    <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-center" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="mb-3 flex max-w-[calc(100vw-1.5rem)] gap-0.5 overflow-x-auto rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-lg backdrop-blur scrollbar-hide sm:mb-5 sm:gap-1">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium transition sm:px-3.5 sm:py-2.5 sm:text-sm ${isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`}>
            <Icon className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
    {profileOpen && <ProfileDialog onClose={() => setProfileOpen(false)} />}
  </div>;
}