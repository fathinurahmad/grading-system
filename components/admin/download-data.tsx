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

      // Header styling
      const range = XLSX.utils.decode_range(ws["!ref"] || "A1")
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_col(C) + "1"
        if (!ws[address]) continue
        
        ws[address].s = {
          font: { bold: true, sz: 12, color: { rgb: "000000" } },
          fill: { fgColor: { rgb: "D3D3D3" } },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } },
          },
        }
      }

      // Data row styling
      for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const address = XLSX.utils.encode_col(C) + (R + 1)
          if (!ws[address]) continue

          ws[address].s = {
            alignment: { horizontal: "left", vertical: "center" },
            border: {
              top: { style: "thin", color: { rgb: "CCCCCC" } },
              bottom: { style: "thin", color: { rgb: "CCCCCC" } },
              left: { style: "thin", color: { rgb: "CCCCCC" } },
              right: { style: "thin", color: { rgb: "CCCCCC" } },
            },
          }
        }
      }

      XLSX.utils.book_append_sheet(wb, ws, name)
    })

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array", cellStyles: true })
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

  // 📊 Download Committee Score Recap
  const handleDownloadPanitiaScores = async () => {
    setLoading("panitia")
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

      const scoresSnapshot = await getDocs(collection(db, "studentScores"))
      const scoresMap: Record<string, { remainingScore: number; scoreNote: string }> = {}
      
      scoresSnapshot.docs.forEach((doc) => {
        const data = doc.data()
        scoresMap[doc.id] = {
          remainingScore: data.remainingScore !== undefined ? data.remainingScore : 100,
          scoreNote: data.scoreNote || "",
        }
      })

      const panitiaData = studentsList.map((student) => {
        const scoreData = scoresMap[student.id] || { remainingScore: 100, scoreNote: "" }
        return {
          "Student Name": student.name,
          Class: student.class,
          Group: student.group,
          "Remaining Score": scoreData.remainingScore,
          "Used Score": 100 - scoreData.remainingScore,
          Notes: scoreData.scoreNote || "-",
        }
      })

      panitiaData.sort((a: any, b: any) => {
        if (a.Class !== b.Class) return a.Class.localeCompare(b.Class)
        return Number(a.Group) - Number(b.Group)
      })

      if (panitiaData.length === 0) {
        setMessage("No committee score data found.")
        return
      }

      exportToExcel(panitiaData, "Committee_Score_Recap")
      setMessage(`✅ Successfully exported ${panitiaData.length} committee score records!`)
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
      label: "Students Data",
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
      description: "Remaining Score & Notes",
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
