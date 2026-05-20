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

// ── Device tokens store (in-memory, replace with DB) ──────
interface DeviceTokenRecord {
  userId: string;
  token: string;
  platform: 'web' | 'mobile-web';
  userAgent?: string;
  registeredAt: string;
  lastSeen: string;
}

const deviceTokens: DeviceTokenRecord[] = [];

// ── Notification preferences (in-memory) ──────────────────
interface NotificationPreferences {
  userId: string;
  enabledNotifications: boolean;
  notificationTypes: {
    tasks: boolean;
    habits: boolean;
    workouts: boolean;
  };
  quietHoursStart?: string;
  quietHoursEnd?: string;
  updatedAt: string;
}

const notificationPreferences: NotificationPreferences[] = [];

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

// ── Notifications Endpoints ────────────────────────────────

/**
 * POST /api/notifications/register-token
 * Register a device token for push notifications
 */
app.post('/api/notifications/register-token', authenticateJWT, (req: Request, res: Response) => {
  try {
    const { userId, token, platform } = req.body;
    const userReq = (req as Request & { user: JWTPayload }).user;

    // Verify user owns this token
    if (userId !== userReq.sub) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check if token already exists
    const existing = deviceTokens.find(dt => dt.token === token);
    if (existing) {
      existing.lastSeen = new Date().toISOString();
      existing.userAgent = req.body.userAgent;
      return res.status(200).json({ success: true, message: 'Token updated' });
    }

    // Register new token
    deviceTokens.push({
      userId,
      token,
      platform: platform || 'web',
      userAgent: req.body.userAgent,
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    });

    console.log(`[Notifications] Device token registered for user ${userId}: ${token.substring(0, 20)}...`);

    res.status(201).json({ success: true, message: 'Device token registered' });
  } catch (error) {
    console.error('[Notifications] Register token error:', error);
    res.status(500).json({ error: 'Failed to register device token' });
  }
});

/**
 * POST /api/notifications/unregister-token
 * Unregister a device token
 */
app.post('/api/notifications/unregister-token', authenticateJWT, (req: Request, res: Response) => {
  try {
    const { userId, token } = req.body;
    const userReq = (req as Request & { user: JWTPayload }).user;

    if (userId !== userReq.sub) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const index = deviceTokens.findIndex(dt => dt.token === token && dt.userId === userId);
    if (index !== -1) {
      deviceTokens.splice(index, 1);
      console.log(`[Notifications] Device token unregistered for user ${userId}`);
    }

    res.status(200).json({ success: true, message: 'Device token unregistered' });
  } catch (error) {
    console.error('[Notifications] Unregister token error:', error);
    res.status(500).json({ error: 'Failed to unregister device token' });
  }
});

/**
 * GET /api/notifications/preferences/:userId
 * Get user's notification preferences
 */
app.get('/api/notifications/preferences/:userId', authenticateJWT, (req: Request, res: Response) => {
  try {
    const userReq = (req as Request & { user: JWTPayload }).user;
    const { userId } = req.params;

    if (userId !== userReq.sub) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    let prefs = notificationPreferences.find(p => p.userId === userId);
    if (!prefs) {
      prefs = {
        userId,
        enabledNotifications: true,
        notificationTypes: {
          tasks: true,
          habits: true,
          workouts: true,
        },
        updatedAt: new Date().toISOString(),
      };
      notificationPreferences.push(prefs);
    }

    res.status(200).json(prefs);
  } catch (error) {
    console.error('[Notifications] Get preferences error:', error);
    res.status(500).json({ error: 'Failed to get notification preferences' });
  }
});

/**
 * PUT /api/notifications/preferences/:userId
 * Update user's notification preferences
 */
app.put('/api/notifications/preferences/:userId', authenticateJWT, (req: Request, res: Response) => {
  try {
    const userReq = (req as Request & { user: JWTPayload }).user;
    const { userId } = req.params;

    if (userId !== userReq.sub) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    let prefs = notificationPreferences.find(p => p.userId === userId);
    if (!prefs) {
      prefs = {
        userId,
        enabledNotifications: true,
        notificationTypes: {
          tasks: true,
          habits: true,
          workouts: true,
        },
        updatedAt: new Date().toISOString(),
      };
      notificationPreferences.push(prefs);
    }

    // Update preferences
    if (req.body.enabledNotifications !== undefined) {
      prefs.enabledNotifications = req.body.enabledNotifications;
    }
    if (req.body.notificationTypes) {
      prefs.notificationTypes = { ...prefs.notificationTypes, ...req.body.notificationTypes };
    }
    if (req.body.quietHoursStart !== undefined) {
      prefs.quietHoursStart = req.body.quietHoursStart;
    }
    if (req.body.quietHoursEnd !== undefined) {
      prefs.quietHoursEnd = req.body.quietHoursEnd;
    }
    prefs.updatedAt = new Date().toISOString();

    res.status(200).json({ success: true, message: 'Preferences updated', data: prefs });
  } catch (error) {
    console.error('[Notifications] Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

/**
 * POST /api/notifications/send
 * Send a notification to user devices (admin/system endpoint)
 */
app.post('/api/notifications/send', authenticateJWT, (req: Request, res: Response) => {
  try {
    const userReq = (req as Request & { user: JWTPayload }).user;
    const { userId, type, title, body, data, notifyAll } = req.body;

    // Only admin or the user can send to themselves
    if (userReq.role !== 'ADMIN' && userId !== userReq.sub) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get user's tokens
    const tokens = deviceTokens.filter(dt => dt.userId === userId);
    if (tokens.length === 0) {
      return res.status(200).json({
        success: false,
        message: 'No device tokens registered for this user',
      });
    }

    // In a real app, you would use Firebase Admin SDK to send to these tokens
    // For now, we'll just simulate the send
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`[Notifications] Sending notification to ${tokens.length} device(s):`);
    console.log(`  Title: ${title}`);
    console.log(`  Body: ${body}`);
    console.log(`  Type: ${type}`);
    console.log(`  Tokens: ${tokens.map(t => t.token.substring(0, 20) + '...').join(', ')}`);

    res.status(200).json({
      success: true,
      messageId,
      message: `Notification queued for ${tokens.length} device(s)`,
      deviceCount: tokens.length,
    });
  } catch (error) {
    console.error('[Notifications] Send notification error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

/**
 * GET /api/notifications/devices/:userId
 * Get list of registered devices for a user (for user/admin viewing)
 */
app.get('/api/notifications/devices/:userId', authenticateJWT, (req: Request, res: Response) => {
  try {
    const userReq = (req as Request & { user: JWTPayload }).user;
    const { userId } = req.params;

    if (userReq.role !== 'ADMIN' && userId !== userReq.sub) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const userDevices = deviceTokens
      .filter(dt => dt.userId === userId)
      .map(dt => ({
        token: dt.token.substring(0, 20) + '...',
        platform: dt.platform,
        registeredAt: dt.registeredAt,
        lastSeen: dt.lastSeen,
      }));

    res.status(200).json({
      userId,
      deviceCount: userDevices.length,
      devices: userDevices,
    });
  } catch (error) {
    console.error('[Notifications] Get devices error:', error);
    res.status(500).json({ error: 'Failed to get devices' });
  }
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
  // Server listening
});

