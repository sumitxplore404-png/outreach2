"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Settings, Key, Mail, Lock, CheckCircle, AlertCircle, Loader2 } from "lucide-react"

interface SettingsState {
  openaiApiKey: string
  email: string
  appPassword: string
  ccRecipients: string
}

interface SettingsResponse {
  openaiApiKey: string
  email: string
  appPassword: string
  ccRecipients: string
  hasOpenaiKey: boolean
  hasAppPassword: boolean
}

export function DashboardSidebar() {
  const [settings, setSettings] = useState<SettingsState>({
    openaiApiKey: "",
    email: "",
    appPassword: "",
    ccRecipients: "",
  })
  const [originalSettings, setOriginalSettings] = useState<SettingsResponse | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch("/api/settings")
      if (response.ok) {
        const data: SettingsResponse = await response.json()
        setOriginalSettings(data)
        setSettings({
          openaiApiKey: data.hasOpenaiKey ? data.openaiApiKey : "",
          email: data.email || "",
          appPassword: data.hasAppPassword ? data.appPassword : "",
          ccRecipients: data.ccRecipients || "",
        })
      }
    } catch (error) {
      console.error("Failed to load settings:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: keyof SettingsState, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }))
    setSaveStatus("idle")
    setErrorMessage("")
  }

  const handleSaveSettings = async () => {
    if (!settings.openaiApiKey || !settings.email || !settings.appPassword) {
      setSaveStatus("error")
      setErrorMessage("All fields are required")
      return
    }

    // Don't save if values haven't changed and are masked
    const isApiKeyMasked = settings.openaiApiKey.startsWith("***")
    const isPasswordMasked = settings.appPassword.startsWith("***")

    if (isApiKeyMasked && isPasswordMasked && (settings.email === originalSettings?.email && settings.ccRecipients === originalSettings?.ccRecipients)) {
      setSaveStatus("error")
      setErrorMessage("No changes detected. Please enter new values to update.")
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      })

      const data = await response.json()

      if (response.ok) {
        setSaveStatus("success")
        setErrorMessage("")
        // Reload settings to get the masked values
        await loadSettings()
      } else {
        setSaveStatus("error")
        setErrorMessage(data.error || "Failed to save settings")
      }
    } catch (error) {
      setSaveStatus("error")
      setErrorMessage("Network error. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <aside className="w-80 bg-sidebar border-r border-sidebar-border p-6 overflow-y-auto">
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-sidebar-foreground" />
            <h2 className="text-lg font-semibold text-sidebar-foreground">Settings</h2>
          </div>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading settings...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </aside>
    )
  }

  return (
    <aside className="w-80 bg-sidebar border-r border-sidebar-border p-6 overflow-y-auto">
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-sidebar-foreground" />
          <h2 className="text-lg font-semibold text-sidebar-foreground">Settings</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuration</CardTitle>
            <CardDescription>Configure your API keys and SMTP settings for email campaigns</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openai-key" className="text-sm font-medium">
                OpenAI API Key
              </Label>
              <div className="relative">
                <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="openai-key"
                  type="password"
                  placeholder={originalSettings?.hasOpenaiKey ? "API key is set" : "sk-..."}
                  value={settings.openaiApiKey}
                  onChange={(e) => handleInputChange("openaiApiKey", e.target.value)}
                  className="pl-10"
                />
              </div>
              {originalSettings?.hasOpenaiKey && (
                <p className="text-xs text-muted-foreground">Current key: {originalSettings.openaiApiKey}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your-email@gmail.com or your-email@outlook.com"
                  value={settings.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Use Gmail or Outlook/Microsoft email address
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="app-password" className="text-sm font-medium">
                App Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="app-password"
                  type="password"
                  placeholder={originalSettings?.hasAppPassword ? "Password is set" : "App password"}
                  value={settings.appPassword}
                  onChange={(e) => handleInputChange("appPassword", e.target.value)}
                  className="pl-10"
                />
              </div>
              {originalSettings?.hasAppPassword && (
                <p className="text-xs text-muted-foreground">Current password: {originalSettings.appPassword}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cc-recipients" className="text-sm font-medium">
                CC Recipients
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="cc-recipients"
                  type="text"
                  placeholder="cc@example.com, cc2@example.com"
                  value={settings.ccRecipients || ""}
                  onChange={(e) => handleInputChange("ccRecipients", e.target.value)}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Comma-separated email addresses to CC on all sent emails
              </p>
            </div>

            {saveStatus === "success" && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">Settings saved successfully!</AlertDescription>
              </Alert>
            )}

            {saveStatus === "error" && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <Button onClick={handleSaveSettings} disabled={isSaving} className="w-full">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Settings"
              )}
            </Button>

            <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
              <p className="font-medium">Email Setup Instructions:</p>
              <p><strong>For Gmail:</strong></p>
              <p>1. Enable 2-factor authentication</p>
              <p>2. Generate App Password in Google Account settings</p>
              <p>3. Use the 16-character App Password</p>
              <p><strong>For Outlook/Microsoft:</strong></p>
              <p>1. Enable 2-factor authentication</p>
              <p>2. Generate App Password in Microsoft Account settings</p>
              <p>3. Use the generated App Password</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </aside>
  )
}
