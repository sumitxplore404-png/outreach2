import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import fs from "fs/promises"
import path from "path"

const BATCHES_FILE = path.join(process.cwd(), "data", "batches.json")
const TRACKING_FILE = path.join(process.cwd(), "data", "tracking.json")

interface BatchRecord {
  id: string
  uploadTime: string
  totalEmails: number
  delivered: number
  opened: number
}

interface TrackingRecord {
  id: string
  batchId: string
  sentAt: string
  openedAt?: string
  openCount: number
}

export async function GET() {
  try {
    const isAuthenticated = await getSession()
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let batches: BatchRecord[] = []
    let tracking: TrackingRecord[] = []

    // Load batches
    try {
      const batchData = await fs.readFile(BATCHES_FILE, "utf-8")
      batches = JSON.parse(batchData)
    } catch {
      // File doesn't exist
    }

    // Load tracking data
    try {
      const trackingData = await fs.readFile(TRACKING_FILE, "utf-8")
      tracking = JSON.parse(trackingData)
    } catch {
      // File doesn't exist
    }

    // Calculate overall statistics
    const totalSent = batches.reduce((sum, batch) => sum + batch.totalEmails, 0)
    const totalDelivered = batches.reduce((sum, batch) => sum + batch.delivered, 0)
    const totalOpened = batches.reduce((sum, batch) => sum + batch.opened, 0)
    const averageOpenRate = totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0

    // Calculate recent activity (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentBatches = batches.filter((batch) => new Date(batch.uploadTime) >= thirtyDaysAgo)

    const recentSent = recentBatches.reduce((sum, batch) => sum + batch.totalEmails, 0)
    const recentDelivered = recentBatches.reduce((sum, batch) => sum + batch.delivered, 0)
    const recentOpened = recentBatches.reduce((sum, batch) => sum + batch.opened, 0)

    // Calculate delivery rate
    const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0

    return NextResponse.json({
      overview: {
        totalSent,
        totalDelivered,
        totalOpened,
        averageOpenRate: Math.round(averageOpenRate * 10) / 10,
        deliveryRate: Math.round(deliveryRate * 10) / 10,
        totalBatches: batches.length,
        recentActivity: {
          sent: recentSent,
          delivered: recentDelivered,
          opened: recentOpened,
          batches: recentBatches.length,
        },
      },
    })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
