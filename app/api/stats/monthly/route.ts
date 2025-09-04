import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import fs from "fs/promises"
import path from "path"

const BATCHES_FILE = path.join(process.cwd(), "data", "batches.json")

interface BatchRecord {
  id: string
  uploadTime: string
  csvName: string
  totalEmails: number
  delivered: number
  opened: number
  openRate: number
}

interface MonthlyStats {
  month: string
  sent: number
  delivered: number
  opened: number
  openRate: number
}

export async function GET() {
  try {
    const isAuthenticated = await getSession()
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
      const data = await fs.readFile(BATCHES_FILE, "utf-8")
      const batches: BatchRecord[] = JSON.parse(data)

      // Generate monthly stats for the last 12 months
      const monthlyStats: MonthlyStats[] = []
      const now = new Date()

      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthKey = date.toISOString().slice(0, 7) // YYYY-MM format
        const monthName = date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
        })

        // Filter batches for this month
        const monthBatches = batches.filter((batch) => {
          const batchDate = new Date(batch.uploadTime)
          const batchMonthKey = batchDate.toISOString().slice(0, 7)
          return batchMonthKey === monthKey
        })

        // Calculate totals for the month
        const sent = monthBatches.reduce((sum, batch) => sum + batch.totalEmails, 0)
        const delivered = monthBatches.reduce((sum, batch) => sum + batch.delivered, 0)
        const opened = monthBatches.reduce((sum, batch) => sum + batch.opened, 0)
        const openRate = delivered > 0 ? (opened / delivered) * 100 : 0

        monthlyStats.push({
          month: monthName,
          sent,
          delivered,
          opened,
          openRate: Math.round(openRate * 10) / 10, // Round to 1 decimal place
        })
      }

      return NextResponse.json({ stats: monthlyStats })
    } catch {
      // File doesn't exist, return empty stats
      const monthlyStats: MonthlyStats[] = []
      const now = new Date()

      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthName = date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
        })

        monthlyStats.push({
          month: monthName,
          sent: 0,
          delivered: 0,
          opened: 0,
          openRate: 0,
        })
      }

      return NextResponse.json({ stats: monthlyStats })
    }
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
