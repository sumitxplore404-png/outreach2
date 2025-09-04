import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getSettings } from "@/lib/settings"
import { getBatch } from "@/lib/batch"
import { generateEmail } from "@/lib/email"
import { v4 as uuidv4 } from "uuid"

interface GeneratedEmail {
  id: string
  contactName: string
  university: string
  email: string
  subject: string
  htmlContent: string
  textContent: string
  trackingId: string
}

export async function POST(request: NextRequest) {
  try {
    const isAuthenticated = await getSession()
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { batchId } = await request.json()

    if (!batchId) {
      return NextResponse.json({ error: "Batch ID is required" }, { status: 400 })
    }

    // Get batch data
    const batch = await getBatch(batchId)
    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 })
    }

    // Get settings
    const settings = await getSettings()
    if (!settings) {
      return NextResponse.json({ error: "Settings not configured" }, { status: 400 })
    }

    const generatedEmails: GeneratedEmail[] = []
    const errors: string[] = []

    // Generate emails for all contacts with valid email addresses
    for (const contact of batch.contacts) {
      // Skip contacts without email addresses
      if (!contact.mail) {
        console.log(`Skipping contact ${contact.name} - no email address provided`)
        continue
      }

      try {
        // Map Contact to ContactData for email generation
        const contactData = {
          recipient_person_name: contact.name,
          recipient_university_name: contact.university,
          product_name: contact.product_name || "VisaMonk.ai",
          cta_goal: contact.cta_goal || "demo call",
          product_oneliner: contact.product_oneliner || "AI copilot that improves visa-interview readiness and counselor throughput.",
          product_core_users: contact.product_core_users || "Study-abroad counselors & agency teams",
          product_features_bulleted: contact.product_features_bulleted || "- Adaptive mock interviews with scoring across Preparedness, Financials, Intent & Credibility\n- Country-specific rubrics & feedback\n- Team dashboard: bottleneck analytics, counselor QA\n- White-label & partner IDs",
          product_outcomes_metrics: contact.product_outcomes_metrics || "- 30–45 min saved per student assessment\n- 20–30% improvement in 'ready for interview' status rates (pilot cohorts)\n- Cut no-show rates by 12–18% with automated prep nudges",
          product_caselets: contact.product_caselets || "- South India agency (40 counselors): standardized QA, throughput +22%\n- Bangladesh partner: faster triage, 17% drop in weak-fit submissions",
          recipient_public_notes: contact.recipient_public_notes || "",
          recipient_business_map: contact.recipient_business_map || "education; research; international student services",
          recipient_icp_geos: contact.recipient_icp_geos || "international students from Asia, Africa",
          recipient_offers: contact.recipient_offers || "scholarships, visa support",
          relevant_trigger: contact.relevant_trigger || "New US visa policy changes, 2025",
          recipient_pain: contact.recipient_pain || "Manual visa interview prep",
          lead_source: contact.lead_source || "Cold outbound via LinkedIn",
          prospect_persona: contact.prospect_persona || contact.designation || "Counselor"
        }

        // Generate personalized email
        const emailContent = await generateEmail(contactData, settings.openaiApiKey)

        if (!emailContent) {
          errors.push(`Failed to generate email for ${contact.name}`)
          continue
        }

        // Create tracking ID
        const trackingId = uuidv4()

        // Log the generated email content for debugging
        console.log(`Generated email for ${contact.name}:`, emailContent)

        const generatedEmail: GeneratedEmail = {
          id: uuidv4(),
          contactName: contact.name,
          university: contact.university,
          email: contact.mail,
          subject: emailContent.subjectOptions.length > 0 ? emailContent.subjectOptions[0] : `A question about international admissions at ${contact.university}`,
          htmlContent: emailContent.emailVersionA,
          textContent: emailContent.emailVersionA.replace(/<[^>]*>/g, ""), // Strip HTML for text version
          trackingId
        }

        generatedEmails.push(generatedEmail)
      } catch (error) {
        errors.push(`Error generating email for ${contact.name}: ${(error as Error).message}`)
      }
    }

    return NextResponse.json({
      success: true,
      generatedEmails,
      total: batch.contacts.length,
      generated: generatedEmails.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully generated ${generatedEmails.length} out of ${batch.contacts.length} emails`,
    })
  } catch (error) {
    console.error("Email generation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
