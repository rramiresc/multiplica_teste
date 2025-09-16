import os
import pandas as pd
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, send_file, make_response
from flask_sqlalchemy import SQLAlchemy
import json
import numpy as np
import functools
from datetime import datetime, timedelta, date
import pytz
import zipfile
from io import BytesIO
import hashlib
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_, func, cast, String, case, distinct, tuple_, inspect
from collections import defaultdict
import glob
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from threading import Thread
import base64

# Inicializar o Flask
app = Flask(__name__)

# Configuração do SQLAlchemy com a string de conexão do Render
DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set.")
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Chave secreta da sessão
app.secret_key = os.environ.get('SESSION_SECRET_KEY')
if not app.secret_key:
    raise ValueError("SESSION_SECRET_KEY environment variable is not set.")
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['ALLOWED_EXTENSIONS'] = {'xlsx'}
app.config['DOWNLOAD_FOLDER'] = 'downloads'

if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'])
if not os.path.exists(app.config['DOWNLOAD_FOLDER']):
    os.makedirs(app.config['DOWNLOAD_FOLDER'])

# Armazenamento em memória da base de participantes
PARTICIPANTES_DF = None

# Definir o fuso horário de São Paulo
SAO_PAULO_TIMEZONE = pytz.timezone('America/Sao_Paulo')

# Definição dos níveis de acesso (CORRIGIDO: CM tem acesso básico)
ACCESS_LEVELS = {
    'PM': 'basic_access',
    'PEC': 'intermediate_access',
    'FORMADOR': 'formador_access',
    'EFAPE': 'efape_access',
    'ADM': 'super_admin',
    'PC': 'no_access',
    'CM': 'basic_access'
}

ACCESS_HIERARCHY = {
    "no_access": 0,
    "basic_access": 1,
    "formador_access": 2,
    "efape_access": 3,
    "intermediate_access": 4,
    "full_access": 5,
    "super_admin": 6
}

ADMIN_CPF = "32302739825"
PASSWORD_FOR_ADMIN = "123"

# Funções de conversão e formatação de data e hora
def now_sp():
    return datetime.now(SAO_PAULO_TIMEZONE)

def format_datetime(dt):
    if isinstance(dt, datetime):
        return dt.astimezone(SAO_PAULO_TIMEZONE).strftime('%d/%m/%Y %H:%M:%S')
    return dt

def format_date(d):
    if isinstance(d, datetime):
        return d.astimezone(SAO_PAULO_TIMEZONE).strftime('%d/%m/%Y')
    return d

def format_time(t):
    if isinstance(t, datetime):
        return t.astimezone(SAO_PAULO_TIMEZONE).strftime('%H:%M')
    return t

# Criptografar senha
def hash_password(password):
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

# Modelo do Banco de Dados
class Acompanhamento(db.Model):
    __tablename__ = 'acompanhamento'
    id = db.Column(db.Integer, primary_key=True)
    responsavel_acompanhamento = db.Column(db.String)
    turma = db.Column(db.String)
    tema = db.Column(db.String)
    pauta = db.Column(db.String)
    formador_assistido = db.Column(db.String)
    formador_presente = db.Column(db.String)
    formador_camera = db.Column(db.String)
    formador_fundo = db.Column(db.String)
    encontro_realizado = db.Column(db.String)
    dia_semana_encontro = db.Column(db.String)
    horario_encontro = db.Column(db.String)
    esperado_participantes = db.Column(db.Integer)
    real_participantes = db.Column(db.Integer)
    camera_aberta_participantes = db.Column(db.Integer)
    motivo_nao_ocorrencia = db.Column(db.String)
    data_encontro = db.Column(db.Date)
    semana = db.Column(db.String)
    observacao = db.Column(db.String)

class Presenca(db.Model):
    __tablename__ = 'presenca'
    id = db.Column(db.Integer, primary_key=True)
    diretoria_de_ensino_resp = db.Column(db.String)
    responsavel = db.Column(db.String)
    substituicao_ocorreu = db.Column(db.String)
    nome_substituto = db.Column(db.String)
    tema = db.Column(db.String)
    turma = db.Column(db.String)
    data_formacao = db.Column(db.Date)
    pauta = db.Column(db.String)
    observacao = db.Column(db.String)
    nome_participante = db.Column(db.String)
    cpf_participante = db.Column(db.String)
    escola_participante = db.Column(db.String)
    de_participante = db.Column(db.String)
    presenca = db.Column(db.String)
    camera = db.Column(db.String)
    di_participante = db.Column(db.String)
    pei_participante = db.Column(db.String)
    declinou_participante = db.Column(db.String)

class Avaliacao(db.Model):
    __tablename__ = 'avaliacao'
    id = db.Column(db.Integer, primary_key=True)
    observador = db.Column(db.String)
    funcao = db.Column(db.String)
    data_acompanhamento = db.Column(db.Date)
    data_feedback = db.Column(db.Date)
    observado = db.Column(db.String)
    cpf_observado = db.Column(db.String)
    diretoria_de_ensino = db.Column(db.String)
    escola = db.Column(db.String)
    tema_observado = db.Column(db.String)
    codigo_turma = db.Column(db.String)
    pauta_formativa = db.Column(db.String)
    link_gravacao = db.Column(db.String)
    q1_1 = db.Column(db.String)
    q1_2 = db.Column(db.String)
    q1_3 = db.Column(db.String)
    q2_1 = db.Column(db.String)
    q2_2 = db.Column(db.String)
    q2_3 = db.Column(db.String)
    q3_1 = db.Column(db.String)
    q3_2 = db.Column(db.String)
    q3_3 = db.Column(db.String)
    q4_1 = db.Column(db.String)
    q4_2 = db.Column(db.String)
    q4_3 = db.Column(db.String)
    q5_1 = db.Column(db.String)
    q5_2 = db.Column(db.String)
    q5_3 = db.Column(db.String)
    feedback_estruturado = db.Column(db.String)
    observacoes_gerais = db.Column(db.String)
    nota_final = db.Column(db.Float)

class Demanda(db.Model):
    __tablename__ = 'demandas'
    id = db.Column(db.Integer, primary_key=True)
    pec = db.Column(db.String)
    cpf_pec = db.Column(db.String)
    semana = db.Column(db.String)
    caff = db.Column(db.String)
    diretoria_de_ensino = db.Column(db.String)
    formacoes_realizadas = db.Column(db.Integer)
    alinhamento_semanal = db.Column(db.String)
    alinhamento_geral = db.Column(db.String)
    visitas_escolas = db.Column(db.String)
    escolas_visitadas = db.Column(db.String)
    pm_orientados = db.Column(db.Integer)
    cursistas_orientados = db.Column(db.Integer)
    pm_orientados_esperado = db.Column(db.Integer)
    cursistas_orientados_esperado = db.Column(db.Integer)
    rubricas_preenchidas = db.Column(db.Integer)
    feedbacks_realizados = db.Column(db.Integer)
    substituicoes_realizadas = db.Column(db.Integer)
    engajamento = db.Column(db.String)
    observacao = db.Column(db.String)

class Ateste(db.Model):
    __tablename__ = 'ateste'
    id = db.Column(db.Integer, primary_key=True)
    responsavel_base = db.Column(db.String)
    nome_quem_preencheu = db.Column(db.String)
    tema = db.Column(db.String)
    turma = db.Column(db.String)
    data_formacao = db.Column(db.Date)
    diretoria_de_ensino = db.Column(db.String)
    escola = db.Column(db.String)
    cpf = db.Column(db.String)
    valor_formacao = db.Column(db.Float)

class Usuario(db.Model):
    __tablename__ = 'usuarios'
    id = db.Column(db.Integer, primary_key=True)
    cpf = db.Column(db.String, unique=True, nullable=False)
    password_hash = db.Column(db.String, nullable=False)
    access_level = db.Column(db.String)

class Aviso(db.Model):
    __tablename__ = 'avisos'
    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String, nullable=False)
    conteudo = db.Column(db.Text, nullable=False)
    imagem_url = db.Column(db.String)

class Link(db.Model):
    __tablename__ = 'links'
    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String, nullable=False)
    descricao = db.Column(db.String)
    url = db.Column(db.String, nullable=False)
    imagem_url = db.Column(db.String)

class HiddenElement(db.Model):
    __tablename__ = 'hidden_elements'
    id = db.Column(db.Integer, primary_key=True)
    element_id = db.Column(db.String, unique=True, nullable=False)
    is_hidden = db.Column(db.Boolean, default=False)
    
class Ocorrencia(db.Model):
    __tablename__ = 'ocorrencias'
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String)
    email = db.Column(db.String)
    telefone = db.Column(db.String)
    turma = db.Column(db.String)
    tema = db.Column(db.String)
    tipo_ocorrencia = db.Column(db.String)
    outra_ocorrencia_desc = db.Column(db.String)
    descricao_problema = db.Column(db.String)
    ocorrencia_ainda_ocorre = db.Column(db.String)
    nivel_impacto = db.Column(db.String)
    data_horario = db.Column(db.DateTime)

class Visita(db.Model):
    __tablename__ = 'visitas'
    id = db.Column(db.Integer, primary_key=True)
    responsavel_visitacao = db.Column(db.String)
    encontro_aconteceu = db.Column(db.String)
    motivo_nao_aconteceu = db.Column(db.String)
    observacao = db.Column(db.String)
    turma = db.Column(db.String)
    tema = db.Column(db.String)
    data_formacao = db.Column(db.Date)
    dia_mes = db.Column(db.Integer)
    dia_semana = db.Column(db.String)
    horario = db.Column(db.String)
    url = db.Column(db.String)
    tenant = db.Column(db.String)
    segmento = db.Column(db.String)
    nome_responsavel_base = db.Column(db.String)
    cpf_responsavel_base = db.Column(db.String)
    email = db.Column(db.String)
    mes = db.Column(db.Integer)

# Mapeamento para deleção e edição de registros
MODEL_MAP = {
    'presenca': Presenca,
    'acompanhamento': Acompanhamento,
    'avaliacao': Avaliacao,
    'demandas': Demanda,
    'ateste': Ateste,
    'usuarios': Usuario,
    'avisos': Aviso,
    'links': Link,
    'ocorrencias': Ocorrencia,
    'visitas': Visita,
}

# Lista de tabelas que podem ser editadas pelo modal
EDITABLE_TABLES = ['presenca', 'acompanhamento', 'avaliacao', 'demandas', 'ateste', 'ocorrencias', 'visitas']

# Função para carregar a base de participantes
def load_participants_base():
    """Carrega a base de dados de participantes a partir de um arquivo Excel e a armazena em memória."""
    global PARTICIPANTES_DF
    file_path = 'participantes_base_editavel.xlsx'
    try:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Arquivo '{file_path}' não encontrado.")
            
        PARTICIPANTES_DF = pd.read_excel(file_path)
        PARTICIPANTES_DF.columns = PARTICIPANTES_DF.columns.str.lower().str.strip().str.replace(' ', '_')
        PARTICIPANTES_DF.rename(columns={'nome_completo': 'nome'}, inplace=True)
        if 'cpf' in PARTICIPANTES_DF.columns:
            PARTICIPANTES_DF['cpf'] = PARTICIPANTES_DF['cpf'].astype(str).str.replace(r'\.0$', '', regex=True)
        PARTICIPANTES_DF.replace({np.nan: None}, inplace=True)
        print("Base de participantes carregada com sucesso!")
        return True
    except FileNotFoundError as e:
        print(f"AVISO: {e}")
        PARTICIPANTES_DF = pd.DataFrame(columns=['nome', 'cpf', 'escola', 'diretoria_de_ensino', 'tema', 'responsavel', 'turma', 'etapa', 'di', 'pei', 'declinou'])
        return False
    except Exception as e:
        print(f"ERRO: Não foi possível carregar a base de participantes. {e}")
        PARTICIPANTES_DF = pd.DataFrame(columns=['nome', 'cpf', 'escola', 'diretoria_de_ensino', 'tema', 'responsavel', 'turma', 'etapa', 'di', 'pei', 'declinou'])
        return False

# Carregar a base de dados na inicialização
load_participants_base()

# Funções auxiliares para manipulação de datas (semana de domingo a sábado)
def get_sunday_of_week(year, week_num):
    first_day_of_year = datetime(year, 1, 1).date()
    if first_day_of_year.weekday() <= 3:
        start_of_iso_week_one = first_day_of_year - timedelta(days=first_day_of_year.weekday())
    else:
        start_of_iso_week_one = first_day_of_year + timedelta(days=(7 - first_day_of_year.weekday()))
    
    sunday_of_our_week = start_of_iso_week_one + timedelta(weeks=week_num - 1) - timedelta(days=1)
    
    return sunday_of_our_week

def get_saturday_of_week(year, week_num):
    sunday_of_our_week = get_sunday_of_week(year, week_num)
    saturday_of_our_week = sunday_of_our_week + timedelta(days=6)
    return saturday_of_our_week

# Decorador para verificar autenticação e nível de acesso
def login_required(access_level_required):
    def wrapper(fn):
        @functools.wraps(fn)
        def decorated_view(*args, **kwargs):
            if 'user_cpf' not in session:
                return redirect(url_for('login'))
            
            user_access_level = session.get('access_level', 'no_access')
            
            if ACCESS_HIERARCHY.get(user_access_level, 0) < ACCESS_HIERARCHY.get(access_level_required, 0):
                if request.is_json or request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return jsonify({'error': 'Acesso negado. Nível de permissão insuficiente.'}), 403
                return redirect(url_for('login', error="Acesso negado. Nível de permissão insuficiente."))
            
            return fn(*args, **kwargs)
        return decorated_view
    return wrapper
    
def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

# Criar as tabelas no banco de dados se não existirem
with app.app_context():
    db.create_all()

# Rotas de Autenticação
@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'user_cpf' in session:
        return redirect(url_for('index'))

    error = request.args.get('error')
    if request.method == 'POST':
        session.clear()
        cpf = request.form.get('cpf').strip()
        password = request.form.get('password').strip()

        # Lógica especial para o Super Admin inicial
        if cpf == ADMIN_CPF and password == PASSWORD_FOR_ADMIN:
            user_in_db = Usuario.query.filter_by(cpf=cpf).first()
            if not user_in_db:
                new_user = Usuario(
                    cpf=cpf,
                    password_hash=hash_password(password),
                    access_level='super_admin'
                )
                db.session.add(new_user)
                db.session.commit()
            
            session['user_cpf'] = cpf
            session['access_level'] = 'super_admin'
            return redirect(url_for('index'))

        user = Usuario.query.filter_by(cpf=cpf).first()

        if user:
            if hash_password(password) == user.password_hash:
                session['user_cpf'] = user.cpf
                session['access_level'] = user.access_level
                
                user_in_data = PARTICIPANTES_DF[PARTICIPANTES_DF['cpf'] == user.cpf].to_dict('records')
                if user_in_data:
                    etapa_list = [d.get('etapa') for d in user_in_data if d.get('etapa')]
                    access_levels_found = [ACCESS_LEVELS.get(etapa) for etapa in etapa_list if ACCESS_LEVELS.get(etapa)]
                    
                    highest_access_level = "no_access"
                    if access_levels_found:
                        highest_access_level = max(access_levels_found, key=lambda x: ACCESS_HIERARCHY.get(x, -1))
                    
                    if ACCESS_HIERARCHY.get(highest_access_level, 0) > ACCESS_HIERARCHY.get(user.access_level, 0):
                        user.access_level = highest_access_level
                        db.session.commit()
                        session['access_level'] = highest_access_level
                        
                return redirect(url_for('index'))
            else:
                error = "Senha incorreta."
        else:
            user_in_data = PARTICIPANTES_DF[PARTICIPANTES_DF['cpf'] == cpf].to_dict('records')
            if user_in_data:
                etapa_list = [d.get('etapa') for d in user_in_data if d.get('etapa')]
                access_levels_found = [ACCESS_LEVELS.get(etapa) for etapa in etapa_list if ACCESS_LEVELS.get(etapa)]
                
                highest_access_level = "no_access"
                if access_levels_found:
                    highest_access_level = max(access_levels_found, key=lambda x: ACCESS_HIERARCHY.get(x, -1))
                
                if highest_access_level == "no_access":
                    error = "Seu perfil não tem permissão de acesso ao sistema."
                else:
                    return redirect(url_for('register', cpf=cpf))
            else:
                return redirect(url_for('register', cpf=cpf))

    return render_template('login_cpf.html', error=error)

@app.route('/forgot_password', methods=['GET', 'POST'])
def forgot_password():
    error = None
    if request.method == 'POST':
        cpf = request.form.get('cpf').strip()
        
        user_in_db = Usuario.query.filter_by(cpf=cpf).first()
        if user_in_db:
            return redirect(url_for('reset_password', cpf=cpf))
        else:
            error = "CPF não encontrado em nossa base de usuários. Por favor, registre-se primeiro."
    
    return render_template('forgot_password.html', error=error)

@app.route('/reset_password', methods=['GET', 'POST'])
def reset_password():
    cpf = request.args.get('cpf')
    if not cpf:
        return redirect(url_for('login', error="CPF não fornecido para reset de senha."))

    user = Usuario.query.filter_by(cpf=cpf).first()
    if not user:
        return redirect(url_for('login', error="Usuário não encontrado."))

    error = None
    if request.method == 'POST':
        new_password = request.form.get('new_password')
        if not new_password:
            error = "A nova senha é obrigatória."
        else:
            user.password_hash = hash_password(new_password)
            db.session.commit()
            return redirect(url_for('login', error="Senha alterada com sucesso! Por favor, faça login."))
            
    return render_template('reset_password.html', cpf=cpf, error=error)

@app.route('/register', methods=['GET', 'POST'])
def register():
    cpf = request.args.get('cpf')
    if not cpf:
        return redirect(url_for('login', error="CPF não fornecido."))
    
    user_in_db = Usuario.query.filter_by(cpf=cpf).first()
    if user_in_db:
        return redirect(url_for('login', error="Usuário já registrado. Por favor, faça login."))

    if request.method == 'POST':
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')

        if password != confirm_password:
            return render_template('register.html', cpf=cpf, error="As senhas não coincidem.")
            
        if not password or len(password) < 6:
            return render_template('register.html', cpf=cpf, error="A senha é obrigatória e deve ter pelo menos 6 caracteres.")

        hashed_password = hash_password(password)

        user_in_data = PARTICIPANTES_DF[PARTICIPANTES_DF['cpf'] == cpf].to_dict('records')
        access_level_to_assign = 'no_access'
        if user_in_data:
            etapa_list = [d.get('etapa') for d in user_in_data if d.get('etapa')]
            access_levels_found = [ACCESS_LEVELS.get(etapa) for etapa in etapa_list if ACCESS_LEVELS.get(etapa)]
            if access_levels_found:
                access_level_to_assign = max(access_levels_found, key=lambda x: ACCESS_HIERARCHY.get(x, -1))
            
        new_user = Usuario(cpf=cpf, password_hash=hashed_password, access_level=access_level_to_assign)
        try:
            db.session.add(new_user)
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return redirect(url_for('login', error="Usuário já registrado. Por favor, faça login."))
        
        session['user_cpf'] = new_user.cpf
        session['access_level'] = new_user.access_level
        return redirect(url_for('index'))

    return render_template('register.html', cpf=cpf, error=None)

@app.route('/logout')
def logout():
    session.pop('user_cpf', None)
    session.pop('access_level', None)
    return redirect(url_for('login'))

@app.route('/get_access_level')
def get_access_level():
    current_level = session.get('access_level', 'none')
    return jsonify({'access_level': current_level})

@app.route('/health')
def health_check():
    return '', 200

# Rota para obter as informações do usuário logado
@app.route('/get_user_info')
@login_required("basic_access")
def get_user_info():
    user_cpf = session.get('user_cpf')
    if not user_cpf:
        return jsonify({'error': 'Usuário não logado'}), 401
    
    global PARTICIPANTES_DF
    user_info = PARTICIPANTES_DF[PARTICIPANTES_DF['cpf'] == user_cpf].to_dict('records')
    if user_info:
        user_info = user_info[0]
        return jsonify({
            'nome': user_info.get('nome', 'N/A'),
            'cpf': user_info.get('cpf', 'N/A'),
            'diretoria_de_ensino': user_info.get('diretoria_de_ensino', 'N/A'),
            'etapa': user_info.get('etapa', 'N/A'),
            'access_level': session.get('access_level'),
            'responsavel': user_info.get('responsavel', 'N/A')
        })
    else:
        user_in_db = Usuario.query.filter_by(cpf=user_cpf).first()
        if user_in_db:
             return jsonify({
                'nome': 'N/A',
                'cpf': user_in_db.cpf,
                'diretoria_de_ensino': 'N/A',
                'etapa': 'N/A',
                'access_level': user_in_db.access_level
            })
        return jsonify({'error': 'Informações do usuário não encontradas na base de dados'}), 404

@app.route('/get_all_datalists')
@login_required("basic_access")
def get_all_datalists():
    try:
        data = {}
        global PARTICIPANTES_DF
        if PARTICIPANTES_DF is None or PARTICIPANTES_DF.empty:
            return jsonify({'error': 'Base de participantes não carregada ou vazia.'}), 500

        all_participants = PARTICIPANTES_DF
        
        data['turmas'] = sorted(list(all_participants['turma'].dropna().unique()))
        data['diretorias'] = sorted(list(all_participants['diretoria_de_ensino'].dropna().unique()))
        if "FORMADOR EFAPE" not in data['diretorias']:
            data['diretorias'].append("FORMADOR EFAPE")
        data['diretorias'].sort()
        data['responsaveis'] = sorted(list(all_participants['responsavel'].dropna().unique()))
        data['nomes'] = sorted(list(set(all_participants['nome'].dropna().unique()) | set(all_participants['responsavel'].dropna().unique())))
        data['pecs'] = sorted(list(all_participants[all_participants['etapa'].str.contains('PEC', na=False)]['nome'].dropna().unique()))
        data['caffs'] = sorted([
            'JULIANA VOLPE DE FREITAS',
            'RENATA KELLY DOS SANTOS LOBAO',
            'ROBERTO SERAGLIA MARTINS',
            'STEFANI DE SOUZA MENEZES',
            'AINDA NÃO TENHO CAFF'
        ])
        
        pautas_numericas = [str(i) for i in range(0, 17)]
        pautas_desdobramento = [f"Desdobramento {i}" for i in range(1, 9)]
        data['pautas_formativas'] = pautas_numericas + pautas_desdobramento
        data['temas'] = sorted(list(all_participants['tema'].dropna().unique()))
        data['cpfs'] = sorted(list(all_participants['cpf'].dropna().unique()))

        return jsonify(data)
    except Exception as e:
        app.logger.error(f"Erro ao carregar todas as datalists: {e}")
        return jsonify({'error': 'Erro interno ao carregar dados.'}), 500

@app.route('/get_pecs_and_formadores', methods=['GET'])
@login_required("basic_access")
def get_pecs_and_formadores():
    try:
        global PARTICIPANTES_DF
        if PARTICIPANTES_DF is not None and not PARTICIPANTES_DF.empty:
            observadores = PARTICIPANTES_DF[
                PARTICIPANTES_DF['etapa'].isin(['PEC', 'FORMADOR'])
            ]['nome'].dropna().unique()
            return jsonify(sorted(list(observadores)))
        return jsonify([])
    except Exception as e:
        app.logger.error(f"Erro ao carregar lista de PECs e Formadores: {e}")
        return jsonify([]), 500

@app.route('/get_responsaveis_for_presenca', methods=['GET'])
@login_required("basic_access")
def get_responsaveis_for_presenca():
    try:
        global PARTICIPANTES_DF
        if PARTICIPANTES_DF is not None and not PARTICIPANTES_DF.empty:
            responsaveis = PARTICIPANTES_DF['responsavel'].dropna().unique()
            return jsonify(sorted(list(responsaveis)))
        return jsonify([])
    except Exception as e:
        app.logger.error(f"Erro ao carregar lista de responsáveis de presença: {e}")
        return jsonify([]), 500

@app.route('/get_temas_by_responsavel')
@login_required("basic_access")
def get_temas_by_responsavel():
    responsavel = request.args.get('responsavel')
    global PARTICIPANTES_DF
    if responsavel and PARTICIPANTES_DF is not None and not PARTICIPANTES_DF.empty:
        filtered_temas = PARTICIPANTES_DF[PARTICIPANTES_DF['responsavel'] == responsavel]['tema'].dropna().unique()
        return jsonify(sorted(list(filtered_temas)))
    return jsonify(sorted(list(PARTICIPANTES_DF['tema'].dropna().unique())))

@app.route('/get_turmas_by_tema_and_responsavel')
@login_required("basic_access")
def get_turmas_by_tema_and_responsavel():
    responsavel = request.args.get('responsavel')
    tema = request.args.get('tema')
    global PARTICIPANTES_DF
    if responsavel and tema and PARTICIPANTES_DF is not None and not PARTICIPANTES_DF.empty:
        filtered_turmas = PARTICIPANTES_DF[
            (PARTICIPANTES_DF['responsavel'] == responsavel) & 
            (PARTICIPANTES_DF['tema'] == tema)
        ]['turma'].dropna().unique()
        return jsonify(sorted(list(filtered_turmas)))
    return jsonify([])

@app.route('/get_turmas_by_tema_and_responsavel_basic')
@login_required("basic_access")
def get_turmas_by_tema_and_responsavel_basic():
    responsavel = request.args.get('responsavel')
    tema = request.args.get('tema')
    global PARTICIPANTES_DF
    if responsavel and tema and PARTICIPANTES_DF is not None and not PARTICIPANTES_DF.empty:
        filtered_turmas = PARTICIPANTES_DF[
            (PARTICIPANTES_DF['responsavel'] == responsavel) & 
            (PARTICIPANTES_DF['tema'] == tema)
        ]['turma'].dropna().unique()
        return jsonify(sorted(list(filtered_turmas)))
    return jsonify([])

@app.route('/get_schools_by_de')
@login_required("intermediate_access")
def get_schools_by_de():
    diretoria = request.args.get('diretoria')
    global PARTICIPANTES_DF
    if diretoria and PARTICIPANTES_DF is not None and not PARTICIPANTES_DF.empty:
        escolas = PARTICIPANTES_DF[PARTICIPANTES_DF['diretoria_de_ensino'] == diretoria]['escola'].dropna().unique()
        return jsonify(sorted(list(escolas)))
    return jsonify([])

@app.route('/get_counts_by_schools')
@login_required("intermediate_access")
def get_counts_by_schools():
    escolas_str = request.args.get('escolas')
    global PARTICIPANTES_DF
    if escolas_str and PARTICIPANTES_DF is not None and not PARTICIPANTES_DF.empty:
        escolas = escolas_str.split(',')
        filtered_df = PARTICIPANTES_DF[PARTICIPANTES_DF['escola'].isin(escolas)]
        
        pm_count = filtered_df[filtered_df['etapa'].str.contains('PM', na=False)]['cpf'].nunique()
        pc_count = filtered_df[filtered_df['etapa'].str.contains('PC', na=False)]['cpf'].nunique()

        pm_total = PARTICIPANTES_DF[
            (PARTICIPANTES_DF['escola'].isin(escolas)) & 
            (PARTICIPANTES_DF['etapa'].str.contains('PM', na=False))
        ]['cpf'].nunique()
        pc_total = PARTICIPANTES_DF[
            (PARTICIPANTES_DF['escola'].isin(escolas)) & 
            (PARTICIPANTES_DF['etapa'].str.contains('PC', na=False))
        ]['cpf'].nunique()
        
        return jsonify({
            'pm_count': int(pm_count),
            'pc_count': int(pc_count),
            'pm_total': int(pm_total),
            'pc_total': int(pc_total)
        })
    return jsonify({'pm_count': 0, 'pc_count': 0, 'pm_total': 0, 'pc_total': 0})

@app.route('/get_info_by_nome_or_cpf')
@login_required("intermediate_access")
def get_info_by_nome_or_cpf():
    search_term = request.args.get('search_term')
    global PARTICIPANTES_DF
    if search_term and PARTICIPANTES_DF is not None and not PARTICIPANTES_DF.empty:
        filtered_df = PARTICIPANTES_DF[
            (PARTICIPANTES_DF['cpf'] == search_term) |
            (PARTICIPANTES_DF['nome'].str.lower() == search_term.lower())
        ]
        
        if not filtered_df.empty:
            user_data = filtered_df.iloc[0].to_dict()
            
            temas = filtered_df['tema'].dropna().unique()
            turmas = filtered_df['turma'].dropna().unique()
            
            response_data = {
                'cpf': user_data.get('cpf', 'N/A'),
                'nome': user_data.get('nome', 'N/A'),
                'diretoria_de_ensino': user_data.get('diretoria_de_ensino', 'N/A'),
                'escola': user_data.get('escola', 'N/A'),
                'temas': sorted(list(temas)),
                'turmas': sorted(list(turmas))
            }
            return jsonify(response_data)
    return jsonify({})

@app.route('/get_participantes_by_turma')
@login_required("basic_access")
def get_participantes_by_turma():
    turma = request.args.get('turma')
    global PARTICIPANTES_DF
    if turma and PARTICIPANTES_DF is not None and not PARTICIPANTES_DF.empty:
        filtered_df = PARTICIPANTES_DF[PARTICIPANTES_DF['turma'] == turma].copy()
        
        participantes = filtered_df.to_dict('records')
        
        participantes_ordenados = sorted(participantes, key=lambda p: p['nome'])
        
        return jsonify(participantes_ordenados)
    return jsonify([])

@app.route('/get_formador_assistido')
@login_required("efape_access")
def get_formador_assistido():
    turma = request.args.get('turma')
    global PARTICIPANTES_DF
    if turma and PARTICIPANTES_DF is not None and not PARTICIPANTES_DF.empty:
        formador = PARTICIPANTES_DF[PARTICIPANTES_DF['turma'] == turma]['responsavel'].iloc[0] if not PARTICIPANTES_DF[PARTICIPANTES_DF['turma'] == turma].empty else None
        if formador:
            return jsonify([formador])
    return jsonify([])

@app.route('/get_tema_by_turma')
@login_required("efape_access")
def get_tema_by_turma():
    turma = request.args.get('turma')
    global PARTICIPANTES_DF
    if turma and PARTICIPANTES_DF is not None and not PARTICIPANTES_DF.empty:
        tema = PARTICIPANTES_DF[PARTICIPANTES_DF['turma'] == turma]['tema'].iloc[0] if not PARTICIPANTES_DF[PARTICIPANTES_DF['turma'] == turma].empty else None
        if tema:
            return jsonify([tema])
    return jsonify([])

@app.route('/submit_acompanhamento', methods=['POST'])
@login_required("efape_access")
def submit_acompanhamento():
    try:
        data = request.json
        responsavel_acompanhamento = data.get('responsavel_acompanhamento')
        turma = data.get('turma')
        data_encontro_str = data.get('data_encontro')
        
        if not responsavel_acompanhamento or not turma or not data_encontro_str:
            return jsonify({'success': False, 'message': 'Dados obrigatórios faltando para o acompanhamento.'}), 400

        data_encontro_dt = datetime.strptime(data_encontro_str, '%Y-%m-%d').date()

        existing_record = Acompanhamento.query.filter_by(
            responsavel_acompanhamento=responsavel_acompanhamento,
            turma=turma,
            data_encontro=data_encontro_dt
        ).first()

        if existing_record:
            return jsonify({'success': False, 'message': f'Já existe um registro de acompanhamento para o responsável {responsavel_acompanhamento} na turma {turma} nesta data.'}), 409

        semana_encontro = data_encontro_dt.isocalendar()[1]
        ano_encontro = data_encontro_dt.year
        semana_str = f"{ano_encontro}-W{semana_encontro:02}"
        
        observacao = data.get('observacao_acompanhamento')

        if data.get('encontro_realizado') == 'Não':
            motivo = data.get('motivo_nao_ocorrencia')
            if not motivo:
                 return jsonify({'success': False, 'message': 'Motivo da não realização do encontro é obrigatório.'}), 400
            
            new_acompanhamento = Acompanhamento(
                responsavel_acompanhamento=responsavel_acompanhamento,
                turma=turma,
                tema=data.get('tema'),
                pauta=data.get('pauta'),
                formador_assistido=data.get('formador_assistido'),
                encontro_realizado='Não',
                motivo_nao_ocorrencia=motivo,
                data_encontro=data_encontro_dt,
                semana=semana_str,
                observacao=observacao
            )
        else:
            formador_assistido_final = data.get('nome_substituto') if data.get('formador_substituicao') == 'nao_se_aplica' else data.get('formador_assistido')
            new_acompanhamento = Acompanhamento(
                responsavel_acompanhamento=responsavel_acompanhamento,
                turma=turma,
                tema=data.get('tema'),
                pauta=data.get('pauta'),
                formador_assistido=formador_assistido_final,
                formador_presente=data.get('formador_presente'),
                formador_camera=data.get('formador_camera'),
                formador_fundo=data.get('formador_fundo'),
                encontro_realizado='Sim',
                dia_semana_encontro=data.get('dia_semana_encontro'),
                horario_encontro=data.get('horario_encontro'),
                esperado_participantes=int(data.get('esperado_participantes') or 0),
                real_participantes=int(data.get('real_participantes') or 0),
                camera_aberta_participantes=int(data.get('camera_aberta_participantes') or 0),
                data_encontro=data_encontro_dt,
                semana=semana_str,
                observacao=observacao
            )

        db.session.add(new_acompanhamento)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Acompanhamento salvo com sucesso!'})

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Erro em /submit_acompanhamento: {e}")
        return jsonify({'success': False, 'message': f'Erro ao salvar acompanhamento: {e}'}), 500

@app.route('/submit_presenca', methods=['POST'])
@login_required("basic_access")
def submit_presenca():
    try:
        data = request.json
        responsavel_presenca = data.get('responsavel_presenca')
        tema_presenca = data.get('tema_presenca')
        turma_presenca = data.get('turma_presenca')
        data_formacao_str = data.get('data_formacao_presenca')
        substituicao_ocorreu = data.get('substituicao_ocorreu', 'Não')
        nome_substituto = data.get('nome_substituto')
        diretoria_presenca = data.get('diretoria_presenca')
        observacao_presenca = data.get('observacao_presenca')

        if not responsavel_presenca or not turma_presenca or not data_formacao_str or not tema_presenca:
            return jsonify({'success': False, 'message': 'Dados obrigatórios faltando para o registro de presença.'}), 400

        data_formacao_dt = datetime.strptime(data_formacao_str, '%Y-%m-%d').date()

        existing_record = Presenca.query.filter_by(
            responsavel=responsavel_presenca,
            tema=tema_presenca,
            turma=turma_presenca,
            data_formacao=data_formacao_dt
        ).first()

        if existing_record:
            return jsonify({'success': False, 'message': f'Já existe um registro de presença para esta turma ({turma_presenca}) com este responsável ({responsavel_presenca}) e tema ({tema_presenca}) nesta data ({data_formacao_str}).'}), 409

        participantes_raw = data.get('participantes', {})
        for cpf, p_data in participantes_raw.items():
            new_presenca = Presenca(
                diretoria_de_ensino_resp=diretoria_presenca,
                responsavel=responsavel_presenca,
                substituicao_ocorreu=substituicao_ocorreu,
                nome_substituto=nome_substituto if substituicao_ocorreu == 'Sim' else None,
                tema=tema_presenca,
                turma=turma_presenca,
                data_formacao=data_formacao_dt,
                pauta=data.get('pauta_presenca'),
                observacao=observacao_presenca,
                nome_participante=p_data.get('nome'),
                cpf_participante=p_data.get('cpf'),
                escola_participante=p_data.get('escola'),
                de_participante=p_data.get('diretoria_de_ensino'),
                presenca=p_data.get('presenca'),
                camera=p_data.get('camera'),
                di_participante=p_data.get('di'),
                pei_participante=p_data.get('pei'),
                declinou_participante=p_data.get('declinou')
            )
            db.session.add(new_presenca)
        
        global PARTICIPANTES_DF
        
        nome_quem_preencheu = nome_substituto if substituicao_ocorreu == 'Sim' else responsavel_presenca
        
        ateste_data_in_base = PARTICIPANTES_DF[
            (PARTICIPANTES_DF['nome'] == nome_quem_preencheu)
        ].to_dict('records')

        if ateste_data_in_base:
            ateste_record_exists = Ateste.query.filter_by(
                nome_quem_preencheu=nome_quem_preencheu,
                tema=tema_presenca,
                turma=turma_presenca,
                data_formacao=data_formacao_dt
            ).first()

            if not ateste_record_exists:
                ateste_data = ateste_data_in_base[0]
                new_ateste = Ateste(
                    responsavel_base=ateste_data.get('responsavel'),
                    nome_quem_preencheu=nome_quem_preencheu,
                    tema=tema_presenca,
                    turma=turma_presenca,
                    data_formacao=data_formacao_dt,
                    diretoria_de_ensino=ateste_data.get('diretoria_de_ensino'),
                    escola=ateste_data.get('escola'),
                    cpf=ateste_data.get('cpf'),
                    valor_formacao=152.04
                )
                db.session.add(new_ateste)

        db.session.commit()
        return jsonify({'success': True, 'message': 'Registro de presença salvo com sucesso!'})

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Erro em /submit_presenca: {e}")
        return jsonify({'success': False, 'message': f'Erro ao salvar registro de presença: {e}'}), 500

@app.route('/submit_avaliacao', methods=['POST'])
@login_required("intermediate_access")
def submit_avaliacao():
    try:
        data = request.json
        observador = data.get('nome_observador_avaliacao')
        cpf_observado = data.get('cpf_observado_avaliacao')
        data_acompanhamento_str = data.get('data_acompanhamento_avaliacao')
        
        if not observador or not cpf_observado or not data_acompanhamento_str:
             return jsonify({'success': False, 'message': 'Dados obrigatórios faltando para a avaliação.'}), 400

        data_acompanhamento_dt = datetime.strptime(data_acompanhamento_str, '%Y-%m-%d').date()

        existing_record = Avaliacao.query.filter_by(
            observador=observador,
            cpf_observado=cpf_observado,
            data_acompanhamento=data_acompanhamento_dt
        ).first()

        if existing_record:
            return jsonify({'success': False, 'message': f'Já existe uma avaliação para o observado {cpf_observado} feita por {observador} na data {data_acompanhamento_str}.'}), 409

        new_avaliacao = Avaliacao(
            observador=observador,
            funcao=data.get('funcao_avaliacao'),
            data_acompanhamento=data_acompanhamento_dt,
            data_feedback=datetime.strptime(data.get('data_feedback_avaliacao'), '%Y-%m-%d').date() if data.get('data_feedback_avaliacao') else None,
            observado=data.get('nome_observado_avaliacao'),
            cpf_observado=cpf_observado,
            diretoria_de_ensino=data.get('diretoria_de_ensino_avaliacao'),
            escola=data.get('escola_avaliacao'),
            tema_observado=data.get('tema_observado_avaliacao'),
            codigo_turma=data.get('codigo_turma_avaliacao'),
            pauta_formativa=data.get('pauta_formativa_avaliacao'),
            link_gravacao=data.get('link_gravacao_avaliacao'),
            q1_1=data.get('q1_1'), q1_2=data.get('q1_2'), q1_3=data.get('q1_3'),
            q2_1=data.get('q2_1'), q2_2=data.get('q2_2'), q2_3=data.get('q2_3'),
            q3_1=data.get('q3_1'), q3_2=data.get('q3_2'), q3_3=data.get('q3_3'),
            q4_1=data.get('q4_1'), q4_2=data.get('q4_2'), q4_3=data.get('q4_3'),
            q5_1=data.get('q5_1'), q5_2=data.get('q5_2'), q5_3=data.get('q5_3'),
            feedback_estruturado=data.get('feedback_estruturado_avaliacao'),
            observacoes_gerais=data.get('observacoes_gerais_avaliacao'),
            nota_final=float(data.get('nota_final_avaliacao'))
        )
        db.session.add(new_avaliacao)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Avaliação salva com sucesso!'})
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Erro em /submit_avaliacao: {e}")
        return jsonify({'success': False, 'message': f'Erro ao salvar avaliação: {e}'}), 500

@app.route('/submit_demandas', methods=['POST'])
@login_required("intermediate_access")
def submit_demandas():
    try:
        data = request.json
        pec_cpf = data.get('cpf_pec_demandas')
        semana = data.get('semana_demandas')
        
        if not pec_cpf or not semana:
            return jsonify({'success': False, 'message': 'Dados obrigatórios faltando para o registro de demandas.'}), 400

        existing_record = Demanda.query.filter_by(
            cpf_pec=pec_cpf,
            semana=semana
        ).first()

        if existing_record:
            return jsonify({'success': False, 'message': f'Já existe um registro de demanda para a semana {semana} feito pelo PEC de CPF {pec_cpf}.'}), 409
        
        alinhamento_geral = 'Não se aplica'

        pm_orientados_val = int(data.get('pm_orientados') or 0)
        cursistas_orientados_val = int(data.get('cursistas_orientados') or 0)

        new_demanda = Demanda(
            pec=data.get('pec_demandas'),
            cpf_pec=pec_cpf,
            semana=semana,
            caff=data.get('caff_demandas'),
            diretoria_de_ensino=data.get('diretoria_demandas'),
            formacoes_realizadas=int(data.get('formacoes_realizadas_demandas') or 0),
            alinhamento_semanal=data.get('alinhamento_semanal_demandas'),
            alinhamento_geral=alinhamento_geral,
            visitas_escolas=data.get('visitas_escolas_demandas'),
            escolas_visitadas=', '.join(data.get('escolas_visitadas', [])),
            pm_orientados=pm_orientados_val,
            cursistas_orientados=cursistas_orientados_val,
            pm_orientados_esperado=int(data.get('pm_orientados_esperado') or 0),
            cursistas_orientados_esperado=int(data.get('cursistas_orientados_esperado') or 0),
            rubricas_preenchidas=int(data.get('rubricas_preenchidas_demandas') or 0),
            feedbacks_realizados=int(data.get('feedbacks_realizados_demandas') or 0),
            substituicoes_realizadas=int(data.get('substituicoes_realizadas_demandas') or 0),
            engajamento=', '.join(data.get('engajamento', [])),
            observacao=data.get('observacao_demandas')
        )
        db.session.add(new_demanda)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Registro de demanda salvo com sucesso!'})
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Erro em /submit_demandas: {e}")
        return jsonify({'success': False, 'message': f'Erro ao salvar registro de demanda: {e}'}), 500

@app.route('/submit_ocorrencia', methods=['POST'])
@login_required('basic_access')
def submit_ocorrencia():
    try:
        data = request.json
        new_ocorrencia = Ocorrencia(
            nome=data.get('nome_ocorrencia'),
            email=data.get('email_ocorrencia'),
            telefone=data.get('telefone_ocorrencia'),
            turma=data.get('turma_ocorrencia'),
            tema=data.get('tema_ocorrencia'),
            tipo_ocorrencia=data.get('tipo_ocorrencia'),
            outra_ocorrencia_desc=data.get('outra_ocorrencia_desc'),
            descricao_problema=data.get('descricao_problema'),
            ocorrencia_ainda_ocorre=data.get('ocorrencia_ainda_ocorre'),
            nivel_impacto=data.get('nivel_impacto'),
            data_horario=now_sp()
        )
        db.session.add(new_ocorrencia)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Ocorrência registrada com sucesso!'})
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Erro em /submit_ocorrencia: {e}")
        return jsonify({'success': False, 'message': f'Erro ao salvar ocorrência: {e}'}), 500

@app.route('/get_visitas', methods=['GET'])
@login_required('efape_access')
def get_visitas():
    try:
        user_cpf = session.get('user_cpf')
        user_info = PARTICIPANTES_DF[PARTICIPANTES_DF['cpf'] == user_cpf].to_dict('records')
        user_name = user_info[0].get('nome') if user_info and 'nome' in user_info[0] else None

        visitas_salvas = Visita.query.all()
        visitas_salvas_dict = {(v.turma, v.data_formacao.isoformat(), v.horario): v for v in visitas_salvas}

        links_df_path = os.path.join(app.root_path, 'links_visitações.xlsx')
        if not os.path.exists(links_df_path):
            return jsonify({'error': 'Arquivo links_visitações.xlsx não encontrado.'}), 404
        
        links_df = pd.read_excel(links_df_path)
        links_df.replace({np.nan: None}, inplace=True)

        results = []
        for index, row in links_df.iterrows():
            if 'Data da Formação' not in row or 'Horário' not in row or 'Turma' not in row:
                continue
            
            # Formatando a data de acordo com o padrão ISO
            data_formacao_iso = row.get('Data da Formação').strftime('%Y-%m-%d')
            record_key = (str(row.get('Turma')), data_formacao_iso, str(row.get('Horário')))
            
            visita = visitas_salvas_dict.get(record_key)
            if visita:
                record = {
                    'id': visita.id,
                    'responsavel_visitacao': visita.responsavel_visitacao,
                    'encontro_aconteceu': visita.encontro_aconteceu,
                    'motivo_nao_aconteceu': visita.motivo_nao_aconteceu,
                    'observacao': visita.observacao,
                    'turma': row.get('Turma'),
                    'tema': row.get('Tema'),
                    'data_formacao': data_formacao_iso,
                    'dia_mes': row.get('Dia do Mês'),
                    'dia_semana': row.get('Dia da Semana'),
                    'horario': row.get('Horário'),
                    'url': row.get('URL'),
                    'tenant': row.get('Tenant'),
                    'segmento': row.get('Segmento'),
                    'nome_responsavel_base': row.get('Nome do Responsável'),
                    'cpf_responsavel_base': row.get('CPF do Responsável'),
                    'email': row.get('E-mail'),
                    'mes': row.get('Mês'),
                    'is_editable': visita.responsavel_visitacao == user_name or session.get('access_level') == 'super_admin'
                }
            else:
                record = {
                    'id': None,
                    'responsavel_visitacao': None,
                    'encontro_aconteceu': 'Não visitado',
                    'motivo_nao_aconteceu': None,
                    'observacao': None,
                    'turma': row.get('Turma'),
                    'tema': row.get('Tema'),
                    'data_formacao': data_formacao_iso,
                    'dia_mes': row.get('Dia do Mês'),
                    'dia_semana': row.get('Dia da Semana'),
                    'horario': row.get('Horário'),
                    'url': row.get('URL'),
                    'tenant': row.get('Tenant'),
                    'segmento': row.get('Segmento'),
                    'nome_responsavel_base': row.get('Nome do Responsável'),
                    'cpf_responsavel_base': row.get('CPF do Responsável'),
                    'email': row.get('E-mail'),
                    'mes': row.get('Mês'),
                    'is_editable': False
                }
            
            results.append(record)

        # Métrica: Total de Formações
        total_formacoes = len(links_df)
        
        # Métrica: Formações Visitadas (com base no banco de dados)
        formacoes_visitadas = db.session.query(Visita).filter(Visita.encontro_aconteceu.in_(['Sim', 'Não'])).count()

        # Métrica: Formações com Problemas
        formacoes_com_problemas = db.session.query(Visita).filter(Visita.encontro_aconteceu == 'Não').count()
        
        # Métrica: % de Visitação
        pct_visitacao = (formacoes_visitadas / total_formacoes) * 100 if total_formacoes > 0 else 0

        metrics = {
            'total_formacoes': total_formacoes,
            'formacoes_visitadas': formacoes_visitadas,
            'formacoes_com_problemas': formacoes_com_problemas,
            'pct_visitacao': f'{pct_visitacao:.2f}%'
        }

        # Aplicar filtros
        filters = request.args.to_dict()
        filtered_results = results
        
        for key, value in filters.items():
            if value:
                if key == 'sem_responsavel' and value == 'Sim':
                    filtered_results = [r for r in filtered_results if not r.get('responsavel_visitacao')]
                elif key in ['tema', 'turma', 'dia_semana', 'dia_mes', 'responsavel_visitacao']:
                    filtered_results = [r for r in filtered_results if r.get(key) and str(r.get(key)).lower().find(value.lower()) != -1]
                
        return jsonify({
            'results': filtered_results,
            'metrics': metrics
        })

    except Exception as e:
        app.logger.error(f"Erro em /get_visitas: {e}")
        return jsonify({'error': f'Erro ao buscar dados: {e}'}), 500

@app.route('/reserve_visita', methods=['POST'])
@login_required('efape_access')
def reserve_visita():
    try:
        data = request.json
        user_cpf = session.get('user_cpf')
        user_info = PARTICIPANTES_DF[PARTICIPANTES_DF['cpf'] == user_cpf].to_dict('records')
        user_name = user_info[0].get('nome') if user_info and 'nome' in user_info[0] else None

        turma = data.get('turma')
        data_formacao_str = data.get('data_formacao')
        horario = data.get('horario')
        
        if not user_name or not turma or not data_formacao_str or not horario:
            return jsonify({'success': False, 'message': 'Dados obrigatórios faltando para a reserva.'}), 400

        data_formacao_dt = datetime.strptime(data_formacao_str, '%Y-%m-%d').date()

        existing_record = Visita.query.filter_by(
            turma=turma,
            data_formacao=data_formacao_dt,
            horario=horario
        ).first()

        if existing_record:
            return jsonify({'success': False, 'message': 'Esta formação já foi reservada.'}), 409

        new_visita = Visita(
            responsavel_visitacao=user_name,
            encontro_aconteceu='Não visitado',
            turma=turma,
            tema=data.get('tema'),
            data_formacao=data_formacao_dt,
            dia_mes=data.get('dia_mes'),
            dia_semana=data.get('dia_semana'),
            horario=horario,
            url=data.get('url'),
            tenant=data.get('tenant'),
            segmento=data.get('segmento'),
            nome_responsavel_base=data.get('nome_responsavel_base'),
            cpf_responsavel_base=data.get('cpf_responsavel_base'),
            email=data.get('email'),
            mes=data.get('Mês')
        )
        db.session.add(new_visita)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Visita reservada com sucesso!'})
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Erro em /reserve_visita: {e}")
        return jsonify({'success': False, 'message': f'Erro ao reservar visita: {e}'}), 500

@app.route('/edit_visita/<int:record_id>', methods=['POST'])
@login_required('efape_access')
def edit_visita(record_id):
    try:
        data = request.json
        record = Visita.query.get(record_id)
        if not record:
            return jsonify({'success': False, 'message': 'Registro não encontrado.'}), 404

        user_cpf = session.get('user_cpf')
        user_info = PARTICIPANTES_DF[PARTICIPANTES_DF['cpf'] == user_cpf].to_dict('records')
        user_name = user_info[0].get('nome') if user_info and 'nome' in user_info[0] else None
        
        if record.responsavel_visitacao != user_name and session.get('access_level') != 'super_admin':
            return jsonify({'success': False, 'message': 'Acesso negado. Você só pode editar suas próprias reservas.'}), 403

        record.encontro_aconteceu = data.get('encontro_aconteceu')
        record.motivo_nao_aconteceu = data.get('motivo_nao_aconteceu')
        record.observacao = data.get('observacao_visita')
        
        db.session.commit()
        return jsonify({'success': True, 'message': 'Registro de visitação atualizado com sucesso!'})

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Erro em /edit_visita: {e}")
        return jsonify({'success': False, 'message': f'Erro ao atualizar registro: {e}'}), 500
        
@app.route('/delete_visita/<int:record_id>', methods=['DELETE'])
@login_required('efape_access')
def delete_visita(record_id):
    try:
        record = Visita.query.get(record_id)
        if not record:
            return jsonify({'success': False, 'message': 'Registro não encontrado.'}), 404

        user_cpf = session.get('user_cpf')
        user_info = PARTICIPANTES_DF[PARTICIPANTES_DF['cpf'] == user_cpf].to_dict('records')
        user_name = user_info[0].get('nome') if user_info and 'nome' in user_info[0] else None

        if record.responsavel_visitacao != user_name and session.get('access_level') != 'super_admin':
            return jsonify({'success': False, 'message': 'Acesso negado. Você só pode excluir suas próprias reservas.'}), 403

        db.session.delete(record)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Reserva de visitação excluída com sucesso!'})
        
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Erro em /delete_visita: {e}")
        return jsonify({'success': False, 'message': f'Erro ao excluir reserva: {e}'}), 500


@app.route('/get_results/<table_name>')
@login_required("basic_access")
def get_results(table_name):
    try:
        global PARTICIPANTES_DF
        
        user_access_level = session.get('access_level', 'none')
        user_cpf = session.get('user_cpf')

        if user_access_level == 'basic_access':
            if table_name not in ['presenca', 'ocorrencias']:
                return jsonify({'error': 'Acesso negado. Nível de permissão insuficiente para este relatório.'}), 403
        elif user_access_level == 'formador_access':
             if table_name not in ['presenca', 'acompanhamento', 'ateste', 'ocorrencias']:
                return jsonify({'error': 'Acesso negado. Nível de permissão insuficiente para este relatório.'}), 403
        elif user_access_level == 'efape_access':
             if table_name not in ['presenca', 'acompanhamento', 'ateste', 'participantes_base_editavel', 'ocorrencias', 'visitas']:
                return jsonify({'error': 'Acesso negado. Nível de permissão insuficiente para este relatório.'}), 403
        elif user_access_level == 'intermediate_access':
             if table_name in ['usuarios', 'avisos', 'links', 'visitas']:
                return jsonify({'error': 'Acesso negado. Nível de permissão insuficiente para este relatório.'}), 403
        
        if table_name == 'participantes_base_editavel':
            if PARTICIPANTES_DF is None:
                return jsonify({'error': 'Base de participantes não carregada.'}), 500
            
            df = PARTICIPANTES_DF.copy()
            filters = request.args.to_dict()
            if 'page' in filters: del filters['page']
            
            for key, value in filters.items():
                if value:
                    if key in df.columns:
                        df = df[df[key].astype(str).str.contains(value, case=False, na=False)]
            
            per_page = 20
            page = request.args.get('page', 1, type=int)
            total_items = len(df)
            start = (page - 1) * per_page
            end = start + per_page
            paginated_df = df.iloc[start:end]
            
            results = paginated_df.to_dict('records')
            columns = df.columns.tolist()
            
            return jsonify({
                'results': results,
                'columns': columns,
                'total_items': total_items,
                'per_page': per_page,
                'metrics': {}
            })
            
        if table_name not in MODEL_MAP:
            return jsonify({'error': 'Tabela não encontrada.'}), 404

        Model = MODEL_MAP[table_name]
        per_page = 20
        page = request.args.get('page', 1, type=int)
        query = Model.query
        
        user_info_df = PARTICIPANTES_DF[PARTICIPANTES_DF['cpf'] == user_cpf]
        user_name = user_info_df['nome'].iloc[0] if not user_info_df.empty else None
        user_de = user_info_df['diretoria_de_ensino'].iloc[0] if not user_info_df.empty else None

        if user_access_level == 'basic_access':
            if table_name == 'presenca':
                query = query.filter(or_(
                    Presenca.responsavel == user_name,
                    Presenca.nome_substituto == user_name,
                    Presenca.cpf_participante == user_cpf
                ))
            elif table_name == 'ocorrencias':
                 query = query.filter_by(email=user_info_df['email'].iloc[0])

        elif user_access_level == 'formador_access':
            if table_name == 'presenca':
                query = query.filter(or_(
                    Presenca.responsavel == user_name,
                    Presenca.nome_substituto == user_name,
                    Presenca.cpf_participante == user_cpf
                ))
            elif table_name in ['acompanhamento', 'ateste']:
                 query = query.filter_by(responsavel_acompanhamento=user_name)
        
        elif user_access_level == 'intermediate_access' and table_name in ['presenca', 'avaliacao', 'demandas']:
            if user_de:
                if table_name == 'presenca':
                    query = query.filter_by(diretoria_de_ensino_resp=user_de)
                elif table_name in ['avaliacao', 'demandas']:
                    query = query.filter_by(diretoria_de_ensino=user_de)
        
        filtered_query = query
        
        filters = request.args.to_dict()
        if 'page' in filters: del filters['page']
        
        for key, value in filters.items():
            if value:
                if key == 'semana':
                    if table_name == 'demandas':
                         filtered_query = filtered_query.filter(Demanda.semana == value)
                    else:
                        try:
                            year, week = map(int, value.split('-W'))
                            start_date = get_sunday_of_week(year, week)
                            end_date = get_saturday_of_week(year, week)
                            if table_name == 'presenca':
                                filtered_query = filtered_query.filter(Presenca.data_formacao.between(start_date, end_date))
                            elif table_name == 'acompanhamento':
                                filtered_query = filtered_query.filter(Acompanhamento.data_encontro.between(start_date, end_date))
                        except (ValueError, TypeError):
                            app.logger.warning(f"Formato de semana inválido: {value}")
                            continue

                elif key in ['start_date', 'end_date'] and table_name == 'ateste':
                    start_date_str = filters.get('start_date')
                    end_date_str = filters.get('end_date')
                    if start_date_str:
                        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
                        filtered_query = filtered_query.filter(Ateste.data_formacao >= start_date)
                    if end_date_str:
                        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
                        filtered_query = filtered_query.filter(Ateste.data_formacao <= end_date)
                elif hasattr(Model, key):
                    filtered_query = filtered_query.filter(cast(getattr(Model, key), String).ilike(f'%{value}%'))
        
        metrics = {}
        subquery_for_metrics = filtered_query.with_entities(Model.id).subquery()
        
        if table_name == 'presenca':
            metrics_query = db.session.query(
                func.count(Model.id).label('total_participantes_presenca'),
                func.sum(case((Model.presenca == 'SIM', 1), else_=0)).label('total_presencas'),
                func.sum(case((Model.camera == 'SIM', 1), else_=0)).label('total_cameras')
            ).filter(Model.id.in_(subquery_for_metrics)).first()

            total_participantes_presenca = metrics_query.total_participantes_presenca or 0
            total_presencas = metrics_query.total_presencas or 0
            total_cameras = metrics_query.total_cameras or 0
            
            pct_presenca = (total_presencas / total_participantes_presenca) * 100 if total_participantes_presenca > 0 else 0
            pct_camera = (total_cameras / total_participantes_presenca) * 100 if total_participantes_presenca > 0 else 0
            
            num_formularios = db.session.query(func.count(distinct(
                tuple_(Presenca.responsavel, Presenca.turma, Presenca.tema, Presenca.data_formacao)
            ))).filter(Presenca.id.in_(subquery_for_metrics)).scalar()

            metrics = {
                'num_formularios': num_formularios,
                'presentes': total_presencas,
                'esperados': total_participantes_presenca,
                'pct_presenca': f'{pct_presenca:.2f}%',
                'pct_camera': f'{pct_camera:.2f}%'
            }
        
        elif table_name == 'acompanhamento':
            metrics_query = db.session.query(
                func.count(Model.id).label('num_acompanhamentos'),
                func.sum(case((Model.encontro_realizado == 'Sim', 1), else_=0)).label('num_encontros_ocorridos'),
                func.sum(Model.esperado_participantes).label('esperado_participantes_total'),
                func.sum(Model.real_participantes).label('real_participantes_total'),
                func.sum(Model.camera_aberta_participantes).label('camera_aberta_total')
            ).filter(Model.id.in_(subquery_for_metrics)).first()

            metrics = {
                'num_acompanhamentos': metrics_query.num_acompanhamentos or 0,
                'num_encontros_ocorridos': metrics_query.num_encontros_ocorridos or 0,
                'num_participantes_esperados': int(metrics_query.esperado_participantes_total) if metrics_query.esperado_participantes_total else 0,
                'num_participantes_reais': int(metrics_query.real_participantes_total) if metrics_query.real_participantes_total else 0,
                'num_camera_aberta': int(metrics_query.camera_aberta_total) if metrics_query.camera_aberta_total else 0,
            }

        elif table_name == 'avaliacao':
            metrics_query = db.session.query(
                func.count(Model.id).label('num_formularios'),
                func.avg(Avaliacao.nota_final).label('avg_nota')
            ).filter(Model.id.in_(subquery_for_metrics)).first()

            metrics = {
                'num_formularios': metrics_query.num_formularios or 0,
                'nota_media': f'{metrics_query.avg_nota:.2f}' if metrics_query.avg_nota is not None else '0.00'
            }

        elif table_name == 'demandas':
            metrics_query = db.session.query(
                func.count(Model.id).label('num_formularios'),
                func.sum(Demanda.pm_orientados).label('total_pms_orientados'),
                func.sum(Demanda.cursistas_orientados).label('total_cursistas_orientados')
            ).filter(Model.id.in_(subquery_for_metrics)).first()

            pm_orientados_sum = db.session.query(func.sum(case((Demanda.pm_orientados.isnot(None), Demanda.pm_orientados), else_=0))).filter(Demanda.id.in_(subquery_for_metrics)).scalar() or 0
            cursistas_orientados_sum = db.session.query(func.sum(case((Demanda.cursistas_orientados.isnot(None), Demanda.cursistas_orientados), else_=0))).filter(Demanda.id.in_(subquery_for_metrics)).scalar() or 0
            
            pm_esperado_sum = db.session.query(func.sum(case((Demanda.pm_orientados_esperado.isnot(None), Demanda.pm_orientados_esperado), else_=0))).filter(Demanda.id.in_(subquery_for_metrics)).scalar() or 0
            cursistas_esperado_sum = db.session.query(func.sum(case((Demanda.cursistas_orientados_esperado.isnot(None), Demanda.cursistas_orientados_esperado), else_=0))).filter(Demanda.id.in_(subquery_for_metrics)).scalar() or 0

            escolas_visitadas = db.session.query(Demanda.escolas_visitadas).filter(
                Demanda.id.in_(subquery_for_metrics)
            ).all()
            escolas_set = set()
            for row in escolas_visitadas:
                if row.escolas_visitadas:
                    escolas_set.update(row.escolas_visitadas.split(', '))

            metrics = {
                'num_formularios': metrics_query.num_formularios or 0,
                'num_escolas_visitadas_unicas': len(escolas_set),
                'total_pms_orientados': int(pm_orientados_sum),
                'total_cursistas_orientados': int(cursistas_orientados_sum),
                'total_pms_esperados': int(pm_esperado_sum),
                'total_cursistas_esperados': int(cursistas_esperado_sum)
            }
        
        elif table_name == 'ateste':
            metrics_query = db.session.query(
                func.count(distinct(tuple_(Ateste.nome_quem_preencheu, Ateste.tema, Ateste.turma, Ateste.data_formacao))).label('num_formacoes_unicas'),
                func.sum(Ateste.valor_formacao).label('total_pagar')
            ).filter(Ateste.id.in_(subquery_for_metrics)).first()
            
            metrics = {
                'num_formacoes_unicas': metrics_query.num_formacoes_unicas or 0,
                'total_a_pagar': f'{metrics_query.total_pagar:,.2f}'.replace('.', 'X').replace(',', '.').replace('X', ',') if metrics_query.total_pagar is not None else '0,00'
            }
        
        elif table_name == 'ocorrencias':
            metrics_query = db.session.query(
                func.count(Model.id).label('num_ocorrencias'),
                func.sum(case((Model.ocorrencia_ainda_ocorre == 'Sim', 1), else_=0)).label('ocorrencias_ativas')
            ).filter(Model.id.in_(subquery_for_metrics)).first()
            
            metrics = {
                'num_ocorrencias': metrics_query.num_ocorrencias or 0,
                'ocorrencias_ativas': metrics_query.ocorrencias_ativas or 0
            }

        total_items = filtered_query.count()
        paginated_query = filtered_query.paginate(page=page, per_page=per_page, error_out=False)
        
        results = []
        for obj in paginated_query.items:
            data = {}
            for column in inspect(Model).c:
                value = getattr(obj, column.name)
                if isinstance(value, (datetime, date)):
                    data[column.name] = value.isoformat()
                else:
                    data[column.name] = value
            results.append(data)
        
        columns = [column.key for column in Model.__table__.columns]
        
        return jsonify({
            'results': results,
            'columns': columns,
            'total_items': total_items,
            'per_page': per_page,
            'metrics': metrics
        })

    except Exception as e:
        app.logger.error(f"Erro em /get_results/{table_name}: {e}")
        return jsonify({'error': f'Erro ao buscar dados: {e}'}), 500

@app.route('/upload_base', methods=['POST'])
@login_required('super_admin')
def upload_base():
    if 'baseFile' not in request.files:
        return jsonify({'success': False, 'message': 'Nenhum arquivo enviado.'}), 400
    
    file = request.files['baseFile']
    if file.filename == '':
        return jsonify({'success': False, 'message': 'Nenhum arquivo selecionado.'}), 400

    if file and allowed_file(file.filename):
        try:
            filename = secure_filename('participantes_base_editavel.xlsx')
            filepath = os.path.join(app.root_path, filename)
            
            file.save(filepath)
            
            load_participants_base()

            return jsonify({'success': True, 'message': f'Base de dados atualizada com sucesso! O novo arquivo foi carregado.'})
        
        except Exception as e:
            app.logger.error(f"Erro ao processar o arquivo: {e}")
            return jsonify({'success': False, 'message': f'Erro ao processar o arquivo: {e}'}), 500
    
    return jsonify({'success': False, 'message': 'Formato de arquivo não permitido. Apenas .xlsx é aceito.'}), 400

def generate_and_save_reports(user_cpf):
    """
    Função para gerar o arquivo zip de relatórios em segundo plano.
    """
    with app.app_context():
        try:
            tables = ['presenca', 'acompanhamento', 'avaliacao', 'demandas', 'ateste', 'usuarios', 'links', 'avisos', 'ocorrencias', 'visitas']
            zip_filename = f'todos_relatorios_{now_sp().strftime("%Y%m%d%H%M%S")}.zip'
            zip_path = os.path.join(app.config['DOWNLOAD_FOLDER'], zip_filename)

            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                global PARTICIPANTES_DF
                if PARTICIPANTES_DF is not None and not PARTICIPANTES_DF.empty:
                    csv_file = BytesIO()
                    PARTICIPANTES_DF.to_csv(csv_file, index=False, encoding='utf-8-sig')
                    csv_file.seek(0)
                    zipf.writestr('participantes_base_editavel.csv', csv_file.read())
                    print("Base de participantes adicionada ao zip.")
                
                for table_name in tables:
                    Model = MODEL_MAP.get(table_name)
                    if not Model:
                        continue
                    
                    query = Model.query.all()
                    df = pd.DataFrame([obj.__dict__ for obj in query])
                    df.drop(columns=['_sa_instance_state'], inplace=True, errors='ignore')
                    
                    for col in df.columns:
                        if pd.api.types.is_datetime64_any_dtype(df[col]):
                            df[col] = pd.to_datetime(df[col]).dt.date
                        elif col == 'engajamento' or col == 'escolas_visitadas':
                            df[col] = df[col].astype(str).str.replace(r"\[|\]|'", "", regex=True)

                    column_order = {
                        'presenca': ['id', 'diretoria_de_ensino_resp', 'responsavel', 'substituicao_ocorreu', 'nome_substituto', 'tema', 'turma', 'pauta', 'data_formacao', 'nome_participante', 'cpf_participante', 'escola_participante', 'de_participante', 'di_participante', 'pei_participante', 'declinou_participante', 'presenca', 'camera', 'observacao'],
                        'acompanhamento': ['id', 'responsavel_acompanhamento', 'formador_assistido', 'turma', 'tema', 'pauta', 'data_encontro', 'semana', 'encontro_realizado', 'dia_semana_encontro', 'horario_encontro', 'esperado_participantes', 'real_participantes', 'camera_aberta_participantes', 'motivo_nao_ocorrencia', 'observacao'],
                        'avaliacao': ['id', 'observador', 'funcao', 'data_acompanhamento', 'data_feedback', 'observado', 'cpf_observado', 'diretoria_de_ensino', 'escola', 'tema_observado', 'codigo_turma', 'pauta_formativa', 'link_gravacao', 'nota_final', 'feedback_estruturado', 'observacoes_gerais', 'q1_1', 'q1_2', 'q1_3', 'q2_1', 'q2_2', 'q2_3', 'q3_1', 'q3_2', 'q3_3', 'q4_1', 'q4_2', 'q4_3', 'q5_1', 'q5_2', 'q5_3'],
                        'demandas': ['id', 'pec', 'cpf_pec', 'semana', 'caff', 'diretoria_de_ensino', 'formacoes_realizadas', 'alinhamento_semanal', 'alinhamento_geral', 'visitas_escolas', 'escolas_visitadas', 'pm_orientados', 'cursistas_orientados', 'pm_orientados_esperado', 'cursistas_orientados_esperado', 'rubricas_preenchidas', 'feedbacks_realizados', 'substituicoes_realizadas', 'engajamento'],
                        'ateste': ['id', 'responsavel_base', 'nome_quem_preencheu', 'tema', 'turma', 'data_formacao', 'diretoria_de_ensino', 'escola', 'cpf', 'valor_formacao'],
                        'usuarios': ['id', 'cpf', 'access_level'],
                        'avisos': ['id', 'titulo', 'conteudo', 'imagem_url'],
                        'links': ['id', 'titulo', 'descricao', 'url', 'imagem_url'],
                        'ocorrencias': ['id', 'nome', 'email', 'telefone', 'turma', 'tema', 'tipo_ocorrencia', 'outra_ocorrencia_desc', 'descricao_problema', 'ocorrencia_ainda_ocorre', 'nivel_impacto', 'data_horario'],
                        'visitas': ['id', 'responsavel_visitacao', 'encontro_aconteceu', 'motivo_nao_aconteceu', 'observacao', 'turma', 'tema', 'data_formacao', 'dia_mes', 'dia_semana', 'horario', 'url', 'tenant', 'segmento', 'nome_responsavel_base', 'cpf_responsavel_base', 'email', 'mes']
                    }
                    
                    if table_name in column_order:
                        existing_cols = [col for col in column_order[table_name] if col in df.columns]
                        df = df[existing_cols]

                    csv_file = BytesIO()
                    df.to_csv(csv_file, index=False, encoding='utf-8-sig')
                    csv_file.seek(0)
                    
                    zipf.writestr(f'{table_name}.csv', csv_file.read())

            app.logger.info(f"Arquivo de relatórios para {user_cpf} gerado com sucesso: {zip_path}")
            with open(os.path.join(app.config['DOWNLOAD_FOLDER'], f'{user_cpf}_latest_download.txt'), 'w') as f:
                f.write(zip_path)

        except Exception as e:
            app.logger.error(f"Erro ao gerar o zip de relatórios em segundo plano para {user_cpf}: {e}")
            
@app.route('/download_all_reports_async', methods=['GET'])
@login_required("super_admin")
def download_all_reports_async():
    try:
        user_cpf = session.get('user_cpf')
        thread = Thread(target=generate_and_save_reports, args=(user_cpf,))
        thread.start()
        return jsonify({'success': True, 'message': 'A geração do relatório foi iniciada. Você será notificado quando o download estiver pronto.'})
    except Exception as e:
        app.logger.error(f"Erro ao iniciar a thread de exportação: {e}")
        return jsonify({'success': False, 'message': 'Erro ao iniciar a geração dos relatórios.'}), 500

@app.route('/check_download_status', methods=['GET'])
@login_required("super_admin")
def check_download_status():
    user_cpf = session.get('user_cpf')
    status_file = os.path.join(app.config['DOWNLOAD_FOLDER'], f'{user_cpf}_latest_download.txt')
    if os.path.exists(status_file):
        with open(status_file, 'r') as f:
            filepath = f.read().strip()
        
        if os.path.exists(filepath):
            return jsonify({'status': 'ready', 'filename': os.path.basename(filepath)})
    
    return jsonify({'status': 'processing'})

@app.route('/download_file/<filename>', methods=['GET'])
@login_required("super_admin")
def download_file(filename):
    user_cpf = session.get('user_cpf')
    filepath = os.path.join(app.config['DOWNLOAD_FOLDER'], secure_filename(filename))
    
    status_file = os.path.join(app.config['DOWNLOAD_FOLDER'], f'{user_cpf}_latest_download.txt')
    if os.path.exists(status_file):
        with open(status_file, 'r') as f:
            generated_path = f.read().strip()
        
        if filepath == generated_path:
            os.remove(status_file)
            return send_file(filepath, as_attachment=True)
    
    return jsonify({'error': 'Arquivo não encontrado ou acesso negado.'}), 404
    
@app.route('/admin/clean_and_reorganize_ids', methods=['POST'])
@login_required('super_admin')
def clean_and_reorganize_ids():
    try:
        data = request.json
        table_name = data.get('table_name')
        
        if table_name not in MODEL_MAP:
            return jsonify({'success': False, 'message': 'Tabela não encontrada.'}), 404
        
        Model = MODEL_MAP[table_name]

        with db.session.begin():
            db.session.query(Model).filter(Model.id.is_(None)).delete(synchronize_session=False)

            temp_table_name = f'{table_name}_temp'
            db.engine.execute(f"ALTER TABLE {table_name} RENAME TO {temp_table_name}")
            db.engine.execute(f"CREATE TABLE {table_name} AS SELECT * FROM {temp_table_name}")
            db.engine.execute(f"DROP TABLE {temp_table_name}")

        return jsonify({'success': True, 'message': f'IDs nulos da tabela "{table_name}" limpos e a sequência reorganizada com sucesso.'})
    
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Erro ao limpar e reorganizar IDs: {e}")
        return jsonify({'success': False, 'message': f'Erro ao processar a requisição: {e}'}), 500

@app.route('/admin/manage_user', methods=['POST'])
@login_required('super_admin')
def manage_user():
    data = request.json
    action = data.get('action')
    cpf = data.get('cpf')

    if not cpf:
        return jsonify({'success': False, 'message': 'CPF é obrigatório.'}), 400

    user_db = Usuario.query.filter_by(cpf=cpf).first()

    try:
        if action == 'edit':
            if user_db:
                user_db.access_level = data.get('access_level')
                db.session.commit()
                return jsonify({'success': True, 'message': 'Nível de acesso do usuário atualizado com sucesso.'})
            else:
                return jsonify({'success': False, 'message': 'Usuário não encontrado no banco de dados para edição.'}), 404
        
        elif action == 'add':
            if user_db:
                return jsonify({'success': False, 'message': 'Usuário com este CPF já existe. Use a opção de editar.'}), 409
            
            password = hash_password('123')
            new_user = Usuario(
                cpf=cpf,
                password_hash=password,
                access_level=data.get('access_level')
            )
            db.session.add(new_user)
            db.session.commit()
            return jsonify({'success': True, 'message': 'Novo usuário adicionado com sucesso!'})

        elif action == 'delete':
            if user_db:
                db.session.delete(user_db)
                db.session.commit()
                return jsonify({'success': True, 'message': 'Usuário removido com sucesso.'})
            else:
                return jsonify({'success': False, 'message': 'Usuário não encontrado para exclusão.'}), 404

        else:
            return jsonify({'success': False, 'message': 'Ação inválida.'}), 400

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Erro em /admin/manage_user: {e}")
        return jsonify({'success': False, 'message': f'Erro ao processar a requisição: {e}'}), 500


@app.route('/admin/search_user', methods=['GET'])
@login_required('super_admin')
def search_user():
    cpf = request.args.get('cpf')
    if not cpf:
        return jsonify({'error': 'CPF não fornecido.'}), 400
    
    usuario = Usuario.query.filter_by(cpf=cpf).first()
    
    result = {'participante': None}
    if usuario:
        result['usuario'] = {'cpf': usuario.cpf, 'access_level': usuario.access_level}

    return jsonify(result)

@app.route('/export_csv/<table_name>', methods=['GET'])
@login_required("basic_access")
def export_csv(table_name):
    try:
        global PARTICIPANTES_DF
        user_access_level = session.get('access_level', 'none')
        user_cpf = session.get('user_cpf')

        if user_access_level == 'basic_access':
            if table_name not in ['presenca', 'ocorrencias']:
                return jsonify({'error': 'Acesso negado. Nível de permissão insuficiente para este relatório.'}), 403
        elif user_access_level == 'formador_access':
             if table_name not in ['presenca', 'acompanhamento', 'ateste', 'ocorrencias']:
                return jsonify({'error': 'Acesso negado. Nível de permissão insuficiente para este relatório.'}), 403
        elif user_access_level == 'efape_access':
             if table_name not in ['presenca', 'acompanhamento', 'ateste', 'participantes_base_editavel', 'ocorrencias', 'visitas']:
                return jsonify({'error': 'Acesso negado. Nível de permissão insuficiente para este relatório.'}), 403
        elif user_access_level == 'intermediate_access':
             if table_name in ['usuarios', 'avisos', 'links', 'visitas']:
                return jsonify({'error': 'Acesso negado. Nível de permissão insuficiente para este relatório.'}), 403
                
        if table_name == 'participantes_base_editavel':
            if PARTICIPANTES_DF is None or PARTICIPANTES_DF.empty:
                return jsonify({'error': 'A base de participantes está vazia.'}), 404

            df = PARTICIPANTES_DF.copy()
            filters = request.args.to_dict()
            for key, value in filters.items():
                if value:
                    if key in df.columns:
                        df = df[df[key].astype(str).str.contains(value, case=False, na=False)]

            csv_buffer = BytesIO()
            df.to_csv(csv_buffer, index=False, encoding='utf-8-sig')
            csv_buffer.seek(0)
            
            return send_file(csv_buffer, download_name=f'{table_name}_relatorio.csv', as_attachment=True, mimetype='text/csv')

        if table_name not in MODEL_MAP:
            return jsonify({'error': 'Tabela não encontrada.'}), 404

        Model = MODEL_MAP[table_name]
        query = Model.query
        
        user_info = PARTICIPANTES_DF[PARTICIPANTES_DF['cpf'] == user_cpf].to_dict('records')
        if user_info:
            if user_access_level == 'basic_access':
                 if table_name == 'presenca':
                     query = query.filter(or_(
                        Presenca.responsavel == user_info[0].get('responsavel'),
                        Presenca.nome_substituto == user_info[0].get('nome'),
                        Presenca.cpf_participante == user_cpf
                     ))
                 elif table_name == 'ocorrencias':
                     query = query.filter_by(email=user_info[0].get('email'))
            elif user_access_level == 'formador_access':
                 if table_name == 'presenca':
                    query = query.filter(or_(
                        Presenca.responsavel == user_info[0].get('responsavel'),
                        Presenca.nome_substituto == user_info[0].get('nome'),
                        Presenca.cpf_participante == user_cpf
                    ))
                 elif table_name in ['acompanhamento', 'ateste']:
                    query = query.filter_by(responsavel_acompanhamento=user_info[0].get('nome'))
            elif user_access_level == 'intermediate_access' and table_name in ['presenca', 'avaliacao', 'demandas']:
                query = query.filter_by(diretoria_de_ensino=user_info[0].get('diretoria_de_ensino'))

        filters = request.args.to_dict()
        for key, value in filters.items():
            if value:
                if key == 'semana':
                    if table_name == 'demandas':
                         query = query.filter(Demanda.semana == value)
                    else:
                        try:
                            year, week = map(int, value.split('-W'))
                            start_date = get_sunday_of_week(year, week)
                            end_date = get_saturday_of_week(year, week)
                            if table_name == 'presenca':
                                 query = query.filter(Presenca.data_formacao.between(start_date, end_date))
                            elif table_name == 'acompanhamento':
                                 query = query.filter(Acompanhamento.data_encontro.between(start_date, end_date))
                        except (ValueError, TypeError):
                            app.logger.warning(f"Formato de semana inválido: {value}")
                            continue
                elif key in ['start_date', 'end_date'] and table_name == 'ateste':
                    start_date_str = filters.get('start_date')
                    end_date_str = filters.get('end_date')
                    if start_date_str:
                        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
                        query = query.filter(Ateste.data_formacao >= start_date)
                    if end_date_str:
                        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
                        query = query.filter(Ateste.data_formacao <= end_date)
                elif hasattr(Model, key):
                    query = query.filter(cast(getattr(Model, key), String).ilike(f'%{value}%'))
        
        df = pd.DataFrame([obj.__dict__ for obj in query.all()])
        df.drop(columns=['_sa_instance_state'], inplace=True, errors='ignore')

        csv_buffer = BytesIO()
        df.to_csv(csv_buffer, index=False, encoding='utf-8-sig')
        csv_buffer.seek(0)
        
        return send_file(csv_buffer, download_name=f'{table_name}_relatorio.csv', as_attachment=True, mimetype='text/csv')
    except Exception as e:
        app.logger.error(f"Erro ao exportar CSV para a tabela {table_name}: {e}")
        return jsonify({'error': f'Erro ao exportar CSV: {e}'}), 500

@app.route('/')
@login_required("basic_access")
def index():
    aviso = Aviso.query.first()
    links = Link.query.all()
    hidden_elements = {h.element_id: h.is_hidden for h in HiddenElement.query.all()}
    return render_template('index.html', aviso=aviso, links=links, access_level=session.get('access_level', 'none'), hidden_elements=hidden_elements)

@app.route('/get_visibility')
def get_visibility():
    elements = HiddenElement.query.all()
    hidden_elements = {element.element_id: element.is_hidden for element in elements}
    return jsonify({'hidden_elements': hidden_elements})

@app.route('/admin/avisos', methods=['POST'])
@login_required('super_admin')
def gerenciar_aviso():
    try:
        data = request.json
        aviso = Aviso.query.first()
        if aviso:
            aviso.titulo = data['titulo']
            aviso.conteudo = data['conteudo']
            aviso.imagem_url = data.get('imagem_url')
        else:
            aviso = Aviso(
                titulo=data['titulo'],
                conteudo=data['conteudo'],
                imagem_url=data.get('imagem_url')
            )
            db.session.add(aviso)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Aviso salvo com sucesso.'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Erro ao salvar aviso: {e}'}), 500

@app.route('/get_aviso', methods=['GET'])
@login_required('basic_access')
def get_aviso():
    aviso = Aviso.query.first()
    if aviso:
        return jsonify({
            'titulo': aviso.titulo,
            'conteudo': aviso.conteudo,
            'imagem_url': aviso.imagem_url
        })
    return jsonify({})

@app.route('/admin/links', methods=['GET', 'POST', 'DELETE'])
@login_required('super_admin')
def gerenciar_links():
    try:
        if request.method == 'POST':
            data = request.json
            link_id = data.get('id')
            if link_id:
                link = Link.query.get(link_id)
                if link:
                    link.titulo = data['titulo']
                    link.descricao = data.get('descricao')
                    link.url = data['url']
                    link.imagem_url = data.get('imagem_url')
                    db.session.commit()
                    return jsonify({'success': True, 'message': 'Link atualizado com sucesso.'})
                return jsonify({'success': False, 'message': 'Link não encontrado.'}), 404
            else:
                new_link = Link(
                    titulo=data['titulo'],
                    descricao=data.get('descricao'),
                    url=data['url'],
                    imagem_url=data.get('imagem_url')
                )
                db.session.add(new_link)
                db.session.commit()
                return jsonify({'success': True, 'message': 'Link adicionado com sucesso.'})
        
        elif request.method == 'DELETE':
            data = request.json
            link_id = data.get('id')
            link_to_delete = Link.query.get(link_id)
            if link_to_delete:
                db.session.delete(link_to_delete)
                db.session.commit()
                return jsonify({'success': True, 'message': 'Link excluído com sucesso.'})
            return jsonify({'success': False, 'message': 'Link não encontrado.'}), 404
        
        else: # GET
            link_id = request.args.get('id')
            if link_id:
                link = Link.query.get(link_id)
                if link:
                    return jsonify([{
                        'id': link.id,
                        'titulo': link.titulo,
                        'descricao': link.descricao,
                        'url': link.url,
                        'imagem_url': link.imagem_url
                    }])
                return jsonify({}), 404
            links = Link.query.all()
            return jsonify([{
                'id': link.id,
                'titulo': link.titulo,
                'descricao': link.descricao,
                'url': link.url,
                'imagem_url': link.imagem_url
            } for link in links])
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Erro ao processar a requisição: {e}'}), 500

@app.route('/get_links', methods=['GET'])
@login_required('intermediate_access')
def get_links():
    links = Link.query.all()
    return jsonify([{
        'id': link.id,
        'titulo': link.titulo,
        'descricao': link.descricao,
        'url': link.url,
        'imagem_url': link.imagem_url
    } for link in links])

@app.route('/admin/delete_entry', methods=['POST'])
@login_required('super_admin')
def delete_entry():
    data = request.json
    table_name = data.get('table')
    record_id = data.get('id')
    delete_related = data.get('delete_related', False)
    
    if table_name not in MODEL_MAP:
        return jsonify({'success': False, 'message': 'Tabela não encontrada.'}), 404

    Model = MODEL_MAP[table_name]

    try:
        if delete_related and table_name == 'presenca':
            presenca_record = Presenca.query.get(record_id)
            if not presenca_record:
                return jsonify({'success': False, 'message': 'Registro de presença não encontrado.'}), 404
            
            db.session.query(Presenca).filter(
                Presenca.responsavel == presenca_record.responsavel,
                Presenca.turma == presenca_record.turma,
                Presenca.tema == presenca_record.tema,
                Presenca.data_formacao == presenca_record.data_formacao
            ).delete(synchronize_session=False)

            Ateste.query.filter_by(
                nome_quem_preencheu=presenca_record.responsavel,
                tema=presenca_record.tema,
                turma=presenca_record.turma,
                data_formacao=presenca_record.data_formacao
            ).delete(synchronize_session=False)
            
            db.session.commit()
            return jsonify({'success': True, 'message': 'Todos os registros da formação foram excluídos com sucesso!'})
        
        else:
            record_to_delete = Model.query.get(record_id)
            if not record_to_delete:
                return jsonify({'success': False, 'message': 'Registro não encontrado.'}), 404
            
            db.session.delete(record_to_delete)
            db.session.commit()
            return jsonify({'success': True, 'message': 'Registro excluído com sucesso!'})

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Erro ao excluir registro: {e}")
        return jsonify({'success': False, 'message': f'Erro ao excluir registro: {e}'}), 500

@app.route('/edit_record/<table_name>', methods=['POST'])
@login_required('basic_access')
def edit_record(table_name):
    data = request.json
    record_id = data.pop('id', None)
    
    if not record_id or table_name not in MODEL_MAP:
        return jsonify({'success': False, 'message': 'Dados inválidos ou tabela não encontrada.'}), 400

    Model = MODEL_MAP[table_name]
    record = Model.query.get(record_id)

    if not record:
        return jsonify({'success': False, 'message': 'Registro não encontrado.'}), 404
    
    user_access_level = session.get('access_level')
    user_cpf = session.get('user_cpf')

    if user_access_level != 'super_admin':
        is_owner = False
        
        user_info = PARTICIPANTES_DF[PARTICIPANTES_DF['cpf'] == user_cpf].to_dict('records')
        user_name = user_info[0].get('nome') if user_info else None

        if table_name == 'presenca':
            is_owner = record.cpf_participante == user_cpf or record.responsavel == user_name or record.nome_substituto == user_name
        elif table_name == 'acompanhamento':
            is_owner = record.responsavel_acompanhamento == user_name
        elif table_name == 'avaliacao':
            is_owner = record.observador == user_name
        elif table_name == 'demandas':
            is_owner = record.cpf_pec == user_cpf
        elif table_name == 'ateste':
            is_owner = record.cpf == user_cpf
        elif table_name == 'ocorrencias':
            is_owner = record.email == user_info[0].get('email')
        elif table_name == 'visitas':
            is_owner = record.responsavel_visitacao == user_name

        if not is_owner:
             return jsonify({'success': False, 'message': 'Acesso negado. Você só pode editar seus próprios registros.'}), 403

    try:
        for key, value in data.items():
            if hasattr(record, key):
                setattr(record, key, value)
        
        db.session.commit()
        return jsonify({'success': True, 'message': 'Registro atualizado com sucesso!'})
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Erro ao editar registro: {e}")
        return jsonify({'success': False, 'message': f'Erro ao atualizar registro: {e}'}), 500

@app.route('/get_record/<table_name>/<record_id>', methods=['GET'])
@login_required('basic_access')
def get_record(table_name, record_id):
    if table_name not in MODEL_MAP:
        return jsonify({'error': 'Tabela não encontrada.'}), 404

    Model = MODEL_MAP[table_name]
    
    if table_name == 'usuarios':
        record = Model.query.filter_by(cpf=record_id).first()
    else:
        record = Model.query.get(record_id)

    if not record:
        return jsonify({'error': 'Registro não encontrado.'}), 404
    
    user_access_level = session.get('access_level')
    user_cpf = session.get('user_cpf')

    if user_access_level != 'super_admin':
        is_owner = False
        
        user_info = PARTICIPANTES_DF[PARTICIPANTES_DF['cpf'] == user_cpf].to_dict('records')
        user_name = user_info[0].get('nome') if user_info else None

        if table_name == 'presenca':
            is_owner = record.cpf_participante == user_cpf or record.responsavel == user_name or record.nome_substituto == user_name
        elif table_name == 'acompanhamento':
            is_owner = record.responsavel_acompanhamento == user_name
        elif table_name == 'avaliacao':
            is_owner = record.observador == user_name
        elif table_name == 'demandas':
            is_owner = record.cpf_pec == user_cpf
        elif table_name == 'ateste':
            is_owner = record.cpf == user_cpf
        elif table_name == 'usuarios':
            is_owner = record.cpf == user_cpf
        elif table_name == 'ocorrencias':
            is_owner = record.email == user_info[0].get('email')
        elif table_name == 'visitas':
            is_owner = record.responsavel_visitacao == user_name
        
        if not is_owner:
             return jsonify({'success': False, 'message': 'Acesso negado. Você só pode ver seus próprios registros.'}), 403

    data = {}
    for column in inspect(Model).c:
        value = getattr(record, column.name)
        if isinstance(value, (datetime, date)):
            data[column.name] = value.isoformat()
        else:
            data[column.name] = value
    
    return jsonify(data)


@app.route('/admin/toggle_visibility', methods=['POST'])
@login_required('super_admin')
def toggle_visibility():
    data = request.json
    element_id = data.get('element_id')
    is_hidden = data.get('is_hidden')

    if not element_id:
        return jsonify({'success': False, 'message': 'ID do elemento não fornecido.'}), 400

    try:
        element = HiddenElement.query.filter_by(element_id=element_id).first()
        if element:
            element.is_hidden = is_hidden
        else:
            element = HiddenElement(element_id=element_id, is_hidden=is_hidden)
            db.session.add(element)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Visibilidade alterada com sucesso.'})
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Erro ao alterar a visibilidade do elemento: {e}")
        return jsonify({'success': False, 'message': 'Erro ao alterar a visibilidade.'}), 500


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)