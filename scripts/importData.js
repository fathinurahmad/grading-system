// ======================================
// 🚀 Firebase JSON Import Script
// ======================================

// Import library
import { initializeApp } from "firebase/app"
import { getFirestore, setDoc, doc } from "firebase/firestore"
import fs from "fs"

// ======================================
// 🧩 KONFIGURASI FIREBASE
// Ganti dengan konfigurasi project kamu
// (ambil dari Firebase Console → Project settings → Your apps → Config)
// ======================================
const firebaseConfig = {
  apiKey: "AIzaSyBz-dhizVf5hewMW6ntCRFKpq2BWHfmB2A",
  authDomain: "nyolenk-c9637.firebaseapp.com",
  projectId: "nyolenk-c9637",
  storageBucket: "nyolenk-c9637.firebasestorage.app",
  messagingSenderId: "704293413703",
  appId: "1:704293413703:web:957e5dd7d6856f8df3e262",
}

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

// ======================================
// 📦 Baca semua file JSON dari folder /data
// ======================================
const readJSON = (path) => JSON.parse(fs.readFileSync(path, "utf8"))

const students = readJSON("./data/students.json")
const scores = readJSON("./data/scores.json")
const mataKuliah = readJSON("./data/mata_kuliah.json")
const lockStatus = readJSON("./data/lock_status.json")

// ======================================
// 🔼 Upload semua data ke Firestore
// ======================================
async function uploadAll() {
  try {
    console.log("🚀 Mulai upload data ke Firestore...")

    // 1️⃣ Upload students
    await setDoc(doc(db, "students", "all_classes"), students)
    console.log("✅ Students uploaded")

    // 2️⃣ Upload scores
    await setDoc(doc(db, "scores", "data"), scores)
    console.log("✅ Scores uploaded")

    // 3️⃣ Upload mata kuliah
    await setDoc(doc(db, "mata_kuliah", "list"), mataKuliah)
    console.log("✅ Mata kuliah uploaded")

    // 4️⃣ Upload lock status
    await setDoc(doc(db, "system", "lock_status"), lockStatus)
    console.log("✅ Lock status uploaded")

    console.log("\n🎉 Semua data berhasil diunggah ke Firestore!\n")
  } catch (err) {
    console.error("❌ Gagal mengunggah data:", err)
  }
}

// Jalankan script
uploadAll()
