import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import fs from "fs/promises"
import path from "path"

const SETTINGS_FILE = path.join(process.cwd(), "data", "settings.json")

interface Settings {
  openaiApiKey: string
  email: string
  appPassword: string
  ccRecipients?: string
}

// Ensure data directory exists
async function ensureDataDirectory() {
  const dataDir = path.join(process.cwd(), "data")
  try {
    await fs.access(dataDir)
  } catch {
    await fs.mkdir(dataDir, { recursive: true })
  }
}

// GET - Retrieve settings
export async function GET() {
  try {
    const isAuthenticated = await getSession()
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await ensureDataDirectory()

    try {
      const data = await fs.readFile(SETTINGS_FILE, "utf-8")
      const settings = JSON.parse(data) as Settings

      // Return settings with masked password for security
      return NextResponse.json({
        openaiApiKey: settings.openaiApiKey ? "***" + settings.openaiApiKey.slice(-4) : "",
        email: settings.email,
        appPassword: settings.appPassword ? "***" + settings.appPassword.slice(-4) : "",
        ccRecipients: settings.ccRecipients || "",
        hasOpenaiKey: !!settings.openaiApiKey,
        hasAppPassword: !!settings.appPassword,
      })
    } catch (error) {
      // File doesn't exist or is invalid, return empty settings
      return NextResponse.json({
        openaiApiKey: "",
        smtpEmail: "",
        smtpPassword: "",
        hasOpenaiKey: false,
        hasSmtpPassword: false,
      })
    }
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Save settings
export async function POST(request: NextRequest) {
  try {
    const isAuthenticated = await getSession()
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { openaiApiKey, email, appPassword, ccRecipients } = body

    // Validate required fields
    if (!openaiApiKey || !email || !appPassword) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    // Validate OpenAI API key format
    if (!openaiApiKey.startsWith("sk-")) {
      return NextResponse.json({ error: "Invalid OpenAI API key format" }, { status: 400 })
    }

    await ensureDataDirectory()

    const settings: Settings = {
      openaiApiKey,
      email,
      appPassword,
      ccRecipients,
    }

    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2))

    return NextResponse.json({ success: true, message: "Settings saved successfully" })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
