import { getSession, getAccessToken } from '@auth0/nextjs-auth0'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ProfileCard } from '@/components/profile/ProfileCard'
import { TokenDisplay } from '@/components/profile/TokenDisplay'

export default async function ProfilePage() {
  const session = await getSession()

  if (!session?.user) {
    redirect('/api/auth/login')
  }

  let accessToken: string | null = null
  try {
    const tokenResult = await getAccessToken()
    accessToken = tokenResult.accessToken || null
  } catch (error) {
    console.error('Error getting access token:', error)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              ← Back to Dashboard
            </Link>
            <Link
              href="/api/auth/logout"
              className="text-sm font-medium text-red-600 hover:text-red-700"
            >
              Logout
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Profile</h1>

        <div className="space-y-6">
          {/* Profile Card */}
          <ProfileCard user={session.user} />

          {/* Token Display */}
          <TokenDisplay
            accessToken={accessToken}
            idToken={session.idToken}
          />
        </div>
      </div>
    </div>
  )
}
