'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg border border-gray-200">
        <h2 className="mb-4 text-xl font-bold text-red-600">應用程式發生錯誤</h2>
        <p className="mb-6 text-gray-600">
          很抱歉，系統暫時無法處理您的請求。這可能是暫時性的連線問題或伺服器錯誤。
        </p>
        <div className="bg-gray-100 p-3 rounded mb-4 text-xs font-mono text-gray-700 overflow-auto max-h-32">
          {error.message || '未知錯誤'}
        </div>
        <button
          className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 transition-colors"
          onClick={() => reset()}
        >
          重試
        </button>
      </div>
    </div>
  )
}
