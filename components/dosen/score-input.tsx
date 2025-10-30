"use client"

import { useState, useEffect } from "react"
import { collection, doc, getDoc, getDocs, addDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Student } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"

export function ScoreInput() {
  const [students, setStudents] = useState<Student[]>([])
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([])
  const [subjects, setSubjects] = useState<string[]>([])
  const [classes, setClasses] = useState<string[]>([])
  const [groupsByClass, setGroupsByClass] = useState<Record<string, string[]>>({})
  const [previousScores, setPreviousScores] = useState<Record<string, number>>({})

  const [selectedSubject, setSelectedSubject] = useState("")
  const [selectedClass, setSelectedClass] = useState("")
  const [selectedGroup, setSelectedGroup] = useState("")
  const [scores, setScores] = useState<Record<string, number>>({})
  const [groupNotes, setGroupNotes] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadingScores, setLoadingScores] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState("")

  // 🔹 Load subjects and students from Firestore
  useEffect(() => {
    const fetchData = async () => {
      try {
        const subjDoc = doc(db, "mata_kuliah", "list")
        const subjSnap = await getDoc(subjDoc)
        if (subjSnap.exists()) {
          setSubjects(subjSnap.data().mata_kuliah || [])
        }

        const studentsDoc = doc(db, "students", "all_classes")
        const snap = await getDoc(studentsDoc)
        if (!snap.exists()) {
          console.warn("No student data found.")
          return
        }

        const data = snap.data()
        const flattened: Student[] = []
        const classList: string[] = []
        const groupMap: Record<string, string[]> = {}

        Object.entries(data).forEach(([className, groups]) => {
          classList.push(className)
          const groupNumbers = Object.keys(groups as Record<string, string[]>)
            .sort((a, b) => Number(a) - Number(b))
          groupMap[className] = groupNumbers

          Object.entries(groups as Record<string, string[]>).forEach(([groupNumber, names]) => {
            names.forEach((name) => {
              flattened.push({
                id: `${className}-${groupNumber}-${name}`,
                name,
                class: className,
                group: groupNumber,
              })
            })
          })
        })

        setStudents(flattened)
        setClasses(classList.sort())
        setGroupsByClass(groupMap)
      } catch (error) {
        console.error("Error loading data:", error)
        setMessage("Failed to load data from Firestore.")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  useEffect(() => {
    let filtered = students
    if (selectedClass) filtered = filtered.filter((s) => s.class === selectedClass)
    if (selectedGroup) filtered = filtered.filter((s) => s.group === selectedGroup)
    setFilteredStudents(filtered)
  }, [students, selectedClass, selectedGroup])

  useEffect(() => {
    const fetchPreviousScores = async () => {
      if (!selectedSubject || !selectedClass || !selectedGroup) {
        setPreviousScores({})
        return
      }

      setLoadingScores(true)
      try {
        const scoresSnapshot = await getDocs(collection(db, "scores"))
        const allScores = scoresSnapshot.docs.map((doc) => doc.data())
        const scoreMap: Record<string, number> = {}

        filteredStudents.forEach((student) => {
          const studentScores = allScores.filter((score: any) => {
            const matchId = score.studentId === student.id
            const matchName = score.studentName === student.name
            const matchSubject = score.subject === selectedSubject
            const matchClass = score.class === selectedClass
            const matchGroup = String(score.group) === String(selectedGroup)
            return (matchId || matchName) && matchSubject && matchClass && matchGroup
          })

          const totalScore = studentScores.reduce((sum: number, s: any) => sum + (Number(s.score) || 0), 0)
          if (totalScore > 0) {
            scoreMap[student.id] = totalScore
          }
        })

        setPreviousScores(scoreMap)
      } catch (error) {
        console.error("Error loading previous scores:", error)
      } finally {
        setLoadingScores(false)
      }
    }

    fetchPreviousScores()
  }, [selectedSubject, selectedClass, selectedGroup, filteredStudents])

  const handleScoreChange = (studentId: string, value: string) => {
    const score = Number.parseFloat(value) || 0
    setScores({ ...scores, [studentId]: Math.min(100, Math.max(0, score)) })
  }

  const handleSubmit = async () => {
    setMessage("")

    if (!selectedSubject) return setMessage("Please select a subject.")
    if (!selectedClass || !selectedGroup) return setMessage("Please select both class and group.")

    const hasScores = Object.values(scores).some((score) => score > 0)
    if (!hasScores && !groupNotes) return setMessage("Please input at least one score or group note.")

    setSubmitting(true)
    try {
      let count = 0

      for (const student of filteredStudents) {
        if (scores[student.id]) {
          await addDoc(collection(db, "scores"), {
            studentId: student.id,
            studentName: student.name,
            subject: selectedSubject,
            class: selectedClass,
            group: selectedGroup,
            score: scores[student.id],
            createdAt: new Date(),
          })
          count++
        }
      }

      if (groupNotes && selectedGroup) {
        await addDoc(collection(db, "groupNotes"), {
          class: selectedClass,
          group: selectedGroup,
          subject: selectedSubject,
          notes: groupNotes,
          createdAt: new Date(),
        })
      }

      setMessage(`✅ Successfully submitted ${count} scores.`)
      setScores({})
      setGroupNotes("")
    } catch (error) {
      console.error("Error submitting:", error)
      setMessage("❌ Failed to submit scores. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Score Input & Management</CardTitle>
        <CardDescription>Enter and manage student scores dynamically from Firestore</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {message && (
          <Alert variant={message.includes("❌") ? "destructive" : "default"}>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {/* 🔹 Selection Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium">Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background mt-1"
            >
              <option value="">Select subject</option>
              {subjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value)
                setSelectedGroup("")
              }}
              className="w-full px-3 py-2 border border-input rounded-md bg-background mt-1"
            >
              <option value="">Select class</option>
              {classes.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Group</label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background mt-1"
              disabled={!selectedClass}
            >
              <option value="">Select group</option>
              {selectedClass &&
                groupsByClass[selectedClass]
                  ?.sort((a, b) => Number(a) - Number(b))
                  .map((grp) => (
                    <option key={grp} value={grp}>
                      Group {grp}
                    </option>
                  ))}
            </select>
          </div>
        </div>

        {/* 🔹 Student Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead className="w-12">No</TableHead>
                <TableHead>Student Name</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Group</TableHead>
                <TableHead className="text-center">Previous Score</TableHead>
                <TableHead>New Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                    No students found. Please select a class and group.
                  </TableCell>
                </TableRow>
              ) : loadingScores ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudents.map((student, index) => (
                  <TableRow key={student.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>{student.name}</TableCell>
                    <TableCell>{student.class}</TableCell>
                    <TableCell>Group {student.group}</TableCell>
                    <TableCell className="text-center">
                      {previousScores[student.id] ? (
                        <span className="inline-flex items-center justify-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                          {previousScores[student.id]}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={scores[student.id] || ""}
                        onChange={(e) => handleScoreChange(student.id, e.target.value)}
                        placeholder="0-100"
                        className="w-24"
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* 🔹 Notes */}
        <div>
          <label className="text-sm font-medium">Group Notes</label>
          <Textarea
            value={groupNotes}
            onChange={(e) => setGroupNotes(e.target.value)}
            placeholder="Add notes for this group..."
            className="mt-2"
            rows={4}
          />
        </div>

        <Button onClick={handleSubmit} disabled={submitting} className="w-full gap-2">
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit All Scores & Notes"
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
