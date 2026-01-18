import { create } from "zustand"

export interface UserPresence {
  userId: string
  presenceStatus: string // "online", "offline", "away"
  lastSeenAt?: Date | null
  customStatus?: string | null
  customStatusEmoji?: string | null
}

interface ActiveListStore {
  members: string[]
  presenceMap: Map<string, UserPresence>
  add: (id: string) => void
  remove: (id: string) => void
  set: (ids: string[]) => void
  updatePresence: (presence: UserPresence) => void
  getPresence: (userId: string) => UserPresence | undefined
}

const useActiveList = create<ActiveListStore>((set, get) => ({
  members: [],
  presenceMap: new Map(),
  add: (id) => set((state) => ({ members: [...state.members, id] })),
  remove: (id) =>
    set((state) => ({
      members: state.members.filter((memberId) => memberId !== id),
    })),
  set: (ids) => set({ members: ids }),
  updatePresence: (presence) =>
    set((state) => {
      const newMap = new Map(state.presenceMap)
      newMap.set(presence.userId, presence)
      return { presenceMap: newMap }
    }),
  getPresence: (userId) => get().presenceMap.get(userId),
}))

export default useActiveList
