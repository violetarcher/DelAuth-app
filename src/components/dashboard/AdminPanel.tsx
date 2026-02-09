'use client'

import { useState, useEffect } from 'react'
import { MemberList } from '../admin/MemberList'
import { MemberSearch } from '../admin/MemberSearch'
import { FGAActivityPanel } from '../fga/FGAActivityPanel'
import { Button } from '../ui/Button'
import { PlusIcon, UserPlusIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { onMemberEvent, MEMBER_EVENTS } from '@/lib/events/memberEvents'

interface AdminPanelProps {
  userId: string
  organizationId: string
}

export function AdminPanel({ userId, organizationId }: AdminPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

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

      {/* Action Buttons - Always Visible (Pinned) */}
      <div className="bg-gray-50 px-6 pt-4">
        <div className="flex gap-3 items-center">
          <Button
            onClick={() => setInviteModalOpen(true)}
            className="flex items-center gap-2"
          >
            <UserPlusIcon className="h-5 w-5" />
            Invite Member
          </Button>
          <Button
            onClick={() => setAddModalOpen(true)}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            Add Existing Member
          </Button>
          <Button
            onClick={handleRefresh}
            variant="secondary"
            className="flex items-center gap-2"
            title="Refresh member list"
          >
            <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Member List - Scrollable */}
      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6">
        <MemberList
          organizationId={organizationId}
          searchQuery={searchQuery}
          refreshTrigger={refreshTrigger}
          onRefresh={handleRefresh}
          inviteModalOpen={inviteModalOpen}
          setInviteModalOpen={setInviteModalOpen}
          addModalOpen={addModalOpen}
          setAddModalOpen={setAddModalOpen}
        />
      </div>
    </div>
  )
}
