import logging
import os
import re
import sqlite3
import uuid
from datetime import datetime
from functools import wraps
from logging.handlers import RotatingFileHandler

from flask import Flask, render_template, request, jsonify, url_for, session
from flask_cors import CORS

# 初始化 Flask 应用
app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', os.urandom(24))  # 生产环境应使用固定密钥
CORS(app, supports_credentials=True)  # 启用跨域支持，允许凭证

# 配置常量
ACTIVATION_CODE = os.getenv('ACTIVATION_CODE', '#39C5BB')  # 从环境变量读取激活码
MAX_USERNAME_LENGTH = 20
MIN_PASSWORD_LENGTH = 8


# 配置日志
def setup_logging():
    log_dir = 'logs'
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)

    file_handler = RotatingFileHandler(
        os.path.join(log_dir, 'app.log'),
        maxBytes=1024 * 1024 * 5,  # 5MB
        backupCount=10
    )
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    app.logger.addHandler(file_handler)
    app.logger.setLevel(logging.INFO)


# 数据库配置
DB_CONFIG = {
    'user_db': 'database.db',
    'experiment_db': 'database2.db',
    'attention_db': 'database3.db'
}


# 装饰器：需要登录
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'success': False, 'error': '请先登录'}), 401
        return f(*args, **kwargs)

    return decorated_function


# 输入验证函数
def validate_input(input_str, max_length=None):
    """基本输入验证防止SQL注入和XSS"""
    if not input_str or len(input_str.strip()) == 0:
        return False
    if max_length and len(input_str) > max_length:
        return False
    return bool(re.match(r'^[\w\s\-@.#$%^&*()!?]+$', input_str))


# 密码强度验证
def validate_password(password):
    if len(password) < MIN_PASSWORD_LENGTH:
        return False
    # 至少包含一个大写字母、一个小写字母和一个数字
    return bool(re.match(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)', password))


# 获取数据库连接
def get_db_connection(db_name):
    """获取数据库连接，确保外键约束启用"""
    db_path = DB_CONFIG[db_name]
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")  # 启用外键约束
    return conn


# 初始化用户数据库
def init_user_db():
    db_path = DB_CONFIG['user_db']
    try:
        with get_db_connection('user_db') as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    activation_code TEXT NOT NULL,
                    computer_id TEXT UNIQUE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            conn.commit()
        app.logger.info(f"用户数据库初始化成功: {db_path}")
    except Exception as e:
        app.logger.error(f"用户数据库初始化失败: {e}")


# 初始化实验数据库
def init_experiment_db():
    db_path = DB_CONFIG['experiment_db']
    try:
        with get_db_connection('experiment_db') as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS stroop_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    group_number INTEGER NOT NULL,
                    trial_number INTEGER NOT NULL,
                    word TEXT NOT NULL,
                    color TEXT NOT NULL,
                    response TEXT NOT NULL,
                    reaction_time INTEGER,
                    is_consistent INTEGER NOT NULL CHECK (is_consistent IN (0, 1)),
                    is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
                    user_id INTEGER,  
                    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            conn.commit()
        app.logger.info(f"实验数据库初始化成功: {db_path}")
    except Exception as e:
        app.logger.error(f"实验数据库初始化失败: {e}")


# 初始化注意力测验数据库
def init_attention_db():
    db_path = DB_CONFIG['attention_db']
    try:
        with get_db_connection('attention_db') as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS attention_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    group_number INTEGER NOT NULL,
                    stimulus TEXT NOT NULL,
                    is_target BOOLEAN NOT NULL,
                    response BOOLEAN NOT NULL,
                    reaction_time INTEGER,
                    score INTEGER NOT NULL,
                    timestamp DATETIME NOT NULL,
                    user_id INTEGER,
                    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            conn.commit()
        app.logger.info(f"注意力测验数据库初始化成功: {db_path}")
    except Exception as e:
        app.logger.error(f"注意力测验数据库初始化失败: {e}")


# 获取电脑的唯一标识
def get_computer_id():
    return str(uuid.uuid4())


# API路由
@app.route('/')
def index():
    return render_template('home.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        return render_template('login.html')

    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': '无效的请求数据'}), 400

        username = data.get('username')
        password = data.get('password')
        activation_code = data.get('activation_code')

        if not all([username, password, activation_code]):
            return jsonify({'success': False, 'error': '请填写所有字段'}), 400

        if not validate_input(username, MAX_USERNAME_LENGTH):
            return jsonify({'success': False, 'error': '用户名包含非法字符或过长'}), 400

        with get_db_connection('user_db') as conn:
            cursor = conn.cursor()
            cursor.execute(
                '''SELECT id, password_hash FROM users 
                WHERE username = ? AND activation_code = ?''',
                (username, activation_code)
            )
            user = cursor.fetchone()

        if user and user[1] == password:  # 直接比较密码
            session['user_id'] = user[0]  # 创建会话
            return jsonify({
                'success': True,
                'message': '登录成功',
                'redirect': url_for('navigation')
            }), 200
        else:
            return jsonify({'success': False, 'error': '用户名或密码错误'}), 401

    except Exception as e:
        app.logger.error(f'登录失败: {str(e)}', exc_info=True)
        return jsonify({'success': False, 'error': '服务器错误'}), 500


@app.route('/logout')
@login_required
def logout():
    session.pop('user_id', None)
    return jsonify({'success': True, 'message': '登出成功', 'redirect': url_for('index')})


@app.route('/navigation')
@login_required
def navigation():
    return render_template('navigation.html')


@app.route("/Home")
@login_required
def home():
    return render_template('home.html')


@app.route('/examination1')
@login_required
def examination1():
    return render_template('examination1.html')


@app.route('/examination2')
@login_required
def examination2():
    return render_template('examination2.html')


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'GET':
        return render_template('login.html')

    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': '无效的请求数据'}), 400

        username = data.get('username')
        password = data.get('password')
        confirm_password = data.get('confirm_password')
        activation_code = data.get('activation_code')

        # 验证字段
        if not all([username, password, confirm_password, activation_code]):
            return jsonify({'success': False, 'error': '请填写所有字段'}), 400

        if password != confirm_password:
            return jsonify({'success': False, 'error': '两次输入的密码不一致'}), 400

        if activation_code != ACTIVATION_CODE:
            return jsonify({'success': False, 'error': '激活码错误'}), 400

        if not validate_input(username, MAX_USERNAME_LENGTH):
            return jsonify({'success': False, 'error': '用户名包含非法字符或过长'}), 400

        if not validate_password(password):
            return jsonify({
                'success': False,
                'error': f'密码至少需要{MIN_PASSWORD_LENGTH}个字符，包含大小写字母和数字'
            }), 400

        computer_id = get_computer_id()

        # 插入数据库
        with get_db_connection('user_db') as conn:
            cursor = conn.cursor()
            cursor.execute(
                '''INSERT INTO users 
                (username, password_hash, activation_code, computer_id) 
                VALUES (?, ?, ?, ?)''',
                (username, password, activation_code, computer_id)
            )
            conn.commit()

        return jsonify({
            'success': True,
            'message': '注册成功',
            'redirect': url_for('navigation')
        }), 200

    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'error': '用户名已存在'}), 400
    except Exception as e:
        app.logger.error(f'注册失败: {str(e)}', exc_info=True)
        return jsonify({'success': False, 'error': '服务器错误'}), 500


@app.route('/submit-results', methods=['POST'])
@login_required
def submit_results():
    try:
        data = request.get_json()
        if not data or not isinstance(data, list):
            return jsonify({'success': False, 'error': '无效的实验数据'}), 400

        # 验证数据格式
        required_fields = [
            'group', 'trial', 'word', 'color',
            'response', 'reactionTime', 'isConsistent', 'isCorrect'
        ]

        for trial in data:
            if not all(field in trial for field in required_fields):
                return jsonify({'success': False, 'error': '缺少必要字段'}), 400

        user_id = session['user_id']

        # 使用事务确保数据一致性
        with get_db_connection('experiment_db') as conn:
            cursor = conn.cursor()
            cursor.executemany('''
                INSERT INTO stroop_results 
                (group_number, trial_number, word, color, response, 
                 reaction_time, is_consistent, is_correct, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', [
                (
                    trial['group'],
                    trial['trial'],
                    trial['word'],
                    trial['color'],
                    trial['response'],
                    trial['reactionTime'],
                    trial['isConsistent'],
                    trial['isCorrect'],
                    user_id
                ) for trial in data
            ])
            conn.commit()

        return jsonify({'success': True, 'message': '实验数据提交成功'}), 200

    except Exception as e:
        app.logger.error(f'提交实验数据失败: {str(e)}', exc_info=True)
        return jsonify({'success': False, 'error': '提交失败'}), 500


@app.route('/submit-attention-results', methods=['POST'])
@login_required
def submit_attention_results():
    try:
        data = request.get_json()
        data = [trial for trial in data if not trial.get('isPractice', False)]
        if not data or not isinstance(data, list):
            return jsonify({'success': False, 'error': '无效的测验数据'}), 400

        # 验证数据格式
        required_fields = [
            'group', 'stimulus', 'isTarget',
            'response', 'rt', 'score', 'timestamp'
        ]

        for trial in data:
            if not all(field in trial for field in required_fields):
                return jsonify({'success': False, 'error': '缺少必要字段'}), 400

        user_id = session['user_id']

        with get_db_connection('attention_db') as conn:
            cursor = conn.cursor()
            cursor.executemany('''
                INSERT INTO attention_results 
                (group_number, stimulus, is_target, response, 
                 reaction_time, score, timestamp, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', [
                (
                    trial['group'],
                    trial['stimulus'],
                    trial['isTarget'],
                    trial['response'],
                    trial['rt'],
                    trial['score'],
                    datetime.fromtimestamp(trial['timestamp'] / 1000).strftime('%Y-%m-%d %H:%M:%S'),
                    user_id
                ) for trial in data
            ])
            conn.commit()

        return jsonify({'success': True, 'message': '注意力测验数据提交成功'}), 200

    except Exception as e:
        app.logger.error(f'提交注意力测验数据失败: {str(e)}', exc_info=True)
        return jsonify({'success': False, 'error': '提交失败'}), 500


# 初始化应用
def initialize_app():
    setup_logging()
    init_user_db()
    init_experiment_db()
    init_attention_db()

    # 检查数据库连接
    for db_name in DB_CONFIG:
        try:
            conn = get_db_connection(db_name)
            conn.execute("SELECT 1")
            conn.close()
            app.logger.info(f"数据库连接正常: {db_name}")
        except Exception as e:
            app.logger.error(f"无法连接数据库: {db_name}: {e}")


@app.route('/api/get-user-id')
@login_required
def get_user_id():
    return jsonify({'user_id': session['user_id']})


if __name__ == '__main__':
    initialize_app()
    app.run(host='0.0.0.0', port=5000, debug=os.getenv('FLASK_DEBUG', 'False') == 'True')