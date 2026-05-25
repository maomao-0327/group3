import { z } from "zod";

export const availabilitySlotSchema = z.object({
  day: z.string().min(1),
  start: z.string().min(1),
  end: z.string().min(1),
});

export const registerSchema = z.object({
  role: z.enum(["student", "professor"]),
  nickname: z.string().min(1),
  games: z.array(z.string().min(1)).min(1),
  availability: z.array(availabilitySlotSchema).min(1),
});

export const roomSchema = z.object({
  name: z.string().min(1),
  building: z.string().min(1),
  capacity: z.number().int().positive(),
  availableSlots: z.array(availabilitySlotSchema).min(1),
});

export const matchRequestSchema = z.object({
  studentId: z.string().min(1),
  professorId: z.string().min(1),
});
