import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import fs from "fs/promises"
import path from "path"

const BATCHES_FILE = path.join(process.cwd(), "data", "batches.json")
const TRACKING_FILE = path.join(process.cwd(), "data", "tracking.json")

interface BatchRecord {
  id: string
  uploadTime: string
  csvName: string
  totalEmails: number
  delivered: number
  opened: number
  openRate: number
  contacts: any[]
}

interface TrackingRecord {
  id: string
  batchId: string
  sentAt: string
  openedAt?: string
  openCount: number
  email: string
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

      // Sort by upload time (newest first) and remove contact details for privacy
      const sanitizedBatches = batches
        .map(({ contacts, ...batch }) => batch)
        .sort((a, b) => new Date(b.uploadTime).getTime() - new Date(a.uploadTime).getTime())

      return NextResponse.json({ batches: sanitizedBatches })
    } catch {
      // File doesn't exist, return empty array
      return NextResponse.json({ batches: [] })
    }
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const isAuthenticated = await getSession()
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { batchIds }: { batchIds: string[] } = await request.json()

    if (!batchIds || !Array.isArray(batchIds) || batchIds.length === 0) {
      return NextResponse.json({ error: "Invalid batch IDs" }, { status: 400 })
    }

    // Read current batches
    let batches: BatchRecord[] = []
    try {
      const batchData = await fs.readFile(BATCHES_FILE, "utf-8")
      batches = JSON.parse(batchData)
    } catch {
      return NextResponse.json({ error: "No batches found" }, { status: 404 })
    }

    // Read current tracking data
    let tracking: TrackingRecord[] = []
    try {
      const trackingData = await fs.readFile(TRACKING_FILE, "utf-8")
      tracking = JSON.parse(trackingData)
    } catch {
      // Tracking file might not exist, that's okay
    }

    // Filter out batches to delete
    const updatedBatches = batches.filter(batch => !batchIds.includes(batch.id))

    // Filter out tracking records for deleted batches
    const updatedTracking = tracking.filter(record => !batchIds.includes(record.batchId))

    // Write updated data back to files
    await fs.writeFile(BATCHES_FILE, JSON.stringify(updatedBatches, null, 2))
    await fs.writeFile(TRACKING_FILE, JSON.stringify(updatedTracking, null, 2))

    return NextResponse.json({
      message: `Successfully deleted ${batchIds.length} batch(es)`,
      deletedCount: batchIds.length
    })
  } catch (error) {
    console.error("Error deleting batches:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
