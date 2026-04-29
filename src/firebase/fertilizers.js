import { db } from './config'
import {
  collection, addDoc, getDocs, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp
} from 'firebase/firestore'

const getRef = (uid) => collection(db, 'users', uid, 'fertilizerProducts')

export const addFertilizer = async (uid, data) => {
  return await addDoc(getRef(uid), { ...data, createdAt: serverTimestamp() })
}

export const getFertilizers = async (uid) => {
  const q = query(getRef(uid), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const updateFertilizer = async (uid, id, data) => {
  return await updateDoc(doc(db, 'users', uid, 'fertilizerProducts', id), data)
}

export const deleteFertilizer = async (uid, id) => {
  return await deleteDoc(doc(db, 'users', uid, 'fertilizerProducts', id))
}
