'use client'

interface ChatSuggestionsProps {
  onSuggestionClick: (suggestion: string) => void
}

export function ChatSuggestions({ onSuggestionClick }: ChatSuggestionsProps) {
  const suggestions = [
    'How do I invite a new member?',
    'What are the different roles?',
    'Explain FGA permissions',
    'How do I reset MFA for a user?',
  ]

  return (
    <div className="grid grid-cols-1 gap-2 w-full max-w-md">
      {suggestions.map((suggestion, index) => (
        <button
          key={index}
          onClick={() => onSuggestionClick(suggestion)}
          className="text-left px-4 py-3 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-colors"
        >
          {suggestion}
        </button>
      ))}
    </div>
  )
}
