import dotenv from 'dotenv'
import path from 'path'

// Load .env.local explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function checkDify() {
  const apiKey = process.env.DIFY_API_KEY
  const apiUrl = process.env.DIFY_API_URL

  console.log('Checking Dify Configuration...')
  console.log(`URL: ${apiUrl}`)
  console.log(`Key: ${apiKey ? 'Present (Hidden)' : 'Missing'}`)

  if (!apiKey || !apiUrl) {
    console.error('❌ Missing DIFY_API_KEY or DIFY_API_URL in environment variables.')
    process.exit(1)
  }

  try {
    // Try to initiate a conversation (lightweight check)
    // We intentionally send a ping message
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
            "context": "系統連線測試中..." // Also add 'context' as variable name might be ambiguous
        },
        query: 'Ping',
        response_mode: 'blocking',
        user: 'system-check',
      }),
    })

    if (response.ok) {
      type DifyResp = { answer?: string }
      const data = await response.json() as DifyResp
      console.log('✅ Connection Successful!')
      console.log('Response:', data.answer ? data.answer.substring(0, 50) + '...' : 'No answer text')
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
