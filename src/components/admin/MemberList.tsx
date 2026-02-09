'use client'

import { useEffect, useState } from 'react'
import { MemberCard } from './MemberCard'
import { InviteModal } from './InviteModal'
import { AddMemberModal } from './AddMemberModal'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { ErrorAlert } from '../ui/ErrorAlert'
import type { Member } from '@/types/member'

interface MemberListProps {
  organizationId: string
  searchQuery: string
  refreshTrigger: number
  onRefresh: () => void
  inviteModalOpen: boolean
  setInviteModalOpen: (open: boolean) => void
  addModalOpen: boolean
  setAddModalOpen: (open: boolean) => void
}

export function MemberList({
  organizationId,
  searchQuery,
  refreshTrigger,
  onRefresh,
  inviteModalOpen,
  setInviteModalOpen,
  addModalOpen,
  setAddModalOpen,
}: MemberListProps) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchMembers() {
      try {
        setLoading(true)
        setError(null)

        console.log('🔄 Fetching members (refreshTrigger:', refreshTrigger, ')')

        // Add timestamp to prevent browser caching
        const timestamp = Date.now()
        const response = await fetch(
          `/api/management/members?organizationId=${organizationId}&_t=${timestamp}`,
          {
            cache: 'no-store', // Force fresh fetch, no caching
            headers: {
              'Cache-Control': 'no-cache',
            },
          }
        )

        if (!response.ok) {
          throw new Error('Failed to fetch members')
        }

        const data = await response.json()
        console.log('✅ Members fetched:', data.members?.length, 'members')
        setMembers(data.members || [])
      } catch (err) {
        console.error('Error fetching members:', err)
        setError('Failed to load members')
      } finally {
        setLoading(false)
      }
    }

    fetchMembers()
  }, [organizationId, refreshTrigger])

  const filteredMembers = members.filter((member) => {
    if (!searchQuery) return true

    const query = searchQuery.toLowerCase()
    return (
      member.name?.toLowerCase().includes(query) ||
      member.email.toLowerCase().includes(query) ||
      member.user_id.toLowerCase().includes(query)
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return <ErrorAlert message={error} />
  }

  return (
    <div className="space-y-4">
      {/* Member Cards */}
      {filteredMembers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">
            {searchQuery ? 'No members found matching your search' : 'No members in this organization'}
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {filteredMembers.map((member) => {
            // Include roles in key to force re-render when roles change
            const rolesKey = [...(member.fgaRoles || []), ...(member.roles || [])].sort().join(',')
            const memberKey = `${member.user_id}-${rolesKey}-${refreshTrigger}`

            return (
              <MemberCard
                key={memberKey}
                member={member}
                organizationId={organizationId}
              />
            )
          })}
        </div>
      )}

      {/* Modals */}
      <InviteModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        organizationId={organizationId}
      />

      <AddMemberModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        organizationId={organizationId}
      />
    </div>
  )
}
