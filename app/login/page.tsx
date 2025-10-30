"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { doc, setDoc, getDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Loader2, Lock } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<"admin" | "dosen" | "panitia">("admin")
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      let userCredential

      if (isSignUp) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password)
        await setDoc(doc(db, "users", userCredential.user.uid), {
          email,
          role,
          createdAt: new Date(),
        })
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password)
      }

      const userDoc = await getDoc(doc(db, "users", userCredential.user.uid))
      const userRole = userDoc.exists() ? (userDoc.data()?.role as string) : role

      // 🔒 Check system status before allowing access
      const statusDoc = await getDoc(doc(db, "system", "status"))
      if (statusDoc.exists()) {
        const systemStatus = statusDoc.data()
        
        // Check if lecturer system is locked
        if (userRole === "dosen" && systemStatus.dosenStatus === "LOCKED") {
          setError("🔒 Lecturer system is currently locked. Please contact administrator.")
          // Sign out the user
          await auth.signOut()
          setLoading(false)
          return
        }
        
        // Check if committee system is locked
        if (userRole === "panitia" && systemStatus.panitiaStatus === "LOCKED") {
          setError("🔒 Committee system is currently locked. Please contact administrator.")
          // Sign out the user
          await auth.signOut()
          setLoading(false)
          return
        }
      }

      localStorage.setItem("uid", userCredential.user.uid)
      localStorage.setItem("email", email)
      localStorage.setItem("role", userRole)

      router.push(`/${userRole}/dashboard`)
    } catch (err: any) {
      if (err.code === "auth/user-not-found") setError("Account not found.")
      else if (err.code === "auth/wrong-password") setError("Incorrect password.")
      else if (err.code === "auth/email-already-in-use") setError("Email already registered.")
      else setError(err.message || "An error occurred during authentication.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: "url('/images/bg-login.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center 35%",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#f4f4f4",
      }}
    >
      {/* Lapisan gelap tipis biar teks kebaca tapi gak blur */}
      <div className="absolute inset-0 bg-black/25" />

      <Card className="relative z-10 w-full max-w-md bg-white/95 shadow-xl border border-white/30">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl font-semibold text-gray-900">English Camp Assesment </CardTitle>
          <CardDescription className="text-gray-700">
            {isSignUp ? "Create a new account" : "Sign in to continue"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {isSignUp && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <select
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value as "admin" | "dosen" | "panitia")
                  }
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                >
                  <option value="admin">Admin</option>
                  <option value="dosen">Lecturer (Dosen)</option>
                  <option value="panitia">Committee (Panitia)</option>
                </select>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isSignUp ? "Creating account..." : "Signing in..."}
                </>
              ) : isSignUp ? (
                "Create Account"
              ) : (
                "Sign In"
              )}
            </Button>

           
          </form>
        </CardContent>
      </Card>
    </div>
  )
}