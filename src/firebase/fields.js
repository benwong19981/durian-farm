import { db } from './config'
import {
  collection, addDoc, getDocs, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp
} from 'firebase/firestore'

const getRef = (uid) => collection(db, 'users', uid, 'fields')

export const addField = async (uid, data) => {
  return await addDoc(getRef(uid), { ...data, createdAt: serverTimestamp() })
}

export const getFields = async (uid) => {
  const q = query(getRef(uid), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const updateField = async (uid, id, data) => {
  return await updateDoc(doc(db, 'users', uid, 'fields', id), data)
}

export const deleteField = async (uid, id) => {
  return await deleteDoc(doc(db, 'users', uid, 'fields', id))
}
