'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AICommand, AIControlInterface } from '@/lib/ai/control/types'
import { aiClient, AIMessage } from '@/lib/ai/AIClient'

type UseAIControlOptions = {
  enabled?: boolean
}

export function useAIControl(onCommand?: (cmd: AICommand) => void, options?: UseAIControlOptions): AIControlInterface {
  const [internalStatus, setInternalStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected')
  const [lastCommand, setLastCommand] = useState<AICommand | null>(null)
  const onCommandRef = useRef(onCommand)
  const enabled = options?.enabled ?? true

  useEffect(() => {
    onCommandRef.current = onCommand
  }, [onCommand])

  useEffect(() => {
    if (!enabled) return

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInternalStatus('connecting')
    aiClient.connect()

    const handleStatus = (_: string, s: string) => {
      setInternalStatus(s === 'connected' ? 'connected' : 'disconnected')
    }

    const handleMessage = (_: string, msg: AIMessage) => {
      if (msg.command) {
        setLastCommand(msg.command)
        onCommandRef.current?.(msg.command)
      }
    }

    const unsubStatus = aiClient.on('status', handleStatus)
    const unsubMessage = aiClient.on('message', handleMessage)

    return () => {
      unsubStatus()
      unsubMessage()
    }
  }, [enabled])

  const sendCommand = useCallback((cmd: AICommand) => {
    console.log('[Matrix AI] Sending Command:', cmd)
    // In a real scenario, we'd send a structured JSON. 
    // Here we wrap it in a text message for the chat-based mock backend
    aiClient.send(`EXECUTE: ${JSON.stringify(cmd)}`)
  }, [])

  const status = enabled ? internalStatus : 'disconnected'

  return {
    status,
    lastCommand,
    sendCommand
  }
}
