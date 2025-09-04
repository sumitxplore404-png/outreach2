import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { supabase } from "@/lib/supabase"

export async function GET() {
  try {
    const isAuthenticated = await getSession()
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get settings from Supabase using singleton pattern
    const { data: settings, error } = await supabase
      .from('settings')
      .select('*')
      .eq('id', '550e8400-e29b-41d4-a716-446655440000')
      .single()

    if (error) {
      console.error('Settings fetch error:', error)
      
      // If no settings found, return empty defaults
      if (error.code === 'PGRST116' || error.message.includes('No rows found')) {
        return NextResponse.json({
          openaiApiKey: "",
          email: "",
          appPassword: "",
          ccRecipients: "",
          hasOpenaiKey: false,
          hasAppPassword: false,
        })
      }
      
      return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
    }

    // Return settings with masked password for security
    const safeSettings = {
      openaiApiKey: settings?.openai_api_key ? "***" + settings.openai_api_key.slice(-4) : "",
      email: settings?.email || "",
      appPassword: settings?.app_password ? "***" + settings.app_password.slice(-4) : "",
      ccRecipients: settings?.cc_recipients || "",
      hasOpenaiKey: !!settings?.openai_api_key,
      hasAppPassword: !!settings?.app_password,
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
      return NextResponse.json({ error: "OpenAI API key, email, and app password are required" }, { status: 400 })
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

    console.log('Attempting to save settings to Supabase...')

    // First try to get existing settings
    const { data: existing } = await supabase
      .from('settings')
      .select('id')
      .eq('id', '550e8400-e29b-41d4-a716-446655440000')
      .single()

    let result

    if (existing) {
      // Update existing settings
      result = await supabase
        .from('settings')
        .update({
          openai_api_key: openaiApiKey,
          email,
          app_password: appPassword,
          cc_recipients: ccRecipients || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', '550e8400-e29b-41d4-a716-446655440000')
    } else {
      // Insert new settings
      result = await supabase
        .from('settings')
        .insert({
          id: '550e8400-e29b-41d4-a716-446655440000',
          openai_api_key: openaiApiKey,
          email,
          app_password: appPassword,
          cc_recipients: ccRecipients || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
    }

    if (result.error) {
      console.error('Supabase settings save error:', result.error)
      return NextResponse.json({ 
        error: `Database error: ${result.error.message}`,
        details: result.error
      }, { status: 500 })
    }

    console.log('Settings saved successfully to Supabase')
    return NextResponse.json({ success: true, message: "Settings saved successfully" })

  } catch (error) {
    console.error('Settings POST error:', error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}