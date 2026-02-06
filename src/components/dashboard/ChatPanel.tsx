'use client'

import { ChatInterface } from '../chat/ChatInterface'

interface ChatPanelProps {
  organizationId: string
  userId: string
}

export function ChatPanel({ organizationId, userId }: ChatPanelProps) {
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 border-b border-blue-800">
        <h2 className="text-xl font-bold">AI Assistant</h2>
        <p className="mt-1 text-sm text-blue-100">
          Ask me anything about member management
        </p>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 overflow-hidden">
        <ChatInterface organizationId={organizationId} userId={userId} />
      </div>
    </div>
  )
}
