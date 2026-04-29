import { create } from 'zustand'

const useStore = create((set) => ({
  user: null,
  fields: [],
  fertilizerProducts: [],
  fertilizerLogs: [],
  loading: true,

  setUser: (user) => set({ user }),
  setFields: (fields) => set({ fields }),
  setFertilizerProducts: (products) => set({ fertilizerProducts: products }),
  setFertilizerLogs: (logs) => set({ fertilizerLogs: logs }),
  setLoading: (loading) => set({ loading }),
}))

export default useStore
