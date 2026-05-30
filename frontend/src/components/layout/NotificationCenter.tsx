import { useSelector, useDispatch } from 'react-redux'
import { Bell, Check, X, Info, HelpCircle, TrendingUp, Sparkles, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  toggleDrawer,
  markAsRead,
  markAllAsRead,
  dismissNotification,
  type Notification,
} from '@/store/slices/notificationsSlice'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatRelativeTime } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { Text } from '@/components/ui/Text'
import { Heading } from '@/components/ui/Heading'

export function NotificationCenter() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { items, unreadCount, drawerOpen } = useSelector((state: any) => state.notifications)

  const handleNotificationClick = (item: Notification) => {
    dispatch(markAsRead(item.id))
    dispatch(toggleDrawer())
    if (item.actionUrl) {
      navigate(item.actionUrl)
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'alert':
        return <TrendingUp className="size-4 text-accent" />
      case 'dividend':
        return <Sparkles className="size-4 text-positive" />
      case 'result':
        return <Info className="size-4 text-accent" />
      default:
        return <HelpCircle className="size-4 text-textSecondary" />
    }
  }

  return (
    <Sheet open={drawerOpen} onOpenChange={() => dispatch(toggleDrawer())}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col bg-surface border-l border-border select-none">
        <SheetHeader className="px-5 py-4 border-b border-border/50 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heading level={3} variant="sectionTitle" className="text-sm font-bold text-textPrimary uppercase tracking-wide">
                Notifications
              </Heading>
              {unreadCount > 0 && (
                <span className="rounded-full bg-accentSoft text-accent border border-accent/15 px-2 py-0.5 text-[10px] font-bold">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dispatch(markAllAsRead())}
                className="text-xs text-accent hover:text-accent/90 h-8 font-semibold flex items-center gap-1 hover:bg-surfaceMuted"
              >
                <Check className="size-3.5" />
                Mark all read
              </Button>
            )}
          </div>
          <SheetDescription className="hidden" />
        </SheetHeader>

        {/* List area */}
        <ScrollArea className="flex-1">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="size-10 rounded-full bg-surfaceMuted flex items-center justify-center mb-3">
                <Bell className="size-5 text-textMuted" />
              </div>
              <Text variant="body" className="font-semibold text-textPrimary">No new alerts</Text>
              <Text variant="caption" className="text-[11px] text-textSecondary mt-1">
                Your price alarms and corporate action notifications will appear here.
              </Text>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {items.map((item: Notification) => (
                <div
                  key={item.id}
                  className={cn(
                    'p-4 flex items-start gap-3 transition-colors cursor-pointer group hover:bg-tableRowHover relative',
                    !item.read ? 'bg-accentSoft/30' : ''
                  )}
                  onClick={() => handleNotificationClick(item)}
                >
                  {/* Indicator Dot */}
                  {!item.read && (
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-accent" />
                  )}

                  {/* Icon */}
                  <div className="size-7 rounded-lg bg-surfaceMuted border border-border flex items-center justify-center shrink-0 mt-0.5">
                    {getIcon(item.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1.5">
                      <p className={cn('text-xs text-textPrimary', !item.read ? 'font-bold' : 'font-semibold')}>
                        {item.title}
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          dispatch(dismissNotification(item.id))
                        }}
                        className="opacity-0 group-hover:opacity-100 text-textMuted hover:text-textSecondary p-0.5 transition-all"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                    <Text variant="caption" className="text-[11px] leading-relaxed text-textSecondary mt-1">{item.body}</Text>
                    <Text variant="caption" className="text-[10px] text-textMuted font-mono mt-2 block">
                      {formatRelativeTime(item.timestamp)}
                    </Text>
                  </div>

                  <ChevronRight className="size-3 text-textMuted self-center shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

