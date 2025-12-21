import dotenv from 'dotenv'
import path from 'path'

// Load .env.local explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function checkDify() {
  const apiKey = process.env.DIFY_API_KEY
  // Match the logic in src/app/api/assistant/route.ts
  const apiUrl = process.env.DIFY_BASE_URL || process.env.DIFY_API_URL

  console.log('Checking Dify Configuration...')
  console.log(`URL: ${apiUrl}`)
  console.log(`Key: ${apiKey ? 'Present (Hidden)' : 'Missing'}`)

  if (!apiKey || !apiUrl) {
    console.error('❌ Missing DIFY_API_KEY or DIFY_BASE_URL (or DIFY_API_URL) in environment variables.')
    process.exit(1)
  }

  try {
    // Try to initiate a conversation
    // Changed to streaming because Agent apps often don't support blocking
    const response = await fetch(`${apiUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {
            "user_question": "Ping",
            "context_data": "系統連線測試中...",
            "context": "系統連線測試中..." 
        },
        query: 'Ping',
        response_mode: 'streaming',
        user: 'system-check',
      }),
    })

    if (response.ok) {
      console.log('✅ Connection Successful! (Stream initiated)')
      // Just read a bit of the stream to confirm it's working
      const reader = response.body?.getReader()
      if (reader) {
        const { value } = await reader.read()
        const text = new TextDecoder().decode(value)
        console.log('First chunk received:', text.substring(0, 100) + '...')
      }
    } else {
      console.error(`❌ API Error: ${response.status} ${response.statusText}`)
      const text = await response.text()
      console.error('Details:', text)
    }
  } catch (error) {
    console.error('❌ Network Error:', error)
  }
}

checkDify()
