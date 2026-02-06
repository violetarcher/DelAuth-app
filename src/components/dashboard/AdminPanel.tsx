'use client'

import { useState } from 'react'
import { MemberList } from '../admin/MemberList'
import { MemberSearch } from '../admin/MemberSearch'
import { FGAActivityPanel } from '../fga/FGAActivityPanel'

interface AdminPanelProps {
  userId: string
  organizationId: string
}

export function AdminPanel({ userId, organizationId }: AdminPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* FGA Activity Monitor - Always Visible */}
        <FGAActivityPanel />

        {/* Search */}
        <MemberSearch
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Member List */}
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
