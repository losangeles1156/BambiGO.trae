import { NextRequest, NextResponse } from 'next/server'
import { fsNodeRepo } from '@/lib/services/node-repository'
import { AIContextBuilder } from '@/lib/ai/context-builder'

// Ideally, this would be injected or part of a service container
const contextBuilder = new AIContextBuilder(fsNodeRepo)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const { nodeId } = await params

  // Decode URI component because node IDs often contain colons and dots
  const decodedNodeId = decodeURIComponent(nodeId)

  try {
    const context = await contextBuilder.buildContext(decodedNodeId)
    const facilities = await fsNodeRepo.getFacilities(decodedNodeId)

    return NextResponse.json({
      nodeId: decodedNodeId,
      context_text: context,
      raw_data: facilities,
      meta: {
        source: 'filesystem_cache',
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Error serving AI context:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
