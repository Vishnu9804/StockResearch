/**
 * store/slices/uiSlice.ts
 * Redux slice for global UI state
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type CompanySection =
  | 'overview'
  | 'chart'
  | 'peers'
  | 'quarterly'
  | 'profit-loss'
  | 'balance-sheet'
  | 'cash-flow'
  | 'ratios'
  | 'shareholding'
  | 'corporate-actions'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message?: string
  duration?: number
}

export interface MaintenanceBanner {
  visible: boolean
  message: string
  severity: 'info' | 'warning' | 'critical'
}

export interface UiState {
  sidebarCollapsed: boolean
  searchOpen: boolean
  activeSection: CompanySection
  toasts: Toast[]
  maintenanceBanner: MaintenanceBanner
  commandPaletteOpen: boolean
  comparisonMode: boolean
  compareSymbols: string[]
  tableCompactMode: boolean
  chartPeriod: '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'MAX'
  chartType: 'line' | 'candlestick' | 'area'
  financialView: 'annual' | 'quarterly'
  // Saga-driven navigation (avoids window.location.href which reloads the page)
  pendingNavigation: string | null
}

const initialState: UiState = {
  sidebarCollapsed: false,
  searchOpen: false,
  activeSection: 'overview',
  toasts: [],
  maintenanceBanner: {
    visible: false,
    message: '',
    severity: 'info',
  },
  commandPaletteOpen: false,
  comparisonMode: false,
  compareSymbols: [],
  tableCompactMode: false,
  chartPeriod: '1Y',
  chartType: 'line',
  financialView: 'annual',
  pendingNavigation: null,
}

function generateToastId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // ─── Sidebar ──────────────────────────────────────────────────────────
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed
    },
    setSidebarCollapsed(state, action: PayloadAction<boolean>) {
      state.sidebarCollapsed = action.payload
    },

    // ─── Search / Command Palette ─────────────────────────────────────────
    setSearchOpen(state, action: PayloadAction<boolean>) {
      state.searchOpen = action.payload
    },
    toggleCommandPalette(state) {
      state.commandPaletteOpen = !state.commandPaletteOpen
    },
    setCommandPaletteOpen(state, action: PayloadAction<boolean>) {
      state.commandPaletteOpen = action.payload
    },

    // ─── Active section (sticky subnav) ────────────────────────────────────
    setActiveSection(state, action: PayloadAction<CompanySection>) {
      state.activeSection = action.payload
    },

    // ─── Toasts ───────────────────────────────────────────────────────────
    showToast(state, action: PayloadAction<Omit<Toast, 'id'>>) {
      const toast: Toast = {
        ...action.payload,
        id: generateToastId(),
        duration: action.payload.duration ?? 4000,
      }
      state.toasts.push(toast)
      // Max 5 toasts at once
      if (state.toasts.length > 5) {
        state.toasts = state.toasts.slice(-5)
      }
    },
    dismissToast(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload)
    },
    clearToasts(state) {
      state.toasts = []
    },

    // ─── Maintenance Banner ───────────────────────────────────────────────
    showMaintenanceBanner(
      state,
      action: PayloadAction<Omit<MaintenanceBanner, 'visible'>>
    ) {
      state.maintenanceBanner = {
        ...action.payload,
        visible: true,
      }
    },
    hideMaintenanceBanner(state) {
      state.maintenanceBanner.visible = false
    },

    // ─── Comparison mode ──────────────────────────────────────────────────
    toggleComparisonMode(state) {
      state.comparisonMode = !state.comparisonMode
      if (!state.comparisonMode) {
        state.compareSymbols = []
      }
    },
    addCompareSymbol(state, action: PayloadAction<string>) {
      if (
        !state.compareSymbols.includes(action.payload) &&
        state.compareSymbols.length < 4
      ) {
        state.compareSymbols.push(action.payload)
      }
    },
    removeCompareSymbol(state, action: PayloadAction<string>) {
      state.compareSymbols = state.compareSymbols.filter((s) => s !== action.payload)
    },
    clearCompareSymbols(state) {
      state.compareSymbols = []
    },

    // ─── Display preferences ─────────────────────────────────────────────
    setTableCompactMode(state, action: PayloadAction<boolean>) {
      state.tableCompactMode = action.payload
    },
    setChartPeriod(state, action: PayloadAction<UiState['chartPeriod']>) {
      state.chartPeriod = action.payload
    },
    setChartType(state, action: PayloadAction<UiState['chartType']>) {
      state.chartType = action.payload
    },
    setFinancialView(state, action: PayloadAction<UiState['financialView']>) {
      state.financialView = action.payload
    },

    // ─── Saga-driven navigation ───────────────────────────────────────────
    navigateTo(state, action: PayloadAction<string>) {
      state.pendingNavigation = action.payload
    },
    clearNavigation(state) {
      state.pendingNavigation = null
    },
  },
})

export const {
  toggleSidebar,
  setSidebarCollapsed,
  setSearchOpen,
  toggleCommandPalette,
  setCommandPaletteOpen,
  setActiveSection,
  showToast,
  dismissToast,
  clearToasts,
  showMaintenanceBanner,
  hideMaintenanceBanner,
  toggleComparisonMode,
  addCompareSymbol,
  removeCompareSymbol,
  clearCompareSymbols,
  setTableCompactMode,
  setChartPeriod,
  setChartType,
  setFinancialView,
  navigateTo,
  clearNavigation,
} = uiSlice.actions

export const uiReducer = uiSlice.reducer
