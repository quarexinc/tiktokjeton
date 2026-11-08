import type { Metadata } from "next";
import { adminKeyConfigured, isAdmin } from "@/lib/auth";
import { readDB } from "@/lib/store";
import Login from "@/components/admin/Login";
import Dashboard from "@/components/admin/Dashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Yönetim paneli | Tiktok Jetonlu Yayın Bulma",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return <Login configured={adminKeyConfigured()} />;
  }
  let storageError: string | null = null;
  let db;
  try {
    db = await readDB();
  } catch (e) {
    console.error(e);
    storageError = "Depolamaya ulaşılamadı. Vercel Blob bağlantısını kontrol et.";
    db = { streams: [], settings: { announcement: "", showPast: true, pastLimit: 24 } };
  }
  return <Dashboard initial={{ ...db, now: Date.now() }} storageError={storageError} />;
}
