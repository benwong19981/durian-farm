import styles from './Table.module.css'

export default function Table({ columns, data, emptyText = '暂无记录', sortKey, sortDir, onSort }) {
  if (!data || data.length === 0) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>📋</span>
          <span className={styles.emptyText}>{emptyText}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                className={col.sortable ? styles.sortable : ''}
                onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
              >
                {col.label}
                {col.sortable && (
                  <span className={`${styles.sortIcon} ${sortKey === col.key ? styles.sortActive : ''}`}>
                    {sortKey === col.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.id || i}>
              {columns.map(col => (
                <td key={col.key}>
                  {col.render ? col.render(row[col.key], row) : row[col.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
