import React, { useEffect, useMemo, useState } from "react";
import { api, AvailabilitySlot, User, Match, ChatMessage } from "./api";

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
  type: "success" | "error" | "info" | "neon-match";
};

function App() {
  const getCapacity = (event: any): number => {
    if (!event || event.capacity === undefined || event.capacity === null) return 4;
    const val = Number(event.capacity);
    return isNaN(val) ? 4 : val;
  };

  const [users, setUsers] = useState<User[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"dashboard" | "event">("dashboard");
  const [showDebug, setShowDebug] = useState(false);
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showMatchNotification, setShowMatchNotification] = useState(false);
  
  const [filterGameSearch, setFilterGameSearch] = useState("");
  const [filterDay, setFilterDay] = useState("ALL");
  const [filterImmediateOnly, setFilterImmediateOnly] = useState(false);
  const [otherTagInput, setOtherTagInput] = useState("");
  
  const [myUserId, setMyUserId] = useState<string | null>(() => {
    return localStorage.getItem("fight_club_my_user_id") || null;
  });

  const [registerType, setRegisterType] = useState<"host" | "guest">("host");
  
  const [userForm, setUserForm] = useState({
    nickname: "",
    games: [] as string[],
    availability: [] as AvailabilitySlot[],
    customLocation: "7A101",
    comment: "",
    snsContact: "", 
    capacity: "4",
  });

  const [selectedDay, setSelectedDay] = useState("Mon");
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(0);
  const [customDay, setCustomDay] = useState("Mon");
  const [customTimeText, setCustomTimeText] = useState("");
  const [activeModal, setActiveModal] = useState<"none" | "standard" | "custom" | "join_guest">("none");
  
  const [joiningHostInfo, setJoiningHostInfo] = useState<{
    hostUser: User;
    game: string;
    slot: AvailabilitySlot;
  } | null>(null);

  const [guestForm, setGuestForm] = useState({
    nickname: "",
    comment: "",
    snsContact: ""
  });

  // プリセット自動ロード
  useEffect(() => {
    const savedNickname = localStorage.getItem("fight_club_preset_nickname") || "";
    const savedLocation = localStorage.getItem("fight_club_preset_location") || "7A101";
    const savedSns = localStorage.getItem("fight_club_preset_sns") || "";
    setUserForm(prev => ({
      ...prev,
      nickname: savedNickname,
      customLocation: savedLocation,
      snsContact: savedSns
    }));
    setGuestForm(prev => ({
      ...prev,
      nickname: prev.nickname || savedNickname,
      snsContact: savedSns
    }));
  }, []);

  // プリセット自動保存
  useEffect(() => {
    localStorage.setItem("fight_club_preset_nickname", userForm.nickname);
    localStorage.setItem("fight_club_preset_location", userForm.customLocation);
    localStorage.setItem("fight_club_preset_sns", userForm.snsContact || guestForm.snsContact);
  }, [userForm.nickname, userForm.customLocation, userForm.snsContact, guestForm.snsContact]);

  const addToast = (message: string, type: Toast["type"] = "success") => {
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
    const timer = setInterval(refreshAll, 5000);
    return () => clearInterval(timer);
  }, []);

  // マッチング成立監視 & チャットポーリング
  useEffect(() => {
    if (!myUserId) return;
    
    let isMounted = true;
    const checkMyStatus = async () => {
      try {
        const status = await api.checkStatus(myUserId);
        
        if (status.exists === false && isMounted) {
          setMyUserId(null);
          localStorage.removeItem("fight_club_my_user_id");
          setActiveEvent(null);
          setShowMatchNotification(false);
          setStatusMessage("");
          setView("dashboard");
          addToast("セッションが終了したか、部屋が削除されました。", "info");
          return;
        }
        
        if (status.is_matched && isMounted) {
          setActiveEvent({
            id: status.event_id,
            room_name: status.room_name,
            matched_game: status.matched_game,
            day: status.day,
            period: status.period,
            members: status.members,
            capacity: status.capacity
          });
          
          const isFull = (status.members || []).length >= (status.capacity || 4);
          
          setView((prevView) => {
            if (prevView !== "event") {
              if (isFull) {
                setShowMatchNotification((prevNotified) => {
                  if (!prevNotified) {
                    addToast("マッチングが成立しました。", "neon-match");
                    return true;
                  }
                  return prevNotified;
                });
              }
            }
            return prevView;
          });
        } else if (isMounted) {
          setActiveEvent(null);
          setShowMatchNotification(false);
          setStatusMessage("");
          setView((prevView) => {
            if (prevView === "event") {
              addToast("部屋が解散されたか、退出しました。", "info");
              return "dashboard";
            }
            return prevView;
          });
        }
      } catch (e) {
        console.error("ステータス確認エラー:", e);
      }
    };
    checkMyStatus();
    const statusTimer = setInterval(checkMyStatus, 3000);
    return () => {
      isMounted = false;
      clearInterval(statusTimer);
    };
  }, [myUserId]);

  useEffect(() => {
    if (view === "event") {
      document.body.classList.add("event-view-active");
    } else {
      document.body.classList.remove("event-view-active");
    }
  }, [view]);

  // チャットポーリング
  useEffect(() => {
    if (view !== "event" || !activeEvent?.id) return;
    const fetchChat = async () => {
      try {
        const chats = await api.getChat(activeEvent.id);
        setChatMessages(chats);
      } catch (e) {
        console.error("チャット取得エラー:", e);
      }
    };
    fetchChat();
    const chatTimer = setInterval(fetchChat, 2000);
    return () => clearInterval(chatTimer);
  }, [view, activeEvent]);

  const handleTriggerMatchingEngine = () => {
    setLoading(true);
    setStatusMessage("マッチングエンジンを回しています...");
    api.triggerMatching()
      .then(async () => {
        addToast("マッチング処理が完了しました", "success");
        setStatusMessage("マッチング完了。");
        await refreshAll();
      })
      .catch(() => {
        addToast("マッチング処理に失敗しました", "error");
      })
      .finally(() => setLoading(false));
  };

  const handleAddStandardTime = () => {
    const targetSlot = TIME_SLOT_OPTIONS[selectedSlotIndex];
    if (!targetSlot) return;
    const newSlot = { day: selectedDay, start: targetSlot.start, end: targetSlot.end };
    const exists = userForm.availability.some(s => s.day === newSlot.day && s.start === newSlot.start);
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
    const newSlot = { day: customDay, start: text, end: "CUSTOM" };
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
    setUserForm(prev => {
      const isSelected = prev.games.includes(tag);
      const nextGames = isSelected
        ? prev.games.filter((g) => g !== tag)
        : [...prev.games, tag];
      return { ...prev, games: Array.from(new Set(nextGames)) };
    });
  };

  const handleAddCustomTag = () => {
    const trimmed = otherTagInput.trim();
    if (!trimmed) return;
    setUserForm(prev => {
      if (prev.games.includes(trimmed)) return prev;
      return { ...prev, games: [...prev.games, trimmed] };
    });
    setOtherTagInput("");
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("このエントリー募集を取り消しますか？（部屋から完全に退室します）")) return;
    setLoading(true);
    try {
      await api.deleteUser(id);
      
      if (id.toString() === myUserId?.toString()) {
        setMyUserId(null);
        localStorage.removeItem("fight_club_my_user_id");
        setActiveEvent(null);
        setShowMatchNotification(false);
        setStatusMessage("");
        setView("dashboard");
      }
      addToast("退室/募集削除が完了しました", "success");
      await refreshAll();
    } catch (e: any) {
      addToast("退室処理に失敗しました: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const onUserSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nickname = userForm.nickname.trim();
    if (!nickname) {
      addToast("ニックネームを入力してください", "error");
      return;
    }
    if (!userForm.customLocation.trim()) {
      addToast("開催場所を選択してください", "error");
      return;
    }
    if (userForm.availability.length === 0 || userForm.games.length === 0) {
      addToast("空きコマと希望タイトルを登録してください", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await api.registerUser({
        role: registerType === "host" ? "professor" : "student", 
        nickname: nickname,
        room_name: registerType === "host" ? userForm.customLocation : null,
        capacity: parseInt(userForm.capacity),
        comment: userForm.comment.trim(),
        sns_contact: userForm.snsContact.trim(),
        games: userForm.games, 
        availability: userForm.availability
      });
      
      addToast("部屋を立てました！", "success");
      setStatusMessage("部屋を作成しました。参加者を待っています...");
      
      setMyUserId(res.user_id.toString());
      localStorage.setItem("fight_club_my_user_id", res.user_id.toString());
      setUserForm(prev => ({ 
        ...prev,
        games: [], 
        availability: [], 
        comment: "",
        snsContact: "",
        capacity: "4"
      }));
      await refreshAll();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeEvent?.id) return;
    
    const senderName = userForm.nickname || "あなた";
    try {
      await api.sendChat(activeEvent.id, senderName, chatInput.trim());
      setChatInput("");
      const chats = await api.getChat(activeEvent.id);
      setChatMessages(chats);
    } catch (e) {
      addToast("メッセージの送信に失敗しました", "error");
    }
  };

  const handleManualJoinLobbyUser = (hostUser: User, chosenGame: string, slot: AvailabilitySlot) => {
    setJoiningHostInfo({
      hostUser: hostUser,
      game: chosenGame,
      slot: slot
    });
    const savedNickname = localStorage.getItem("fight_club_preset_nickname") || "";
    setGuestForm(prev => ({
      ...prev,
      nickname: prev.nickname || savedNickname
    }));
    setActiveModal("join_guest");
  };

  const handleJoinEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nickname = guestForm.nickname.trim();
    if (!nickname) {
      addToast("ニックネームを入力してください", "error");
      return;
    }
    if (!joiningHostInfo) return;
    
    setLoading(true);
    try {
      const res = await api.joinEvent({
        host_user_id: parseInt(joiningHostInfo.hostUser.id),
        nickname: nickname,
        comment: guestForm.comment.trim(),
        sns_contact: guestForm.snsContact.trim(),
        game: joiningHostInfo.game,
        day: joiningHostInfo.slot.day,
        start: joiningHostInfo.slot.start
      });
      
      addToast("部屋に入りました！", "success");
      
      setMyUserId(res.user_id.toString());
      localStorage.setItem("fight_club_my_user_id", res.user_id.toString());
      localStorage.setItem("fight_club_preset_nickname", nickname);
      setUserForm(prev => ({ ...prev, nickname: nickname }));
      
      setActiveEvent({
        id: res.event_id,
        room_name: res.room_name,
        matched_game: res.matched_game,
        day: res.day,
        period: res.period,
        members: res.members,
        capacity: res.capacity
      });
      
      setActiveModal("none");
      setView("event");
      await refreshAll();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const filteredAndVisibleUsers = useMemo(() => {
    const now = new Date();
    const daysMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const currentDayValue = daysMap[now.getDay()]; 
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return users
      .filter((u) => u.id.toString() !== myUserId?.toString())
      .filter((u) => {
        if (filterGameSearch.trim() !== "") {
          const searchLower = filterGameSearch.toLowerCase().trim();
          if (!u.games?.some((g) => g.toLowerCase().includes(searchLower))) return false;
        }
        if (filterDay !== "ALL" && !filterImmediateOnly) {
          if (!u.availability?.some((av) => av.day === filterDay)) return false;
        }
        if (filterImmediateOnly) {
          return u.availability?.some((av) => {
            if (av.day !== currentDayValue) return false;
            if (av.end === "CUSTOM") return true;
            const [sh, sm] = av.start.split(":").map(Number);
            const [eh, em] = av.end.split(":").map(Number);
            return (currentMinutes >= (sh * 60 - 30) && currentMinutes <= (eh * 60));
          });
        }
        return true;
      });
  }, [users, myUserId, filterGameSearch, filterDay, filterImmediateOnly]);

  if (view === "event") {
    const isMatchedConfirmed = activeEvent && activeEvent.members && activeEvent.members.length >= getCapacity(activeEvent);
    return (
      <div className="app event-view-active">
        <header style={{ position: "relative" }}>
          <h1>FIGHT CLUB</h1>
          <p className="subtitle">
            {isMatchedConfirmed ? "MATCH SETTLED" : "WAITING FOR PLAYERS"}
            {activeEvent && ` (${activeEvent.members?.length} / ${getCapacity(activeEvent)}名)`}
          </p>
        </header>
        <section style={{ borderColor: isMatchedConfirmed ? "var(--accent-pink)" : "var(--accent-cyan)" }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <h2 style={{ 
              color: "#fff", 
              border: "none", 
              padding: "10px 24px", 
              fontSize: "2.5rem", 
              fontWeight: "900", 
              letterSpacing: "4px", 
              textTransform: "uppercase",
              textShadow: isMatchedConfirmed 
                ? "0 0 10px var(--accent-pink), 0 0 20px rgba(255, 0, 127, 0.6)"
                : "0 0 10px var(--accent-cyan), 0 0 20px rgba(0, 255, 255, 0.6)",
              borderTop: isMatchedConfirmed ? "2px solid var(--accent-pink)" : "2px solid var(--accent-cyan)",
              borderBottom: isMatchedConfirmed ? "2px solid var(--accent-pink)" : "2px solid var(--accent-cyan)",
              display: "inline-block"
            }}>
              {isMatchedConfirmed ? "MATCH CONFIRMED" : "RECRUITING MEMBERS"}
            </h2>
          </div>
          <div className="event-grid">
            <div className="event-card">
              <h3>LOCATION (部屋)</h3>
              <p className="highlight">{activeEvent?.room_name || "指定教室"}</p>
            </div>
            <div className="event-card">
              <h3>TIME</h3>
              <p className="highlight" style={{ color: "#ffffff" }}>
                {activeEvent?.day ? `${DAYS_OF_WEEK.find(d => d.value === activeEvent.day)?.label || activeEvent.day} ${activeEvent.period}限` : "マッチ確定枠"}
              </p>
            </div>
          </div>
        
          <div className="event-grid" style={{ marginTop: "16px" }}>
            <div className="event-card">
              <h3>SELECTED TITLE</h3>
              <p className="highlight" style={{ color: isMatchedConfirmed ? "var(--accent-pink)" : "var(--accent-cyan)" }}>{activeEvent?.matched_game || "GAME"}</p>
            </div>
            <div className="event-card" style={{ border: isMatchedConfirmed ? "1px dashed var(--accent-pink)" : "1px dashed var(--accent-cyan)" }}>
              <h3>HOST CONTACT ID (SNS)</h3>
              <p className="highlight" style={{ color: "#00ffff", fontSize: "1.2rem" }}>
                {(activeEvent?.members || []).filter((m: any) => m.sns_contact).map((m: any) => `${m.nickname}: [${m.sns_contact}]`).join(' | ') || '登録なし'}
              </p>
            </div>
          </div>
          <div className="event-card" style={{ marginTop: "16px" }}>
            <h3>PLAYERS</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "8px" }}>
              {activeEvent?.members?.map((m: any) => (
                <span key={m.nickname} className="badge" title={m.comment}>
                  {m.nickname} {m.comment && `(${m.comment})`}
                </span>
              ))}
            </div>
          </div>
          <div style={{ marginTop: "24px", background: "#050505", border: "1px solid #222", padding: "16px" }}>
            <h3 style={{ fontSize: "14px", color: "#fff", letterSpacing: "1px", marginBottom: "12px", borderBottom: "1px solid #222", paddingBottom: "6px" }}>
              LOBBY CHAT BOARD (伝言板)
            </h3>
            <div style={{ height: "180px", overflowY: "auto", background: "#000", border: "1px solid #111", padding: "10px", marginBottom: "12px" }}>
              {chatMessages.map(msg => (
                <div key={msg.id} style={{ marginBottom: "8px", fontSize: "13px" }}>
                  <span style={{ color: msg.sender === (userForm.nickname || "あなた") ? "#ff007f" : msg.sender === "SYSTEM" ? "#888" : "#00ffff", fontWeight: "bold", marginRight: "8px" }}>
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
 
          <div style={{ textAlign: "center", marginTop: "32px", display: "flex", justifyContent: "center", gap: "16px", flexWrap: "wrap" }}>
            <button 
              className="btn-secondary" 
              onClick={() => { 
                setView("dashboard"); 
                refreshAll(); 
              }}
            >
              ロビーに戻る (一時退出)
            </button>
            {myUserId && (() => {
              const myMember = activeEvent?.members?.find((m: any) => m.id.toString() === myUserId.toString());
              const isHost = myMember && myMember.room_name !== null && myMember.room_name !== undefined;
              return (
                <button 
                  style={{ background: "#cc0000", border: "1px solid #ff3333" }}
                  onClick={() => { 
                    handleDeleteUser(myUserId);
                  }}
                >
                  {isHost ? "部屋を削除して解散 (エントリー削除)" : "部屋から完全に退出 (入室状況を削除)"}
                </button>
              );
            })()}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="toast-container">
        {toasts.map((t) => (
          <div 
            key={t.id} 
            className={`toast ${t.type === "neon-match" ? "toast-neon-match" : ""}`}
            style={t.type !== "neon-match" ? {
              background: t.type === "success" ? "#ff007f" : t.type === "error" ? "#ff3333" : "#ffffff",
              color: t.type === "info" ? "#000000" : "#ffffff",
              border: "1px solid rgba(255,255,255,0.2)"
            } : {}}
          >
            {t.message}
          </div>
        ))}
      </div>
      <header style={{ position: "relative" }}>
        <h1>F I G H T・C L U B</h1>
        <p className="subtitle">P2P CLASSROOM MATCHING SYSTEM</p>
      </header>
      {activeEvent && activeEvent.members && activeEvent.members.length >= getCapacity(activeEvent) ? (
        <div className="match-confirmed-alert">
          <h2>MATCH CONFIRMED</h2>
          <p style={{ fontSize: "1.1rem", margin: "10px 0", color: "#ccc", fontWeight: "bold" }}>
            対戦メンバーが揃いました！（マッチング成立）
          </p>
          <div style={{ fontSize: "0.95rem", color: "var(--accent-cyan)", marginBottom: "20px", fontWeight: "bold" }}>
            場所: {activeEvent.room_name} | 種目: {activeEvent.matched_game} | メンバー数: {activeEvent.members.length}/{getCapacity(activeEvent)}名
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: "16px", flexWrap: "wrap" }}>
            <button 
              className="btn-enter-room" 
              onClick={() => setView("event")}
            >
              部屋に入る (ENTER)
            </button>
          </div>
        </div>
      ) : (
        (statusMessage || activeEvent) && (
          <div className="status-banner" style={{ background: "#005f73", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", flexWrap: "wrap", gap: "10px" }}>
            <span style={{ fontWeight: "bold" }}>
              {statusMessage || "対戦メンバーの合流を待っています..."}
              {activeEvent && activeEvent.members && ` (現在のメンバー: ${activeEvent.members.length}/${getCapacity(activeEvent)}名)`}
            </span>
            <div style={{ display: "flex", gap: "12px" }}>
              {activeEvent && (
                <button 
                  className="btn-secondary" 
                  style={{ 
                    background: "var(--accent-pink)", 
                    color: "#fff", 
                    border: "none", 
                    padding: "8px 18px", 
                    fontSize: "13px", 
                    fontWeight: "900", 
                    cursor: "pointer", 
                    borderRadius: "2px",
                    boxShadow: "0 0 10px rgba(255, 0, 127, 0.6)",
                    letterSpacing: "1px"
                  }}
                  onClick={() => {
                    setView("event");
                  }}
                >
                  部屋に入る (ENTER)
                </button>
              )}
              {myUserId && (
                <button 
                  style={{ 
                    background: "#cc0000", 
                    border: "none", 
                    color: "#fff",
                    padding: "8px 18px", 
                    fontSize: "13px", 
                    fontWeight: "900", 
                    cursor: "pointer", 
                    borderRadius: "2px"
                  }}
                  onClick={() => handleDeleteUser(myUserId)}
                >
                  募集取消/退出
                </button>
              )}
            </div>
          </div>
        )
      )}
      <section>
        <h2>対戦・マッチの新規募集（登録）</h2>
        <form onSubmit={onUserSubmit}>
          <div className="register-type-box">
            <div className="radio-group">
              <label className="radio-label" style={{ color: "#fff", margin: 0 }}>
                <input 
                  type="radio" 
                  name="regType" 
                  checked={registerType === "host"} 
                  onChange={() => setRegisterType("host")} 
                />
                部屋を立てて募集する (ホスト)
              </label>
              <label className="radio-label" style={{ color: "#fff", margin: 0 }}>
                <input 
                  type="radio" 
                  name="regType" 
                  checked={registerType === "guest"} 
                  onChange={() => setRegisterType("guest")} 
                />
                希望時間・タイトルを登録して待つ (ゲスト)
              </label>
            </div>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <label style={{ margin: 0 }}>
              ニックネーム
              <input type="text" placeholder="ニックネーム" value={userForm.nickname} onChange={(e) => setUserForm({ ...userForm, nickname: e.target.value })} required />
            </label>
            
            {registerType === "host" ? (
              <label style={{ margin: 0 }}>
                開催場所の指定（部屋・教室）
                <select 
                  value={userForm.customLocation || "7A101"} 
                  onChange={(e) => setUserForm({ ...userForm, customLocation: e.target.value })} 
                  required
                >
                  <option value="7A101">7A101</option>
                  <option value="7A102">7A102</option>
                  <option value="7A103">7A103</option>
                  <option value="7A104">7A104</option>
                  <option value="7A105">7A105</option>
                  <option value="7A106">7A106</option>
                  <option value="7B106">7B106</option>
                  <option value="7C102">7C102</option>
                  <option value="7C103">7C103</option>
                  <option value="7A202">7A202</option>
                  <option value="7A203">7A203</option>
                  <option value="7A204">7A204</option>
                  <option value="7A205">7A205</option>
                  <option value="7A206">7A206</option>
                  <option value="7A207">7A207</option>
                  <option value="7A210">7A210</option>
                  <option value="7A211">7A211</option>
                  <option value="7B204">7B204</option>
                  <option value="7B205">7B205</option>
                  <option value="7C201">7C201</option>
                  <option value="7C202">7C202</option>
                  <option value="7C203">7C203</option>
                </select>
              </label>
            ) : (
              <div style={{ display: "flex", alignItems: "center", fontSize: "0.85rem", color: "#888", paddingLeft: "10px", marginTop: "20px" }}>
                ※ ゲスト登録の場合、マッチング成立時に自動で部屋が割り当てられます。
              </div>
            )}
          </div>
          {registerType === "host" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <label style={{ margin: 0 }}>
                募集総人数（自分含む）
                <select value={userForm.capacity} onChange={(e) => setUserForm({ ...userForm, capacity: e.target.value })}>
                  <option value="2">2人</option>
                  <option value="3">3人</option>
                  <option value="4">4人</option>
                  <option value="5">5人</option>
                </select>
              </label>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
            <div>
              <label>一言コメント（任意）</label>
              <input 
                type="text" 
                placeholder="例: 初心者歓迎、プロコン持参します" 
                value={userForm.comment} 
                onChange={(e) => setUserForm({ ...userForm, comment: e.target.value })} 
                maxLength={60}
              />
            </div>
            <div>
              <label>連絡用SNS (任意 / マッチ成立時のみ開示)</label>
              <input 
                type="text" 
                placeholder="例: Discord ID, X ID" 
                value={userForm.snsContact} 
                onChange={(e) => setUserForm({ ...userForm, snsContact: e.target.value })} 
              />
            </div>
          </div>
          <div style={{ marginBottom: "24px" }}>
            <label>空き時間の選択（登録必須）</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <button type="button" className="btn-select-trigger" onClick={() => setActiveModal("standard")}>
                曜日・時限リストから選ぶ
              </button>
              <button type="button" className="btn-select-trigger btn-secondary" onClick={() => setActiveModal("custom")}>
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
            <label>希望タイトル</label>
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
          <button type="submit" disabled={loading} style={{ width: "100%" }}>
            {registerType === "host" ? "公開掲示板に部屋を立てる (投稿)" : "メンバー登録してマッチングを待つ"}
          </button>
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
      
      {activeModal === "join_guest" && (
        <div className="modal-overlay">
          <div className="modal-mini-window">
            <div className="modal-header">
              <h2>部屋に入る (ゲスト参加登録)</h2>
              <button className="btn-close-modal" onClick={() => setActiveModal("none")}>×</button>
            </div>
            <form onSubmit={handleJoinEventSubmit}>
              <div style={{ marginBottom: "16px" }}>
                <label>合流先ゲーム</label>
                <div style={{ color: "#ff007f", fontWeight: "bold", fontSize: "1.1rem" }}>
                  {joiningHostInfo?.game}
                </div>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label>開催場所 / ホスト</label>
                <div style={{ color: "#00ffff", fontSize: "0.95rem" }}>
                  @{joiningHostInfo?.hostUser?.room_name} ({joiningHostInfo?.hostUser?.nickname} の部屋)
                </div>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label>ニックネーム (必須)</label>
                <input 
                  type="text" 
                  placeholder="ニックネームを入力" 
                  value={guestForm.nickname} 
                  onChange={(e) => setGuestForm({ ...guestForm, nickname: e.target.value })} 
                  required 
                />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label>一言コメント (任意)</label>
                <input 
                  type="text" 
                  placeholder="例: よろしくお願いします！" 
                  value={guestForm.comment} 
                  onChange={(e) => setGuestForm({ ...guestForm, comment: e.target.value })} 
                />
              </div>
              <div style={{ marginBottom: "24px" }}>
                <label>連絡用SNS (任意 / マッチ成立時のみ開示)</label>
                <input 
                  type="text" 
                  placeholder="例: Discord ID, X ID" 
                  value={guestForm.snsContact} 
                  onChange={(e) => setGuestForm({ ...guestForm, snsContact: e.target.value })} 
                />
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <button type="submit" disabled={loading} style={{ flex: 1 }}>参加する</button>
                <button type="button" className="btn-secondary" onClick={() => setActiveModal("none")} style={{ flex: 1 }}>キャンセル</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* 公開募集掲示板 */}
      <section style={{ border: "2px solid #ff007f" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <h2>LOBBY BOARD（公開募集ロビー一覧）</h2>
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
              {filterImmediateOnly ? "今すぐマッチ有効中" : "希望曜日でしぼり込み"}
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
            <span style={{ fontSize: "11px", color: "#aaa", display: "block", marginBottom: "4px", fontWeight: "bold" }}>今すぐ遊べる部屋のみ表示</span>
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
              {filterImmediateOnly ? "ON (有効)" : "OFF (無効)"}
            </button>
          </div>
        </div>
        {filteredAndVisibleUsers.length === 0 ? (
          <div className="empty-state" style={{ padding: "40px 20px", textAlign: "center", color: "#666" }}>
            待機中のエントリー募集はありません。
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
            {filteredAndVisibleUsers.map((u) => {
              const isHost = u.room_name !== null && u.room_name !== undefined;
              const displayLocation = u.room_name || "マッチ部屋へ自動割り当て";
              const canJoin = isHost && myUserId === null;
              return (
                <div key={u.id} className="suggestion-card" style={{ borderColor: isHost ? "var(--accent-cyan)" : "#333", boxShadow: isHost ? "0 0 10px rgba(0, 255, 255, 0.15)" : "none" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        {isHost ? (
                          <span className="white-tag" style={{ background: "var(--accent-cyan)", color: "#000", border: "none", fontWeight: "bold" }}>ROOM CREATOR (@{displayLocation})</span>
                        ) : (
                          <span className="white-tag" style={{ background: "#222", color: "#aaa", border: "none" }}>JOINER (探し中)</span>
                        )}
                        <span className="white-tag" style={{ background: "#222", color: "#aaa", marginLeft: "6px", border: "none" }}>
                          {u.capacity}人募集
                        </span>
                      </div>
                      <button className="btn-delete-small" onClick={() => handleDeleteUser(u.id)}>削除</button>
                    </div>
                    <div style={{ margin: "14px 0 4px 0", fontSize: "16px", fontWeight: "bold" }}>
                      USER: {u.nickname}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", margin: "8px 0" }}>
                      {u.games?.map((game) => (
                        <span key={game} className="badge" style={{ background: "rgba(0, 255, 255, 0.1)", border: "1px solid var(--accent-cyan)", color: "#fff", fontSize: "0.75rem", padding: "4px 8px" }}>
                          {game}
                        </span>
                      ))}
                    </div>
                    {u.comment && (
                      <div style={{
                        background: "#111",
                        borderLeft: "2px solid var(--accent-cyan)",
                        padding: "6px 10px",
                        fontSize: "13px",
                        color: "#ddd",
                        margin: "8px 0 12px 0",
                        fontStyle: "italic",
                        wordBreak: "break-all"
                      }}>
                        {u.comment}
                      </div>
                    )}
                    <div style={{ fontSize: "12px", color: "#888", marginBottom: "12px", marginTop: "10px" }}>
                      <div>希望スケジュール:</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                        {u.availability?.map((av, i) => {
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
                    {isHost ? (
                      <button
                        className="btn-direct-confirm"
                        disabled={!canJoin}
                        style={{
                          background: canJoin ? "var(--accent-cyan)" : "#222",
                          color: canJoin ? "#000" : "#555",
                          border: canJoin ? "none" : "1px solid #333",
                          cursor: canJoin ? "pointer" : "not-allowed",
                          opacity: canJoin ? 1 : 0.4,
                          boxShadow: canJoin ? "0 0 10px rgba(0, 255, 255, 0.4)" : "none",
                          fontWeight: canJoin ? "bold" : "normal",
                          width: "100%",
                          padding: "10px 0",
                          fontSize: "14px",
                          letterSpacing: "1px"
                        }}
                        onClick={() => handleManualJoinLobbyUser(u, u.games?.[0] || "", u.availability?.[0] || { day: "Mon", start: "12:15", end: "13:30" })}
                      >
                        部屋に入る (ENTER ROOM)
                      </button>
                    ) : (
                      <div style={{
                        textAlign: "center",
                        fontSize: "12px",
                        color: "var(--accent-cyan)",
                        padding: "8px",
                        border: "1px dashed rgba(0, 255, 255, 0.2)",
                        background: "rgba(0, 255, 255, 0.02)",
                        letterSpacing: "1px"
                      }}>
                        MATCHMAKING (対戦相手を探しています)
                      </div>
                    )}
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
            {matches.length === 0 ? <p style={{ color: "#666" }}>履歴はありません</p> : (
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
                    {matches.map((m) => (
                      <tr key={m.id}>
                        <td>{m.student?.nickname || m.studentId}</td>
                        <td>{m.professor?.nickname || m.professorId}</td>
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