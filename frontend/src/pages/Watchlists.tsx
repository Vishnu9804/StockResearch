import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import {
  fetchWatchlistsStart,
  createWatchlist,
  renameWatchlist,
  deleteWatchlist,
  removeFromWatchlist,
  setTargetPrice,
  toggleAlert,
  moveItemRequest,
} from '@/store/slices/watchlistSlice'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X, Pencil, Trash2, Plus } from 'lucide-react'

export default function Watchlists() {
  const dispatch = useAppDispatch()
  const { watchlists, status } = useAppSelector((state) => state.watchlist)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchWatchlistsStart())
    }
  }, [status, dispatch])

  const handleCreate = () => {
    const name = newName.trim()
    if (!name) return
    dispatch(createWatchlist({ name }))
    setNewName('')
  }

  const startRename = (id: string, currentName: string) => {
    setRenamingId(id)
    setRenameValue(currentName)
  }

  const commitRename = (id: string) => {
    const name = renameValue.trim()
    if (name) {
      dispatch(renameWatchlist({ id, name }))
    }
    setRenamingId(null)
  }

  if (status === 'loading' && watchlists.length === 0) {
    return <div className="p-8 text-center text-textSecondary">Loading watchlists...</div>
  }

  if (watchlists.length === 0) {
    return (
      <div className="p-8">
        <div className="flex flex-col items-center justify-center h-[50vh] border-2 border-dashed border-border rounded-lg">
          <h2 className="text-2xl font-semibold mb-2 text-textPrimary">Nothing to show here</h2>
          <p className="text-textSecondary mb-6">
            Create a watchlist, or click "Watch" on any company to start tracking stocks.
          </p>
          <div className="flex items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Watchlist name"
              className="w-56"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <Button onClick={handleCreate}>Create Watchlist</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-textPrimary">Your Watchlists</h1>
        <div className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New collection name"
            className="w-56"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <Button onClick={handleCreate}>
            <Plus className="size-4" />
            Create
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {watchlists.map((wl) => (
          <Card key={wl.id}>
            <CardHeader className="flex-row items-center justify-between px-5 py-4">
              {renamingId === wl.id ? (
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && commitRename(wl.id)}
                    onBlur={() => commitRename(wl.id)}
                    className="w-48 h-8"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg text-textPrimary">{wl.name}</h3>
                  <button
                    onClick={() => startRename(wl.id, wl.name)}
                    className="text-textMuted hover:text-accent transition-colors"
                    aria-label="Rename"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-3">
                <span className="text-sm text-textSecondary">{wl.items.length} items</span>
                <button
                  onClick={() => dispatch(deleteWatchlist(wl.id))}
                  className="text-textMuted hover:text-negative transition-colors"
                  aria-label="Delete collection"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {wl.items.length === 0 ? (
                <p className="text-sm text-textMuted">No companies in this collection yet.</p>
              ) : (
                <div className="divide-y divide-border">
                  {wl.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <Link
                          to={`/company/${item.symbol}`}
                          className="font-medium text-textPrimary hover:text-accent transition-colors"
                        >
                          {item.companyName}
                        </Link>
                        <div className="text-xs text-textMuted font-mono">{item.symbol}</div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <Input
                          type="number"
                          value={item.targetPrice ?? ''}
                          onChange={(e) =>
                            dispatch(
                              setTargetPrice({
                                symbol: item.symbol,
                                watchlistId: wl.id,
                                price: e.target.value === '' ? null : Number(e.target.value),
                              })
                            )
                          }
                          placeholder="Target price"
                          className="w-28 h-8 text-sm"
                        />

                        <div className="flex items-center gap-1.5">
                          <Switch
                            checked={item.alertEnabled}
                            onCheckedChange={() => dispatch(toggleAlert({ symbol: item.symbol, watchlistId: wl.id }))}
                          />
                          <span className="text-xs text-textSecondary">Alert</span>
                        </div>

                        {watchlists.length > 1 && (
                          <Select
                            value=""
                            onValueChange={(targetWatchlistId) =>
                              dispatch(
                                moveItemRequest({
                                  itemId: item.id,
                                  symbol: item.symbol,
                                  fromWatchlistId: wl.id,
                                  toWatchlistId: targetWatchlistId,
                                })
                              )
                            }
                          >
                            <SelectTrigger size="sm" className="w-36">
                              <SelectValue placeholder="Move to..." />
                            </SelectTrigger>
                            <SelectContent>
                              {watchlists
                                .filter((other) => other.id !== wl.id)
                                .map((other) => (
                                  <SelectItem key={other.id} value={other.id}>
                                    {other.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        )}

                        <button
                          onClick={() => dispatch(removeFromWatchlist({ symbol: item.symbol, watchlistId: wl.id }))}
                          className="text-textMuted hover:text-negative transition-colors"
                          aria-label="Remove"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
