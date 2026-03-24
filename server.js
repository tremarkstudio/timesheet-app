const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');


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
        params: { track_clicks: false }
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
// USER PROFILE (/users/me) - IMPROVED
app.get('/users/me', authenticate, async (req, res) => {
  const userId = req.user.id;

  try {
    const [results] = await db.promise().query(
  `SELECT u.id, u.username, u.first_name, u.last_name, u.email, u.phone, 
          u.role_id, u.employee_id, u.department, u.job_title, 
          u.employment_type, u.start_date, u.manager_id, u.leave_balance,
          CONCAT(m.first_name, ' ', m.last_name) AS manager_name
   FROM users u
   LEFT JOIN users m ON u.manager_id = m.id
   WHERE u.id = ?`,
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
// SELF-UPDATE PROFILE (/users/me) - with avatar support
// ────────────────────────────────────────────────
app.put('/users/me', authenticate, upload.single('avatar'), async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const updates = req.body || {};

  try {
    let fields = [];
    let values = [];

    const allowedFields = [
      'first_name', 'last_name', 'email', 'phone',
      'job_title', 'department', 'team', 'employment_type'
    ];

    allowedFields.forEach(field => {
      if (updates[field] !== undefined && updates[field] !== null && updates[field] !== '') {
        fields.push(`${field} = ?`);
        values.push(updates[field]);
      }
    });

    if (req.file) {
      fields.push('avatar_url = ?');
      values.push(req.file.path.replace(/^public\//, 'uploads/'));
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(userId);

    const [result] = await db.promise().query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error('Self-update error:', err.message);
    res.status(500).json({ error: 'Server error during profile update' });
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

// SUBMIT NEW TIMESHEET - FIXED for FormData + JSON tasks
app.post('/timesheets', authenticate, upload.single('attachment'), async (req, res) => {
  const userId = req.user.id;
  const { date, tasks: tasksString } = req.body;   // tasks comes as string from FormData
  const attachment_path = req.file ? req.file.path : null;

  if (!date) {
    return res.status(400).json({ error: 'Date is required' });
  }

  if (!tasksString) {
    return res.status(400).json({ error: 'Tasks are required' });
  }

  let parsedTasks;
  try {
    parsedTasks = JSON.parse(tasksString);
    if (!Array.isArray(parsedTasks) || parsedTasks.length === 0) {
      return res.status(400).json({ error: 'Tasks must be a non-empty array' });
    }
  } catch (err) {
    console.error('JSON parse error for tasks:', err);
    return res.status(400).json({ error: 'Invalid tasks format' });
  }

  const totalHours = parsedTasks.reduce((sum, t) => sum + Number(t.hours || 0), 0);

  try {
    // Insert main timesheet
    const [result] = await db.promise().query(
      `INSERT INTO timesheets 
       (user_id, date, status, attachment_path, date_submitted, total_hours) 
       VALUES (?, ?, 'pending', ?, NOW(), ?)`,
      [userId, date, attachment_path, totalHours]
    );

    const timesheetId = result.insertId;

    // Insert tasks with correct column names
    if (parsedTasks.length > 0) {
      const taskValues = parsedTasks.map(t => [
        timesheetId,
        t.description || t.title || 'Untitled task',           // title
        t.projectType || '',                                   // type
        t.clientProjectName?.trim() || '',                     // client_project_name
        t.projectNumber?.trim() || null,                       // project_code
        Number(t.hours || 0)
      ]);

      await db.promise().query(
        `INSERT INTO timesheet_tasks 
         (timesheet_id, title, type, client_project_name, project_code, hours) 
         VALUES ?`,
        [taskValues]
      );
    }

    res.status(201).json({ 
      message: 'Timesheet submitted successfully', 
      id: timesheetId 
    });
  } catch (err) {
    console.error('Timesheet submission error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to submit timesheet' });
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

    // Get employee email
    const [empRows] = await db.promise().query(
      "SELECT email FROM users WHERE id = ?",
      [employeeId]
    );
    const employeeEmail = empRows[0]?.email;

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

    // DB notification
    const message = `Your timesheet for ${new Date(timesheetDate).toLocaleDateString()} has been APPROVED.\nReview note: ${reviewNote}`;
    await db.promise().query(
      'INSERT INTO notifications (user_id, title, message, related_timesheet_id) VALUES (?, ?, ?, ?)',
      [employeeId, 'Timesheet Approved', message, id]
    );

    // Email to employee
    if (employeeEmail) {
      const html = `
        <h2>Your Timesheet Has Been Approved!</h2>
        <p>Your timesheet for <strong>${new Date(timesheetDate).toLocaleDateString()}</strong> has been approved.</p>
        <p><strong>Review note:</strong> ${reviewNote}</p>
        <p>View details: <a href="https://system.jimmac.co.za/timesheets" style="color:#f97316;">View Timesheets</a></p>
        <p>Best regards,<br>Jimmac Team</p>
      `;

      await sendBrevoEmail(employeeEmail, 'Timesheet Approved', html);
    }

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

    // Get employee email
    const [empRows] = await db.promise().query(
      "SELECT email FROM users WHERE id = ?",
      [employeeId]
    );
    const employeeEmail = empRows[0]?.email;

    await db.promise().query(
      "UPDATE timesheets SET status = 'disapproved', rejected_by = ?, rejected_at = NOW(), reject_note = ? WHERE id = ?",
      [rejector_id, rejectNote, id]
    );

    // DB notification
    const message = `Your timesheet for ${new Date(timesheetDate).toLocaleDateString()} has been REJECTED.\nReason: ${rejectNote}`;
    await db.promise().query(
      'INSERT INTO notifications (user_id, title, message, related_timesheet_id) VALUES (?, ?, ?, ?)',
      [employeeId, 'Timesheet Rejected', message, id]
    );

    // Email to employee
    if (employeeEmail) {
      const html = `
        <h2>Your Timesheet Has Been Rejected</h2>
        <p>Your timesheet for <strong>${new Date(timesheetDate).toLocaleDateString()}</strong> was rejected.</p>
        <p><strong>Reason:</strong> ${rejectNote}</p>
        <p>Please review and resubmit if necessary: <a href="https://system.jimmac.co.za/timesheets" style="color:#f97316;">View Timesheets</a></p>
        <p>Best regards,<br>Jimmac Team</p>
      `;

      await sendBrevoEmail(employeeEmail, 'Timesheet Rejected', html);
    }

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



// WELCOME EMAIL (with secure password reset link)
app.post('/send-welcome-email', async (req, res) => {
  const { email, username, name } = req.body;

  if (!email || !username) {
    return res.status(400).json({ error: 'Email and username are required' });
  }

  try {
    // 1. Find the new user by username/email
    const [users] = await db.promise().query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = users[0].id;

    // 2. Generate short-lived reset token (expires in 24 hours)
    const resetToken = jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // 3. Save token to DB
    await db.promise().query(
      'UPDATE users SET reset_token = ?, reset_expires = DATE_ADD(NOW(), INTERVAL 24 HOUR) WHERE id = ?',
      [resetToken, userId]
    );

    // 4. Build secure reset link
    const resetUrl = `https://system.jimmac.co.za/reset-password?token=${resetToken}`;

    // 5. Email content
    const text = `
Welcome to Jimmac Timesheet, ${name || 'Team Member'}!

Your account has been created successfully.

Username: ${username}

To set your password and activate your account, click this secure link:
${resetUrl}

The link expires in 24 hours.

After setting your password, you can log in here: https://system.jimmac.co.za/login

Best regards,
Jimmac Team
    `;

    const html = `
      <h2 style="color: #f97316;">Welcome to Jimmac Timesheet!</h2>
      <p>Hi ${name || 'Team Member'},</p>
      <p>Your account has been created successfully.</p>
      <p><strong>Username:</strong> ${username}</p>
      <p>To set your password and activate your account, click the button below:</p>
      <a href="${resetUrl}" style="background:#f97316; color:white; padding:12px 24px; text-decoration:none; border-radius:6px; display:inline-block; margin:20px 0;">
        Set Your Password
      </a>
      <p style="color:#666;">This link expires in 24 hours.</p>
      <p>After setting your password, log in here: 
        <a href="https://system.jimmac.co.za/login" style="color:#f97316;">Login</a>
      </p>
      <p><small>For security, never share your password.</small></p>
      <p>Best regards,<br/>Jimmac Team</p>
    `;

    await transporter.sendMail({
      from: `"JIMMAC Work Management System" <${process.env.EMAIL_FROM || 'noreply@jimmac.co.za'}>`,
      to: email,
      subject: 'Welcome to Jimmac Timesheet - Set Your Password',
      text,
      html,
    });

    console.log(`Welcome email with reset link sent to ${email} for user ${username}`);

    res.json({ message: 'Welcome email with password setup link sent' });
  } catch (err) {
    console.error('Welcome email error:', err.message, err.stack);
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
    'SELECT email FROM users WHERE role_id IN (1, 2) AND email IS NOT NULL'
  );

  if (admins.length > 0) {
    const employeeName = req.user.first_name && req.user.last_name 
      ? `${req.user.first_name} ${req.user.last_name}` 
      : req.user.username || 'An employee';

    const subject = `New Leave Application Pending Review - ${employeeName}`;

    for (const admin of admins) {
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

      await sendBrevoEmail(admin.email, subject, html);
    }

    console.log(`Leave notification emails sent to ${admins.length} admins`);
  }
} catch (emailErr) {
  console.error('Leave notification error (non-blocking):', emailErr);
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
const [admins] = await db.promise().query('SELECT email FROM users WHERE role_id IN (1, 2) AND email IS NOT NULL');

for (const admin of admins) {
  try {
    const html = `
      <h2>Leave Application Approved</h2>
      <p>Employee ${user_id} had their leave request (${days_applied} days) approved.</p>
      <p>Approved by: ${approverId}</p>
      <p>View details: <a href="https://system.jimmac.co.za/leave?review=${id}" style="color:#f97316;">Review Leave</a></p>
    `;

    await sendBrevoEmail(
      admin.email,
      'Leave Approved',
      html
    );
  } catch (emailErr) {
    console.error('Failed to notify admin:', emailErr);
  }
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
      const [admins] = await db.promise().query(
        'SELECT email FROM users WHERE role_id IN (1, 2) AND email IS NOT NULL'
      );

      for (const admin of admins) {
        try {
          const html = `
            <h2>Leave Application Rejected</h2>
            <p>Employee ${user_id} had their leave request (${days_applied} days) rejected.</p>
            <p>Rejected by: ${req.user.id}</p>
            <p>View details: <a href="https://system.jimmac.co.za/leave?review=${id}" style="color:#f97316;">Review Leave</a></p>
          `;

          await sendBrevoEmail(admin.email, 'Leave Rejected', html);
        } catch (emailErr) {
          console.error('Failed to notify admin:', emailErr);
        }
      }

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

  console.log('Reset password attempt received');
  console.log('Token provided:', token ? 'yes (length ' + token.length + ')' : 'missing');
  console.log('New password provided:', newPassword ? 'yes (length ' + newPassword.length + ')' : 'missing');

  if (!token || !newPassword) {
    console.warn('Missing token or password');
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  try {
    // Step 1: Verify JWT signature and decode
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Token verified successfully. Decoded userId:', decoded.userId);
    } catch (jwtErr) {
      console.error('JWT verification failed:', jwtErr.message, jwtErr.name);
      return res.status(400).json({ error: 'Invalid reset token signature' });
    }

    const userId = decoded.userId;

    // Step 2: Check if user exists and token matches + not expired
    const [rows] = await db.promise().query(
      'SELECT id, reset_token, reset_expires FROM users WHERE id = ?',
      [userId]
    );

    console.log('Users found in DB:', rows.length);

    if (rows.length === 0) {
      console.warn('No user found for ID:', userId);
      return res.status(400).json({ error: 'User not found' });
    }

    const user = rows[0];
    console.log('Stored token in DB:', user.reset_token ? 'present' : 'NULL');
    console.log('Token expires at:', user.reset_expires);
    console.log('Current time:', new Date().toISOString());

    if (!user.reset_token || user.reset_token !== token) {
      console.warn('Token mismatch - DB token != submitted token');
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    if (!user.reset_expires || new Date(user.reset_expires) < new Date()) {
      console.warn('Token expired or no expiration date');
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    // Step 3: Hash and update password + clear token
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const [updateResult] = await db.promise().query(
      'UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?',
      [hashedPassword, userId]
    );

    console.log('Password update affected rows:', updateResult.affectedRows);

    if (updateResult.affectedRows === 0) {
      console.error('Password update failed - no rows affected for userId:', userId);
      return res.status(500).json({ error: 'Failed to update password' });
    }

    console.log('Password reset SUCCESS for userId:', userId);

    res.json({ message: 'Password reset successfully. Please login.' });
  } catch (err) {
    console.error('Password reset error:', {
      message: err.message,
      name: err.name,
      code: err.code,
      stack: err.stack?.substring(0, 500), // truncate for log readability
      tokenProvided: !!token,
      newPasswordProvided: !!newPassword
    });

    if (err.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'Reset token has expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    res.status(500).json({ error: 'Server error during password reset' });
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


