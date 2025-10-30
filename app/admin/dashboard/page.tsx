"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"
import { StudentManagement } from "@/components/admin/student-management"
import { DownloadData } from "@/components/admin/download-data"
import { SystemControl } from "@/components/admin/system-control"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LogOut, Users, Download, Settings } from "lucide-react"

export default function AdminDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState("")

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login")
        return
      }

      // Check if user is admin
      const userDoc = await getDoc(doc(db, "users", user.uid))
      if (userDoc.data()?.role !== "admin") {
        router.push("/login")
        return
      }

      setUserName(user.email || "Admin")
      setLoading(false)
    })

    return () => unsubscribe()
  }, [router])

  const handleLogout = async () => {
    await auth.signOut()
    router.push("/login")
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Welcome, {userName}</p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="gap-2 bg-transparent">
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Tabs defaultValue="students" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="students" className="gap-2">
              <Users className="w-4 h-4" />
              Kelola Mahasiswa
            </TabsTrigger>
            <TabsTrigger value="download" className="gap-2">
              <Download className="w-4 h-4" />
              Download Data
            </TabsTrigger>
            <TabsTrigger value="control" className="gap-2">
              <Settings className="w-4 h-4" />
              Kontrol Sistem
            </TabsTrigger>
          </TabsList>

          <TabsContent value="students">
            <StudentManagement />
          </TabsContent>

          <TabsContent value="download">
            <DownloadData />
          </TabsContent>

          <TabsContent value="control">
            <SystemControl />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
