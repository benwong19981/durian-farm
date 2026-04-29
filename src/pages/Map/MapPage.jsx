import { useState, useRef, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, FeatureGroup, Polygon, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import * as turf from '@turf/turf'
import toast from 'react-hot-toast'
import useStore from '../../store/useStore'
import { addField, deleteField } from '../../firebase/fields'
import styles from './MapPage.module.css'

const DEFAULT_CENTER = [3.5, 101.9]
const DEFAULT_ZOOM = 13

const VARIETY_COLORS = {
  '猫山王': '#2d8c4e',
  'D24': '#c8960a',
  '红虾': '#c0392b',
  '黑刺': '#8e44ad',
  '竹脚': '#2980b9',
  '其他': '#7f8c8d',
}

const VARIETY_OPTIONS = ['猫山王', 'D24', '红虾', '黑刺', '竹脚', '其他']

const calculateArea = (latlngs) => {
  const flat = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs
  const coords = flat.map(ll => [ll.lng, ll.lat])
  coords.push(coords[0])
  const polygon = turf.polygon([coords])
  const areaM2 = turf.area(polygon)
  return parseFloat((areaM2 / 10000).toFixed(4))
}

// Native leaflet-draw controller component
function DrawControl({ onCreated }) {
  const map = useMap()
  const drawnItems = useRef(null)

  useEffect(() => {
    if (!drawnItems.current) {
      drawnItems.current = new L.FeatureGroup()
      map.addLayer(drawnItems.current)
    }

    const drawControl = new L.Control.Draw({
      position: 'topleft',
      draw: {
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false,
        polyline: false,
        polygon: {
          allowIntersection: false,
          showArea: true,
          shapeOptions: {
            color: '#2d4a2d',
            fillColor: '#2d4a2d',
            fillOpacity: 0.2,
            weight: 2,
          },
        },
      },
      edit: false,
    })

    map.addControl(drawControl)

    const handleCreated = (e) => {
      const layer = e.layer
      drawnItems.current.addLayer(layer)
      onCreated(layer, drawnItems.current)
    }

    map.on(L.Draw.Event.CREATED, handleCreated)

    return () => {
      map.removeControl(drawControl)
      map.off(L.Draw.Event.CREATED, handleCreated)
      if (drawnItems.current) {
        map.removeLayer(drawnItems.current)
        drawnItems.current = null
      }
    }
  }, [map, onCreated])

  return null
}

function FlyToUser({ trigger, onDone }) {
  const map = useMap()
  useEffect(() => {
    if (!trigger) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.flyTo([pos.coords.latitude, pos.coords.longitude], 15)
        onDone()
      },
      () => {
        toast.error('无法获取位置，请检查浏览器权限')
        onDone()
      }
    )
  }, [trigger, map, onDone])
  return null
}

const EMPTY_FORM = {
  name: '', location: '', variety: '猫山王',
  treeAge: '', treeCount: '', notes: ''
}

export default function MapPage() {
  const { user, fields, setFields } = useStore()
  const [pendingLayer, setPendingLayer] = useState(null)
  const [pendingLayerGroup, setPendingLayerGroup] = useState(null)
  const [pendingArea, setPendingArea] = useState(null)
  const [pendingBoundary, setPendingBoundary] = useState(null)
  const [pendingCenter, setPendingCenter] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [selectedField, setSelectedField] = useState(null)
  const [flyTrigger, setFlyTrigger] = useState(false)

  const handleCreated = useCallback((layer, layerGroup) => {
    const latlngs = layer.getLatLngs()
    const geoJson = layer.toGeoJSON()
    const area = calculateArea(latlngs[0])
    const centroid = turf.centroid(geoJson)
    const [lng, lat] = centroid.geometry.coordinates

    setPendingLayer(layer)
    setPendingLayerGroup(layerGroup)
    setPendingArea(area)
    setPendingBoundary(geoJson)
    setPendingCenter({ lat, lng })
    setForm(EMPTY_FORM)
    setShowForm(true)
  }, [])

  const handleCancelForm = useCallback(() => {
    setShowForm(false)
    if (pendingLayer && pendingLayerGroup) {
      pendingLayerGroup.removeLayer(pendingLayer)
    }
    setPendingLayer(null)
    setPendingLayerGroup(null)
    setPendingArea(null)
    setPendingBoundary(null)
  }, [pendingLayer, pendingLayerGroup])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('请输入地块名称'); return }
    setSaving(true)
    try {
      const data = {
        name: form.name.trim(),
        location: form.location.trim(),
        variety: form.variety,
        treeAge: form.treeAge ? Number(form.treeAge) : 0,
        treeCount: form.treeCount ? Number(form.treeCount) : 0,
        notes: form.notes.trim(),
        areaHa: pendingArea,
        boundary: pendingBoundary,
        center: pendingCenter,
        cropType: '榴莲',
      }
      const docRef = await addField(user.uid, data)
      setFields([{ id: docRef.id, ...data }, ...fields])
      setShowForm(false)
      setPendingLayer(null)
      setPendingLayerGroup(null)
      setPendingArea(null)
      setPendingBoundary(null)
      toast.success('地块已保存')
    } catch (err) {
      toast.error('保存失败，请重试')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (field) => {
    if (!window.confirm(`确认删除地块「${field.name}」？`)) return
    try {
      await deleteField(user.uid, field.id)
      setFields(fields.filter(f => f.id !== field.id))
      if (selectedField?.id === field.id) setSelectedField(null)
      toast.success('地块已删除')
    } catch {
      toast.error('删除失败，请重试')
    }
  }

  return (
    <div className={styles.page}>
      {/* Left panel */}
      <aside className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitle}>地块列表</div>
          <div className={styles.panelCount}>{fields.length} 个地块</div>
        </div>
        <div className={styles.fieldList}>
          {fields.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>🗺️</span>
              <p className={styles.emptyText}>暂无地块<br />在地图上绘制多边形来添加地块</p>
            </div>
          ) : (
            fields.map(f => (
              <div
                key={f.id}
                className={`${styles.fieldCard}${selectedField?.id === f.id ? ' ' + styles.selected : ''}`}
                onClick={() => setSelectedField(f)}
              >
                <div className={styles.fieldCardHeader}>
                  <span className={styles.fieldName}>{f.name}</span>
                  <span
                    className={styles.fieldBadge}
                    style={{
                      background: (VARIETY_COLORS[f.variety] || '#7f8c8d') + '22',
                      color: VARIETY_COLORS[f.variety] || '#7f8c8d',
                    }}
                  >
                    {f.variety}
                  </span>
                </div>
                <div className={styles.fieldMeta}>
                  <span className={styles.fieldMetaItem}>📐 {f.areaHa} 公顷</span>
                  {f.treeCount > 0 && <span className={styles.fieldMetaItem}>🌳 {f.treeCount} 棵</span>}
                  {f.location && <span className={styles.fieldMetaItem}>📍 {f.location}</span>}
                </div>
                <button
                  className={styles.deleteBtn}
                  onClick={(e) => { e.stopPropagation(); handleDelete(f) }}
                >
                  删除
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Map */}
      <div className={styles.mapWrapper}>
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          className={styles.map}
          zoomControl={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          <DrawControl onCreated={handleCreated} />

          {/* Saved field polygons */}
          {fields.map(f => {
            if (!f.boundary) return null
            const coords = f.boundary.geometry.coordinates[0].map(([lng, lat]) => [lat, lng])
            const color = VARIETY_COLORS[f.variety] || '#7f8c8d'
            return (
              <Polygon
                key={f.id}
                positions={coords}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.25, weight: 2 }}
              >
                <Popup>
                  <div style={{ fontFamily: 'var(--font-body)', minWidth: '160px' }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '8px', color: '#2d4a2d' }}>
                      {f.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#7a6e5a', lineHeight: '1.8' }}>
                      <div>品种：{f.variety}</div>
                      <div>面积：{f.areaHa} 公顷</div>
                      {f.treeCount > 0 && <div>棵数：{f.treeCount} 棵</div>}
                      {f.treeAge > 0 && <div>树龄：{f.treeAge} 年</div>}
                      {f.location && <div>地点：{f.location}</div>}
                    </div>
                  </div>
                </Popup>
              </Polygon>
            )
          })}

          <FlyToUser trigger={flyTrigger} onDone={() => setFlyTrigger(false)} />
        </MapContainer>

        <div className={styles.mapControls}>
          <button className={styles.locateBtn} onClick={() => setFlyTrigger(true)}>
            📍 我的位置
          </button>
        </div>

        {!showForm && (
          <div className={styles.drawHint}>
            点击左侧多边形工具绘制地块边界
          </div>
        )}
      </div>

      {/* Slide-in form panel */}
      {showForm && (
        <div className={styles.formOverlay} onClick={(e) => e.target === e.currentTarget && handleCancelForm()}>
          <div className={styles.formPanel}>
            <div className={styles.formPanelHeader}>
              <div className={styles.formPanelTitle}>保存地块</div>
              <div className={styles.formAreaDisplay}>
                自动计算面积：<span className={styles.areaValue}>{pendingArea} 公顷</span>
              </div>
            </div>

            <form className={styles.formPanelBody} onSubmit={handleSave}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  地块名称<span className={styles.required}>*</span>
                </label>
                <input
                  className={styles.formInput}
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="例：A区、北坡1号"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>地点</label>
                <input
                  className={styles.formInput}
                  value={form.location}
                  onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                  placeholder="例：文冬北部"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>榴莲品种</label>
                <select
                  className={styles.formSelect}
                  value={form.variety}
                  onChange={e => setForm(p => ({ ...p, variety: e.target.value }))}
                >
                  {VARIETY_OPTIONS.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>树龄（年）</label>
                  <input
                    type="number" min="0" max="100"
                    className={styles.formInput}
                    value={form.treeAge}
                    onChange={e => setForm(p => ({ ...p, treeAge: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>树木棵数</label>
                  <input
                    type="number" min="0"
                    className={styles.formInput}
                    value={form.treeCount}
                    onChange={e => setForm(p => ({ ...p, treeCount: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>备注</label>
                <textarea
                  className={styles.formTextarea}
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="其他备注信息..."
                />
              </div>

              <div className={styles.formPanelFooter} style={{ padding: '16px 0 0' }}>
                <button type="button" className={styles.btnSecondary} onClick={handleCancelForm}>
                  取消
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={saving}>
                  {saving ? '保存中...' : '保存地块'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
