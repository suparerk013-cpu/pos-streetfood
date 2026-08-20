import { addDoc, collection, doc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'

export async function addProduct({
  name,
  price,
  category,
  stockType,
  modifiers,
  sortOrder,
  imageBase64,
}) {
  await addDoc(collection(db, 'products'), {
    name,
    category,
    price,
    is_active: true,
    stock_type: stockType,
    stock_qty: 0,
    modifiers,
    sort_order: sortOrder,
    image_base64: imageBase64 ?? null,
  })
}

export async function updateProduct(productId, updates) {
  await updateDoc(doc(db, 'products', productId), updates)
}
