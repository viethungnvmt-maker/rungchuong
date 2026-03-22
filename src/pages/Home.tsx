import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Play, Users } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative">
      <div className="max-w-lg w-full text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* GAME label */}
          <p className="text-lg font-bold tracking-[0.4em] text-slate-400 uppercase mb-2">
            Game
          </p>

          {/* Title - one line */}
          <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-400 mb-3 drop-shadow-lg whitespace-nowrap">
            RUNG CHUÔNG VÀNG
          </h1>

          {/* Author */}
          <p className="text-sm text-slate-400 mb-10">
            Phát triển bởi <span className="text-white font-medium">Trần Hoài Thanh</span>
          </p>
          
          <div className="space-y-4">
            <button
              onClick={() => navigate('/play')}
              className="w-full py-4 px-6 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white rounded-2xl font-bold text-xl shadow-lg transform transition hover:scale-105 flex items-center justify-center gap-3"
            >
              <Play size={28} />
              VÀO CHƠI NGAY
            </button>
            
            <button
              onClick={() => navigate('/host')}
              className="w-full py-4 px-6 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold text-xl shadow-lg transform transition hover:scale-105 flex items-center justify-center gap-3 border border-slate-700"
            >
              <Users size={28} />
              GIÁO VIÊN / TẠO PHÒNG
            </button>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 left-0 right-0 text-center">
        <p className="text-sm text-slate-500">
          Các tool AI dành cho giáo viên có tại:{' '}
          <a
            href="https://giaovienai.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400 hover:text-orange-300 underline underline-offset-2 transition-colors"
          >
            giaovienai.vercel.app
          </a>
        </p>
      </div>
    </div>
  );
}
