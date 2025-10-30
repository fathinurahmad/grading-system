"use client"

import { useState, useEffect } from "react"
import { collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Save, X, Edit, RefreshCw } from "lucide-react"

interface Student {
  id: string
  name: string
  studentClass: string
  studentGroup: string
  remainingScore: number
  scoreNote: string
}

export function ScoreReview() {
  const [students, setStudents] = useState<Student[]>([])
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([])
  const [selectedClass, setSelectedClass] = useState("")
  const [selectedGroup, setSelectedGroup] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editScore, setEditScore] = useState<number>(0)
  const [editNote, setEditNote] = useState<string>("")
  const [saving, setSaving] = useState(false)

  const [classes, setClasses] = useState<string[]>([])
  const [groupsByClass, setGroupsByClass] = useState<Record<string, string[]>>({})

  useEffect(() => {
    loadStudents()
  }, [])

  useEffect(() => {
    filterStudents()
  }, [students, selectedClass, selectedGroup, searchQuery])

  const loadStudents = async () => {
    setLoading(true)
    try {
      console.log("=== Loading Students ===")

      const studentsDoc = doc(db, "students", "all_classes")
      const snap = await getDoc(studentsDoc)

      if (!snap.exists()) {
        console.error("Document students/all_classes not found!")
        alert("Student data not found in Firestore.")
        return
      }

      const data = snap.data()
      console.log("Raw data from Firestore:", data)

      const studentsData: Student[] = []
      const classList: string[] = []
      const groupMap: Record<string, string[]> = {}

      const scoresSnapshot = await getDocs(collection(db, "studentScores"))
      const scoresMap: Record<string, { remainingScore: number; scoreNote: string }> = {}

      scoresSnapshot.docs.forEach((doc) => {
        const data = doc.data()
        scoresMap[doc.id] = {
          remainingScore: data.remainingScore !== undefined ? data.remainingScore : 100,
          scoreNote: data.scoreNote || "",
        }
      })

      Object.entries(data).forEach(([className, groups]) => {
        classList.push(className)
        const groupNumbers = Object.keys(groups as Record<string, string[]>).sort(
          (a, b) => Number(a) - Number(b)
        )
        groupMap[className] = groupNumbers

        Object.entries(groups as Record<string, string[]>).forEach(([groupNumber, names]) => {
          names.forEach((name) => {
            const studentId = `${className}-${groupNumber}-${name}`
            const scoreData = scoresMap[studentId] || { remainingScore: 100, scoreNote: "" }

            studentsData.push({
              id: studentId,
              name,
              studentClass: className,
              studentGroup: groupNumber,
              remainingScore: scoreData.remainingScore,
              scoreNote: scoreData.scoreNote,
            })
          })
        })
      })

      studentsData.sort((a, b) => a.name.localeCompare(b.name))

      setStudents(studentsData)
      setClasses(classList.sort())
      setGroupsByClass(groupMap)
    } catch (error) {
      console.error("Error loading students:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      alert("Failed to load student data. Error: " + errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const filterStudents = () => {
    let filtered = students

    if (selectedClass) {
      filtered = filtered.filter((s) => s.studentClass === selectedClass)
    }

    if (selectedGroup) {
      filtered = filtered.filter((s) => s.studentGroup === selectedGroup)
    }

    if (searchQuery) {
      filtered = filtered.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    }

    setFilteredStudents(filtered)
  }

  const handleEdit = (student: Student) => {
    setEditingId(student.id)
    setEditScore(student.remainingScore)
    setEditNote(student.scoreNote)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditScore(0)
    setEditNote("")
  }

  const handleSaveScore = async (studentId: string) => {
    if (editScore < 0 || editScore > 100) {
      alert("Score must be between 0 and 100.")
      return
    }

    if (editScore < 100 && !editNote.trim()) {
      alert("Please provide a note explaining the score reduction.")
      return
    }

    setSaving(true)
    try {
      const scoreRef = doc(db, "studentScores", studentId)
      await setDoc(
        scoreRef,
        {
          remainingScore: editScore,
          scoreNote: editNote.trim(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      )

      setStudents((prev) =>
        prev.map((s) =>
          s.id === studentId
            ? { ...s, remainingScore: editScore, scoreNote: editNote.trim() }
            : s
        )
      )

      setEditingId(null)
      setEditScore(0)
      setEditNote("")
    } catch (error) {
      console.error("Error saving score:", error)
      alert("Failed to save score.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            <span>Loading student data...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle>Committee Dashboard</CardTitle>
            <CardDescription>
              Review and manage student scores ({students.length} total)
            </CardDescription>
          </div>
          <Button onClick={loadStudents} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium">Search Student</label>
            <Input
              type="text"
              placeholder="Type a name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mt-1"
            />
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
              <option value="">All Classes</option>
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
              <option value="">All Groups</option>
              {selectedClass &&
                groupsByClass[selectedClass]?.map((group) => (
                  <option key={group} value={group}>
                    Group {group}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-sm bg-muted/50 p-3 rounded">
          <span>
            Total Students:{" "}
            <strong className="text-foreground">{filteredStudents.length}</strong>
          </span>
          <span>
            Total Used Score:{" "}
            <strong className="text-red-600">
              {filteredStudents.reduce((sum, s) => sum + (100 - s.remainingScore), 0)}
            </strong>
          </span>
          <span>
            Average Remaining:{" "}
            <strong className="text-[#38652E]">
              {filteredStudents.length > 0
                ? (
                    filteredStudents.reduce((sum, s) => sum + s.remainingScore, 0) /
                    filteredStudents.length
                  ).toFixed(1)
                : 0}
            </strong>
          </span>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium w-12">No</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Student Name</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Class</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Group</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-[#38652E]">
                  Remaining
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium min-w-[200px]">
                  Notes
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    {searchQuery || selectedClass || selectedGroup
                      ? "No students match the filters."
                      : "No student data available."}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, index) => {
                  const isEditing = editingId === student.id

                  return (
                    <tr key={student.id} className="border-t hover:bg-muted/50">
                      <td className="px-4 py-3 text-center text-muted-foreground">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 font-medium">{student.name}</td>
                      <td className="px-4 py-3 text-center">{student.studentClass}</td>
                      <td className="px-4 py-3 text-center">{student.studentGroup}</td>
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={editScore}
                            onChange={(e) => setEditScore(Number(e.target.value))}
                            className="w-20 mx-auto text-center"
                          />
                        ) : (
                          <span
                            className={`font-bold text-lg ${
                              student.remainingScore === 100
                                ? "text-[#38652E]"
                                : student.remainingScore >= 50
                                ? "text-orange-600"
                                : "text-red-600"
                            }`}
                          >
                            {student.remainingScore}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <Input
                            type="text"
                            placeholder="Reason for score reduction..."
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            className="w-full"
                          />
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {student.scoreNote || "-"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex gap-1 justify-center">
                            <Button
                              size="sm"
                              onClick={() => handleSaveScore(student.id)}
                              disabled={saving}
                            >
                              <Save className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEdit}
                              disabled={saving}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(student)}
                              className="text-blue-600 hover:bg-blue-50"
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Instructions */}
        <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 p-3 rounded">
          <strong>💡 How to Use:</strong> Click "Edit" → Change remaining score → Add a note (required if score is reduced) → Click ✓ to save.
        </div>
      </CardContent>
    </Card>
  )
}
