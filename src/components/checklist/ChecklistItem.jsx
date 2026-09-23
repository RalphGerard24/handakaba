const categoryIcons = {
  'Emergency Supplies': '/icons/categories/supplies.svg',
  'Evacuation Planning': '/icons/categories/evacuation.svg',
  'Home Safety': '/icons/categories/home.svg',
  'Communication': '/icons/categories/communication.svg',
  'Medical': '/icons/categories/medical.svg',
  'Financial': '/icons/categories/financial.svg',
  'Documentation': '/icons/categories/documentation.svg'
}

const urgencyIcons = {
  'CRITICAL': '/icons/urgency/critical.svg',
  'HIGH': '/icons/urgency/high.svg',
  'MEDIUM': '/icons/urgency/medium.svg'
}

export default function ChecklistItem({ item, onToggle, language = 'en' }) {
  const displayTask = language === 'tl' ? (item.task_tl || item.task) : item.task
  const displayReason = language === 'tl' ? (item.reason_tl || item.reason) : item.reason

  const urgencyColors = {
    CRITICAL: {
      bg: 'bg-red-100',
      border: 'border-red-500',
      text: 'text-red-900',
      badge: 'bg-red-500'
    },
    HIGH: {
      bg: 'bg-orange-100',
      border: 'border-orange-500',
      text: 'text-orange-900',
      badge: 'bg-orange-500'
    },
    MEDIUM: {
      bg: 'bg-yellow-100',
      border: 'border-yellow-500',
      text: 'text-yellow-900',
      badge: 'bg-yellow-500'
    }
  }
  
  const colors = urgencyColors[item.urgency] || urgencyColors.MEDIUM
  
  return (
    <div 
      className={`
        ${colors.bg} ${colors.text}
        border-l-4 ${colors.border}
        rounded-lg p-5 
        transition-all duration-300
        ${item.completed 
          ? 'opacity-80 bg-gray-50 border-gray-300 grayscale-[0.2]' 
          : 'hover:shadow-md hover:-translate-y-0.5'
        }
      `}
    >
      <div className="flex items-start gap-4">
        
        {/* Checkbox */}
        <div className="relative flex-shrink-0 mt-1">
          <input
            type="checkbox"
            checked={item.completed}
            onChange={() => onToggle(item.id)}
            className="w-6 h-6 cursor-pointer accent-green-600 rounded"
          />
          
          {/* Green Checkmark Icon (when completed) */}
          {item.completed && (
            <div className="absolute top-0 left-0 w-6 h-6 bg-green-600 rounded flex items-center justify-center pointer-events-none">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
        
        <div className="flex-1">
          {/* Header: Urgency badge + Category */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`
              ${item.completed ? 'bg-gray-400' : colors.badge}
              px-2.5 py-0.5 
              rounded-full 
              text-xs font-bold text-white
              tracking-wide
              transition-colors
            `}>
              {item.urgency}
            </span>
            <span className={`
              text-xs font-medium 
              ${item.completed ? 'text-gray-500' : 'opacity-75'}
            `}>
              {item.category}
            </span>
          </div>
          
          {/* Task title with strikethrough */}
          <h3 className={`
            text-lg font-bold mb-2
            transition-all duration-300
            ${item.completed 
              ? 'line-through text-gray-600' 
              : 'text-gray-900'
            }
          `}>
            {item.rank}. {displayTask}
          </h3>
          
          {/* Reason (personalized) */}
          <p className={`
            text-sm leading-relaxed mb-3 
            ${item.completed ? 'text-gray-500' : 'opacity-90'}
          `}>
            {displayReason}
          </p>
          
          {/* Cost */}
          {item.estimated_cost > 0 && (
            <div className={`
              flex items-center gap-2 text-sm font-semibold
              ${item.completed ? 'text-gray-500' : ''}
            `}>
              <span className="opacity-75">Estimated cost:</span>
              <span>₱{item.estimated_cost.toLocaleString()}</span>
            </div>
          )}
          
          {item.estimated_cost === 0 && (
            <div className={`
              text-sm font-semibold 
              ${item.completed ? 'text-gray-500' : 'opacity-75'}
            `}>
              Free / No cost
            </div>
          )}
          
          {/* Completion timestamp */}
          {item.completed && item.completed_at && (
            <div className="text-xs text-gray-500 mt-3 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              Completed {new Date(item.completed_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}