import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { validateSettings } from "@/lib/settings"
import { supabase } from "@/lib/supabase"
import { v4 as uuidv4 } from "uuid"

interface CSVRow {
  country: string
  "states/city": string
  name: string
  designation: string
  mail: string
  university: string
}

// Parse CSV content with proper handling of quoted fields and blank rows
function parseCSV(content: string): { contacts: CSVRow[], skippedRows: number } {
  const lines = content.trim().split("\n")
  if (lines.length < 2) {
    throw new Error("CSV must contain at least a header row and one data row")
  }

  // Parse header line with proper CSV parsing
  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase())
  const requiredHeaders = ["country", "states/city", "name", "designation", "mail", "university"]

  // Validate headers - be more flexible with case and spacing
  const headerMap: { [key: string]: string } = {}
  for (const required of requiredHeaders) {
    const foundIndex = headers.findIndex(h =>
      h.replace(/\s+/g, '').includes(required.replace(/\s+/g, ''))
    )
    if (foundIndex === -1) {
      throw new Error(`Missing required column: ${required}. Found headers: ${headers.join(', ')}`)
    }
    headerMap[required] = headers[foundIndex]
  }

  console.log('Header mapping:', headerMap)

  const rows: CSVRow[] = []
  let skippedRows = 0

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()

    // Skip completely empty lines
    if (!line) {
      console.log(`Skipping empty line ${i + 1}`)
      skippedRows++
      continue
    }

    // Parse CSV line with proper quote handling
    const values = parseCSVLine(line)

    // Skip lines with no values or all empty values
    if (values.length === 0 || values.every(v => !v.trim())) {
      console.log(`Skipping blank line ${i + 1}`)
      skippedRows++
      continue
    }

    // Ensure we have at least the required number of columns
    // If fewer columns than headers, pad with empty strings
    while (values.length < headers.length) {
      values.push("")
    }

    // If more columns than headers, truncate (this shouldn't happen with proper CSV)
    if (values.length > headers.length) {
      values.splice(headers.length)
    }

    const row: any = {}
    // Map values using the header mapping
    Object.keys(headerMap).forEach(requiredHeader => {
      const originalHeader = headerMap[requiredHeader]
      const index = headers.indexOf(originalHeader)
      row[requiredHeader] = (values[index] || "").trim()
    })

    // Debug: Log the parsed row
    console.log(`Row ${i + 1} parsed:`, row)

    // Skip rows with empty required fields (country, states/city, name are required)
    if (!row.country || !row["states/city"] || !row.name) {
      console.log(`Skipping row ${i + 1} due to empty required fields. Required: country, states/city, name. Optional: designation, mail, university. Found: ${Object.keys(row).map(k => `${k}: '${row[k]}'`).join(', ')}`)
      skippedRows++
      continue
    }

    // Validate email format (only if mail is provided and not empty)
    if (row.mail && row.mail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(row.mail.trim())) {
        console.log(`Skipping row ${i + 1} due to invalid email format: ${row.mail}`)
        skippedRows++
        continue
      }
    }

    rows.push(row as CSVRow)
  }

  console.log(`CSV processing complete: ${rows.length} valid rows, ${skippedRows} skipped rows`)

  if (rows.length === 0) {
    throw new Error("No valid rows found in CSV. Please ensure your CSV has the required columns (country, states/city, name) and at least one row with valid data.")
  }

  if (rows.length > 1000) {
    throw new Error("Maximum 1000 rows allowed per batch")
  }

  return { contacts: rows, skippedRows }
}

// Parse a single CSV line handling quoted fields properly
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  let i = 0

  while (i < line.length) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"'
        i += 2
        continue
      } else {
        // Toggle quote state
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }

    i++
  }

  // Add the last field
  result.push(current.trim())

  return result
}

// Save batch to Supabase
async function saveBatch(batch: any): Promise<void> {
  const { error } = await supabase
    .from('batches')
    .insert({
      id: batch.id,
      user_id: batch.user_id,
      upload_time: batch.uploadTime,
      csv_name: batch.csvName,
      total_emails: batch.totalEmails,
      delivered: batch.delivered,
      opened: batch.opened,
      clicked: 0,
      open_rate: batch.openRate,
      click_rate: 0,
      contacts: batch.contacts
    })

  if (error) {
    console.error("Error saving batch to Supabase:", error)
    throw new Error("Failed to save batch")
  }
}

export async function POST(request: NextRequest) {
  try {
    const isAuthenticated = await getSession()
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user identifier (using email as user_id for simplicity)
    const userId = "user@example.com" // TODO: Get actual user ID from session

    // Check if settings are configured for this user
    const { data: settings, error } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error || !settings || !settings.openai_api_key || !settings.email || !settings.app_password) {
      return NextResponse.json(
        { error: "Please configure your OpenAI API key and SMTP settings first" },
        { status: 400 },
      )
    }

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json({ error: "File must be a CSV" }, { status: 400 })
    }

    // Read and parse CSV
    const content = await file.text()
    let contacts: CSVRow[]
    let skippedRows = 0

    try {
      const parseResult = parseCSV(content)
      contacts = parseResult.contacts
      skippedRows = parseResult.skippedRows
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 })
    }

    // Create batch record
    const batchId = uuidv4()
    const batch = {
      id: batchId,
      user_id: userId,
      uploadTime: new Date().toISOString(),
      csvName: file.name,
      totalEmails: contacts.length,
      delivered: 0,
      opened: 0,
      openRate: 0,
      contacts,
    }

    // Save batch to storage
    await saveBatch(batch)

    // Return success with batch info
    return NextResponse.json({
      success: true,
      batchId,
      totalContacts: contacts.length,
      skippedRows: skippedRows,
      message: `Successfully processed ${contacts.length} contacts${skippedRows > 0 ? ` (${skippedRows} rows skipped due to missing/invalid data)` : ''}`,
    })
  } catch (error) {
    console.error("Batch processing error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
