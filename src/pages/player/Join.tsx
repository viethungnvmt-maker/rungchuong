import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import { LogIn } from 'lucide-react';

const AVATARS = ['😀', '😎', '🤓', '🤠', '👽', '👻', '🤖', '🦊', '🐱', '🐶'];

export default function PlayerJoin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPin = useMemo(() => (searchParams.get('pin') || '').toUpperCase(), [searchParams]);
  const [pin, setPin] = useState(initialPin);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || !name) return alert('Vui lòng nhập đủ thông tin!');
    
    // Pass state to the room component
    navigate(`/play/${pin}`, { state: { name, avatar } });
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="bg-gradient-to-r from-orange-500 to-yellow-500 p-8 text-center text-white">
          <h1 className="text-3xl font-black drop-shadow-md">THAM GIA GAME</h1>
          <p className="opacity-90 mt-2">Nhập mã phòng để bắt đầu</p>
        </div>

        <form onSubmit={handleJoin} className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Mã phòng (PIN)</label>
            <input
              type="text"
              value={pin}
              onChange={e => setPin(e.target.value.toUpperCase())}
              placeholder="VD: 123456"
              maxLength={6}
              className="w-full text-center text-4xl font-black tracking-widest p-4 bg-slate-100 border-2 border-slate-200 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 outline-none transition uppercase"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Tên của bạn</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nhập tên..."
              maxLength={20}
              className="w-full text-xl font-bold p-4 bg-slate-100 border-2 border-slate-200 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Chọn Avatar</label>
            <div className="flex flex-wrap gap-3 justify-center">
              {AVATARS.map(a => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAvatar(a)}
                  className={`text-4xl p-2 rounded-2xl transition transform hover:scale-110 ${avatar === a ? 'bg-orange-100 ring-4 ring-orange-500 scale-110' : 'bg-slate-50 hover:bg-slate-100'}`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xl shadow-lg flex items-center justify-center gap-3 transform transition hover:-translate-y-1"
          >
            <LogIn size={24} />
            VÀO PHÒNG
          </button>
        </form>
      </motion.div>
    </div>
  );
}
