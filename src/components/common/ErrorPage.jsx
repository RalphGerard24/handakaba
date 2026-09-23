export default function ErrorPage({ 
  message = "Something went wrong",
  onRetry = null 
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="text-6xl mb-4 text-red-500 font-bold">!</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
        <p className="text-gray-600 mb-6">{message}</p>
        
        <div className="flex gap-3">
          <button
            onClick={() => window.location.href = '/'}
            className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-blue-700"
          >
            Home
          </button>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex-1 bg-gray-200 text-gray-800 px-4 py-3 rounded-lg font-semibold hover:bg-gray-300"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
