const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();

// Gmail transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((error, success) => {
  if (error) console.error('Email setup error:', error);
  else console.log('Email server ready');
});

// Uploads folder
const uploadsDir = 'uploads';
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

const upload = multer({ storage });

// ==================== MIDDLEWARE ====================

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://system.jimmac.co.za',
  'https://app.jimmac.co.za',
  'https://timesheet-app-fontend.onrender.com',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204
}));

app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// MySQL Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 20110,
  ssl: { rejectUnauthorized: false }
});

db.connect(err => {
  if (err) {
    console.error('MySQL connection failed:', err.message);
  } else {
    console.log('MySQL connected successfully');
  }
});

// Auth middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid or expired token' });
    req.user = decoded;
    next();
  });
};

const restrictTo = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role_id)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
};






// ────────────────────────────────────────────────
// DASHBOARD DATA
// ────────────────────────────────────────────────
app.get('/dashboard-data', authenticate, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  const userId = req.user.id;
  const role_id = req.user.role_id;

  let query = '';
  let params = [];

  if (role_id === 3) {
    query = 'SELECT SUM(total_hours) AS total_hours FROM timesheets WHERE user_id = ? AND status = 1';
    params = [userId];
  } else {
    query = 'SELECT SUM(total_hours) AS total_hours FROM timesheets WHERE status = 1';
  }

  try {
    const [results] = await db.promise().query(query, params);
    const total_hours = results[0]?.total_hours || 0;
    const time_value = total_hours * 50;

    res.json({
      total_production: total_hours,
      time_value,
      funds: role_id === 3 ? time_value : time_value
    });
  } catch (err) {
    console.error('Dashboard error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

// ────────────────────────────────────────────────
// NOTIFICATIONS
// ────────────────────────────────────────────────
app.get('/notifications', authenticate, (req, res) => {
  db.query(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    [req.user.id],
    (err, results) => {
      if (err) {
        console.error('Notifications error:', err.message);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(results || []);
    }
  );
});

// ────────────────────────────────────────────────
// REGISTER
// ────────────────────────────────────────────────
app.post('/register', async (req, res) => {
  const { username, password, role_id } = req.body;

  if (!username || !password || !role_id) {
    return res.status(400).json({ error: 'Username, password, and role required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.query(
      'INSERT INTO users (username, password, role_id) VALUES (?, ?, ?)',
      [username, hashedPassword, role_id],
      (err, result) => {
        if (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Username already exists' });
          }
          return res.status(500).json({ error: 'Database error' });
        }
        res.status(201).json({ message: 'User registered', id: result.insertId });
      }
    );
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ────────────────────────────────────────────────
// LOGIN
// ────────────────────────────────────────────────
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
    if (err) {
      console.error('Login DB error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
    if (results.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role_id: user.role_id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: { id: user.id, username: user.username, role_id: user.role_id }
    });
  });
});

// ────────────────────────────────────────────────
// USER PROFILE (/users/me)
// ────────────────────────────────────────────────
app.get('/users/me', authenticate, async (req, res) => {
  const userId = req.user.id;

  try {
    const [results] = await db.promise().query(
      `SELECT id, username, first_name, last_name, email, phone, role_id,
              employee_id, department, job_title, employment_type, start_date,
              manager_id, leave_balance
       FROM users WHERE id = ?`,
      [userId]
    );

    if (results.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(results[0]);
  } catch (err) {
    console.error('Users/me error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ────────────────────────────────────────────────
// GET SINGLE USER BY ID (authenticated)
// ────────────────────────────────────────────────
app.get('/users/:id', authenticate, (req, res) => {
  const { id } = req.params;
  const currentUserId = req.user.id;
  const currentRole = req.user.role_id;

  db.query(
    `SELECT id, first_name, last_name, username, role_id 
     FROM users WHERE id = ?`,
    [id],
    (err, results) => {
      if (err) {
        console.error('Get user error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (results.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = results[0];

      if (currentRole === 3 && user.role_id === 3 && id !== currentUserId) {
        return res.status(403).json({ error: 'Cannot view other employees' });
      }

      res.json(user);
    }
  );
});

// ────────────────────────────────────────────────
// GET ALL USERS (Admin/Dev only)
// ────────────────────────────────────────────────
app.get('/users', authenticate, restrictTo(1, 2), (req, res) => {
  db.query(
    `SELECT id, username, first_name, last_name, email, phone, role_id,
            employee_id, manager_id, job_title, department, employment_type, start_date
     FROM users ORDER BY id`,
    (err, results) => {
      if (err) {
        console.error('Get all users error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(results || []);
    }
  );
});

// ────────────────────────────────────────────────
// GET MANAGERS (for review on behalf)
// ────────────────────────────────────────────────
app.get('/managers', authenticate, (req, res) => {
  let query = 'SELECT id, first_name, last_name, username, role_id FROM users WHERE role_id IN (1, 2)';
  let params = [];

  if (req.user.role_id === 3) {
    query += ' AND id = (SELECT manager_id FROM users WHERE id = ?)';
    params = [req.user.id];
  }

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('Managers error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results || []);
  });
});

// ────────────────────────────────────────────────
// CREATE USER (Admin/Dev only)
// ────────────────────────────────────────────────
app.post('/users', authenticate, restrictTo(1, 2), async (req, res) => {
  const {
    username, password, first_name, last_name, email, phone,
    role_id, employee_id, manager_id, job_title, department, employment_type, start_date
  } = req.body;

  if (!username || !password || !role_id) {
    return res.status(400).json({ error: 'Username, password, and role required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query(
      `INSERT INTO users 
       (username, password, first_name, last_name, email, phone, role_id, employee_id, manager_id, 
        job_title, department, employment_type, start_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        username, hashedPassword, first_name || null, last_name || null, email || null, phone || null,
        role_id, employee_id || null, manager_id || null, job_title || null, department || null,
        employment_type || 'Full-time', start_date || null
      ],
      (err, result) => {
        if (err) {
          if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Username already exists' });
          console.error('Create user DB error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.status(201).json({ message: 'User created', id: result.insertId });
      }
    );
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ────────────────────────────────────────────────
// UPDATE USER (Admin/Dev)
// ────────────────────────────────────────────────
app.put('/users/:id', authenticate, restrictTo(1, 2), upload.single('avatar'), async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    let fields = [];
    let values = [];

    const allowedFields = [
      'username', 'first_name', 'last_name', 'email', 'phone',
      'job_title', 'department', 'employment_type', 'start_date',
      'manager_id', 'employee_id', 'role_id'
    ];

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(updates[field]);
      }
    });

    if (updates.password) {
      const hashed = await bcrypt.hash(updates.password, 10);
      fields.push('password = ?');
      values.push(hashed);
    }

    if (req.file) {
      fields.push('avatar_url = ?');
      values.push(req.file.path.replace(/^public\//, 'uploads/'));
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    const [result] = await db.promise().query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('Admin user update error:', err);
    res.status(500).json({ error: 'Failed to update user', details: err.message });
  }
});

// ────────────────────────────────────────────────
// SELF-UPDATE PROFILE (/users/me)
// ────────────────────────────────────────────────
app.put('/users/me', authenticate, upload.single('avatar'), async (req, res) => {
  const userId = req.user.id;

  const allowed = {};
  const safeFields = [
    'first_name', 'last_name', 'email', 'phone',
    'job_title', 'department', 'team', 'employment_type', 'start_date'
  ];

  safeFields.forEach(field => {
    if (req.body[field] !== undefined && req.body[field] !== null) {
      allowed[field] = req.body[field];
    }
  });

  if (req.file) {
    allowed.avatar_url = req.file.path.replace(/^public\//, '');
  }

  if (Object.keys(allowed).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  try {
    await db.query('UPDATE users SET ? WHERE id = ?', [allowed, userId]);
    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error('Self-update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ────────────────────────────────────────────────
// TIMESHEET ROUTES (GET, POST, PUT, APPROVE, REJECT, LOCK)
// ────────────────────────────────────────────────

// GET ALL TIMESHEETS (with tasks)
app.get('/timesheets', authenticate, (req, res) => {
  const userId = req.user.id;
  const roleId = req.user.role_id;

  let query = `
    SELECT 
      t.id, t.user_id, t.date, t.status, t.date_submitted, t.locked, t.total_hours,
      t.approved_by, t.review_note,
      CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
      CONCAT(m.first_name, ' ', m.last_name) AS manager_name
    FROM timesheets t
    JOIN users u ON t.user_id = u.id
    LEFT JOIN users m ON u.manager_id = m.id
    ${roleId === 3 ? 'WHERE t.user_id = ?' : ''}
    ORDER BY t.date DESC
  `;

  const params = roleId === 3 ? [userId] : [];

  db.query(query, params, (err, entries) => {
    if (err) {
      console.error('Timesheets fetch error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    const entryIds = entries.map(e => e.id);
    if (entryIds.length === 0) return res.json([]);

    db.query(
      `SELECT id, timesheet_id, title, type, client_project_name AS clientProjectName, project_code AS projectNumber, hours
       FROM timesheet_tasks
       WHERE timesheet_id IN (?)
       ORDER BY id`,
      [entryIds],
      (err, tasks) => {
        if (err) {
          console.error('Tasks fetch error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        const tasksByEntry = {};
        tasks.forEach(t => {
          if (!tasksByEntry[t.timesheet_id]) tasksByEntry[t.timesheet_id] = [];
          tasksByEntry[t.timesheet_id].push({
            id: t.id,
            title: t.title,
            type: t.type,
            clientProjectName: t.clientProjectName,
            projectNumber: t.projectNumber,
            hours: t.hours
          });
        });

        const result = entries.map(entry => ({
          ...entry,
          tasks: tasksByEntry[entry.id] || [],
          totalHours: entry.total_hours || 0,
          manager_name: entry.manager_name || 'Not assigned'
        }));

        res.json(result);
      }
    );
  });
});

// GET SINGLE TIMESHEET
app.get('/timesheets/:id', authenticate, (req, res) => {
  const { id } = req.params;

  db.query(
    `SELECT t.*, CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
            CONCAT(m.first_name, ' ', m.last_name) AS manager_name
     FROM timesheets t
     JOIN users u ON t.user_id = u.id
     LEFT JOIN users m ON u.manager_id = m.id
     WHERE t.id = ?`,
    [id],
    (err, results) => {
      if (err || results.length === 0) return res.status(404).json({ error: 'Timesheet not found' });

      const entry = results[0];

      db.query(
        `SELECT id, title, type, client_project_name AS clientProjectName, project_code AS projectNumber, hours
         FROM timesheet_tasks WHERE timesheet_id = ?`,
        [id],
        (err, tasks) => {
          if (err) return res.status(500).json({ error: 'Database error' });

          res.json({
            ...entry,
            tasks: tasks.map(t => ({
              id: t.id,
              title: t.title,
              type: t.type,
              clientProjectName: t.clientProjectName,
              projectNumber: t.projectNumber,
              hours: t.hours
            })),
            totalHours: entry.total_hours || tasks.reduce((sum, t) => sum + Number(t.hours || 0), 0)
          });
        }
      );
    }
  );
});

// SUBMIT NEW TIMESHEET
app.post('/timesheets', authenticate, upload.single('attachment'), async (req, res) => {
  const userId = req.user.id;
  const { date, tasks } = req.body;
  const attachment_path = req.file ? req.file.path : null;

  if (!date || !tasks) {
    return res.status(400).json({ error: 'Date and tasks are required' });
  }

  let parsedTasks;
  try {
    parsedTasks = JSON.parse(tasks);
    if (!Array.isArray(parsedTasks) || parsedTasks.length === 0) {
      return res.status(400).json({ error: 'Tasks must be a non-empty array' });
    }
  } catch (err) {
    return res.status(400).json({ error: 'Invalid tasks JSON format' });
  }

  const totalHours = parsedTasks.reduce((sum, t) => sum + Number(t.hours || 0), 0);

  try {
    const [result] = await db.promise().query(
      `INSERT INTO timesheets 
       (user_id, date, status, attachment_path, date_submitted, total_hours) 
       VALUES (?, ?, 'pending', ?, NOW(), ?)`,
      [userId, date, attachment_path, totalHours]
    );

    const timesheetId = result.insertId;

    if (parsedTasks.length > 0) {
      const taskValues = parsedTasks.map(t => [
        timesheetId,
        t.description || t.title || 'Untitled task',
        t.projectType || '',
        t.clientProjectName || '',
        t.projectNumber || null,
        Number(t.hours || 0)
      ]);

      await db.promise().query(
        `INSERT INTO timesheet_tasks 
         (timesheet_id, title, type, client_project_name, project_code, hours) 
         VALUES ?`,
        [taskValues]
      );
    }

    res.status(201).json({ message: 'Timesheet submitted successfully', id: timesheetId });
  } catch (err) {
    console.error('Timesheet submission error:', err);
    let userMessage = 'Failed to submit timesheet';

    if (err.code === 'ER_BAD_FIELD_ERROR') {
      userMessage = `Database error: Missing or unknown column (${err.sqlMessage || err.message})`;
    } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      userMessage = 'Invalid user ID or foreign key constraint';
    } else if (err.code === 'ER_TRUNCATED_WRONG_VALUE') {
      userMessage = 'Invalid date format or data type';
    }

    res.status(500).json({ error: userMessage });
  }
});

//Delete users route
app.delete('/users/:id', authenticate, restrictTo(1, 2), async (req, res) => {
  const { id } = req.params;

  try {
    // Prevent deleting yourself
    if (parseInt(id) === req.user.id) {
      return res.status(403).json({ error: 'Cannot delete your own account' });
    }

    const [result] = await db.promise().query('DELETE FROM users WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err.message, err.stack);
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ error: 'Cannot delete user — they have associated records (timesheets, leaves, etc.)' });
    }
    res.status(500).json({ error: 'Failed to delete user' });
  }
});


// UPDATE TIMESHEET (employee edit)
app.put('/timesheets/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { tasks } = req.body;

  if (!Array.isArray(tasks)) return res.status(400).json({ error: 'Tasks must be an array' });

  const totalHours = tasks.reduce((sum, t) => sum + Number(t.hours || 0), 0);

  try {
    const [results] = await db.promise().query('SELECT user_id, locked FROM timesheets WHERE id = ?', [id]);
    if (results.length === 0) return res.status(404).json({ error: 'Timesheet not found' });

    const ts = results[0];
    if (ts.locked && req.user.role_id === 3) {
      return res.status(403).json({ error: 'Timesheet is locked' });
    }
    if (req.user.role_id === 3 && req.user.id !== ts.user_id) {
      return res.status(403).json({ error: 'Not your timesheet' });
    }

    await db.promise().query('UPDATE timesheets SET total_hours = ? WHERE id = ?', [totalHours, id]);
    await db.promise().query('DELETE FROM timesheet_tasks WHERE timesheet_id = ?', [id]);

    const values = tasks.map(t => [
      id,
      t.description || t.title || '',
      t.projectType || t.type || '',
      t.clientProjectName || '',
      t.projectNumber || '',
      t.hours || 0
    ]);

    if (values.length > 0) {
      await db.promise().query(
        `INSERT INTO timesheet_tasks 
         (timesheet_id, title, type, client_project_name, project_code, hours) VALUES ?`,
        [values]
      );
    }

    res.json({ message: 'Timesheet updated' });
  } catch (err) {
    console.error('Update timesheet error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// APPROVE TIMESHEET
app.put('/timesheets/:id/approve', authenticate, restrictTo(1, 2), async (req, res) => {
  const { id } = req.params;
  const { reviewNote, reviewedByManagerId } = req.body || {};
  const approver_id = req.user?.id;

  if (!approver_id) return res.status(401).json({ error: 'Not authenticated' });
  if (!reviewNote?.trim()) return res.status(400).json({ error: 'Review note required' });

  try {
    const [ts] = await db.promise().query(
      'SELECT user_id, date FROM timesheets WHERE id = ? AND status = 0',
      [id]
    );

    if (ts.length === 0) return res.status(404).json({ error: 'Timesheet not found or not pending' });

    const employeeId = ts[0].user_id;
    const timesheetDate = ts[0].date;

    await db.promise().query(
      'UPDATE timesheets SET status = 1, approved_by = ?, approved_at = NOW(), review_note = ? WHERE id = ?',
      [approver_id, reviewNote, id]
    );

    if (reviewedByManagerId) {
      await db.promise().query(
        'UPDATE timesheets SET reviewed_by_manager_id = ? WHERE id = ?',
        [reviewedByManagerId, id]
      );
    }

    const message = `Your timesheet for ${new Date(timesheetDate).toLocaleDateString()} has been approved.\nReview note: ${reviewNote}`;
    await db.promise().query(
      'INSERT INTO notifications (user_id, title, message, related_timesheet_id) VALUES (?, ?, ?, ?)',
      [employeeId, 'Timesheet Approved', message, id]
    );

    res.json({ message: 'Timesheet approved' });
  } catch (err) {
    console.error('Approve error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to approve timesheet' });
  }
});


// REJECT TIMESHEET
app.put('/timesheets/:id/reject', authenticate, restrictTo(1, 2), async (req, res) => {
  const { id } = req.params;
  const { rejectNote } = req.body || {};
  const rejector_id = req.user?.id;

  if (!rejector_id) return res.status(401).json({ error: 'Not authenticated' });
  if (!rejectNote?.trim()) return res.status(400).json({ error: 'Reject reason required' });

  try {
    const [ts] = await db.promise().query(
      'SELECT user_id, date FROM timesheets WHERE id = ? AND status = 0',
      [id]
    );

    if (ts.length === 0) return res.status(404).json({ error: 'Timesheet not found or not pending' });

    const employeeId = ts[0].user_id;
    const timesheetDate = ts[0].date;

    await db.promise().query(
      'UPDATE timesheets SET status = 2, rejected_by = ?, rejected_at = NOW(), reject_note = ? WHERE id = ?',
      [rejector_id, rejectNote, id]
    );

    const message = `Your timesheet for ${new Date(timesheetDate).toLocaleDateString()} has been disapproved.\nReason: ${rejectNote}`;
    await db.promise().query(
      'INSERT INTO notifications (user_id, title, message, related_timesheet_id) VALUES (?, ?, ?, ?)',
      [employeeId, 'Timesheet Disapproved', message, id]
    );

    res.json({ message: 'Timesheet rejected' });
  } catch (err) {
    console.error('Reject error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to reject timesheet' });
  }
});

// LOCK TIMESHEET
app.put('/timesheets/:id/lock', authenticate, restrictTo(1, 2), (req, res) => {
  const { id } = req.params;

  db.query(
    'UPDATE timesheets SET locked = TRUE WHERE id = ?',
    [id],
    (err, result) => {
      if (err || result.affectedRows === 0) {
        return res.status(500).json({ error: 'Failed to lock timesheet' });
      }
      res.json({ message: 'Timesheet locked' });
    }
  );
});

// ────────────────────────────────────────────────
// MESSAGES
// ────────────────────────────────────────────────
app.get('/messages/user/:userId', authenticate, (req, res) => {
  const { userId } = req.params;
  const currentId = req.user.id;

  db.query(
    `SELECT m.*, CONCAT(u.first_name, ' ', u.last_name) AS sender_name
     FROM messages m
     JOIN users u ON m.sender_id = u.id
     WHERE (m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?)
     ORDER BY m.created_at ASC`,
    [currentId, userId, userId, currentId],
    (err, results) => {
      if (err) {
        console.error('Messages fetch error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(results);
    }
  );
});

app.post('/messages', authenticate, (req, res) => {
  const { content, recipientId } = req.body;
  const senderId = req.user.id;

  const insertMessage = () => {
    db.query(
      'INSERT INTO messages (sender_id, recipient_id, content) VALUES (?, ?, ?)',
      [senderId, recipientId, content],
      err => {
        if (err) {
          console.error('Message insert error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Message sent' });
      }
    );
  };

  if (req.user.role_id === 3) {
    db.query('SELECT manager_id FROM users WHERE id = ?', [senderId], (err, results) => {
      if (err || results.length === 0) return res.status(400).json({ error: 'No manager assigned' });
      const managerId = results[0].manager_id;
      if (recipientId !== managerId && ![1,2].includes(recipientId.role_id)) {
        return res.status(403).json({ error: 'Can only message your manager or admins' });
      }
      insertMessage();
    });
  } else {
    insertMessage();
  }
});

// ────────────────────────────────────────────────
// LEAVE ROUTES
// ────────────────────────────────────────────────
app.get('/leave', authenticate, async (req, res) => {
  const userId = req.user.id;
  const roleId = req.user.role_id;
  const targetUserId = req.query.user_id || (roleId === 3 ? userId : null);

  try {
    let query = `
      SELECT l.*, CONCAT(u.first_name, ' ', u.last_name) AS applicant_name,
             DATEDIFF(l.end_date, l.start_date) + 1 AS days_applied
      FROM leave_applications l
      JOIN users u ON l.user_id = u.id
    `;
    let params = [];

    if (roleId === 3) {
      query += ' WHERE l.user_id = ?';
      params.push(userId);
    } else if (targetUserId) {
      query += ' WHERE l.user_id = ?';
      params.push(targetUserId);
    }

    query += ' ORDER BY l.application_date DESC';

    const [results] = await db.promise().query(query, params);

    const pending = results.filter(r => r.status === 'pending');
    const recent = results.slice(0, 10);

    const [balRes] = await db.promise().query(
      'SELECT leave_balance FROM users WHERE id = ?',
      [targetUserId || userId]
    );

    res.json({
      balance: balRes[0]?.leave_balance || 20,
      pending,
      recent,
    });
  } catch (err) {
    console.error('Leave fetch error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/leave', authenticate, upload.single('attachment'), async (req, res) => {
  const userId = req.user.id;
  const { type, startDate, endDate, reason } = req.body;
  const attachment_path = req.file ? req.file.path : null;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

  try {
    const [result] = await db.promise().query(
      'INSERT INTO leave_applications (user_id, type, start_date, end_date, days_applied, reason, attachment_path, application_date) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
      [userId, type, startDate, endDate, days, reason, attachment_path]
    );

    const leaveId = result.insertId;

    // Send email to admins (non-blocking)
    try {
      const [admins] = await db.promise().query(
        'SELECT email, first_name FROM users WHERE role_id IN (1, 2) AND email IS NOT NULL'
      );

      if (admins.length > 0) {
        const employeeName = req.user.first_name && req.user.last_name 
          ? `${req.user.first_name} ${req.user.last_name}` 
          : req.user.username || 'An employee';

        const subject = `New Leave Application Pending Review - ${employeeName}`;
        const text = `A new leave request from ${employeeName} has been submitted.\n\n` +
                     `Type: ${type}\n` +
                     `Dates: ${new Date(startDate).toLocaleDateString('en-ZA')} - ${new Date(endDate).toLocaleDateString('en-ZA')}\n` +
                     `Days: ${days}\n\n` +
                     `Review it here: https://system.jimmac.co.za/leave?review=${leaveId}`;

        const html = `
          <h2>New Leave Application Pending Review</h2>
          <p>A new leave request from <strong>${employeeName}</strong> has been submitted.</p>
          <ul>
            <li><strong>Type:</strong> ${type}</li>
            <li><strong>Dates:</strong> ${new Date(startDate).toLocaleDateString('en-ZA')} - ${new Date(endDate).toLocaleDateString('en-ZA')}</li>
            <li><strong>Days:</strong> ${days}</li>
          </ul>
          <p><a href="https://system.jimmac.co.za/leave?review=${leaveId}" style="color:#f97316; font-weight:bold;">Review Leave Request</a></p>
          <p style="color:#666; font-size:12px;">This is an automated notification from JIMMAC.</p>
        `;

        for (const admin of admins) {
          await transporter.sendMail({
            from: `"JIMMAC System" <${process.env.EMAIL_USER}>`,
            to: admin.email,
            subject,
            text,
            html,
          });
        }

        console.log(`Leave email notifications sent to ${admins.length} admins`);
      }
    } catch (emailErr) {
      console.error('Leave email error (non-blocking):', emailErr);
    }

    res.status(201).json({ message: 'Leave application submitted', id: leaveId });
  } catch (err) {
    console.error('Leave submission error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// APPROVE LEAVE (admin)
app.put('/leave/:id/approve', authenticate, restrictTo(1, 2), async (req, res) => {
  const { id } = req.params;
  const { onBehalfOf } = req.body;
  const approverId = onBehalfOf || req.user.id;

  try {
    const [leave] = await db.promise().query(
      'SELECT user_id, days_applied FROM leave_applications WHERE id = ? AND status = "pending"',
      [id]
    );
    if (leave.length === 0) return res.status(404).json({ error: 'Leave not found or already processed' });

    const { user_id, days_applied } = leave[0];

    await db.promise().query(
      'UPDATE users SET leave_balance = leave_balance - ? WHERE id = ?',
      [days_applied, user_id]
    );

    await db.promise().query(
      'UPDATE leave_applications SET status = "approved", approved_by = ?, approved_at = NOW() WHERE id = ?',
      [approverId, id]
    );

    const message = `Leave application by employee ${user_id} (${days_applied} days) has been APPROVED.`;
    const [admins] = await db.promise().query('SELECT id FROM users WHERE role_id IN (1, 2)');

    const notifyValues = admins.map(a => [a.id, 'Leave Approved', message, id]);

    if (notifyValues.length > 0) {
      await db.promise().query(
        'INSERT INTO notifications (user_id, title, message, related_leave_id) VALUES ?',
        [notifyValues]
      );
    }

    res.json({ message: 'Leave approved' });
  } catch (err) {
    console.error('Approve leave error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// REJECT LEAVE (admin)
app.put('/leave/:id/reject', authenticate, restrictTo(1, 2), async (req, res) => {
  const { id } = req.params;

  try {
    await db.promise().query(
      'UPDATE leave_applications SET status = "rejected", rejected_by = ?, rejected_at = NOW() WHERE id = ? AND status = "pending"',
      [req.user.id, id]
    );

    const [leave] = await db.promise().query(
      'SELECT user_id, days_applied FROM leave_applications WHERE id = ?',
      [id]
    );

    if (leave.length === 0) return res.status(404).json({ error: 'Leave not found' });

    const message = `Leave application by employee ${leave[0].user_id} (${leave[0].days_applied} days) has been REJECTED.`;
    const [admins] = await db.promise().query('SELECT id FROM users WHERE role_id IN (1, 2)');

    const notifyValues = admins.map(a => [a.id, 'Leave Rejected', message, id]);

    if (notifyValues.length > 0) {
      await db.promise().query(
        'INSERT INTO notifications (user_id, title, message, related_leave_id) VALUES ?',
        [notifyValues]
      );
    }

    res.json({ message: 'Leave rejected' });
  } catch (err) {
    console.error('Reject leave error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/test-email', async (req, res) => {
  try {
    await transporter.sendMail({
      from: `"Test" <${process.env.EMAIL_USER}>`,
      to: 'your-personal-email@gmail.com',
      subject: 'Test Email from JIMMAC',
      text: 'This is a test email.',
      html: '<h1>Test Email</h1><p>This is a test from your app.</p>',
    });
    res.send('Test email sent!');
  } catch (err) {
    console.error('Test email failed:', err);
    res.status(500).send('Failed: ' + err.message);
  }
});

// ==================== SERVER START ====================
const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});


// WELCOME EMAIL 
app.post('/send-welcome-email', async (req, res) => {
  const { email, username, password, name } = req.body;

  if (!email || !username || !password) {
    return res.status(400).json({ error: 'Missing email, username, or password' });
  }

  try {
    const loginLink = 'https://system.jimmac.co.za/login';

    const text = `
      Welcome to Jimmac Timesheet, ${name || 'Team Member'}!

      Your account has been created. Here are your login details:

      Username: ${username}
      Password: ${password}

      Login here: ${loginLink}

      Please change your password after first login for security.

      Best regards,
      Jimmac Team
    `;

    const html = `
      <h2 style="color: #f97316;">Welcome to Jimmac Timesheet!</h2>
      <p>Hi ${name || 'Team Member'},</p>
      <p>Your account has been successfully created. Here are your login credentials:</p>
      <div style="background: #f9fafb; padding: 20px; border-radius: 10px; margin: 20px 0;">
        <p><strong>Username:</strong> ${username}</p>
        <p><strong>Password:</strong> ${password}</p>
      </div>
      <p>Login here: <a href="${loginLink}" style="color: #f97316; font-weight: bold;">${loginLink}</a></p>
      <p><small>Please change your password after your first login for security.</small></p>
      <p>Best regards,<br/>Jimmac Team</p>
    `;

    await transporter.sendMail({
      from: `"JIMMAC System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Welcome to Jimmac Timesheet - Your Account Details',
      text,
      html,
    });

    res.json({ message: 'Welcome email sent' });
  } catch (err) {
    console.error('Welcome email error:', err);
    res.status(500).json({ error: 'Failed to send welcome email' });
  }
});