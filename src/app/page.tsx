import Link from 'next/link'
import { getSession } from '@auth0/nextjs-auth0'

export default async function Home() {
  const session = await getSession()
  const user = session?.user

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100">
      <div className="max-w-2xl mx-auto p-8 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          Delegated Administration
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Manage organization members with role-based access control
        </p>

        {user ? (
          <div className="space-y-4">
            <p className="text-lg text-gray-700">
              Welcome back, <span className="font-semibold">{user.name}</span>!
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/dashboard"
                className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                Go to Dashboard
              </Link>
              <Link
                href="/profile"
                className="px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors font-medium"
              >
                View Profile
              </Link>
              <Link
                href="/api/auth/logout"
                className="px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium"
              >
                Logout
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <Link
              href="/api/auth/login"
              className="inline-block px-8 py-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-lg font-medium"
            >
              Sign In
            </Link>
          </div>
        )}

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
            <h3 className="font-semibold text-lg mb-2 text-gray-900">Auth0 FGA</h3>
            <p className="text-gray-600 text-sm">
              Fine-grained authorization with role-based access control
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
            <h3 className="font-semibold text-lg mb-2 text-gray-900">AI Assistant</h3>
            <p className="text-gray-600 text-sm">
              ChatGPT-powered chatbot for intelligent member management
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
            <h3 className="font-semibold text-lg mb-2 text-gray-900">CIBA Auth</h3>
            <p className="text-gray-600 text-sm">
              Guardian Push notifications for secure sensitive operations
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
