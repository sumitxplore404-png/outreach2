import { type NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

const TRACKING_FILE = path.join(process.cwd(), "data", "tracking.json")

interface TrackingRecord {
  id: string
  batchId: string
  contactName: string
  email: string
  sentAt: string
  openedAt?: string
  openCount: number
  clickCount?: number
  openEvents?: OpenEvent[]
}

interface OpenEvent {
  timestamp: string
  ipAddress?: string
  userAgent?: string
  isGenuine?: boolean
}

// Get client IP address from request
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp
  }

  // For local development/testing
  return '127.0.0.1'
}

// Check if the open is genuine (not from bots, prefetchers, etc.)
function isGenuineOpen(userAgent: string | null, ipAddress: string): boolean {
  if (!userAgent) return false;

  const ua = userAgent.toLowerCase();

  // Known bot/prefetcher user agents to filter out
  const botPatterns = [
    'googleimageproxy',
    'cloudmark',
    'symantec',
    'mimecast',
    'proofpoint',
    'barracuda',
    'spam',
    'filter',
    'crawler',
    'bot',
    'spider',
    'preview',
    'monitoring',
    'validator',
    'checker',
    'scanner',
    'monitor',
    'prefetch',
    'preload'
  ];

  // Check for bot patterns
  for (const pattern of botPatterns) {
    if (ua.includes(pattern)) {
      return false;
    }
  }

  // Gmail image proxy detection
  if (ua.includes('googleimageproxy')) {
    return false;
  }

  // Check for local/internal IPs that might be testing
  if (ipAddress === '127.0.0.1' ||
      ipAddress.startsWith('192.168.') ||
      ipAddress.startsWith('10.') ||
      ipAddress.startsWith('172.16.') ||
      ipAddress === '::1') {
    return false;
  }

  return true;
}

// Update batch open statistics
async function updateBatchOpenStats(batchId: string): Promise<void> {
  try {
    const batchesFile = path.join(process.cwd(), "data", "batches.json")

    // Check if batches file exists
    try {
      await fs.access(batchesFile)
    } catch {
      // Batches file doesn't exist, skip update
      return
    }

    const trackingData = await fs.readFile(TRACKING_FILE, "utf-8")
    const tracking: TrackingRecord[] = JSON.parse(trackingData)

    // Count unique opens for this batch
    const batchTracking = tracking.filter((record) => record.batchId === batchId)
    const uniqueOpens = batchTracking.filter((record) => record.openCount > 0).length
    const totalDelivered = batchTracking.length

    // Update batch record
    const batchData = await fs.readFile(batchesFile, "utf-8")
    const batches = JSON.parse(batchData)

    const batchIndex = batches.findIndex((batch: any) => batch.id === batchId)
    if (batchIndex !== -1) {
      batches[batchIndex].opened = uniqueOpens
      batches[batchIndex].openRate = totalDelivered > 0 ? (uniqueOpens / totalDelivered) * 100 : 0

      await fs.writeFile(batchesFile, JSON.stringify(batches, null, 2))
    }
  } catch (error) {
    console.error("Failed to update batch open stats:", error)
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const trackingId = url.searchParams.get('id')

  if (!trackingId) {
    // Return the tracking image without tracking if no ID provided
    const imagePath = path.join(process.cwd(), "public", "track_open.png")
    try {
      const imageBuffer = await fs.readFile(imagePath)
      return new NextResponse(new Uint8Array(imageBuffer), {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      })
    } catch {
      // Return a simple 1x1 transparent pixel if image not found
      const pixelData = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
        "base64"
      )
      return new NextResponse(new Uint8Array(pixelData), {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      })
    }
  }

  const timestamp = new Date().toISOString()
  const ipAddress = getClientIP(request)
  const userAgent = request.headers.get('user-agent')
  const isGenuine = isGenuineOpen(userAgent, ipAddress)

  console.log(`Email open tracking - ID: ${trackingId}, IP: ${ipAddress}, Genuine: ${isGenuine}`)

  try {
    // Ensure data directory exists
    const dataDir = path.dirname(TRACKING_FILE)
    await fs.mkdir(dataDir, { recursive: true })

    // Load tracking data
    let tracking: TrackingRecord[] = []
    try {
      const data = await fs.readFile(TRACKING_FILE, "utf-8")
      tracking = JSON.parse(data)
    } catch {
      console.log(`Tracking file not found for ID: ${trackingId}`)
      // Return image anyway
      const imagePath = path.join(process.cwd(), "public", "track_open.png")
      try {
        const imageBuffer = await fs.readFile(imagePath)
        return new NextResponse(new Uint8Array(imageBuffer), {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        })
      } catch {
        const pixelData = Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
          "base64"
        )
        return new NextResponse(new Uint8Array(pixelData), {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        })
      }
    }

    // Find and update tracking record
    const recordIndex = tracking.findIndex((record) => record.id === trackingId)
    if (recordIndex !== -1) {
      const record = tracking[recordIndex]

      // Only count genuine opens
      if (isGenuine) {
        record.openCount = (record.openCount || 0) + 1
        if (!record.openedAt) {
          record.openedAt = timestamp
        }
        console.log(`Genuine email open tracked - ${record.email} (Count: ${record.openCount})`)
      } else {
        console.log(`Bot/prefetch open detected - ${record.email}`)
      }

      // Add open event
      if (!record.openEvents) {
        record.openEvents = []
      }

      record.openEvents.push({
        timestamp,
        ipAddress,
        userAgent: userAgent || undefined,
        isGenuine
      })

      // Save updated tracking
      await fs.writeFile(TRACKING_FILE, JSON.stringify(tracking, null, 2))

      // Update batch statistics
      if (isGenuine) {
        await updateBatchOpenStats(record.batchId)
      }
    }

    // Return the tracking image
    const imagePath = path.join(process.cwd(), "public", "track_open.png")
    try {
      const imageBuffer = await fs.readFile(imagePath)
      return new NextResponse(new Uint8Array(imageBuffer), {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      })
    } catch {
      // Return a simple 1x1 transparent pixel if image not found
      const pixelData = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
        "base64"
      )
      return new NextResponse(new Uint8Array(pixelData), {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      })
    }
  } catch (error) {
    console.error("Tracking error:", error)

    // Always return image even on error
    const imagePath = path.join(process.cwd(), "public", "track_open.png")
    try {
      const imageBuffer = await fs.readFile(imagePath)
      return new NextResponse(new Uint8Array(imageBuffer), {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      })
    } catch {
      const pixelData = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
        "base64"
      )
      return new NextResponse(new Uint8Array(pixelData), {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      })
    }
  }
}
