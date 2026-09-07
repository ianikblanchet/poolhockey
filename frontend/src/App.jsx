import React, { useState, useEffect, useRef } from 'react';

const CURRENT_POOL_SEASON = '2026-27';
const PICK_MESSAGES = [
  'Tu ne gagneras pas avec ça... enfin, probablement pas.',
  'Wow wow, un grand talent !',
  'Choix audacieux. Très audacieux.',
  'Les experts sont officiellement perplexes.',
  'Le vestiaire approuve... à 37%.',
  'Un choix qui fera jaser dans le groupe Messenger.',
  'C’est soit du génie, soit une très belle erreur.',
  'Le repêchage vient de prendre une tournure intéressante !',
  'On avait dit un joueur, pas un porte-bonheur !',
  'Le tableau des statistiques vient de tousser un peu.',
  'Quelqu’un a vérifié si ce joueur était réveillé ?',
  'Ça sent le pari risqué... et le popcorn.',
  'La stratégie est mystérieuse, mais assumée.',
  'Le choix est fait. Les excuses peuvent commencer.',
  'Un choix solide comme une rondelle dans la bande.',
  'Le prochain trophée est peut-être déjà dans la poche.',
  'Les adversaires prennent des notes. Ou rient très fort.',
  'Pas mal ! Même l’algorithme est impressionné.',
  'C’était dans les plans depuis le début. Bien sûr.',
  'Le destin vient de lancer les dés.',
];

const isGoalie = (position) => {
  const normalizedPosition = (position || '').toLowerCase();
  return normalizedPosition === 'g' || normalizedPosition.includes('goalie') || normalizedPosition.includes('goaltender');
};

const isDefense = (position) => {
  const normalizedPosition = (position || '').toLowerCase();
  return normalizedPosition === 'd'
    || normalizedPosition === 'defense'
    || normalizedPosition.includes('defenceman')
    || normalizedPosition.includes('defenseman');
};

const getPositionCategory = (position) => {
  if (isGoalie(position)) return 'goalie';
  if (isDefense(position)) return 'defense';
  return 'attacker';
};

const shuffleArray = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const createRandomDraftOrder = (teams) => {
  if (!Array.isArray(teams) || teams.length === 0) {
    return [];
  }

  return shuffleArray(teams).map((team, index) => ({
    ...team,
    draft_position: index + 1,
  }));
};

function WelcomeOverlay({ memberName, onClose }) {
  return (
    <div className="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome-sparks" aria-hidden="true">
        <span>✦</span><span>•</span><span>✧</span><span>•</span><span>✦</span><span>·</span>
      </div>
      <div className="welcome-panel">
        <button className="welcome-close" onClick={onClose} aria-label="Fermer">×</button>
        <div className="welcome-mark" aria-hidden="true">🏒</div>
        <p className="welcome-kicker">POOL DE HOCKEY BLANCHET / NOEL</p>
        <h2 id="welcome-title">Bienvenue, {memberName || 'dans le pool'} !</h2>
        <p className="welcome-intro">Voici l’essentiel pour profiter de la saison et préparer une équipe solide.</p>
        <div className="welcome-rules">
          <div><strong>6 · 4 · 2</strong><span>6 attaquants, 4 défenseurs et 2 gardiens.</span></div>
          <div><strong>2 pts</strong><span>Un but vaut 2 points, une passe vaut 1 point.</span></div>
          <div><strong>Gardiens</strong><span>Une victoire vaut 2 points et une passe vaut 1 point.</span></div>
          <div><strong>Serpentin</strong><span>Le draft avance puis revient : 1 · 2 · 3 · 4 · 4 · 3 · 2 · 1.</span></div>
        </div>
        <button className="welcome-action" onClick={onClose}>C’est parti</button>
      </div>
    </div>
  );
}

function AuthPage({ mode, setMode, name, setName, password, setPassword, onSubmit, error }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#111', color: '#fff', fontFamily: 'sans-serif', padding: '24px', boxSizing: 'border-box' }}>
      <form onSubmit={onSubmit} style={{ width: '100%', maxWidth: '380px', background: '#222', padding: '28px', borderRadius: '8px', boxSizing: 'border-box' }}>
        <p style={{ color: '#8ecae6', margin: 0, fontSize: '12px' }}>POOL DE HOCKEY LNH</p>
        <h1 style={{ margin: '8px 0 24px' }}>{mode === 'login' ? 'Connexion participant' : 'Créer un accès participant'}</h1>
        <label style={{ display: 'block', marginBottom: '14px' }}>
          Nom de participant
          <input value={name} onChange={event => setName(event.target.value)} required minLength={2} style={{ display: 'block', width: '100%', marginTop: '6px', padding: '10px', boxSizing: 'border-box' }} />
        </label>
        <label style={{ display: 'block', marginBottom: '14px' }}>
          Mot de passe
          <input type="password" value={password} onChange={event => setPassword(event.target.value)} required minLength={6} style={{ display: 'block', width: '100%', marginTop: '6px', padding: '10px', boxSizing: 'border-box' }} />
        </label>
        {error && <div style={{ color: '#ff8a80', marginBottom: '14px' }}>{error}</div>}
        <button type="submit" style={{ width: '100%', background: '#2196f3', color: '#fff', border: 'none', padding: '11px', cursor: 'pointer' }}>
          {mode === 'login' ? 'Se connecter' : 'Créer mon accès'}
        </button>
        <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} style={{ width: '100%', marginTop: '10px', background: 'transparent', color: '#8ecae6', border: '1px solid #456', padding: '10px', cursor: 'pointer' }}>
          {mode === 'login' ? 'Nouvelle équipe ? Créer un accès' : 'J’ai déjà un accès'}
        </button>
      </form>
    </div>
  );
}

function SeasonPage({ season, draftOrder, currentTurn, poolTeams, selectionMessage, onBack, onReset, onLogout, onWelcome }) {
  const currentTeam = draftOrder.find(team => team.draft_position === currentTurn);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const selectedTeam = poolTeams.find(team => String(team.id) === String(selectedTeamId));
  const teamPoints = (team) => (team.players || []).reduce((total, player) => total + (player.points || 0), 0);
  const categoryLabel = { attacker: 'Avants', defense: 'Défenseurs', goalie: 'Gardiens' };
  const rosterLimits = { attacker: 6, defense: 4, goalie: 2 };
  const isRosterComplete = (team) => {
    const counts = (team.players || []).reduce((result, player) => {
      const category = getPositionCategory(player.position);
      return { ...result, [category]: result[category] + 1 };
    }, { attacker: 0, defense: 0, goalie: 0 });
    return Object.keys(rosterLimits).every(category => counts[category] === rosterLimits[category]);
  };
  const draftComplete = poolTeams.length > 0 && poolTeams.every(isRosterComplete);

  return (
    <div style={{ width: '100vw', minHeight: '100vh', fontFamily: 'sans-serif', background: '#111', color: '#fff', boxSizing: 'border-box' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', padding: '18px 4vw', background: '#181818', borderBottom: '1px solid #333' }}>
        <div>
          <p style={{ color: '#8ecae6', margin: 0, fontSize: '12px' }}>SAISON DU POOL</p>
          <h1 style={{ margin: '5px 0 0' }}>{season.name}</h1>
          <p style={{ color: '#aaa', margin: '6px 0 0' }}>{draftComplete ? 'Composition complète · Draft terminé' : `Saison créée avec succès · Statut : ${season.status || 'draft'}`}</p>
        </div>
        <div>
          {onBack && <button onClick={onBack} style={{ backgroundColor: '#345', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: '4px', cursor: 'pointer' }}>
            ← Retour à la création des équipes
          </button>}
          {onReset && <button onClick={onReset} style={{ marginLeft: '10px', backgroundColor: '#b71c1c', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: '4px', cursor: 'pointer' }}>
            Réinitialiser la saison
          </button>}
          <button onClick={onWelcome} style={{ marginLeft: '10px', backgroundColor: '#176b87', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: '4px', cursor: 'pointer' }}>
            Revoir les règles
          </button>
          <button onClick={onLogout} style={{ marginLeft: '10px', backgroundColor: '#345', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: '4px', cursor: 'pointer' }}>
            Se déconnecter
          </button>
        </div>
      </header>
      {selectionMessage && (
        <div style={{ margin: '18px 4vw 0', padding: '14px 18px', background: '#4a3210', border: '1px solid #d99b2b', borderRadius: '6px', color: '#ffe0a3', fontSize: '18px', fontWeight: 'bold' }}>
          {selectionMessage}
        </div>
      )}
      <main style={{ width: '100%', padding: '28px 4vw 50px', boxSizing: 'border-box' }}>
        {draftComplete ? (
          <div style={{ marginTop: '25px', background: '#164e78', border: '2px solid #42a5f5', padding: '18px', borderRadius: '6px' }}>
            <strong>Draft terminé</strong>
            <div style={{ color: '#d7efff', marginTop: '6px' }}>Toutes les équipes ont leur composition complète.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginTop: '25px' }}>
            <div style={{ background: '#222', padding: '18px', borderRadius: '6px' }}>
              <strong>Équipe qui choisit</strong>
              <div style={{ color: '#4caf50', fontSize: '20px', marginTop: '8px' }}>{currentTeam?.name || 'Terminé'}</div>
              <div style={{ color: '#aaa', marginTop: '5px' }}>Tour #{currentTurn}</div>
            </div>
          <div style={{ background: '#222', padding: '18px', borderRadius: '6px' }}>
            <strong>Équipes inscrites</strong>
            <div style={{ color: '#8ecae6', fontSize: '20px', marginTop: '8px' }}>{poolTeams.length}</div>
          </div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(360px, 1fr)', gap: '20px', marginTop: '20px' }}>
          {!draftComplete ? (
            <div style={{ background: '#222', padding: '18px', borderRadius: '6px' }}>
              <h2>Ordre de sélection</h2>
              {draftOrder.map(team => (
                <div key={team.id} style={{ padding: '12px', marginTop: '8px', borderRadius: '4px', background: String(team.id) === String(currentTeam?.id) ? '#164e78' : '#1a1a1a', border: String(team.id) === String(currentTeam?.id) ? '2px solid #42a5f5' : '1px solid #333' }}>
                  #{team.draft_position} · {team.name}
                  {String(team.id) === String(currentTeam?.id) && <strong> · À SON TOUR</strong>}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: '#222', padding: '18px', borderRadius: '6px' }}>
              <h2>Résumé des équipes</h2>
              {poolTeams.map(team => (
                <button key={team.id} onClick={() => setSelectedTeamId(team.id)} style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: '8px', padding: '14px', background: String(team.id) === String(selectedTeamId) ? '#164e78' : '#1a1a1a', color: '#fff', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer' }}>
                  <strong>{team.name}</strong>
                  <span style={{ float: 'right', color: '#4caf50' }}>{teamPoints(team)} pts</span>
                  <div style={{ color: '#aaa', marginTop: '5px', fontSize: '12px' }}>{(team.players || []).length} joueurs · composition complète</div>
                </button>
              ))}
            </div>
          )}
          <div style={{ background: '#222', padding: '18px', borderRadius: '6px' }}>
            <h2>Statistiques des équipes</h2>
            {poolTeams.map(team => (
              <button key={team.id} onClick={() => setSelectedTeamId(team.id)} style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: '8px', padding: '12px', background: String(team.id) === String(selectedTeamId) ? '#164e78' : '#1a1a1a', color: '#fff', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer' }}>
                <strong>{team.name}</strong> · {teamPoints(team)} pts · {(team.players || []).length} joueurs
              </button>
            ))}
            {selectedTeam && (
              <div style={{ marginTop: '18px', borderTop: '1px solid #444', paddingTop: '12px' }}>
                <h3>{selectedTeam.name} · détail des joueurs</h3>
                {['attacker', 'defense', 'goalie'].map(category => {
                  const players = (selectedTeam.players || []).filter(player => getPositionCategory(player.position) === category);
                  return (
                    <div key={category} style={{ marginTop: '12px' }}>
                      <strong style={{ color: category === 'goalie' ? '#a5d6a7' : category === 'defense' ? '#ffcc80' : '#8ecae6' }}>{categoryLabel[category]} ({players.length})</strong>
                      {players.map(player => (
                        <div key={player.id} style={{ padding: '7px 0', borderBottom: '1px solid #333', fontSize: '13px' }}>
                          {player.name} · {player.points || 0} pts · {player.goals || 0} B · {player.assists || 0} P{category === 'goalie' ? ` · ${player.wins || 0} V` : ''} · {player.games_played || 0} MJ
                          {category === 'goalie' && player.save_percentage != null ? ` · ${(player.save_percentage * 100).toFixed(1)}%` : ''}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function App() {
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('nhl-auth-token'));
  const [authMode, setAuthMode] = useState('login');
  const [authName, setAuthName] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [players, setPlayers] = useState([]);
  const [playerSearch, setPlayerSearch] = useState('');
  const [playerType, setPlayerType] = useState('all');
  const [standings, setStandings] = useState([]);
  const [newPoolerName, setNewPoolerName] = useState('');
  const [currentTurn, setCurrentTurn] = useState(1);
  const [myPoolerData, setMyPoolerData] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('nhl-pooler') || 'null');
    } catch {
      return null;
    }
  });
  const [logs, setLogs] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(CURRENT_POOL_SEASON);
  const [seasonName, setSeasonName] = useState('');
  const [currentPage, setCurrentPage] = useState('pool');
  const [poolSeason, setPoolSeason] = useState(null);
  const [draftOrder, setDraftOrder] = useState([]);
  const [draftStarted, setDraftStarted] = useState(false);
  const [poolTeams, setPoolTeams] = useState([]);
  const [pendingPoolers, setPendingPoolers] = useState([]);
  const [selectionMessage, setSelectionMessage] = useState('');
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  
  const ws = useRef(null);
  const backendHost = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname;
  const apiOrigin = import.meta.env.VITE_API_URL || `${window.location.protocol}//${backendHost}:8000`;
  const API_URL = `${apiOrigin}/api`;
  const websocketOrigin = import.meta.env.VITE_WS_URL || apiOrigin;
  const websocketUrl = new URL(websocketOrigin);
  websocketUrl.protocol = websocketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  websocketUrl.pathname = '/ws/draft';
  websocketUrl.search = '';
  const WS_URL = websocketUrl.toString();

  useEffect(() => {
    if (!authToken) return undefined;
    fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('Session expirée.')))
      .then(profile => setMyPoolerData(profile))
      .catch(() => {
        localStorage.removeItem('nhl-auth-token');
        setAuthToken(null);
      });
    fetchData();
    connectWebSocket();
    return () => ws.current && ws.current.close();
  }, [authToken]);

  useEffect(() => {
    if (!authToken || !myPoolerData?.id) return;
    const welcomeKey = `nhl-welcome-seen-${myPoolerData.id}`;
    if (!localStorage.getItem(welcomeKey)) {
      localStorage.setItem(welcomeKey, 'true');
      setWelcomeVisible(true);
    }
  }, [authToken, myPoolerData?.id]);

  const authHeaders = () => ({ Authorization: `Bearer ${authToken}` });

  const handleAuth = async (event) => {
    event.preventDefault();
    setAuthError('');
    try {
      const res = await fetch(`${API_URL}/auth/${authMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: authName, password: authPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Connexion impossible.');
      if (authMode === 'register') {
        setAuthError(data.message || 'Inscription envoyée. Attendez l’approbation de l’administrateur.');
        setAuthMode('login');
        setAuthPassword('');
        return;
      }
      localStorage.setItem('nhl-auth-token', data.token);
      localStorage.setItem('nhl-pooler', JSON.stringify(data.pooler));
      setMyPoolerData(data.pooler);
      setAuthToken(data.token);
      setAuthPassword('');
    } catch (error) {
      setAuthError(error.message);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    const res = await fetch(`${API_URL}/poolers?name=${encodeURIComponent(newPoolerName)}`, {
      method: 'POST',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.detail || "Erreur lors de l'enregistrement.");
      return;
    }
    setNewPoolerName('');
    await fetchData();
  };

  const fetchData = async () => {
    const [pRes, sRes, teamRes, seasonRes] = await Promise.all([
      fetch(`${API_URL}/players`, { headers: authHeaders() }),
      fetch(`${API_URL}/standings`, { headers: authHeaders() }),
      fetch(`${API_URL}/poolers`, { headers: authHeaders() }),
      fetch(`${API_URL}/seasons`, { headers: authHeaders() }),
    ]);

    if ([pRes, sRes, teamRes, seasonRes].some(response => response.status === 401)) {
      localStorage.removeItem('nhl-auth-token');
      setAuthToken(null);
      return;
    }

    setPlayers(await pRes.json());
    setStandings(await sRes.json());
    const teams = await teamRes.json();
    setPoolTeams(teams);
    if (myPoolerData) {
      const currentPooler = teams.find(team => String(team.id) === String(myPoolerData.id));
      if (currentPooler && currentPooler.name !== myPoolerData.name) {
        setMyPoolerData({ ...myPoolerData, name: currentPooler.name });
      }
    }

    const seasons = await seasonRes.json();
    const latestSeason = Array.isArray(seasons) ? seasons[0] : null;
    if (latestSeason) {
      const order = latestSeason.draft_order || [];
      setPoolSeason({ ...latestSeason, order });
      setDraftOrder(order);
      setDraftStarted(order.length > 0);
    }
  };

  const connectWebSocket = () => {
    ws.current = new WebSocket(`${WS_URL}?token=${encodeURIComponent(authToken)}`);
    ws.current.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "INIT_DRAFT") setCurrentTurn(msg.current_turn);
      if (msg.type === "PICK_CONFIRMED") {
        setCurrentTurn(msg.next_turn);
        const funnyMessage = PICK_MESSAGES[msg.player_id % PICK_MESSAGES.length];
        setSelectionMessage(`${msg.pooler_name} choisit ${msg.player_name} : ${funnyMessage}`);
        setLogs(prev => [`🏒 ${msg.pooler_name} a repêché ${msg.player_name} — ${funnyMessage}`, ...prev]);
        fetchData();
      }
      if (msg.type === "ERROR") alert(msg.message);
    };
  };

  useEffect(() => {
    if (myPoolerData) {
      localStorage.setItem('nhl-pooler', JSON.stringify(myPoolerData));
    } else {
      localStorage.removeItem('nhl-pooler');
    }
  }, [myPoolerData]);

  useEffect(() => {
    if (!authToken || !myPoolerData?.is_admin) {
      setPendingPoolers([]);
      return;
    }
    fetch(`${API_URL}/admin/pending-poolers`, { headers: authHeaders() })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('Demandes introuvables.')))
      .then(setPendingPoolers)
      .catch(() => setPendingPoolers([]));
  }, [authToken, myPoolerData?.is_admin]);

  const approvePooler = async (poolerId) => {
    const res = await fetch(`${API_URL}/admin/poolers/${poolerId}/approve`, {
      method: 'POST',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.detail || 'Impossible d’approuver cette inscription.');
      return;
    }
    setPendingPoolers(current => current.filter(pooler => pooler.id !== poolerId));
    await fetchData();
  };

  const rejectPooler = async (pooler) => {
    if (!window.confirm(`Refuser l'inscription de « ${pooler.name} » ?`)) return;
    const res = await fetch(`${API_URL}/admin/poolers/${pooler.id}/reject`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.detail || 'Impossible de refuser cette inscription.');
      return;
    }
    setPendingPoolers(current => current.filter(item => item.id !== pooler.id));
  };

  const handleRemovePooler = async (pooler) => {
    if (!window.confirm(`Retirer l'équipe « ${pooler.name} » du pool ?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/poolers/${pooler.id}`, { method: 'DELETE', headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Impossible de retirer cette équipe.');
      }

      if (myPoolerData?.id === pooler.id) {
        setMyPoolerData(null);
      }
      setPoolSeason(null);
      setDraftOrder([]);
      setDraftStarted(false);
      setLogs(prev => [`🗑️ ${pooler.name} a été retirée du pool.`, ...prev]);
      await fetchData();
    } catch (error) {
      alert(error.message || 'Impossible de retirer cette équipe.');
    }
  };

  const handleDraft = (playerId) => {
    const currentTeam = draftOrder.find(team => team.draft_position === currentTurn);
    if (!currentTeam) {
      alert("L'ordre du draft n'est pas encore disponible.");
      return;
    }
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      alert('La connexion au serveur de draft n’est pas disponible.');
      return;
    }
    ws.current.send(JSON.stringify({ type: "MAKE_PICK", pooler_id: currentTeam.id, player_id: playerId }));
  };

  const currentDraftTeam = draftOrder.find(team => team.draft_position === currentTurn);
  const canSelectForCurrentTeam = Boolean(currentDraftTeam);
  const currentTeamData = poolTeams.find(team => String(team.id) === String(currentDraftTeam?.id));
  const rosterCounts = (currentTeamData?.players || []).reduce((counts, player) => {
    const category = getPositionCategory(player.position);
    return { ...counts, [category]: counts[category] + 1 };
  }, { attacker: 0, defense: 0, goalie: 0 });
  const rosterLimits = { attacker: 6, defense: 4, goalie: 2 };
  const canSelectPlayer = (player) => (
    canSelectForCurrentTeam &&
    rosterCounts[getPositionCategory(player.position)] < rosterLimits[getPositionCategory(player.position)]
  );
  const getPoints25_26 = (player) => Number(player.previous_points ?? player.points ?? 0);

  const visiblePlayers = [...players]
    .filter(player => {
      const search = playerSearch.trim().toLowerCase();
      const matchesSearch = !search || `${player.name} ${player.team}`.toLowerCase().includes(search);
      const matchesType = playerType === 'all'
        || (playerType === 'goalies' && getPositionCategory(player.position) === 'goalie')
        || (playerType === 'defense' && getPositionCategory(player.position) === 'defense')
        || (playerType === 'attackers' && getPositionCategory(player.position) === 'attacker');
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      const aPoints = getPoints25_26(a);
      const bPoints = getPoints25_26(b);
      if (bPoints !== aPoints) return bPoints - aPoints;
      return String(a.name).localeCompare(String(b.name), 'fr', { sensitivity: 'base' });
    });

  const importStatsFile = async (event, endpoint, label) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_URL}/${endpoint}`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Import ${label} impossible.`);
      alert(data.message || `Statistiques ${label} importées.`);
      await fetchData();
    } catch (error) {
      alert(error.message || `Import ${label} impossible.`);
    }
  };

  const resetPoolSeason = async () => {
    if (!poolSeason) return;
    const confirmed = window.confirm(
      `Attention : réinitialiser « ${poolSeason.name} » supprimera son ordre de draft, videra les équipes et libérera tous les joueurs sélectionnés. Les statistiques historiques seront conservées.\n\nVoulez-vous continuer ?`,
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_URL}/seasons/${poolSeason.id}/reset`, { method: 'POST', headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Impossible de réinitialiser la saison.');
      setPoolSeason(null);
      setDraftOrder([]);
      setDraftStarted(false);
      setCurrentTurn(1);
      setCurrentPage('pool');
      setLogs(prev => [`🧹 ${poolSeason.name} a été réinitialisée.`, ...prev]);
      await fetchData();
      alert(data.message);
    } catch (error) {
      alert(error.message || 'Impossible de réinitialiser la saison.');
    }
  };

  const createPoolSeason = async () => {
    const trimmedSeasonName = seasonName.trim();
    if (!trimmedSeasonName) {
      alert('Donne un nom à la saison avant de la créer.');
      return;
    }

    const sourceTeams = standings.length > 0
      ? standings.map(team => ({ id: team.id, name: team.name }))
      : myPoolerData
        ? [{ id: myPoolerData.id, name: myPoolerData.name }]
        : [
            { id: 1, name: 'Équipe 1' },
            { id: 2, name: 'Équipe 2' },
            { id: 3, name: 'Équipe 3' },
            { id: 4, name: 'Équipe 4' },
          ];

    const nextOrder = createRandomDraftOrder(sourceTeams);
    const payload = {
      name: trimmedSeasonName,
      order: nextOrder,
    };

    try {
      const res = await fetch(`${API_URL}/seasons`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Impossible de créer la saison.');
      }

      setPoolSeason({
        ...data,
        order: data.draft_order || nextOrder,
      });
      setDraftOrder(data.draft_order || nextOrder);
      setDraftStarted(true);
      setCurrentTurn((data.draft_order || nextOrder)[0]?.draft_position || 1);
      setCurrentPage('season');
      setLogs(prev => [`🎯 Nouvelle saison créée : ${data.name}. Ordre aléatoire établi.`, ...prev]);
    } catch (error) {
      alert(error.message || 'La création de la saison a échoué.');
    }
  };

  const launchRandomSelectionOrder = async () => {
    if (!standings.length && !myPoolerData) {
      alert('Inscris au moins une équipe avant de lancer le draft.');
      return;
    }

    const sourceTeams = standings.length > 0
      ? standings.map(team => ({ id: team.id, name: team.name }))
      : [{ id: myPoolerData.id, name: myPoolerData.name }];

    const nextOrder = createRandomDraftOrder(sourceTeams);

    if (poolSeason?.id) {
      try {
        const res = await fetch(`${API_URL}/seasons/${poolSeason.id}/order`, {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: nextOrder }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || "Impossible de modifier l'ordre de sélection.");
        }

        setPoolSeason(prev => ({ ...prev, ...data, order: data.draft_order }));
        setDraftOrder(data.draft_order);
        setDraftStarted(true);
        setCurrentTurn(data.draft_order[0]?.draft_position || 1);
        setLogs(prev => [`🎲 Ordre de sélection relancé : ${data.draft_order.map(team => team.name).join(' → ')}`, ...prev]);
        return;
      } catch (error) {
        alert(error.message || "Impossible de modifier l'ordre de sélection.");
        return;
      }
    }

    setDraftOrder(nextOrder);
    setDraftStarted(true);
    setCurrentTurn(nextOrder[0]?.draft_position || 1);
    setPoolSeason(prev => ({
      ...prev,
      name: prev?.name || seasonName.trim() || `Saison ${selectedSeason}`,
      status: 'draft',
      order: nextOrder,
    }));
    setLogs(prev => [`🎲 Ordre de sélection relancé : ${nextOrder.map(team => team.name).join(' → ')}`, ...prev]);
  };

  if (!authToken) {
    return <AuthPage mode={authMode} setMode={setAuthMode} name={authName} setName={setAuthName} password={authPassword} setPassword={setAuthPassword} onSubmit={handleAuth} error={authError} />;
  }

  if (poolSeason && (currentPage === 'season' || !myPoolerData?.is_admin)) {
    return (
      <>
        <SeasonPage
          season={poolSeason}
          draftOrder={draftOrder}
          currentTurn={currentTurn}
          poolTeams={poolTeams}
          selectionMessage={selectionMessage}
          onBack={myPoolerData?.is_admin ? () => setCurrentPage('pool') : undefined}
          onReset={myPoolerData?.is_admin ? resetPoolSeason : undefined}
          onWelcome={() => setWelcomeVisible(true)}
          onLogout={() => { localStorage.removeItem('nhl-auth-token'); setAuthToken(null); setMyPoolerData(null); }}
        />
        {welcomeVisible && <WelcomeOverlay memberName={myPoolerData?.name} onClose={() => setWelcomeVisible(false)} />}
      </>
    );
  }

  if (!poolSeason && !myPoolerData?.is_admin) {
    return (
      <>
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#111', color: '#fff', fontFamily: 'sans-serif', padding: '24px', boxSizing: 'border-box' }}>
          <div style={{ textAlign: 'center' }}>
            <h2>Aucune saison active</h2>
            <p style={{ color: '#aaa' }}>L’organisateur n’a pas encore ouvert la saison du pool.</p>
            <button onClick={() => { localStorage.removeItem('nhl-auth-token'); setAuthToken(null); }} style={{ background: '#345', color: '#fff', border: 'none', padding: '10px 14px', cursor: 'pointer' }}>Se déconnecter</button>
            <button onClick={() => setWelcomeVisible(true)} style={{ marginTop: '10px', background: '#176b87', color: '#fff', border: 'none', padding: '10px 14px', cursor: 'pointer' }}>Revoir les règles</button>
          </div>
        </div>
        {welcomeVisible && <WelcomeOverlay memberName={myPoolerData?.name} onClose={() => setWelcomeVisible(false)} />}
      </>
    );
  }

  return (
    <div style={{ padding: '30px', fontFamily: 'sans-serif', backgroundColor: '#111', color: '#fff', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
        <h2>🥅 Pool de Hockey Blanchet/Noel</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {poolSeason && (
            <button
              onClick={() => setCurrentPage('season')}
              style={{ backgroundColor: currentPage === 'season' ? '#1976d2' : '#345', color: '#fff', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer' }}
            >
              Saison active
            </button>
          )}
          <button onClick={() => setWelcomeVisible(true)} style={{ backgroundColor: '#176b87', color: '#fff', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer' }}>
            Revoir les règles
          </button>
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            style={{ padding: '10px', borderRadius: '4px', background: '#1a1a1a', color: '#fff', border: '1px solid #444' }}
          >
            <option value="2025-26">2025-26</option>
            <option value="2026-27">2026-27</option>
          </select>
          <input
            type="text"
            required
            value={seasonName}
            onChange={(e) => setSeasonName(e.target.value)}
            placeholder="Nom de la saison"
            style={{ padding: '10px', borderRadius: '4px', background: '#1a1a1a', color: '#fff', border: '1px solid #444', minWidth: '180px' }}
          />
          <button
            onClick={createPoolSeason}
            style={{ backgroundColor: '#4caf50', color: '#fff', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer' }}
          >
            🏆 Créer saison
          </button>
          <button
            onClick={launchRandomSelectionOrder}
            style={{ backgroundColor: '#2196f3', color: '#fff', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer' }}
          >
            🎲 Ordre aléatoire
          </button>
          <label style={{ backgroundColor: '#00695c', color: '#fff', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer' }}>
            📥 Importer Excel gardiens 25/26
            <input type="file" accept=".xlsx,.xlsm" onChange={event => importStatsFile(event, 'import-goalie-stats', 'gardiens 2026-27')} style={{ display: 'none' }} />
          </label>
          <label style={{ backgroundColor: '#455a64', color: '#fff', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer' }}>
            📥 Importer Excel 25/26
            <input type="file" accept=".xlsx,.xlsm" onChange={event => importStatsFile(event, 'import-previous-stats', '2025-26')} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {selectionMessage && (
        <div style={{ margin: '20px 0', padding: '14px 18px', background: '#4a3210', border: '1px solid #d99b2b', borderRadius: '6px', color: '#ffe0a3', fontSize: '18px', fontWeight: 'bold' }}>
          {selectionMessage}
        </div>
      )}

      {welcomeVisible && <WelcomeOverlay memberName={myPoolerData?.name} onClose={() => setWelcomeVisible(false)} />}

      {myPoolerData?.is_admin && pendingPoolers.length > 0 && (
        <div style={{ margin: '20px 0', backgroundColor: '#3b2f12', border: '1px solid #a67c00', padding: '15px', borderRadius: '6px' }}>
          <h3 style={{ marginTop: 0 }}>Inscriptions à approuver ({pendingPoolers.length})</h3>
          {pendingPoolers.map(pooler => (
            <div key={pooler.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #5b4818' }}>
              <span>{pooler.name}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => approvePooler(pooler.id)} style={{ backgroundColor: '#4caf50', color: '#fff', border: 'none', padding: '8px 12px', cursor: 'pointer' }}>
                  Approuver
                </button>
                <button onClick={() => rejectPooler(pooler)} style={{ backgroundColor: '#b71c1c', color: '#fff', border: 'none', padding: '8px 12px', cursor: 'pointer' }}>
                  Refuser
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', margin: '20px 0' }}>
        <div style={{ backgroundColor: '#222', padding: '15px', borderRadius: '6px' }}>
          <h3>Enregistrement Équipe</h3>
          {!myPoolerData ? (
            <form onSubmit={handleRegister}>
              <input type="text" value={newPoolerName} onChange={e => setNewPoolerName(e.target.value)} placeholder="Nom d'équipe..." style={{ padding: '8px', width: '60%' }} />
              <button type="submit" style={{ padding: '8px', backgroundColor: '#4caf50', border:'none', marginLeft: '5px' }}>Rejoindre</button>
            </form>
          ) : (
            <div style={{ color: '#4caf50' }}>
              <p>✓ Connecté : {myPoolerData.name} (Position Draft: #{myPoolerData.draft_order})</p>
            </div>
          )}
          {poolSeason && (
            <div style={{ marginTop: '12px', fontSize: '13px', color: '#ddd' }}>
              <strong>Saison :</strong> {poolSeason.name}
              <div style={{ marginTop: '6px' }}>
                <strong>Ordre :</strong>{' '}
                {draftOrder.map((team, index) => (
                  <span
                    key={team.id}
                    style={{
                      color: String(team.id) === String(currentDraftTeam?.id) ? '#fff' : '#aaa',
                      backgroundColor: String(team.id) === String(currentDraftTeam?.id) ? '#1976d2' : 'transparent',
                      padding: '2px 5px',
                      borderRadius: '3px',
                      fontWeight: String(team.id) === String(currentDraftTeam?.id) ? 'bold' : 'normal',
                    }}
                  >
                    {index > 0 ? ' → ' : ''}{team.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ backgroundColor: '#222', padding: '15px', borderRadius: '6px' }}>
          <h3>Statut du Draft — Tour Actuel : <span style={{ color: '#2196f3' }}>#{currentTurn}</span></h3>
          <div style={{ height: '60px', overflowY: 'auto', background: '#000', padding: '5px', fontSize: '12px' }}>
            {logs.map((log, i) => <div key={i}>{log}</div>)}
          </div>
          {draftStarted && draftOrder.length > 0 && (
            <div style={{ marginTop: '10px', fontSize: '12px', color: canSelectForCurrentTeam ? '#4caf50' : '#aaa' }}>
              Équipe qui choisit : <strong>{currentDraftTeam?.name || 'Terminé'}</strong>
              {currentDraftTeam && (
                <div style={{ marginTop: '5px' }}>
                  Composition : {rosterCounts.attacker}/6 attaquants · {rosterCounts.defense}/4 défenseurs · {rosterCounts.goalie}/2 gardiens
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h3>🏃 Joueurs de la LNH disponibles ({visiblePlayers.length}/{players.length})</h3>
            <input
              type="search"
              value={playerSearch}
              onChange={e => setPlayerSearch(e.target.value)}
              placeholder="Rechercher un joueur ou une équipe"
              aria-label="Rechercher un joueur ou une équipe"
              style={{ padding: '8px', minWidth: '220px', background: '#1a1a1a', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }} role="group" aria-label="Filtrer les joueurs">
            {[
              ['all', 'Tous'],
              ['attackers', 'Avants'],
              ['defense', 'Défenseurs'],
              ['goalies', 'Gardiens'],
            ].map(([type, label]) => (
              <button
                key={type}
                onClick={() => setPlayerType(type)}
                aria-pressed={playerType === type}
                style={{
                  backgroundColor: playerType === type ? '#2196f3' : '#444',
                  color: '#fff',
                  border: 'none',
                  padding: '7px 10px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ maxHeight: '400px', overflowY: 'auto', background: '#222', padding: '10px' }}>
            <table style={{ width: '100%', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Nom</th>
                  <th style={{ textAlign: 'left' }}>Équipe</th>
                  {playerType === 'goalies' ? (
                    <>
                      <th style={{ textAlign: 'center' }}>Victoires 25/26</th>
                      <th style={{ textAlign: 'center' }}>Efficacité 25/26</th>
                      <th style={{ textAlign: 'center' }}>Passes 25/26</th>
                      <th style={{ textAlign: 'center' }}>Buts 25/26</th>
                    </>
                  ) : (
                    <>
                      <th style={{ textAlign: 'center' }}>Buts 25/26</th>
                      <th style={{ textAlign: 'center' }}>Passes 25/26</th>
                      <th style={{ textAlign: 'center' }}>Points 25/26</th>
                    </>
                  )}
                  <th style={{ textAlign: 'center' }}>Sélection</th>
                </tr>
              </thead>
              <tbody>
                {visiblePlayers.map(p => (
                  <tr key={p.id} style={{ opacity: p.is_drafted ? 0.3 : 1 }}>
                    <td style={{ textAlign: 'left' }}>{p.name}</td><td style={{ textAlign: 'left' }}>{p.team}</td>
                    {playerType === 'goalies' ? (
                      <>
                        <td style={{ textAlign: 'center' }}>{p.previous_wins ?? '-'}</td>
                        <td style={{ textAlign: 'center' }}>{p.previous_save_percentage != null ? `${(p.previous_save_percentage * 100).toFixed(1)}%` : '-'}</td>
                        <td style={{ textAlign: 'center' }}>{p.previous_assists ?? '-'}</td>
                        <td style={{ textAlign: 'center' }}>{p.previous_goals ?? '-'}</td>
                      </>
                    ) : (
                      <>
                        <td style={{ textAlign: 'center' }}>{p.previous_goals ?? '-'}</td>
                        <td style={{ textAlign: 'center' }}>{p.previous_assists ?? '-'}</td>
                        <td style={{ textAlign: 'center' }}>{p.previous_points ?? '-'}</td>
                      </>
                    )}
                    <td style={{ textAlign: 'center' }}><button disabled={p.is_drafted || !canSelectPlayer(p)} onClick={() => handleDraft(p.id)} style={{ backgroundColor: p.is_drafted || !canSelectPlayer(p) ? '#444' : '#2196f3', color: '#fff', border:'none', padding: '4px 8px', cursor: p.is_drafted || !canSelectPlayer(p) ? 'not-allowed' : 'pointer' }}>{p.is_drafted ? "Pris" : "Choisir"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '30px', backgroundColor: '#1d1d1d', padding: '20px', borderRadius: '8px' }}>
        <h3>🏆 Équipes du Pool</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
          {poolTeams.length > 0 ? (
            poolTeams.map(team => (
              <div key={team.id} style={{ background: String(team.id) === String(currentDraftTeam?.id) ? '#164e78' : '#222', borderRadius: '6px', padding: '12px', border: String(team.id) === String(currentDraftTeam?.id) ? '2px solid #42a5f5' : '1px solid #333' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <strong>{team.name}</strong>
                  <span style={{ color: '#4caf50', fontWeight: 'bold' }}>{team.players?.reduce((sum, pl) => sum + (pl.points || 0), 0) || 0} PTS</span>
                </div>
                {team.players && team.players.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: '18px', color: '#ddd', fontSize: '12px' }}>
                    {[
                      ['attacker', 'Avants', '#8ecae6'],
                      ['defense', 'Défenseurs', '#ffcc80'],
                      ['goalie', 'Gardiens', '#a5d6a7'],
                    ].map(([category, label, color]) => {
                      const categoryPlayers = team.players.filter(player => getPositionCategory(player.position) === category);
                      return (
                        <li key={category} style={{ listStyle: 'none', marginBottom: '8px' }}>
                          <strong style={{ color }}>{label} ({categoryPlayers.length})</strong>
                          {categoryPlayers.length > 0 ? (
                            <ul style={{ marginTop: '4px', paddingLeft: '18px' }}>
                              {categoryPlayers.map(player => (
                                <li key={player.id}>{player.name} - {player.points || 0} pts</li>
                              ))}
                            </ul>
                          ) : (
                            <div style={{ color: '#777', marginTop: '3px' }}>Aucun</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div style={{ color: '#aaa', fontSize: '12px' }}>Aucun joueur sélectionné.</div>
                )}
              </div>
            ))
          ) : (
            <div style={{ color: '#aaa' }}>Aucune équipe enregistrée pour le moment.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;