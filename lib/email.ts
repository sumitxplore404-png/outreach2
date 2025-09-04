import nodemailer from "nodemailer"
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
  clickEvents?: any[]
}

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

interface EmailOptions {
  to: string
  subject: string
  htmlContent: string
  textContent: string
  smtpEmail: string
  smtpPassword: string
  trackingId: string
  batchId: string
  contactName: string
  trackingBaseUrl: string // Add this to pass your domain
  cc?: string[] // Optional CC recipients array
}

interface ContactData {
  recipient_person_name: string
  recipient_university_name: string
  product_name: string
  cta_goal: string
  product_oneliner: string
  product_core_users: string
  product_features_bulleted: string
  product_outcomes_metrics: string
  product_caselets: string
  recipient_public_notes: string
  recipient_business_map: string
  recipient_icp_geos: string
  recipient_offers: string
  relevant_trigger: string
  recipient_pain: string
  lead_source: string
  prospect_persona: string
}

// Generate hyper-personalized email using OpenAI with detailed prompt
export async function generateEmail(contact: ContactData, apiKey: string): Promise<{
  subjectOptions: string[]
  emailVersionA: string
  emailVersionB: string
  linkedInDM: string
  valueMap: string[]
  assumptions: string[]
} | null> {
  try {
    // Construct the prompt with placeholders filled from contact data
    const prompt = `
Hyper-Personalized B2B Cold Email Generator (${contact.product_name})

You are a senior B2B copywriter and growth PM. Write a concise, high-signal outreach email tailored to the recipient university. Use only the data provided. Do not invent facts. If any input is missing, infer lightly from nearby context (industry, ICP) but flag assumptions in a short notes blockâ€”donâ€™t ask questions.

OBJECTIVE

Primary Goal/CTA: ${contact.cta_goal} (choose the tightest CTA copy for this goal: lead qualification | lead gen | demo call | pilot | license | intro meeting).

Success criteria: 1) feels written only for ${contact.recipient_university_name}, 2) ties their business model to ${contact.product_name} with a present-day trigger, 3) gives 1â€“2 proof metrics, 4) crisp CTA with time options.

PRODUCT CONTEXT (${contact.product_name})

One-liner: ${contact.product_oneliner}

Core users: ${contact.product_core_users}

Top capabilities (keep to 3â€“5): ${contact.product_features_bulleted}

Outcomes / proof (pick the best 1â€“3, numeric if available): ${contact.product_outcomes_metrics}

Select success stories (name + one result): ${contact.product_caselets}

RECIPIENT CONTEXT (Personalization Inputs)

Recipient's Name: ${contact.recipient_person_name}

University: ${contact.recipient_university_name} | Website/LinkedIn notes: ${contact.recipient_public_notes}

Primary/secondary/tertiary businesses: ${contact.recipient_business_map}

ICP they serve & geos: ${contact.recipient_icp_geos}

Current offers/pricing cues (if any): ${contact.recipient_offers}

Recent trigger/trend relevant to them (news, policy, seasonality, intake cycle, tech shift): ${contact.relevant_trigger}

Pain or workflow friction that matches ${contact.product_name}: ${contact.recipient_pain}

Lead source & relationship (cold/warm/referral/event): ${contact.lead_source}

Prospect persona & seniority: ${contact.prospect_persona}

WRITING RULES

Length: 90â€“140 words (email body). No fluff. Lead with university-specific relevance, then the why-now trigger, then ${contact.product_name} fit + one metric, then CTA.

Tone: crisp, helpful, non-salesy, operator-to-operator. Professional etiquette; avoid hype words (â€œrevolutionizeâ€, â€œcutting-edgeâ€).

Make the bridge explicit: â€œBecause you do X for Y, and trend Z is happening, ${contact.product_name}â€™s Aâ†’B lifts metric C.â€

Use one credible number or proof point; keep it believable.

End with a single, low-friction CTA with 2 time slots or a yes/no path.

Optional P.S.: 1 resource link or 1-line case proof (only if provided in inputs).

Make the email HTML-friendly (use <p> tags, <br> for line breaks).

Start with a warm greeting using the recipient's name.

End with 'Warm regards, Foreignadmits | visamonk.ai'.

OUTPUT FORMAT (exactly this order)

Subject (3 options) â€” â‰¤7 words each, specific to ${contact.recipient_university_name}

Email (Version A: ROI angle)

Email (Version B: Workflow angle)

LinkedIn DM (â‰¤260 chars)

Value Map (3 bullets) â€” {Recipient Need â†’ ${contact.product_name} feature â†’ Expected lift}

Assumptions/Notes â€” bullet any light inferences you made
`

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that generates hyper-personalized B2B cold emails based on the provided prompt.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 400,
      }),
    })

    if (!response.ok) {
      console.error("OpenAI API error:", response.status, response.statusText)
      return null
    }

    const data = await response.json()
    const emailContent = data.choices[0]?.message?.content?.trim() || null

    if (!emailContent) {
      return null
    }

    // Parse the response content into structured parts
    let subjectOptions: string[] = []
    let emailVersionA = "Error: Could not parse email content. Please try again." // fallback

    // Extract subject options
    const subjectMatch = emailContent.match(/\*\*Subject.*?\*\*\s*(.*?)(?=\*\*|$)/s)
    if (subjectMatch) {
      const optionsText = subjectMatch[1].trim()
      subjectOptions = optionsText.split(/\d+\.\s*/).filter((s: string) => s.trim()).map((s: string) => s.trim())
    }

    // Extract Email Version A
    const emailMatch = emailContent.match(/\*\*Email \(Version A:.*?\)\*\*\s*(.*?)(?=\*\*|$)/s)
    if (emailMatch) {
      emailVersionA = emailMatch[1].trim()
    }

    // Debug logging
    console.log('Parsed subject options:', subjectOptions)
    console.log('Parsed email body length:', emailVersionA.length)
    console.log('Email body preview:', emailVersionA.substring(0, 100) + '...')

    // For now, return only the parsed parts, ignoring the extras
    return {
      subjectOptions: subjectOptions,
      emailVersionA: emailVersionA,
      emailVersionB: "", // Not needed
      linkedInDM: "", // Not needed
      valueMap: [], // Not needed
      assumptions: [], // Not needed
    }
  } catch (error) {
    console.error("Email generation error:", error)
    return null
  }
}

// Create clickable link with tracking
function createTrackingLink(originalUrl: string, trackingId: string, trackingBaseUrl: string): string {
  const encodedUrl = encodeURIComponent(originalUrl)
  return `${trackingBaseUrl}/api/track/click/${trackingId}?url=${encodedUrl}`
}

function addTrackingToEmail(htmlContent: string, trackingId: string, trackingBaseUrl: string): string {
  // Add tracking pixel (1x1 transparent image) that goes through our tracking endpoint
  const trackingPixelUrl = `${trackingBaseUrl}/api/track/open?id=${trackingId}`
  const trackingPixel = `<img src="${trackingPixelUrl}" alt="" width="1" height="1" style="display:none !important; visibility:hidden !important; opacity:0 !important; color:transparent !important; height:1px !important; width:1px !important;" border="0" />`

  // Wrap content in proper email HTML structure
  const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Foreign Admits</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .email-content { padding: 20px; }
        .cta-button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #007bff; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 15px 0; 
        }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="email-content">
        ${htmlContent}
        
        <div class="footer">
            <p>Best regards,<br>
            Foreign Admits Team<br>
            <a href="https://visamonk.ai">visamonk.ai</a></p>
            
            <p style="font-size: 10px; color: #999;">
                If you no longer wish to receive these emails, you can 
                <a href="${trackingBaseUrl}/unsubscribe?id=${trackingId}" style="color: #999;">unsubscribe here</a>.
            </p>
        </div>
    </div>
    ${trackingPixel}
</body>
</html>`

  // Replace any existing links with tracking links
  const linkRegex = /<a\s+href=["']([^"']+)["'][^>]*>/gi
  const trackedHtml = emailHtml.replace(linkRegex, (match, url) => {
    // Skip if it's already a tracking link or email/tel link
    if (url.includes('/api/track/') || url.startsWith('mailto:') || url.startsWith('tel:')) {
      return match
    }
    const trackingUrl = createTrackingLink(url, trackingId, trackingBaseUrl)
    return match.replace(url, trackingUrl)
  })

  return trackedHtml
}

// Convert HTML to plain text
function htmlToText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
    .replace(/&amp;/g, '&') // Replace &amp; with &
    .replace(/</g, '<') // Replace < with <
    .replace(/>/g, '>') // Replace > with >
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim()
}

// Send email via SMTP with tracking
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    // Add tracking pixel and links to HTML content
    const trackedHtmlContent = addTrackingToEmail(options.htmlContent, options.trackingId, options.trackingBaseUrl)
    
    // Create plain text version if not provided
    const textContent = options.textContent || htmlToText(options.htmlContent)

    // Determine SMTP provider based on email domain
    const emailDomain = options.smtpEmail.toLowerCase()
    const isOutlook = emailDomain.includes('@outlook.com') || emailDomain.includes('@hotmail.com') || emailDomain.includes('@live.com') || emailDomain.includes('@foreignadmits.com')

    const smtpConfig = isOutlook ? {
      host: "smtp.office365.com",
      port: 587,
      secure: false,
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false
      }
    } : {
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false
      }
    }

    // Create transporter with appropriate SMTP settings
    console.log('Creating SMTP transporter for:', options.smtpEmail, 'using', isOutlook ? 'Outlook' : 'Gmail')
    const transporter = nodemailer.createTransport({
      ...smtpConfig,
      auth: {
        user: options.smtpEmail,
        pass: options.smtpPassword,
      },
      debug: true,
      logger: true
    })

    // Verify SMTP connection
    try {
      await transporter.verify()
      console.log('SMTP connection verified successfully')
    } catch (verifyError: any) {
      console.error('SMTP verification failed:', verifyError)
      throw new Error(`SMTP verification failed: ${verifyError.message}`)
    }

    // Send email
    const mailOptions: any = {
      from: `"Foreign Admits" <${options.smtpEmail}>`,
      to: options.to,
      subject: options.subject,
      text: textContent,
      html: trackedHtmlContent,
      headers: {
        'X-Tracking-ID': options.trackingId, // Custom header for debugging
      },
    }

    // Add CC recipients if provided
    if (options.cc && options.cc.length > 0) {
      mailOptions.cc = options.cc
    }

    const info = await transporter.sendMail(mailOptions)

    console.log('Email sent successfully:', info.messageId)

    // Record tracking info
    await recordEmailSent({
      id: options.trackingId,
      batchId: options.batchId,
      contactName: options.contactName,
      email: options.to, // This is still email for tracking purposes
      sentAt: new Date().toISOString(),
      openCount: 0,
      clickCount: 0,
    })

    return true
  } catch (error) {
    console.error("Email sending error:", error)
    return false
  }
}

// Record email sent for tracking
async function recordEmailSent(record: TrackingRecord): Promise<void> {
  try {
    const dataDir = path.join(process.cwd(), "data")
    try {
      await fs.access(dataDir)
    } catch {
      await fs.mkdir(dataDir, { recursive: true })
    }

    let tracking: TrackingRecord[] = []
    try {
      const data = await fs.readFile(TRACKING_FILE, "utf-8")
      tracking = JSON.parse(data)
    } catch {
      // File doesn't exist, start with empty array
    }

    tracking.push(record)
    await fs.writeFile(TRACKING_FILE, JSON.stringify(tracking, null, 2))
  } catch (error) {
    console.error("Failed to record email tracking:", error)
  }
}

// Get tracking records for a batch
export async function getBatchTracking(batchId: string): Promise<TrackingRecord[]> {
  try {
    const data = await fs.readFile(TRACKING_FILE, "utf-8")
    const tracking: TrackingRecord[] = JSON.parse(data)
    return tracking.filter((record) => record.batchId === batchId)
  } catch {
    return []
  }
}

// Get all tracking records
export async function getAllTracking(): Promise<TrackingRecord[]> {
  try {
    const data = await fs.readFile(TRACKING_FILE, "utf-8")
    return JSON.parse(data)
  } catch {
    return []
  }
}

// Get tracking statistics for a batch
export async function getBatchStats(batchId: string): Promise<{
  totalSent: number
  totalOpened: number
  totalClicked: number
  openRate: number
  clickRate: number
  records: TrackingRecord[]
}> {
  const records = await getBatchTracking(batchId)
  
  const totalSent = records.length
  const totalOpened = records.filter(r => r.openCount > 0).length
  const totalClicked = records.filter(r => (r.clickCount || 0) > 0).length
  
  return {
    totalSent,
    totalOpened,
    totalClicked,
    openRate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
    clickRate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0,
    records
  }
}