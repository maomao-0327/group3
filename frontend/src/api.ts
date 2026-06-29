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
  room_name?: string | null;
  capacity?: number;
  comment?: string;
  sns_contact?: string;
};

export type User = {
  id: string;
  nickname: string;
  room_name?: string | null;
  capacity?: number;
  comment?: string;
  sns_contact?: string;
  games?: string[];
  availability?: AvailabilitySlot[];
};

export type Match = {
  id: string;
  student?: { nickname: string } | null;
  professor?: { nickname: string } | null;
  room?: { name: string } | null;
  studentId?: string;
  professorId?: string;
  matchedGame: string;
  members?: User[];
};

export type ChatMessage = {
  id: number;
  sender: string;
  text: string;
  time: string;
};

const BASE_URL = ""; // 相対パスにしてプロキシとFlaskの両方で稼働可能にする

export const api = {
  fetchJson: async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `${res.status}: エラーが発生しました`);
    }
    if (res.status === 204) {
      return {} as T;
    }
    return res.json();
  },

  getUsers: () => api.fetchJson<User[]>("/api/users"),
  getMatches: () => api.fetchJson<Match[]>("/api/matches"),
  
  checkStatus: (userId: string) => 
    api.fetchJson<{
      is_matched: boolean;
      exists?: boolean;
      event_id?: number;
      matched_game?: string;
      day?: string;
      period?: number;
      room_name?: string;
      members?: User[];
      capacity?: number;
    }>(`/api/check_status?user_id=${userId}`),

  registerUser: (payload: UserPayload) =>
    api.fetchJson<{ success: boolean; user_id: number }>("/api/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  triggerMatching: () =>
    api.fetchJson<{ success: boolean; message: string }>("/api/match", {
      method: "POST",
    }),

  getChat: (eventId: number) => 
    api.fetchJson<ChatMessage[]>(`/api/events/${eventId}/chat`),

  sendChat: (eventId: number, sender: string, message: string) =>
    api.fetchJson<{ success: boolean }>(`/api/events/${eventId}/chat`, {
      method: "POST",
      body: JSON.stringify({ sender, message }),
    }),

  joinEvent: (payload: {
    host_user_id: number;
    nickname: string;
    comment: string;
    sns_contact: string;
    game: string;
    day: string;
    start: string;
  }) =>
    api.fetchJson<{
      success: boolean;
      user_id: number;
      event_id: number;
      room_name: string;
      matched_game: string;
      day: string;
      period: number;
      members: User[];
      capacity: number;
    }>("/api/join_event", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  deleteUser: (userId: string) =>
    api.fetchJson<{ success: boolean; message: string }>(`/api/users/${userId}`, {
      method: "DELETE",
    }),
};