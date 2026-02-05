"use client"

import { useReportWebVitals } from "next/web-vitals"

export function WebVitals() {
  useReportWebVitals((metric) => {
    // Log web vitals for monitoring
    if (process.env.NODE_ENV === "development") {
      console.log(metric)
    }

    // You can send to analytics service here
    // Example: analytics.track(metric.name, metric.value)
  })

  return null
}
