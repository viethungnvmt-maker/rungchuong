import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const db = new Database('game.db');

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT,
    difficulty TEXT,
    type TEXT,
    content TEXT,
    options TEXT,
    correctAnswer INTEGER,
    explanation TEXT,
    points INTEGER
  );
`);

// Insert some default questions if empty
const count = db.prepare('SELECT COUNT(*) as count FROM questions').get() as { count: number };
if (count.count === 0) {
  const insert = db.prepare(`
    INSERT INTO questions (subject, difficulty, type, content, options, correctAnswer, explanation, points)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insert.run('Toán học', 'easy', 'multiple_choice', '2 + 2 = ?', JSON.stringify(['3', '4', '5', '6']), 1, '2 + 2 = 4 là phép tính cơ bản', 100);
  insert.run('Khoa học', 'medium', 'multiple_choice', 'Hành tinh nào lớn nhất Hệ Mặt Trời?', JSON.stringify(['Trái Đất', 'Sao Thổ', 'Sao Mộc', 'Sao Hỏa']), 2, 'Sao Mộc là hành tinh lớn nhất trong Hệ Mặt Trời', 100);
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  }
});

app.use(express.json());

// API Routes
app.get('/api/questions', (req, res) => {
  const questions = db.prepare('SELECT * FROM questions').all();
  res.json(questions.map((q: any) => ({
    ...q,
    options: JSON.parse(q.options)
  })));
});

app.post('/api/questions', (req, res) => {
  const { subject, difficulty, type, content, options, correctAnswer, explanation, points } = req.body;
  const insert = db.prepare(`
    INSERT INTO questions (subject, difficulty, type, content, options, correctAnswer, explanation, points)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = insert.run(subject, difficulty, type, content, JSON.stringify(options), correctAnswer, explanation, points);
  res.json({ id: info.lastInsertRowid });
});

app.post('/api/generate-questions', async (req, res) => {
  const { topic, count, difficulty } = req.body;
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `Tạo ${count} câu hỏi trắc nghiệm về chủ đề "${topic}" với độ khó ${difficulty}.
Yêu cầu:
- Mỗi câu có 4 đáp án
- Chỉ 1 đáp án đúng
- Phù hợp với học sinh THCS/THPT
- Có giải thích ngắn gọn

Trả về JSON format:
[
  {
    "content": "Câu hỏi...",
    "options": ["A", "B", "C", "D"],
    "correctAnswer": 0,
    "explanation": "Giải thích..."
  }
]`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const generated = JSON.parse(response.text || '[]');
    
    // Save to DB
    const insert = db.prepare(`
      INSERT INTO questions (subject, difficulty, type, content, options, correctAnswer, explanation, points)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const savedQuestions = [];
    for (const q of generated) {
      const info = insert.run(topic, difficulty, 'multiple_choice', q.content, JSON.stringify(q.options), q.correctAnswer, q.explanation, 100);
      savedQuestions.push({
        id: info.lastInsertRowid,
        subject: topic,
        difficulty,
        type: 'multiple_choice',
        content: q.content,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        points: 100
      });
    }

    res.json(savedQuestions);
  } catch (error: any) {
    console.error('AI Generation Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Game State
interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
  correctAnswers: number;
  isEliminated: boolean;
  socketId: string;
}

interface Room {
  id: string;
  pin: string;
  hostSocketId: string;
  questions: any[];
  settings: {
    timePerQuestion: number;
    eliminationMode: boolean;
    speedBonus: boolean;
  };
  status: 'waiting' | 'playing' | 'finished';
  players: Player[];
  currentQuestionIndex: number;
  answers: Record<string, number>; // socketId -> answer index
  answerTimes: Record<string, number>; // socketId -> time taken
  questionStartTime: number;
}

const rooms: Record<string, Room> = {};

function generatePin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Host Events
  socket.on('host:createRoom', (data, callback) => {
    const pin = generatePin();
    rooms[pin] = {
      id: `room_${Date.now()}`,
      pin,
      hostSocketId: socket.id,
      questions: data.questions,
      settings: data.settings,
      status: 'waiting',
      players: [],
      currentQuestionIndex: -1,
      answers: {},
      answerTimes: {},
      questionStartTime: 0
    };
    socket.join(pin);
    callback({ pin });
  });

  socket.on('host:startGame', (pin) => {
    const room = rooms[pin];
    if (room && room.hostSocketId === socket.id) {
      room.status = 'playing';
      io.to(pin).emit('game:started');
    }
  });

  socket.on('host:nextQuestion', (pin) => {
    const room = rooms[pin];
    if (room && room.hostSocketId === socket.id) {
      room.currentQuestionIndex++;
      room.answers = {};
      room.answerTimes = {};
      room.questionStartTime = Date.now();
      
      if (room.currentQuestionIndex < room.questions.length) {
        const q = room.questions[room.currentQuestionIndex];
        io.to(pin).emit('game:question', {
          index: room.currentQuestionIndex,
          total: room.questions.length,
          content: q.content,
          options: q.options,
          timeLimit: room.settings.timePerQuestion
        });
      } else {
        room.status = 'finished';
        io.to(pin).emit('game:finished', { players: room.players });
      }
    }
  });

  socket.on('host:showAnswer', (pin) => {
    const room = rooms[pin];
    if (room && room.hostSocketId === socket.id) {
      const q = room.questions[room.currentQuestionIndex];
      const correctIndex = q.correctAnswer;
      
      // Calculate scores
      room.players.forEach(p => {
        if (p.isEliminated) return;
        
        const answer = room.answers[p.socketId];
        if (answer === correctIndex) {
          p.correctAnswers++;
          let points = q.points || 100;
          if (room.settings.speedBonus) {
            const timeTaken = room.answerTimes[p.socketId] || room.settings.timePerQuestion * 1000;
            const timeRatio = Math.max(0, 1 - (timeTaken / (room.settings.timePerQuestion * 1000)));
            points += Math.floor(timeRatio * 50); // Up to 50 bonus points
          }
          p.score += points;
        } else if (room.settings.eliminationMode) {
          p.isEliminated = true;
        }
      });
      
      // Sort players by score
      room.players.sort((a, b) => b.score - a.score);

      io.to(pin).emit('game:answerResult', {
        correctAnswer: correctIndex,
        explanation: q.explanation,
        players: room.players,
        answers: room.answers
      });
    }
  });

  // Player Events
  socket.on('player:joinRoom', (data, callback) => {
    const { pin, name, avatar } = data;
    const room = rooms[pin];
    
    if (!room) {
      return callback({ error: 'Phòng không tồn tại' });
    }
    if (room.status !== 'waiting') {
      return callback({ error: 'Game đã bắt đầu' });
    }

    const player: Player = {
      id: `player_${Date.now()}`,
      name,
      avatar,
      score: 0,
      correctAnswers: 0,
      isEliminated: false,
      socketId: socket.id
    };

    room.players.push(player);
    socket.join(pin);
    
    // Notify host
    io.to(room.hostSocketId).emit('host:playerJoined', room.players);
    
    callback({ success: true, player });
  });

  socket.on('player:submitAnswer', (data) => {
    const { pin, answerIndex } = data;
    const room = rooms[pin];
    if (room && room.status === 'playing') {
      const player = room.players.find(p => p.socketId === socket.id);
      if (player && !player.isEliminated && room.answers[socket.id] === undefined) {
        room.answers[socket.id] = answerIndex;
        room.answerTimes[socket.id] = Date.now() - room.questionStartTime;
        
        // Notify host to update chart
        io.to(room.hostSocketId).emit('host:answerSubmitted', {
          answers: room.answers
        });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Handle player disconnect
    for (const pin in rooms) {
      const room = rooms[pin];
      const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        io.to(room.hostSocketId).emit('host:playerLeft', room.players);
      }
    }
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
