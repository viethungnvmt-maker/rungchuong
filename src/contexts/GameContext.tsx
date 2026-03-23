import React, { createContext, useContext, useCallback, useRef, useEffect, useState } from 'react';
import { database, ref, set, get, onValue, update, remove, waitForAuth, getCurrentUserId } from '../services/firebaseConfig';
import type { Question } from '../services/gameStore';

// ===== Types =====
export interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
  correctAnswers: number;
  isEliminated: boolean;
  tabId: string;
}

export interface RoomSettings {
  timePerQuestion: number;
  eliminationMode: boolean;
  speedBonus: boolean;
}

export interface Room {
  id: string;
  pin: string;
  hostTabId: string;
  questions: Question[];
  settings: RoomSettings;
  status: 'waiting' | 'playing' | 'finished';
  players: Record<string, Player>;
  currentQuestionIndex: number;
  answers: Record<string, number>;
  answerTimes: Record<string, number>;
  questionStartTime: number;
  /** Flag để tránh tính điểm 2 lần cho cùng 1 câu */
  answerRevealed?: boolean;
}

interface GameContextType {
  tabId: string;
  room: Room | null;
  openRoomByPin: (pin: string) => Promise<boolean>;
  createRoom: (questions: Question[], settings: RoomSettings) => Promise<string>;
  startGame: () => void;
  nextQuestion: () => void;
  showAnswer: () => void;
  joinRoom: (pin: string, name: string, avatar: string) => Promise<boolean>;
  submitAnswer: (answerIndex: number) => void;
  players: Player[];
  currentQuestion: any;
  gameState: 'idle' | 'waiting' | 'playing' | 'showingAnswer' | 'finished';
  answerResult: any;
  answers: Record<string, number>;
  myPlayer: Player | null;
}

const GameContext = createContext<GameContextType>(null!);
export function useGame() { return useContext(GameContext); }

function generatePin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [tabId, setTabId] = useState<string>('');
  const [room, setRoom] = useState<Room | null>(null);
  const [gameState, setGameState] = useState<'idle' | 'waiting' | 'playing' | 'showingAnswer' | 'finished'>('idle');
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [answerResult, setAnswerResult] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [myPlayer, setMyPlayer] = useState<Player | null>(null);

  const unsubscribeRef = useRef<(() => void) | null>(null);
  // Guard chống gọi showAnswer 2 lần
  const showAnswerRunningRef = useRef(false);
  // Guard chống submit 2 lần (sync, không async)
  const submitLockRef = useRef(false);

  useEffect(() => {
    waitForAuth()
      .then(uid => setTabId(uid))
      .catch((err) => {
        console.error('[GameProvider] Auth init error:', err);
      });
    return () => { if (unsubscribeRef.current) unsubscribeRef.current(); };
  }, []);

  const isHostRef = useRef(false);
  const tabIdRef = useRef('');
  tabIdRef.current = tabId;

  // Listen to room changes from Firebase
  const listenToRoom = useCallback((pin: string) => {
    if (unsubscribeRef.current) unsubscribeRef.current();

    const roomDbRef = ref(database, `rooms/${pin}`);
    const unsub = onValue(roomDbRef, (snapshot) => {
      const data = snapshot.val() as Room | null;
      if (!data) return;

      const uid = getCurrentUserId();
      isHostRef.current = data.hostTabId === uid;

      setRoom(data);

      if (data.status === 'finished') {
        setGameState('finished');
        return;
      }

      // Cập nhật answers
      setAnswers(data.answers || {});

      // Cập nhật câu hỏi hiện tại
      if (data.currentQuestionIndex >= 0 && data.questions?.length > data.currentQuestionIndex) {
        const q = data.questions[data.currentQuestionIndex];
        setCurrentQuestion({
          index: data.currentQuestionIndex,
          total: data.questions.length,
          content: q.content,
          options: q.options,
          timeLimit: data.settings.timePerQuestion,
          points: q.points || 100,
        });
      }

      // Cập nhật trạng thái game dựa trên Firebase
      if (data.answerResult && data.answerRevealed) {
        // FIX BUG 7: dùng data.players từ Firebase (fresh), không phải stale closure
        const playersArray = Object.values(data.players || {});
        setAnswerResult({ ...data.answerResult, players: playersArray });
        setGameState('showingAnswer');
      } else if (data.status === 'playing') {
        /**
         * FIX BUG 8: Khi host bấm "Câu tiếp theo", Firebase update:
         *   answerResult = null, answerRevealed = false, status = 'playing'
         *
         * Trước đây: giữ nguyên 'showingAnswer' → player bị stuck ở
         *   "Đang chờ câu hỏi tiếp theo..." mãi mãi.
         *
         * Fix: Khi answerRevealed === false (host đã chuyển câu mới),
         *   LUÔN chuyển sang 'playing' bất kể state cũ là gì.
         *   Đồng thời reset answerResult và submitLockRef để player
         *   có thể trả lời câu mới.
         */
        setAnswerResult(null);
        setGameState('playing');
        submitLockRef.current = false;
      }

      // Cập nhật myPlayer từ Firebase (điểm số mới nhất)
      const me = Object.values(data.players || {}).find(p => p.tabId === uid);
      if (me) setMyPlayer(me);
    });

    unsubscribeRef.current = unsub;
  }, []);

  // ===== HOST ACTIONS =====
  const createRoom = useCallback(async (questions: Question[], settings: RoomSettings): Promise<string> => {
    const uid = await waitForAuth();
    const pin = generatePin();
    const newRoom: Room = {
      id: `room_${Date.now()}`,
      pin,
      hostTabId: uid,
      questions,
      settings,
      status: 'waiting',
      players: {},
      currentQuestionIndex: -1,
      answers: {},
      answerTimes: {},
      questionStartTime: 0,
      answerRevealed: false,
    };
    await set(ref(database, `rooms/${pin}`), newRoom);
    setRoom(newRoom);
    setGameState('waiting');
    listenToRoom(pin);
    return pin;
  }, [listenToRoom]);

  const openRoomByPin = useCallback(async (pin: string): Promise<boolean> => {
    const snapshot = await get(ref(database, `rooms/${pin}`));
    if (!snapshot.exists()) return false;

    const roomData = snapshot.val() as Room;
    setRoom(roomData);

    if (roomData.status === 'finished') {
      setGameState('finished');
    } else if (roomData.status === 'playing') {
      setGameState('playing');
    } else {
      setGameState('waiting');
    }

    listenToRoom(pin);
    return true;
  }, [listenToRoom]);

  const startGame = useCallback(async () => {
    if (!room) return;
    const pin = room.pin;
    showAnswerRunningRef.current = false;
    submitLockRef.current = false;

    await update(ref(database), {
      [`rooms/${pin}/status`]: 'playing',
      [`rooms/${pin}/currentQuestionIndex`]: 0,
      [`rooms/${pin}/answers`]: {},
      [`rooms/${pin}/answerTimes`]: {},
      [`rooms/${pin}/questionStartTime`]: Date.now(),
      [`rooms/${pin}/answerResult`]: null,
      [`rooms/${pin}/answerRevealed`]: false,
    });
    setGameState('playing');
    setAnswers({});
    setAnswerResult(null);
  }, [room]);

  const nextQuestion = useCallback(async () => {
    if (!room) return;
    const pin = room.pin;
    const nextIdx = room.currentQuestionIndex + 1;
    showAnswerRunningRef.current = false;
    submitLockRef.current = false;

    if (nextIdx < room.questions.length) {
      await update(ref(database), {
        [`rooms/${pin}/currentQuestionIndex`]: nextIdx,
        [`rooms/${pin}/answers`]: {},
        [`rooms/${pin}/answerTimes`]: {},
        [`rooms/${pin}/questionStartTime`]: Date.now(),
        [`rooms/${pin}/answerResult`]: null,
        [`rooms/${pin}/answerRevealed`]: false,
      });
      setGameState('playing');
      setAnswers({});
      setAnswerResult(null);
    } else {
      await update(ref(database), { [`rooms/${pin}/status`]: 'finished' });
      setGameState('finished');
    }
  }, [room]);

  /**
   * showAnswer – tính điểm và công bố đáp án.
   *
   * FIX BUG 3+4: Không gọi showAnswer từ trong setInterval callback (stale closure).
   *   Host Room phải gọi showAnswer() từ useEffect riêng theo ref.
   * FIX BUG: Dùng flag `answerRevealed` trên Firebase để chặn double-scoring.
   */
  const showAnswer = useCallback(async () => {
    // Chặn double-call
    if (showAnswerRunningRef.current) return;
    showAnswerRunningRef.current = true;

    // Lấy pin từ room ref để tránh stale
    const pin = room?.pin;
    if (!pin) { showAnswerRunningRef.current = false; return; }

    // Fetch fresh data từ Firebase
    const freshSnap = await get(ref(database, `rooms/${pin}`));
    if (!freshSnap.exists()) { showAnswerRunningRef.current = false; return; }
    const freshRoom = freshSnap.val() as Room;

    // FIX: Kiểm tra flag answerRevealed để chặn tính điểm 2 lần
    if (freshRoom.answerRevealed) {
      showAnswerRunningRef.current = false;
      return;
    }

    const q = freshRoom.questions[freshRoom.currentQuestionIndex];
    if (!q) { showAnswerRunningRef.current = false; return; }

    const correctIndex = q.correctAnswer;
    const playersObj = freshRoom.players || {};
    const roomAnswers = freshRoom.answers || {};
    const roomTimes = freshRoom.answerTimes || {};

    const updatedPlayers: Record<string, Player> = {};
    for (const [key, p] of Object.entries(playersObj) as [string, Player][]) {
      if (p.isEliminated) {
        updatedPlayers[key] = p;
        continue;
      }
      const answer = roomAnswers[p.tabId];
      if (answer === correctIndex) {
        let points = q.points || 100;
        if (freshRoom.settings.speedBonus) {
          const timeTaken = roomTimes[p.tabId] ?? (freshRoom.settings.timePerQuestion * 1000);
          const timeRatio = Math.max(0, 1 - timeTaken / (freshRoom.settings.timePerQuestion * 1000));
          points += Math.floor(timeRatio * 50);
        }
        updatedPlayers[key] = { ...p, score: p.score + points, correctAnswers: p.correctAnswers + 1 };
      } else if (freshRoom.settings.eliminationMode && answer !== undefined) {
        updatedPlayers[key] = { ...p, isEliminated: true };
      } else {
        updatedPlayers[key] = p;
      }
    }

    const result = {
      correctAnswer: correctIndex,
      explanation: q.explanation,
      answers: roomAnswers,
    };

    // FIX: Set answerRevealed = true CÙNG LÚC với kết quả để chặn race condition
    await update(ref(database), {
      [`rooms/${pin}/players`]: updatedPlayers,
      [`rooms/${pin}/answerResult`]: result,
      [`rooms/${pin}/answerRevealed`]: true,
    });

    setAnswerResult({ ...result, players: Object.values(updatedPlayers) });
    setGameState('showingAnswer');
    showAnswerRunningRef.current = false;
  }, [room]);

  // ===== PLAYER ACTIONS =====
  const joinRoom = useCallback(async (pin: string, name: string, avatar: string): Promise<boolean> => {
    const uid = await waitForAuth();
    const snapshot = await get(ref(database, `rooms/${pin}`));
    if (!snapshot.exists()) return false;
    const roomData = snapshot.val() as Room;
    if (roomData.status !== 'waiting') return false;

    const player: Player = {
      id: `player_${Date.now()}`,
      name, avatar,
      score: 0, correctAnswers: 0, isEliminated: false,
      tabId: uid,
    };
    await set(ref(database, `rooms/${pin}/players/${uid}`), player);
    setMyPlayer(player);
    setRoom(roomData);
    setGameState('waiting');
    listenToRoom(pin);
    submitLockRef.current = false;
    return true;
  }, [listenToRoom]);

  /**
   * submitAnswer – ghi câu trả lời lên Firebase.
   *
   * FIX BUG 5: Dùng submitLockRef (sync) thay vì async get() check.
   *   Async check có race window: player bấm 2 lần cực nhanh, cả 2 đều pass get() trước khi set() xong.
   */
  const submitAnswer = useCallback(async (answerIndex: number) => {
    if (!room) return;
    // Sync lock – chặn ngay không cần await
    if (submitLockRef.current) return;
    submitLockRef.current = true;

    try {
      const uid = await waitForAuth();
      const timeTaken = Date.now() - (room.questionStartTime || Date.now());
      await update(ref(database), {
        [`rooms/${room.pin}/answers/${uid}`]: answerIndex,
        [`rooms/${room.pin}/answerTimes/${uid}`]: timeTaken,
      });
    } catch (err) {
      console.error('[submitAnswer] Error:', err);
      submitLockRef.current = false; // unlock nếu lỗi để user thử lại
    }
  }, [room]);

  const players = room?.players ? Object.values(room.players) : [];

  return (
    <GameContext.Provider value={{
      tabId, room,
      openRoomByPin,
      createRoom, startGame, nextQuestion, showAnswer,
      joinRoom, submitAnswer,
      players, currentQuestion, gameState, answerResult, answers, myPlayer,
    }}>
      {children}
    </GameContext.Provider>
  );
}
