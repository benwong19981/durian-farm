import { NavLink, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../../firebase/config'
import useStore from '../../store/useStore'
import toast from 'react-hot-toast'
import styles from './Sidebar.module.css'

const NAV_ITEMS = [
  { to: '/map', icon: '🗺️', label: '地图管理' },
  { to: '/fertilizer', icon: '🌿', label: '施肥记录' },
  { to: '/compare', icon: '📊', label: '肥料比较' },
]

export default function Sidebar() {
  const user = useStore(s => s.user)
  const navigate = useNavigate()

  const handleSignOut = async () => {
    try {
      await signOut(auth)
      navigate('/login')
      toast.success('已退出登录')
    } catch {
      toast.error('退出失败，请重试')
    }
  }

  const initials = user?.displayName
    ? user.displayName.charAt(0).toUpperCase()
    : '?'

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoTitle}>榴莲园管理系统</div>
        <div className={styles.logoSub}>Durian Orchard Manager</div>
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `${styles.navItem}${isActive ? ' ' + styles.active : ''}`
            }
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className={styles.footer}>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>
            {user?.photoURL
              ? <img src={user.photoURL} alt={initials} referrerPolicy="no-referrer" />
              : initials
            }
          </div>
          <span className={styles.userName}>{user?.displayName || user?.email || '用户'}</span>
        </div>
        <div className={styles.navDivider} />
        <button className={styles.signOut} onClick={handleSignOut}>
          <span className={styles.navIcon}>🚪</span>
          <span>退出登录</span>
        </button>
      </div>
    </aside>
  )
}
