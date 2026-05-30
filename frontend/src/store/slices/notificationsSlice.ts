/**
 * store/slices/notificationsSlice.ts
 * Redux slice for in-app notifications
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type NotificationType = 'alert' | 'result' | 'dividend' | 'info' | 'warning'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  body: string
  timestamp: string
  read: boolean
  symbol?: string
  actionUrl?: string
}

export interface NotificationsState {
  items: Notification[]
  unreadCount: number
  drawerOpen: boolean
}

// ─── Mock initial notifications ────────────────────────────────────────────────
const mockNotifications: Notification[] = [
  {
    id: 'notif-001',
    type: 'alert',
    title: 'Price Alert: RELIANCE',
    body: 'Reliance Industries has crossed your target price of ₹3,200. Current price: ₹3,215.',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    read: false,
    symbol: 'RELIANCE',
    actionUrl: '/company/RELIANCE',
  },
  {
    id: 'notif-002',
    type: 'dividend',
    title: 'Dividend: HDFCBANK',
    body: 'HDFC Bank declared a dividend of ₹19.50 per share. Record date: 20 Jun 2025.',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    read: false,
    symbol: 'HDFCBANK',
    actionUrl: '/company/HDFCBANK',
  },
  {
    id: 'notif-003',
    type: 'result',
    title: 'Screener: 48 matches found',
    body: 'Your screener query "Magic Formula" returned 48 results. Click to view.',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    read: true,
    actionUrl: '/screener',
  },
  {
    id: 'notif-004',
    type: 'info',
    title: 'Market Update',
    body: 'Nifty 50 is up 0.56% today, led by IT and Energy sectors. Bank Nifty is slightly down.',
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    read: false,
    actionUrl: '/market',
  },
  {
    id: 'notif-005',
    type: 'alert',
    title: 'Price Alert: TCS',
    body: 'TCS has fallen below your alert price of ₹3,500. Current price: ₹3,462.',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    read: true,
    symbol: 'TCS',
    actionUrl: '/company/TCS',
  },
]

const initialState: NotificationsState = {
  items: mockNotifications,
  unreadCount: mockNotifications.filter((n) => !n.read).length,
  drawerOpen: false,
}

function generateId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setNotifications(state, action: PayloadAction<Notification[]>) {
      state.items = action.payload
      state.unreadCount = action.payload.filter((n) => !n.read).length
    },
    addNotification(
      state,
      action: PayloadAction<Omit<Notification, 'id' | 'read' | 'timestamp'>>
    ) {
      const newNotif: Notification = {
        ...action.payload,
        id: generateId(),
        read: false,
        timestamp: new Date().toISOString(),
      }
      // Prepend so newest is first
      state.items.unshift(newNotif)
      state.unreadCount += 1
      // Cap at 50 notifications
      if (state.items.length > 50) {
        state.items = state.items.slice(0, 50)
      }
    },
    markAsRead(state, action: PayloadAction<string>) {
      const item = state.items.find((n) => n.id === action.payload)
      if (item && !item.read) {
        item.read = true
        state.unreadCount = Math.max(0, state.unreadCount - 1)
      }
    },
    markAllAsRead(state) {
      state.items.forEach((n) => {
        n.read = true
      })
      state.unreadCount = 0
    },
    dismissNotification(state, action: PayloadAction<string>) {
      const idx = state.items.findIndex((n) => n.id === action.payload)
      if (idx !== -1) {
        if (!state.items[idx].read) {
          state.unreadCount = Math.max(0, state.unreadCount - 1)
        }
        state.items.splice(idx, 1)
      }
    },
    clearAllNotifications(state) {
      state.items = []
      state.unreadCount = 0
    },
    toggleDrawer(state) {
      state.drawerOpen = !state.drawerOpen
    },
    setDrawerOpen(state, action: PayloadAction<boolean>) {
      state.drawerOpen = action.payload
    },
    // Recalculate unread count from items (for safety)
    recalculateUnread(state) {
      state.unreadCount = state.items.filter((n) => !n.read).length
    },
  },
})

export const {
  setNotifications,
  addNotification,
  markAsRead,
  markAllAsRead,
  dismissNotification,
  clearAllNotifications,
  toggleDrawer,
  setDrawerOpen,
  recalculateUnread,
} = notificationsSlice.actions

export const notificationsReducer = notificationsSlice.reducer
