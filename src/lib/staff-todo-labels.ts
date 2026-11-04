// Client-safe staff todo labels/types (no nodemailer / server imports)

export type StaffTodoPriority = 'low' | 'medium' | 'high' | 'urgent'
export type StaffTodoStatus = 'open' | 'in_progress' | 'done' | 'cancelled'

export function staffTodoPriorityLabel(priority: StaffTodoPriority): string {
  switch (priority) {
    case 'urgent':
      return 'Urgent'
    case 'high':
      return 'High'
    case 'medium':
      return 'Medium'
    case 'low':
      return 'Low'
  }
}

export function staffTodoStatusLabel(status: StaffTodoStatus): string {
  switch (status) {
    case 'open':
      return 'Open'
    case 'in_progress':
      return 'In progress'
    case 'done':
      return 'Done'
    case 'cancelled':
      return 'Cancelled'
  }
}

export function isStaffTodoPriority(value: unknown): value is StaffTodoPriority {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'urgent'
}

export function isStaffTodoStatus(value: unknown): value is StaffTodoStatus {
  return (
    value === 'open' ||
    value === 'in_progress' ||
    value === 'done' ||
    value === 'cancelled'
  )
}
