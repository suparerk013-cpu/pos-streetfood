import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'

export async function addProduct({
  name,
  price,
  category,
  stockType,
  stockQty,
  modifiers,
  sortOrder,
  imageBase64,
  deliveryPrices,
}) {
  await addDoc(collection(db, 'products'), {
    name,
    category,
    price,
    is_active: true,
    stock_type: stockType,
    stock_qty: stockQty ?? 0,
    modifiers,
    sort_order: sortOrder,
    image_base64: imageBase64 ?? null,
    delivery_prices: deliveryPrices ?? {},
  })
}

export async function updateProduct(productId, updates) {
  await updateDoc(doc(db, 'products', productId), updates)
}

export async function deleteProduct(productId) {
  await deleteDoc(doc(db, 'products', productId))
}
