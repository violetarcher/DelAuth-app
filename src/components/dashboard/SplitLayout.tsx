'use client'

import { ReactNode } from 'react'

interface SplitLayoutProps {
  leftPanel: ReactNode
  rightPanel: ReactNode
}

export function SplitLayout({ leftPanel, rightPanel }: SplitLayoutProps) {
  return (
    <div className="flex h-full w-full">
      {/* Left Panel - Admin UI (60%) */}
      <div className="w-[60%] border-r border-gray-200 overflow-y-auto">
        <div className="h-full">{leftPanel}</div>
      </div>

      {/* Right Panel - Chatbot (40%) */}
      <div className="w-[40%] overflow-y-auto">
        <div className="h-full">{rightPanel}</div>
      </div>
    </div>
  )
}
