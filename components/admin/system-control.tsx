"use client"

import { useState, useEffect } from "react"
import { collection, query, getDocs, deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Lock, Unlock, Loader2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function SystemControl() {
  const [dosenStatus, setDosenStatus] = useState<"OPEN" | "LOCKED">("OPEN")
  const [panitiaStatus, setPanitiaStatus] = useState<"OPEN" | "LOCKED">("OPEN")
  const [stats, setStats] = useState({ students: 0, users: 0, scores: 0 })
  const [loading, setLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [message, setMessage] = useState("")

  useEffect(() => {
    fetchStats()
    fetchSystemStatus()
  }, [])

  const fetchStats = async () => {
    try {
      const studentsSnapshot = await getDocs(query(collection(db, "students")))
      const usersSnapshot = await getDocs(query(collection(db, "users")))
      const scoresSnapshot = await getDocs(query(collection(db, "scores")))

      setStats({
        students: studentsSnapshot.size,
        users: usersSnapshot.size,
        scores: scoresSnapshot.size,
      })
    } catch (error) {
      console.error("Error fetching stats:", error)
    }
  }

  const fetchSystemStatus = async () => {
    try {
      const statusDoc = doc(db, "system", "status")
      const statusSnap = await getDoc(statusDoc)
      
      if (statusSnap.exists()) {
        const data = statusSnap.data()
        setDosenStatus(data.dosenStatus || "OPEN")
        setPanitiaStatus(data.panitiaStatus || "OPEN")
      } else {
        // Initialize if not exists
        await setDoc(statusDoc, {
          dosenStatus: "OPEN",
          panitiaStatus: "OPEN"
        })
      }
    } catch (error) {
      console.error("Error fetching system status:", error)
    } finally {
      setLoadingStatus(false)
    }
  }

  const toggleDosenStatus = async () => {
    const newStatus = dosenStatus === "OPEN" ? "LOCKED" : "OPEN"
    try {
      const statusDoc = doc(db, "system", "status")
      await updateDoc(statusDoc, { dosenStatus: newStatus })
      setDosenStatus(newStatus)
      setMessage(`Lecturer system ${newStatus === "LOCKED" ? "locked" : "unlocked"} successfully`)
    } catch (error) {
      console.error("Error updating dosen status:", error)
      setMessage("Error updating lecturer system status")
    }
  }

  const togglePanitiaStatus = async () => {
    const newStatus = panitiaStatus === "OPEN" ? "LOCKED" : "OPEN"
    try {
      const statusDoc = doc(db, "system", "status")
      await updateDoc(statusDoc, { panitiaStatus: newStatus })
      setPanitiaStatus(newStatus)
      setMessage(`Committee system ${newStatus === "LOCKED" ? "locked" : "unlocked"} successfully`)
    } catch (error) {
      console.error("Error updating panitia status:", error)
      setMessage("Error updating committee system status")
    }
  }

  const handleResetScores = async () => {
    setLoading(true)
    setMessage("")
    try {
      // Delete all scores
      const scoresSnapshot = await getDocs(query(collection(db, "scores")))
      for (const doc of scoresSnapshot.docs) {
        await deleteDoc(doc.ref)
      }

      // Delete all group notes
      const notesSnapshot = await getDocs(query(collection(db, "groupNotes")))
      for (const doc of notesSnapshot.docs) {
        await deleteDoc(doc.ref)
      }

      // Reset all students' panitiaScore to 100 and clear panitiaNote
      const studentsSnapshot = await getDocs(query(collection(db, "students")))
      for (const doc of studentsSnapshot.docs) {
        await updateDoc(doc.ref, {
          panitiaScore: 100,
          panitiaNote: ""
        })
      }

      setMessage("All scores, notes, and committee data have been reset successfully")
      await fetchStats()
    } catch (error) {
      setMessage("Error resetting data")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  if (loadingStatus) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {message && (
        <Alert variant={message.includes("Error") ? "destructive" : "default"}>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>System Control</CardTitle>
          <CardDescription>Manage system access and status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Lecturer System */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
            <div className="space-y-2">
              <h3 className="font-semibold">Lecturer System</h3>
              <Badge variant={dosenStatus === "OPEN" ? "default" : "destructive"}>{dosenStatus}</Badge>
            </div>
            <Button
              onClick={toggleDosenStatus}
              variant={dosenStatus === "OPEN" ? "destructive" : "default"}
              className="gap-2"
            >
              {dosenStatus === "OPEN" ? (
                <>
                  <Lock className="w-4 h-4" />
                  Lock System
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  Unlock System
                </>
              )}
            </Button>
          </div>

          {/* Committee System */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
            <div className="space-y-2">
              <h3 className="font-semibold">Committee System</h3>
              <Badge variant={panitiaStatus === "OPEN" ? "default" : "destructive"}>{panitiaStatus}</Badge>
            </div>
            <Button
              onClick={togglePanitiaStatus}
              variant={panitiaStatus === "OPEN" ? "destructive" : "default"}
              className="gap-2"
            >
              {panitiaStatus === "OPEN" ? (
                <>
                  <Lock className="w-4 h-4" />
                  Lock System
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  Unlock System
                </>
              )}
            </Button>
          </div>

          {/* Danger Zone */}
          <div className="p-4 border-2 border-destructive rounded-lg bg-destructive/5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive mb-2">Danger Zone</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Reset all scores and group notes. This will delete all scoring data and group notes, reset all committee scores to 100, and clear all committee notes. Student information will remain intact. This action cannot be undone.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Resetting...
                        </>
                      ) : (
                        "Reset Scores & Notes"
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Score Reset</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action will permanently delete ALL scores and group notes from the system, reset all committee scores to 100, and clear all committee notes. Student data will remain intact. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleResetScores}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Reset Scores
                    </AlertDialogAction>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>

          {/* Statistics */}
         
        </CardContent>
      </Card>
    </div>
  )
}