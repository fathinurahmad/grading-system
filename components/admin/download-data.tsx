"use client"

import { useState } from "react"
import { collection, doc, getDoc, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import * as XLSX from "xlsx"
import { saveAs } from "file-saver"

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

export function DownloadData() {
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState("")

  // 🧾 Export multiple sheets to Excel with styling
  const exportToExcelMultiSheet = (sheets: { name: string; data: any[] }[], filename: string) => {
    const wb = XLSX.utils.book_new()

    sheets.forEach(({ name, data }) => {
      if (data.length === 0) return

      const ws = XLSX.utils.json_to_sheet(data)

      // Auto column width
      const colWidths = Object.keys(data[0]).map((key) => ({
        wch: Math.max(key.length + 2, ...data.map((row) => String(row[key] || "").length + 2)),
      }))
      ws["!cols"] = colWidths

      XLSX.utils.book_append_sheet(wb, ws, name)
    })

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    saveAs(blob, `${filename}-${new Date().toISOString().split("T")[0]}.xlsx`)
  }

  // Export a single sheet
  const exportToExcel = (data: any[], filename: string) => {
    if (data.length === 0) {
      setMessage("No data to export.")
      return
    }

    exportToExcelMultiSheet([{ name: "Data", data }], filename)
    setMessage(`Successfully exported ${filename}`)
  }

  // 🎓 Download Students Data (3 Sheets: Score Recap, History, Lecturer Notes)
  const handleDownloadStudents = async () => {
    setLoading("students")
    setMessage("")
    try {
      const studentsDoc = doc(db, "students", "all_classes")
      const studentsSnap = await getDoc(studentsDoc)
      
      if (!studentsSnap.exists()) {
        setMessage("No student data found.")
        return
      }

      const studentsData = studentsSnap.data()
      const studentsList: any[] = []

      Object.entries(studentsData).forEach(([className, groups]) => {
        Object.entries(groups as Record<string, string[]>).forEach(([groupNumber, names]) => {
          names.forEach((name) => {
            studentsList.push({
              id: `${className}-${groupNumber}-${name}`,
              name,
              class: className,
              group: groupNumber,
            })
          })
        })
      })

      const scoresSnapshot = await getDocs(collection(db, "scores"))
      const scores = scoresSnapshot.docs.map((doc) => doc.data())

      const rekapData = studentsList.map((student: any) => {
        const studentScores = scores.filter(
          (score: any) => score.studentId === student.id || score.studentName === student.name
        )

        const businessScore = studentScores
          .filter((s: any) => s.subject?.toLowerCase() === "business")
          .reduce((sum: number, s: any) => sum + (Number(s.score) || 0), 0)

        const englishScore = studentScores
          .filter((s: any) => s.subject?.toLowerCase() === "english")
          .reduce((sum: number, s: any) => sum + (Number(s.score) || 0), 0)

        const entrepreneurshipScore = studentScores
          .filter((s: any) => s.subject?.toLowerCase() === "entrepreneurship")
          .reduce((sum: number, s: any) => sum + (Number(s.score) || 0), 0)

        const total = businessScore + englishScore + entrepreneurshipScore

        return {
          Student: student.name || "",
          Class: student.class || "",
          Group: student.group || "",
          Business: businessScore,
          English: englishScore,
          Entrepreneurship: entrepreneurshipScore,
          Total: total,
        }
      })

      rekapData.sort((a: any, b: any) => {
        if (a.Class !== b.Class) return a.Class.localeCompare(b.Class)
        return Number(a.Group) - Number(b.Group)
      })

      // ===== SHEET 2: HISTORY =====
      const historySnapshot = await getDocs(collection(db, "history"))
      const historyData = historySnapshot.docs.map((doc) => {
        const docData = doc.data()
        return {
          Action: docData.action || "",
          "Performed By": docData.performedBy || "",
          Email: docData.email || "",
          Details: docData.details || "",
          "Date & Time": docData.createdAt?.toDate?.()?.toLocaleString("en-US") || "",
        }
      })

      historyData.sort((a: any, b: any) => b["Date & Time"].localeCompare(a["Date & Time"]))

      // ===== SHEET 3: LECTURER NOTES =====
      const notesSnapshot = await getDocs(collection(db, "groupNotes"))
      const notesData = notesSnapshot.docs.map((doc) => {
        const docData = doc.data()
        return {
          Class: docData.class || "",
          Group: docData.group || "",
          Subject: docData.subject || "",
          Notes: docData.notes || "",
          "Created At": docData.createdAt?.toDate?.()?.toLocaleString("en-US") || "",
        }
      })

      notesData.sort((a: any, b: any) => {
        if (a.Class !== b.Class) return a.Class.localeCompare(b.Class)
        return Number(a.Group) - Number(b.Group)
      })

      exportToExcelMultiSheet(
        [
          { name: "Score Recap", data: rekapData },
          { name: "History", data: historyData },
          { name: "Lecturer Notes", data: notesData },
        ],
        "Students_Data_Complete"
      )
      setMessage("✅ Successfully exported data with 3 sheets!")
    } catch (error) {
      setMessage("❌ Failed to export student data.")
      console.error(error)
    } finally {
      setLoading(null)
    }
  }

  // 🧮 Download Scores
  const handleDownloadScores = async () => {
    setLoading("scores")
    setMessage("")
    try {
      const snapshot = await getDocs(collection(db, "scores"))
      const data = snapshot.docs.map((doc) => {
        const docData = doc.data()
        return {
          "Student Name": docData.studentName || "",
          Subject: docData.subject || "",
          Class: docData.class || "",
          Group: docData.group || "",
          Score: docData.score || 0,
          "Date Input": docData.createdAt?.toDate?.()?.toLocaleDateString("en-US") || "",
        }
      })
      exportToExcel(data, "Scores_Data")
    } catch (error) {
      setMessage("❌ Failed to export scores data.")
      console.error(error)
    } finally {
      setLoading(null)
    }
  }

  // 📊 Download Committee Score Recap (ENHANCED VERSION - 4 Sheets)
  const handleDownloadPanitiaScores = async () => {
    setLoading("panitia")
    setMessage("")
    try {
      // Load all students
      const studentsDoc = doc(db, "students", "all_classes")
      const studentsSnap = await getDoc(studentsDoc)
      
      if (!studentsSnap.exists()) {
        setMessage("No student data found.")
        return
      }

      const studentsData = studentsSnap.data()
      const studentsArray: Student[] = []

      // Load scores with history
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

      // Build students array
      Object.entries(studentsData).forEach(([className, groups]) => {
        Object.entries(groups as Record<string, string[]>).forEach(([groupNumber, names]) => {
          names.forEach((name) => {
            const studentId = `${className}-${groupNumber}-${name}`
            const scoreData = scoresMap[studentId] || { remainingScore: 100, scoreNote: "", history: [] }

            studentsArray.push({
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

      // Sort by Class → Group → Name
      const sortedStudents = studentsArray.sort((a, b) => {
        if (a.studentClass !== b.studentClass) {
          return a.studentClass.localeCompare(b.studentClass)
        }
        if (a.studentGroup !== b.studentGroup) {
          return Number(a.studentGroup) - Number(b.studentGroup)
        }
        return a.name.localeCompare(b.name)
      })

      // ===== SHEET 1: MASTER DATA =====
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

      // ===== SHEET 2: HISTORY LOG =====
      const historyData: any[] = []
      sortedStudents.forEach(student => {
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

      historyData.sort((a, b) => {
        const dateA = new Date(a['Date & Time'].split(', ').reverse().join(' '))
        const dateB = new Date(b['Date & Time'].split(', ').reverse().join(' '))
        return dateB.getTime() - dateA.getTime()
      })

      // ===== SHEET 3: SUMMARY =====
      const summaryData = [
        { 'Metric': 'Export Date & Time', 'Value': new Date().toLocaleString('id-ID') },
        { 'Metric': '', 'Value': '' },
        { 'Metric': '📊 STUDENT STATISTICS', 'Value': '' },
        { 'Metric': 'Total Students (All)', 'Value': sortedStudents.length },
        { 'Metric': 'Students with Full Score (100)', 'Value': sortedStudents.filter(s => s.remainingScore === 100).length },
        { 'Metric': 'Students with Reductions', 'Value': sortedStudents.filter(s => s.remainingScore < 100).length },
        { 'Metric': '', 'Value': '' },
        { 'Metric': '📈 SCORE STATISTICS', 'Value': '' },
        { 'Metric': 'Total Score Available', 'Value': sortedStudents.length * 100 },
        { 'Metric': 'Total Score Used', 'Value': sortedStudents.reduce((sum, s) => sum + (100 - s.remainingScore), 0) },
        { 'Metric': 'Total Score Remaining', 'Value': sortedStudents.reduce((sum, s) => sum + s.remainingScore, 0) },
        { 'Metric': 'Average Remaining Score', 'Value': sortedStudents.length > 0 ? (sortedStudents.reduce((sum, s) => sum + s.remainingScore, 0) / sortedStudents.length).toFixed(2) : 0 },
        { 'Metric': '', 'Value': '' },
        { 'Metric': '👥 COMMITTEE STATISTICS', 'Value': '' },
        { 'Metric': 'Total Activities Recorded', 'Value': historyData.length },
        { 'Metric': 'Unique Committee Members', 'Value': new Set(historyData.map(h => h['Committee Name'])).size }
      ]

      // Committee stats breakdown
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

      // ===== SHEET 4: COMMITTEE ACTIVITIES =====
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

      // Export with 4 sheets
      const sheets = [
        { name: "Student Master Data", data: masterData },
        { name: "History Log", data: historyData.length > 0 ? historyData : [{ 'Message': 'No history records found' }] },
        { name: "Summary", data: summaryData },
        { name: "Committee Activities", data: committeeDetailData.length > 0 ? committeeDetailData : [{ 'Message': 'No activities found' }] }
      ]

      exportToExcelMultiSheet(sheets, "Committee_Scores_Complete")
      setMessage(`✅ Successfully exported complete committee data with 4 sheets!`)
    } catch (error) {
      setMessage("❌ Failed to export committee scores.")
      console.error(error)
    } finally {
      setLoading(null)
    }
  }

  // 👤 Download Users
  const handleDownloadUsers = async () => {
    setLoading("users")
    setMessage("")
    try {
      const snapshot = await getDocs(collection(db, "users"))
      const data = snapshot.docs.map((doc) => {
        const docData = doc.data()
        return {
          Email: docData.email || "",
          Role: docData.role || "",
          "Full Name": docData.displayName || docData.name || "",
        }
      })
      exportToExcel(data, "Users_Data")
    } catch (error) {
      setMessage("❌ Failed to export users data.")
      console.error(error)
    } finally {
      setLoading(null)
    }
  }

  const downloadOptions = [
    {
      label: "Lecturer Scores",
      color: "bg-[#DE80FF] hover:bg-[#d066f0]",
      textColor: "text-white",
      onClick: handleDownloadStudents,
      key: "students",
      description: "Score Recap + History + Lecturer Notes",
    },
    {
      label: "Scores Data",
      color: "bg-[#38652E] hover:bg-[#2d5224]",
      textColor: "text-white",
      onClick: handleDownloadScores,
      key: "scores",
    },
    {
      label: "Committee Scores",
      color: "bg-[#645033] hover:bg-[#4d3d27]",
      textColor: "text-white",
      onClick: handleDownloadPanitiaScores,
      key: "panitia",
      description: "Master Data + History + Summary + Activities",
    },
    {
      label: "Users Data",
      color: "bg-[#BFF3FF] hover:bg-[#a8e6f5]",
      textColor: "text-[#145a64]",
      onClick: handleDownloadUsers,
      key: "users",
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Download Data</CardTitle>
        <CardDescription>Export system data to Excel format (.xlsx)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <Alert variant={message.includes("❌") ? "destructive" : "default"}>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {downloadOptions.map((option) => (
            <div key={option.key}>
              <Button
                onClick={option.onClick}
                disabled={loading !== null}
                className={`${option.color} ${option.textColor} h-24 w-full text-lg font-semibold transition-all hover:shadow-lg disabled:opacity-50`}
              >
                {loading === option.key ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 mr-2" />
                    {option.label}
                  </>
                )}
              </Button>
              {option.description && (
                <p className="text-xs text-muted-foreground text-center mt-1">
                  {option.description}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}