import { requireAdmin } from "@/lib/admin"
import { AdminSidebar } from "@/components/admin/admin-sidebar"

export const metadata = { title: "Admin — ShoppieApp" }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <main className="md:pl-60 pt-14 md:pt-0 min-h-screen">
        {children}
      </main>
    </div>
  )
}
