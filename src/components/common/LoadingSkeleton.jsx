export function SkeletonText({ width = 'w-full', height = 'h-4' }) {
  return <div className={`${width} ${height} bg-gray-200 rounded animate-pulse`} />
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
      <SkeletonText width="w-2/3" height="h-6" />
      <SkeletonText width="w-full" height="h-4" />
      <SkeletonText width="w-full" height="h-4" />
      <SkeletonText width="w-1/2" height="h-4" />
    </div>
  )
}

export function SkeletonCircle() {
  return (
    <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse" />
  )
}
