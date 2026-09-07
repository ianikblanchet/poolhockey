import base64
import hashlib
import hmac
import json
import os
import secrets
import time

from fastapi import Depends, FastAPI, File, HTTPException, WebSocket, WebSocketDisconnect, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from database import engine, Base, get_db
from models import Player, PlayerSeasonStat, Pooler, PoolSeason
from excel_stats import import_active_stats_excel
from websocket_manager import manager

Base.metadata.create_all(bind=engine)
if 'save_percentage' not in {column['name'] for column in inspect(engine).get_columns('player_season_stats')}: 
    with engine.begin() as connection:
        connection.execute(text('ALTER TABLE player_season_stats ADD COLUMN save_percentage FLOAT'))
if 'wins' not in {column['name'] for column in inspect(engine).get_columns('player_season_stats')}: 
    with engine.begin() as connection:
        connection.execute(text('ALTER TABLE player_season_stats ADD COLUMN wins INTEGER NOT NULL DEFAULT 0'))
if 'password_hash' not in {column['name'] for column in inspect(engine).get_columns('poolers')}:
    with engine.begin() as connection:
        connection.execute(text('ALTER TABLE poolers ADD COLUMN password_hash VARCHAR'))
if 'is_admin' not in {column['name'] for column in inspect(engine).get_columns('poolers')}:
    with engine.begin() as connection:
        default_value = 'FALSE' if engine.dialect.name == 'postgresql' else '0'
        connection.execute(text(f'ALTER TABLE poolers ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT {default_value}'))
if 'is_approved' not in {column['name'] for column in inspect(engine).get_columns('poolers')}:
    with engine.begin() as connection:
        default_value = 'TRUE' if engine.dialect.name == 'postgresql' else '1'
        connection.execute(text(f'ALTER TABLE poolers ADD COLUMN is_approved BOOLEAN NOT NULL DEFAULT {default_value}'))

app = FastAPI(title="NHL Pool Realtime Engine")

frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:5173').rstrip('/')
allowed_origins = [frontend_url, 'http://127.0.0.1:5173']

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Variable d'état globale pour suivre l'avancement du repêchage
DRAFT_STATUS = {"current_turn_order": 1}
AUTH_SCHEME = HTTPBearer(auto_error=False)
AUTH_SECRET = os.environ.get('SECRET_KEY', 'change-me-in-production').encode()


def _hash_password(password):
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 200_000)
    return f'{base64.urlsafe_b64encode(salt).decode()}:{base64.urlsafe_b64encode(digest).decode()}'


def _verify_password(password, encoded):
    try:
        salt_text, digest_text = encoded.split(':', 1)
        salt = base64.urlsafe_b64decode(salt_text.encode())
        expected = base64.urlsafe_b64decode(digest_text.encode())
    except (ValueError, TypeError):
        return False
    actual = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 200_000)
    return hmac.compare_digest(actual, expected)


def _create_token(pooler):
    payload = {'pooler_id': pooler.id, 'exp': int(time.time()) + 60 * 60 * 24 * 30}
    encoded = base64.urlsafe_b64encode(json.dumps(payload, separators=(',', ':')).encode()).decode().rstrip('=')
    signature = hmac.new(AUTH_SECRET, encoded.encode(), hashlib.sha256).hexdigest()
    return f'{encoded}.{signature}'


def _get_pooler_from_token(token, db):
    try:
        encoded, signature = token.split('.', 1)
        expected = hmac.new(AUTH_SECRET, encoded.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError
        payload = json.loads(base64.urlsafe_b64decode(f'{encoded}==='))
        if payload['exp'] < time.time():
            raise ValueError
        pooler = db.query(Pooler).filter(Pooler.id == payload['pooler_id']).first()
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        pooler = None
    if pooler is None:
        raise HTTPException(status_code=401, detail='Session invalide ou expirée.')
    return pooler


def get_current_pooler(
    credentials: HTTPAuthorizationCredentials = Depends(AUTH_SCHEME),
    db: Session = Depends(get_db),
):
    if credentials is None:
        raise HTTPException(status_code=401, detail='Connexion requise.')
    return _get_pooler_from_token(credentials.credentials, db)


def get_current_admin(current_pooler: Pooler = Depends(get_current_pooler)):
    if not current_pooler.is_admin:
        raise HTTPException(status_code=403, detail='Droits administrateur requis.')
    return current_pooler


def _pooler_payload(pooler):
    return {
        'id': pooler.id,
        'name': pooler.name,
        'draft_order': pooler.draft_order,
        'is_admin': pooler.is_admin,
        'is_approved': pooler.is_approved,
    }


def _position_category(position):
    normalized = (position or '').strip().lower()
    if normalized == 'g' or 'goalie' in normalized or 'goaltender' in normalized:
        return 'goalie'
    if normalized == 'd' or 'defenceman' in normalized or 'defenseman' in normalized or normalized == 'defense':
        return 'defense'
    return 'attacker'


def _pool_points(player, stat):
    if stat is None:
        return 0
    if _position_category(player.position) == 'goalie':
        return (stat.wins or 0) * 2 + (stat.assists or 0)
    return (stat.goals or 0) * 2 + (stat.assists or 0)


ROSTER_LIMITS = {'attacker': 6, 'defense': 4, 'goalie': 2}


@app.post('/api/auth/register')
def register_pooler(payload: dict, db: Session = Depends(get_db)):
    name = (payload.get('name') or '').strip()
    password = payload.get('password') or ''
    if len(name) < 2 or len(password) < 6:
        raise HTTPException(status_code=400, detail='Le nom doit avoir 2 caractères et le mot de passe 6 caractères minimum.')
    if db.query(Pooler).filter(Pooler.name.ilike(name)).first():
        raise HTTPException(status_code=400, detail='Ce nom de participant est déjà pris.')
    pooler = Pooler(
        name=name,
        password_hash=_hash_password(password),
        is_approved=False,
        draft_order=db.query(Pooler).count() + 1,
    )
    db.add(pooler)
    db.commit()
    db.refresh(pooler)
    return {
        'status': 'pending',
        'message': 'Votre inscription a été envoyée à l’administrateur.',
        'pooler': _pooler_payload(pooler),
    }


@app.post('/api/auth/login')
def login_pooler(payload: dict, db: Session = Depends(get_db)):
    name = (payload.get('name') or '').strip()
    password = payload.get('password') or ''
    pooler = db.query(Pooler).filter(Pooler.name.ilike(name)).first()
    if pooler is None or not pooler.password_hash or not _verify_password(password, pooler.password_hash):
        raise HTTPException(status_code=401, detail='Nom ou mot de passe incorrect.')
    if not pooler.is_approved:
        raise HTTPException(status_code=403, detail='Votre inscription est en attente d’approbation par l’administrateur.')
    return {'token': _create_token(pooler), 'pooler': _pooler_payload(pooler)}


@app.get('/api/auth/me')
def get_current_profile(current_pooler: Pooler = Depends(get_current_pooler)):
    return _pooler_payload(current_pooler)


@app.get('/api/admin/pending-poolers')
def list_pending_poolers(db: Session = Depends(get_db), admin: Pooler = Depends(get_current_admin)):
    pending = db.query(Pooler).filter(Pooler.is_approved.is_(False)).order_by(Pooler.id.asc()).all()
    return [_pooler_payload(pooler) for pooler in pending]


@app.post('/api/admin/poolers/{pooler_id}/approve')
def approve_pooler(pooler_id: int, db: Session = Depends(get_db), admin: Pooler = Depends(get_current_admin)):
    pooler = db.query(Pooler).filter(Pooler.id == pooler_id).first()
    if pooler is None:
        raise HTTPException(status_code=404, detail='Inscription introuvable.')
    pooler.is_approved = True
    db.commit()
    db.refresh(pooler)
    return _pooler_payload(pooler)


@app.delete('/api/admin/poolers/{pooler_id}/reject')
def reject_pooler(pooler_id: int, db: Session = Depends(get_db), admin: Pooler = Depends(get_current_admin)):
    pooler = db.query(Pooler).filter(Pooler.id == pooler_id, Pooler.is_approved.is_(False)).first()
    if pooler is None:
        raise HTTPException(status_code=404, detail='Demande en attente introuvable.')
    db.delete(pooler)
    db.commit()
    return {'status': 'rejected', 'pooler_id': pooler_id}

@app.post("/api/import-active-stats")
async def import_active_stats(file: UploadFile = File(...), db: Session = Depends(get_db), admin: Pooler = Depends(get_current_admin)):
    if not file.filename.lower().endswith(('.xlsx', '.xlsm')):
        raise HTTPException(status_code=400, detail='Le fichier doit être un export Excel NHL (.xlsx).')
    return import_active_stats_excel(db, await file.read(), season_label='2026-27', filename=file.filename)


@app.post("/api/import-previous-stats")
async def import_previous_stats(file: UploadFile = File(...), db: Session = Depends(get_db), admin: Pooler = Depends(get_current_admin)):
    if not file.filename.lower().endswith(('.xlsx', '.xlsm')):
        raise HTTPException(status_code=400, detail='Le fichier doit être un export Excel NHL (.xlsx).')
    return import_active_stats_excel(db, await file.read(), season_label='2025-26', filename=file.filename)


@app.post("/api/import-goalie-stats")
async def import_goalie_stats(file: UploadFile = File(...), db: Session = Depends(get_db), admin: Pooler = Depends(get_current_admin)):
    if not file.filename.lower().endswith(('.xlsx', '.xlsm')):
        raise HTTPException(status_code=400, detail='Le fichier doit être un export Excel NHL contenant les données CSV.')
    return import_active_stats_excel(db, await file.read(), season_label='2026-27', filename=file.filename)

@app.get("/api/players")
def get_players(db: Session = Depends(get_db), current_pooler: Pooler = Depends(get_current_pooler)):
    active_season = '2026-27'
    previous_season = '2025-26'
    previous_stats = {
        stat.player_id: stat
        for stat in db.query(PlayerSeasonStat).filter(PlayerSeasonStat.season == previous_season).all()
    }
    active_stats = {
        stat.player_id: stat
        for stat in db.query(PlayerSeasonStat).filter(PlayerSeasonStat.season == active_season).all()
    }
    players = db.query(Player).all()
    players.sort(
        key=lambda player: (
            _pool_points(player, previous_stats.get(player.id)) if previous_stats.get(player.id) else -1,
            player.name.casefold(),
        ),
        reverse=True,
    )
    return [{
        'id': player.id,
        'name': player.name,
        'team': player.team,
        'position': player.position,
        'points': _pool_points(player, active_stats.get(player.id)),
        'goals': active_stats.get(player.id).goals if active_stats.get(player.id) else 0,
        'assists': active_stats.get(player.id).assists if active_stats.get(player.id) else 0,
        'is_drafted': player.is_drafted,
        'previous_season': previous_season,
        'previous_goals': previous_stats.get(player.id).goals if previous_stats.get(player.id) else None,
        'previous_assists': previous_stats.get(player.id).assists if previous_stats.get(player.id) else None,
        'previous_wins': previous_stats.get(player.id).wins if previous_stats.get(player.id) else None,
        'previous_points': previous_stats.get(player.id).points if previous_stats.get(player.id) else None,
        'previous_save_percentage': previous_stats.get(player.id).save_percentage if previous_stats.get(player.id) else None,
    } for player in players]

@app.get("/api/poolers")
def get_poolers(db: Session = Depends(get_db), current_pooler: Pooler = Depends(get_current_pooler)):
    poolers = db.query(Pooler).filter(Pooler.is_approved.is_(True)).all()
    active_stats = {
        stat.player_id: stat
        for stat in db.query(PlayerSeasonStat).filter(PlayerSeasonStat.season == '2026-27').all()
    }
    return [{
        "id": p.id,
        "name": p.name,
        "draft_order": p.draft_order,
        "players": [{
            "id": pl.id,
            "name": pl.name,
            "team": pl.team,
            "position": pl.position,
            "points": _pool_points(pl, active_stats.get(pl.id)),
            "goals": active_stats.get(pl.id).goals if active_stats.get(pl.id) else 0,
            "assists": active_stats.get(pl.id).assists if active_stats.get(pl.id) else 0,
            "games_played": active_stats.get(pl.id).games_played if active_stats.get(pl.id) else 0,
            "wins": active_stats.get(pl.id).wins if active_stats.get(pl.id) else 0,
            "save_percentage": active_stats.get(pl.id).save_percentage if active_stats.get(pl.id) else None,
            "position": pl.position,
            "is_drafted": pl.is_drafted,
        } for pl in p.players]
    } for p in poolers]


@app.post("/api/poolers")
def create_pooler(name: str, db: Session = Depends(get_db), admin: Pooler = Depends(get_current_admin)):
    if db.query(Pooler).filter(Pooler.name == name).first():
        raise HTTPException(status_code=400, detail="Ce nom de pooler est déjà pris.")
    count = db.query(Pooler).count()
    new_pooler = Pooler(name=name, is_approved=True, draft_order=count + 1)
    db.add(new_pooler)
    db.commit()
    db.refresh(new_pooler)
    return new_pooler


@app.delete("/api/poolers/{pooler_id}")
def delete_pooler(pooler_id: int, db: Session = Depends(get_db), admin: Pooler = Depends(get_current_admin)):
    pooler = db.query(Pooler).filter(Pooler.id == pooler_id).first()
    if pooler is None:
        raise HTTPException(status_code=404, detail="Équipe introuvable.")

    players = list(pooler.players)
    pooler.players.clear()

    for player in players:
        if not player.poolers:
            player.is_drafted = False

    active_season = db.query(PoolSeason).order_by(PoolSeason.id.desc()).first()
    if active_season and isinstance(active_season.draft_order, list):
        removed_position = next(
            (
                team.get("draft_position")
                for team in active_season.draft_order
                if team.get("id") == pooler_id
            ),
            None,
        )
        remaining_order = [
            team for team in active_season.draft_order
            if team.get("id") != pooler_id
        ]
        active_season.draft_order = [
            {**team, "draft_position": index}
            for index, team in enumerate(remaining_order, start=1)
        ]
        if not active_season.draft_order:
            DRAFT_STATUS["current_turn_order"] = 1
        else:
            current_turn = DRAFT_STATUS["current_turn_order"]
            if removed_position is not None and removed_position < current_turn:
                current_turn -= 1
            DRAFT_STATUS["current_turn_order"] = min(current_turn, len(active_season.draft_order))

    db.delete(pooler)
    db.commit()
    return {"status": "success", "message": "Équipe retirée du pool."}

@app.get("/api/standings")
def get_standings(db: Session = Depends(get_db), current_pooler: Pooler = Depends(get_current_pooler)):
    poolers = db.query(Pooler).filter(Pooler.is_approved.is_(True)).all()
    active_stats = {
        stat.player_id: stat
        for stat in db.query(PlayerSeasonStat).filter(PlayerSeasonStat.season == '2026-27').all()
    }
    results = []
    for p in poolers:
        total = sum(_pool_points(player, active_stats.get(player.id)) for player in p.players)
        results.append({
            "id": p.id, "name": p.name, "draft_order": p.draft_order, "total_points": total,
            "players": [{"name": pl.name, "points": _pool_points(pl, active_stats.get(pl.id)), "team": pl.team} for pl in p.players]
        })
    return sorted(results, key=lambda x: x["total_points"], reverse=True)

@app.post("/api/seasons")
def create_pool_season(payload: dict, db: Session = Depends(get_db), admin: Pooler = Depends(get_current_admin)):
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Payload invalide.")

    name = (payload.get("name") or "Saison sans nom").strip()
    order = payload.get("order") or []
    if not name:
        raise HTTPException(status_code=400, detail="Le nom de la saison est requis.")

    season = PoolSeason(name=name, status="draft", draft_order=order)
    db.add(season)
    db.commit()
    db.refresh(season)
    DRAFT_STATUS["current_turn_order"] = 1
    return {
        "id": season.id,
        "name": season.name,
        "status": season.status,
        "draft_order": season.draft_order,
        "created_at": season.created_at.isoformat() if season.created_at else None,
    }


@app.post("/api/seasons/{season_id}/order")
def update_pool_season_order(season_id: int, payload: dict, db: Session = Depends(get_db), admin: Pooler = Depends(get_current_admin)):
    season = db.query(PoolSeason).filter(PoolSeason.id == season_id).first()
    if season is None:
        raise HTTPException(status_code=404, detail="Saison introuvable.")

    order = payload.get("order") if isinstance(payload, dict) else None
    if not isinstance(order, list) or not order:
        raise HTTPException(status_code=400, detail="L'ordre de sélection est invalide.")

    season.draft_order = order
    DRAFT_STATUS["current_turn_order"] = 1
    db.commit()
    return {
        "id": season.id,
        "name": season.name,
        "status": season.status,
        "draft_order": season.draft_order,
    }


@app.post("/api/seasons/{season_id}/reset")
def reset_pool_season(season_id: int, db: Session = Depends(get_db), admin: Pooler = Depends(get_current_admin)):
    season = db.query(PoolSeason).filter(PoolSeason.id == season_id).first()
    if season is None:
        raise HTTPException(status_code=404, detail="Saison introuvable.")

    drafted_players = {
        player
        for pooler in db.query(Pooler).all()
        for player in pooler.players
    }
    for player in drafted_players:
        player.is_drafted = False

    for pooler in db.query(Pooler).all():
        pooler.players.clear()

    db.delete(season)
    DRAFT_STATUS["current_turn_order"] = 1
    db.commit()
    return {
        "status": "success",
        "message": "La saison a été réinitialisée. Les équipes et le draft sont prêts à redémarrer.",
    }

@app.get("/api/seasons")
def list_pool_seasons(db: Session = Depends(get_db), current_pooler: Pooler = Depends(get_current_pooler)):
    seasons = db.query(PoolSeason).order_by(PoolSeason.id.desc()).all()
    return [{
        "id": season.id,
        "name": season.name,
        "status": season.status,
        "draft_order": season.draft_order,
        "created_at": season.created_at.isoformat() if season.created_at else None,
    } for season in seasons]

@app.websocket("/ws/draft")
async def draft_websocket(websocket: WebSocket, db: Session = Depends(get_db)):
    token = websocket.query_params.get('token')
    if not token:
        await websocket.close(code=1008)
        return
    try:
        current_pooler = _get_pooler_from_token(token, db)
    except HTTPException:
        await websocket.close(code=1008)
        return
    # 1. On accepte le client immédiatement
    await websocket.accept()
    
    # 2. On l'ajoute au gestionnaire de diffusion
    manager.active_connections.append(websocket)
    
    try:
        # 3. On récupère les infos en base de données
        poolers_count = db.query(Pooler).filter(Pooler.is_approved.is_(True)).count()
        
        # 4. On tente d'envoyer les données de démarrage de manière sécurisée
        try:
            await websocket.send_json({
                "type": "INIT_DRAFT", 
                "current_turn": DRAFT_STATUS["current_turn_order"], 
                "max_poolers": poolers_count
            })
        except Exception:
            # Si le client s'est déjà déconnecté à cette microseconde, on ignore et on quitte
            manager.disconnect(websocket)
            return

        # 5. Boucle d'écoute principale pour le Draft
        while True:
            data = await websocket.receive_json()
            if data["type"] == "MAKE_PICK":
                pooler_id, player_id = data["pooler_id"], data["player_id"]
                if not current_pooler.is_admin and str(pooler_id) != str(current_pooler.id):
                    await websocket.send_json({"type": "ERROR", "message": "Vous ne pouvez pas choisir pour cette équipe."})
                    continue
                pooler = db.query(Pooler).filter(Pooler.id == pooler_id).first()
                player = db.query(Player).filter(Player.id == player_id).first()
                active_season = db.query(PoolSeason).order_by(PoolSeason.id.desc()).first()
                draft_order = active_season.draft_order if active_season else []
                current_team = next(
                    (team for team in draft_order
                     if team.get("draft_position") == DRAFT_STATUS["current_turn_order"]),
                    None,
                )

                if pooler is None:
                    message = "Équipe introuvable."
                elif player is None:
                    message = "Joueur introuvable."
                elif player.is_drafted:
                    message = "Ce joueur a déjà été sélectionné."
                elif current_team is None:
                    message = "Aucun tour de draft actif."
                elif str(current_team.get("id")) != str(pooler.id):
                    message = f"C'est le tour de l'équipe {current_team.get('name', 'suivante')}."
                else:
                    category = _position_category(player.position)
                    roster_counts = {
                        roster_category: sum(
                            _position_category(roster_player.position) == roster_category
                            for roster_player in pooler.players
                        )
                        for roster_category in ROSTER_LIMITS
                    }
                    if roster_counts[category] >= ROSTER_LIMITS[category]:
                        category_label = {
                            'attacker': 'attaquants',
                            'defense': 'défenseurs',
                            'goalie': 'gardiens',
                        }[category]
                        message = (
                            f"Composition complète pour les {category_label} "
                            f"({ROSTER_LIMITS[category]} maximum)."
                        )
                    else:
                        message = None

                if message:
                    await websocket.send_json({"type": "ERROR", "message": message})
                    continue

                player.is_drafted = True
                pooler.players.append(player)
                
                total_draft_teams = len(draft_order) or db.query(Pooler).count()
                DRAFT_STATUS["current_turn_order"] = (
                    1 if DRAFT_STATUS["current_turn_order"] >= total_draft_teams
                    else DRAFT_STATUS["current_turn_order"] + 1
                )
                db.commit()

                await manager.broadcast({
                    "type": "PICK_CONFIRMED", 
                    "pooler_name": pooler.name,
                    "player_name": player.name, 
                    "player_id": player.id, 
                    "next_turn": DRAFT_STATUS["current_turn_order"]
                })
    except WebSocketDisconnect:
        # Gestion propre de la déconnexion normale de l'utilisateur
        manager.disconnect(websocket)
