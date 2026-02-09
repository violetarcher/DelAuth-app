'use client'

import { useState, useEffect } from 'react'
import { MemberList } from '../admin/MemberList'
import { MemberSearch } from '../admin/MemberSearch'
import { FGAActivityPanel } from '../fga/FGAActivityPanel'
import { onMemberEvent, MEMBER_EVENTS } from '@/lib/events/memberEvents'

interface AdminPanelProps {
  userId: string
  organizationId: string
}

export function AdminPanel({ userId, organizationId }: AdminPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleRefresh = () => {
    console.log('🔄 AdminPanel handleRefresh called, current refreshTrigger:', refreshTrigger)
    setRefreshTrigger((prev) => {
      const newValue = prev + 1
      console.log('✅ refreshTrigger updated:', prev, '→', newValue)
      return newValue
    })
  }

  // Listen for member events from chat operations
  useEffect(() => {
    console.log('👂 AdminPanel setting up event listener for REFRESH_MEMBERS')
    const unsubscribe = onMemberEvent(MEMBER_EVENTS.REFRESH_MEMBERS, () => {
      console.log('🔔 AdminPanel received REFRESH_MEMBERS event!')
      handleRefresh()
    })

    return () => {
      console.log('🧹 AdminPanel cleaning up event listener')
      unsubscribe()
    }
  }, [])

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Member Management
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage organization members and their roles
        </p>
      </div>

      {/* FGA Activity Monitor - Always Visible (Pinned) */}
      <div className="bg-gray-50 px-6 pt-6">
        <FGAActivityPanel />
      </div>

      {/* Search - Always Visible (Pinned) */}
      <div className="bg-gray-50 px-6 pt-4">
        <MemberSearch
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>

      {/* Member List - Scrollable */}
      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6">
        <MemberList
          organizationId={organizationId}
          searchQuery={searchQuery}
          refreshTrigger={refreshTrigger}
          onRefresh={handleRefresh}
        />
      </div>
    </div>
  )
}
