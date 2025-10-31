"use client"

import { useState, useEffect } from "react"
import { collection, query, getDocs, deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Lock, Unlock, Loader2, RefreshCw } from "lucide-react"
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
  const [stats, setStats] = useState({ students: 0, users: 0, scores: 0, committeeScores: 0 })
  const [loading, setLoading] = useState(false)
  const [loadingCommittee, setLoadingCommittee] = useState(false)
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
      const committeeScoresSnapshot = await getDocs(query(collection(db, "studentScores")))

      setStats({
        students: studentsSnapshot.size,
        users: usersSnapshot.size,
        scores: scoresSnapshot.size,
        committeeScores: committeeScoresSnapshot.size,
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

      setMessage("✅ All lecturer scores, notes, and committee data have been reset successfully")
      await fetchStats()
    } catch (error) {
      setMessage("❌ Error resetting lecturer data")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleResetCommitteeScores = async () => {
    setLoadingCommittee(true)
    setMessage("")
    try {
      // Get all students from the master list
      const studentsDoc = doc(db, "students", "all_classes")
      const snap = await getDoc(studentsDoc)

      if (!snap.exists()) {
        setMessage("❌ Student data not found")
        return
      }

      const data = snap.data()
      const studentIds: string[] = []

      // Generate all student IDs
      Object.entries(data).forEach(([className, groups]) => {
        Object.entries(groups as Record<string, string[]>).forEach(([groupNumber, names]) => {
          names.forEach((name) => {
            studentIds.push(`${className}-${groupNumber}-${name}`)
          })
        })
      })

      // Reset all committee scores in batches
      const batchSize = 500 // Firestore batch limit
      for (let i = 0; i < studentIds.length; i += batchSize) {
        const batch = studentIds.slice(i, i + batchSize)
        const promises = batch.map((studentId) => {
          const scoreRef = doc(db, "studentScores", studentId)
          return setDoc(scoreRef, {
            remainingScore: 100,
            scoreNote: "",
            history: [],
            updatedAt: new Date().toISOString()
          })
        })
        await Promise.all(promises)
      }

      setMessage(`✅ All committee scores have been reset successfully (${studentIds.length} students)`)
      await fetchStats()
    } catch (error) {
      setMessage("❌ Error resetting committee scores")
      console.error(error)
    } finally {
      setLoadingCommittee(false)
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
        <Alert variant={message.includes("❌") ? "destructive" : "default"}>
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
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive mb-2">Danger Zone</h3>
                <p className="text-sm text-muted-foreground">
                  Reset system data. These actions cannot be undone. Please backup data before proceeding.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Reset Lecturer Scores */}
              <div className="p-4 border rounded-lg bg-white">
                <h4 className="font-semibold mb-2">Reset Lecturer Scores & Notes</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Delete all lecturer scores and group notes, reset committee scores to 100, and clear committee notes. Student information remains intact.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={loading} size="sm">
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Resetting...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Reset Lecturer Data
                        </>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>⚠️ Confirm Lecturer Data Reset</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete:
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>All lecturer scores ({stats.scores} records)</li>
                          <li>All group notes</li>
                          <li>Reset all committee scores to 100</li>
                          <li>Clear all committee notes</li>
                        </ul>
                        <p className="mt-3 font-semibold text-red-600">This action cannot be undone!</p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleResetScores}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Yes, Reset Lecturer Data
                    </AlertDialogAction>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {/* Reset Committee Scores */}
              <div className="p-4 border rounded-lg bg-white">
                <h4 className="font-semibold mb-2">Reset Committee Scores & History</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Reset all student committee scores back to 100, clear all notes, and delete all history records. Student information remains intact.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={loadingCommittee} size="sm">
                      {loadingCommittee ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Resetting...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Reset Committee Scores
                        </>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>⚠️ Confirm Committee Score Reset</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will:
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>Reset all student scores back to <strong>100</strong></li>
                          <li>Clear all score notes</li>
                          <li>Delete all history records ({stats.committeeScores} records)</li>
                        </ul>
                        <p className="mt-3 font-semibold text-red-600">This action cannot be undone!</p>
                        <p className="mt-2 text-sm">💡 Tip: Export Excel first to backup all data.</p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleResetCommitteeScores}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Yes, Reset Committee Scores
                    </AlertDialogAction>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}