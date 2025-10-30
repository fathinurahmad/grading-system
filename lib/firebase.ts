import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

// Firebase config dari kode pertama
const firebaseConfig = {
  apiKey: "AIzaSyBz-dhizVf5hewMW6ntCRFKpq2BWHfmB2A",
  authDomain: "nyolenk-c9637.firebaseapp.com",
  projectId: "nyolenk-c9637",
  storageBucket: "nyolenk-c9637.firebasestorage.app",
  messagingSenderId: "704293413703",
  appId: "1:704293413703:web:957e5dd7d6856f8df3e262",
  measurementId: "G-6ZCQC56K14",
}

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig)

// Export modul yang sering dipakai
export const auth = getAuth(app)
export const db = getFirestore(app)
