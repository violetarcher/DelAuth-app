'use client'

import { useState } from 'react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { EyeIcon, EyeSlashIcon, ClipboardIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface TokenDisplayProps {
  accessToken: string | null
  idToken?: string | null
}

export function TokenDisplay({ accessToken, idToken }: TokenDisplayProps) {
  const [showAccessToken, setShowAccessToken] = useState(false)
  const [showIdToken, setShowIdToken] = useState(false)

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  const decodeJWT = (token: string) => {
    try {
      const base64Url = token.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
      return JSON.parse(jsonPayload)
    } catch (error) {
      return null
    }
  }

  const formatToken = (token: string, show: boolean) => {
    if (show) {
      return token
    }
    return `${token.substring(0, 20)}...${token.substring(token.length - 20)}`
  }

  return (
    <div className="space-y-6">
      {/* Access Token */}
      {accessToken && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Access Token</h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAccessToken(!showAccessToken)}
              >
                {showAccessToken ? (
                  <EyeSlashIcon className="h-5 w-5" />
                ) : (
                  <EyeIcon className="h-5 w-5" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyToClipboard(accessToken, 'Access token')}
              >
                <ClipboardIcon className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="bg-gray-50 rounded-md p-4 font-mono text-xs break-all">
            {formatToken(accessToken, showAccessToken)}
          </div>

          {/* Decoded Token */}
          {showAccessToken && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                Decoded Payload:
              </h4>
              <pre className="bg-gray-50 rounded-md p-4 text-xs overflow-x-auto">
                {JSON.stringify(decodeJWT(accessToken), null, 2)}
              </pre>
            </div>
          )}
        </Card>
      )}

      {/* ID Token */}
      {idToken && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">ID Token</h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowIdToken(!showIdToken)}
              >
                {showIdToken ? (
                  <EyeSlashIcon className="h-5 w-5" />
                ) : (
                  <EyeIcon className="h-5 w-5" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyToClipboard(idToken, 'ID token')}
              >
                <ClipboardIcon className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="bg-gray-50 rounded-md p-4 font-mono text-xs break-all">
            {formatToken(idToken, showIdToken)}
          </div>

          {/* Decoded Token */}
          {showIdToken && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                Decoded Payload:
              </h4>
              <pre className="bg-gray-50 rounded-md p-4 text-xs overflow-x-auto">
                {JSON.stringify(decodeJWT(idToken), null, 2)}
              </pre>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
