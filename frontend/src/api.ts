export type AvailabilitySlot = {
  day: string;
  start: string;
  end: string;
};

export type UserPayload = {
  role: "student" | "professor";
  nickname: string;
  games: string[];
  availability: AvailabilitySlot[];
};

export type RoomPayload = {
  name: string;
  building: string;
  capacity: number;
  availableSlots: AvailabilitySlot[];
};

// サーバーから取得するデータ型（ID付き）
export type User = UserPayload & { id: string };
export type Room = RoomPayload & { id: string };

export type Match = {
  id: string;
  student: User;
  professor: User;
  room: Room;
  matchedGame: string;
  slot: AvailabilitySlot;
};

// マッチング提案用の型
export type MatchSuggestion = {
  studentId: string;
  professorId: string;
  roomId?: string;
  gameOptions: string[];
  availability: AvailabilitySlot[];
};

export const api = {
  fetchJson: async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${res.status}: ${body}`);
    }
    return res.json();
  },
  getUsers: () => api.fetchJson<User[]>("/api/users"),
  getRooms: () => api.fetchJson<Room[]>("/api/rooms"),
  getMatches: () => api.fetchJson<Match[]>("/api/matches"),
  getSuggestions: () =>
    api.fetchJson<MatchSuggestion[]>("/api/matches/suggestions"),
  registerUser: (payload: UserPayload) =>
    api.fetchJson<User>("/api/users/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createRoom: (payload: RoomPayload) =>
    api.fetchJson<Room>("/api/rooms", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createMatch: (payload: { studentId: string; professorId: string; roomId?: string; matchedGame?: string }) =>
    api.fetchJson<Match>("/api/matches", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
