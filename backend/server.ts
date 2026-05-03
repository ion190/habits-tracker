import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

import type { Habit, HabitLog, Task, JWTPayload, PaginationMeta } from './types.js';

const app = express();
const PORT = 3001;
const JWT_SECRET = 'habits-tracker-super-secret-2026'; // Lab demo only

// In-memory stores (replace with real DB later)
const users: Record<string, { email: string; password: string; role: 'USER' | 'ADMIN' }> = {
  'user_1': { email: 'user@example.com', password: 'password', role: 'USER' },
  'user_2': { email: 'admin@example.com', password: 'password', role: 'ADMIN' },
};

const habits: Habit[] = [
  { id: '1', name: 'Meditation', color: '#6366f1', icon: '🧘', frequency: 'daily', targetDays: [1,2,3,4,5,6,7], tags: [], quota: { type: 'time', target: 10, unit: 'min' }, createdAt: new Date().toISOString() },
  { id: '2', name: 'Read book', color: '#f59e0b', icon: '📖', frequency: 'daily', targetDays: [1,2,3,4,5,6,7], tags: ['growth'], quota: { type: 'time', target: 30, unit: 'min' }, createdAt: new Date().toISOString() },
];

const habitLogs: HabitLog[] = [
  { id: 'log1', habitId: '1', completedAt: new Date(Date.now() - 86400000).toISOString(), value: 12 },
];

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// JWT middleware
const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
(req as Request & {user: JWTPayload}).user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Helper: Paginate array
function paginate<T>(items: T[], limit: number, offset: number): { data: T[]; meta: PaginationMeta } {
  const total = items.length;
  return {
    data: items.slice(offset, offset + limit),
    meta: { total, limit, offset }
  };
}

// ── /token (JWT login) ─────────────────────────────────────
app.post('/token', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const userId = Object.keys(users).find(key => users[key].email === email && users[key].password === password);
  if (!userId) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const user = users[userId];
  const payload: JWTPayload = {
    sub: userId,
    email: user.email,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60  // 60 seconds as per Lab 7
  };

  const token = jwt.sign(payload, JWT_SECRET);
  res.status(200).json({ token });
});

// ── Habits resource (protected) ────────────────────────────
app.get('/habits', authenticateJWT, (req: Request, res: Response) => {
  const limit = parseInt((req.query.limit as string) || '10');
  const offset = parseInt((req.query.offset as string) || '0');

  const result = paginate(habits.filter(h => !h.archivedAt), limit, offset);
  res.status(200).json(result);
});

app.post('/habits', authenticateJWT, (req: Request, res: Response) => {
  const habit: Omit<Habit, 'id' | 'createdAt'> = req.body;
  if (!habit.name) {
    return res.status(400).json({ error: 'Name required' });
  }

  const newHabit: Habit = {
    ...habit,
    id: `habit_${Date.now()}`,
    createdAt: new Date().toISOString()
  };
  habits.push(newHabit);
  res.status(201).json(newHabit);
});

app.get('/habits/:id', authenticateJWT, (req: Request, res: Response) => {
  const habit = habits.find(h => h.id === req.params.id && !h.archivedAt);
  if (!habit) {
    return res.status(404).json({ error: 'Habit not found' });
  }
  res.status(200).json(habit);
});

app.put('/habits/:id', authenticateJWT, (req: Request, res: Response) => {
  const index = habits.findIndex(h => h.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Habit not found' });
  }
  habits[index] = { ...habits[index], ...req.body, updatedAt: new Date().toISOString() };
  res.status(200).json(habits[index]);
});

app.patch('/habits/:id', authenticateJWT, (req: Request, res: Response) => {
  const index = habits.findIndex(h => h.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Habit not found' });
  }
  habits[index] = { ...habits[index], ...req.body };
  res.status(200).json(habits[index]);
});

app.delete('/habits/:id', authenticateJWT, (req: Request, res: Response) => {
  const index = habits.findIndex(h => h.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Habit not found' });
  }
  habits[index].archivedAt = new Date().toISOString();  // Soft delete
  res.status(204).send();
});

// ── Tasks resource ────────────────────────────────────────
app.get('/tasks', authenticateJWT, (req: Request, res: Response) => {
  const limit = parseInt((req.query.limit as string) || '10');
  const offset = parseInt((req.query.offset as string) || '0');
  // Mock tasks data
  const mockTasks: Task[] = [
    { id: 'task1', title: 'Sample Task', createdAt: new Date().toISOString(), tags: [], urgency: 'medium', importance: 'medium' }
  ];
  const result = paginate(mockTasks.filter(t => !t.archivedAt), limit, offset);
  res.status(200).json(result);
});

// ── Root & Swagger ────────────────────────────────────────
app.get('/', (req: Request, res: Response) => {
  res.json({ 
    message: 'Habits Tracker REST API - Lab 7 ✅',
    endpoints: ['/habits', '/tasks', '/token'],
    docs: '/api-docs'
  });
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(
YAML.parseFile('./openapi.yaml')!,
  { customCss: '.swagger-ui .topbar { display: none }' }
));

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found` });
});

app.listen(PORT, () => {
  console.log(`🚀 REST API running at http://localhost:${PORT}`);
  console.log(`📚 Swagger docs: http://localhost:${PORT}/api-docs`);
  console.log(`🔑 Test login: POST /token { "email": "user@example.com", "password": "password" }`);
  console.log(`⏱️  JWT expires in 60 seconds`);
});

