import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer
} from 'recharts'
import useStore from '../../store/useStore'
import { aggregateByProduct, aggregateByField, aggregateByMonth } from '../../firebase/calculations'
import styles from './FertilizerComparePage.module.css'

const CHART_COLORS = ['#2d4a2d', '#c8960a', '#c0392b', '#2980b9', '#8e44ad', '#27ae60', '#e67e22', '#16a085']
const TIME_RANGES = [
  { label: '近1个月', value: 1 },
  { label: '近3个月', value: 3 },
  { label: '近6个月', value: 6 },
  { label: '全部', value: 0 },
]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipLabel}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || '#fff' }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
        </div>
      ))}
    </div>
  )
}

export default function FertilizerComparePage() {
  const { fields, fertilizerProducts, fertilizerLogs } = useStore()
  const [timeRange, setTimeRange] = useState(3)
  const [filterFieldId, setFilterFieldId] = useState('')

  const now = new Date()

  const filteredLogs = useMemo(() => {
    let logs = fertilizerLogs
    if (timeRange > 0) {
      const cutoff = new Date(now.getFullYear(), now.getMonth() - timeRange, 1)
      logs = logs.filter(l => {
        const d = l.date?.toDate ? l.date.toDate() : new Date(l.date || 0)
        return d >= cutoff
      })
    }
    if (filterFieldId) {
      logs = logs.filter(l => l.fieldId === filterFieldId)
    }
    return logs
  }, [fertilizerLogs, timeRange, filterFieldId])

  // This month's stats
  const thisMonthLogs = useMemo(() => {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return fertilizerLogs.filter(l => {
      const d = l.date?.toDate ? l.date.toDate() : new Date(l.date || 0)
      return d >= start
    })
  }, [fertilizerLogs])

  const monthTotalCost = thisMonthLogs.reduce((s, l) => s + (l.totalCost || 0), 0)
  const monthTotalKg = thisMonthLogs.reduce((s, l) => s + (l.quantityKg || 0), 0)

  // Aggregations
  const byProduct = useMemo(() =>
    aggregateByProduct(filteredLogs, fertilizerProducts, fields),
    [filteredLogs, fertilizerProducts, fields]
  )

  const byField = useMemo(() =>
    aggregateByField(filteredLogs, fields),
    [filteredLogs, fields]
  )

  const monthlyTrend = useMemo(() =>
    aggregateByMonth(fertilizerLogs, fertilizerProducts, 6),
    [fertilizerLogs, fertilizerProducts]
  )

  const trendLines = useMemo(() =>
    [...new Set(fertilizerLogs.map(l => l.productName))],
    [fertilizerLogs]
  )

  // Cost by product bar data
  const costByProductData = byProduct
    .sort((a, b) => b.totalCost - a.totalCost)
    .map(p => ({ name: p.productName || p.name, 总费用: parseFloat(p.totalCost.toFixed(2)) }))

  // Cost per hectare horizontal bar
  const costPerHaData = byProduct
    .filter(p => p.costPerHa > 0)
    .sort((a, b) => b.costPerHa - a.costPerHa)
    .map(p => ({ name: p.productName || p.name, 每公顷费用: parseFloat(p.costPerHa.toFixed(2)) }))

  // NPK comparison
  const npkData = fertilizerProducts.map(p => ({
    name: p.name,
    N: p.n || 0,
    P: p.p || 0,
    K: p.k || 0,
  }))

  // Nitrogen cost ranking
  const nRanking = byProduct
    .filter(p => p.costPerKgN > 0)
    .sort((a, b) => a.costPerKgN - b.costPerKgN)

  const getRating = (idx, total) => {
    if (total === 0) return { label: '—', cls: '' }
    const pct = idx / total
    if (pct < 0.33) return { label: '优', cls: styles.ratingGood }
    if (pct < 0.66) return { label: '中', cls: styles.ratingMid }
    return { label: '差', cls: styles.ratingBad }
  }

  // Field pie
  const fieldPieData = byField.map((f, i) => ({
    name: f.fieldName,
    value: parseFloat(f.totalCost.toFixed(2)),
    color: CHART_COLORS[i % CHART_COLORS.length],
  }))

  const hasData = filteredLogs.length > 0

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>肥料效益分析</h1>
        <p className={styles.pageSubtitle}>基于施肥记录的成本与养分对比分析</p>
      </div>

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <span className={styles.filterLabel}>时间范围：</span>
        <div className={styles.filterBtns}>
          {TIME_RANGES.map(t => (
            <button
              key={t.value}
              className={`${styles.filterBtn}${timeRange === t.value ? ' ' + styles.active : ''}`}
              onClick={() => setTimeRange(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className={styles.filterLabel}>地块筛选：</span>
        <select
          className={styles.filterSelect}
          value={filterFieldId}
          onChange={e => setFilterFieldId(e.target.value)}
        >
          <option value="">全部地块</option>
          {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>

      {/* Summary cards */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>总肥料品种数</div>
          <div className={styles.statValue}>{fertilizerProducts.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>本月总费用</div>
          <div className={styles.statValue}>
            {monthTotalCost.toFixed(2)}<span className={styles.statUnit}>RM</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>本月总用量</div>
          <div className={styles.statValue}>
            {monthTotalKg.toFixed(1)}<span className={styles.statUnit}>kg</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>施肥次数</div>
          <div className={styles.statValue}>{fertilizerLogs.length}</div>
        </div>
      </div>

      {/* Charts grid */}
      <div className={styles.chartGrid}>
        {/* Cost by product */}
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>各产品费用比较</div>
          {!hasData || costByProductData.length === 0 ? (
            <div className={styles.emptyChart}>
              <span className={styles.emptyChartIcon}>📊</span>
              <span className={styles.emptyChartText}>数据不足</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={costByProductData} margin={{ top: 0, right: 0, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e0d0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="总费用" fill="#2d4a2d" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Cost per hectare */}
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>每公顷费用比较</div>
          {!hasData || costPerHaData.length === 0 ? (
            <div className={styles.emptyChart}>
              <span className={styles.emptyChartIcon}>📊</span>
              <span className={styles.emptyChartText}>数据不足</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={costPerHaData} layout="vertical" margin={{ top: 0, right: 20, left: 80, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e0d0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="每公顷费用" fill="#c8960a" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* NPK comparison */}
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>NPK 养分对比</div>
          {npkData.length === 0 ? (
            <div className={styles.emptyChart}>
              <span className={styles.emptyChartIcon}>🌿</span>
              <span className={styles.emptyChartText}>暂无产品数据</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={npkData} margin={{ top: 0, right: 0, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e0d0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="N" name="氮 N" fill="#27ae60" radius={[2, 2, 0, 0]} />
                <Bar dataKey="P" name="磷 P" fill="#e67e22" radius={[2, 2, 0, 0]} />
                <Bar dataKey="K" name="钾 K" fill="#2980b9" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Field pie */}
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>各地块施肥费用分布</div>
          {!hasData || fieldPieData.length === 0 ? (
            <div className={styles.emptyChart}>
              <span className={styles.emptyChartIcon}>🥧</span>
              <span className={styles.emptyChartText}>数据不足</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={fieldPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {fieldPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `RM ${v.toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Monthly trend */}
        <div className={`${styles.chartCard} ${styles.chartCardFull}`}>
          <div className={styles.chartTitle}>月度费用趋势（近6个月）</div>
          {trendLines.length === 0 || monthlyTrend.length === 0 ? (
            <div className={styles.emptyChart}>
              <span className={styles.emptyChartIcon}>📈</span>
              <span className={styles.emptyChartText}>数据不足</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyTrend} margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e0d0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {trendLines.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Nitrogen cost ranking */}
        <div className={`${styles.chartCard} ${styles.chartCardFull}`}>
          <div className={styles.chartTitle}>每公斤氮素成本排名</div>
          {nRanking.length === 0 ? (
            <div className={styles.emptyChart}>
              <span className={styles.emptyChartIcon}>🏆</span>
              <span className={styles.emptyChartText}>数据不足，请先添加施肥记录</span>
            </div>
          ) : (
            <table className={styles.rankTable}>
              <thead>
                <tr>
                  <th>排名</th>
                  <th>产品名称</th>
                  <th>氮含量 %</th>
                  <th>每 kg 氮素成本 (RM)</th>
                  <th>评级</th>
                </tr>
              </thead>
              <tbody>
                {nRanking.map((p, i) => {
                  const rating = getRating(i, nRanking.length)
                  return (
                    <tr key={p.productId}>
                      <td><span className={styles.rankNum}>#{i + 1}</span></td>
                      <td>{p.productName || p.name}</td>
                      <td>{p.n ?? 0}%</td>
                      <td>RM {p.costPerKgN.toFixed(2)}</td>
                      <td>
                        <span className={`${styles.ratingBadge} ${rating.cls}`}>{rating.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
