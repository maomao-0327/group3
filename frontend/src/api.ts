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
  getUsers: () => api.fetchJson<any[]>("/api/users"),
  getRooms: () => api.fetchJson<any[]>("/api/rooms"),
  getMatches: () => api.fetchJson<any[]>("/api/matches"),
  registerUser: (payload: UserPayload) =>
    api.fetchJson<any>("/api/users/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createRoom: (payload: RoomPayload) =>
    api.fetchJson<any>("/api/rooms", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createMatch: (payload: { studentId: string; professorId: string }) =>
    api.fetchJson<any>("/api/matches", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
