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



const axios = require('axios');
async function sendBrevoEmail(to, subject, htmlContent) {
  try {
    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: { name: 'JIMMAC Timesheet', email: 'noreply@jimmac.co.za' },
        to: [{ email: to }],
        subject,
        htmlContent,
      },
      {
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Brevo API email sent:', response.data);
    return true;
  } catch (err) {
    console.error('Brevo API error:', err.response?.data || err.message);
    throw err;
  }
}


const app = express();

// Gmail transporter
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,  // STARTTLS
  auth: {
    user: 'apikey',  // always 'apikey' for Brevo
    pass: process.env.BREVO_SMTP_KEY
  },
  tls: {
    rejectUnauthorized: false  // helpful for self-signed certs
  }
});

// Verify on startup (optional but useful)
transporter.verify((error, success) => {
  if (error) {
    console.error('Brevo SMTP setup error:', error.message);
  } else {
    console.log('Brevo SMTP ready');
  }
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

// MySQL Connection Pool
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 20110,
  ssl: { rejectUnauthorized: false },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
});

// Global error handler for pool
db.on('error', (err) => {
  console.error('MySQL pool error:', err.message);
  if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
    console.log('MySQL connection lost - pool will auto-reconnect');
  }
});

// Optional startup test
db.getConnection((err, connection) => {
  if (err) {
    console.error('Initial pool test failed:', err.message);
  } else {
    console.log('MySQL pool ready');
    connection.release();
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
app.get('/managers', authenticate, async (req, res) => {
  try {
    let query = 'SELECT id, first_name, last_name, username, role_id FROM users WHERE role_id IN (1, 2)';
    let params = [];

    if (req.user.role_id === 3) {
      query += ' AND id = (SELECT manager_id FROM users WHERE id = ?)';
      params = [req.user.id];
    }

    const [results] = await db.promise().query(query, params);
    res.json(results || []);
  } catch (err) {
    console.error('Managers fetch error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to fetch managers' });
  }
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
app.get('/timesheets', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const roleId = req.user.role_id;

    let query = `
      SELECT t.id, t.user_id, t.date, t.status, t.date_submitted, t.locked, t.total_hours,
             CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
             CONCAT(m.first_name, ' ', m.last_name) AS manager_name
      FROM timesheets t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN users m ON u.manager_id = m.id
    `;
    let params = [];

    if (roleId === 3) {
      query += ' WHERE t.user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY t.date DESC';

    const [entries] = await db.promise().query(query, params);

    if (entries.length === 0) return res.json([]);

    const entryIds = entries.map(e => e.id);

    const [tasks] = await db.promise().query(
      'SELECT * FROM timesheet_tasks WHERE timesheet_id IN (?) ORDER BY id',
      [entryIds]
    );

    const tasksByEntry = {};
    tasks.forEach(t => {
      if (!tasksByEntry[t.timesheet_id]) tasksByEntry[t.timesheet_id] = [];
      tasksByEntry[t.timesheet_id].push(t);
    });

    const result = entries.map(entry => ({
      ...entry,
      tasks: tasksByEntry[entry.id] || [],
      totalHours: entry.total_hours || 0
    }));

    res.json(result);
  } catch (err) {
    console.error('Timesheets fetch error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to fetch timesheets' });
  }
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
  console.log('HIT APPROVE ROUTE for timesheet', req.params.id);
  const { id } = req.params;
  const { reviewNote, reviewedByManagerId } = req.body || {};
  const approver_id = req.user?.id;

  if (!approver_id) return res.status(401).json({ error: 'Not authenticated' });
  if (!reviewNote?.trim()) return res.status(400).json({ error: 'Review note required' });

  try {
    const [tsRows] = await db.promise().query(
      "SELECT user_id, date FROM timesheets WHERE id = ? AND status = 'pending'",
      [id]
    );

    if (tsRows.length === 0) {
      return res.status(404).json({ error: 'Timesheet not found or not pending' });
    }

    const employeeId = tsRows[0].user_id;
    const timesheetDate = tsRows[0].date;

    await db.promise().query(
      "UPDATE timesheets SET status = 'approved', approved_by = ?, approved_at = NOW(), review_note = ? WHERE id = ?",
      [approver_id, reviewNote, id]
    );

    if (reviewedByManagerId) {
      await db.promise().query(
        'UPDATE timesheets SET reviewed_by_manager_id = ? WHERE id = ?',
        [reviewedByManagerId, id]
      );
    }

    const message = `Your timesheet for ${new Date(timesheetDate).toLocaleDateString()} has been APPROVED.\nReview note: ${reviewNote}`;
    await db.promise().query(
      'INSERT INTO notifications (user_id, title, message, related_timesheet_id) VALUES (?, ?, ?, ?)',
      [employeeId, 'Timesheet Approved', message, id]
    );

    res.json({ message: 'Timesheet approved successfully' });
  } catch (err) {
    console.error('Approve error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to approve timesheet' });
  }
});


// REJECT TIMESHEET
app.put('/timesheets/:id/reject', authenticate, restrictTo(1, 2), async (req, res) => {
  console.log('HIT REJECT ROUTE for timesheet', req.params.id);
  const { id } = req.params;
  const { rejectNote } = req.body || {};
  const rejector_id = req.user?.id;

  if (!rejector_id) return res.status(401).json({ error: 'Not authenticated' });
  if (!rejectNote?.trim()) return res.status(400).json({ error: 'Reject note required' });

  try {
    const [tsRows] = await db.promise().query(
      "SELECT user_id, date FROM timesheets WHERE id = ? AND status = 'pending'",
      [id]
    );

    if (tsRows.length === 0) {
      return res.status(404).json({ error: 'Timesheet not found or not pending' });
    }

    const employeeId = tsRows[0].user_id;
    const timesheetDate = tsRows[0].date;

    await db.promise().query(
      "UPDATE timesheets SET status = 'disapproved', rejected_by = ?, rejected_at = NOW(), reject_note = ? WHERE id = ?",
      [rejector_id, rejectNote, id]
    );

    const message = `Your timesheet for ${new Date(timesheetDate).toLocaleDateString()} has been REJECTED.\nReason: ${rejectNote}`;
    await db.promise().query(
      'INSERT INTO notifications (user_id, title, message, related_timesheet_id) VALUES (?, ?, ?, ?)',
      [employeeId, 'Timesheet Rejected', message, id]
    );

    res.json({ message: 'Timesheet rejected successfully' });
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
      from: `"JIMMAC Work Management System" <${process.env.EMAIL_USER}>`,
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
// APPROVE LEAVE
app.put('/leave/:id/approve', authenticate, restrictTo(1, 2), async (req, res) => {
  const { id } = req.params;
  const { onBehalfOf } = req.body || {};
  const approverId = onBehalfOf || req.user?.id;

  if (!approverId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Check existence and pending status (single quotes!)
    const [leaveRows] = await db.promise().query(
      "SELECT user_id, days_applied FROM leave_applications WHERE id = ? AND status = 'pending'",
      [id]
    );

    if (leaveRows.length === 0) {
      return res.status(404).json({ error: 'Leave application not found or not pending' });
    }

    const { user_id, days_applied } = leaveRows[0];

    // Deduct balance
    await db.promise().query(
      'UPDATE users SET leave_balance = leave_balance - ? WHERE id = ?',
      [days_applied, user_id]
    );

    // Update status (single quotes!)
    await db.promise().query(
      "UPDATE leave_applications SET status = 'approved', approved_by = ?, approved_at = NOW() WHERE id = ?",
      [approverId, id]
    );

    // Notify admins
    const message = `Leave application by employee ${user_id} (${days_applied} days) has been APPROVED.`;
    const [admins] = await db.promise().query('SELECT id FROM users WHERE role_id IN (1, 2)');

    const notifyValues = admins.map(a => [a.id, 'Leave Approved', message, id]);

    if (notifyValues.length > 0) {
      await db.promise().query(
        'INSERT INTO notifications (user_id, title, message, related_leave_id) VALUES ?',
        [notifyValues]
      );
    }

    res.json({ message: 'Leave approved successfully' });
  } catch (err) {
    console.error('Leave approve error:', {
      message: err.message,
      stack: err.stack,
      sql: err.sql || 'N/A',
      sqlMessage: err.sqlMessage || 'N/A'
    });
    res.status(500).json({ error: 'Failed to approve leave' });
  }
});

// REJECT LEAVE
app.put('/leave/:id/reject', authenticate, restrictTo(1, 2), async (req, res) => {
  const { id } = req.params;

  try {
    // Check existence and pending status (single quotes!)
    const [leaveRows] = await db.promise().query(
      "SELECT user_id, days_applied FROM leave_applications WHERE id = ? AND status = 'pending'",
      [id]
    );

    if (leaveRows.length === 0) {
      return res.status(404).json({ error: 'Leave application not found or not pending' });
    }

    const { user_id, days_applied } = leaveRows[0];

    // Update status (single quotes!)
    await db.promise().query(
      "UPDATE leave_applications SET status = 'rejected', rejected_by = ?, rejected_at = NOW() WHERE id = ?",
      [req.user.id, id]
    );

    // Notify admins
    const message = `Leave application by employee ${user_id} (${days_applied} days) has been REJECTED.`;
    const [admins] = await db.promise().query('SELECT id FROM users WHERE role_id IN (1, 2)');

    const notifyValues = admins.map(a => [a.id, 'Leave Rejected', message, id]);

    if (notifyValues.length > 0) {
      await db.promise().query(
        'INSERT INTO notifications (user_id, title, message, related_leave_id) VALUES ?',
        [notifyValues]
      );
    }

    res.json({ message: 'Leave rejected successfully' });
  } catch (err) {
    console.error('Leave reject error:', {
      message: err.message,
      stack: err.stack,
      sql: err.sql || 'N/A',
      sqlMessage: err.sqlMessage || 'N/A'
    });
    res.status(500).json({ error: 'Failed to reject leave' });
  }
});






// REQUEST PASSWORD RESET (using Brevo API - no SMTP timeout issues)
app.post('/request-password-reset', async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ error: 'Email is required' });

  console.log('Attempting to send reset email to:', email);
  console.log('From:', process.env.EMAIL_FROM || 'not set');

  try {
    // Find user by email
    const [users] = await db.promise().query(
      'SELECT id, username FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      // Don't reveal if email exists (security)
      return res.json({ message: 'If the email exists, a reset link has been sent.' });
    }

    const user = users[0];

    // Generate short-lived reset token (expires in 1 hour)
    const resetToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Save token to DB
    await db.promise().query(
      'UPDATE users SET reset_token = ?, reset_expires = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE id = ?',
      [resetToken, user.id]
    );

    // Brevo API email send
    const resetUrl = `https://system.jimmac.co.za/reset-password?token=${resetToken}`;

    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: { name: 'JIMMAC Timesheet', email: 'noreply@jimmac.co.za' },
        to: [{ email: email }],
        subject: 'Password Reset Request',
        htmlContent: `
          <h2>Reset Your Password</h2>
          <p>Click the button below to reset your password:</p>
          <a href="${resetUrl}" style="background:#f97316; color:white; padding:12px 24px; text-decoration:none; border-radius:6px; display:inline-block;">
            Reset Password
          </a>
          <p>If you didn't request this, ignore this email.</p>
          <p>Link expires in 1 hour.</p>
        `
      },
      {
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
          'accept': 'application/json'
        }
      }
    );

    console.log('Brevo API success:', response.data);

    res.json({ message: 'If the email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Password reset request error:', {
      message: err.message,
      response: err.response?.data || 'No response',
      stack: err.stack
    });
    res.status(500).json({ error: 'Failed to send reset email' });
  }
});

// RESET PASSWORD (new password with token)
app.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Check if token is still valid in DB
    const [rows] = await db.promise().query(
      'SELECT reset_expires FROM users WHERE id = ? AND reset_token = ?',
      [userId, token]
    );

    if (rows.length === 0 || new Date(rows[0].reset_expires) < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear token
    await db.promise().query(
      'UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?',
      [hashedPassword, userId]
    );

    res.json({ message: 'Password reset successfully. Please login.' });
  } catch (err) {
    console.error('Password reset error:', err);
    res.status(400).json({ error: 'Invalid or expired token' });
  }
});


app.get('/test-resend', async (req, res) => {
  try {
    await transporter.sendMail({
      from: `"Test" <noreply@jimmac.co.za>`,
      to: 'your-personal-email@gmail.com',  // ← change to your email
      subject: 'Resend Test from Render',
      text: 'This is a test email from your app.',
      html: '<h1>Test Email</h1><p>It worked!</p>'
    });
    res.send('Test email sent via Resend!');
  } catch (err) {
    console.error('Test email failed:', err.message, err.stack);
    res.status(500).send('Failed: ' + err.message);
  }
});


// ==================== SERVER START ====================
const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});


