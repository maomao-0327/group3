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

type Toast = {
  id: number;
  message: string;
  type: "success" | "error" | "info";
};

// チャットメッセージの型定義
type ChatMessage = {
  id: number;
  sender: string;
  text: string;
  time: string;
};

function App() {
  const [users, setUsers] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  
  // フラットな全般レコメンド用の提案ステート
  const [customSuggestions, setCustomSuggestions] = useState<any[]>([]);

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

  // 簡易チャット用のステート
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

  // メインフォーム（区分を排除、snsContact項目とcomment項目を追加）
  const [userForm, setUserForm] = useState({
    nickname: "",
    games: [] as string[],
    availability: [] as AvailabilitySlot[],
    customLocation: "",
    comment: "",
    snsContact: "", 
  });

  // ニックネーム・場所のプリセット自動保存
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
      addToast(`同期失敗: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  // 1. 区分に関わらない「同じゲーム」「同じ空き時間」のフラットレコメンドアルゴリズム
  const handleSearchSuggestions = () => {
    setLoading(true);
    setStatusMessage("マッチング候補を全般探索中...");

    const activeUsers = users.filter(u => !deletedIds.includes(u.id));
    const pairs: any[] = [];

    // 総当たりで条件が重なるペア（ユーザー同士）を抽出
    for (let i = 0; i < activeUsers.length; i++) {
      for (let j = i + 1; j < activeUsers.length; j++) {
        const u1 = activeUsers[i];
        const u2 = activeUsers[j];

        // 共通のゲームを抽出
        const sharedGames = u1.games?.filter((g: string) => u2.games?.includes(g)) || [];
        if (sharedGames.length === 0) continue;

        // 共通の空き時間を抽出
        const sharedSlots = u1.availability?.filter((slot1: any) => 
          u2.availability?.some((slot2: any) => 
            slot1.day === slot2.day && slot1.start === slot2.start
          )
        ) || [];

        if (sharedSlots.length === 0) continue;

        // ペア候補としてスタック
        sharedSlots.forEach((slot: any) => {
          pairs.push({
            id: `${u1.id}-${u2.id}-${slot.day}-${slot.start}`,
            userA: u1,
            userB: u2,
            slot: slot,
            sharedGames: sharedGames
          });
        });
      }
    }

    setCustomSuggestions(pairs);

    if (pairs.length === 0) {
      setStatusMessage("条件が完全一致する自動候補はありませんでした。");
      addToast("一致する自動候補はありませんでした", "info");
    } else {
      setStatusMessage(`共通の条件を持つ候補が ${pairs.length} 件検出されました。`);
      addToast(`${pairs.length}件のレコメンドを検出しました`, "success");
    }
    setLoading(false);
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
      s => s.day === newSlot.day && s.start === newSlot.start && s.end === newSlot.end
    );

    if (!exists) {
      setUserForm({
        ...userForm,
        availability: [...userForm.availability, newSlot]
      });
      addToast("空き時間をリストに追加しました", "info");
    } else {
      addToast("その枠は既に登録されています", "error");
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
      setUserForm({
        ...userForm,
        availability: [...userForm.availability, newSlot]
      });
      setCustomTimeText("");
      addToast("カスタム時間を追加しました", "info");
    } else {
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
    const nextDeletedIds = [...deletedIds, id];
    setDeletedIds(nextDeletedIds);
    localStorage.setItem("fight_club_deleted_ids", JSON.stringify(nextDeletedIds));

    try {
      if (api && typeof api.deleteRoom === "function") {
        await api.deleteRoom(id);
      }
    } catch (err) {
      console.warn("ローカルプロキシ削除完了");
    }

    addToast("募集エントリーを取り消しました", "success");
    setLoading(false);
  };

  const onUserSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userForm.nickname.trim() || !userForm.customLocation.trim()) {
      addToast("必須項目を入力してください", "error");
      return;
    }
    if (userForm.availability.length === 0 || userForm.games.length === 0) {
      addToast("時間帯とタイトルを登録してください", "error");
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

      // 隠しメタデータ（一言、SNS連絡先）をパース用トークンでカプセル化して送信
      const commentStr = userForm.comment.trim() ? ` [COMM:${userForm.comment.trim()}]` : "";
      const snsStr = userForm.snsContact.trim() ? ` [SNS:${userForm.snsContact.trim()}]` : "";
      
      await api.registerUser({
        role: "student", // 内部型補完用（実質撤廃）
        nickname: `${userForm.nickname} (@${userForm.customLocation})${commentStr}${snsStr}`,
        games: userForm.games,
        availability: userForm.availability
      });

      addToast("新規募集の投稿が完了しました", "success");
      setUserForm({ 
        nickname: userForm.nickname, 
        customLocation: userForm.customLocation, 
        games: [], 
        availability: [], 
        comment: "",
        snsContact: ""
      });
      await refreshAll();
    } catch (err: any) {
      addToast("投稿に失敗しました", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinLobbyUser = (hostUser: any, chosenGame: string, slot: AvailabilitySlot) => {
    // 相手のニックネームからSNS情報を抽出
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
      mySns: "（あなたが開示中）"
    });

    // 簡易チャットを初期化
    setChatMessages([
      { id: 1, sender: "SYSTEM", text: "マッチングが成立しました。合流に向けて伝言板を活用してください。", time: "SYSTEM" }
    ]);

    setMatchedPeople([hostUser.nickname.split(" ")[0], "あなた"]);
    setView("event");
    addToast("マッチングが成立しました", "success");
  };

  // 簡易チャット送信処理
  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const newMsg: ChatMessage = {
      id: Date.now(),
      sender: "あなた",
      text: chatInput.trim(),
      time: timeStr
    };

    setChatMessages(prev => [...prev, newMsg]);
    setChatInput("");
    addToast("メッセージを送信しました", "success");
  };

  // 2. 「今から・次の休みに遊べる」判定を含んだ動的フィルタリング
  const filteredAndVisibleUsers = useMemo(() => {
    // 現在の曜日と時間を取得（曜日はAPI仕様のMon-Friにマップ）
    const now = new Date();
    const daysMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const currentDayValue = daysMap[now.getDay()]; 
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    return users
      .filter((u) => !deletedIds.includes(u.id))
      .filter((u) => {
        // ① タイトル検索
        if (filterGameSearch.trim() !== "") {
          const searchLower = filterGameSearch.toLowerCase().trim();
          if (!u.games?.some((g: string) => g.toLowerCase().includes(searchLower))) return false;
        }
        // ② 曜日フィルタ
        if (filterDay !== "ALL" && !filterImmediateOnly) {
          if (!u.availability?.some((av: any) => av.day === filterDay)) return false;
        }
        // ③ 「今すぐ遊べる」クイック判定マクロ
        if (filterImmediateOnly) {
          return u.availability?.some((av: any) => {
            if (av.day !== currentDayValue) return false;
            if (av.end === "CUSTOM") return true; // カスタムは許容

            // 各時限の開始・終了時刻をパースして、現在時刻が「該当枠の前後15分以内」か「時間内」かを判定
            const [sh, sm] = av.start.split(":").map(Number);
            const [eh, em] = av.end.split(":").map(Number);
            const startTotal = sh * 60 + sm;
            const endTotal = eh * 60 + em;

            // 次の休み時間・今すぐ遊べる枠（開始30分前から終了までの猶予）
            return (currentMinutes >= startTotal - 30 && currentMinutes <= endTotal);
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
        
          <div className="event-grid" style={{ marginTop: "16px" }}>
            <div className="event-card">
              <h3>SELECTED TITLE</h3>
              <p className="highlight" style={{ color: "#ff007f" }}>{activeEvent?.matchedGame || "GAME"}</p>
            </div>
            {/* 3. マッチ成立画面にのみ開示される連絡先アカウント */}
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

          {/* 3. マッチング画面内・簡易チャット伝言板機能 */}
          <div style={{ marginTop: "24px", background: "#050505", border: "1px solid #222", padding: "16px" }}>
            <h3 style={{ fontSize: "14px", color: "#fff", letterSpacing: "1px", marginBottom: "12px", borderBottom: "1px solid #222", paddingBottom: "6px" }}>
              LOBBY CHAT BOARD (簡易伝言板)
            </h3>
            <div style={{ height: "180px", overflowY: "auto", background: "#000", border: "1px solid #111", padding: "10px", marginBottom: "12px" }}>
              {chatMessages.map(msg => (
                <div key={msg.id} style={{ marginBottom: "8px", fontSize: "13px", lineHeigh: "1.4" }}>
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
      {/* トースト通知領域 */}
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
            letterSpacing: "1px",
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
          <h2>対戦・マッチの新規募集をかける</h2>
        </div>
        <form onSubmit={onUserSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <label style={{ margin: 0 }}>
              ニックネーム
              <input type="text" placeholder="匿名ユーザー" value={userForm.nickname} onChange={(e) => setUserForm({ ...userForm, nickname: e.target.value })} required />
            </label>
            <label style={{ margin: 0 }}>
              開催場所の指定
              <input type="text" placeholder="例: 7A201教室、ラウンジ奥" value={userForm.customLocation} onChange={(e) => setUserForm({ ...userForm, customLocation: e.target.value })} required />
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
            {/* 3. 連絡用SNS入力フィールドの追加 */}
            <div>
              <label style={{ marginBottom: "6px" }}>連絡用SNSアカウント (任意 / マッチ成立時のみ相手に開示)</label>
              <input 
                type="text" 
                placeholder="例: Discord ID、Xユーザー名など" 
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

      {/* 公開募集掲示板（ロビー一覧） */}
      <section style={{ border: "2px solid #ff007f" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ margin: 0, border: "none", padding: 0 }}>LOBBY BOARD（公開募集一覧）</h2>
          </div>
          {/* 1. 区分に縛られない全般条件マッチのトリガー */}
          <button className="btn-secondary" style={{ fontSize: "12px", padding: "8px 14px" }} onClick={handleSearchSuggestions}>
            全般マッチング自動検出
          </button>
        </div>

        {/* インタラクティブ検索・フィルタコントロールパネル */}
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

          {/* 2. 今から・次の休み時間に遊べるロビーのクイックボタン */}
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
          
          {(filterGameSearch || filterDay !== "ALL" || filterImmediateOnly) && (
            <div style={{ alignSelf: "flex-end" }}>
              <button 
                type="button" 
                className="btn-delete-small" 
                style={{ height: "34px", padding: "0 12px", background: "#222", border: "1px solid #333", color: "#fff" }}
                onClick={() => { setFilterGameSearch(""); setFilterDay("ALL"); setFilterImmediateOnly(false); }}
              >
                クリア ✕
              </button>
            </div>
          )}
        </div>

        {filteredAndVisibleUsers.length === 0 ? (
          <div className="empty-state" style={{ padding: "40px 20px" }}>
            条件に一致するアクティブな募集ロビーはありません。
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
            {filteredAndVisibleUsers.map((u) => {
              const rawNickname = u.nickname || "";
              const locationPart = rawNickname.split("@")[1] || "学内";
              const displayLocation = locationPart.split(" [")[0];
              const cleanName = rawNickname.split(" ")[0];
              
              // 一言コメントのパース
              let displayComment = "";
              if (rawNickname.includes("[COMM:")) {
                displayComment = rawNickname.split("[COMM:")[1].split("]")[0];
              }
        
              return (
                <div key={u.id} className="suggestion-card" style={{ borderColor: "#333", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <span className="white-tag">{displayLocation}</span>
                      </div>
                      <button className="btn-delete-small" onClick={() => handleDeleteUser(u.id)}>削除</button>
                    </div>

                    <div style={{ margin: "14px 0 4px 0", fontSize: "16px", fontWeight: "bold" }}>
                      HOST: {cleanName}
                    </div>

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
                    <div className="action-title">タイトルを選択して参戦:</div>
                    <div className="direct-btn-group">
                      {u.games?.map((game: string) => (
                        <button
                          key={game}
                          className="btn-direct-confirm"
                          onClick={() => handleJoinLobbyUser(u, game, u.availability[0] || { day: "Mon", start: "12:15", end: "13:30" })}
                        >
                          {game}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 1. 刷新されたフラット・レコメンドセクション */}
        {customSuggestions.length > 0 && (
          <div style={{ marginTop: "32px", borderTop: "2px dashed #ff007f", paddingTop: "24px" }}>
            <h3 style={{ fontSize: "16px", color: "#ff007f", letterSpacing: "1px" }}>MATCHING RECOMMENDATION（共通条件ユーザー）</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px", marginTop: "12px" }}>
              {customSuggestions.map((sug) => (
                <div key={sug.id} className="suggestion-card" style={{ borderColor: "#00ffff" }}>
                  <div className="card-header-info">
                    <span className="pink-tag">{DAYS_OF_WEEK.find(d => d.value === sug.slot.day)?.label || sug.slot.day} {sug.slot.start}</span>
                  </div>
                  <div className="pair-info" style={{ margin: "10px 0", fontSize: "14px" }}>
                    <div><span style={{ color: "#ff007f" }}>USER A:</span> {sug.userA?.nickname?.split(" ")[0]}</div>
                    <div><span style={{ color: "#00ffff" }}>USER B:</span> {sug.userB?.nickname?.split(" ")[0]}</div>
                  </div>
                  <div className="action-zone">
                    <div className="action-title">共通のタイトル:</div>
                    <div className="direct-btn-group">
                      {sug.sharedGames?.map((game: string) => (
                        <button 
                          key={game} 
                          className="btn-direct-confirm" 
                          onClick={() => handleJoinLobbyUser(sug.userA, game, sug.slot)}
                        >
                          {game} でマッチを仲介
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
                      <th>プレイヤー</th>
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