"use client"

import { useState, useEffect } from "react"
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, arrayUnion } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Save, X, Edit, RefreshCw, Download, History } from "lucide-react"
import * as XLSX from 'xlsx'

interface ScoreHistory {
  timestamp: string
  committeeeName: string
  previousScore: number
  newScore: number
  reduction: number
  reason: string
}

interface Student {
  id: string
  name: string
  studentClass: string
  studentGroup: string
  remainingScore: number
  scoreNote: string
  history?: ScoreHistory[]
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
  const [committeeName, setCommitteeName] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [showHistory, setShowHistory] = useState<string | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)

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
      const studentsDoc = doc(db, "students", "all_classes")
      const snap = await getDoc(studentsDoc)

      if (!snap.exists()) {
        alert("Student data not found in Firestore.")
        return
      }

      const data = snap.data()
      const studentsData: Student[] = []
      const classList: string[] = []
      const groupMap: Record<string, string[]> = {}

      const scoresSnapshot = await getDocs(collection(db, "studentScores"))
      const scoresMap: Record<string, { remainingScore: number; scoreNote: string; history?: ScoreHistory[] }> = {}

      scoresSnapshot.docs.forEach((doc) => {
        const data = doc.data()
        scoresMap[doc.id] = {
          remainingScore: data.remainingScore !== undefined ? data.remainingScore : 100,
          scoreNote: data.scoreNote || "",
          history: data.history || []
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
            const scoreData = scoresMap[studentId] || { remainingScore: 100, scoreNote: "", history: [] }

            studentsData.push({
              id: studentId,
              name,
              studentClass: className,
              studentGroup: groupNumber,
              remainingScore: scoreData.remainingScore,
              scoreNote: scoreData.scoreNote,
              history: scoreData.history || []
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
      alert("Failed to load student data.")
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
    setEditNote("")
    setCommitteeName("")
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditScore(0)
    setEditNote("")
    setCommitteeName("")
  }

  const handleSaveScore = async (studentId: string) => {
    const student = students.find(s => s.id === studentId)
    if (!student) return

    if (editScore < 0 || editScore > 100) {
      alert("Score must be between 0 and 100.")
      return
    }

    if (editScore < student.remainingScore && !editNote.trim()) {
      alert("Please provide a reason for score reduction.")
      return
    }

    if (editScore < student.remainingScore && !committeeName.trim()) {
      alert("Please enter your name as the committee member.")
      return
    }

    setSaving(true)
    try {
      const scoreRef = doc(db, "studentScores", studentId)
      const reduction = student.remainingScore - editScore

      const historyEntry: ScoreHistory = {
        timestamp: new Date().toISOString(),
        committeeeName: committeeName.trim(),
        previousScore: student.remainingScore,
        newScore: editScore,
        reduction: reduction,
        reason: editNote.trim()
      }

      await setDoc(
        scoreRef,
        {
          remainingScore: editScore,
          scoreNote: editNote.trim(),
          history: arrayUnion(historyEntry),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      )

      setStudents((prev) =>
        prev.map((s) =>
          s.id === studentId
            ? { 
                ...s, 
                remainingScore: editScore, 
                scoreNote: editNote.trim(),
                history: [...(s.history || []), historyEntry]
              }
            : s
        )
      )

      setEditingId(null)
      setEditScore(0)
      setEditNote("")
      setCommitteeName("")
    } catch (error) {
      console.error("Error saving score:", error)
      alert("Failed to save score.")
    } finally {
      setSaving(false)
    }
  }

  const exportToExcel = () => {
    // Sheet 1: Student Master Data (ALL STUDENTS, sorted by Class → Group → Name)
    const sortedStudents = [...students].sort((a, b) => {
      // Sort by class first
      if (a.studentClass !== b.studentClass) {
        return a.studentClass.localeCompare(b.studentClass)
      }
      // Then by group (numeric)
      if (a.studentGroup !== b.studentGroup) {
        return Number(a.studentGroup) - Number(b.studentGroup)
      }
      // Finally by name
      return a.name.localeCompare(b.name)
    })

    const masterData = sortedStudents.map((student, index) => ({
      'No': index + 1,
      'Student Name': student.name,
      'Class': student.studentClass,
      'Group': student.studentGroup,
      'Initial Score': 100,
      'Remaining Score': student.remainingScore,
      'Total Reduction': 100 - student.remainingScore,
      'Current Note': student.scoreNote || '-',
      'Total Changes': student.history?.length || 0,
      'Last Modified': student.history && student.history.length > 0 
        ? new Date(student.history[student.history.length - 1].timestamp).toLocaleString('id-ID')
        : '-'
    }))

    const masterSheet = XLSX.utils.json_to_sheet(masterData)
    masterSheet['!cols'] = [
      { wch: 5 },   // No
      { wch: 30 },  // Student Name
      { wch: 12 },  // Class
      { wch: 8 },   // Group
      { wch: 12 },  // Initial Score
      { wch: 15 },  // Remaining Score
      { wch: 15 },  // Total Reduction
      { wch: 35 },  // Current Note
      { wch: 12 },  // Total Changes
      { wch: 20 }   // Last Modified
    ]

    // Sheet 2: History Log (All Activities from ALL students)
    const historyData: any[] = []
    students.forEach(student => {
      if (student.history && student.history.length > 0) {
        student.history.forEach((h) => {
          historyData.push({
            'Date & Time': new Date(h.timestamp).toLocaleString('id-ID', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            }),
            'Student Name': student.name,
            'Class': student.studentClass,
            'Group': student.studentGroup,
            'Committee Name': h.committeeeName,
            'Previous Score': h.previousScore,
            'New Score': h.newScore,
            'Reduction': h.reduction,
            'Reason': h.reason
          })
        })
      }
    })

    // Sort by date descending (newest first)
    historyData.sort((a, b) => {
      const dateA = new Date(a['Date & Time'].split(', ').reverse().join(' '))
      const dateB = new Date(b['Date & Time'].split(', ').reverse().join(' '))
      return dateB.getTime() - dateA.getTime()
    })

    const historySheet = historyData.length > 0 
      ? XLSX.utils.json_to_sheet(historyData)
      : XLSX.utils.json_to_sheet([{ 'Message': 'No history records found' }])

    if (historyData.length > 0) {
      historySheet['!cols'] = [
        { wch: 20 },  // Date & Time
        { wch: 30 },  // Student Name
        { wch: 12 },  // Class
        { wch: 8 },   // Group
        { wch: 25 },  // Committee Name
        { wch: 13 },  // Previous Score
        { wch: 10 },  // New Score
        { wch: 10 },  // Reduction
        { wch: 40 }   // Reason
      ]
    }

    // Sheet 3: Summary Statistics
    const summaryData = [
      { 'Metric': 'Export Date & Time', 'Value': new Date().toLocaleString('id-ID') },
      { 'Metric': '', 'Value': '' },
      { 'Metric': '📊 STUDENT STATISTICS', 'Value': '' },
      { 'Metric': 'Total Students (All)', 'Value': students.length },
      { 'Metric': 'Students with Full Score (100)', 'Value': students.filter(s => s.remainingScore === 100).length },
      { 'Metric': 'Students with Reductions', 'Value': students.filter(s => s.remainingScore < 100).length },
      { 'Metric': '', 'Value': '' },
      { 'Metric': '🔍 FILTERED VIEW (Current Display)', 'Value': '' },
      { 'Metric': 'Filtered Students Count', 'Value': filteredStudents.length },
      { 'Metric': 'Filter: Class', 'Value': selectedClass || 'All Classes' },
      { 'Metric': 'Filter: Group', 'Value': selectedGroup || 'All Groups' },
      { 'Metric': 'Filter: Search', 'Value': searchQuery || '-' },
      { 'Metric': '', 'Value': '' },
      { 'Metric': '📈 SCORE STATISTICS (All Students)', 'Value': '' },
      { 'Metric': 'Total Score Available', 'Value': students.length * 100 },
      { 'Metric': 'Total Score Used', 'Value': students.reduce((sum, s) => sum + (100 - s.remainingScore), 0) },
      { 'Metric': 'Total Score Remaining', 'Value': students.reduce((sum, s) => sum + s.remainingScore, 0) },
      { 'Metric': 'Average Remaining Score', 'Value': students.length > 0 ? (students.reduce((sum, s) => sum + s.remainingScore, 0) / students.length).toFixed(2) : 0 },
      { 'Metric': '', 'Value': '' },
      { 'Metric': '👥 COMMITTEE STATISTICS', 'Value': '' },
      { 'Metric': 'Total Activities Recorded', 'Value': historyData.length },
      { 'Metric': 'Unique Committee Members', 'Value': new Set(historyData.map(h => h['Committee Name'])).size }
    ]

    // Add committee members breakdown
    const committeeStats: Record<string, { count: number; totalReduction: number }> = {}
    historyData.forEach(h => {
      const name = h['Committee Name']
      if (!committeeStats[name]) {
        committeeStats[name] = { count: 0, totalReduction: 0 }
      }
      committeeStats[name].count++
      committeeStats[name].totalReduction += h['Reduction']
    })

    if (Object.keys(committeeStats).length > 0) {
      summaryData.push({ 'Metric': '', 'Value': '' })
      summaryData.push({ 'Metric': '📋 ACTIVITY BY COMMITTEE', 'Value': '' })
      Object.entries(committeeStats)
        .sort((a, b) => b[1].count - a[1].count)
        .forEach(([name, stats]) => {
          summaryData.push({
            'Metric': `  ${name}`,
            'Value': `${stats.count} activities, ${stats.totalReduction} points reduced`
          })
        })
    }

    const summarySheet = XLSX.utils.json_to_sheet(summaryData)
    summarySheet['!cols'] = [{ wch: 35 }, { wch: 40 }]

    // Sheet 4: Committee Activities Detail
    const committeeDetailData: any[] = []
    Object.keys(committeeStats).sort().forEach(committeeName => {
      const activities = historyData.filter(h => h['Committee Name'] === committeeName)
      activities.forEach(activity => {
        committeeDetailData.push({
          'Committee Name': activity['Committee Name'],
          'Date & Time': activity['Date & Time'],
          'Student Name': activity['Student Name'],
          'Class': activity['Class'],
          'Group': activity['Group'],
          'Score Change': `${activity['Previous Score']} → ${activity['New Score']}`,
          'Reduction': activity['Reduction'],
          'Reason': activity['Reason']
        })
      })
    })

    const committeeDetailSheet = committeeDetailData.length > 0
      ? XLSX.utils.json_to_sheet(committeeDetailData)
      : XLSX.utils.json_to_sheet([{ 'Message': 'No activities found' }])

    if (committeeDetailData.length > 0) {
      committeeDetailSheet['!cols'] = [
        { wch: 25 },  // Committee Name
        { wch: 20 },  // Date & Time
        { wch: 30 },  // Student Name
        { wch: 12 },  // Class
        { wch: 8 },   // Group
        { wch: 15 },  // Score Change
        { wch: 10 },  // Reduction
        { wch: 40 }   // Reason
      ]
    }

    // Create workbook and add sheets
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, masterSheet, "Student Master Data")
    XLSX.utils.book_append_sheet(workbook, historySheet, "History Log")
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary")
    XLSX.utils.book_append_sheet(workbook, committeeDetailSheet, "Committee Activities")

    const fileName = `Student_Scores_Report_${new Date().toISOString().split('T')[0]}_${new Date().toTimeString().split(':').slice(0,2).join('')}.xlsx`
    XLSX.writeFile(workbook, fileName)
  }

  const handleResetAllScores = async () => {
    setResetting(true)
    try {
      // Reset all student scores in Firestore
      const batch: Promise<void>[] = []
      students.forEach((student) => {
        const scoreRef = doc(db, "studentScores", student.id)
        batch.push(
          setDoc(scoreRef, {
            remainingScore: 100,
            scoreNote: "",
            history: [],
            updatedAt: new Date().toISOString()
          })
        )
      })

      await Promise.all(batch)

      // Update local state
      setStudents((prev) =>
        prev.map((s) => ({
          ...s,
          remainingScore: 100,
          scoreNote: "",
          history: []
        }))
      )

      alert("✅ All scores have been reset to 100 and history cleared!")
      setShowResetConfirm(false)
    } catch (error) {
      console.error("Error resetting scores:", error)
      alert("❌ Failed to reset scores. Please try again.")
    } finally {
      setResetting(false)
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
          <div className="flex gap-2 flex-wrap">        
            <Button onClick={loadStudents} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm text-blue-600 font-medium">Total Students</div>
            <div className="text-2xl font-bold text-blue-900">{filteredStudents.length}</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-sm text-red-600 font-medium">Total Used Score</div>
            <div className="text-2xl font-bold text-red-900">
              {filteredStudents.reduce((sum, s) => sum + (100 - s.remainingScore), 0)}
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm text-green-600 font-medium">Average Remaining</div>
            <div className="text-2xl font-bold text-green-900">
              {filteredStudents.length > 0
                ? (
                    filteredStudents.reduce((sum, s) => sum + s.remainingScore, 0) /
                    filteredStudents.length
                  ).toFixed(1)
                : 0}
            </div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="text-sm text-orange-600 font-medium">With Reductions</div>
            <div className="text-2xl font-bold text-orange-900">
              {filteredStudents.filter(s => s.remainingScore < 100).length}
            </div>
          </div>
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
                  Current Note
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium w-40">Actions</th>
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
                  const isShowingHistory = showHistory === student.id

                  return (
                    <>
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
                            <div className="space-y-2">
                              <Input
                                type="text"
                                placeholder="Reason for reduction..."
                                value={editNote}
                                onChange={(e) => setEditNote(e.target.value)}
                                className="w-full"
                              />
                              <Input
                                type="text"
                                placeholder="Your name (committee)..."
                                value={committeeName}
                                onChange={(e) => setCommitteeName(e.target.value)}
                                className="w-full"
                              />
                            </div>
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
                            <div className="flex gap-1 justify-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(student)}
                                className="text-blue-600 hover:bg-blue-50"
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                              {student.history && student.history.length > 0 && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setShowHistory(isShowingHistory ? null : student.id)}
                                  className="text-purple-600 hover:bg-purple-50"
                                >
                                  <History className="w-3 h-3 mr-1" />
                                  ({student.history.length})
                                </Button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                      {isShowingHistory && student.history && student.history.length > 0 && (
                        <tr key={`${student.id}-history`}>
                          <td colSpan={7} className="px-4 py-4 bg-purple-50/50">
                            <div className="space-y-2">
                              <div className="font-semibold text-sm text-purple-900 mb-2">
                                📋 Score Reduction History
                              </div>
                              {student.history.map((h, hIndex) => (
                                <div key={`${student.id}-h-${hIndex}-${h.timestamp}`} className="bg-white p-3 rounded border border-purple-200 text-sm">
                                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                    <div>
                                      <span className="text-muted-foreground">Time:</span>
                                      <div className="font-medium">{new Date(h.timestamp).toLocaleString('id-ID')}</div>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Committee:</span>
                                      <div className="font-medium text-purple-700">{h.committeeeName}</div>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Score Change:</span>
                                      <div className="font-medium">{h.previousScore} → {h.newScore}</div>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Reduction:</span>
                                      <div className="font-bold text-red-600">-{h.reduction}</div>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Reason:</span>
                                      <div className="font-medium">{h.reason}</div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Instructions */}
        <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 p-3 rounded space-y-1">
          <div><strong>💡 How to Use:</strong></div>
          <div>1. Click "Edit" → Enter new remaining score → Add reason & your name → Click ✓ to save</div>
          <div>2. Click "History" button to see all reduction records for that student</div>
          <div>3. Click "Export Excel" to download complete data with full history</div>
          <div>4. Click "Reset All" to restore all scores to 100 (⚠️ backup first!)</div>
        </div>

        {/* Reset Confirmation Modal */}
        {showResetConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">⚠️</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-red-900">Reset All Scores?</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    This action will:
                  </p>
                  <ul className="text-sm text-gray-600 mt-2 space-y-1 list-disc list-inside">
                    <li>Reset all student scores back to <strong>100</strong></li>
                    <li>Clear all score notes</li>
                    <li>Delete all history records</li>
                  </ul>
                  <p className="text-sm font-bold text-red-600 mt-3">
                    ⚠️ This action cannot be undone!
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    💡 Tip: Export Excel first to backup all data before resetting.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowResetConfirm(false)}
                  disabled={resetting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleResetAllScores}
                  disabled={resetting}
                >
                  {resetting ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Yes, Reset All
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}