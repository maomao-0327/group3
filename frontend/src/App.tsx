import { useEffect, useMemo, useState } from "react";
import { api, AvailabilitySlot, RoomPayload, UserPayload, MatchSuggestion } from "./api";

// 大学の標準的な時限定義
const TIME_SLOTS = [
  { id: "1", label: "1限", start: "08:40", end: "9:5" },
  { id: "2", label: "2限", start: "10:10", end: "11:25" },
  { id: "3", label: "3限", start: "12:15", end: "13:30" },
  { id: "4", label: "4限", start: "13:45", end: "15:00" },
  { id: "5", label: "5限", start: "15:15", end: "16:30" },
  { id: "6", label: "6限", start: "16:45", end: "18:00" },
  { id: "7", label: "放課後", start: "18:10", end: "19:10" },
];

const DAYS = [
  { id: "Mon", label: "月" },
  { id: "Tue", label: "火" },
  { id: "Wed", label: "水" },
  { id: "Thu", label: "木" },
  { id: "Fri", label: "金" },
];

const defaultAvailability = [{ day: "Mon", start: "18:00", end: "19:30" }];

function App() {
  const [users, setUsers] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [userForm, setUserForm] = useState<UserPayload>({
    role: "student",
    nickname: "",
    games: [""],
    availability: defaultAvailability,
  });

  const [roomForm, setRoomForm] = useState<RoomPayload>({
    name: "",
    building: "",
    capacity: 4,
    availableSlots: defaultAvailability,
  });

  const [selectedSuggestion, setSelectedSuggestion] = useState<MatchSuggestion | null>(null);
  const [selectedGame, setSelectedGame] = useState<string>("");

  const studentOptions = useMemo(
    () => users.filter((user) => user.role === "student"),
    [users]
  );
  const professorOptions = useMemo(
    () => users.filter((user) => user.role === "professor"),
    [users]
  );

  const refreshAll = async () => {
    setLoading(true);
    try {
      const [usersData, roomsData, matchesData] = await Promise.all([
        api.getUsers(),
        api.getRooms(),
        api.getMatches(),
      ]);
      setUsers(usersData);
      setRooms(roomsData);
      setMatches(matchesData);
    } catch (error) {
      setStatusMessage(`読み込みエラー: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const suggestionsData = await api.getSuggestions();
      setSuggestions(suggestionsData);
      setShowSuggestions(true);
      if (suggestionsData.length === 0) {
        setStatusMessage("マッチング候補がありません。ユーザーと教室を登録してください。");
      } else {
        setStatusMessage(`${suggestionsData.length}件のマッチング候補を見つけました。`);
      }
    } catch (error) {
      setStatusMessage(`提案読み込みエラー: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const onUserSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userForm.nickname.trim()) {
      setStatusMessage("ニックネームを入力してください。");
      return;
    }
    if (userForm.games.length === 0 || !userForm.games[0]) {
      setStatusMessage("ゲーム嗜好を入力してください。");
      return;
    }

    setLoading(true);
    try {
      await api.registerUser(userForm);
      setStatusMessage("ユーザーを登録しました。");
      setUserForm({ role: "student", nickname: "", games: [""], availability: defaultAvailability });
      await refreshAll();
    } catch (error) {
      setStatusMessage(`登録エラー: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const onRoomSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!roomForm.name.trim()) {
      setStatusMessage("教室名を入力してください。");
      return;
    }
    if (!roomForm.building.trim()) {
      setStatusMessage("建物を入力してください。");
      return;
    }

    setLoading(true);
    try {
      await api.createRoom(roomForm);
      setStatusMessage("教室を登録しました。");
      setRoomForm({ name: "", building: "", capacity: 4, availableSlots: defaultAvailability });
      await refreshAll();
    } catch (error) {
      setStatusMessage(`登録エラー: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const confirmMatch = async (suggestion: MatchSuggestion, game: string) => {
    setLoading(true);
    try {
      await api.createMatch({
        studentId: suggestion.studentId,
        professorId: suggestion.professorId,
        roomId: suggestion.roomId,
        matchedGame: game,
      });
      setStatusMessage("マッチングを確定しました。");
      setSelectedSuggestion(null);
      setSelectedGame("");
      setSuggestions(suggestions.filter((s) => s !== suggestion));
      await refreshAll();
    } catch (error) {
      setStatusMessage(`マッチングエラー: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const updateAvailability = (value: string, index: number, key: keyof AvailabilitySlot) => {
    setUserForm((prev) => {
      const availability = [...prev.availability];
      availability[index] = { ...availability[index], [key]: value };
      return { ...prev, availability };
    });
  };

  const updateRoomAvailability = (value: string, index: number, key: keyof AvailabilitySlot) => {
    setRoomForm((prev) => {
      const availableSlots = [...prev.availableSlots];
      availableSlots[index] = { ...availableSlots[index], [key]: value };
      return { ...prev, availableSlots };
    });
  };

  const handleTimeSlotChange = (slot: (typeof TIME_SLOTS)[0]) => {
    updateAvailability(slot.start, 0, "start");
    updateAvailability(slot.end, 0, "end");
  };

  const handleRoomTimeSlotChange = (slot: (typeof TIME_SLOTS)[0]) => {
    updateRoomAvailability(slot.start, 0, "start");
    updateRoomAvailability(slot.end, 0, "end");
  };

  return (
    <div className="app">
      <header>
        <h1>Classroom Match</h1>
        <p>教授・生徒・教室の登録とマッチングを試せます。</p>
      </header>

      <section>
        <h2>サーバー状態</h2>
        <p>{loading ? "読み込み中..." : "サーバー接続中"}</p>
        {statusMessage && <p style={{ color: "#10b981" }}>{statusMessage}</p>}
        <button type="button" onClick={refreshAll} disabled={loading}>
          最新データを取得
        </button>
      </section>

      <section>
        <h2>ユーザー登録</h2>
        <form onSubmit={onUserSubmit}>
          <div className="form-grid">
            <label>
              役割
              <select
                value={userForm.role}
                onChange={(event) => setUserForm({ ...userForm, role: event.target.value as "student" | "professor" })}
              >
                <option value="student">学生</option>
                <option value="professor">教授</option>
              </select>
            </label>
            <label>
              ニックネーム
              <input
                value={userForm.nickname}
                onChange={(event) => setUserForm({ ...userForm, nickname: event.target.value })}
                placeholder="例: Taro"
                required
              />
            </label>
            <label>
              ゲーム嗜好（カンマ区切り）
              <input
                value={userForm.games.join(",")}
                onChange={(event) => setUserForm({ ...userForm, games: event.target.value.split(",").map((v) => v.trim()).filter(Boolean) })}
                placeholder="例: FPS, RPG"
                required
              />
            </label>
          </div>

          <div>
            <label>
              曜日
              <select
                value={userForm.availability[0].day}
                onChange={(event) => updateAvailability(event.target.value, 0, "day")}
                required
              >
                {DAYS.map((day) => (
                  <option key={day.id} value={day.id}>
                    {day.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <label>時限を選択</label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => handleTimeSlotChange(slot)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: userForm.availability[0].start === slot.start ? "2px solid #2563eb" : "1px solid #4b5563",
                    background: userForm.availability[0].start === slot.start ? "#2563eb" : "#111827",
                    color: "#f9fafb",
                    cursor: "pointer",
                  }}
                >
                  {slot.label}
                </button>
              ))}
            </div>
            <small>選択中: {userForm.availability[0].start} - {userForm.availability[0].end}</small>
          </div>

          <button type="submit" disabled={loading}>登録</button>
        </form>
      </section>

      <section>
        <h2>教室登録</h2>
        <form onSubmit={onRoomSubmit}>
          <div className="form-grid">
            <label>
              教室名
              <input
                value={roomForm.name}
                onChange={(event) => setRoomForm({ ...roomForm, name: event.target.value })}
                placeholder="例: 201号室"
                required
              />
            </label>
            <label>
              建物
              <input
                value={roomForm.building}
                onChange={(event) => setRoomForm({ ...roomForm, building: event.target.value })}
                placeholder="例: A棟"
                required
              />
            </label>
            <label>
              定員
              <input
                type="number"
                value={roomForm.capacity}
                onChange={(event) => setRoomForm({ ...roomForm, capacity: Number(event.target.value) })}
                min={1}
                required
              />
            </label>
          </div>

          <div>
            <label>
              曜日
              <select
                value={roomForm.availableSlots[0].day}
                onChange={(event) => updateRoomAvailability(event.target.value, 0, "day")}
                required
              >
                {DAYS.map((day) => (
                  <option key={day.id} value={day.id}>
                    {day.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <label>時限を選択</label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => handleRoomTimeSlotChange(slot)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: roomForm.availableSlots[0].start === slot.start ? "2px solid #2563eb" : "1px solid #4b5563",
                    background: roomForm.availableSlots[0].start === slot.start ? "#2563eb" : "#111827",
                    color: "#f9fafb",
                    cursor: "pointer",
                  }}
                >
                  {slot.label}
                </button>
              ))}
            </div>
            <small>選択中: {roomForm.availableSlots[0].start} - {roomForm.availableSlots[0].end}</small>
          </div>

          <button type="submit" disabled={loading}>登録</button>
        </form>
      </section>

      <section>
        <h2>自動マッチング</h2>
        <p>条件が合うペアの提案を表示します。</p>
        <button type="button" onClick={loadSuggestions} disabled={loading}>
          マッチング候補を探す
        </button>

        {showSuggestions && suggestions.length > 0 && (
          <div style={{ marginTop: "20px" }}>
            <h3>マッチング候補 ({suggestions.length}件)</h3>
            <div className="card-grid">
              {suggestions.map((suggestion, idx) => {
                const student = users.find((u) => u.id === suggestion.studentId);
                const professor = users.find((u) => u.id === suggestion.professorId);
                const room = rooms.find((r) => r.id === suggestion.roomId);

                return (
                  <div key={idx} className="card">
                    <div className="card-title">マッチング候補 #{idx + 1}</div>
                    <div className="card-field">
                      <span className="card-label">学生</span>
                      <span className="card-value">{student?.nickname || "不明"}</span>
                    </div>
                    <div className="card-field">
                      <span className="card-label">教授</span>
                      <span className="card-value">{professor?.nickname || "不明"}</span>
                    </div>
                    {room && (
                      <div className="card-field">
                        <span className="card-label">教室</span>
                        <span className="card-value">{room.name}</span>
                      </div>
                    )}
                    <div style={{ marginTop: "12px" }}>
                      <span className="card-label">可能なゲーム</span>
                      <div style={{ marginTop: "4px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {suggestion.gameOptions.map((game, gIdx) => (
                          <button
                            key={gIdx}
                            type="button"
                            onClick={() => setSelectedGame(game)}
                            style={{
                              padding: "4px 12px",
                              borderRadius: "12px",
                              border: selectedGame === game && selectedSuggestion === suggestion ? "2px solid #fbbf24" : "1px solid #4b5563",
                              background: selectedGame === game && selectedSuggestion === suggestion ? "#fbbf24" : "#111827",
                              color: selectedGame === game && selectedSuggestion === suggestion ? "#111827" : "#f9fafb",
                              cursor: "pointer",
                              fontSize: "12px",
                            }}
                          >
                            {game}
                          </button>
                        ))}
                      </div>
                    </div>
                    {selectedSuggestion === suggestion && selectedGame && (
                      <button
                        type="button"
                        onClick={() => confirmMatch(suggestion, selectedGame)}
                        disabled={loading}
                        style={{
                          marginTop: "12px",
                          width: "100%",
                          background: "#10b981",
                          padding: "10px",
                        }}
                      >
                        このマッチングを確定
                      </button>
                    )}
                    {selectedSuggestion !== suggestion && (
                      <button
                        type="button"
                        onClick={() => setSelectedSuggestion(suggestion)}
                        style={{
                          marginTop: "12px",
                          width: "100%",
                          background: "#3b82f6",
                          padding: "10px",
                        }}
                      >
                        このマッチングを選択
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section>
        <h2>登録済みデータ</h2>
        
        <div>
          <h3>ユーザー</h3>
          {users.length === 0 ? (
            <div className="empty-state">登録されたユーザーがありません</div>
          ) : (
            <div className="card-grid">
              {users.map((user: any) => (
                <div key={user.id} className="card">
                  <div className="card-title">{user.nickname}</div>
                  <div className="card-field">
                    <span className="card-label">役割</span>
                    <span className="card-value">
                      <span className={`badge ${user.role === "professor" ? "badge-success" : "badge-info"}`}>
                        {user.role === "professor" ? "教授" : "学生"}
                      </span>
                    </span>
                  </div>
                  <div className="card-field">
                    <span className="card-label">ID</span>
                    <span className="card-value" style={{ fontSize: "12px" }}>{user.id}</span>
                  </div>
                  {user.games && user.games.length > 0 && (
                    <div style={{ marginTop: "8px" }}>
                      <span className="card-label">ゲーム</span>
                      <div style={{ marginTop: "4px" }}>
                        {user.games.map((game: string, idx: number) => (
                          <span key={idx} className="badge badge-info">{game}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {user.availability && user.availability.length > 0 && (
                    <div style={{ marginTop: "8px" }}>
                      <span className="card-label">利用可能時間</span>
                      {user.availability.map((slot: any, idx: number) => (
                        <div key={idx} style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>
                          {slot.day}: {slot.start} - {slot.end}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3>教室</h3>
          {rooms.length === 0 ? (
            <div className="empty-state">登録された教室がありません</div>
          ) : (
            <div className="card-grid">
              {rooms.map((room: any) => (
                <div key={room.id} className="card">
                  <div className="card-title">{room.name}</div>
                  <div className="card-field">
                    <span className="card-label">建物</span>
                    <span className="card-value">{room.building}</span>
                  </div>
                  <div className="card-field">
                    <span className="card-label">定員</span>
                    <span className="card-value">
                      <span className="badge badge-warning">{room.capacity}人</span>
                    </span>
                  </div>
                  <div className="card-field">
                    <span className="card-label">ID</span>
                    <span className="card-value" style={{ fontSize: "12px" }}>{room.id}</span>
                  </div>
                  {room.availableSlots && room.availableSlots.length > 0 && (
                    <div style={{ marginTop: "8px" }}>
                      <span className="card-label">利用可能時間</span>
                      {room.availableSlots.map((slot: any, idx: number) => (
                        <div key={idx} style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>
                          {slot.day}: {slot.start} - {slot.end}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3>マッチ</h3>
          {matches.length === 0 ? (
            <div className="empty-state">マッチングレコードがありません</div>
          ) : (
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>学生</th>
                    <th>教授</th>
                    <th>教室</th>
                    <th>ゲーム</th>
                    <th>作成日</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((match: any) => (
                    <tr key={match.id}>
                      <td>{match.student?.nickname || match.studentId}</td>
                      <td>{match.professor?.nickname || match.professorId}</td>
                      <td>{match.room?.name || match.roomId || "-"}</td>
                      <td>{match.matchedGame || "-"}</td>
                      <td>{new Date(match.createdAt).toLocaleDateString("ja-JP")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default App;
