const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables')
  console.log('Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase connection...')
  console.log(`URL: ${supabaseUrl}`)
  console.log(`Key: ${supabaseKey.substring(0, 20)}...`)

  try {
    // Test basic connection
    const { data, error } = await supabase.from('settings').select('*').limit(1)

    if (error) {
      console.error('❌ Connection failed:', error.message)
      return false
    }

    console.log('✅ Supabase connection successful!')

    // Test table existence
    console.log('\n🔍 Checking table existence...')

    const tables = ['batches', 'contacts', 'tracking_events', 'settings']

    for (const table of tables) {
      try {
        const { data, error } = await supabase.from(table).select('*').limit(1)
        if (error) {
          console.error(`❌ Table '${table}' not found or not accessible:`, error.message)
        } else {
          console.log(`✅ Table '${table}' exists and is accessible`)
        }
      } catch (err) {
        console.error(`❌ Error checking table '${table}':`, err.message)
      }
    }

    // Test settings table has data
    console.log('\n🔍 Checking settings table...')
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('*')

    if (settingsError) {
      console.error('❌ Error fetching settings:', settingsError.message)
    } else if (settings && settings.length > 0) {
      console.log('✅ Settings table has data:', settings[0])
    } else {
      console.log('⚠️  Settings table is empty, you may need to run the schema SQL')
    }

    return true

  } catch (err) {
    console.error('❌ Unexpected error:', err.message)
    return false
  }
}

// Run the test
testSupabaseConnection().then(success => {
  if (success) {
    console.log('\n🎉 Supabase setup looks good for production deployment!')
  } else {
    console.log('\n❌ Please check your Supabase setup before deploying to production.')
  }
  process.exit(success ? 0 : 1)
})
