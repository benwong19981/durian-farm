import { db } from './config'
import {
  collection, addDoc, getDocs, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp
} from 'firebase/firestore'

const getRef = (uid) => collection(db, 'users', uid, 'fertilizerLogs')

export const addLog = async (uid, data) => {
  return await addDoc(getRef(uid), { ...data, createdAt: serverTimestamp() })
}

export const getLogs = async (uid) => {
  const q = query(getRef(uid), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const updateLog = async (uid, id, data) => {
  return await updateDoc(doc(db, 'users', uid, 'fertilizerLogs', id), data)
}

export const deleteLog = async (uid, id) => {
  return await deleteDoc(doc(db, 'users', uid, 'fertilizerLogs', id))
}
