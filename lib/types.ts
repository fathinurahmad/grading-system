export type UserRole = "admin" | "dosen" | "panitia"

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
}

export interface Student {
  id: string
  name: string
  class: string
  group: string
  totalScore?: number
}

export interface Score {
  id: string
  studentId: string
  subject: string
  score: number
  createdAt: Date
}

export interface GroupNote {
  id: string
  groupId: string
  subject: string
  notes: string
  createdAt: Date
}
