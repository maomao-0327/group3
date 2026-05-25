import { useEffect, useMemo, useState } from "react";
import { api, AvailabilitySlot, RoomPayload, UserPayload } from "./api";

const defaultAvailability = [{ day: "Mon", start: "18:00", end: "20:00" }];

function App() {
  const [users, setUsers] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);

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

  const [matchForm, setMatchForm] = useState({ studentId: "", professorId: "" });

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

  useEffect(() => {
    refreshAll();
  }, []);

  const onUserSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      await api.registerUser(userForm);
      setStatusMessage("ユーザーを登録しました。");
      setUserForm({ ...userForm, nickname: "", games: [""], availability: defaultAvailability });
      await refreshAll();
    } catch (error) {
      setStatusMessage(`登録エラー: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const onRoomSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      await api.createRoom(roomForm);
      setStatusMessage("教室を登録しました。");
      setRoomForm({ ...roomForm, name: "", building: "", capacity: 4, availableSlots: defaultAvailability });
      await refreshAll();
    } catch (error) {
      setStatusMessage(`登録エラー: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const onMatchSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      await api.createMatch(matchForm);
      setStatusMessage("マッチングリクエストを送信しました。");
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

  return (
    <div className="app">
      <header>
        <h1>Classroom Match</h1>
        <p>教授・生徒・教室の登録とマッチングを試せます。</p>
      </header>

      <section>
        <h2>サーバー状態</h2>
        <p>{loading ? "読み込み中..." : "サーバー接続中"}</p>
        {statusMessage && <p>{statusMessage}</p>}
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
                <option value="student">Student</option>
                <option value="professor">Professor</option>
              </select>
            </label>
            <label>
              ニックネーム
              <input
                value={userForm.nickname}
                onChange={(event) => setUserForm({ ...userForm, nickname: event.target.value })}
                required
              />
            </label>
            <label>
              ゲーム嗜好（カンマ区切り）
              <input
                value={userForm.games.join(",")}
                onChange={(event) => setUserForm({ ...userForm, games: event.target.value.split(",").map((v) => v.trim()).filter(Boolean) })}
                placeholder="FPS, RPG"
                required
              />
            </label>
            <label>
              開始時間
              <input
                value={userForm.availability[0].start}
                onChange={(event) => updateAvailability(event.target.value, 0, "start")}
                required
              />
            </label>
            <label>
              終了時間
              <input
                value={userForm.availability[0].end}
                onChange={(event) => updateAvailability(event.target.value, 0, "end")}
                required
              />
            </label>
            <label>
              曜日
              <input
                value={userForm.availability[0].day}
                onChange={(event) => updateAvailability(event.target.value, 0, "day")}
                required
              />
            </label>
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
                required
              />
            </label>
            <label>
              建物
              <input
                value={roomForm.building}
                onChange={(event) => setRoomForm({ ...roomForm, building: event.target.value })}
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
            <label>
              開始時間
              <input
                value={roomForm.availableSlots[0].start}
                onChange={(event) => updateRoomAvailability(event.target.value, 0, "start")}
                required
              />
            </label>
            <label>
              終了時間
              <input
                value={roomForm.availableSlots[0].end}
                onChange={(event) => updateRoomAvailability(event.target.value, 0, "end")}
                required
              />
            </label>
            <label>
              曜日
              <input
                value={roomForm.availableSlots[0].day}
                onChange={(event) => updateRoomAvailability(event.target.value, 0, "day")}
                required
              />
            </label>
          </div>
          <button type="submit" disabled={loading}>登録</button>
        </form>
      </section>

      <section>
        <h2>マッチング</h2>
        <form onSubmit={onMatchSubmit}>
          <div className="form-grid">
            <label>
              学生
              <select
                value={matchForm.studentId}
                onChange={(event) => setMatchForm({ ...matchForm, studentId: event.target.value })}
                required
              >
                <option value="">選択してください</option>
                {studentOptions.map((user) => (
                  <option key={user.id} value={user.id}>{user.nickname} ({user.id})</option>
                ))}
              </select>
            </label>
            <label>
              教授
              <select
                value={matchForm.professorId}
                onChange={(event) => setMatchForm({ ...matchForm, professorId: event.target.value })}
                required
              >
                <option value="">選択してください</option>
                {professorOptions.map((user) => (
                  <option key={user.id} value={user.id}>{user.nickname} ({user.id})</option>
                ))}
              </select>
            </label>
          </div>
          <button type="submit" disabled={loading || !matchForm.studentId || !matchForm.professorId}>マッチング実行</button>
        </form>
      </section>

      <section>
        <h2>登録済みデータ</h2>
        <div>
          <h3>ユーザー</h3>
          <pre>{JSON.stringify(users, null, 2)}</pre>
        </div>
        <div>
          <h3>教室</h3>
          <pre>{JSON.stringify(rooms, null, 2)}</pre>
        </div>
        <div>
          <h3>マッチ</h3>
          <pre>{JSON.stringify(matches, null, 2)}</pre>
        </div>
      </section>
    </div>
  );
}

export default App;
