import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { Toaster } from 'react-hot-toast'
import { auth } from './firebase/config'
import { getFields } from './firebase/fields'
import { getFertilizers } from './firebase/fertilizers'
import { getLogs } from './firebase/logs'
import useStore from './store/useStore'
import Layout from './components/Layout/Layout'
import Login from './pages/Login/Login'
import MapPage from './pages/Map/MapPage'
import FertilizerLogPage from './pages/FertilizerLog/FertilizerLogPage'
import FertilizerComparePage from './pages/FertilizerCompare/FertilizerComparePage'

function ProtectedRoute({ children }) {
  const { user, loading } = useStore()

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--color-bg)',
        fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)',
        fontSize: '14px', flexDirection: 'column', gap: '12px'
      }}>
        <span style={{ fontSize: '32px' }}>🌳</span>
        <span>加载中...</span>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const { setUser, setFields, setFertilizerProducts, setFertilizerLogs, setLoading } = useStore()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName,
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
        })
        try {
          const [fields, products, logs] = await Promise.all([
            getFields(firebaseUser.uid),
            getFertilizers(firebaseUser.uid),
            getLogs(firebaseUser.uid),
          ])
          setFields(fields)
          setFertilizerProducts(products)
          setFertilizerLogs(logs)
        } catch (err) {
          console.error('初始化数据失败:', err)
        }
      } else {
        setUser(null)
        setFields([])
        setFertilizerProducts([])
        setFertilizerLogs([])
      }
      setLoading(false)
    })
    return unsub
  }, [setUser, setFields, setFertilizerProducts, setFertilizerLogs, setLoading])

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            borderRadius: '8px',
          },
          success: { iconTheme: { primary: '#27ae60', secondary: '#fff' } },
          error: { iconTheme: { primary: '#c0392b', secondary: '#fff' } },
        }}
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/map" replace />} />
          <Route path="map" element={<MapPage />} />
          <Route path="fertilizer" element={<FertilizerLogPage />} />
          <Route path="compare" element={<FertilizerComparePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
