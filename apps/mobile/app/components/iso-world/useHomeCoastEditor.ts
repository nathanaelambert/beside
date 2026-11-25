import { useCallback, useMemo, useRef, useState } from "react"
import {
  homeExpansionCandidates,
  sameHomeCoastTile,
  type HomebaseExpansion,
  type HomeCoastTile,
} from "@beside/api-client/homebase-expansion"
import { useFocusEffect } from "@react-navigation/native"

import { besideApi } from "@/services/api/beside"

/** Local drafts never become shared until the server returns a saved shoreline. */
export function useHomeCoastEditor(
  id: string | undefined,
  expansion: HomebaseExpansion | undefined,
  accept: (id: string, expansion: HomebaseExpansion) => void,
) {
  const [selection, setSelection] = useState<{ homebaseId: string; tile: HomeCoastTile }>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const session = useRef<object | undefined>(undefined)
  const currentId = useRef(id)
  currentId.current = id
  const savingLock = useRef(false)
  const candidates = useMemo(
    () => (expansion ? homeExpansionCandidates(expansion.additions) : []),
    [expansion],
  )
  const draft = selection?.homebaseId === id ? selection?.tile : undefined
  const index = draft ? candidates.findIndex((tile) => sameHomeCoastTile(tile, draft)) : -1

  useFocusEffect(
    useCallback(() => {
      setSaving(savingLock.current)
      setSelection(undefined)
      setError("")
      setNotice("")
      if (!id) return
      session.current = {}
      return () => {
        session.current = undefined
      }
    }, [id]),
  )

  function select(tile?: HomeCoastTile) {
    if (savingLock.current) return
    const candidate = tile && candidates.find((cell) => sameHomeCoastTile(cell, tile))
    setSelection(id && candidate ? { homebaseId: id, tile: candidate } : undefined)
    setError("")
    setNotice("")
  }

  async function confirm() {
    if (
      !id ||
      currentId.current !== id ||
      !draft ||
      index === -1 ||
      savingLock.current ||
      !session.current
    )
      return
    const started = session.current
    savingLock.current = true
    setSaving(true)
    setError("")
    try {
      const saved = await besideApi.expandHomebase(id, draft)
      accept(id, saved)
      if (session.current !== started) return
      setSelection(undefined)
      setNotice("Coastline saved")
    } catch {
      if (session.current === started) setError("We couldn’t save this tile. Try again or cancel.")
    } finally {
      savingLock.current = false
      if (session.current) setSaving(false)
    }
  }

  return {
    candidates,
    draft,
    index,
    notice,
    error,
    saving,
    select,
    confirm,
    next: () => select(candidates[(index + 1) % candidates.length]),
  }
}
