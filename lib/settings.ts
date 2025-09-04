import { supabase } from "./supabase"

export interface Settings {
  openaiApiKey: string
  email: string
  appPassword: string
  ccRecipients?: string // Comma-separated list of CC email addresses
}

export async function getSettings(): Promise<Settings | null> {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('id', '550e8400-e29b-41d4-a716-446655440000')
      .single()

    if (error) {
      console.error("Error fetching settings from Supabase:", error)
      return null
    }

    return {
      openaiApiKey: data.openai_api_key || "",
      email: data.email || "",
      appPassword: data.app_password || "",
      ccRecipients: data.cc_recipients || ""
    }
  } catch (error) {
    console.error("Unexpected error fetching settings:", error)
    return null
  }
}

export async function validateSettings(): Promise<boolean> {
  const settings = await getSettings()
  if (!settings?.openaiApiKey) return false

  // Valid if email and app password are provided
  return !!(settings.email && settings.appPassword)
}
