'use client'

import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'

interface ProfileCardProps {
  user: any
}

export function ProfileCard({ user }: ProfileCardProps) {
  return (
    <Card>
      <div className="flex items-start gap-6">
        {/* Avatar */}
        {user.picture ? (
          <img
            src={user.picture}
            alt={user.name || user.email}
            className="h-24 w-24 rounded-full"
          />
        ) : (
          <div className="h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-blue-600 font-semibold text-3xl">
              {(user.name || user.email).charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* User Info */}
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">
            {user.name || 'No name'}
          </h2>
          <p className="text-gray-600 mt-1">{user.email}</p>

          {user.email_verified && (
            <Badge variant="success" size="sm" className="mt-2">
              Email Verified
            </Badge>
          )}

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">User ID:</span>
              <p className="font-mono text-xs mt-1 break-all">{user.sub}</p>
            </div>

            {user.org_id && (
              <div>
                <span className="text-gray-500">Organization ID:</span>
                <p className="font-mono text-xs mt-1 break-all">{user.org_id}</p>
              </div>
            )}

            {user.nickname && (
              <div>
                <span className="text-gray-500">Nickname:</span>
                <p className="mt-1">{user.nickname}</p>
              </div>
            )}

            {user.updated_at && (
              <div>
                <span className="text-gray-500">Updated:</span>
                <p className="mt-1">
                  {new Date(user.updated_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          {/* Roles */}
          {user.roles && user.roles.length > 0 && (
            <div className="mt-4">
              <span className="text-sm text-gray-500 block mb-2">Roles:</span>
              <div className="flex flex-wrap gap-2">
                {user.roles.map((role: string) => (
                  <Badge key={role} variant="primary" size="sm">
                    {role.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
