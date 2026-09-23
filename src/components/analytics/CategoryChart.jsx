import { Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js'

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend)

export default function CategoryChart({ items }) {
  // Calculate completion by category
  const categoryStats = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = {
        total: 0,
        completed: 0
      }
    }
    acc[item.category].total++
    if (item.completed) {
      acc[item.category].completed++
    }
    return acc
  }, {})
  
  // Prepare chart data
  const categories = Object.keys(categoryStats)
  const completionData = categories.map(cat => {
    const { completed, total } = categoryStats[cat]
    return Math.round((completed / total) * 100)
  })
  
  // Category colors (matching your design system)
  const categoryColors = {
    'Emergency Supplies': '#3b82f6',      // Blue
    'Evacuation Planning': '#10b981',     // Green
    'Home Safety': '#f59e0b',             // Yellow
    'Communication': '#8b5cf6',           // Purple
    'Medical': '#ef4444',                 // Red
    'Financial': '#14b8a6',               // Teal
    'Documentation': '#6366f1'            // Indigo
  }
  
  const chartData = {
    labels: categories,
    datasets: [
      {
        label: 'Completion %',
        data: completionData,
        backgroundColor: categories.map(cat => categoryColors[cat] || '#64748b'),
        borderColor: '#ffffff',
        borderWidth: 3,
        hoverOffset: 10
      }
    ]
  }
  
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 15,
          font: {
            size: 12,
            family: 'Inter, sans-serif'
          },
          generateLabels: (chart) => {
            const data = chart.data
            return data.labels.map((label, i) => {
              const value = data.datasets[0].data[i]
              const stats = categoryStats[label]
              return {
                text: `${label}: ${stats.completed}/${stats.total} (${value}%)`,
                fillStyle: data.datasets[0].backgroundColor[i],
                hidden: false,
                index: i
              }
            })
          }
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const category = context.label
            const stats = categoryStats[category]
            return [
              `${category}`,
              `Completed: ${stats.completed}/${stats.total}`,
              `Progress: ${context.parsed}%`
            ]
          }
        }
      }
    }
  }
  
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Preparedness by Category
      </h2>
      
      <div className="max-w-md mx-auto">
        <Doughnut data={chartData} options={chartOptions} />
      </div>
      
      {/* Category Breakdown Table */}
      <div className="mt-6 space-y-2">
        {categories.map(category => {
          const { completed, total } = categoryStats[category]
          const percentage = Math.round((completed / total) * 100)
          
          return (
            <div key={category} className="flex items-center gap-3">
              <div 
                className="w-4 h-4 rounded"
                style={{ backgroundColor: categoryColors[category] }}
              />
              <div className="flex-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-900">{category}</span>
                  <span className="text-gray-600">{completed}/{total}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div 
                    className="h-full rounded-full transition-all"
                    style={{ 
                      width: `${percentage}%`,
                      backgroundColor: categoryColors[category]
                    }}
                  />
                </div>
              </div>
              <span className="text-sm font-semibold text-gray-700 w-12 text-right">
                {percentage}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}