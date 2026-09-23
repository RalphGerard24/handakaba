export function logPerformanceMetric(name, duration) {
  console.log(`Performance [${name}]: ${duration.toFixed(2)}ms`)
  
  if (import.meta.env.PROD) {
    // External analytics integration point
  }
}


export async function measureAsync(name, fn) {
  const start = performance.now()
  const result = await fn()
  const duration = performance.now() - start
  logPerformanceMetric(name, duration)
  return result
}
