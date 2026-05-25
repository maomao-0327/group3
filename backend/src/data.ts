import { AvailabilitySlot, MatchRequest, Room, UserProfile } from "./types";
import { getDb, saveDatabase } from "./db";

function generateId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).substring(2, 10)}`;
}

function findCommonSlots(
  a: AvailabilitySlot[],
  b: AvailabilitySlot[]
): AvailabilitySlot[] {
  return a.filter((slotA) =>
    b.some(
      (slotB) =>
        slotA.day === slotB.day && slotA.start === slotB.start && slotA.end === slotB.end
    )
  );
}

function findBestMatch(student: UserProfile, professor: UserProfile): { slot: AvailabilitySlot; room: Room } | null {
  const commonSlots = findCommonSlots(student.availability, professor.availability);
  if (commonSlots.length === 0) {
    return null;
  }

  const db = getDb();
  for (const slot of commonSlots) {
    const result = db.exec("SELECT * FROM rooms");
    const roomRows = (result.length > 0 ? result[0].values : []) as any[];

    const room = roomRows.find((row: any) => {
      const availableSlots: AvailabilitySlot[] = JSON.parse(row[4] as string); // availableSlots column
      return availableSlots.some(
        (roomSlot) =>
          roomSlot.day === slot.day &&
          roomSlot.start === slot.start &&
          roomSlot.end === slot.end
      );
    });

    if (room) {
      const availableSlots: AvailabilitySlot[] = JSON.parse(room[4] as string);
      return {
        slot,
        room: {
          id: room[0] as string,
          name: room[1] as string,
          building: room[2] as string,
          capacity: room[3] as number,
          availableSlots,
          createdAt: room[5] as string,
        },
      };
    }
  }

  return null;
}

export const store = {
  // ユーザー操作
  getUsers: (): UserProfile[] => {
    const db = getDb();
    const result = db.exec("SELECT * FROM users");
    if (result.length === 0) return [];

    return (result[0].values as any[]).map((row: any) => ({
      id: row[0] as string,
      role: row[1] as "student" | "professor",
      nickname: row[2] as string,
      games: JSON.parse(row[3] as string),
      availability: JSON.parse(row[4] as string),
      createdAt: row[5] as string,
    }));
  },

  addUser: (user: UserProfile): void => {
    const db = getDb();
    db.run(
      "INSERT INTO users (id, role, nickname, games, availability, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
      [user.id, user.role, user.nickname, JSON.stringify(user.games), JSON.stringify(user.availability), user.createdAt]
    );
    saveDatabase();
  },

  // 教室操作
  getRooms: (): Room[] => {
    const db = getDb();
    const result = db.exec("SELECT * FROM rooms");
    if (result.length === 0) return [];

    return (result[0].values as any[]).map((row: any) => ({
      id: row[0] as string,
      name: row[1] as string,
      building: row[2] as string,
      capacity: row[3] as number,
      availableSlots: JSON.parse(row[4] as string),
      createdAt: row[5] as string,
    }));
  },

  addRoom: (room: Room): void => {
    const db = getDb();
    db.run(
      "INSERT INTO rooms (id, name, building, capacity, availableSlots, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
      [room.id, room.name, room.building, room.capacity, JSON.stringify(room.availableSlots), room.createdAt]
    );
    saveDatabase();
  },

  // マッチ操作
  getMatches: (): MatchRequest[] => {
    const db = getDb();
    const result = db.exec("SELECT * FROM matches");
    if (result.length === 0) return [];

    return (result[0].values as any[]).map((row: any) => ({
      id: row[0] as string,
      studentId: row[1] as string,
      professorId: row[2] as string,
      roomId: row[3] as string,
      slot: JSON.parse(row[4] as string),
      status: row[5] as "pending" | "confirmed" | "cancelled",
      createdAt: row[6] as string,
    }));
  },

  addMatch: (match: MatchRequest): void => {
    const db = getDb();
    db.run(
      "INSERT INTO matches (id, studentId, professorId, roomId, slot, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [match.id, match.studentId, match.professorId, match.roomId, JSON.stringify(match.slot), match.status, match.createdAt]
    );
    saveDatabase();
  },

  generateId,
  findBestMatch,
};
