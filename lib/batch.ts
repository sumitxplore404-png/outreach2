import fs from "fs/promises"
import path from "path"

const BATCHES_FILE = path.join(process.cwd(), "data", "batches.json")

export interface Contact {
  country: string
  "states/city": string
  name: string
  designation: string
  mail: string
  university: string
  // Product context fields
  product_name?: string
  cta_goal?: string
  product_oneliner?: string
  product_core_users?: string
  product_features_bulleted?: string
  product_outcomes_metrics?: string
  product_caselets?: string
  // Recipient context fields
  recipient_public_notes?: string
  recipient_business_map?: string
  recipient_icp_geos?: string
  recipient_offers?: string
  relevant_trigger?: string
  recipient_pain?: string
  lead_source?: string
  prospect_persona?: string
}

export interface BatchRecord {
  id: string
  uploadTime: string
  csvName: string
  totalEmails: number
  delivered: number
  opened: number
  openRate: number
  contacts: Contact[]
}

export async function getBatch(batchId: string): Promise<BatchRecord | null> {
  try {
    const data = await fs.readFile(BATCHES_FILE, "utf-8")
    const batches: BatchRecord[] = JSON.parse(data)
    return batches.find((batch) => batch.id === batchId) || null
  } catch {
    return null
  }
}

export async function updateBatchStats(batchId: string, delivered: number, opened: number): Promise<void> {
  try {
    const data = await fs.readFile(BATCHES_FILE, "utf-8")
    const batches: BatchRecord[] = JSON.parse(data)

    const batchIndex = batches.findIndex((batch) => batch.id === batchId)
    if (batchIndex !== -1) {
      batches[batchIndex].delivered = delivered
      batches[batchIndex].opened = opened
      batches[batchIndex].openRate = delivered > 0 ? (opened / delivered) * 100 : 0

      await fs.writeFile(BATCHES_FILE, JSON.stringify(batches, null, 2))
    }
  } catch (error) {
    console.error("Failed to update batch stats:", error)
  }
}
