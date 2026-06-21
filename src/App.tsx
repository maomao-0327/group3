import { useEffect, useMemo, useState } from "react";
import { api, AvailabilitySlot } from "./api";
// 選択肢となる標準の時限定義（IDがそのまま班員のDBのperiod(1~7)に対応）
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
type Toast = {
  id: number;
  message: string;
  type: "success" | "error" | "info";
};
type ChatMessage = {
  id: number;
  sender: string;
  text: string;
  time: string;
};
function App() {
  const [users, setUsers] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  
  const [view, setView] = useState<"dashboard" | "event">("dashboard");
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [matchedPeople, setMatchedPeople] = useState<string[]>([]);
  const [otherTagInput, setOtherTagInput] = useState<string>("");
  const [activeModal, setActiveModal] = useState<"none" | "standard" | "custom">("none");
  const [selectedDay, setSelectedDay] = useState<string>("Mon");
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number>(0);
  const [customDay, setCustomDay] = useState<string>("Mon");
  const [customTimeText, setCustomTimeText] = useState<string>("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  // 検索・フィルタ用ステート
  const [filterGameSearch, setFilterGameSearch] = useState<string>("");
  const [filterDay, setFilterDay] = useState<string>("ALL");
  const [filterImmediateOnly, setFilterImmediateOnly] = useState<boolean>(false);
  // 簡易チャット用ステート
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>("");
  const [deletedIds, setDeletedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("fight_club_deleted_ids");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  // ★新規追加: 登録タイプ状態 (部屋を立てる host / 既存の部屋に入る guest)
  const [registerType, setRegisterType] = useState<"host" | "guest">("host");
  // メイン募集フォーム
  const [userForm, setUserForm] = useState({
    nickname: "",
    games: [] as string[],
    availability: [] as AvailabilitySlot[],
    customLocation: "",
    comment: "",
    snsContact: "", 
    capacity: "4", 
  });
  // プリセット自動保存
  useEffect(() => {
    const savedNickname = localStorage.getItem("fight_club_preset_nickname") || "";
    const savedLocation = localStorage.getItem("fight_club_preset_location") || "";
    setUserForm(prev => ({
      ...prev,
      nickname: savedNickname,
      customLocation: savedLocation
    }));
  }, []);
  useEffect(() => {
    localStorage.setItem("fight_club_preset_nickname", userForm.nickname);
    localStorage.setItem("fight_club_preset_location", userForm.customLocation);
  }, [userForm.nickname, userForm.customLocation]);
  const addToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
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
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    refreshAll();
  }, []);
  // フロントの選択時間枠を、班員のバックエンド仕様（例："Mon3"）の文字列リストに変換するヘルパー
  const convertSlotsToBackendFormat = (slots: AvailabilitySlot[]): string[] => {
    return slots.map(slot => {
      const matchedOption = TIME_SLOT_OPTIONS.find(opt => opt.start === slot.start);
      const periodNum = matchedOption ? matchedOption.id : "3"; 
      return `${slot.day}${periodNum}`;
    });
  };
  // 班員の自動マッチングエンジン(matching.py)の挙動をシミュレートするトリガー
  const handleTriggerMatchingEngine = () => {
    setLoading(true);
    setStatusMessage("自動マッチング処理を実行しています...");
    // バックエンドのAPIを実行（これで matching.py の execute_matching が走ります）
    api.triggerMatching()
      .then(async () => {
        addToast("マッチング処理が完了しました", "success");
        await refreshAll();
        
        // 自分がマッチしたか確認
        const myNickname = userForm.nickname;
        if (myNickname) {
          // usersから自分を見つけて、自分が matches に入っているかを確認
          const matchedEvent = matches.find((m: any) => 
            m.student?.nickname?.startsWith(myNickname) || 
            m.professor?.nickname?.startsWith(myNickname)
          );
          if (matchedEvent) {
            setActiveEvent({
              room: { name: matchedEvent.room?.name || "確定教室" },
              slot: { day: "Mon", start: "12:15" }, // 仮
              matchedGame: matchedEvent.matchedGame,
              hostSns: "DB照会完了",
            });
            setMatchedPeople([matchedEvent.student?.nickname?.split(" ")[0], matchedEvent.professor?.nickname?.split(" ")[0]]);
            setView("event");
          }
        }
      })
      .catch((err) => {
        addToast("マッチング処理の実行に失敗しました", "error");
      })
      .finally(() => {
        setLoading(false);
      });
  };
  const handleAddStandardTime = () => {
    const targetSlot = TIME_SLOT_OPTIONS[selectedSlotIndex];
    if (!targetSlot) return;
    const newSlot: AvailabilitySlot = {
      day: selectedDay,
      start: targetSlot.start,
      end: targetSlot.end
    };
    const exists = userForm.availability.some(
      s => s.day === newSlot.day && s.start === newSlot.start
    );
    if (!exists) {
      setUserForm({ ...userForm, availability: [...userForm.availability, newSlot] });
      addToast("空き時間をリストに追加しました", "info");
    } else {
      addToast("その枠はすでに登録されています", "error");
    }
    setActiveModal("none");
  };
  const handleAddCustomTime = () => {
    const text = customTimeText.trim();
    if (!text) return;
    const newSlot: AvailabilitySlot = {
      day: customDay,
      start: text,
      end: "CUSTOM"
    };
    const exists = userForm.availability.some(s => s.day === newSlot.day && s.start === newSlot.start);
    if (!exists) {
      setUserForm({ ...userForm, availability: [...userForm.availability, newSlot] });
      setCustomTimeText("");
      addToast("カスタム時間を追加しました", "info");
    }
    setActiveModal("none");
  };
  const handleRemoveSelectedSlot = (index: number) => {
    const nextList = userForm.availability.filter((_, i) => i !== index);
    setUserForm({ ...userForm, availability: nextList });
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
    }
  };
  const handleDeleteUser = async (id: string) => {
    if (!confirm("このエントリー募集を取り消しますか？")) return;
    setLoading(true);
    const nextDeletedIds = [...deletedIds, id];
    setDeletedIds(nextDeletedIds);
    localStorage.setItem("fight_club_deleted_ids", JSON.stringify(nextDeletedIds));
    addToast("募集エントリーを取り消しました", "success");
    setLoading(false);
  };
  // 登録処理
  const onUserSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userForm.nickname.trim()) {
      addToast("ニックネームを入力してください", "error");
      return;
    }
    
    // ★部屋を立てる場合（Host）は開催場所が必須
    if (registerType === "host" && !userForm.customLocation.trim()) {
      addToast("開催場所を入力してください", "error");
      return;
    }
    
    if (userForm.availability.length === 0 || userForm.games.length === 0) {
      addToast("空きコマと希望タイトルを登録してください", "error");
      return;
    }
    setLoading(true);
    try {
      const parsedHobbies = userForm.games;
      const commentStr = userForm.comment.trim() ? ` [COMM:${userForm.comment.trim()}]` : "";
      const snsStr = userForm.snsContact.trim() ? ` [SNS:${userForm.snsContact.trim()}]` : "";
      const capaStr = ` [CAPA:${userForm.capacity}]`;
      
      // ★部屋を立てる場合のみ「(@場所)」の書式をニックネームの末尾に埋め込む
      const locationStr = registerType === "host" ? ` (@${userForm.customLocation.trim()})` : "";
      const compositeNickname = `${userForm.nickname}${locationStr}${commentStr}${snsStr}${capaStr}`;
      await api.registerUser({
        role: registerType === "host" ? "professor" : "student", 
        nickname: compositeNickname,
        games: parsedHobbies, 
        availability: userForm.availability
      });
      addToast(registerType === "host" ? "部屋を立てました！" : "参加希望を登録しました！", "success");
      setStatusMessage(registerType === "host" ? "部屋を作成しました。参加者を待っています..." : "参加登録完了。マッチする部屋を探しています...");
      
      setUserForm({ 
        nickname: userForm.nickname, 
        customLocation: userForm.customLocation, 
        games: [], 
        availability: [], 
        comment: "",
        snsContact: "",
        capacity: "4"
      });
      await refreshAll();
    } catch (err: any) {
      addToast("投稿に失敗しました", "error");
    } finally {
      setLoading(false);
    }
  };
  const handleManualJoinLobbyUser = (hostUser: any, chosenGame: string, slot: AvailabilitySlot) => {
    const rawNickname = hostUser.nickname || "";
    let extractedSns = "未登録";
    if (rawNickname.includes("[SNS:")) {
      extractedSns = rawNickname.split("[SNS:")[1].split("]")[0];
    }
    setActiveEvent({
      room: { name: hostUser.nickname.split("@")[1]?.split(" [")[0] || "学内指定場所" },
      slot: slot,
      matchedGame: chosenGame,
      hostSns: extractedSns,
    });
    setChatMessages([
      { id: 1, sender: "SYSTEM", text: "部屋への合流が成立しました。集合に向けて伝言板を活用してください。", time: "SYSTEM" }
    ]);
    setMatchedPeople([hostUser.nickname.split(" ")[0], "あなた"]);
    setView("event");
    addToast("マッチングが成立しました", "success");
  };
  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setChatMessages(prev => [...prev, {
      id: Date.now(),
      sender: "あなた",
      text: chatInput.trim(),
      time: timeStr
    }]);
    setChatInput("");
  };
  const filteredAndVisibleUsers = useMemo(() => {
    const now = new Date();
    const daysMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const currentDayValue = daysMap[now.getDay()]; 
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return users
      .filter((u) => !deletedIds.includes(u.id))
      .filter((u) => {
        if (filterGameSearch.trim() !== "") {
          const searchLower = filterGameSearch.toLowerCase().trim();
          if (!u.games?.some((g: string) => g.toLowerCase().includes(searchLower))) return false;
        }
        if (filterDay !== "ALL" && !filterImmediateOnly) {
          if (!u.availability?.some((av: any) => av.day === filterDay)) return false;
        }
        if (filterImmediateOnly) {
          return u.availability?.some((av: any) => {
            if (av.day !== currentDayValue) return false;
            if (av.end === "CUSTOM") return true;
            const [sh, sm] = av.start.split(":").map(Number);
            const [eh, em] = av.end.split(":").map(Number);
            return (currentMinutes >= (sh * 60 - 30) && currentMinutes <= (eh * 60));
          });
        }
        return true;
      });
  }, [users, deletedIds, filterGameSearch, filterDay, filterImmediateOnly]);
  if (view === "event") {
    return (
      <div className="app">
        <header>
          <h1>FIGHT CLUB</h1>
          <p className="subtitle">MATCH SETTLED</p>
        </header>
        <section style={{ borderColor: "#ff007f" }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <h2 style={{ color: "#ff007f", border: "none", padding: 0, fontSize: "2rem" }}>MATCH CONFIRMED</h2>
          </div>
          <div className="event-grid">
            <div className="event-card">
              <h3>LOCATION (部屋)</h3>
              <p className="highlight">{activeEvent?.room?.name || "指定教室"}</p>
            </div>
            <div className="event-card">
              <h3>TIME</h3>
              <p className="highlight" style={{ color: "#ffffff" }}>
                {activeEvent?.slot ? `${DAYS_OF_WEEK.find(d => d.value === activeEvent.slot.day)?.label || activeEvent.slot.day} ${activeEvent.slot.start}` : "SLOT"}
              </p>
            </div>
          </div>
        
          <div className="event-grid" style={{ marginTop: "16px" }}>
            <div className="event-card">
              <h3>SELECTED TITLE</h3>
              <p className="highlight" style={{ color: "#ff007f" }}>{activeEvent?.matchedGame || "GAME"}</p>
            </div>
            <div className="event-card" style={{ border: "1px dashed #ff007f" }}>
              <h3>HOST CONTACT ID (SNS)</h3>
              <p className="highlight" style={{ color: "#00ffff", fontSize: "1.2rem" }}>{activeEvent?.hostSns}</p>
            </div>
          </div>
          <div className="event-card" style={{ marginTop: "16px" }}>
            <h3>PLAYERS</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "8px" }}>
              {matchedPeople.map((p) => <span key={p} className="badge">{p}</span>)}
            </div>
          </div>
          <div style={{ marginTop: "24px", background: "#050505", border: "1px solid #222", padding: "16px" }}>
            <h3 style={{ fontSize: "14px", color: "#fff", letterSpacing: "1px", marginBottom: "12px", borderBottom: "1px solid #222", paddingBottom: "6px" }}>
              LOBBY CHAT BOARD (簡易伝言板)
            </h3>
            <div style={{ height: "180px", overflowY: "auto", background: "#000", border: "1px solid #111", padding: "10px", marginBottom: "12px" }}>
              {chatMessages.map(msg => (
                <div key={msg.id} style={{ marginBottom: "8px", fontSize: "13px" }}>
                  <span style={{ color: msg.sender === "あなた" ? "#ff007f" : msg.sender === "SYSTEM" ? "#888" : "#00ffff", fontWeight: "bold", marginRight: "8px" }}>
                    [{msg.sender}]
                  </span>
                  <span style={{ color: "#ccc" }}>{msg.text}</span>
                  <span style={{ float: "right", color: "#444", fontSize: "11px" }}>{msg.time}</span>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendChatMessage} style={{ display: "flex", gap: "8px" }}>
              <input 
                type="text" 
                placeholder="集合場所への到着連絡、目印などを送信..." 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                style={{ flex: 1, background: "#000", border: "1px solid #333", color: "#fff", padding: "8px" }}
              />
              <button type="submit" style={{ width: "auto", padding: "0 24px", fontSize: "13px" }}>送信</button>
            </form>
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
      <div style={{ position: "fixed", top: "20px", right: "20px", zIndex: 9999, display: "flex", flexDirection: "column", gap: "10px" }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            background: t.type === "success" ? "#ff007f" : t.type === "error" ? "#ff3333" : "#ffffff",
            color: t.type === "info" ? "#000000" : "#ffffff",
            padding: "14px 24px",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "2px",
            fontWeight: "bold",
            fontSize: "14px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.7)",
            minWidth: "260px"
          }}>
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <h2>対戦・マッチの新規募集（登録）</h2>
        </div>
        <form onSubmit={onUserSubmit}>
          
          {/* ★新規追加: 登録タイプのセレクト (ホスト vs ゲスト) */}
          <div style={{ background: "#0a0a0a", border: "1px solid #222", padding: "16px", marginBottom: "16px" }}>
            <span style={{ fontSize: "13px", color: "#aaa", display: "block", marginBottom: "8px", fontWeight: "bold" }}>登録タイプを選択</span>
            <div style={{ display: "flex", gap: "24px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", margin: 0 }}>
                <input 
                  type="radio" 
                  name="registerType" 
                  value="host" 
                  checked={registerType === "host"} 
                  onChange={() => setRegisterType("host")} 
                />
                <span style={{ fontWeight: "bold", color: registerType === "host" ? "#ff007f" : "#888" }}>自分で部屋を立てる (ホスト)</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", margin: 0 }}>
                <input 
                  type="radio" 
                  name="registerType" 
                  value="guest" 
                  checked={registerType === "guest"} 
                  onChange={() => setRegisterType("guest")} 
                />
                <span style={{ fontWeight: "bold", color: registerType === "guest" ? "#00ffff" : "#888" }}>既存の部屋を探して入る (ゲスト)</span>
              </label>
            </div>
            <p style={{ margin: "8px 0 0 0", fontSize: "11px", color: "#666" }}>
              {registerType === "host" 
                ? "※場所を登録してロビーを作ります。他のマッチした人があなたの指定場所に合流します。" 
                : "※場所は入力不要です。マッチした時点で、相手（ホスト）が立てた部屋に自動的に割り振られます。"}
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <label style={{ margin: 0 }}>
              ニックネーム
              <input type="text" placeholder="匿名ユーザー" value={userForm.nickname} onChange={(e) => setUserForm({ ...userForm, nickname: e.target.value })} required />
            </label>
            
            {/* ★ホストの場合のみ開催場所入力をアクティブにする */}
            {registerType === "host" ? (
              <label style={{ margin: 0 }}>
                開催場所の指定（教室名など）
                <input type="text" placeholder="例: 7A201教室、ラウンジ奥" value={userForm.customLocation} onChange={(e) => setUserForm({ ...userForm, customLocation: e.target.value })} required />
              </label>
            ) : (
              <label style={{ margin: 0, opacity: 0.5 }}>
                開催場所の指定（ゲスト登録時は不要）
                <input type="text" placeholder="ホストの部屋に合流します" disabled value="" style={{ background: "#111", cursor: "not-allowed", border: "1px solid #222" }} />
              </label>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <label style={{ margin: 0 }}>
              募集総人数（自分含む）
              <select value={userForm.capacity} onChange={(e) => setUserForm({ ...userForm, capacity: e.target.value })} style={{ height: "42px", background: "#000", color: "#fff", border: "1px solid #333", padding: "0 8px" }}>
                <option value="2">2人</option>
                <option value="3">3人</option>
                <option value="4">4人</option>
                <option value="5">5人</option>
              </select>
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
            <div>
              <label style={{ marginBottom: "6px" }}>一言コメント（任意）</label>
              <input 
                type="text" 
                placeholder="例: 初心者歓迎、プロコン持参します" 
                value={userForm.comment} 
                onChange={(e) => setUserForm({ ...userForm, comment: e.target.value })} 
                maxLength={60}
              />
            </div>
            <div>
              <label style={{ marginBottom: "6px" }}>連絡用SNS (任意 / マッチ成立時のみ開示)</label>
              <input 
                type="text" 
                placeholder="例: Discord ID、Xユーザー名" 
                value={userForm.snsContact} 
                onChange={(e) => setUserForm({ ...userForm, snsContact: e.target.value })} 
              />
            </div>
          </div>
          <div style={{ marginBottom: "24px" }}>
            <label style={{ marginBottom: "8px" }}>空き時間の選択（登録必須）</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <button type="button" className="btn-select-trigger" onClick={() => setActiveModal("standard")}>
                曜日・時限リストから選ぶ
              </button>
              <button type="button" className="btn-select-trigger custom-btn" onClick={() => setActiveModal("custom")}>
                例外的な時間を自由入力する
              </button>
            </div>
            <div style={{ marginTop: "12px", background: "#0a0a0a", border: "1px solid #222", padding: "14px" }}>
              <span className="tag-category-title" style={{ color: "#ff007f" }}>現在設定中の空き時間リスト (クリックで取り消し):</span>
              {userForm.availability.length === 0 ? (
                <div style={{ fontSize: "12px", color: "#555", marginTop: "4px" }}>時間を設定してください。</div>
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
                        title="取り消す"
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
          <button type="submit" disabled={loading} style={{ width: "100%" }}>公開掲示板に登録を投稿する</button>
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
              <div style={{ marginBottom: "16px" }}>
                <label>曜日</label>
                <select value={customDay} onChange={(e) => setCustomDay(e.target.value)}>
                  {DAYS_OF_WEEK.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: "24px" }}>
                <label>時間帯の直接指定</label>
                <input type="text" placeholder="例: 12:00-12:50" value={customTimeText} onChange={(e) => setCustomTimeText(e.target.value)} required />
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <button type="button" onClick={handleAddCustomTime} style={{ flex: 1 }}>カスタム時間を追加</button>
                <button type="button" className="btn-secondary" onClick={() => setActiveModal("none")} style={{ flex: 1 }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 公開募集掲示板 */}
      <section style={{ border: "2px solid #ff007f" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ margin: 0, border: "none", padding: 0 }}>LOBBY BOARD（公開募集ロビー一覧）</h2>
          </div>
          {/* 自動マッチング判定トリガー */}
          <button className="btn-secondary" style={{ fontSize: "12px", padding: "8px 14px", background: "#ff007f", color: "#fff" }} onClick={handleTriggerMatchingEngine}>
            マッチング処理（部屋への割り当て）を実行
          </button>
        </div>
        <div style={{ background: "#0d0d0d", border: "1px solid #222", padding: "16px", marginBottom: "20px", display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: 2, minWidth: "180px" }}>
            <span style={{ fontSize: "11px", color: "#aaa", display: "block", marginBottom: "4px", fontWeight: "bold" }}>ゲームタイトルで絞り込み</span>
            <input 
              type="text" 
              placeholder="タイトルを入力 (空欄で全表示)" 
              value={filterGameSearch} 
              onChange={(e) => setFilterGameSearch(e.target.value)} 
              style={{ margin: 0, padding: "8px 12px", fontSize: "13px" }}
            />
          </div>
          <div style={{ flex: 3, minWidth: "260px" }}>
            <span style={{ fontSize: "11px", color: "#aaa", display: "block", marginBottom: "4px", fontWeight: "bold" }}>
              {filterImmediateOnly ? "今すぐマッチ・マクロが有効です" : "希望曜日でしぼり込み"}
            </span>
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              <button 
                type="button" 
                onClick={() => { setFilterDay("ALL"); setFilterImmediateOnly(false); }}
                className={`tag-chip ${(!filterImmediateOnly && filterDay === "ALL") ? "active" : ""}`}
                style={{ padding: "6px 10px", fontSize: "12px" }}
              >
                全て表示
              </button>
              {DAYS_OF_WEEK.map((d) => (
                <button 
                  key={d.value}
                  type="button" 
                  disabled={filterImmediateOnly}
                  onClick={() => setFilterDay(d.value)}
                  className={`tag-chip ${(!filterImmediateOnly && filterDay === d.value) ? "active" : ""}`}
                  style={{ padding: "6px 10px", fontSize: "12px", opacity: filterImmediateOnly ? 0.3 : 1 }}
                >
                  {d.label.slice(0, 2)}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: "160px" }}>
            <span style={{ fontSize: "11px", color: "#aaa", display: "block", marginBottom: "4px", fontWeight: "bold" }}>タイム枠ブースト</span>
            <button
              type="button"
              onClick={() => {
                setFilterImmediateOnly(!filterImmediateOnly);
                setFilterDay("ALL");
              }}
              className={`btn-select-trigger ${filterImmediateOnly ? "active" : ""}`}
              style={{
                margin: 0,
                padding: "8px 12px",
                fontSize: "12px",
                background: filterImmediateOnly ? "#ff007f" : "#000",
                color: "#fff",
                border: filterImmediateOnly ? "1px solid #ff007f" : "1px solid #333",
                textAlign: "center"
              }}
            >
              {filterImmediateOnly ? "ON: 今すぐ遊べる枠" : "OFF: 今すぐ遊べる枠"}
            </button>
          </div>
        </div>
        {filteredAndVisibleUsers.length === 0 ? (
          <div className="empty-state" style={{ padding: "40px 20px" }}>
            待機中のエントリー募集はありません。
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
            {filteredAndVisibleUsers.map((u) => {
              const rawNickname = u.nickname || "";
              
              // ニックネームに (@場所) が含まれているかどうかでホストかゲストかを判断
              const isHost = rawNickname.includes("(@");
              const locationPart = isHost ? (rawNickname.split("(@")[1] || "学内") : "マッチ部屋へ自動割り当て";
              const displayLocation = locationPart.split(")")[0];
              const cleanName = rawNickname.split(" ")[0];
              let displayComment = "";
              if (rawNickname.includes("[COMM:")) {
                displayComment = rawNickname.split("[COMM:")[1].split("]")[0];
              }
              let targetCapa = 4;
              if (rawNickname.includes("[CAPA:")) {
                targetCapa = parseInt(rawNickname.split("[CAPA:")[1].split("]")[0]) || 4;
              }
              return (
                <div key={u.id} className="suggestion-card" style={{ borderColor: isHost ? "#ff007f" : "#333", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        {isHost ? (
                          <span className="white-tag" style={{ background: "#ff007f", color: "#fff", border: "none" }}>ROOM CREATOR (@{displayLocation})</span>
                        ) : (
                          <span className="white-tag" style={{ background: "#00ffff", color: "#000", border: "none" }}>JOINER (部屋探し中)</span>
                        )}
                        <span className="white-tag" style={{ background: "#222", color: "#aaa", marginLeft: "6px", border: "none" }}>
                          {targetCapa}人募集
                        </span>
                      </div>
                      <button className="btn-delete-small" onClick={() => handleDeleteUser(u.id)}>削除</button>
                    </div>
                    <div style={{ margin: "14px 0 4px 0", fontSize: "16px", fontWeight: "bold" }}>
                      USER: {cleanName}
                    </div>
                    {displayComment && (
                      <div style={{
                        background: "#111",
                        borderLeft: isHost ? "2px solid #ff007f" : "2px solid #00ffff",
                        padding: "6px 10px",
                        fontSize: "13px",
                        color: "#ddd",
                        margin: "8px 0 12px 0",
                        fontStyle: "italic",
                        wordBreak: "break-all"
                      }}>
                        {displayComment}
                      </div>
                    )}
                    <div style={{ fontSize: "12px", color: "#888", marginBottom: "12px", marginTop: "10px" }}>
                      <div>希望スケジュール:</div>
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
                    <div className="direct-btn-group">
                      {u.games?.map((game: string) => (
                        <button
                          key={game}
                          className="btn-direct-confirm"
                          disabled={!isHost} // ホストの部屋に対してのみ直接入れる
                          style={{
                            background: isHost ? "#ff007f" : "#222",
                            cursor: isHost ? "pointer" : "not-allowed",
                            opacity: isHost ? 1 : 0.4
                          }}
                          onClick={() => handleManualJoinLobbyUser(u, game, u.availability[0] || { day: "Mon", start: "12:15", end: "13:30" })}
                        >
                          {isHost ? `${game} 部屋に入る` : `${game} (探し中)`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
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
                      <th>部屋を立てた人 (ホスト)</th>
                      <th>部屋に参加した人</th>
                      <th>場所 (部屋名)</th>
                      <th>種目</th>
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
