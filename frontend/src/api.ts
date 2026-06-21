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

export type MatchSuggestion = {
  student: User;
  professor: User;
  room: Room;
  sharedGames: string[];
  slot: AvailabilitySlot;
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
    if (res.status === 204) {
      return {} as T;
    }
    return res.json();
  },

  getUsers: () => api.fetchJson<User[]>("/api/users"),
  getRooms: () => api.fetchJson<Room[]>("/api/rooms"),
  getMatches: () => api.fetchJson<Match[]>("/api/matches"),
  getSuggestions: () => api.fetchJson<MatchSuggestion[]>("/api/matches/suggestions"),

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

  confirmMatch: (payload: {
    studentId: string;
    professorId: string;
    roomId: string;
    matchedGame: string;
    slot: AvailabilitySlot;
  }) =>
    api.fetchJson<Match>("/api/matches", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // 【修正案A】エラーが出たエンドポイント。もしサーバーが対応していないなら下記Bを試す
  deleteUser: (id: string) =>
    api.fetchJson<void>(`/api/users/${id}`, {
      method: "DELETE",
    }),

  // 【修正案B】募集の実態である「Room」側を削除するエンドポイント
  deleteRoom: (id: string) =>
    api.fetchJson<void>(`/api/rooms/${id}`, {
      method: "DELETE",
    }),
};