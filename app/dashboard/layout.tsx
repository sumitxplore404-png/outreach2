import type React from "react"
import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const isAuthenticated = await getSession()

  if (!isAuthenticated) {
    redirect("/login")
  }

  return (
    <div className="h-screen bg-background">
      {children}
    </div>
  )
}
