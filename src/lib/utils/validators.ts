import { z } from 'zod'

export const emailSchema = z.string().email('Invalid email address')

export const userIdSchema = z.string().min(1, 'User ID is required')

export const organizationIdSchema = z
  .string()
  .min(1, 'Organization ID is required')

export const roleSchema = z.enum(['super_admin', 'admin', 'support', 'member'])

export const rolesArraySchema = z.array(roleSchema)

export function validateEmail(email: string): boolean {
  try {
    emailSchema.parse(email)
    return true
  } catch {
    return false
  }
}

export function validateUserId(userId: string): boolean {
  try {
    userIdSchema.parse(userId)
    return true
  } catch {
    return false
  }
}

export function validateOrganizationId(orgId: string): boolean {
  try {
    organizationIdSchema.parse(orgId)
    return true
  } catch {
    return false
  }
}

export function validateRole(role: string): boolean {
  try {
    roleSchema.parse(role)
    return true
  } catch {
    return false
  }
}

export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '')
}
