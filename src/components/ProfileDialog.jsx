import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

export default function ProfileDialog({ onClose }) {
  const { user, checkUserAuth, logout } = useAuth();
  const [name, setName] = useState(user?.display_name || user?.full_name || "");
  const [job, setJob] = useState(user?.job_title || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      await base44.functions.invoke("manageUsers", { action: "deleteSelf" });
      await logout();
    } catch (e) {
      setError(e?.message || "Gagal menghapus akun.");
      setDeleting(false);
      setShowDelete(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await base44.auth.updateMe({ display_name: name.trim(), job_title: job.trim() });
      await checkUserAuth();
      onClose();
    } catch (e) {
      setError(e?.message || "Gagal menyimpan profil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Profil Pengguna</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm font-medium">Nama
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama tampilan" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
          </label>
          <label className="block text-sm font-medium">Fungsi Kerja
            <input value={job} onChange={(e) => setJob(e.target.value)} placeholder="contoh: Checker, Admin Gudang, Driver..." className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
          </label>
          <p className="text-xs text-slate-400">Email: {user?.email || "-"}</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Batal</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
        </DialogFooter>
        <div className="border-t border-slate-100 pt-3">
          <Button variant="ghost" onClick={() => setShowDelete(true)} className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="mr-2 h-4 w-4" />Hapus Akun</Button>
        </div>
      </DialogContent>
    </Dialog>
    <AlertDialog open={showDelete} onOpenChange={(o) => !o && setShowDelete(false)}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Hapus akun ini?</AlertDialogTitle><AlertDialogDescription>Akun dan data Anda akan dihapus permanen. Tindakan ini tidak dapat dibatalkan. Anda akan keluar otomatis setelah akun dihapus.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
          <AlertDialogAction onClick={deleteAccount} disabled={deleting} className="bg-red-600 text-white hover:bg-red-700">{deleting ? "Menghapus..." : "Hapus Akun"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}