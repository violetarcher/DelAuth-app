'use client'

import { UserIcon } from '@heroicons/react/24/solid'
import { SparklesIcon } from '@heroicons/react/24/outline'
import { RoleSelector } from './RoleSelector'

interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | null
  tool_calls?: any
  tool_call_id?: string
}

interface ChatMessageProps {
  message: Message
  onRoleSelect?: (roles: string[]) => void
}

export function ChatMessage({ message, onRoleSelect }: ChatMessageProps) {
  const isUser = message.role === 'user'

  // Don't render tool messages (internal)
  if (message.role === 'tool' || message.role === 'system') {
    return null
  }

  // Don't render empty messages
  if (!message.content) {
    return null
  }

  // Check if this is a role selection prompt
  const isRoleSelectionPrompt =
    !isUser &&
    message.content.includes('Which role(s) would you like to assign')

  // Extract email from role selection prompt if present
  const emailMatch = isRoleSelectionPrompt
    ? message.content.match(/assign to ([^\s?]+)/)
    : null
  const email = emailMatch ? emailMatch[1] : ''

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
          <SparklesIcon className="w-5 h-5 text-blue-600" />
        </div>
      )}

      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-900'
        }`}
      >
        {isRoleSelectionPrompt ? (
          <>
            <div className="text-sm whitespace-pre-wrap break-words mb-2">
              Which role(s) would you like to assign to <strong>{email}</strong>?
            </div>
            {onRoleSelect && <RoleSelector onSelect={onRoleSelect} />}
          </>
        ) : (
          <div className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
          <UserIcon className="w-5 h-5 text-gray-600" />
        </div>
      )}
    </div>
  )
}
