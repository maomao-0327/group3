import { useEffect, useMemo, useState } from "react";
import { api, AvailabilitySlot, UserPayload, MatchSuggestion } from "./api";

// 選択肢となる標準の時限定義
const TIME_SLOT_OPTIONS = [
  { id: "1", label: "1限 (08:40-09:55)", start: "08:40", end: "09:55" },
  { id: "2", label: "2限 (10:10-11:25)", start: "10:10", end: "11:25" },
  { id: "3", label: "3限 (12:15-13:30)", start: "12:15", end: "13:30" },
  { id: "4", label: "4限 (13:45-15:00)", start: "13:45", end: "15:00" },
  { id: "5", label: "5限 (15:15-16:30)", start: "15:15", end: "16:30" },
  { id: "6", label: "6限 (16:45-18:00)", start: "16:45", end: "18:00" },
  { id: "7", label: "放課後 (18:30-ANYTIME)", start: "18:30", end: "ANYTIME" },
];

const DAYS_OF_WEEK = [
  { value: "Mon", label: "月曜日" },
  { value: "Tue", label: "火曜日" },
  { value: "Wed", label: "水曜日" },
  { value: "Thu", label: "木曜日" },
  { value: "Fri", label: "金曜日" },
];

const HOBBY_TAG_GROUPS = [
  {
    category: "アナログゲーム",
    tags: ["ボードゲーム", "カタン", "カルカソンヌ", "人狼ゲーム", "ドミニオン", "将棋", "チェス"],
  },
  {
    category: "伝統・麻雀",
    tags: ["麻雀", "三人麻雀", "雀魂"],
  },
  {
    category: "Switch・対戦協力",
    tags: ["スマブラ", "マリオカート", "スプラトゥーン", "ポケモン", "モンハン"],
  },
  {
    category: "カードゲーム",
    tags: ["ポケモンカード", "遊戯王", "デュエマ", "MTG", "シャドウバース"],
  },
  {
    category: "PC・スマホ",
    tags: ["Apex Legends", "VALORANT", "LoL", "Minecraft"],
  },
];

// トースト通知の型定義
type Toast = {
  id: number;
  message: string;
  type: "success" | "error" | "info";
};

function App() {
  const [users, setUsers] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);

  const [statusMessage, setStatusMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  
  const [view, setView] = useState<"dashboard" | "event">("dashboard");
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [matchedPeople, setMatchedPeople] = useState<string[]>([]);

  const [otherTagInput, setOtherTagInput] = useState<string>("");

  // "none" | "standard" | "custom"
  const [activeModal, setActiveModal] = useState<"none" | "standard" | "custom">("none");

  // セレクトボックス選択値の一時ステート
  const [selectedDay, setSelectedDay] = useState<string>("Mon");
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number>(0);

  // カスタム自由入力値の一時ステート
  const [customDay, setCustomDay] = useState<string>("Mon");
  const [customTimeText, setCustomTimeText] = useState<string>("");

  // トースト一覧を管理するState
  const [toasts, setToasts] = useState<Toast[]>([]);

  // ページ再読み込み時にも削除状態を記憶しておくための仕組み
  const [deletedIds, setDeletedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("fight_club_deleted_ids");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // メインフォーム（一言コメント用として comment フィールドを追加）
  const [userForm, setUserForm] = useState<UserPayload & { customLocation: string; comment: string }>({
    role: "student",
    nickname: "",
    games: [],
    availability: [],
    customLocation: "",
    comment: "",
  });

  // トースト通知をトリガーする関数
  const addToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // 3秒後に自動消去
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const refreshAll = async () => {
    setLoading(true);
    try {
      const [u, m] = await Promise.all([
        api.getUsers(),
        api.getMatches(),
      ]);
      setUsers(u || []);
      setMatches(m || []);
    } catch (err: any) {
      setStatusMessage(`データの同期に失敗しました: ${err.message}`);
      addToast(`同期失敗: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const handleAddStandardTime = () => {
    const targetSlot = TIME_SLOT_OPTIONS[selectedSlotIndex];
    if (!targetSlot) return;

    const newSlot: AvailabilitySlot = {
      day: selectedDay,
      start: targetSlot.start,
      end: targetSlot.end
    };

    const exists = userForm.availability.some(
      s => s.day === newSlot.day && s.start === newSlot.start && s.end === newSlot.end
    );

    if (!exists) {
      setUserForm({
        ...userForm,
        availability: [...userForm.availability, newSlot]
      });
      setStatusMessage(`スケジュールを追加しました。`);
      addToast("空き時間をリストに追加しました", "info");
    } else {
      setStatusMessage("その枠は既に登録されています。");
      addToast("その枠は既に登録されています", "error");
    }
    setActiveModal("none");
  };

  const handleAddCustomTime = () => {
    const text = customTimeText.trim();
    if (!text) {
      alert("時間帯のテキストを入力してください。");
      return;
    }

    const newSlot: AvailabilitySlot = {
      day: customDay,
      start: text,
      end: "CUSTOM"
    };

    const exists = userForm.availability.some(
      s => s.day === newSlot.day && s.start === newSlot.start
    );

    if (!exists) {
      setUserForm({
        ...userForm,
        availability: [...userForm.availability, newSlot]
      });
      setCustomTimeText("");
      setStatusMessage(`カスタム時間「${text}」を追加しました。`);
      addToast("カスタム時間を追加しました", "info");
    } else {
      setStatusMessage("そのカスタム時間は既に存在します。");
      addToast("そのカスタム時間は既に存在します", "error");
    }
    setActiveModal("none");
  };

  const handleRemoveSelectedSlot = (index: number) => {
    const nextList = userForm.availability.filter((_, i) => i !== index);
    setUserForm({ ...userForm, availability: nextList });
    addToast("空き時間を取り消しました", "info");
  };

  const handleToggleTag = (tag: string) => {
    const isSelected = userForm.games.includes(tag);
    const nextGames = isSelected
      ? userForm.games.filter((g) => g !== tag)
      : [...userForm.games, tag];
    setUserForm({ ...userForm, games: nextGames });
  };

  const handleAddCustomTag = () => {
    const trimmed = otherTagInput.trim();
    if (!trimmed) return;
    if (!userForm.games.includes(trimmed)) {
      setUserForm({ ...userForm, games: [...userForm.games, trimmed] });
      setOtherTagInput("");
      addToast(`タイトル「${trimmed}」を追加しました`, "info");
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("このエントリー募集を取り消しますか？")) return;
    
    setLoading(true);
    setStatusMessage("エントリー情報を削除しています...");

    const nextDeletedIds = [...deletedIds, id];
    setDeletedIds(nextDeletedIds);
    localStorage.setItem("fight_club_deleted_ids", JSON.stringify(nextDeletedIds));

    try {
      if (api && typeof api.deleteRoom === "function") {
        await api.deleteRoom(id);
      }
    } catch (err) {
      console.warn("サーバー側のAPIは未対応です。フロントエンド側で永久非表示にしました。");
    }

    setStatusMessage("エントリー情報を削除しました。");
    addToast("募集エントリーを取り消しました", "success");
    setLoading(false);
  };

  const onUserSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userForm.nickname.trim()) {
      setStatusMessage("ニックネームを入力してください。");
      addToast("ニックネームを入力してください", "error");
      return;
    }
    if (!userForm.customLocation.trim()) {
      setStatusMessage("対戦希望場所を入力してください。");
      addToast("対戦希望場所を入力してください", "error");
      return;
    }
    if (userForm.availability.length === 0) {
      setStatusMessage("空き時間を最低1つ以上選択・登録してください。");
      addToast("空き時間を登録してください", "error");
      return;
    }
    if (userForm.games.length === 0) {
      setStatusMessage("タイトルを1つ以上選択してください。");
      addToast("タイトルを選択してください", "error");
      return;
    }

    setLoading(true);
    try {
      await api.createRoom({
        building: "学内",
        name: userForm.customLocation,
        capacity: 4,
        availableSlots: userForm.availability
      });

      // ニックネーム、場所、そして一言コメント（ある場合）をパース可能な形で一つの文字列に結合して送信
      const commentString = userForm.comment.trim() ? ` //💬:${userForm.comment.trim()}` : "";
      await api.registerUser({
        role: userForm.role,
        nickname: `${userForm.nickname} (@${userForm.customLocation})${commentString}`,
        games: userForm.games,
        availability: userForm.availability
      });

      setStatusMessage(`「${userForm.nickname}」の募集を掲示板に公開しました。`);
      addToast("新規募集の投稿が完了しました！", "success");
      
      setUserForm({ role: "student", nickname: "", games: [], availability: [], customLocation: "", comment: "" });
      await refreshAll();
    } catch (err: any) {
      setStatusMessage(`募集公開エラー: ${err.message}`);
      addToast("投稿に失敗しました", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinLobbyUser = async (hostUser: any, chosenGame: string, slot: AvailabilitySlot) => {
    setLoading(true);
    try {
      await api.confirmMatch({
        studentId: hostUser.id,
        professorId: "direct-join-user",
        roomId: "custom-room",
        matchedGame: chosenGame,
        slot: slot,
      });
      setActiveEvent({
        room: { building: "指定場所", name: hostUser.nickname.split("@")[1]?.split(" //")[0] || "学内教室" },
        slot: slot,
        matchedGame: chosenGame,
      });
      setMatchedPeople([hostUser.nickname.split(" ")[0], "あなた"]);
      setView("event");
      setStatusMessage("マッチングが成立しました！");
      addToast("マッチングが成立しました！対戦画面へ移行します", "success");
    } catch (err: any) {
      setStatusMessage(`参加エラー: ${err.message}`);
      addToast("マッチング成立に失敗しました", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSuggestions = async () => {
    setLoading(true);
    setStatusMessage("マッチング候補を自動探索中...");
    try {
      const res = await api.getSuggestions();
      setSuggestions(res || []);
      if (!res || res.length === 0) {
        setStatusMessage("条件が完全一致する自動候補はありませんでした。");
        addToast("完全一致する自動候補はありませんでした", "info");
      } else {
        addToast(`${res.length}件のマッチング候補を検出しました`, "success");
      }
    } catch (err: any) {
      setStatusMessage(`探索エラー: ${err.message}`);
      addToast("自動探索中にエラーが発生しました", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDirectConfirm = async (sug: MatchSuggestion, game: string) => {
    setLoading(true);
    try {
      await api.confirmMatch({
        studentId: sug.student.id,
        professorId: sug.professor.id,
        roomId: sug.room.id,
        matchedGame: game,
        slot: sug.slot,
      });
      setStatusMessage("マッチングが成立しました。");
      addToast("アルゴリズムマッチングが確定しました！", "success");
      setSuggestions([]);
      await refreshAll();
    } catch (err: any) {
      setStatusMessage(`確定エラー: ${err.message}`);
      addToast("確定処理に失敗しました", "error");
    } finally {
      setLoading(false);
    }
  };

  const visibleUsers = useMemo(() => {
    return users.filter((u) => !deletedIds.includes(u.id));
  }, [users, deletedIds]);

  if (view === "event") {
    return (
      <div className="app">
        {/* トースト通知コンポーネント（固定配置） */}
        <div style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: "10px"
        }}>
          {toasts.map((t) => (
            <div key={t.id} style={{
              background: t.type === "success" ? "#00ff66" : t.type === "error" ? "#ff0055" : "#00ccff",
              color: "#000",
              padding: "12px 24px",
              borderRadius: "4px",
              fontWeight: "bold",
              boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
              minWidth: "240px",
              animation: "fadeIn 0.3s ease-out"
            }}>
              {t.message}
            </div>
          ))}
        </div>

        <header>
          <h1>FIGHT CLUB</h1>
          <p className="subtitle">MATCH SETTLED</p>
        </header>
        <section style={{ borderColor: "#ff007f" }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <h2 style={{ color: "#ff007f", border: "none", padding: 0, fontSize: "2.5rem" }}>MATCH CONFIRMED</h2>
          </div>
          <div className="event-grid">
            <div className="event-card">
              <h3>LOCATION</h3>
              <p className="highlight">{activeEvent?.room?.name || "指定教室"}</p>
            </div>
            <div className="event-card">
              <h3>TIME</h3>
              <p className="highlight" style={{ color: "#ffffff" }}>
                {activeEvent?.slot ? `${DAYS_OF_WEEK.find(d => d.value === activeEvent.slot.day)?.label || activeEvent.slot.day} ${activeEvent.slot.start}` : "SLOT"}
              </p>
            </div>
          </div>
        
          <div className="event-card" style={{ marginTop: "16px" }}>
            <h3>SELECTED TITLE</h3>
            <p className="highlight" style={{ color: "#ff007f" }}>{activeEvent?.matchedGame || "GAME"}</p>
          </div>
          <div className="event-card" style={{ marginTop: "16px" }}>
            <h3>PLAYERS</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "8px" }}>
              {matchedPeople.map((p) => <span key={p} className="badge">{p}</span>)}
            </div>
          </div>
 
          <div style={{ textAlign: "center", marginTop: "32px" }}>
            <button onClick={() => { setView("dashboard"); refreshAll(); }}>掲示板に戻る</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="app">
      {/* トースト通知コンポーネント（固定配置、CSSアニメーション用のfadeInをインライン風に設定） */}
      <div style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "10px"
      }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            background: t.type === "success" ? "#ff007f" : t.type === "error" ? "#ff3333" : "#ffffff",
            color: t.type === "info" ? "#000000" : "#ffffff",
            padding: "14px 24px",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "2px",
            fontWeight: "bold",
            fontSize: "14px",
            letterSpacing: "1px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.7)",
            minWidth: "260px",
            boxSizing: "border-box",
            transition: "all 0.3s ease"
          }}>
            <span style={{ marginRight: "8px" }}>{t.type === "success" ? "✓" : t.type === "error" ? "✗" : "ℹ"}</span>
            {t.message}
          </div>
        ))}
      </div>

      <header>
        <h1>F I G H T・C L U B</h1>
        <p className="subtitle">P2P CLASSROOM MATCHING SYSTEM</p>
      </header>

      {statusMessage && <div className="status-banner">{statusMessage}</div>}

      <section>
        <h2>対戦・マッチの新規募集をかける</h2>
        <form onSubmit={onUserSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <label style={{ margin: 0 }}>
              区分
              <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value as "student" | "professor" })}>
                <option value="student">生徒 (STUDENT)</option>
                <option value="professor">教授 (PROFESSOR)</option>
              </select>
            </label>
            <label style={{ margin: 0 }}>
              ニックネーム
              <input type="text" placeholder="匿名" value={userForm.nickname} onChange={(e) => setUserForm({ ...userForm, nickname: e.target.value })} required />
            </label>
            <label style={{ margin: 0 }}>
              開催場所の指定
              <input type="text" placeholder="例: 7A201教室, ラウンジ" value={userForm.customLocation} onChange={(e) => setUserForm({ ...userForm, customLocation: e.target.value })} required />
            </label>
          </div>

          {/* 新規追加：一言コメントのテキストボックス */}
          <div style={{ marginBottom: "24px" }}>
            <label style={{ marginBottom: "6px" }}>一言コメント（掲示板に掲載されます / 任意）</label>
            <input 
              type="text" 
              placeholder="例: 初心者歓迎です！気軽にどうぞ！、ジョイコン持参します" 
              value={userForm.comment} 
              onChange={(e) => setUserForm({ ...userForm, comment: e.target.value })} 
              maxLength={60}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{ marginBottom: "8px" }}>空き時間の選択（登録必須）</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <button type="button" className="btn-select-trigger" onClick={() => setActiveModal("standard")}>
                【空き時間選択】 曜日・時限リストから選ぶ
              </button>
              <button type="button" className="btn-select-trigger custom-btn" onClick={() => setActiveModal("custom")}>
                【カスタム】 例外的な時間を自由入力する
              </button>
            </div>

            <div style={{ marginTop: "12px", background: "#0a0a0a", border: "1px solid #222", padding: "14px" }}>
              <span className="tag-category-title" style={{ color: "#ff007f" }}>現在設定中の空き時間リスト (クリックで取り消し):</span>
              {userForm.availability.length === 0 ? (
                <div style={{ fontSize: "12px", color: "#555", marginTop: "4px" }}>時間を設定してください。上のボタンから追加できます。</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
                  {userForm.availability.map((av, index) => {
                    const dayLabel = DAYS_OF_WEEK.find(d => d.value === av.day)?.label || av.day;
                    const timeLabel = av.end === "CUSTOM" ? av.start : `${av.start}-${av.end}`;
                    return (
                      <button
                        key={index}
                        type="button"
                        className="selected-time-badge"
                        onClick={() => handleRemoveSelectedSlot(index)}
                        title="クリックして削除"
                      >
                        {dayLabel} : {timeLabel} <span style={{ color: "#ff007f", marginLeft: "4px" }}>×</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{ marginBottom: "8px" }}>プレイしたいタイトル</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {HOBBY_TAG_GROUPS.map((group) => (
                <div key={group.category} className="tag-group-box">
                  <span className="tag-category-title">{group.category}</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {group.tags.map((tag) => {
                      const isSelected = userForm.games.includes(tag);
                      return (
                        <button key={tag} type="button" onClick={() => handleToggleTag(tag)} className={`tag-chip ${isSelected ? "active" : ""}`}>
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
              <input type="text" placeholder="その他のタイトル..." value={otherTagInput} onChange={(e) => setOtherTagInput(e.target.value)} style={{ flex: 1 }} />
              <button type="button" onClick={handleAddCustomTag} className="btn-secondary" style={{ padding: "0 20px" }}>追加</button>
            </div>
          </div>

          <button type="submit" disabled={loading} style={{ width: "100%" }}>募集を公開掲示板に投稿する</button>
        </form>
      </section>

      {activeModal === "standard" && (
        <div className="modal-overlay">
          <div className="modal-mini-window">
            <div className="modal-header">
              <h2>空き時間選択</h2>
              <button className="btn-close-modal" onClick={() => setActiveModal("none")}>×</button>
            </div>
            <div className="modal-body">
              <p className="tab-desc">曜日と時限を選択し、追加ボタンを押して確定してください。</p>
              
              <div style={{ marginBottom: "16px" }}>
                <label>曜日</label>
                <select value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)}>
                  {DAYS_OF_WEEK.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label>時限・時間帯</label>
                <select value={selectedSlotIndex} onChange={(e) => setSelectedSlotIndex(Number(e.target.value))}>
                  {TIME_SLOT_OPTIONS.map((slot, idx) => (
                    <option key={slot.id} value={idx}>{slot.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <button type="button" onClick={handleAddStandardTime} style={{ flex: 1 }}>この時間帯を追加</button>
                <button type="button" className="btn-secondary" onClick={() => setActiveModal("none")} style={{ flex: 1 }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeModal === "custom" && (
        <div className="modal-overlay">
          <div className="modal-mini-window">
            <div className="modal-header">
              <h2>カスタム時間割登録</h2>
              <button className="btn-close-modal" onClick={() => setActiveModal("none")}>×</button>
            </div>
            <div className="modal-body">
              <p className="tab-desc">標準時間割に当てはまらない、特殊な時間を自由に入力して追加できます。</p>

              <div style={{ marginBottom: "16px" }}>
                <label>曜日</label>
                <select value={customDay} onChange={(e) => setCustomDay(e.target.value)}>
                  {DAYS_OF_WEEK.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label>時間帯の直接指定</label>
                <input 
                  type="text" 
                  placeholder="例: 12:00-12:50 (昼休み), 19:00以降" 
                  value={customTimeText} 
                  onChange={(e) => setCustomTimeText(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <button type="button" onClick={handleAddCustomTime} style={{ flex: 1 }}>カスタム時間を追加</button>
                <button type="button" className="btn-secondary" onClick={() => setActiveModal("none")} style={{ flex: 1 }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 公開募集掲示板（ロビー一覧） */}
      <section style={{ border: "2px solid #ff007f" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ margin: 0, border: "none", padding: 0 }}>LOBBY BOARD（公開募集一覧）</h2>
          </div>
          <button className="btn-secondary" style={{ fontSize: "12px", padding: "8px 14px" }} onClick={handleSearchSuggestions}>マッチング自動検出</button>
        </div>

        {visibleUsers.length === 0 ? (
          <div className="empty-state">現在募集中のロビーはありません。最初の募集を投稿しよう。</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
            {visibleUsers.map((u) => {
              // 文字列から「場所」と「一言コメント」を綺麗に分離抽出するパース処理
              const rawNickname = u.nickname || "";
              const locationPart = rawNickname.split("@")[1] || "学内";
              const displayLocation = locationPart.split(" //")[0];
              const cleanName = rawNickname.split(" ")[0];
              
              // コメント部分を抽出
              let displayComment = "";
              if (rawNickname.includes("//💬:")) {
                displayComment = rawNickname.split("//💬:")[1];
              }
        
              return (
                <div key={u.id} className="suggestion-card" style={{ borderColor: "#333", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <span className="pink-tag" style={{ marginRight: "6px" }}>{u.role ? u.role.toUpperCase() : "STUDENT"}</span>
                        <span className="white-tag">{displayLocation}</span>
                      </div>
                      <button className="btn-delete-small" onClick={() => handleDeleteUser(u.id)}>削除</button>
                    </div>

                    <div style={{ margin: "14px 0 4px 0", fontSize: "16px", fontWeight: "bold" }}>
                      ホスト: {cleanName}
                    </div>

                    {/* 一言コメントが投稿されている場合のみカード内に綺麗に表示する */}
                    {displayComment && (
                      <div style={{
                        background: "#111",
                        borderLeft: "2px solid #ff007f",
                        padding: "6px 10px",
                        fontSize: "13px",
                        color: "#ddd",
                        margin: "8px 0 12px 0",
                        fontStyle: "italic",
                        wordBreak: "break-all"
                      }}>
                        💬 {displayComment}
                      </div>
                    )}

                    <div style={{ fontSize: "12px", color: "#888", marginBottom: "12px", marginTop: "10px" }}>
                      <div>希望空き時間一覧:</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                        {u.availability?.map((av: any, i: number) => {
                          const showTxt = av.end === "CUSTOM" ? av.start : `${av.start}-${av.end}`;
                          return (
                            <span key={i} style={{ background: "#111", padding: "2px 6px", border: "1px solid #222", color: "#fff" }}>
                              {DAYS_OF_WEEK.find(d => d.value === av.day)?.label.slice(0,2) || av.day} {showTxt}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="action-zone" style={{ marginTop: "auto" }}>
                    <div className="action-title">参戦するゲームタイトルを選択:</div>
                    <div className="direct-btn-group">
                      {u.games?.map((game: string) => (
                        <button
                          key={game}
                          className="btn-direct-confirm"
                          onClick={() => handleJoinLobbyUser(u, game, u.availability[0] || { day: "Mon", start: "12:15", end: "13:30" })}
                        >
                          {game} で対戦に参加
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {suggestions.length > 0 && (
          <div style={{ marginTop: "32px", borderTop: "2px dashed #ff007f", paddingTop: "24px" }}>
            <h3>アルゴリズム自動マッチング提案</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px", marginTop: "12px" }}>
              {suggestions.map((sug, index) => (
                <div key={index} className="suggestion-card">
                  <div className="card-header-info">
                    <span className="pink-tag">{DAYS_OF_WEEK.find(d => d.value === sug.slot.day)?.label || sug.slot.day}</span>
                    <span className="white-tag">{sug.room?.name}</span>
                  </div>
                  <div className="pair-info">
                    <div><span className="label">STUDENT:</span> {sug.student?.nickname?.split(" ")[0]}</div>
                    <div><span className="label">PROFESSOR:</span> {sug.professor?.nickname?.split(" ")[0]}</div>
                  </div>
                  <div className="action-zone">
                    <div className="direct-btn-group">
                      {sug.sharedGames?.map(game => (
                        <button key={game} className="btn-direct-confirm" onClick={() => handleDirectConfirm(sug, game)}>
                          {game} で自動マッチ確定
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 履歴・ログ表示 */}
      <div style={{ textAlign: "center", marginTop: "40px" }}>
        <button type="button" className="btn-secondary" style={{ fontSize: "12px", padding: "6px 16px" }} onClick={() => setShowDebug(!showDebug)}>
          {showDebug ? "対戦履歴を非表示" : "対戦成立履歴・ログを表示"}
        </button>
      </div>

      {showDebug && (
        <section style={{ marginTop: "16px", borderColor: "#222" }}>
          <h2>MATCH HISTORY & DATABASE LOG</h2>
          <div style={{ marginBottom: "20px" }}>
            <h3>成立した対戦マッチ一覧</h3>
            {matches.length === 0 ? <p className="muted">履歴はありません</p> : (
              <div className="table-responsive">
                <table className="grid-table" style={{ background: "transparent" }}>
                  <thead>
                    <tr>
                      <th>ホスト</th>
                      <th>参戦プレイヤー</th>
                      <th>場所</th>
                      <th>対戦種目</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((m: any) => (
                      <tr key={m.id}>
                        <td>{m.student?.nickname?.split(" ")[0] || m.studentId}</td>
                        <td>{m.professor?.nickname?.split(" ")[0] || m.professorId}</td>
                        <td>{m.room?.name || "確定場所"}</td>
                        <td style={{ color: "#ff007f" }}>{m.matchedGame}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default App;