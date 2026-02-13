"use client"

import { useCallback, useEffect, useState } from "react"
import axios from "axios"

interface UsageStats {
  totalRequests: number
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  totalCost: number
  totalInputCost: number
  totalOutputCost: number
  averageLatency: number
}

interface QuotaInfo {
  withinQuota: boolean
  used: number
  remaining: number
  percentage: number
}

interface UsageData {
  stats: UsageStats
  quota: QuotaInfo
  period: {
    startDate: string
    endDate: string
  }
}

const AiUsageStats = () => {
  const [usageData, setUsageData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<"day" | "week" | "month">("month")

  const fetchUsageData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await axios.get(`/api/ai/usage?period=${period}`)
      setUsageData(response.data)
    } catch (err) {
      console.error("Failed to fetch usage data:", err)
      setError("Failed to load usage statistics")
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchUsageData()
  }, [fetchUsageData])

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-32 rounded bg-gray-200" />
          <div className="h-20 rounded bg-gray-200" />
        </div>
      </div>
    )
  }

  if (error || !usageData) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <p className="text-sm text-red-600">{error || "Failed to load usage data"}</p>
      </div>
    )
  }

  const { stats, quota } = usageData

  // Format cost in dollars
  const formatCost = (cents: number) => {
    return `$${(cents / 100).toFixed(4)}`
  }

  // Format number with commas
  const formatNumber = (num: number) => {
    return num.toLocaleString()
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">AI Usage Statistics</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setPeriod("day")}
            className={`rounded-md px-3 py-1 text-sm font-medium transition ${
              period === "day"
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Last Day
          </button>
          <button
            onClick={() => setPeriod("week")}
            className={`rounded-md px-3 py-1 text-sm font-medium transition ${
              period === "week"
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Last Week
          </button>
          <button
            onClick={() => setPeriod("month")}
            className={`rounded-md px-3 py-1 text-sm font-medium transition ${
              period === "month"
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Last Month
          </button>
        </div>
      </div>

      {/* Quota Progress Bar */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">Monthly Token Quota</h3>
          <span className="text-sm text-gray-500">
            {formatNumber(quota.used)} / {formatNumber(quota.used + quota.remaining)} tokens
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full transition-all ${
              quota.percentage > 90
                ? "bg-red-500"
                : quota.percentage > 70
                  ? "bg-yellow-500"
                  : "bg-gradient-to-r from-purple-500 to-pink-500"
            }`}
            style={{ width: `${Math.min(quota.percentage, 100)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {quota.withinQuota ? (
            <>
              {formatNumber(quota.remaining)} tokens remaining (
              {(100 - quota.percentage).toFixed(1)}
              %)
            </>
          ) : (
            <span className="font-medium text-red-600">Quota exceeded</span>
          )}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Requests */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-500">Total Requests</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {formatNumber(stats.totalRequests)}
          </p>
        </div>

        {/* Total Tokens */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-500">Total Tokens</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{formatNumber(stats.totalTokens)}</p>
          <p className="mt-1 text-xs text-gray-500">
            {formatNumber(stats.totalInputTokens)} in / {formatNumber(stats.totalOutputTokens)} out
          </p>
        </div>

        {/* Total Cost */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-500">Total Cost</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{formatCost(stats.totalCost)}</p>
          <p className="mt-1 text-xs text-gray-500">
            {formatCost(stats.totalInputCost)} in / {formatCost(stats.totalOutputCost)} out
          </p>
        </div>

        {/* Average Latency */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-500">Avg Latency</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{stats.averageLatency}ms</p>
          <p className="mt-1 text-xs text-gray-500">
            {stats.averageLatency < 2000 ? "Fast" : stats.averageLatency < 5000 ? "Normal" : "Slow"}
          </p>
        </div>
      </div>

      {/* Info Box */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-800">
          <span className="font-medium">Note:</span> Usage tracking helps you monitor AI costs and
          stay within quota limits. Costs are estimates based on current Anthropic pricing.
        </p>
      </div>
    </div>
  )
}

export default AiUsageStats
