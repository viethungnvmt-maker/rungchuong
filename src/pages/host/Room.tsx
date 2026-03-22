import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Play, Trophy, Clock, CheckCircle2, ArrowRight, Ban } from 'lucide-react';
import MathText from '../../components/MathText';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend
} from 'chart.js';
import confetti from 'canvas-confetti';
import { useGame } from '../../contexts/GameContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function HostRoom() {
  const { pin } = useParams();
  const navigate = useNavigate();
  const {
    room, players, gameState, currentQuestion, answerResult, answers,
    startGame, nextQuestion, showAnswer,
  } = useGame();

  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * FIX BUG 3: Dùng ref để tránh stale closure khi gọi showAnswer từ setInterval.
   * showAnswer từ useGame() thay đổi reference mỗi lần re-render,
   * nhưng interval callback chỉ capture version đầu tiên.
   * Giải pháp: luôn gọi qua showAnswerRef.current.
   */
  const showAnswerRef = useRef(showAnswer);
  showAnswerRef.current = showAnswer;

  /**
   * FIX BUG 4: Tách timer và "auto show khi tất cả trả lời" thành 2 useEffect riêng.
   * Dùng timerDoneRef để tránh showAnswer() bị gọi 2 lần.
   */
  const showAnswerCalledRef = useRef(false);

  const triggerShowAnswer = useCallback(() => {
    if (showAnswerCalledRef.current) return;
    showAnswerCalledRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    showAnswerRef.current();
  }, []);

  // Reset khi câu hỏi mới
  useEffect(() => {
    if (gameState === 'playing' && currentQuestion) {
      showAnswerCalledRef.current = false;
      setTimeLeft(currentQuestion.timeLimit);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            // FIX: Không gọi showAnswer trong setInterval callback.
            // Dùng flag và gọi từ ngoài.
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState, currentQuestion]);

  // FIX BUG 3: Effect riêng theo dõi timeLeft === 0 để gọi showAnswer
  useEffect(() => {
    if (gameState === 'playing' && timeLeft === 0 && currentQuestion) {
      // Chỉ trigger khi timer thực sự đếm về 0 (không phải lúc khởi tạo)
      const timer = setTimeout(() => triggerShowAnswer(), 100);
      return () => clearTimeout(timer);
    }
  }, [timeLeft, gameState, currentQuestion, triggerShowAnswer]);

  // FIX BUG 4: Auto show khi tất cả đã trả lời (effect riêng)
  useEffect(() => {
    if (gameState !== 'playing' || players.length === 0) return;
    const activePlayers = players.filter(p => !p.isEliminated);
    if (activePlayers.length > 0 && Object.keys(answers).length >= activePlayers.length) {
      triggerShowAnswer();
    }
  }, [answers, players, gameState, triggerShowAnswer]);

  const getChartData = () => {
    if (!currentQuestion) return null;
    const counts = [0, 0, 0, 0];
    Object.values(answers).forEach((ans: any) => {
      if (typeof ans === 'number' && ans >= 0 && ans < 4) counts[ans]++;
    });
    return {
      labels: ['A', 'B', 'C', 'D'],
      datasets: [{
        label: 'Số người chọn',
        data: counts,
        backgroundColor: [
          'rgba(239,68,68,0.8)', 'rgba(59,130,246,0.8)',
          'rgba(234,179,8,0.8)', 'rgba(34,197,94,0.8)',
        ],
        borderRadius: 8,
      }],
    };
  };

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
  };

  const joinUrl = `${window.location.origin}/play/${pin}`;

  useEffect(() => {
    if (gameState === 'finished') {
      confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } });
    }
  }, [gameState]);

  const getLeaderboard = () => [...players].sort((a, b) => b.score - a.score);

  const getAnsweredPlayers = () =>
    players.filter(p => !p.isEliminated).map(p => ({
      ...p,
      hasAnswered: answers[p.tabId] !== undefined,
    }));

  // ===== WAITING =====
  if (gameState === 'waiting' || gameState === 'idle') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white">
        <div className="max-w-4xl w-full text-center space-y-8">
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-400">
            RUNG CHUÔNG VÀNG
          </h1>
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col md:flex-row items-center justify-center gap-12 text-slate-800">
            <div className="space-y-4">
              <p className="text-2xl font-bold text-slate-500">MÃ PHÒNG</p>
              <p className="text-8xl font-black tracking-widest text-slate-900">{pin}</p>
              <p className="text-lg text-slate-500">Truy cập <span className="font-bold text-indigo-600">{window.location.origin}/play</span></p>
            </div>
            <div className="hidden md:block w-px h-48 bg-slate-200" />
            <div className="p-4 bg-white rounded-2xl shadow-inner border border-slate-100">
              <QRCodeSVG value={joinUrl} size={200} />
            </div>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3 text-2xl font-bold">
              <Users className="text-orange-400" size={32} />
              <span>{players.length} NGƯỜI CHƠI</span>
            </div>
            <button
              onClick={startGame}
              disabled={players.length === 0}
              className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-2xl font-bold text-2xl shadow-lg disabled:opacity-50 flex items-center gap-3 transform transition hover:scale-105"
            >
              <Play size={28} /> BẮT ĐẦU
            </button>
          </div>
          <div className="flex flex-wrap gap-4 justify-center mt-8">
            <AnimatePresence>
              {players.map(p => (
                <motion.div
                  key={p.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="px-6 py-3 bg-slate-800 rounded-full font-bold text-lg border border-slate-700 shadow-md flex items-center gap-2"
                >
                  <span className="text-2xl">{p.avatar}</span>
                  {p.name}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  // ===== PLAYING =====
  if (gameState === 'playing' && currentQuestion) {
    const answeredPlayers = getAnsweredPlayers();
    const answeredCount = Object.keys(answers).length;
    const activeCount = players.filter(p => !p.isEliminated).length;

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white shadow-sm p-4 flex justify-between items-center border-b border-slate-200">
          <div className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span className="px-3 py-1 bg-orange-100 text-orange-600 rounded-lg">
              Câu {currentQuestion.index + 1}/{currentQuestion.total}
            </span>
          </div>
          <div className="text-3xl font-black text-slate-800 flex items-center gap-2">
            <Clock className={timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-slate-400'} size={32} />
            <span className={timeLeft <= 5 ? 'text-red-500' : ''}>{timeLeft}</span>
          </div>
          <div className="text-xl font-bold text-slate-600 flex items-center gap-2">
            <Users size={24} />
            {answeredCount} / {activeCount}
          </div>
        </header>

        <main className="flex-1 p-8 max-w-6xl w-full mx-auto flex flex-col items-center justify-center gap-8">
          <div className="w-full bg-white rounded-3xl shadow-sm border border-slate-100 p-6 text-center">
            <MathText
              text={currentQuestion.content}
              tag="div"
              className="text-4xl font-black text-slate-800 leading-snug"
            />
          </div>

          <div className="grid grid-cols-2 gap-6 w-full max-w-4xl">
            {currentQuestion.options.map((opt: string, i: number) => {
              const colors = [
                'bg-red-500 border-red-600',
                'bg-blue-500 border-blue-600',
                'bg-yellow-500 border-yellow-600',
                'bg-green-500 border-green-600',
              ];
              const cleanOpt = opt.replace(/^[A-D][\.\/\)\:\-]\s*/i, '').trim();
              return (
                <div key={i} className={`${colors[i]} text-white p-5 rounded-2xl shadow-lg border-b-8 flex items-center gap-4 font-bold overflow-hidden min-w-0`}>
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0 text-xl font-black">
                    {String.fromCharCode(65 + i)}
                  </div>
                  <MathText text={cleanOpt} className="text-xl leading-snug min-w-0 flex-1" />
                </div>
              );
            })}
          </div>

          <div className="w-full max-w-4xl bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-700 mb-3 flex items-center gap-2">
              <Users size={20} className="text-indigo-500" />
              Trạng thái trả lời ({answeredCount}/{activeCount})
            </h3>
            <div className="flex flex-wrap gap-3">
              {answeredPlayers.map(p => (
                <div key={p.id} className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 font-bold text-sm transition-all ${p.hasAnswered ? 'bg-green-50 border-green-400 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-400 animate-pulse'}`}>
                  <span className="text-lg">{p.avatar}</span>
                  <span>{p.name}</span>
                  {p.hasAnswered && <CheckCircle2 size={16} className="text-green-500" />}
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ===== SHOWING ANSWER =====
  if (gameState === 'showingAnswer' && currentQuestion && answerResult) {
    const chartData = getChartData();
    const leaderboard = getLeaderboard();
    const correctAnswer = answerResult.correctAnswer;
    const advancedPlayers = leaderboard.filter(p => !p.isEliminated);
    const eliminatedPlayers = leaderboard.filter(p => p.isEliminated);
    const justEliminated = eliminatedPlayers.filter(p => {
      const ans = answers[p.tabId];
      return ans !== undefined && ans !== correctAnswer;
    });

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white shadow-sm p-4 flex items-center border-b border-slate-200">
          <div className="text-xl font-bold text-slate-800 shrink-0">
            Kết quả Câu {currentQuestion.index + 1}/{currentQuestion.total}
          </div>
          <div className="flex-1 flex justify-center">
            <button
              onClick={nextQuestion}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md flex items-center gap-2"
            >
              {currentQuestion.index + 1 === currentQuestion.total ? 'XEM KẾT QUẢ CHUNG CUỘC' : 'CÂU TIẾP THEO'}
              <Play size={20} />
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Câu hỏi + Đáp án */}
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <MathText text={currentQuestion.content} tag="div" className="text-xl font-black text-slate-800 leading-snug" />
            </div>
            <div className="grid grid-cols-1 gap-3">
              {currentQuestion.options.map((opt: string, i: number) => {
                const isCorrect = i === correctAnswer;
                const cleanOpt = opt.replace(/^[A-D][\.\/\)\:\-]\s*/i, '').trim();
                return (
                  <div key={i} className={`p-3 rounded-xl border-2 flex items-center justify-between ${isCorrect ? 'bg-green-50 border-green-500 text-green-800' : 'bg-white border-slate-200 text-slate-500 opacity-60'}`}>
                    <div className="flex items-center gap-3 font-bold min-w-0 flex-1">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm shrink-0 ${isCorrect ? 'bg-green-500' : 'bg-slate-300'}`}>
                        {String.fromCharCode(65 + i)}
                      </div>
                      <MathText text={cleanOpt} className="min-w-0 flex-1" />
                    </div>
                    {isCorrect && <CheckCircle2 className="text-green-500 shrink-0" size={24} />}
                  </div>
                );
              })}
            </div>
            {answerResult.explanation && (
              <div className="p-4 bg-blue-50 text-blue-800 rounded-xl border border-blue-200">
                <p className="font-bold mb-1">Giải thích:</p>
                <MathText text={answerResult.explanation} tag="p" className="text-sm" />
              </div>
            )}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-sm font-bold text-slate-600 mb-2">Thống kê chọn</h3>
              <div className="h-[180px]">
                {chartData && <Bar data={chartData} options={chartOptions} />}
              </div>
            </div>
          </div>

          {/* Đi tiếp & Bị loại */}
          <div className="space-y-4">
            <div className="bg-green-50 p-4 rounded-2xl border border-green-200">
              <h3 className="text-lg font-bold text-green-700 flex items-center gap-2 mb-3">
                <ArrowRight size={20} /> Đi tiếp ({advancedPlayers.length})
              </h3>
              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {advancedPlayers.map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-green-100">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-black text-green-600 w-6 text-center">{i + 1}</span>
                      <span className="text-xl">{p.avatar}</span>
                      <span className="font-bold text-slate-800">{p.name}</span>
                    </div>
                    <span className="font-black text-green-600">{p.score} đ</span>
                  </div>
                ))}
                {advancedPlayers.length === 0 && (
                  <p className="text-sm text-green-500 text-center py-2">Không có ai đi tiếp</p>
                )}
              </div>
            </div>

            {eliminatedPlayers.length > 0 && (
              <div className="bg-red-50 p-4 rounded-2xl border border-red-200">
                <h3 className="text-lg font-bold text-red-600 flex items-center gap-2 mb-3">
                  <Ban size={20} /> Bị loại ({eliminatedPlayers.length})
                </h3>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {eliminatedPlayers.map(p => {
                    const isJust = justEliminated.some(j => j.id === p.id);
                    return (
                      <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl border ${isJust ? 'bg-red-100 border-red-300 ring-2 ring-red-400' : 'bg-white border-red-100'}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-xl opacity-50">{p.avatar}</span>
                          <span className={`font-bold ${isJust ? 'text-red-700' : 'text-slate-500'}`}>{p.name}</span>
                          {isJust && <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">VỪA LOẠI</span>}
                        </div>
                        <span className="font-bold text-slate-400">{p.score} đ</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Bảng xếp hạng */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 h-fit">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
              <Trophy size={20} className="text-yellow-500" /> Bảng xếp hạng
            </h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {leaderboard.map((p, i) => (
                <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl transition ${p.isEliminated ? 'bg-slate-100 opacity-50' : i === 0 ? 'bg-yellow-50 border border-yellow-300' : i === 1 ? 'bg-slate-50 border border-slate-300' : i === 2 ? 'bg-orange-50 border border-orange-200' : 'bg-white border border-slate-100'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black w-6 text-center text-slate-500">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </span>
                    <span className="text-lg">{p.avatar}</span>
                    <div>
                      <span className={`font-bold text-sm ${p.isEliminated ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{p.name}</span>
                      <span className="block text-xs text-slate-400">{p.correctAnswers} câu đúng</span>
                    </div>
                  </div>
                  <span className={`font-black text-lg ${p.isEliminated ? 'text-slate-400' : 'text-orange-500'}`}>{p.score}</span>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ===== FINISHED =====
  if (gameState === 'finished') {
    const topPlayers = getLeaderboard().slice(0, 10);
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center p-8 text-white">
        <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 mb-12 drop-shadow-lg flex items-center gap-4">
          <Trophy className="text-yellow-400" size={64} />
          BẢNG XẾP HẠNG CHUNG CUỘC
        </h1>
        <div className="w-full max-w-4xl bg-white/10 backdrop-blur-md rounded-3xl p-8 shadow-2xl border border-white/20">
          <div className="space-y-4">
            {topPlayers.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.1 }}
                className={`flex items-center justify-between p-4 rounded-2xl ${i === 0 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-slate-900 scale-105 shadow-xl z-10 relative' : i === 1 ? 'bg-slate-300 text-slate-800' : i === 2 ? 'bg-orange-300 text-slate-800' : p.isEliminated ? 'bg-white/5 text-white/50' : 'bg-white/5 text-white'}`}
              >
                <div className="flex items-center gap-6">
                  <div className="text-3xl font-black w-12 text-center">{i === 0 ? '👑' : i + 1}</div>
                  <div className="text-4xl">{p.avatar}</div>
                  <div>
                    <div className={`text-2xl font-bold ${p.isEliminated ? 'line-through' : ''}`}>{p.name}</div>
                    {p.isEliminated && <span className="text-xs bg-red-500/80 px-2 py-0.5 rounded-full text-white">Đã bị loại</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-black">{p.score}</div>
                  <div className="text-sm opacity-80">{p.correctAnswers} câu đúng</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        <button
          onClick={() => navigate('/host')}
          className="mt-12 px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-full font-bold text-xl backdrop-blur-sm transition"
        >
          QUAY LẠI TRANG CHỦ
        </button>
      </div>
    );
  }

  return null;
}
