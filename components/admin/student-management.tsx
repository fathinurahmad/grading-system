"use client"

import { useState, useEffect } from "react"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Student } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Trash2, Edit2, Plus, Search } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"

export function StudentManagement() {
  const [students, setStudents] = useState<Student[]>([])
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedClass, setSelectedClass] = useState("")
  const [selectedGroup, setSelectedGroup] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [formData, setFormData] = useState({ name: "", class: "", group: "" })
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null)

  const [classes, setClasses] = useState<string[]>([])
  const [groupsByClass, setGroupsByClass] = useState<Record<string, string[]>>({})
  const [rawData, setRawData] = useState<any>({})

  const { toast } = useToast()

  useEffect(() => {
    fetchStudents()
  }, [])

  useEffect(() => {
    filterStudents()
  }, [students, searchTerm, selectedClass, selectedGroup])

  const fetchStudents = async () => {
    try {
      const docRef = doc(db, "students", "all_classes")
      const snap = await getDoc(docRef)

      if (!snap.exists()) {
        console.warn("❌ No student data found in Firestore")
        setStudents([])
        setRawData({})
        return
      }

      const data = snap.data()
      setRawData(data)
      
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
      console.error("Error fetching students:", error)
      toast({
        title: "Error",
        description: "Failed to fetch students from database",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filterStudents = () => {
    let filtered = students

    if (searchTerm) {
      filtered = filtered.filter((s) => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
    }

    if (selectedClass) {
      filtered = filtered.filter((s) => s.class === selectedClass)
    }

    if (selectedGroup) {
      filtered = filtered.filter((s) => s.group === selectedGroup)
    }

    setFilteredStudents(filtered)
  }

  const saveToFirestore = async (updatedData: any) => {
    try {
      setSaving(true)
      const docRef = doc(db, "students", "all_classes")
      await setDoc(docRef, updatedData)
      return true
    } catch (error) {
      console.error("Error saving to Firestore:", error)
      toast({
        title: "Error",
        description: "Failed to save changes to database",
        variant: "destructive",
      })
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleAddStudent = async () => {
    if (!formData.name.trim() || !formData.class || !formData.group) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive",
      })
      return
    }

    const updatedData = { ...rawData }

    if (editingStudent) {
      // EDIT: Remove old entry
      const oldClass = editingStudent.class
      const oldGroup = editingStudent.group
      const oldName = editingStudent.name

      if (updatedData[oldClass]?.[oldGroup]) {
        updatedData[oldClass][oldGroup] = updatedData[oldClass][oldGroup].filter(
          (n: string) => n !== oldName
        )
        
        // Remove group if empty
        if (updatedData[oldClass][oldGroup].length === 0) {
          delete updatedData[oldClass][oldGroup]
        }
        
        // Remove class if empty
        if (Object.keys(updatedData[oldClass]).length === 0) {
          delete updatedData[oldClass]
        }
      }
    }

    // ADD/UPDATE: Add to new location
    if (!updatedData[formData.class]) {
      updatedData[formData.class] = {}
    }
    if (!updatedData[formData.class][formData.group]) {
      updatedData[formData.class][formData.group] = []
    }

    // Check for duplicate name in same class and group
    if (updatedData[formData.class][formData.group].includes(formData.name.trim())) {
      toast({
        title: "Duplicate Entry",
        description: "This student already exists in the selected class and group",
        variant: "destructive",
      })
      return
    }

    updatedData[formData.class][formData.group].push(formData.name.trim())
    updatedData[formData.class][formData.group].sort()

    const success = await saveToFirestore(updatedData)
    
    if (success) {
      toast({
        title: "Success",
        description: editingStudent ? "Student updated successfully" : "Student added successfully",
      })
      await fetchStudents()
      handleCloseDialog()
    }
  }

  const handleDeleteStudent = async () => {
    if (!studentToDelete) return

    const updatedData = { ...rawData }
    const { class: className, group: groupNumber, name } = studentToDelete

    if (updatedData[className]?.[groupNumber]) {
      updatedData[className][groupNumber] = updatedData[className][groupNumber].filter(
        (n: string) => n !== name
      )

      // Remove group if empty
      if (updatedData[className][groupNumber].length === 0) {
        delete updatedData[className][groupNumber]
      }

      // Remove class if empty
      if (Object.keys(updatedData[className]).length === 0) {
        delete updatedData[className]
      }

      const success = await saveToFirestore(updatedData)
      
      if (success) {
        toast({
          title: "Success",
          description: "Student deleted successfully",
        })
        await fetchStudents()
      }
    }

    setDeleteDialogOpen(false)
    setStudentToDelete(null)
  }

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student)
    setFormData({ name: student.name, class: student.class, group: student.group })
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingStudent(null)
    setFormData({ name: "", class: "", group: "" })
  }

  const openDeleteDialog = (student: Student) => {
    setStudentToDelete(student)
    setDeleteDialogOpen(true)
  }

  if (loading) {
    return <div className="flex justify-center items-center py-10">Loading student data...</div>
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Student Management</CardTitle>
          <CardDescription>Manage students with full CRUD operations synced to Firestore</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <select
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value)
                  setSelectedGroup("")
                }}
                className="px-3 py-2 border border-input rounded-md bg-background"
              >
                <option value="">All Classes</option>
                {classes.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>

              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="px-3 py-2 border border-input rounded-md bg-background"
              >
                <option value="">All Groups</option>
                {selectedClass &&
                  groupsByClass[selectedClass]?.map((grp) => (
                    <option key={grp} value={grp}>
                      Group {grp}
                    </option>
                  ))}
              </select>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Student
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingStudent ? "Edit Student" : "Add New Student"}</DialogTitle>
                  <DialogDescription>
                    {editingStudent
                      ? "Update the selected student information."
                      : "Add a new student to the database."}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter student name"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Class</label>
                    <select
                      value={formData.class}
                      onChange={(e) => {
                        const cls = e.target.value
                        setFormData({ ...formData, class: cls, group: "" })
                      }}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background"
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
                      value={formData.group}
                      onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background"
                      disabled={!formData.class}
                    >
                      <option value="">Select group</option>
                      {formData.class &&
                        groupsByClass[formData.class]?.map((grp) => (
                          <option key={grp} value={grp}>
                            Group {grp}
                          </option>
                        ))}
                    </select>
                  </div>

                  <Button onClick={handleAddStudent} className="w-full" disabled={saving}>
                    {saving ? "Saving..." : editingStudent ? "Update Student" : "Add Student"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Student Table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium w-12">No</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Class</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Group</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No students found
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student, index) => (
                      <tr key={student.id} className="border-b hover:bg-muted/50">
                        <td className="px-4 py-3 font-medium">{index + 1}</td>
                        <td className="px-4 py-3">{student.name}</td>
                        <td className="px-4 py-3">{student.class}</td>
                        <td className="px-4 py-3">Group {student.group}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEditStudent(student)}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(student)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{studentToDelete?.name}</strong> from{" "}
              <strong>{studentToDelete?.class}</strong> - Group {studentToDelete?.group}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStudent} disabled={saving}>
              {saving ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}