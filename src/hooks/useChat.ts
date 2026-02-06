'use client'

import { useState, useCallback } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function useChat(organizationId: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(
    async (content: string) => {
      const userMessage: Message = { role: 'user', content }

      try {
        setLoading(true)
        setError(null)
        setMessages((prev) => [...prev, userMessage])

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...messages, userMessage],
            organizationId,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to get response')
        }

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()

        if (!reader) {
          throw new Error('No reader available')
        }

        let assistantMessage = ''
        setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          assistantMessage += chunk

          setMessages((prev) => {
            const newMessages = [...prev]
            newMessages[newMessages.length - 1] = {
              role: 'assistant',
              content: assistantMessage,
            }
            return newMessages
          })
        }
      } catch (err) {
        console.error('Chat error:', err)
        setError('Failed to send message')
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Sorry, I encountered an error. Please try again.',
          },
        ])
      } finally {
        setLoading(false)
      }
    },
    [messages, organizationId]
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return {
    messages,
    loading,
    error,
    sendMessage,
    clearMessages,
  }
}
