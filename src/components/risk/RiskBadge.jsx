// Map of disaster types to icon files
const disasterIcons = {
  'Flood': '/icons/disasters/flood.svg',
  'Earthquake': '/icons/disasters/earthquake.svg',
  'Typhoon/Storm Surge': '/icons/disasters/typhoon.svg',
  'Landslide': '/icons/disasters/landslide.svg',
  'Extreme Heat': '/icons/disasters/heat.svg'
}

export default function RiskBadge({ disaster, risk, description }) {
  const riskColors = {
    HIGH: 'bg-red-100 border-red-500 text-red-900',
    MEDIUM: 'bg-orange-100 border-orange-500 text-orange-900',
    LOW: 'bg-green-100 border-green-500 text-green-900',
    NONE: 'bg-gray-100 border-gray-300 text-gray-600'
  }
  
  const riskBadgeColors = {
    HIGH: 'bg-red-500',
    MEDIUM: 'bg-orange-500',
    LOW: 'bg-green-500',
    NONE: 'bg-gray-400'
  }
  
  return (
    <div className={`rounded-xl border-2 p-6 ${riskColors[risk]} transition-all hover:shadow-lg`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <img
            src={disasterIcons[disaster]}
            alt={`${disaster} icon`}
            className="w-12 h-12"
          />
          <div>
            <h3 className="font-bold text-lg">{disaster}</h3>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold text-white ${riskBadgeColors[risk]}`}>
              {risk}
            </span>
          </div>
        </div>
      </div>
      
      <p className="text-sm mt-2">{description}</p>
    </div>
  )
}