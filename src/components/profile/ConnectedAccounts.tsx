'use client'

import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'

interface ConnectedAccountsProps {
  identities?: any[]
}

export function ConnectedAccounts({ identities = [] }: ConnectedAccountsProps) {
  if (!identities || identities.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Connected Accounts
        </h3>
        <p className="text-sm text-gray-500">No connected accounts</p>
      </Card>
    )
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Connected Accounts
      </h3>
      <div className="space-y-3">
        {identities.map((identity, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
          >
            <div>
              <p className="font-medium text-gray-900">{identity.connection}</p>
              {identity.provider && (
                <p className="text-sm text-gray-500">
                  Provider: {identity.provider}
                </p>
              )}
            </div>
            {identity.isSocial && (
              <Badge variant="info" size="sm">
                Social
              </Badge>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}
