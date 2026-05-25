export type Role = "student" | "professor";

export interface AvailabilitySlot {
  day: string;
  start: string;
  end: string;
}

export interface UserProfile {
  id: string;
  role: Role;
  nickname: string;
  games: string[];
  availability: AvailabilitySlot[];
  createdAt: string;
}

export interface Room {
  id: string;
  name: string;
  building: string;
  capacity: number;
  availableSlots: AvailabilitySlot[];
  createdAt: string;
}

export type MatchStatus = "pending" | "confirmed" | "cancelled";

export interface MatchRequest {
  id: string;
  studentId: string;
  professorId: string;
  roomId: string;
  slot: AvailabilitySlot;
  status: MatchStatus;
  createdAt: string;
}
