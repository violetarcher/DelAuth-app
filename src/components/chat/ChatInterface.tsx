'use client'

import { useState, useRef, useEffect } from 'react'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { ChatSuggestions } from './ChatSuggestions'
import toast from 'react-hot-toast'

interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | null
  tool_calls?: any
  tool_call_id?: string
}

interface ChatInterfaceProps {
  organizationId: string
  userId: string
}

interface CIBARequest {
  operation: string
  data: any
  pendingMessage: string
}

export function ChatInterface({ organizationId, userId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [cibaRequest, setCibaRequest] = useState<CIBARequest | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async (
    message: string,
    cibaVerified: boolean = false
  ) => {
    if (!message.trim() || loading) return

    const userMessage: Message = { role: 'user', content: message }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          organizationId,
          cibaVerified,
        }),
      })

      const contentType = response.headers.get('content-type')

      // Check if response is JSON (CIBA required) or streaming
      if (contentType?.includes('application/json')) {
        const data = await response.json()

        if (data.requiresCIBA) {
          // Store CIBA request
          setCibaRequest({
            operation: data.cibaOperation,
            data: data.operationData,
            pendingMessage: message,
          })

          // Show CIBA message to user
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: data.message,
            },
          ])

          toast.error(
            'Please approve this operation in your Guardian app',
            { duration: 5000 }
          )

          return
        }

        // Handle error response
        if (data.error) {
          throw new Error(data.error)
        }
      }

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      // Read streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No reader available')
      }

      let assistantMessage = ''

      // Add empty assistant message that we'll update
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        assistantMessage += chunk

        // Update the last message (assistant's response)
        setMessages((prev) => {
          const newMessages = [...prev]
          newMessages[newMessages.length - 1] = {
            role: 'assistant',
            content: assistantMessage,
          }
          return newMessages
        })
      }

      // Clear CIBA request after successful completion
      setCibaRequest(null)
    } catch (error) {
      console.error('Chat error:', error)
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
  }

  const handleCIBAApprove = () => {
    if (!cibaRequest) return

    toast.success('Guardian approval simulated (CIBA integration pending)')

    // Resend the message with CIBA verification flag
    handleSend(cibaRequest.pendingMessage, true)
    setCibaRequest(null)
  }

  const handleCIBACancel = () => {
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: 'Operation cancelled.',
      },
    ])
    setCibaRequest(null)
  }

  const handleSuggestionClick = (suggestion: string) => {
    handleSend(suggestion)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Welcome to AI Assistant
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              Ask me anything about managing organization members
            </p>
            <ChatSuggestions onSuggestionClick={handleSuggestionClick} />
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <ChatMessage key={index} message={message} />
            ))}
            {loading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex items-center space-x-2 text-gray-500">
                <div className="animate-pulse">Thinking...</div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* CIBA Verification Panel */}
      {cibaRequest && (
        <div className="border-t border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-yellow-800">
                Guardian Verification Required
              </h3>
              <p className="mt-1 text-sm text-yellow-700">
                Operation: <span className="font-semibold">{cibaRequest.operation}</span>
              </p>
              <p className="mt-1 text-xs text-yellow-600">
                Check your Guardian app to approve this sensitive operation.
              </p>
              <div className="mt-3 flex space-x-3">
                <button
                  onClick={handleCIBAApprove}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Simulate Approval
                </button>
                <button
                  onClick={handleCIBACancel}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-200 p-4">
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={() => handleSend(input)}
          disabled={loading || cibaRequest !== null}
        />
      </div>
    </div>
  )
}
