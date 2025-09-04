import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { supabase, type Settings } from "@/lib/supabase"

export async function GET() {
  try {
    const isAuthenticated = await getSession()
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get settings from Supabase
    const { data: settings, error } = await supabase
      .from('settings')
      .select('*')
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Settings fetch error:', error)
      return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
    }

    // Return settings with masked password for security
    const safeSettings = settings ? {
      openaiApiKey: settings.openai_api_key ? "***" + settings.openai_api_key.slice(-4) : "",
      email: settings.email || "",
      appPassword: settings.app_password ? "***" + settings.app_password.slice(-4) : "",
      ccRecipients: settings.cc_recipients || "",
      hasOpenaiKey: !!settings.openai_api_key,
      hasAppPassword: !!settings.app_password,
    } : {
      openaiApiKey: "",
      email: "",
      appPassword: "",
      ccRecipients: "",
      hasOpenaiKey: false,
      hasAppPassword: false,
    }

    return NextResponse.json(safeSettings)
  } catch (error) {
    console.error('Settings GET error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

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

    // Update or insert settings in Supabase
    const { error } = await supabase
      .from('settings')
      .upsert({
        openai_api_key: openaiApiKey,
        email,
        app_password: appPassword,
        cc_recipients: ccRecipients,
        updated_at: new Date().toISOString()
      })

    if (error) {
      console.error('Settings save error:', error)
      return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Settings saved successfully" })
  } catch (error) {
    console.error('Settings POST error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
