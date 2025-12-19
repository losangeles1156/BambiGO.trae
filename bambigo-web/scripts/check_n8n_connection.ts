import dotenv from 'dotenv'
import path from 'path'

// Load .env.local explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function checkN8n() {
  const webhookUrl = process.env.N8N_WEBHOOK_URL

  console.log('Checking n8n Configuration...')
  console.log(`URL: ${webhookUrl || 'Missing'}`)

  if (!webhookUrl) {
    console.error('❌ Missing N8N_WEBHOOK_URL in environment variables.')
    console.log('Please add N8N_WEBHOOK_URL=... to your .env.local file.')
    process.exit(1)
  }

  try {
    console.log('Sending test payload to n8n...')
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BambiGO-Source': 'connection-check',
      },
      body: JSON.stringify({
        query: 'Ping from BambiGO',
        nodeId: 'test-node-id',
        context: '[System Context] This is a connection test.',
        trapAlerts: ['[Alert] This is a test alert.'],
        timestamp: Date.now()
      }),
    })

    if (response.ok) {
      const data = await response.json()
      console.log('✅ Connection Successful!')
      console.log('Response from n8n:', JSON.stringify(data, null, 2))
    } else {
      console.error(`❌ API Error: ${response.status} ${response.statusText}`)
      const text = await response.text()
      console.error('Details:', text)
    }
  } catch (error) {
    console.error('❌ Network Error:', error)
  }
}

checkN8n()
