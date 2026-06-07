/**
 * hooks/useMarketStatus.ts
 * Derives NSE market open/closed status from current IST time.
 * NSE trading hours: Monday–Friday, 09:15–15:30 IST.
 * Recalculates every minute.
 */

import { useState, useEffect } from 'react'

export interface MarketStatus {
  isOpen: boolean
  label: string
  nextEvent: string
}

function getISTDate(): Date {
  // Get current UTC time and add IST offset (+5:30 = 330 minutes)
  const now = new Date()
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000
  return new Date(utcMs + 330 * 60 * 1000)
}

function computeMarketStatus(): MarketStatus {
  const ist = getISTDate()
  const day = ist.getDay() // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  const hours = ist.getHours()
  const minutes = ist.getMinutes()
  const totalMinutes = hours * 60 + minutes

  // NSE market hours: 09:15–15:30 on weekdays
  const OPEN_TIME = 9 * 60 + 15   // 555 minutes
  const CLOSE_TIME = 15 * 60 + 30 // 930 minutes

  const isWeekday = day >= 1 && day <= 5
  const isDuringHours = totalMinutes >= OPEN_TIME && totalMinutes < CLOSE_TIME

  if (isWeekday && isDuringHours) {
    const closesAt = `${15}:${30} IST`
    return {
      isOpen: true,
      label: 'Markets Open',
      nextEvent: `Closes at ${closesAt}`,
    }
  }

  // Determine when next open session is
  let nextOpen = 'Mon 09:15 IST'
  if (isWeekday && totalMinutes < OPEN_TIME) {
    nextOpen = 'Today 09:15 IST'
  } else if (isWeekday && totalMinutes >= CLOSE_TIME) {
    nextOpen = day === 5 ? 'Mon 09:15 IST' : 'Tomorrow 09:15 IST'
  }

  return {
    isOpen: false,
    label: 'Markets Closed',
    nextEvent: `Opens ${nextOpen}`,
  }
}

export function useMarketStatus(): MarketStatus {
  const [status, setStatus] = useState<MarketStatus>(computeMarketStatus)

  useEffect(() => {
    // Recalculate every 60 seconds
    const interval = setInterval(() => {
      setStatus(computeMarketStatus())
    }, 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  return status
}
