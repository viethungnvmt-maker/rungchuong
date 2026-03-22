import React, { createContext, useContext, useState, useCallback } from 'react';
import { KeyRound, ExternalLink, X } from 'lucide-react';

interface ApiKeyContextType {
  apiKey: string;
  setApiKey: (key: string) => void;
  showSettings: () => void;
  /** Hiện modal yêu cầu API key, trả về key khi user nhập xong, null nếu cancel */
  requestApiKey: () => Promise<string | null>;
}

const ApiKeyContext = createContext<ApiKeyContextType>(null!);

export function useApiKey() {
  return useContext(ApiKeyContext);
}

export function ApiKeyProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKeyState] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [showModal, setShowModal] = useState(false);
  const [inputKey, setInputKey] = useState('');
  const [resolvePromise, setResolvePromise] = useState<((key: string | null) => void) | null>(null);

  const setApiKey = useCallback((key: string) => {
    setApiKeyState(key);
    if (key) {
      localStorage.setItem('gemini_api_key', key);
    } else {
      localStorage.removeItem('gemini_api_key');
    }
  }, []);

  const showSettings = useCallback(() => {
    setInputKey(apiKey);
    setShowModal(true);
    setResolvePromise(null);
  }, [apiKey]);

  /** Yêu cầu API key - hiện modal nếu chưa có key, trả về key */
  const requestApiKey = useCallback((): Promise<string | null> => {
    if (apiKey) return Promise.resolve(apiKey);
    
    return new Promise((resolve) => {
      setInputKey('');
      setShowModal(true);
      setResolvePromise(() => resolve);
    });
  }, [apiKey]);

  const handleSave = () => {
    if (!inputKey.trim()) return;
    setApiKey(inputKey.trim());
    setShowModal(false);
    if (resolvePromise) {
      resolvePromise(inputKey.trim());
      setResolvePromise(null);
    }
  };

  const handleClose = () => {
    setShowModal(false);
    if (resolvePromise) {
      resolvePromise(null);
      setResolvePromise(null);
    }
  };

  return (
    <ApiKeyContext.Provider value={{ apiKey, setApiKey, showSettings, requestApiKey }}>
      {children}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-black flex items-center gap-3">
                  <KeyRound size={28} />
                  Thiết Lập API Key
                </h2>
                <button onClick={handleClose} className="p-2 hover:bg-white/20 rounded-full transition"><X size={20} /></button>
              </div>
              <p className="text-indigo-100 text-sm">
                Nhập Gemini API key để sử dụng tính năng tạo câu hỏi bằng AI
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2">Gemini API Key</label>
                <input
                  type="password"
                  value={inputKey}
                  onChange={e => setInputKey(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  placeholder="AIzaSy..."
                  className="w-full p-4 border-2 border-slate-300 rounded-xl text-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition"
                />
              </div>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium text-sm"
              >
                <ExternalLink size={16} /> Lấy API Key tại Google AI Studio
              </a>
              <button
                onClick={handleSave}
                disabled={!inputKey.trim()}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-lg disabled:opacity-50 transition"
              >
                Lưu API Key
              </button>
            </div>
          </div>
        </div>
      )}
    </ApiKeyContext.Provider>
  );
}
