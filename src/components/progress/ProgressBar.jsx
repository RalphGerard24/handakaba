export function ProgressBar({ completed, total, showDetails = true }) {
  // Calculate percentage
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
  
  // Determine color based on percentage
  const getColorClasses = () => {
    if (percentage < 30) {
      return {
        bg: 'bg-red-500',
        text: 'text-red-700',
        border: 'border-red-200'
      }
    } else if (percentage < 70) {
      return {
        bg: 'bg-yellow-500',
        text: 'text-yellow-700',
        border: 'border-yellow-200'
      }
    } else {
      return {
        bg: 'bg-green-500',
        text: 'text-green-700',
        border: 'border-green-200'
      }
    }
  }
  
  const colors = getColorClasses()
  
  return (
    <div className="space-y-2">
      {/* Stats Row */}
      {showDetails && (
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-gray-900">
              {completed}/{total}
            </span>
            <span className="text-sm font-medium text-gray-600">
              items complete
            </span>
          </div>
          
          <div className={`
            ${colors.text} 
            text-3xl font-bold
          `}>
            {percentage}%
          </div>
        </div>
      )}
      
      {/* Progress Bar */}
      <div className={`
        w-full bg-gray-200 rounded-full h-6 overflow-hidden
        border-2 ${colors.border}
      `}>
        <div 
          className={`
            ${colors.bg} 
            h-full rounded-full 
            transition-all duration-500 ease-out
            flex items-center justify-center
          `}
          style={{ width: `${percentage}%` }}
        >
          {percentage > 10 && (
            <span className="text-xs font-bold text-white px-2">
              {percentage}%
            </span>
          )}
        </div>
      </div>
      
      {/* Status Message */}
      {showDetails && (
        <div className="text-sm text-gray-600 text-center">
          {percentage === 100 && (
            <span className="text-green-600 font-semibold">
               Congratulations! You're fully prepared!
            </span>
          )}
          {percentage >= 70 && percentage < 100 && (
            <span className="text-green-600">
              reat progress! Almost there!
            </span>
          )}
          {percentage >= 30 && percentage < 70 && (
            <span className="text-yellow-600">
               Keep going! You're halfway there.
            </span>
          )}
          {percentage < 30 && (
            <span className="text-red-600">
               Let's get started on your preparedness journey!
            </span>
          )}
        </div>
      )}
    </div>
  )
}