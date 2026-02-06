'use client'

import { CheckCircleIcon, XCircleIcon, ArrowRightIcon, PlusCircleIcon, MinusCircleIcon } from '@heroicons/react/24/solid'
import { UserCircleIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline'

interface FGAActivity {
  id: string
  timestamp: number
  type: 'check' | 'write' | 'delete'
  operation: string
  user: string
  relation: string
  object: string
  result?: boolean
  error?: string
}

interface FGARelationshipFlowProps {
  activity: FGAActivity
}

export function FGARelationshipFlow({ activity }: FGARelationshipFlowProps) {
  const truncate = (str: string, length: number = 15) => {
    // Extract the actual ID from formatted strings
    const match = str.match(/:([\w|]+)/)
    const actualId = match ? match[1] : str

    if (actualId.length <= length) return actualId
    return actualId.substring(0, length) + '...'
  }

  const getOperationIcon = () => {
    switch (activity.type) {
      case 'check':
        if (activity.error) {
          return <XCircleIcon className="w-6 h-6 text-red-500" />
        }
        return activity.result ? (
          <CheckCircleIcon className="w-6 h-6 text-green-500" />
        ) : (
          <XCircleIcon className="w-6 h-6 text-gray-400" />
        )
      case 'write':
        return <PlusCircleIcon className="w-6 h-6 text-green-500" />
      case 'delete':
        return <MinusCircleIcon className="w-6 h-6 text-red-500" />
    }
  }

  const getFlowColor = () => {
    if (activity.error) return 'border-red-300 bg-red-50'

    switch (activity.type) {
      case 'check':
        return activity.result
          ? 'border-green-300 bg-green-50'
          : 'border-gray-300 bg-gray-50'
      case 'write':
        return 'border-green-300 bg-green-50'
      case 'delete':
        return 'border-red-300 bg-red-50'
      default:
        return 'border-gray-300 bg-gray-50'
    }
  }

  const getArrowColor = () => {
    if (activity.error) return 'text-red-400'

    switch (activity.type) {
      case 'check':
        return activity.result ? 'text-green-400' : 'text-gray-400'
      case 'write':
        return 'text-green-400'
      case 'delete':
        return 'text-red-400'
      default:
        return 'text-gray-400'
    }
  }

  const getResultBadge = () => {
    if (activity.error) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-800">
          Error
        </span>
      )
    }

    switch (activity.type) {
      case 'check':
        return activity.result ? (
          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
            ✓ Allowed
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600">
            ✗ Denied
          </span>
        )
      case 'write':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
            + Created
          </span>
        )
      case 'delete':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-800">
            - Removed
          </span>
        )
    }
  }

  return (
    <div className={`relative p-4 rounded-lg border-2 ${getFlowColor()}`}>
      {/* Flow Diagram */}
      <div className="flex items-center justify-between gap-3">
        {/* User Node */}
        <div className="flex flex-col items-center min-w-0 flex-1">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white border-2 border-blue-500 mb-2">
            <UserCircleIcon className="w-7 h-7 text-blue-600" />
          </div>
          <div className="text-xs font-medium text-gray-700 text-center">User</div>
          <div className="text-xs font-mono text-gray-600 truncate max-w-full">
            {truncate(activity.user)}
          </div>
        </div>

        {/* Relation/Arrow */}
        <div className="flex flex-col items-center justify-center min-w-0 flex-1">
          <div className={`flex items-center gap-2 ${getArrowColor()}`}>
            <div className="h-0.5 w-8 bg-current" />
            <ArrowRightIcon className="w-5 h-5" />
            <div className="h-0.5 w-8 bg-current" />
          </div>
          <div className="mt-2 px-3 py-1 rounded-full bg-white border-2 border-gray-300">
            <span className="text-xs font-mono font-semibold text-gray-900">
              {activity.relation}
            </span>
          </div>
        </div>

        {/* Organization Node */}
        <div className="flex flex-col items-center min-w-0 flex-1">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white border-2 border-purple-500 mb-2">
            <BuildingOfficeIcon className="w-7 h-7 text-purple-600" />
          </div>
          <div className="text-xs font-medium text-gray-700 text-center">Organization</div>
          <div className="text-xs font-mono text-gray-600 truncate max-w-full">
            {truncate(activity.object)}
          </div>
        </div>

        {/* Result Icon */}
        <div className="flex flex-col items-center justify-center">
          {getOperationIcon()}
          <div className="mt-2">{getResultBadge()}</div>
        </div>
      </div>

      {/* Operation Type Badge */}
      <div className="absolute top-2 right-2">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase ${
            activity.type === 'check'
              ? 'bg-blue-100 text-blue-800'
              : activity.type === 'write'
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {activity.type}
        </span>
      </div>

      {/* Error Message */}
      {activity.error && (
        <div className="mt-3 p-2 bg-red-100 border border-red-200 rounded text-xs text-red-700">
          <span className="font-semibold">Error:</span> {activity.error}
        </div>
      )}
    </div>
  )
}
