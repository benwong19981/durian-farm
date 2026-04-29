import { useState, useMemo } from 'react'
import toast from 'react-hot-toast'
import useStore from '../../store/useStore'
import { addFertilizer, deleteFertilizer } from '../../firebase/fertilizers'
import { addLog, deleteLog } from '../../firebase/logs'
import Modal from '../../components/ui/Modal'
import Table from '../../components/ui/Table'
import styles from './FertilizerLogPage.module.css'

const FERTILIZER_TYPES    = ['复合肥', '有机肥', '单元素肥', '叶面肥']
const APPLICATION_METHODS = ['撒施', '穴施', '滴灌', '叶面喷施']
const WEATHER_OPTIONS     = ['晴天', '多云', '雨后', '阴天']

// Suggested extra nutrients for the quick-add list
const COMMON_NUTRIENTS = ['Ca 钙', 'Mg 镁', 'S 硫', 'Fe 铁', 'Zn 锌', 'B 硼', 'Mn 锰']

const EMPTY_PRODUCT = {
  name: '', brand: '', type: '复合肥',
  n: '', p: '', k: '', pricePerKg: '', supplier: '', notes: '',
  customNutrients: [],            // [{name, percent}]
}

const EMPTY_LOG = {
  fieldId: '', productId: '', quantityKg: '',
  date: new Date().toISOString().slice(0, 10),
  method: '撒施', weather: '晴天', notes: '',
}

// ── Nutrient Dashboard ────────────────────────────────────────────────────────
function NutrientDashboard({ fields, logs, products }) {
  const stats = useMemo(() => {
    const productMap = Object.fromEntries(products.map(p => [p.id, p]))

    // Collect all custom nutrient names across all products
    const customNames = [...new Set(
      products.flatMap(p => (p.customNutrients || []).map(cn => cn.name))
    )]

    return fields.map(field => {
      const fieldLogs = logs.filter(l => l.fieldId === field.id)
      if (fieldLogs.length === 0) return null

      let totalN = 0, totalP = 0, totalK = 0
      const customTotals = Object.fromEntries(customNames.map(n => [n, 0]))

      fieldLogs.forEach(log => {
        const p   = productMap[log.productId]
        const qty = log.quantityKg || 0
        totalN += qty * ((p?.n || 0) / 100)
        totalP += qty * ((p?.p || 0) / 100)
        totalK += qty * ((p?.k || 0) / 100)
        ;(p?.customNutrients || []).forEach(cn => {
          customTotals[cn.name] = (customTotals[cn.name] || 0) + qty * (cn.percent / 100)
        })
      })

      return { field, totalN, totalP, totalK, customNames, customTotals, count: fieldLogs.length }
    }).filter(Boolean)
  }, [fields, logs, products])

  if (stats.length === 0) return null

  const allCustomNames = [...new Set(stats.flatMap(s => s.customNames))]

  return (
    <div className={styles.dashSection}>
      <div className={styles.dashTitle}>养分使用统计</div>
      <div className={styles.dashScroll}>
        <table className={styles.dashTable}>
          <thead>
            <tr>
              <th>地块</th>
              <th className={styles.thN}>N 氮 (kg)</th>
              <th className={styles.thP}>P 磷 (kg)</th>
              <th className={styles.thK}>K 钾 (kg)</th>
              {allCustomNames.map(n => <th key={n} className={styles.thCustom}>{n} (kg)</th>)}
              <th>施肥次数</th>
            </tr>
          </thead>
          <tbody>
            {stats.map(s => (
              <tr key={s.field.id}>
                <td className={styles.dashFieldName}>{s.field.name}</td>
                <td className={styles.tdN}>{s.totalN.toFixed(2)}</td>
                <td className={styles.tdP}>{s.totalP.toFixed(2)}</td>
                <td className={styles.tdK}>{s.totalK.toFixed(2)}</td>
                {allCustomNames.map(n => (
                  <td key={n} className={styles.tdCustom}>
                    {(s.customTotals[n] || 0).toFixed(2)}
                  </td>
                ))}
                <td className={styles.tdCount}>{s.count} 次</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function FertilizerLogPage() {
  const {
    user, fields, fertilizerProducts, fertilizerLogs,
    setFertilizerProducts, setFertilizerLogs,
  } = useStore()

  // ── Product modal state ──
  const [showProductModal, setShowProductModal] = useState(false)
  const [productForm, setProductForm]           = useState(EMPTY_PRODUCT)
  const [savingProduct, setSavingProduct]       = useState(false)
  const [productSearch, setProductSearch]       = useState('')

  // ── Log form state ──
  const [logForm, setLogForm]   = useState(EMPTY_LOG)
  const [savingLog, setSavingLog] = useState(false)

  // ── History filters ──
  const [filterField,    setFilterField]    = useState('')
  const [filterProduct,  setFilterProduct]  = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo,   setFilterDateTo]   = useState('')
  const [sortKey,  setSortKey]  = useState('date')
  const [sortDir,  setSortDir]  = useState('desc')

  // ── Live cost calculations ──
  const selectedProduct = fertilizerProducts.find(p => p.id === logForm.productId)
  const selectedField   = fields.find(f => f.id === logForm.fieldId)

  const totalCost  = selectedProduct && logForm.quantityKg
    ? (Number(logForm.quantityKg) * Number(selectedProduct.pricePerKg || 0)).toFixed(2)
    : null
  const perHectare = selectedField?.areaHa > 0 && logForm.quantityKg
    ? (Number(logForm.quantityKg) / selectedField.areaHa).toFixed(2)
    : null

  // ── Filtered product list ──
  const filteredProducts = useMemo(() =>
    fertilizerProducts.filter(p =>
      !productSearch ||
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      (p.brand || '').toLowerCase().includes(productSearch.toLowerCase())
    ), [fertilizerProducts, productSearch])

  // ── Filtered + sorted log list ──
  const filteredLogs = useMemo(() => {
    let logs = [...fertilizerLogs]
    if (filterField)    logs = logs.filter(l => l.fieldId   === filterField)
    if (filterProduct)  logs = logs.filter(l => l.productId === filterProduct)
    if (filterDateFrom) logs = logs.filter(l => {
      const d = l.date?.toDate ? l.date.toDate() : new Date(l.date)
      return d >= new Date(filterDateFrom)
    })
    if (filterDateTo)   logs = logs.filter(l => {
      const d = l.date?.toDate ? l.date.toDate() : new Date(l.date)
      return d <= new Date(filterDateTo + 'T23:59:59')
    })
    logs.sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey]
      if (sortKey === 'date') {
        va = va?.toDate ? va.toDate() : new Date(va || 0)
        vb = vb?.toDate ? vb.toDate() : new Date(vb || 0)
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return logs
  }, [fertilizerLogs, filterField, filterProduct, filterDateFrom, filterDateTo, sortKey, sortDir])

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  // ── Custom nutrient helpers ──
  const addCustomNutrient = () =>
    setProductForm(p => ({
      ...p,
      customNutrients: [...p.customNutrients, { name: '', percent: '' }],
    }))

  const removeCustomNutrient = (idx) =>
    setProductForm(p => ({
      ...p,
      customNutrients: p.customNutrients.filter((_, i) => i !== idx),
    }))

  const updateCustomNutrient = (idx, field, value) =>
    setProductForm(p => ({
      ...p,
      customNutrients: p.customNutrients.map((cn, i) =>
        i === idx ? { ...cn, [field]: value } : cn
      ),
    }))

  const addSuggestedNutrient = (name) => {
    if (productForm.customNutrients.some(cn => cn.name === name)) return
    setProductForm(p => ({
      ...p,
      customNutrients: [...p.customNutrients, { name, percent: '' }],
    }))
  }

  // ── Save product ──
  const handleSaveProduct = async (e) => {
    e.preventDefault()
    if (!productForm.name.trim()) { toast.error('请输入肥料名称'); return }
    setSavingProduct(true)
    try {
      const data = {
        name:      productForm.name.trim(),
        brand:     productForm.brand.trim(),
        type:      productForm.type,
        n:         productForm.n         !== '' ? Number(productForm.n)         : 0,
        p:         productForm.p         !== '' ? Number(productForm.p)         : 0,
        k:         productForm.k         !== '' ? Number(productForm.k)         : 0,
        pricePerKg: productForm.pricePerKg !== '' ? Number(productForm.pricePerKg) : 0,
        supplier:  productForm.supplier.trim(),
        notes:     productForm.notes.trim(),
        customNutrients: productForm.customNutrients
          .filter(cn => cn.name.trim())
          .map(cn => ({ name: cn.name.trim(), percent: Number(cn.percent) || 0 })),
      }
      const ref = await addFertilizer(user.uid, data)
      setFertilizerProducts([{ id: ref.id, ...data }, ...fertilizerProducts])
      setShowProductModal(false)
      setProductForm(EMPTY_PRODUCT)
      toast.success('产品已添加')
    } catch (err) {
      console.error(err)
      toast.error('保存失败，请重试')
    } finally {
      setSavingProduct(false)
    }
  }

  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`确认删除产品「${product.name}」？`)) return
    try {
      await deleteFertilizer(user.uid, product.id)
      setFertilizerProducts(fertilizerProducts.filter(p => p.id !== product.id))
      toast.success('产品已删除')
    } catch {
      toast.error('删除失败，请重试')
    }
  }

  // ── Save log ──
  const handleSaveLog = async (e) => {
    e.preventDefault()
    if (!logForm.fieldId || !logForm.productId || !logForm.quantityKg) {
      toast.error('请填写地块、产品和用量')
      return
    }
    setSavingLog(true)
    try {
      const product = fertilizerProducts.find(p => p.id === logForm.productId)
      const field   = fields.find(f => f.id === logForm.fieldId)
      const qty     = Number(logForm.quantityKg)
      const cost    = qty * (product?.pricePerKg || 0)
      const data    = {
        fieldId:     logForm.fieldId,
        fieldName:   field?.name || '',
        productId:   logForm.productId,
        productName: product?.name || '',
        quantityKg:  qty,
        totalCost:   parseFloat(cost.toFixed(2)),
        date:        new Date(logForm.date),
        method:      logForm.method,
        weather:     logForm.weather,
        notes:       logForm.notes.trim(),
      }
      const ref = await addLog(user.uid, data)
      setFertilizerLogs([{ id: ref.id, ...data }, ...fertilizerLogs])
      setLogForm({ ...EMPTY_LOG, date: new Date().toISOString().slice(0, 10) })
      toast.success('施肥记录已保存')
    } catch (err) {
      console.error(err)
      toast.error('保存失败，请重试')
    } finally {
      setSavingLog(false)
    }
  }

  const handleDeleteLog = async (log) => {
    if (!window.confirm('确认删除此条施肥记录？')) return
    try {
      await deleteLog(user.uid, log.id)
      setFertilizerLogs(fertilizerLogs.filter(l => l.id !== log.id))
      toast.success('记录已删除')
    } catch {
      toast.error('删除失败，请重试')
    }
  }

  const formatDate = (val) => {
    if (!val) return '—'
    const d = val?.toDate ? val.toDate() : new Date(val)
    return d.toLocaleDateString('zh-CN')
  }

  const tableColumns = [
    { key: 'date',        label: '日期',      sortable: true, render: v => formatDate(v) },
    { key: 'fieldName',   label: '地块',      sortable: true },
    { key: 'productName', label: '肥料',      sortable: true },
    { key: 'quantityKg',  label: '用量(kg)',  sortable: true },
    { key: 'totalCost',   label: '费用(RM)',  sortable: true, render: v => v?.toFixed(2) },
    { key: 'method',      label: '方式' },
    { key: '_actions',    label: '操作', render: (_, row) => (
      <button className={styles.deleteLogBtn} onClick={() => handleDeleteLog(row)}>删除</button>
    )},
  ]

  const closeProductModal = () => { setShowProductModal(false); setProductForm(EMPTY_PRODUCT) }

  return (
    <div className={styles.page}>

      {/* ══ Left: Product Library ══ */}
      <div className={styles.libraryCol}>
        <div className={styles.colHeader}>
          <span className={styles.colTitle}>产品库</span>
          <button className={styles.btnAdd} onClick={() => setShowProductModal(true)}>
            + 添加产品
          </button>
        </div>
        <div className={styles.searchBar}>
          <input className={styles.searchInput} placeholder="搜索产品..."
            value={productSearch} onChange={e => setProductSearch(e.target.value)} />
        </div>
        <div className={styles.productList}>
          {filteredProducts.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>🌿</span>
              <p className={styles.emptyText}>
                {productSearch ? '未找到匹配产品' : '暂无产品\n点击「添加产品」来添加'}
              </p>
            </div>
          ) : filteredProducts.map(p => (
            <div key={p.id} className={styles.productCard}>
              <div className={styles.productCardHeader}>
                <div>
                  <div className={styles.productName}>{p.name}</div>
                  {p.brand && <div className={styles.productBrand}>{p.brand} · {p.type}</div>}
                </div>
                <button className={styles.iconBtn} onClick={() => handleDeleteProduct(p)} title="删除">🗑️</button>
              </div>
              <div className={styles.npkRow}>
                <span className={`${styles.npkChip} ${styles.chipN}`}>N {p.n ?? 0}%</span>
                <span className={`${styles.npkChip} ${styles.chipP}`}>P {p.p ?? 0}%</span>
                <span className={`${styles.npkChip} ${styles.chipK}`}>K {p.k ?? 0}%</span>
                {(p.customNutrients || []).map(cn => (
                  <span key={cn.name} className={`${styles.npkChip} ${styles.chipCustom}`}>
                    {cn.name} {cn.percent}%
                  </span>
                ))}
              </div>
              <div className={styles.productPrice}>
                每公斤：<span className={styles.productPriceValue}>RM {Number(p.pricePerKg || 0).toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ Right: Dashboard + Log + History ══ */}
      <div className={styles.logCol}>

        {/* Nutrient dashboard */}
        <NutrientDashboard
          fields={fields}
          logs={fertilizerLogs}
          products={fertilizerProducts}
        />

        {/* Log form */}
        <div className={styles.logSection}>
          <div className={styles.sectionTitle}>新增施肥记录</div>
          <form onSubmit={handleSaveLog}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>地块<span className={styles.required}>*</span></label>
                <select className={styles.formSelect} value={logForm.fieldId}
                  onChange={e => setLogForm(p => ({ ...p, fieldId: e.target.value }))}>
                  <option value="">请选择地块</option>
                  {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>肥料产品<span className={styles.required}>*</span></label>
                <select className={styles.formSelect} value={logForm.productId}
                  onChange={e => setLogForm(p => ({ ...p, productId: e.target.value }))}>
                  <option value="">请选择产品</option>
                  {fertilizerProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>用量 (公斤)<span className={styles.required}>*</span></label>
                <input type="number" min="0" step="0.1" className={styles.formInput}
                  value={logForm.quantityKg}
                  onChange={e => setLogForm(p => ({ ...p, quantityKg: e.target.value }))}
                  placeholder="0" />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>施肥日期</label>
                <input type="date" className={styles.formInput} value={logForm.date}
                  onChange={e => setLogForm(p => ({ ...p, date: e.target.value }))} />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>施肥方式</label>
                <select className={styles.formSelect} value={logForm.method}
                  onChange={e => setLogForm(p => ({ ...p, method: e.target.value }))}>
                  {APPLICATION_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>天气情况</label>
                <select className={styles.formSelect} value={logForm.weather}
                  onChange={e => setLogForm(p => ({ ...p, weather: e.target.value }))}>
                  {WEATHER_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>

              {(totalCost !== null || perHectare !== null) && (
                <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                  <div className={styles.calcRow}>
                    {totalCost !== null && (
                      <div className={styles.calcItem}>
                        <span className={styles.calcLabel}>总费用</span>
                        <span className={styles.calcValue}>RM {totalCost}</span>
                      </div>
                    )}
                    {perHectare !== null && (
                      <div className={styles.calcItem}>
                        <span className={styles.calcLabel}>每公顷用量</span>
                        <span className={styles.calcValue}>{perHectare} kg/ha</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                <label className={styles.formLabel}>备注</label>
                <textarea className={styles.formTextarea} value={logForm.notes}
                  onChange={e => setLogForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="其他备注..." />
              </div>

              <div className={`${styles.formGroup} ${styles.formGroupFull} ${styles.formActions}`}>
                <button type="submit" className={styles.btnPrimary} disabled={savingLog}>
                  {savingLog ? '保存中...' : '保存记录'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* History table */}
        <div className={styles.historySection}>
          <div className={styles.historyHeader}>
            <span className={styles.sectionTitle} style={{ margin: 0 }}>
              历史记录 ({filteredLogs.length})
            </span>
          </div>
          <div className={styles.filterRow}>
            <select className={styles.filterSelect} value={filterField}
              onChange={e => setFilterField(e.target.value)}>
              <option value="">全部地块</option>
              {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <select className={styles.filterSelect} value={filterProduct}
              onChange={e => setFilterProduct(e.target.value)}>
              <option value="">全部产品</option>
              {fertilizerProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="date" className={styles.filterInput} value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)} />
            <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}>至</span>
            <input type="date" className={styles.filterInput} value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)} />
            <button className={styles.btnReset}
              onClick={() => { setFilterField(''); setFilterProduct(''); setFilterDateFrom(''); setFilterDateTo('') }}>
              重置
            </button>
          </div>
          <div className={styles.tableWrapper}>
            <Table columns={tableColumns} data={filteredLogs} emptyText="暂无施肥记录"
              sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          </div>
        </div>
      </div>

      {/* ══ Add Product Modal ══ */}
      {showProductModal && (
        <Modal
          title="添加肥料产品"
          onClose={closeProductModal}
          footer={
            <div className={styles.modalFooter}>
              <button className={styles.btnCancel} onClick={closeProductModal}>取消</button>
              <button className={styles.btnPrimary} onClick={handleSaveProduct} disabled={savingProduct}>
                {savingProduct ? '保存中...' : '保存产品'}
              </button>
            </div>
          }
        >
          <div className={styles.modalFormGrid}>
            {/* Name */}
            <div className={`${styles.modalFormGroup} ${styles.modalFormGroupFull}`}>
              <label className={styles.modalLabel}>肥料名称 *</label>
              <input className={styles.modalInput}
                value={productForm.name}
                onChange={e => setProductForm(p => ({ ...p, name: e.target.value }))}
                placeholder="例：绿色高钾复合肥" />
            </div>
            {/* Brand + type */}
            <div className={styles.modalFormGroup}>
              <label className={styles.modalLabel}>品牌</label>
              <input className={styles.modalInput} value={productForm.brand}
                onChange={e => setProductForm(p => ({ ...p, brand: e.target.value }))} placeholder="例：YaraLiva" />
            </div>
            <div className={styles.modalFormGroup}>
              <label className={styles.modalLabel}>肥料类型</label>
              <select className={styles.modalSelect} value={productForm.type}
                onChange={e => setProductForm(p => ({ ...p, type: e.target.value }))}>
                {FERTILIZER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {/* NPK */}
            <div className={styles.modalFormGroup}>
              <label className={styles.modalLabel}>氮 (N) %</label>
              <input type="number" min="0" max="100" className={styles.modalInput}
                value={productForm.n} onChange={e => setProductForm(p => ({ ...p, n: e.target.value }))} placeholder="0" />
            </div>
            <div className={styles.modalFormGroup}>
              <label className={styles.modalLabel}>磷 (P) %</label>
              <input type="number" min="0" max="100" className={styles.modalInput}
                value={productForm.p} onChange={e => setProductForm(p => ({ ...p, p: e.target.value }))} placeholder="0" />
            </div>
            <div className={styles.modalFormGroup}>
              <label className={styles.modalLabel}>钾 (K) %</label>
              <input type="number" min="0" max="100" className={styles.modalInput}
                value={productForm.k} onChange={e => setProductForm(p => ({ ...p, k: e.target.value }))} placeholder="0" />
            </div>
            {/* Price + supplier */}
            <div className={styles.modalFormGroup}>
              <label className={styles.modalLabel}>每公斤价格 (RM)</label>
              <input type="number" min="0" step="0.01" className={styles.modalInput}
                value={productForm.pricePerKg}
                onChange={e => setProductForm(p => ({ ...p, pricePerKg: e.target.value }))} placeholder="0.00" />
            </div>
            <div className={styles.modalFormGroup}>
              <label className={styles.modalLabel}>供应商</label>
              <input className={styles.modalInput} value={productForm.supplier}
                onChange={e => setProductForm(p => ({ ...p, supplier: e.target.value }))} placeholder="供应商名称" />
            </div>

            {/* ── Custom nutrients ── */}
            <div className={`${styles.modalFormGroup} ${styles.modalFormGroupFull}`}>
              <div className={styles.customNutrientHeader}>
                <label className={styles.modalLabel}>其他养分</label>
                <button type="button" className={styles.btnAddNutrient} onClick={addCustomNutrient}>
                  + 添加养分
                </button>
              </div>

              {/* Quick-add suggestions */}
              <div className={styles.nutrientSuggestions}>
                {COMMON_NUTRIENTS.map(n => (
                  <button key={n} type="button"
                    className={`${styles.suggestionChip}${productForm.customNutrients.some(cn => cn.name === n) ? ' ' + styles.suggestionChipActive : ''}`}
                    onClick={() => addSuggestedNutrient(n)}>
                    {n}
                  </button>
                ))}
              </div>

              {/* Custom nutrient rows */}
              {productForm.customNutrients.length > 0 && (
                <div className={styles.customNutrientList}>
                  {productForm.customNutrients.map((cn, idx) => (
                    <div key={idx} className={styles.customNutrientRow}>
                      <input
                        className={styles.modalInput}
                        value={cn.name}
                        onChange={e => updateCustomNutrient(idx, 'name', e.target.value)}
                        placeholder="养分名称，如 Ca 钙"
                        style={{ flex: 2 }}
                      />
                      <input
                        type="number" min="0" max="100" step="0.1"
                        className={styles.modalInput}
                        value={cn.percent}
                        onChange={e => updateCustomNutrient(idx, 'percent', e.target.value)}
                        placeholder="%"
                        style={{ flex: 1 }}
                      />
                      <button type="button" className={styles.removeNutrientBtn}
                        onClick={() => removeCustomNutrient(idx)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className={`${styles.modalFormGroup} ${styles.modalFormGroupFull}`}>
              <label className={styles.modalLabel}>备注</label>
              <textarea className={styles.modalTextarea} value={productForm.notes}
                onChange={e => setProductForm(p => ({ ...p, notes: e.target.value }))} placeholder="其他备注..." />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
