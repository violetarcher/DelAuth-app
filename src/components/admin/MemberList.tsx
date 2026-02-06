'use client'

import { useEffect, useState } from 'react'
import { MemberCard } from './MemberCard'
import { InviteModal } from './InviteModal'
import { AddMemberModal } from './AddMemberModal'
import { Button } from '../ui/Button'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { ErrorAlert } from '../ui/ErrorAlert'
import { PlusIcon, UserPlusIcon } from '@heroicons/react/24/outline'
import type { Member } from '@/types/member'

interface MemberListProps {
  organizationId: string
  searchQuery: string
  refreshTrigger: number
  onRefresh: () => void
}

export function MemberList({
  organizationId,
  searchQuery,
  refreshTrigger,
  onRefresh,
}: MemberListProps) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)

  useEffect(() => {
    async function fetchMembers() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(
          `/api/management/members?organizationId=${organizationId}`
        )

        if (!response.ok) {
          throw new Error('Failed to fetch members')
        }

        const data = await response.json()
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
      {/* Action Buttons */}
      <div className="flex gap-3">
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
      </div>

      {/* Member Cards */}
      {filteredMembers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">
            {searchQuery ? 'No members found matching your search' : 'No members in this organization'}
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {filteredMembers.map((member) => (
            <MemberCard
              key={member.user_id}
              member={member}
              organizationId={organizationId}
              onUpdate={onRefresh}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <InviteModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        organizationId={organizationId}
        onSuccess={onRefresh}
      />

      <AddMemberModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        organizationId={organizationId}
        onSuccess={onRefresh}
      />
    </div>
  )
}
