"""
SmartDesk Support Platform — Flask Backend
Full-stack AI-driven IT support ticket automation system
"""

import os, re, json, joblib
from datetime import datetime, date
from functools import wraps

from flask import (Flask, render_template, request, jsonify, session,
                   redirect, url_for)
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3

# ─────────────────────────────────────────────
# App Setup
# ─────────────────────────────────────────────
app = Flask(__name__)
app.secret_key = 'nexus-it-secret-2024-xk9'
DB_PATH = 'nexus.db'

# ─────────────────────────────────────────────
# Load ML Models
# ─────────────────────────────────────────────
category_model = None
priority_model  = None
queue_model     = None
model_stats     = {}

def load_models():
    global category_model, priority_model, queue_model, model_stats
    try:
        category_model = joblib.load('models/category_model.pkl')
        priority_model  = joblib.load('models/priority_model.pkl')
        queue_model     = joblib.load('models/queue_model.pkl')
        with open('models/stats.json') as f:
            model_stats = json.load(f)
        print("✅ Models loaded")
    except Exception as e:
        print(f"⚠️  Models not loaded: {e}")

load_models()

# ─────────────────────────────────────────────
# Text Preprocessing
# ─────────────────────────────────────────────
STOP_WORDS = {
    'the','a','an','and','or','but','in','on','at','to','for','of','with',
    'is','are','was','were','be','been','being','have','has','had','do',
    'does','did','will','would','could','should','may','might','shall',
    'this','that','these','those','i','we','you','he','she','they','it',
    'my','our','your','his','her','their','its','me','us','him','her',
    'dear','customer','support','team','hello','hi','hope','message',
    'reaching','out','please','thank','thanks','regards','sincerely',
}

HIGH_URGENCY_KEYWORDS = [
    'not working','cannot access','system down','outage','urgent','asap',
    'critical','emergency','immediately','broken','crashed','failure',
    'security breach','data loss','ransomware','cyberattack','hack',
    'cannot login','locked out','server down','network down','production down',
]

def preprocess(text):
    if not isinstance(text, str): return ""
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    tokens = [w for w in text.split() if w not in STOP_WORDS and len(w) > 2]
    return ' '.join(tokens)

def extract_entities(subject, body):
    """Rule-based NER for IT entities."""
    text = f"{subject} {body}".lower()
    entities = {}

    # Devices
    devices = re.findall(
        r'\b(laptop|desktop|printer|router|switch|server|monitor|keyboard|'
        r'mouse|projector|tablet|phone|iphone|android|macbook|workstation|'
        r'scanner|firewall|access point|wifi|vlan|nas|storage)\b', text)
    if devices: entities['devices'] = list(set(devices))

    # Software
    software = re.findall(
        r'\b(windows|linux|macos|ubuntu|outlook|excel|word|office|'
        r'teams|slack|zoom|vpn|chrome|firefox|edge|sap|salesforce|'
        r'servicenow|jira|github|docker|kubernetes|active directory|ad)\b', text)
    if software: entities['software'] = list(set(software))

    # Error patterns
    errors = re.findall(
        r'\b(error|crash|freeze|hang|timeout|not responding|blue screen|'
        r'bsod|kernel panic|failed|corrupt|malware|virus|not charging|'
        r'connection refused|access denied|permission denied|404|500)\b', text)
    if errors: entities['errors'] = list(set(errors))

    # Brands / Products
    brands = re.findall(
        r'\b(dell|hp|lenovo|cisco|apple|microsoft|google|samsung|sony|'
        r'logitech|intel|amd|nvidia|aws|azure|gcp)\b', text)
    if brands: entities['brands'] = list(set(brands))

    return entities

# ─────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            subject TEXT NOT NULL,
            body TEXT NOT NULL,
            category TEXT,
            queue TEXT,
            priority TEXT,
            status TEXT DEFAULT 'Pending',
            confidence_category REAL DEFAULT 0,
            confidence_priority REAL DEFAULT 0,
            entities TEXT DEFAULT '{}',
            admin_notes TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        """)

init_db()

# ─────────────────────────────────────────────
# Auth Helpers
# ─────────────────────────────────────────────
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated

# ─────────────────────────────────────────────
# PAGE ROUTES
# ─────────────────────────────────────────────
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login')
def login_page():
    return render_template('login.html')

@app.route('/signup')
def signup_page():
    return render_template('signup.html', role='user')

@app.route('/dashboard')
def dashboard_page():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    # Redirect regular users to their tickets page
    if session.get('user_role') != 'admin':
        return redirect(url_for('my_tickets_page'))
    return render_template('dashboard.html')

@app.route('/my-tickets')
def my_tickets_page():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    return render_template('user-tickets.html')

@app.route('/analytics')
def analytics_page():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    return render_template('analytics.html')

# ─────────────────────────────────────────────
# AUTH APIs
# ─────────────────────────────────────────────
@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    name     = data.get('name', '').strip()
    email    = data.get('email', '').strip().lower()
    password = data.get('password', '')
    role     = data.get('role', 'user')  # 'user' or 'admin'

    if not all([name, email, password]):
        return jsonify({'error': 'All fields are required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    if role not in ['user', 'admin']:
        role = 'user'

    try:
        with get_db() as conn:
            conn.execute(
                'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                (name, email, generate_password_hash(password), role)
            )
        return jsonify({'success': True, 'message': 'Account created successfully'})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Email already registered'}), 409

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    email    = data.get('email', '').strip().lower()
    password = data.get('password', '')

    with get_db() as conn:
        user = conn.execute(
            'SELECT * FROM users WHERE email = ?', (email,)
        ).fetchone()

    if not user or not check_password_hash(user['password'], password):
        return jsonify({'error': 'Invalid email or password'}), 401

    session['user_id']   = user['id']
    session['user_name'] = user['name']
    session['user_email']= user['email']
    session['user_role'] = user['role']
    return jsonify({
        'success': True,
        'user': {
            'id': user['id'], 
            'name': user['name'], 
            'email': user['email'],
            'role': user['role']
        }
    })

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/me')
def me():
    if 'user_id' not in session:
        return jsonify({'authenticated': False}), 401
    return jsonify({
        'authenticated': True,
        'user': {
            'id': session['user_id'],
            'name': session['user_name'],
            'email': session['user_email'],
            'role': session.get('user_role', 'user')
        }
    })

# ─────────────────────────────────────────────
# PREDICT/ANALYZE APIs
# ─────────────────────────────────────────────
@app.route('/api/analyze', methods=['POST'])
def analyze():
    """Analyze ticket without saving (no auth required)"""
    data    = request.get_json()
    subject = data.get('subject', '')
    body    = data.get('body', '')

    if not subject or not body:
        return jsonify({'error': 'Subject and body are required'}), 400

    full_text   = f"{subject} {body}"
    clean_text  = preprocess(full_text)

    result = {
        'subject': subject,
        'category': 'Incident',
        'queue': 'Technical Support',
        'priority': 'medium',
        'confidence_category': 0.85,
        'confidence_priority': 0.75,
        'rule_override': False,
        'entities': extract_entities(subject, body),
    }

    if category_model:
        try:
            cat_probs = category_model.predict_proba([clean_text])[0]
            cat_classes = category_model.classes_
            cat_idx = cat_probs.argmax()
            result['category']            = cat_classes[cat_idx]
            result['confidence_category'] = round(float(cat_probs[cat_idx]), 3)
        except Exception as e:
            print(f"Category prediction error: {e}")

    if queue_model:
        try:
            q_probs   = queue_model.predict_proba([clean_text])[0]
            q_classes = queue_model.classes_
            result['queue'] = q_classes[q_probs.argmax()]
        except Exception as e:
            print(f"Queue prediction error: {e}")

    if priority_model:
        try:
            pri_probs   = priority_model.predict_proba([clean_text])[0]
            pri_classes = priority_model.classes_
            pri_idx     = pri_probs.argmax()
            result['priority']            = pri_classes[pri_idx]
            result['confidence_priority'] = round(float(pri_probs[pri_idx]), 3)
        except Exception as e:
            print(f"Priority prediction error: {e}")

    # Rule-based override
    text_lower = full_text.lower()
    for kw in HIGH_URGENCY_KEYWORDS:
        if kw in text_lower:
            if result['priority'] != 'high':
                result['priority']      = 'high'
                result['rule_override'] = True
                result['override_keyword'] = kw
            break

    return jsonify(result)

@app.route('/api/predict', methods=['POST'])
@login_required
def predict():
    """Analyze AND save ticket (requires auth)"""
    data    = request.get_json()
    subject = data.get('subject', '')
    body    = data.get('body', '')

    if not subject or not body:
        return jsonify({'error': 'Subject and body are required'}), 400

    full_text   = f"{subject} {body}"
    clean_text  = preprocess(full_text)

    result = {
        'subject': subject,
        'category': 'Incident',
        'queue': 'Technical Support',
        'priority': 'medium',
        'confidence_category': 0.85,
        'confidence_priority': 0.75,
        'rule_override': False,
        'entities': extract_entities(subject, body),
    }

    if category_model:
        try:
            cat_probs = category_model.predict_proba([clean_text])[0]
            cat_classes = category_model.classes_
            cat_idx = cat_probs.argmax()
            result['category']            = cat_classes[cat_idx]
            result['confidence_category'] = round(float(cat_probs[cat_idx]), 3)
        except Exception as e:
            print(f"Category prediction error: {e}")

    if queue_model:
        try:
            q_probs   = queue_model.predict_proba([clean_text])[0]
            q_classes = queue_model.classes_
            result['queue'] = q_classes[q_probs.argmax()]
        except Exception as e:
            print(f"Queue prediction error: {e}")

    if priority_model:
        try:
            pri_probs   = priority_model.predict_proba([clean_text])[0]
            pri_classes = priority_model.classes_
            pri_idx     = pri_probs.argmax()
            result['priority']            = pri_classes[pri_idx]
            result['confidence_priority'] = round(float(pri_probs[pri_idx]), 3)
        except Exception as e:
            print(f"Priority prediction error: {e}")

    # Rule-based override
    text_lower = full_text.lower()
    for kw in HIGH_URGENCY_KEYWORDS:
        if kw in text_lower:
            if result['priority'] != 'high':
                result['priority']      = 'high'
                result['rule_override'] = True
                result['override_keyword'] = kw
            break

    # Save to DB
    with get_db() as conn:
        cur = conn.execute(
            """INSERT INTO tickets
               (user_id, subject, body, category, queue, priority,
                confidence_category, confidence_priority, entities)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (session['user_id'], subject, body,
             result['category'], result['queue'], result['priority'],
             result['confidence_category'], result['confidence_priority'],
             json.dumps(result['entities']))
        )
        result['ticket_id'] = cur.lastrowid

    return jsonify(result)

# ─────────────────────────────────────────────
# TICKETS API
# ─────────────────────────────────────────────
@app.route('/api/tickets')
@login_required
def my_tickets():
    sort = request.args.get('sort', 'date')
    order_clause = 'created_at DESC' if sort == 'date' else \
                   "CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END"

    # If admin, show all tickets with user info
    if session.get('user_role') == 'admin':
        with get_db() as conn:
            tickets = conn.execute(
                f"""SELECT t.*, u.name as user_name, u.email as user_email 
                    FROM tickets t 
                    JOIN users u ON t.user_id = u.id 
                    ORDER BY {order_clause}"""
            ).fetchall()
    else:
        # Regular users only see their own tickets
        with get_db() as conn:
            tickets = conn.execute(
                f'SELECT * FROM tickets WHERE user_id=? ORDER BY {order_clause}',
                (session['user_id'],)
            ).fetchall()

    return jsonify([dict(t) for t in tickets])

@app.route('/api/tickets/<int:tid>', methods=['PATCH'])
@login_required
def update_ticket(tid):
    data   = request.get_json()
    status = data.get('status')
    admin_notes = data.get('admin_notes', '')
    
    if status and status not in ('Pending', 'In Progress', 'Resolved', 'Closed'):
        return jsonify({'error': 'Invalid status'}), 400
    
    with get_db() as conn:
        # Check if ticket exists and user has permission
        ticket = conn.execute('SELECT user_id FROM tickets WHERE id=?', (tid,)).fetchone()
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404
        
        # Admins can update any ticket, users can only update their own
        if session.get('user_role') != 'admin' and ticket['user_id'] != session['user_id']:
            return jsonify({'error': 'Permission denied'}), 403
        
        # Build update query
        updates = []
        params = []
        if status:
            updates.append('status=?')
            params.append(status)
        if admin_notes and session.get('user_role') == 'admin':
            updates.append('admin_notes=?')
            params.append(admin_notes)
        updates.append('updated_at=?')
        params.append(datetime.now())
        
        params.append(tid)
        
        conn.execute(
            f'UPDATE tickets SET {", ".join(updates)} WHERE id=?',
            params
        )
    return jsonify({'success': True})

@app.route('/api/tickets/<int:tid>', methods=['DELETE'])
@login_required
def delete_ticket(tid):
    with get_db() as conn:
        conn.execute('DELETE FROM tickets WHERE id=? AND user_id=?',
                     (tid, session['user_id']))
    return jsonify({'success': True})

# ─────────────────────────────────────────────
# ANALYTICS / STATS API
# ─────────────────────────────────────────────
@app.route('/api/stats')
@login_required
def stats():
    uid = session['user_id']
    is_admin = session.get('user_role') == 'admin'
    today = date.today().isoformat()

    with get_db() as conn:
        if is_admin:
            # Admin sees all tickets stats
            total = conn.execute('SELECT COUNT(*) FROM tickets').fetchone()[0]
            today_count = conn.execute(
                "SELECT COUNT(*) FROM tickets WHERE date(created_at)=?", (today,)
            ).fetchone()[0]
            pending = conn.execute(
                "SELECT COUNT(*) FROM tickets WHERE status='Pending'"
            ).fetchone()[0]
            resolved = conn.execute(
                "SELECT COUNT(*) FROM tickets WHERE status='Resolved'"
            ).fetchone()[0]
            by_category = conn.execute(
                "SELECT category, COUNT(*) as cnt FROM tickets GROUP BY category"
            ).fetchall()
            by_priority = conn.execute(
                "SELECT priority, COUNT(*) as cnt FROM tickets GROUP BY priority"
            ).fetchall()
            by_status = conn.execute(
                "SELECT status, COUNT(*) as cnt FROM tickets GROUP BY status"
            ).fetchall()
            daily = conn.execute(
                """SELECT date(created_at) as day, COUNT(*) as cnt
                   FROM tickets
                   WHERE created_at >= date('now','-6 days')
                   GROUP BY day ORDER BY day"""
            ).fetchall()
        else:
            # Regular users see only their tickets
            total = conn.execute(
                'SELECT COUNT(*) FROM tickets WHERE user_id=?', (uid,)
            ).fetchone()[0]
            today_count = conn.execute(
                "SELECT COUNT(*) FROM tickets WHERE user_id=? AND date(created_at)=?",
                (uid, today)
            ).fetchone()[0]
            pending = conn.execute(
                "SELECT COUNT(*) FROM tickets WHERE user_id=? AND status='Pending'",
                (uid,)
            ).fetchone()[0]
            resolved = conn.execute(
                "SELECT COUNT(*) FROM tickets WHERE user_id=? AND status='Resolved'",
                (uid,)
            ).fetchone()[0]
            by_category = conn.execute(
                "SELECT category, COUNT(*) as cnt FROM tickets WHERE user_id=? GROUP BY category",
                (uid,)
            ).fetchall()
            by_priority = conn.execute(
                "SELECT priority, COUNT(*) as cnt FROM tickets WHERE user_id=? GROUP BY priority",
                (uid,)
            ).fetchall()
            by_status = conn.execute(
                "SELECT status, COUNT(*) as cnt FROM tickets WHERE user_id=? GROUP BY status",
                (uid,)
            ).fetchall()
            daily = conn.execute(
                """SELECT date(created_at) as day, COUNT(*) as cnt
                   FROM tickets WHERE user_id=?
                   AND created_at >= date('now','-6 days')
                   GROUP BY day ORDER BY day""",
                (uid,)
            ).fetchall()

    return jsonify({
        'total': total,
        'today': today_count,
        'pending': pending,
        'resolved': resolved,
        'attended': total - pending,
        'by_category': [dict(r) for r in by_category],
        'by_priority': [dict(r) for r in by_priority],
        'by_status':   [dict(r) for r in by_status],
        'daily':       [dict(r) for r in daily],
        'model_stats': model_stats,
        'is_admin': is_admin
    })

# ─────────────────────────────────────────────
if __name__ == '__main__':
    app.run(debug=True, port=5000)
