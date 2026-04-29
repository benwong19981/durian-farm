export const getCostPerHa = (totalCost, areaHa) =>
  areaHa > 0 ? totalCost / areaHa : 0

export const getCostPerKgN = (totalCost, totalKg, nPercent) => {
  const kgN = totalKg * (nPercent / 100)
  return kgN > 0 ? totalCost / kgN : 0
}

export const getTotalNutrient = (totalKg, percent) => totalKg * (percent / 100)

export const aggregateByProduct = (logs, products, fields) => {
  const productMap = {}
  products.forEach(p => { productMap[p.id] = p })

  const fieldMap = {}
  fields.forEach(f => { fieldMap[f.id] = f })

  const grouped = {}
  logs.forEach(log => {
    const pid = log.productId
    if (!grouped[pid]) {
      grouped[pid] = {
        productId: pid,
        productName: log.productName,
        totalCost: 0,
        totalKg: 0,
        fieldIds: new Set(),
        ...productMap[pid],
      }
    }
    grouped[pid].totalCost += log.totalCost || 0
    grouped[pid].totalKg += log.quantityKg || 0
    grouped[pid].fieldIds.add(log.fieldId)
  })

  return Object.values(grouped).map(item => {
    const totalAreaHa = [...item.fieldIds].reduce((sum, fid) => {
      return sum + (fieldMap[fid]?.areaHa || 0)
    }, 0)
    return {
      ...item,
      fieldIds: [...item.fieldIds],
      totalAreaHa,
      costPerHa: getCostPerHa(item.totalCost, totalAreaHa),
      costPerKgN: getCostPerKgN(item.totalCost, item.totalKg, item.n || 0),
      totalN: getTotalNutrient(item.totalKg, item.n || 0),
      totalP: getTotalNutrient(item.totalKg, item.p || 0),
      totalK: getTotalNutrient(item.totalKg, item.k || 0),
    }
  })
}

export const aggregateByField = (logs, fields) => {
  const fieldMap = {}
  fields.forEach(f => { fieldMap[f.id] = f })

  const grouped = {}
  logs.forEach(log => {
    const fid = log.fieldId
    if (!grouped[fid]) {
      grouped[fid] = {
        fieldId: fid,
        fieldName: log.fieldName,
        totalCost: 0,
        totalKg: 0,
        areaHa: fieldMap[fid]?.areaHa || 0,
      }
    }
    grouped[fid].totalCost += log.totalCost || 0
    grouped[fid].totalKg += log.quantityKg || 0
  })

  return Object.values(grouped)
}

export const aggregateByMonth = (logs, products, months = 6) => {
  const now = new Date()
  const monthKeys = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const productNames = [...new Set(logs.map(l => l.productName))]

  return monthKeys.map(mk => {
    const entry = { month: mk }
    productNames.forEach(name => {
      entry[name] = 0
    })
    logs.forEach(log => {
      const d = log.date?.toDate ? log.date.toDate() : new Date(log.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (key === mk) {
        entry[log.productName] = (entry[log.productName] || 0) + (log.totalCost || 0)
      }
    })
    return entry
  })
}
