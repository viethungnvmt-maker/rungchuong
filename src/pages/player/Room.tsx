import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, CheckCircle2, XCircle, Trophy, AlertTriangle, Send, MinusCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import MathText from '../../components/MathText';
import { useGame } from '../../contexts/GameContext';

const ANSWER_COLORS = [
  'bg-red-500 border-red-600',
  'bg-blue-500 border-blue-600',
  'bg-yellow-500 border-yellow-600',
  'bg-green-500 border-green-600',
];

export default function PlayerRoom() {
  const { pin } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { gameState, currentQuestion, answerResult, myPlayer, joinRoom, submitAnswer } = useGame();

  const [timeLeft, setTimeLeft] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [joined, setJoined] = useState(false);
  const [showAlreadyAnswered, setShowAlreadyAnswered] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // FIX BUG 5: Sync lock để chặn double-submit tuyệt đối
  const hasSubmittedRef = useRef(false);
  // Lưu questionIndex của lần submit để reset đúng
  const submittedForQuestionRef = useRef(-1);

  // Join room
  useEffect(() => {
    const { name, avatar } = location.state || {};
    if (!name || !pin) { navigate('/play'); return; }
    const doJoin = async () => {
      const success = await joinRoom(pin, name, avatar);
      if (!success) { alert('Phòng không tồn tại hoặc game đã bắt đầu!'); navigate('/play'); }
      else setJoined(true);
    };
    doJoin();
  }, [pin, location.state, navigate]);

  // Reset state khi câu hỏi mới
  useEffect(() => {
    if (gameState === 'playing' && currentQuestion) {
      // Chỉ reset nếu đây là câu hỏi mới
      if (submittedForQuestionRef.current !== currentQuestion.index) {
        setSelectedAnswer(null);
        hasSubmittedRef.current = false;
        submittedForQuestionRef.current = currentQuestion.index;
      }

      setTimeLeft(currentQuestion.timeLimit);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState, currentQuestion]);

  useEffect(() => {
    if (gameState === 'finished' && myPlayer) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
  }, [gameState, myPlayer]);

  const handleSubmitAnswer = (index: number) => {
    if (myPlayer?.isEliminated) return;
    if (hasSubmittedRef.current || selectedAnswer !== null) {
      setShowAlreadyAnswered(true);
      setTimeout(() => setShowAlreadyAnswered(false), 1500);
      return;
    }
    hasSubmittedRef.current = true;
    setSelectedAnswer(index);
    submitAnswer(index);
  };

  if (!joined || !myPlayer) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-bold text-2xl">
        Đang kết nối...
      </div>
    );
  }

  // ===== WAITING =====
  if (gameState === 'waiting' || gameState === 'idle') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-8xl mb-8"
        >
          {myPlayer.avatar}
        </motion.div>
        <h1 className="text-4xl font-black mb-4">Xin chào, {myPlayer.name}!</h1>
        <p className="text-xl text-slate-400 bg-slate-800 px-6 py-3 rounded-full">
          Đang chờ giáo viên bắt đầu...
        </p>
      </div>
    );
  }

  // ===== BỊ LOẠI =====
  if (myPlayer.isEliminated && gameState !== 'showingAnswer' && gameState !== 'finished') {
    return (
      <div className="min-h-screen bg-red-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <AlertTriangle size={80} className="text-red-400 mb-6" />
        <h1 className="text-5xl font-black mb-4">BẠN ĐÃ BỊ LOẠI</h1>
        <p className="text-2xl text-red-200 mb-8">Rất tiếc, bạn đã trả lời sai.</p>
        <div className="bg-red-950/50 p-6 rounded-3xl border border-red-800/50">
          <p className="text-lg text-red-300 uppercase tracking-widest mb-2">Điểm của bạn</p>
          <p className="text-6xl font-black text-red-100">{myPlayer.score}</p>
        </div>
      </div>
    );
  }

  // ===== PLAYING =====
  if (gameState === 'playing' && currentQuestion) {
    // Đã chọn → Màn chờ
    if (selectedAnswer !== null) {
      const selectedColor = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500'][selectedAnswer];
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
          <header className="bg-white shadow-sm p-4 flex justify-between items-center sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{myPlayer.avatar}</span>
              <div>
                <div className="font-bold text-slate-800">{myPlayer.name}</div>
                <div className="text-sm font-bold text-orange-500">{myPlayer.score} điểm</div>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full">
              <Clock className={timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-slate-500'} size={24} />
              <span className={`text-xl font-black ${timeLeft <= 5 ? 'text-red-500' : 'text-slate-700'}`}>{timeLeft}</span>
            </div>
          </header>
          <main className="flex-1 flex flex-col items-center justify-center gap-8 p-6">
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="text-center"
            >
              <div className={`w-24 h-24 ${selectedColor} rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl`}>
                <Send size={40} className="text-white" />
              </div>
              <h1 className="text-4xl font-black text-slate-800 mb-3">Đã ghi nhận!</h1>
              <p className="text-xl text-slate-500">
                Bạn đã chọn <span className={`font-black text-2xl ${selectedColor.replace('bg-', 'text-')}`}>{String.fromCharCode(65 + selectedAnswer)}</span>
              </p>
            </motion.div>
            <motion.p
              animate={{ opacity: [0.3, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="text-lg text-slate-400 font-bold"
            >
              Đang chờ công bố đáp án...
            </motion.p>
          </main>
        </div>
      );
    }

    // Chưa chọn → Hiện đáp án
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <AnimatePresence>
          {showAlreadyAnswered && (
            <motion.div
              initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white px-6 py-3 rounded-full shadow-xl font-bold text-lg flex items-center gap-2"
            >
              <CheckCircle2 size={20} className="text-green-400" />
              Bạn đã trả lời rồi!
            </motion.div>
          )}
        </AnimatePresence>

        <header className="bg-white shadow-sm p-4 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{myPlayer.avatar}</span>
            <div>
              <div className="font-bold text-slate-800">{myPlayer.name}</div>
              <div className="text-sm font-bold text-orange-500">{myPlayer.score} điểm</div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full">
            <Clock className={timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-slate-500'} size={24} />
            <span className={`text-xl font-black ${timeLeft <= 5 ? 'text-red-500' : 'text-slate-700'}`}>{timeLeft}</span>
          </div>
        </header>

        <main className="flex-1 p-4 flex flex-col items-center justify-center gap-4 max-w-md mx-auto w-full">
          <div className="bg-white p-5 rounded-3xl shadow-lg border border-slate-100 w-full text-center">
            <span className="text-sm font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Câu {currentQuestion.index + 1}
            </span>
            <MathText
              text={currentQuestion.content}
              tag="div"
              className="text-xl font-black text-slate-800 leading-snug w-full"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 w-full">
            {currentQuestion.options.map((opt: string, i: number) => {
              const cleanOpt = opt.replace(/^[A-D][\.\/\)\:\-]\s*/i, '').trim();
              const isSelected = selectedAnswer === i;
              const hasSelected = selectedAnswer !== null;

              if (hasSelected && !isSelected) return null;

              return (
                <button
                  key={i}
                  onClick={() => handleSubmitAnswer(i)}
                  className={`${ANSWER_COLORS[i]} text-white px-5 py-4 rounded-2xl shadow-md border-b-8 flex items-center gap-3 font-bold transition-all transform overflow-hidden min-w-0 w-full ${
                    isSelected
                      ? 'ring-4 ring-white ring-offset-2 scale-105 cursor-default active:translate-y-0 active:border-b-8'
                      : 'active:border-b-0 active:translate-y-2'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0 text-base font-black">
                    {isSelected ? <CheckCircle2 size={18} /> : String.fromCharCode(65 + i)}
                  </div>
                  <MathText text={cleanOpt} className="text-left text-lg min-w-0 flex-1" />
                </button>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  // ===== SHOWING ANSWER =====
  if (gameState === 'showingAnswer' && answerResult) {
    /**
     * FIX BUG 6: Phân biệt 3 trường hợp:
     * 1. Trả lời đúng
     * 2. Trả lời sai
     * 3. Không trả lời (hết giờ) → selectedAnswer === null
     */
    const didAnswer = selectedAnswer !== null;
    const isCorrect = didAnswer && selectedAnswer === answerResult.correctAnswer;
    const isWrong = didAnswer && selectedAnswer !== answerResult.correctAnswer;
    const noAnswer = !didAnswer;

    let bgColor = 'bg-slate-600';
    if (isCorrect) bgColor = 'bg-green-600';
    if (isWrong || (noAnswer && myPlayer.isEliminated)) bgColor = 'bg-red-600';

    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-white text-center transition-colors duration-500 ${bgColor}`}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mb-8">
          {isCorrect && <CheckCircle2 size={120} className="text-white drop-shadow-lg" />}
          {isWrong && <XCircle size={120} className="text-white drop-shadow-lg" />}
          {noAnswer && <MinusCircle size={120} className="text-white drop-shadow-lg" />}
        </motion.div>

        <h1 className="text-5xl font-black mb-4 drop-shadow-md">
          {isCorrect && 'CHÍNH XÁC!'}
          {isWrong && 'SAI RỒI!'}
          {noAnswer && 'HẾT GIỜ!'}
        </h1>

        {isCorrect && (
          <p className="text-2xl font-bold mb-2 text-green-100">🎉 Bạn đi tiếp!</p>
        )}
        {isWrong && (
          <p className="text-2xl font-bold mb-2 text-red-100">
            {myPlayer.isEliminated ? '❌ Bạn đã bị loại!' : `Đáp án đúng là ${String.fromCharCode(65 + answerResult.correctAnswer)}`}
          </p>
        )}
        {noAnswer && (
          <p className="text-2xl font-bold mb-2 text-white/80">
            {myPlayer.isEliminated
              ? '❌ Bạn đã bị loại vì không trả lời!'
              : `Đáp án đúng là ${String.fromCharCode(65 + answerResult.correctAnswer)}`}
          </p>
        )}

        <div className="bg-black/20 p-6 rounded-3xl backdrop-blur-sm border border-white/10 mt-8">
          <p className="text-lg text-white/80 uppercase tracking-widest mb-2">Điểm hiện tại</p>
          <p className="text-6xl font-black">{myPlayer.score}</p>
        </div>

        <motion.p
          animate={{ opacity: [0.4, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="mt-12 text-xl font-bold opacity-80"
        >
          Đang chờ câu hỏi tiếp theo...
        </motion.p>
      </div>
    );
  }

  // ===== FINISHED =====
  if (gameState === 'finished') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <Trophy size={100} className="text-yellow-400 mb-8 drop-shadow-[0_0_30px_rgba(250,204,21,0.5)]" />
        <h1 className="text-4xl font-black mb-4">KẾT THÚC GAME</h1>
        <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 mt-8 w-full max-w-sm">
          <div className="text-6xl mb-4">{myPlayer.avatar}</div>
          <h2 className="text-2xl font-bold mb-6">{myPlayer.name}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900 p-4 rounded-2xl">
              <p className="text-sm text-slate-400 uppercase tracking-wider mb-1">Điểm số</p>
              <p className="text-3xl font-black text-orange-400">{myPlayer.score}</p>
            </div>
            <div className="bg-slate-900 p-4 rounded-2xl">
              <p className="text-sm text-slate-400 uppercase tracking-wider mb-1">Câu đúng</p>
              <p className="text-3xl font-black text-green-400">{myPlayer.correctAnswers}</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate('/')}
          className="mt-12 px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-full font-bold text-xl backdrop-blur-sm transition"
        >
          VỀ TRANG CHỦ
        </button>
      </div>
    );
  }

  return null;
}
