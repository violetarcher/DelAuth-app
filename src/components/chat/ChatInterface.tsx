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
      // Filter out CIBA-related system messages from conversation history
      // to prevent OpenAI from thinking previous approvals apply to new operations
      const cleanMessages = messages.filter(msg => {
        if (msg.role === 'assistant' && msg.content) {
          // Remove messages that indicate CIBA approval/verification
          const cibaKeywords = [
            'Guardian Push verification',
            'Guardian Push approved',
            'Executing operation',
            'Sending notification to your phone'
          ]
          const isCIBAMessage = cibaKeywords.some(keyword => msg.content?.includes(keyword))
          if (isCIBAMessage) {
            console.log('🧹 Filtering out CIBA message from context:', msg.content?.substring(0, 50))
          }
          return !isCIBAMessage
        }
        return true
      })

      console.log(`📤 Sending ${cleanMessages.length} messages to OpenAI (filtered ${messages.length - cleanMessages.length} CIBA messages)`)

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...cleanMessages, userMessage],
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

      // Auto-refresh disabled - user will manually refresh
      // Show reminder to refresh after successful operations
      const successOperations = [
        'Successfully added',
        'added **',
        'removed from',
        'Removed',
        'Roles updated',
        'deleted from',
        'Deleted',
      ]

      const isSuccessOperation = successOperations.some((op) =>
        assistantMessage.includes(op)
      )

      if (isSuccessOperation) {
        toast('Click the Refresh button to see updated member list', {
          duration: 3000,
          icon: '🔄',
        })
      }
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

  const handleCIBAApprove = async () => {
    if (!cibaRequest) return

    try {
      setLoading(true)

      // Show loading toast
      const toastId = toast.loading('Sending Guardian Push notification to your phone...')

      // Call CIBA endpoint to initiate Guardian Push
      const response = await fetch('/api/ciba/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: cibaRequest.operation,
          targetUserId: cibaRequest.data?.userId,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // CIBA approved!
        toast.success('Guardian Push approved! Executing operation...', { id: toastId })

        // Resend the message with CIBA verification flag
        await handleSend(cibaRequest.pendingMessage, true)
        setCibaRequest(null)
      } else {
        // CIBA failed or denied
        toast.error(
          data.error_description || 'Guardian Push was denied or timed out',
          { id: toastId }
        )

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Operation cancelled: ${data.error_description || 'Guardian Push not approved'}`,
          },
        ])

        setCibaRequest(null)
      }
    } catch (error) {
      console.error('CIBA approval error:', error)
      toast.error('Failed to initiate Guardian Push. Please try again.')
    } finally {
      setLoading(false)
    }
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

  const handleRoleSelect = (roles: string[]) => {
    // Format roles as comma-separated string and send as user response
    const rolesString = roles.join(', ')
    handleSend(rolesString)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col justify-center h-full p-6 space-y-6">
            {/* Welcome Header */}
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                👋 Welcome to your AI Assistant
              </h2>
              <p className="text-sm text-gray-600">
                I can help you manage your organization members and roles. Just ask me in plain English!
              </p>
            </div>

            {/* Capabilities Grid */}
            <div className="grid grid-cols-1 gap-3 max-w-2xl mx-auto w-full">
              {/* View & Info Section */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                  </svg>
                  View & Information
                </h3>
                <ul className="text-xs text-blue-800 space-y-1 ml-6">
                  <li>• List all organization members</li>
                  <li>• Get member profile and details</li>
                  <li>• Check my profile and permissions</li>
                  <li>• View available roles and their permissions</li>
                </ul>
              </div>

              {/* Member Management Section */}
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <h3 className="text-sm font-semibold text-green-900 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z"/>
                  </svg>
                  Member Management
                </h3>
                <ul className="text-xs text-green-800 space-y-1 ml-6">
                  <li>• Invite new members by email</li>
                  <li>• Add existing Auth0 users to organization</li>
                  <li>• Update member roles (requires verification)</li>
                  <li>• Remove members from organization (requires verification)</li>
                  <li>• Permanently delete users (requires verification)</li>
                </ul>
              </div>

              {/* MFA & Security Section */}
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <h3 className="text-sm font-semibold text-purple-900 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd"/>
                  </svg>
                  MFA & Security
                </h3>
                <ul className="text-xs text-purple-800 space-y-1 ml-6">
                  <li>• Check member MFA enrollment status</li>
                  <li>• View enrolled authentication methods</li>
                  <li>• Reset member MFA (requires verification)</li>
                </ul>
              </div>
            </div>

            {/* Example Commands */}
            <div className="max-w-2xl mx-auto w-full">
              <h3 className="text-xs font-semibold text-gray-700 mb-2 text-center">
                💬 Example Commands
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 rounded px-3 py-2 text-gray-600 border border-gray-200">
                  "List all members"
                </div>
                <div className="bg-gray-50 rounded px-3 py-2 text-gray-600 border border-gray-200">
                  "Add john@example.com as admin"
                </div>
                <div className="bg-gray-50 rounded px-3 py-2 text-gray-600 border border-gray-200">
                  "Reset MFA for jane@example.com"
                </div>
                <div className="bg-gray-50 rounded px-3 py-2 text-gray-600 border border-gray-200">
                  "What are my permissions?"
                </div>
              </div>
            </div>

            {/* Note about natural language */}
            <div className="text-center max-w-xl mx-auto">
              <p className="text-xs text-gray-500 italic">
                💡 Tip: You can use emails, names, or user IDs. I'll understand natural language commands!
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <ChatMessage
                key={index}
                message={message}
                onRoleSelect={handleRoleSelect}
              />
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
