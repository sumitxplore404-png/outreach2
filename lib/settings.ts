import fs from "fs/promises"
import path from "path"

const SETTINGS_FILE = path.join(process.cwd(), "data", "settings.json")

export interface Settings {
  openaiApiKey: string
  email: string
  appPassword: string
  ccRecipients?: string // Comma-separated list of CC email addresses
}

export async function getSettings(): Promise<Settings | null> {
  try {
    const data = await fs.readFile(SETTINGS_FILE, "utf-8")
    return JSON.parse(data) as Settings
  } catch (error) {
    return null
  }
}

export async function validateSettings(): Promise<boolean> {
  const settings = await getSettings()
  if (!settings?.openaiApiKey) return false

  // Valid if email and app password are provided
  return !!(settings.email && settings.appPassword)
}
