import { type NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

const TRACKING_FILE = path.join(process.cwd(), "data", "tracking.json")
const TRACKING_LOGS_FILE = path.join(process.cwd(), "data", "tracking-logs.json")

interface OpenEvent {
  timestamp: string
  ipAddress?: string
  userAgent?: string
  country?: string
  region?: string
  city?: string
  deviceType?: string
  browser?: string
  platform?: string
  isGenuine?: boolean
}

interface ClickEvent {
  timestamp: string
  ipAddress?: string
  userAgent?: string
  country?: string
  region?: string
  city?: string
  deviceType?: string
  browser?: string
  platform?: string
  url?: string
  isGenuine?: boolean
}

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
  clickEvents?: ClickEvent[]
}

interface TrackingLog {
  trackingId: string
  timestamp: string
  eventType: 'open' | 'bot_open' | 'click' | 'error'
  ipAddress?: string
  userAgent?: string
  country?: string
  region?: string
  city?: string
  deviceType?: string
  browser?: string
  platform?: string
  error?: string
  isGenuine?: boolean
  url?: string
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

// Parse user agent string to get device and browser info
function parseUserAgent(userAgent: string | null): { deviceType: string; browser: string; platform: string } {
  if (!userAgent) {
    return { deviceType: 'unknown', browser: 'unknown', platform: 'unknown' }
  }

  const ua = userAgent.toLowerCase()
  let deviceType = 'desktop'
  let browser = 'unknown'
  let platform = 'unknown'

  // Device detection
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    deviceType = 'mobile'
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    deviceType = 'tablet'
  }

  // Browser detection
  if (ua.includes('chrome') && !ua.includes('edg')) {
    browser = 'chrome'
  } else if (ua.includes('firefox')) {
    browser = 'firefox'
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser = 'safari'
  } else if (ua.includes('edg')) {
    browser = 'edge'
  } else if (ua.includes('opera')) {
    browser = 'opera'
  }

  // Platform detection
  if (ua.includes('windows')) {
    platform = 'windows'
  } else if (ua.includes('mac')) {
    platform = 'mac'
  } else if (ua.includes('linux')) {
    platform = 'linux'
  } else if (ua.includes('android')) {
    platform = 'android'
  } else if (ua.includes('iphone') || ua.includes('ipad')) {
    platform = 'ios'
  }

  return { deviceType, browser, platform }
}

// Check if the click is genuine (not from bots, prefetchers, etc.)
function isGenuineClick(userAgent: string | null, ipAddress: string): boolean {
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

// Get approximate location from IP (simple implementation)
async function getLocationFromIP(ip: string): Promise<{ country?: string; region?: string; city?: string }> {
  if (ip === 'unknown' || ip === '127.0.0.1' || 
      ip.startsWith('192.168.') || ip.startsWith('10.') || 
      ip.startsWith('172.16.') || ip === '::1') {
    return { country: 'local', region: 'local', city: 'local' }
  }

  try {
    // You can integrate with free IP geolocation services like:
    // - ipapi.co (free tier: 1000 requests/day)
    // - ipinfo.io (free tier: 50,000 requests/month)
    // - geojs.io (free)
    
    // Example with ipapi.co (uncomment to use):
    /*
    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { 'User-Agent': 'Foreign-Admits-Email-Tracker/1.0' },
      timeout: 3000
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        country: data.country_name || 'unknown',
        region: data.region || 'unknown',
        city: data.city || 'unknown'
      };
    }
    */

    // Simple fallback based on IP ranges (for demo purposes)
    if (ip.includes('.') && !ip.includes(':')) {
      // IPv4 - simple country guess based on first octet
      const firstOctet = parseInt(ip.split('.')[0])
      if (firstOctet >= 1 && firstOctet <= 126) return { country: 'US', region: 'North America', city: 'Unknown' }
      if (firstOctet >= 127 && firstOctet <= 191) return { country: 'EU', region: 'Europe', city: 'Unknown' }
      if (firstOctet >= 192 && firstOctet <= 223) return { country: 'AS', region: 'Asia', city: 'Unknown' }
    }
  } catch (error) {
    console.error('Location detection error:', error)
  }

  return { country: 'unknown', region: 'unknown', city: 'unknown' }
}

// Log tracking event
async function logTrackingEvent(log: TrackingLog): Promise<void> {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(TRACKING_LOGS_FILE)
    await fs.mkdir(dataDir, { recursive: true })

    let logs: TrackingLog[] = []
    try {
      const data = await fs.readFile(TRACKING_LOGS_FILE, 'utf-8')
      logs = JSON.parse(data)
    } catch {
      // File doesn't exist, start with empty array
    }

    logs.push(log)
    
    // Keep only last 10000 logs to prevent file from growing too large
    if (logs.length > 10000) {
      logs = logs.slice(-10000)
    }
    
    await fs.writeFile(TRACKING_LOGS_FILE, JSON.stringify(logs, null, 2))
  } catch (error) {
    console.error('Failed to log tracking event:', error)
  }
}

// Update batch click statistics
async function updateBatchClickStats(batchId: string): Promise<void> {
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

    // Count unique clicks for this batch
    const batchTracking = tracking.filter((record) => record.batchId === batchId)
    const uniqueClicks = batchTracking.filter((record) => (record.clickCount || 0) > 0).length
    const totalDelivered = batchTracking.length

    // Update batch record
    const batchData = await fs.readFile(batchesFile, "utf-8")
    const batches = JSON.parse(batchData)

    const batchIndex = batches.findIndex((batch: any) => batch.id === batchId)
    if (batchIndex !== -1) {
      batches[batchIndex].clicked = uniqueClicks
      batches[batchIndex].clickRate = totalDelivered > 0 ? (uniqueClicks / totalDelivered) * 100 : 0

      await fs.writeFile(batchesFile, JSON.stringify(batches, null, 2))
    }
  } catch (error) {
    console.error("Failed to update batch click stats:", error)
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ trackingId: string }> }) {
  const { trackingId } = await params
  const timestamp = new Date().toISOString()
  const ipAddress = getClientIP(request)
  const userAgent = request.headers.get('user-agent')
  const { deviceType, browser, platform } = parseUserAgent(userAgent)
  const location = await getLocationFromIP(ipAddress)
  const url = request.nextUrl.searchParams.get('url') || 'https://visamonk.ai'

  // Log the click attempt immediately
  console.log(`Email click tracking - ID: ${trackingId}, IP: ${ipAddress}, URL: ${url}`)

  try {
    // Check if this is a genuine click (not from bots/prefetchers)
    const isGenuine = isGenuineClick(userAgent, ipAddress)
    
    // Log the tracking attempt
    await logTrackingEvent({
      trackingId,
      timestamp,
      eventType: isGenuine ? 'click' : 'bot_open',
      ipAddress,
      userAgent: userAgent || undefined,
      ...location,
      deviceType,
      browser,
      platform,
      isGenuine,
      url
    })

    // Ensure data directory exists
    const dataDir = path.dirname(TRACKING_FILE)
    await fs.mkdir(dataDir, { recursive: true })

    // Load tracking data
    let tracking: TrackingRecord[] = []
    try {
      const data = await fs.readFile(TRACKING_FILE, "utf-8")
      tracking = JSON.parse(data)
    } catch {
      // File doesn't exist, redirect to original URL
      console.log(`Tracking file not found for click ID: ${trackingId}`)
      return NextResponse.redirect(url)
    }

    // Find and update tracking record
    const recordIndex = tracking.findIndex((record) => record.id === trackingId)
    if (recordIndex !== -1) {
      const record = tracking[recordIndex]

      // Only count genuine clicks (not from bots/prefetchers)
      if (isGenuine) {
        record.clickCount = (record.clickCount || 0) + 1
        console.log(`Genuine email click tracked - ${record.email} (Count: ${record.clickCount})`)
      } else {
        console.log(`Bot/prefetch click detected - ${record.email}`)
      }

      // Always add detailed click event (even for bots for analytics)
      if (!record.clickEvents) {
        record.clickEvents = []
      }
      
      record.clickEvents.push({
        timestamp,
        ipAddress,
        userAgent: userAgent || undefined,
        ...location,
        deviceType,
        browser,
        platform,
        isGenuine,
        url
      })

      // Save updated tracking
      await fs.writeFile(TRACKING_FILE, JSON.stringify(tracking, null, 2))

      // Update batch statistics (only for genuine clicks)
      if (isGenuine) {
        await updateBatchClickStats(record.batchId)
      }
    } else {
      console.log(`Tracking record not found for click ID: ${trackingId}`)
    }

    // Redirect to the original URL
    return NextResponse.redirect(url)
  } catch (error) {
    console.error("Click tracking error:", error)
    
    // Log the error
    await logTrackingEvent({
      trackingId,
      timestamp,
      eventType: 'error',
      ipAddress,
      userAgent: userAgent || undefined,
      error: error instanceof Error ? error.message : 'Unknown error',
      url
    })
    
    // Always redirect even on error
    return NextResponse.redirect(url)
  }
}