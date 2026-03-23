import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Play, Sparkles, BookOpen, Settings, Trash2, Pencil, X, Tag, Upload, FileText, Loader2 } from 'lucide-react';
import { useApiKey } from '../../contexts/ApiKeyContext';
import { useGame } from '../../contexts/GameContext';
import { getAllQuestions, addQuestions, deleteQuestion, deleteAllQuestions, deleteQuestionsBySubject, updateQuestion, getSubjects, addSubject, removeSubject } from '../../services/gameStore';
import { generateQuestions } from '../../services/geminiService';
import { extractTextFromFile, parseQuestionsFromText } from '../../services/fileParser';
import type { Question } from '../../services/gameStore';
import MathText from '../../components/MathText';

// ===== Edit Question Modal =====
function EditQuestionModal({ question, subjects, onSave, onClose }: {
  question: Question;
  subjects: string[];
  onSave: (q: Question) => void;
  onClose: () => void;
}) {
  const [content, setContent] = useState(question.content);
  const [options, setOptions] = useState([...question.options]);
  const [correctAnswer, setCorrectAnswer] = useState(question.correctAnswer);
  const [explanation, setExplanation] = useState(question.explanation);
  const [subject, setSubject] = useState(question.subject);
  const [difficulty, setDifficulty] = useState(question.difficulty);

  const handleSave = () => {
    if (!content.trim()) return alert('Vui lòng nhập câu hỏi!');
    onSave({ ...question, content, options, correctAnswer, explanation, subject, difficulty });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-5 text-white flex items-center justify-between rounded-t-3xl">
          <h2 className="text-xl font-black flex items-center gap-2"><Pencil size={22} /> Sửa Câu Hỏi</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Môn</label>
              <select value={subject} onChange={e => setSubject(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm">
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Độ khó</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm">
                <option value="easy">Dễ</option>
                <option value="medium">Trung bình</option>
                <option value="hard">Khó</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Câu hỏi (hỗ trợ $công thức$)</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={3}
              className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" />
            {content.includes('$') && (
              <div className="mt-1 p-2 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                <span className="text-xs text-slate-400 block mb-1">Xem trước:</span>
                <MathText text={content} className="text-slate-800" />
              </div>
            )}
          </div>
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <button type="button" onClick={() => setCorrectAnswer(i)}
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition ${i === correctAnswer ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500 hover:bg-green-100'}`}>
                {String.fromCharCode(65 + i)}
              </button>
              <input value={opt} onChange={e => { const newOpts = [...options]; newOpts[i] = e.target.value; setOptions(newOpts); }}
                className="flex-1 p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder={`Đáp án ${String.fromCharCode(65 + i)}`} />
            </div>
          ))}
          <p className="text-xs text-green-600 font-medium">✅ Nhấn vào chữ cái (A/B/C/D) để chọn đáp án đúng</p>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Giải thích</label>
            <textarea value={explanation} onChange={e => setExplanation(e.target.value)} rows={2}
              className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 bg-slate-200 text-slate-700 rounded-xl font-bold">Hủy</button>
            <button onClick={handleSave} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition">Lưu</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Subject Manager Modal =====
function SubjectManagerModal({ subjects, onUpdate, onClose }: {
  subjects: string[];
  onUpdate: (subjects: string[]) => void;
  onClose: () => void;
}) {
  const [newSubject, setNewSubject] = useState('');

  const handleAdd = () => {
    const trimmed = newSubject.trim();
    if (!trimmed) return;
    if (subjects.includes(trimmed)) return alert('Môn học đã tồn tại!');
    const updated = addSubject(trimmed);
    onUpdate(updated);
    setNewSubject('');
  };

  const handleRemove = (name: string) => {
    if (!confirm(`Xóa môn "${name}"? Các câu hỏi thuộc môn này sẽ KHÔNG bị xóa.`)) return;
    const updated = removeSubject(name);
    onUpdate(updated);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-5 text-white flex items-center justify-between rounded-t-3xl">
          <h2 className="text-xl font-black flex items-center gap-2"><Tag size={22} /> Quản Lý Môn Học</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            <input value={newSubject} onChange={e => setNewSubject(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Nhập tên môn học mới..."
              className="flex-1 p-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            <button onClick={handleAdd} className="px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition">
              <Plus size={20} />
            </button>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {subjects.map(s => (
              <div key={s} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 group">
                <span className="font-medium text-slate-700">{s}</span>
                <button onClick={() => handleRemove(s)}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition opacity-0 group-hover:opacity-100">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <button onClick={onClose} className="w-full py-3 bg-slate-200 text-slate-700 rounded-xl font-bold">Đóng</button>
        </div>
      </div>
    </div>
  );
}

// ===== Main Dashboard =====
export default function HostDashboard() {
  const navigate = useNavigate();
  const { apiKey, requestApiKey } = useApiKey();
  const { createRoom } = useGame();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<number[]>([]);
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState('medium');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [filterSubject, setFilterSubject] = useState<string>('');
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [showSubjectManager, setShowSubjectManager] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState({
    timePerQuestion: 20,
    eliminationMode: true,
    speedBonus: true
  });

  useEffect(() => {
    setQuestions(getAllQuestions());
    setSubjects(getSubjects());
  }, []);

  const filteredQuestions = filterSubject
    ? questions.filter(q => q.subject === filterSubject)
    : questions;

  // === Tạo câu hỏi bằng AI ===
  const generateWithAI = async () => {
    if (!topic) return alert('Vui lòng nhập chủ đề!');
    
    // Yêu cầu API key nếu chưa có
    let key = apiKey;
    if (!key) {
      const result = await requestApiKey();
      if (!result) return; // user cancelled
      key = result;
    }

    setIsGenerating(true);
    try {
      const generated = await generateQuestions(key, topic, count, difficulty);
      const saved = addQuestions(
        generated.map(q => ({
          subject: topic,
          difficulty: q.difficulty || difficulty,
          type: 'multiple_choice',
          content: q.content,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          points: 100,
        }))
      );
      setQuestions(prev => [...prev, ...saved]);
      alert(`✅ Đã tạo ${saved.length} câu hỏi thành công!`);
    } catch (err: any) {
      alert('❌ Lỗi: ' + err.message);
    }
    setIsGenerating(false);
  };

  // === Upload file Word/PDF ===
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Yêu cầu API key nếu chưa có
    let key = apiKey;
    if (!key) {
      const result = await requestApiKey();
      if (!result) return;
      key = result;
    }

    setIsUploading(true);
    setUploadStatus(`Đang đọc file "${file.name}"...`);
    
    try {
      // Bước 1: Đọc text từ file
      const text = await extractTextFromFile(file);
      if (!text.trim()) {
        throw new Error('File không có nội dung hoặc không đọc được.');
      }
      
      setUploadStatus(`Đang phân tích ${text.length} ký tự bằng AI...`);
      
      // Bước 2: Dùng Gemini phân tích
      const parsed = await parseQuestionsFromText(key, text, count, difficulty);
      
      if (parsed.length === 0) {
        throw new Error('Không tìm thấy câu hỏi trắc nghiệm trong file.');
      }

      // Bước 3: Lưu vào store
      const subjectName = topic || file.name.replace(/\.[^.]+$/, '');
      const saved = addQuestions(
        parsed.map(q => ({
          subject: subjectName,
          difficulty: q.difficulty || difficulty,
          type: 'multiple_choice',
          content: q.content,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation || '',
          points: 100,
        }))
      );
      
      setQuestions(prev => [...prev, ...saved]);
      setUploadStatus('');
      alert(`✅ Đã nạp ${saved.length} câu hỏi từ file "${file.name}"!`);
    } catch (err: any) {
      alert('❌ Lỗi: ' + err.message);
      setUploadStatus('');
    }
    
    setIsUploading(false);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreateRoom = async () => {
    if (selectedQuestions.length === 0) return alert('Vui lòng chọn ít nhất 1 câu hỏi!');
    try {
      const selectedQData = questions.filter(q => selectedQuestions.includes(q.id));
      const pin = await createRoom(selectedQData, settings);
      navigate(`/host/room/${pin}`);
    } catch (err: any) {
      console.error('[handleCreateRoom] Error:', err);
      alert(err?.message || 'Không thể tạo phòng. Vui lòng kiểm tra lại cấu hình Firebase.');
    }
  };

  const handleDeleteQuestion = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Xóa câu hỏi này?')) return;
    deleteQuestion(id);
    setQuestions(prev => prev.filter(q => q.id !== id));
    setSelectedQuestions(prev => prev.filter(qId => qId !== id));
  };

  const handleEditQuestion = (q: Question, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingQuestion(q);
  };

  const handleSaveEdit = (updated: Question) => {
    updateQuestion(updated.id, updated);
    setQuestions(prev => prev.map(q => q.id === updated.id ? updated : q));
    setEditingQuestion(null);
  };

  const toggleQuestion = (id: number) => {
    if (selectedQuestions.includes(id)) {
      setSelectedQuestions(selectedQuestions.filter(qId => qId !== id));
    } else {
      setSelectedQuestions([...selectedQuestions, id]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex justify-between items-center flex-wrap gap-4">
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <BookOpen className="text-orange-500" />
            QUẢN LÝ CÂU HỎI
          </h1>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSubjectManager(true)}
              className="px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-md flex items-center gap-2 hover:bg-emerald-700 transition">
              <Tag size={18} /> Môn học
            </button>
            <button onClick={handleCreateRoom} disabled={selectedQuestions.length === 0}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 flex items-center gap-2 hover:scale-105 transition">
              <Play size={20} /> TẠO PHÒNG CHƠI ({selectedQuestions.length})
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel: AI Generator + File Upload + Settings */}
          <div className="space-y-6">
            {/* Upload File */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2 text-purple-600">
                <Upload size={20} /> Tải file đề thi
              </h2>
              <p className="text-sm text-slate-500">
                Tải lên file Word (.docx) hoặc PDF (.pdf) chứa đề và đáp án. AI sẽ tự động trích xuất câu hỏi.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Tên môn / Chủ đề</label>
                <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
                  placeholder="VD: Toán lớp 10, Vật lý, Hóa học..."
                  className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Số câu</label>
                  <input type="number" value={count} onChange={e => setCount(Number(e.target.value))} min="1" max="50"
                    className="w-full p-3 border border-slate-300 rounded-xl" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Độ khó</label>
                  <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl">
                    <option value="mixed">🎲 Hỗn hợp</option>
                    <option value="easy">🟢 Dễ</option>
                    <option value="medium">🟡 Trung bình</option>
                    <option value="hard">🔴 Khó</option>
                  </select>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept=".docx,.pdf" onChange={handleFileUpload} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition">
                {isUploading ? (
                  <><Loader2 size={18} className="animate-spin" /> {uploadStatus}</>
                ) : (
                  <><FileText size={18} /> Chọn file & Nạp câu hỏi</>
                )}
              </button>
            </div>

            {/* AI Generator */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-600">
                <Sparkles size={20} /> Tạo câu hỏi bằng AI
              </h2>
              <p className="text-sm text-slate-500">Nhập chủ đề để AI tự tạo câu hỏi trắc nghiệm mới.</p>
              <button onClick={generateWithAI} disabled={isGenerating || !topic}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition">
                {isGenerating ? (
                  <><Loader2 size={18} className="animate-spin" /> Đang tạo...</>
                ) : (
                  <><Sparkles size={18} /> Tạo {count} câu hỏi bằng AI</>
                )}
              </button>
              {!apiKey && (
                <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">
                  ⚡ API key sẽ được yêu cầu khi bạn nhấn nút tạo câu hỏi
                </p>
              )}
            </div>

            {/* Room Settings */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                <Settings size={20} /> Cài đặt phòng
              </h2>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Thời gian/câu (giây)</label>
                <input type="number" value={settings.timePerQuestion}
                  onChange={e => setSettings({...settings, timePerQuestion: Number(e.target.value)})}
                  className="w-full p-3 border border-slate-300 rounded-xl" />
              </div>
              <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                <input type="checkbox" checked={settings.eliminationMode}
                  onChange={e => setSettings({...settings, eliminationMode: e.target.checked})}
                  className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500" />
                <span className="font-medium text-slate-700">Chế độ loại trực tiếp</span>
              </label>
              <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                <input type="checkbox" checked={settings.speedBonus}
                  onChange={e => setSettings({...settings, speedBonus: e.target.checked})}
                  className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500" />
                <span className="font-medium text-slate-700">Thưởng điểm tốc độ</span>
              </label>
            </div>
          </div>

          {/* Right Panel: Question List */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
              <h2 className="text-xl font-bold text-slate-800">Ngân hàng câu hỏi ({filteredQuestions.length})</h2>
              <div className="flex items-center gap-2">
                <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="">Tất cả môn</option>
                  {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={() => setSelectedQuestions(filteredQuestions.map(q => q.id))}
                  className="text-sm text-indigo-600 font-medium hover:underline whitespace-nowrap">
                  Chọn tất cả
                </button>
                {selectedQuestions.length > 0 && (
                  <button onClick={() => setSelectedQuestions([])}
                    className="text-sm text-red-500 font-medium hover:underline whitespace-nowrap">
                    Bỏ chọn
                  </button>
                )}
                {filteredQuestions.length > 0 && (
                  <button onClick={() => {
                    if (!confirm(filterSubject ? `Bạn có chắc chắn muốn xóa TẤT CẢ câu hỏi môn "${filterSubject}"?` : 'Bạn có chắc chắn muốn xóa TẤT CẢ câu hỏi trong ngân hàng?')) return;
                    if (filterSubject) {
                      deleteQuestionsBySubject(filterSubject);
                      setQuestions(prev => prev.filter(q => q.subject !== filterSubject));
                    } else {
                      deleteAllQuestions();
                      setQuestions([]);
                    }
                    setSelectedQuestions([]);
                  }}
                    className="text-sm px-2 py-1 bg-red-100 text-red-600 rounded-lg font-bold hover:bg-red-200 transition whitespace-nowrap ml-2">
                    Xóa tất cả
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {filteredQuestions.map((q, idx) => (
                <div key={q.id} onClick={() => toggleQuestion(q.id)}
                  className={`p-4 border rounded-xl cursor-pointer transition group ${selectedQuestions.includes(q.id) ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-orange-300'}`}>
                  <div className="flex gap-3">
                    <div className="pt-1">
                      <input type="checkbox" checked={selectedQuestions.includes(q.id)} readOnly
                        className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs font-bold px-2 py-1 bg-slate-200 text-slate-600 rounded-md uppercase">{q.subject}</span>
                        <span className={`text-xs font-bold px-2 py-1 rounded-md uppercase ${q.difficulty === 'easy' ? 'bg-green-100 text-green-700' : q.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                          {q.difficulty === 'easy' ? 'Dễ' : q.difficulty === 'medium' ? 'TB' : 'Khó'}
                        </span>
                        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button onClick={(e) => handleEditQuestion(q, e)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition" title="Sửa">
                            <Pencil size={15} />
                          </button>
                          <button onClick={(e) => handleDeleteQuestion(q.id, e)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Xóa">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                      <h3 className="font-bold text-slate-800 mb-3">
                        <MathText text={`${idx + 1}. ${q.content}`} className="leading-relaxed" />
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        {q.options.map((opt: string, i: number) => {
                          const cleanOpt = opt.replace(/^[A-D][\.\):\/\-]\s*/i, '').trim();
                          return (
                            <div key={i} className={`p-2 rounded-lg text-sm ${i === q.correctAnswer ? 'bg-green-100 border border-green-300 font-medium text-green-800' : 'bg-slate-100 border border-slate-200 text-slate-600'}`}>
                              <MathText text={`${String.fromCharCode(65 + i)}. ${cleanOpt}`} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {filteredQuestions.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <FileText size={48} className="mx-auto mb-4 text-slate-300" />
                  <p className="text-lg font-bold">Chưa có câu hỏi nào</p>
                  <p className="text-sm mt-1">Tải file đề thi hoặc tạo bằng AI ở panel bên trái</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {editingQuestion && (
        <EditQuestionModal
          question={editingQuestion}
          subjects={subjects}
          onSave={handleSaveEdit}
          onClose={() => setEditingQuestion(null)}
        />
      )}
      {showSubjectManager && (
        <SubjectManagerModal
          subjects={subjects}
          onUpdate={setSubjects}
          onClose={() => setShowSubjectManager(false)}
        />
      )}
    </div>
  );
}
