import os
import pandas as pd
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, send_file
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
from sqlalchemy import or_, func, cast, String, case, distinct, tuple_
from collections import defaultdict
import glob
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import inspect
from werkzeug.utils import secure_filename
from threading import Thread

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

# Definir o fuso horário de São Paulo
SAO_PAULO_TIMEZONE = pytz.timezone('America/Sao_Paulo')

# Definição dos níveis de acesso
ACCESS_LEVELS = {
    'PM': 'basic_access',
    'PEC': 'intermediate_access',
    'Formador_EFAPE': 'efape_access',
    'ADM': 'super_admin',
    'PC': 'basic_access',
    'CM': 'basic_access'
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
class ParticipantesBaseEditavel(db.Model):
    __tablename__ = 'participantes_base_editavel'
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(255))
    cpf = db.Column(db.String(14), nullable=False, unique=True)
    escola = db.Column(db.String(255))
    diretoria_de_ensino = db.Column(db.String(255))
    tema = db.Column(db.String(255))
    responsavel = db.Column(db.String(255))
    turma = db.Column(db.String(255))
    etapa = db.Column(db.String(255))
    di = db.Column(db.String(255))
    pei = db.Column(db.String(255))
    declinou = db.Column(db.String(255))

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
    rubricas_preenchidas = db.Column(db.Integer)
    feedbacks_realizados = db.Column(db.Integer)
    substituicoes_realizadas = db.Column(db.Integer)
    engajamento = db.Column(db.String)

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
    'participantes_base_editavel': ParticipantesBaseEditavel
}
# Lista de tabelas que podem ser editadas pelo modal
EDITABLE_TABLES = ['presenca', 'acompanhamento', 'avaliacao', 'demandas', 'ateste']


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
            
            access_hierarchy = {
                "no_access": 0,
                "basic_access": 1,
                "efape_access": 2,
                "intermediate_access": 3,
                "full_access": 4,
                "super_admin": 5
            }

            if access_hierarchy.get(user_access_level, 0) < access_hierarchy.get(access_level_required, 0):
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
        if cpf == ADMIN_CPF and not Usuario.query.filter_by(cpf=cpf).first():
            hashed_password = hash_password(password)
            user_info_from_base = ParticipantesBaseEditavel.query.filter_by(cpf=cpf).first()
            
            new_user = Usuario(
                cpf=cpf,
                password_hash=hashed_password,
                access_level='super_admin'
            )
            db.session.add(new_user)
            db.session.commit()
            
            session['user_cpf'] = new_user.cpf
            session['access_level'] = new_user.access_level
            return redirect(url_for('index'))

        user = Usuario.query.filter_by(cpf=cpf).first()

        if user:
            if hash_password(password) == user.password_hash:
                session['user_cpf'] = user.cpf
                session['access_level'] = user.access_level
                return redirect(url_for('index'))
            else:
                error = "Senha incorreta."
        else:
            user_in_data = ParticipantesBaseEditavel.query.filter_by(cpf=cpf).first()
            if user_in_data:
                etapa = user_in_data.etapa
                access_level = ACCESS_LEVELS.get(etapa, "no_access")
                if access_level == "no_access":
                    error = "Seu perfil não tem permissão de acesso ao sistema."
                else:
                    return redirect(url_for('register', cpf=cpf))
            else:
                error = "CPF não encontrado."

    return render_template('login_cpf.html', error=error)

@app.route('/forgot_password', methods=['GET', 'POST'])
def forgot_password():
    error = None
    if request.method == 'POST':
        cpf = request.form.get('cpf').strip()
        nome = request.form.get('nome').strip()
        
        user_in_data = ParticipantesBaseEditavel.query.filter_by(cpf=cpf, nome=nome).first()
        
        if user_in_data:
            user_in_db = Usuario.query.filter_by(cpf=cpf).first()
            if user_in_db:
                return redirect(url_for('reset_password', cpf=cpf))
            else:
                error = "Usuário não encontrado em nossa base de usuários. Por favor, registre-se primeiro."
        else:
            error = "CPF ou nome incorretos."
    
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

    user_in_data = ParticipantesBaseEditavel.query.filter_by(cpf=cpf).first()
    if not user_in_data:
        return redirect(url_for('login', error="CPF não encontrado na base de dados."))

    if request.method == 'POST':
        password = request.form.get('password')
        if not password:
            return render_template('register.html', cpf=cpf, error="A senha é obrigatória.")

        hashed_password = hash_password(password)
        etapa = user_in_data.etapa
        
        if etapa == 'ADM':
            access_level = 'super_admin'
        else:
            access_level = ACCESS_LEVELS.get(etapa, "no_access")

        if access_level == "no_access":
            return render_template('register.html', cpf=cpf, error="Seu perfil não tem permissão de acesso ao sistema.")

        new_user = Usuario(cpf=cpf, password_hash=hashed_password, access_level=access_level)
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

    user_info = ParticipantesBaseEditavel.query.filter_by(cpf=user_cpf).first()
    if not user_info:
        # Se o usuário não está na base de participantes mas está logado (e.g., um admin adicionado manualmente)
        user_in_db = Usuario.query.filter_by(cpf=user_cpf).first()
        if user_in_db:
             return jsonify({
                'nome': user_in_db.nome if hasattr(user_in_db, 'nome') else 'N/A',
                'cpf': user_in_db.cpf,
                'diretoria_de_ensino': 'N/A',
                'etapa': 'N/A',
                'access_level': user_in_db.access_level
            })
        return jsonify({'error': 'Informações do usuário não encontradas na base de dados'}), 404
        
    return jsonify({
        'nome': user_info.nome,
        'cpf': user_info.cpf,
        'diretoria_de_ensino': user_info.diretoria_de_ensino,
        'etapa': user_info.etapa,
        'access_level': session.get('access_level')
    })


# Rota combinada para obter todos os dados de datalists de uma vez
@app.route('/get_all_datalists')
@login_required("basic_access")
def get_all_datalists():
    try:
        data = {}
        all_participants = ParticipantesBaseEditavel.query.all()
        
        # Gerar todas as listas de dados a partir de uma única consulta
        data['turmas'] = sorted(list(set(p.turma for p in all_participants if p.turma)))
        data['diretorias'] = sorted(list(set(p.diretoria_de_ensino for p in all_participants if p.diretoria_de_ensino)))
        if "FORMADOR EFAPE" not in data['diretorias']:
            data['diretorias'].append("FORMADOR EFAPE")
        data['diretorias'].sort()
        data['responsaveis'] = sorted(list(set(p.responsavel for p in all_participants if p.responsavel)))
        data['nomes'] = sorted(list(set(p.nome for p in all_participants if p.nome) | set(p.responsavel for p in all_participants if p.responsavel)))
        data['pecs'] = sorted(list(set(p.nome for p in all_participants if p.etapa and 'PEC' in p.etapa)))
        data['caffs'] = sorted([
            'ALINE DERCATH', 'ARIANE SOUZA DE CARVALHO', 'CARLOS ANTONIO LIMA', 'FABIANE SOARES DA SILVA', 'JULIANA VOLPE DE FREITAS',
            'LUCIANE DA SILVA BARBOSA', 'RENATA KELLY DOS SANTOS LOBAO', 'ROBERTO SERAGLIA MARTINS', 'ROSILENE APARECIDA DE SOUSA',
            'STEFANI DE SOUZA MENEZES', 'WILLIAM PANICCIA LOUREIRO JUNIOR', 'AINDA NÃO TENHO CAFF'
        ])
        data['pautas_formativas'] = [str(i) for i in range(0, 17)]
        data['temas'] = sorted(list(set(p.tema for p in all_participants if p.tema)))
        
        return jsonify(data)
    except Exception as e:
        app.logger.error(f"Erro ao carregar todas as datalists: {e}")
        return jsonify({'error': 'Erro interno ao carregar dados.'}), 500

# Rota para obter a lista de PECs e Formadores para datalists de observadores
@app.route('/get_pecs_and_formadores', methods=['GET'])
@login_required("intermediate_access")
def get_pecs_and_formadores():
    try:
        observadores = db.session.query(ParticipantesBaseEditavel.nome).filter(
            or_(
                ParticipantesBaseEditavel.etapa.ilike('PEC'),
                ParticipantesBaseEditavel.etapa.ilike('Formador_EFAPE')
            )
        ).distinct().order_by(ParticipantesBaseEditavel.nome).all()
        return jsonify([o.nome for o in observadores])
    except Exception as e:
        app.logger.error(f"Erro ao carregar lista de PECs e Formadores: {e}")
        return jsonify([]), 500

# Rota para obter a lista de PMs e PCs para o campo de responsável na Presença
@app.route('/get_responsaveis_for_presenca', methods=['GET'])
@login_required("basic_access")
def get_responsaveis_for_presenca():
    try:
        responsaveis = db.session.query(ParticipantesBaseEditavel.nome).filter(
            or_(
                ParticipantesBaseEditavel.etapa.ilike('PM'),
                ParticipantesBaseEditavel.etapa.ilike('PC')
            )
        ).distinct().order_by(ParticipantesBaseEditavel.nome).all()
        return jsonify([r.nome for r in responsaveis])
    except Exception as e:
        app.logger.error(f"Erro ao carregar lista de responsáveis de presença: {e}")
        return jsonify([]), 500


# Rotas de API para carregar dados para os formulários (datalists)
@app.route('/get_temas_by_responsavel')
@login_required("basic_access")
def get_temas_by_responsavel():
    responsavel = request.args.get('responsavel')
    if responsavel:
        filtered_temas = sorted([p.tema for p in ParticipantesBaseEditavel.query.filter_by(responsavel=responsavel).distinct(ParticipantesBaseEditavel.tema).all() if p.tema])
        return jsonify(filtered_temas)
    return jsonify([])

@app.route('/get_turmas_by_tema_and_responsavel')
@login_required("intermediate_access")
def get_turmas_by_tema_and_responsavel():
    responsavel = request.args.get('responsavel')
    tema = request.args.get('tema')
    if responsavel and tema:
        filtered_turmas = sorted([p.turma for p in ParticipantesBaseEditavel.query.filter(or_(ParticipantesBaseEditavel.responsavel.ilike(responsavel), ParticipantesBaseEditavel.nome.ilike(responsavel)), ParticipantesBaseEditavel.tema.ilike(tema)).distinct(ParticipantesBaseEditavel.turma).all() if p.turma])
        return jsonify(filtered_turmas)
    return jsonify([])

@app.route('/get_turmas_by_tema_and_responsavel_basic')
@login_required("basic_access")
def get_turmas_by_tema_and_responsavel_basic():
    responsavel = request.args.get('responsavel')
    tema = request.args.get('tema')
    if responsavel and tema:
        filtered_turmas = sorted([p.turma for p in ParticipantesBaseEditavel.query.filter_by(responsavel=responsavel, tema=tema).distinct(ParticipantesBaseEditavel.turma).all() if p.turma])
        return jsonify(filtered_turmas)
    return jsonify([])

@app.route('/get_schools_by_de')
@login_required("intermediate_access")
def get_schools_by_de():
    diretoria = request.args.get('diretoria')
    if diretoria:
        escolas = sorted([p.escola for p in ParticipantesBaseEditavel.query.filter_by(diretoria_de_ensino=diretoria).distinct(ParticipantesBaseEditavel.escola).all() if p.escola])
        return jsonify(escolas)
    return jsonify([])

@app.route('/get_counts_by_schools')
@login_required("intermediate_access")
def get_counts_by_schools():
    escolas_str = request.args.get('escolas')
    if escolas_str:
        escolas = escolas_str.split(',')
        pm_count = ParticipantesBaseEditavel.query.filter(ParticipantesBaseEditavel.escola.in_(escolas), ParticipantesBaseEditavel.etapa.ilike('%PM%')).count()
        pc_count = ParticipantesBaseEditavel.query.filter(ParticipantesBaseEditavel.escola.in_(escolas), ParticipantesBaseEditavel.etapa.ilike('%PC%')).count()
        return jsonify({'pm_count': pm_count, 'pc_count': pc_count})
    return jsonify({'pm_count': 0, 'pc_count': 0})

@app.route('/get_info_by_nome')
@login_required("intermediate_access")
def get_info_by_nome():
    nome = request.args.get('nome')
    if nome:
        user_data = ParticipantesBaseEditavel.query.filter(or_(ParticipantesBaseEditavel.nome.ilike(nome), ParticipantesBaseEditavel.responsavel.ilike(nome))).first()
        if user_data:
            temas = sorted([p.tema for p in ParticipantesBaseEditavel.query.filter(or_(ParticipantesBaseEditavel.responsavel.ilike(nome), ParticipantesBaseEditavel.nome.ilike(nome))).distinct(ParticipantesBaseEditavel.tema).all() if p.tema])
            turmas = sorted([p.turma for p in ParticipantesBaseEditavel.query.filter(or_(ParticipantesBaseEditavel.responsavel.ilike(nome), ParticipantesBaseEditavel.nome.ilike(nome))).distinct(ParticipantesBaseEditavel.turma).all() if p.turma])
            
            response_data = {
                'cpf': user_data.cpf,
                'diretoria_de_ensino': user_data.diretoria_de_ensino,
                'escola': user_data.escola,
                'temas': temas,
                'turmas': turmas
            }
            return jsonify(response_data)
    return jsonify({})

@app.route('/get_participantes_by_turma')
@login_required("basic_access")
def get_participantes_by_turma():
    turma = request.args.get('turma')
    if turma:
        filtered_participants = ParticipantesBaseEditavel.query.filter_by(turma=turma).order_by(ParticipantesBaseEditavel.nome).all()
        return jsonify([{'nome': p.nome, 'cpf': p.cpf, 'escola': p.escola, 'diretoria_de_ensino': p.diretoria_de_ensino, 'etapa': p.etapa, 'di': p.di, 'pei': p.pei, 'declinou': p.declinou} for p in filtered_participants])
    return jsonify([])

@app.route('/get_formador_assistido')
@login_required("efape_access")
def get_formador_assistido():
    turma = request.args.get('turma')
    if turma:
        formador = ParticipantesBaseEditavel.query.filter_by(turma=turma).first()
        if formador and formador.responsavel:
            return jsonify([formador.responsavel])
    return jsonify([])

@app.route('/get_tema_by_turma')
@login_required("efape_access")
def get_tema_by_turma():
    turma = request.args.get('turma')
    if turma:
        tema = ParticipantesBaseEditavel.query.filter_by(turma=turma).first()
        if tema and tema.tema:
            return jsonify([tema.tema])
    return jsonify([])


# Rotas para os formulários
@app.route('/submit_acompanhamento', methods=['POST'])
@login_required("efape_access")
def submit_acompanhamento():
    try:
        data = request.json
        encontro_realizado = data.get('encontro_realizado')
        data_encontro_str = data.get('data_encontro')
        
        data_encontro_dt = datetime.strptime(data_encontro_str, '%Y-%m-%d').date()
        semana_encontro = data_encontro_dt.isocalendar()[1]
        ano_encontro = data_encontro_dt.year
        semana_str = f"{ano_encontro}-W{semana_encontro:02}"
        
        observacao = data.get('observacao_acompanhamento')

        if encontro_realizado == 'Não':
            motivo = data.get('motivo_nao_ocorrencia')
            if not motivo:
                 return jsonify({'success': False, 'message': 'Motivo da não realização do encontro é obrigatório.'}), 400
            
            new_acompanhamento = Acompanhamento(
                responsavel_acompanhamento=data.get('responsavel_acompanhamento'),
                turma=data.get('turma'),
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
                responsavel_acompanhamento=data.get('responsavel_acompanhamento'),
                turma=data.get('turma'),
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
                diretoria_de_ensino_resp=data.get('diretoria_presenca'),
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
        
        # Lógica de ateste ajustada para considerar a substituição
        if substituicao_ocorreu == 'Sim':
            substitute_data = ParticipantesBaseEditavel.query.filter_by(nome=nome_substituto).first()
            if substitute_data and substitute_data.etapa == 'PM':
                ateste_record_exists = Ateste.query.filter_by(
                    nome_quem_preencheu=nome_substituto,
                    tema=tema_presenca,
                    turma=turma_presenca,
                    data_formacao=data_formacao_dt
                ).first()
                if not ateste_record_exists:
                    new_ateste = Ateste(
                        responsavel_base=substitute_data.responsavel,
                        nome_quem_preencheu=nome_substituto,
                        tema=tema_presenca,
                        turma=turma_presenca,
                        data_formacao=data_formacao_dt,
                        diretoria_de_ensino=substitute_data.diretoria_de_ensino,
                        escola=substitute_data.escola,
                        cpf=substitute_data.cpf,
                        valor_formacao=152.04
                    )
                    db.session.add(new_ateste)
        else: # Substituição não ocorreu, verificar o responsável original
            pm_data_in_base = ParticipantesBaseEditavel.query.filter_by(nome=responsavel_presenca, etapa='PM').first()
            if pm_data_in_base:
                ateste_record_exists = Ateste.query.filter_by(
                    nome_quem_preencheu=responsavel_presenca,
                    tema=tema_presenca,
                    turma=turma_presenca,
                    data_formacao=data_formacao_dt
                ).first()

                if not ateste_record_exists:
                    new_ateste = Ateste(
                        responsavel_base=pm_data_in_base.responsavel,
                        nome_quem_preencheu=responsavel_presenca,
                        tema=tema_presenca,
                        turma=turma_presenca,
                        data_formacao=data_formacao_dt,
                        diretoria_de_ensino=pm_data_in_base.diretoria_de_ensino,
                        escola=pm_data_in_base.escola,
                        cpf=pm_data_in_base.cpf,
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
        new_avaliacao = Avaliacao(
            observador=data.get('nome_observador_avaliacao'),
            funcao=data.get('funcao_avaliacao'),
            data_acompanhamento=datetime.strptime(data.get('data_acompanhamento_avaliacao'), '%Y-%m-%d').date() if data.get('data_acompanhamento_avaliacao') else None,
            data_feedback=datetime.strptime(data.get('data_feedback_avaliacao'), '%Y-%m-%d').date() if data.get('data_feedback_avaliacao') else None,
            observado=data.get('nome_observado_avaliacao'),
            cpf_observado=data.get('cpf_observado_avaliacao'),
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
        new_demanda = Demanda(
            pec=data.get('pec_demandas'),
            cpf_pec=data.get('cpf_pec_demandas'),
            semana=data.get('semana_demandas'),
            caff=data.get('caff_demandas'),
            diretoria_de_ensino=data.get('diretoria_demandas'),
            formacoes_realizadas=int(data.get('formacoes_realizadas_demandas') or 0),
            alinhamento_semanal=data.get('alinhamento_semanal_demandas'),
            alinhamento_geral=data.get('alinhamento_geral_demandas'),
            visitas_escolas=data.get('visitas_escolas_demandas'),
            escolas_visitadas=', '.join(data.get('escolas_visitadas', [])),
            pm_orientados=int(data.get('pm_orientados_demandas') or 0),
            cursistas_orientados=int(data.get('cursistas_orientados_demandas') or 0),
            rubricas_preenchidas=int(data.get('rubricas_preenchidas_demandas') or 0),
            feedbacks_realizados=int(data.get('feedbacks_realizados_demandas') or 0),
            substituicoes_realizadas=int(data.get('substituicoes_realizadas_demandas') or 0),
            engajamento=', '.join(data.get('engajamento', []))
        )
        db.session.add(new_demanda)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Registro de demanda salvo com sucesso!'})
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Erro em /submit_demandas: {e}")
        return jsonify({'success': False, 'message': f'Erro ao salvar registro de demanda: {e}'}), 500

# Rotas de relatórios e resultados
@app.route('/get_results/<table_name>')
@login_required("basic_access")
def get_results(table_name):
    try:
        if table_name not in MODEL_MAP:
            return jsonify({'error': 'Tabela não encontrada.'}), 404

        Model = MODEL_MAP[table_name]
        per_page = 20
        page = request.args.get('page', 1, type=int)
        
        # Lógica de autorização baseada no nível de acesso
        user_access_level = session.get('access_level', 'none')
        user_cpf = session.get('user_cpf')
        
        query = Model.query
        
        # Lógica de Autorização por Nível de Acesso
        if user_access_level == 'basic_access':
            if table_name == 'presenca':
                user_info = ParticipantesBaseEditavel.query.filter_by(cpf=user_cpf).first()
                if not user_info:
                    return jsonify({'error': 'Usuário não encontrado na base de dados.'}), 404
                query = query.filter_by(responsavel=user_info.nome)
            else:
                 return jsonify({'error': 'Acesso negado. Nível de permissão insuficiente para este relatório.'}), 403

        elif user_access_level == 'intermediate_access':
            user_info = ParticipantesBaseEditavel.query.filter_by(cpf=user_cpf).first()
            if not user_info:
                return jsonify({'error': 'Usuário não encontrado na base de dados.'}), 404
            
            if table_name in ['presenca', 'avaliacao', 'demandas']:
                query = query.filter_by(diretoria_de_ensino=user_info.diretoria_de_ensino)
            elif table_name not in ['acompanhamento', 'ateste']:
                 return jsonify({'error': 'Acesso negado. Nível de permissão insuficiente para este relatório.'}), 403
        
        elif user_access_level == 'efape_access':
            user_info = ParticipantesBaseEditavel.query.filter_by(cpf=user_cpf).first()
            if not user_info:
                return jsonify({'error': 'Usuário não encontrado na base de dados.'}), 404

            if table_name in ['acompanhamento', 'ateste']:
                query = query.filter_by(responsavel_acompanhamento=user_info.nome)
            elif table_name not in ['presenca', 'avaliacao', 'demandas']:
                 return jsonify({'error': 'Acesso negado. Nível de permissão insuficiente para este relatório.'}), 403
        
        # Clonar a consulta original antes de aplicar os filtros
        filtered_query = query
        
        # Filtros de busca
        filters = request.args.to_dict()
        if 'page' in filters:
            del filters['page']
        
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
        
        # Calcular métricas com base na consulta filtrada (LÓGICA OTIMIZADA)
        metrics = {}
        # Usar subquery para calcular as métricas apenas nos registros filtrados
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
            
            # Corrigindo a sintaxe para o distinct
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

            # Corrigindo o erro de soma com valores nulos
            pm_orientados_sum = db.session.query(func.sum(case((Demanda.pm_orientados.isnot(None), Demanda.pm_orientados), else_=0))).filter(Demanda.id.in_(subquery_for_metrics)).scalar() or 0
            cursistas_orientados_sum = db.session.query(func.sum(case((Demanda.cursistas_orientados.isnot(None), Demanda.cursistas_orientados), else_=0))).filter(Demanda.id.in_(subquery_for_metrics)).scalar() or 0

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

        # Aplicar paginação para os resultados da tabela
        total_items = filtered_query.count()
        paginated_query = filtered_query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Serialização dos resultados
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

# Rota para fazer upload e atualizar a base de participantes
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
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)

            df = pd.read_excel(filepath)
            df.replace({np.nan: None}, inplace=True)

            # Limpar a tabela existente
            db.session.query(ParticipantesBaseEditavel).delete()
            db.session.commit()

            # Adicionar os novos dados
            for index, row in df.iterrows():
                try:
                    new_participant = ParticipantesBaseEditavel(
                        nome=row.get('nome', None),
                        cpf=str(row.get('cpf', None)).replace('.0', ''),
                        escola=row.get('escola', None),
                        diretoria_de_ensino=row.get('diretoria_de_ensino', None),
                        tema=row.get('tema', None),
                        responsavel=row.get('responsavel', None),
                        turma=row.get('turma', None),
                        etapa=row.get('etapa', None),
                        di=row.get('di', None),
                        pei=row.get('pei', None),
                        declinou=row.get('declinou', None)
                    )
                    db.session.add(new_participant)
                except Exception as row_error:
                    app.logger.error(f"Erro ao inserir linha {index+2}: {row_error}")
                    continue
            
            db.session.commit()
            os.remove(filepath)

            return jsonify({'success': True, 'message': f'Base de dados atualizada com sucesso! {len(df)} registros inseridos.'})
        
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Erro ao processar o arquivo: {e}")
            if os.path.exists(filepath):
                os.remove(filepath)
            return jsonify({'success': False, 'message': f'Erro ao processar o arquivo: {e}'}), 500
    
    return jsonify({'success': False, 'message': 'Formato de arquivo não permitido. Apenas .xlsx é aceito.'}), 400


def generate_and_save_reports(user_cpf):
    """
    Função para gerar o arquivo zip de relatórios em segundo plano.
    """
    with app.app_context():
        try:
            tables = ['presenca', 'acompanhamento', 'avaliacao', 'demandas', 'ateste', 'usuarios', 'links', 'avisos', 'participantes_base_editavel']
            zip_filename = f'todos_relatorios_{now_sp().strftime("%Y%m%d%H%M%S")}.zip'
            zip_path = os.path.join(app.config['DOWNLOAD_FOLDER'], zip_filename)

            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for table_name in tables:
                    Model = MODEL_MAP.get(table_name)
                    if not Model:
                        continue
                    
                    query = Model.query.all()
                    df = pd.DataFrame([obj.__dict__ for obj in query])
                    df.drop(columns=['_sa_instance_state'], inplace=True, errors='ignore')
                    
                    csv_file = BytesIO()
                    df.to_csv(csv_file, index=False, encoding='utf-8-sig')
                    csv_file.seek(0)
                    
                    zipf.writestr(f'{table_name}.csv', csv_file.read())

            app.logger.info(f"Arquivo de relatórios para {user_cpf} gerado com sucesso: {zip_path}")
            # Salva o caminho do arquivo na sessão do usuário
            with open(os.path.join(app.config['DOWNLOAD_FOLDER'], f'{user_cpf}_latest_download.txt'), 'w') as f:
                f.write(zip_path)

        except Exception as e:
            app.logger.error(f"Erro ao gerar o zip de relatórios em segundo plano para {user_cpf}: {e}")
            
# Removendo a rota síncrona
# @app.route('/download_all_reports', methods=['GET'])
# @login_required("super_admin")
# def download_all_reports():
#    ... (lógica antiga) ...


@app.route('/download_all_reports_async', methods=['GET'])
@login_required("super_admin")
def download_all_reports_async():
    """
    Inicia a tarefa de exportação de relatórios em segundo plano.
    """
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
    """
    Verifica se o arquivo de download mais recente está pronto.
    """
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
    """
    Rota para o download real do arquivo.
    """
    user_cpf = session.get('user_cpf')
    filepath = os.path.join(app.config['DOWNLOAD_FOLDER'], secure_filename(filename))
    
    # Apenas permite download se o arquivo foi gerado para este usuário
    status_file = os.path.join(app.config['DOWNLOAD_FOLDER'], f'{user_cpf}_latest_download.txt')
    if os.path.exists(status_file):
        with open(status_file, 'r') as f:
            generated_path = f.read().strip()
        
        if filepath == generated_path:
            # Apaga o arquivo de status para que o download só possa ser feito uma vez
            os.remove(status_file)
            return send_file(filepath, as_attachment=True)
            # Nota: O arquivo ZIP em si deve ser gerenciado para ser apagado após o download.
            # Uma lógica adicional de limpeza de arquivos antigos pode ser necessária.
    
    return jsonify({'error': 'Arquivo não encontrado ou acesso negado.'}), 404
    
@app.route('/admin/clean_and_reorganize_ids', methods=['POST'])
@login_required('super_admin')
def clean_and_reorganize_ids():
    """
    Limpa IDs nulos e reorganiza a sequência de IDs para uma tabela específica.
    """
    try:
        data = request.json
        table_name = data.get('table_name')
        
        if table_name not in MODEL_MAP:
            return jsonify({'success': False, 'message': 'Tabela não encontrada.'}), 404
        
        Model = MODEL_MAP[table_name]

        with db.session.begin():
            # Deletar registros com ID nulo
            db.session.query(Model).filter(Model.id.is_(None)).delete(synchronize_session=False)

            # Reorganizar os IDs restantes
            temp_table_name = f'{table_name}_temp'
            db.engine.execute(f"ALTER TABLE {table_name} RENAME TO {temp_table_name}")
            db.engine.execute(f"CREATE TABLE {table_name} AS SELECT * FROM {temp_table_name}")
            db.engine.execute(f"DROP TABLE {temp_table_name}")

        return jsonify({'success': True, 'message': f'IDs nulos da tabela "{table_name}" limpos e a sequência reorganizada com sucesso.'})
    
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Erro ao limpar e reorganizar IDs: {e}")
        return jsonify({'success': False, 'message': f'Erro ao processar a requisição: {e}'}), 500


@app.route('/export_csv/<table_name>', methods=['GET'])
@login_required("basic_access")
def export_csv(table_name):
    try:
        if table_name not in MODEL_MAP:
            return jsonify({'error': 'Tabela não encontrada.'}), 404

        Model = MODEL_MAP[table_name]
        
        # Lógica de autorização baseada no nível de acesso
        user_access_level = session.get('access_level', 'none')
        user_cpf = session.get('user_cpf')
        
        query = Model.query
        
        if user_access_level == 'basic_access':
            if table_name == 'presenca':
                user_info = ParticipantesBaseEditavel.query.filter_by(cpf=user_cpf).first()
                if not user_info:
                    return jsonify({'error': 'Usuário não encontrado na base de dados.'}), 404
                query = query.filter_by(responsavel=user_info.nome)
            else:
                 return jsonify({'error': 'Acesso negado. Nível de permissão insuficiente para este relatório.'}), 403
        
        elif user_access_level == 'intermediate_access':
            if table_name in ['presenca', 'avaliacao', 'demandas']:
                user_info = ParticipantesBaseEditavel.query.filter_by(cpf=user_cpf).first()
                if not user_info:
                    return jsonify({'error': 'Usuário não encontrado na base de dados.'}), 404
                query = query.filter_by(diretoria_de_ensino=user_info.diretoria_de_ensino)
            elif table_name not in ['acompanhamento', 'ateste']: # Intermediário só pode ver acompanhamento e ateste.
                 return jsonify({'error': 'Acesso negado. Nível de permissão insuficiente para este relatório.'}), 403
        
        elif user_access_level == 'efape_access':
            if table_name in ['acompanhamento', 'ateste']:
                user_info = ParticipantesBaseEditavel.query.filter_by(cpf=user_cpf).first()
                if not user_info:
                    return jsonify({'error': 'Usuário não encontrado na base de dados.'}), 404
                query = query.filter_by(responsavel_acompanhamento=user_info.nome)
            elif table_name not in ['presenca', 'avaliacao', 'demandas']:
                 return jsonify({'error': 'Acesso negado. Nível de permissão insuficiente para este relatório.'}), 403
        
        elif user_access_level == 'full_access':
            pass
        
        elif user_access_level == 'super_admin':
            pass
        
        # Aplicar filtros
        filters = request.args.to_dict()
        for key, value in filters.items():
            if value:
                if key == 'semana':
                    year, week = map(int, value.split('-W'))
                    start_date = get_sunday_of_week(year, week)
                    end_date = get_saturday_of_week(year, week)
                    if table_name == 'presenca':
                         query = query.filter(Presenca.data_formacao.between(start_date, end_date))
                    elif table_name == 'acompanhamento':
                         query = query.filter(Acompanhamento.data_encontro.between(start_date, end_date))
                    elif table_name == 'demandas':
                         query = query.filter(Demanda.semana == value)
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
    return render_template('index.html', aviso=aviso, links=links, access_level=session.get('access_level', 'none'))


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
    if request.method == 'POST':
        try:
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
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'message': f'Erro ao salvar link: {e}'}), 500
    
    elif request.method == 'DELETE':
        try:
            data = request.json
            link_id = data.get('id')
            link_to_delete = Link.query.get(link_id)
            if link_to_delete:
                db.session.delete(link_to_delete)
                db.session.commit()
                return jsonify({'success': True, 'message': 'Link excluído com sucesso.'})
            return jsonify({'success': False, 'message': 'Link não encontrado.'}), 404
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'message': f'Erro ao excluir link: {e}'}), 500
    
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

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)