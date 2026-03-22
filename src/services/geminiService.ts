import { GoogleGenAI } from '@google/genai';

// Thứ tự fallback model theo LỆNH.md
const MODEL_FALLBACK_ORDER = [
  'gemini-2.5-flash',
  'gemini-3-flash-preview',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
];

export interface GeneratedQuestion {
  content: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty?: string;
}

export async function generateQuestions(
  apiKey: string,
  topic: string,
  count: number,
  difficulty: string
): Promise<GeneratedQuestion[]> {
  const difficultyText = difficulty === 'mixed'
    ? 'hỗn hợp (bao gồm cả dễ, trung bình và khó)'
    : difficulty === 'easy' ? 'dễ' : difficulty === 'medium' ? 'trung bình' : 'khó';

  const prompt = `Tạo ${count} câu hỏi trắc nghiệm về chủ đề "${topic}" với độ khó ${difficultyText}.
Yêu cầu:
- Mỗi câu có 4 đáp án
- Chỉ 1 đáp án đúng
- Phù hợp với học sinh THCS/THPT
- Có giải thích ngắn gọn
- Giữ nguyên công thức toán dạng LaTeX $...$

Trả về JSON format:
[
  {
    "content": "Câu hỏi...",
    "options": ["A", "B", "C", "D"],
    "correctAnswer": 0,
    "explanation": "Giải thích...",
    "difficulty": "easy|medium|hard"
  }
]`;

  const ai = new GoogleGenAI({ apiKey });

  // Thử từng model theo thứ tự fallback
  for (let i = 0; i < MODEL_FALLBACK_ORDER.length; i++) {
    const model = MODEL_FALLBACK_ORDER[i];
    try {
      console.log(`[GeminiService] Đang thử model: ${model}`);
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text || '[]';
      const generated: GeneratedQuestion[] = JSON.parse(text);
      console.log(`[GeminiService] Thành công với model: ${model}`);
      return generated;
    } catch (error: any) {
      console.warn(`[GeminiService] Model ${model} thất bại:`, error.message);

      // Nếu là model cuối cùng, throw error
      if (i === MODEL_FALLBACK_ORDER.length - 1) {
        // Kiểm tra lỗi hết quota
        if (
          error.message?.includes('quota') ||
          error.message?.includes('429') ||
          error.message?.includes('RESOURCE_EXHAUSTED')
        ) {
          throw new Error(
            'API Key đã hết quota! Vui lòng lấy API key từ một Gmail khác tại https://aistudio.google.com/api-keys hoặc chờ đến ngày mai để sử dụng tiếp.'
          );
        }
        throw new Error(`Tất cả model đều thất bại. Lỗi cuối: ${error.message}`);
      }
      // Tiếp tục thử model tiếp theo
    }
  }

  return [];
}
