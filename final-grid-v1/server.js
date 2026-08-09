const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, 'public')));

const games = new Map();
const TEAM_COLORS = ['#2f80ff', '#ef3f4f'];
const PHASES = Object.freeze({ LOBBY:'LOBBY', MEMORY:'MEMORY', WAITING:'WAITING', CONFIRM:'CONFIRM', REVEAL:'REVEAL', FINISHED:'FINISHED', CLOSED:'CLOSED' });

const makeId = (bytes = 16) => crypto.randomBytes(bytes).toString('hex');
function makeCode() { let c; do c = crypto.randomBytes(3).toString('hex').toUpperCase(); while (games.has(c)); return c; }
function clean(value, fallback, max = 32) { const s = String(value ?? '').trim().slice(0, max); return s || fallback; }
function clampInt(value, min, max, fallback) { const n = Number(value); return Number.isInteger(n) && n >= min && n <= max ? n : fallback; }
function userFor(game, socket) { return game?.users.get(socket.data.clientId); }
function connectedUsers(game) { return [...game.users.values()].filter(u => u.connected); }
function sendError(socket, message) { socket.emit('appError', message); }
function makeGrid(config) {
  const total = config.rows * config.cols;
  const cells = [];
  for (let i = 0; i < total; i++) {
    const theme = config.themes[i % config.themes.length];
    cells.push({ id: i + 1, themeId: theme.id, state: 'available', revealedAt: null, timerEndsAt: null });
  }
  // Fisher-Yates so themes are distributed but positions are unpredictable.
  for (let i = cells.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  return cells;
}
function newGame(input) {
  const code = makeCode();
  const cols = clampInt(input.cols, 3, 12, 5);
  const rows = clampInt(input.rows, 2, 10, 4);
  const themes = input.themes.map((t, i) => ({ id: String(i), name: clean(t.name, `Thème ${i + 1}`, 40), color: t.color }));
  const game = {
    code, createdAt: Date.now(), lastEmptyAt: null, closed: false,
    config: { cols, rows, memorySeconds: clampInt(input.memorySeconds, 5, 120, 20) },
    themes, grid: makeGrid({ cols, rows, themes }),
    teams: [0,1].map(i => ({ id: String(i), name: clean(input.teamNames?.[i], `Équipe ${i + 1}`, 30), color: TEAM_COLORS[i], score: 0 })),
    users: new Map(),
    phase: PHASES.LOBBY,
    currentPlayerId: null,
    turnIndex: 0,
    memoryEndsAt: null,
    revealEndsAt: null,
    currentCellId: null,
    winnerTeamId: null
  };
  games.set(code, game);
  return game;
}
function players(game) { return [...game.users.values()].filter(u => u.role === 'player'); }
function turnOrder(game) { return players(game).filter(u => u.teamId !== null); }
function nextPlayer(game) {
  const order = turnOrder(game);
  if (!order.length) return null;
  if (!game.currentPlayerId) return order[0];
  const idx = order.findIndex(u => u.id === game.currentPlayerId);
  return order[(idx + 1) % order.length];
}
function publicState(game) {
  return {
    code: game.code,
    phase: game.phase,
    config: game.config,
    themes: game.themes,
    grid: game.grid,
    teams: game.teams,
    users: connectedUsers(game).map(u => ({ id:u.id, role:u.role, name:u.name, teamId:u.teamId, connected:u.connected })),
    currentPlayerId: game.currentPlayerId,
    memoryEndsAt: game.memoryEndsAt,
    revealEndsAt: game.revealEndsAt,
    currentCellId: game.currentCellId,
    winnerTeamId: game.winnerTeamId
  };
}
function broadcast(game) { io.to(game.code).emit('state', publicState(game)); }
function requireRole(socket, role) {
  const game = games.get(socket.data.gameCode);
  const user = userFor(game, socket);
  if (!game || !user || (role && user.role !== role)) return null;
  return { game, user };
}
function persistSession(socket, game, user) {
  socket.data.gameCode = game.code; socket.data.clientId = user.id; socket.data.role = user.role;
}

setInterval(() => {
  const now = Date.now();
  for (const [code, game] of games) {
    if (!connectedUsers(game).length) {
      game.lastEmptyAt ??= now;
      if (now - game.lastEmptyAt >= 30000) games.delete(code);
    } else game.lastEmptyAt = null;

    if (game.phase === PHASES.MEMORY && game.memoryEndsAt && now >= game.memoryEndsAt) {
      game.memoryEndsAt = null; game.phase = PHASES.WAITING; game.currentPlayerId = nextPlayer(game)?.id ?? null; broadcast(game);
    }
    if (game.phase === PHASES.REVEAL && game.revealEndsAt && now >= game.revealEndsAt) {
      const cell = game.grid.find(c => c.id === game.currentCellId);
      if (cell) { cell.state = 'unavailable'; cell.timerEndsAt = null; }
      game.revealEndsAt = null;
      const remaining = game.grid.some(c => c.state === 'available');
      if (!remaining) { game.phase = PHASES.FINISHED; game.currentPlayerId = null; }
      else { game.phase = PHASES.WAITING; game.currentPlayerId = nextPlayer(game)?.id ?? null; }
      broadcast(game);
    }
  }
}, 250);

io.on('connection', socket => {
  socket.on('resumeSession', ({ clientId }) => {
    if (!clientId) return;
    for (const game of games.values()) {
      const user = game.users.get(String(clientId));
      if (!user) continue;
      user.connected = true; user.socketId = socket.id; persistSession(socket, game, user); socket.join(game.code);
      socket.emit('sessionReady', { clientId:user.id, code:game.code, role:user.role, teamId:user.teamId });
      socket.emit('joined', { code:game.code, role:user.role, state:publicState(game), resumed:true });
      broadcast(game); return;
    }
  });

  socket.on('createGame', ({ clientId, name, config, teamNames }) => {
    const themes = Array.isArray(config?.themes) ? config.themes : [];
    if (themes.length < 2) return sendError(socket, 'Il faut au moins 2 thèmes.');
    const game = newGame({ cols:config.cols, rows:config.rows, memorySeconds:config.memorySeconds, themes, teamNames });
    const id = clientId || makeId();
    const user = { id, role:'host', name:clean(name,'Animateur'), teamId:null, connected:true, socketId:socket.id };
    game.users.set(id,user); persistSession(socket,game,user); socket.join(game.code);
    socket.emit('sessionReady',{clientId:id,code:game.code,role:'host',teamId:null});
    socket.emit('joined',{code:game.code,role:'host',state:publicState(game)}); broadcast(game);
  });

  socket.on('joinGame', ({ code:raw, role, name, teamId, clientId }) => {
    const code = String(raw || '').trim().toUpperCase(); const game = games.get(code);
    if (!game || game.closed) return sendError(socket,'Cette partie n’existe plus.');
    const r = ['host','player','spectator'].includes(role) ? role : 'spectator';
    const id = clientId || makeId();
    let user = game.users.get(id);
    if (user && user.connected && user.socketId !== socket.id) return sendError(socket,'Cette session est déjà connectée.');
    if (!user) user = { id, role:r, name:'', teamId:null, connected:false, socketId:null };
    user.role = r; user.name = clean(name, r === 'host' ? 'Animateur' : r === 'player' ? 'Joueur' : 'Spectateur');
    if (r === 'player') { const team = game.teams.find(t => t.id === String(teamId)); if (!team) return sendError(socket,'Choisis une équipe.'); user.teamId = team.id; }
    else if (r !== 'player') user.teamId = null;
    user.connected=true; user.socketId=socket.id; game.users.set(id,user); persistSession(socket,game,user); socket.join(code);
    socket.emit('sessionReady',{clientId:id,code,role:r,teamId:user.teamId});
    socket.emit('joined',{code,role:r,state:publicState(game),resumed:!!game.users.get(id)}); broadcast(game);
  });

  socket.on('startMemory', () => {
    const ctx = requireRole(socket,'host'); if (!ctx) return; const {game}=ctx;
    if (game.phase !== PHASES.LOBBY && game.phase !== PHASES.WAITING) return;
    if (game.grid.some(c => c.state !== 'available')) return sendError(socket,'La mémorisation est verrouillée après la première révélation.');
    game.phase = PHASES.MEMORY; game.memoryEndsAt = Date.now() + game.config.memorySeconds * 1000; broadcast(game);
  });
  socket.on('stopMemory', () => {
    const ctx=requireRole(socket,'host'); if(!ctx)return; const {game}=ctx;
    if(game.phase!==PHASES.MEMORY) return; game.phase=PHASES.WAITING; game.memoryEndsAt=null; game.currentPlayerId=nextPlayer(game)?.id??null; broadcast(game);
  });
  socket.on('selectCell', ({ cellId }) => {
    const game=games.get(socket.data.gameCode); const user=userFor(game,socket); if(!game||!user) return;
    if(!['player','host'].includes(user.role)) return;
    if(game.phase!==PHASES.WAITING) return sendError(socket,'Une case ne peut pas être sélectionnée maintenant.');
    const cell=game.grid.find(c=>c.id===Number(cellId)); if(!cell||cell.state!=='available') return sendError(socket,'Cette case est indisponible.');
    if(user.role==='player' && user.id!==game.currentPlayerId) return sendError(socket,"Ce n’est pas votre tour.");
    game.phase=PHASES.CONFIRM; game.currentCellId=cell.id; broadcast(game);
  });
  socket.on('cancelSelection',()=>{ const ctx=requireRole(socket); if(!ctx)return; const {game}=ctx; if(game.phase!==PHASES.CONFIRM)return; game.currentCellId=null; game.phase=PHASES.WAITING; broadcast(game); });
  socket.on('confirmSelection',()=>{ const game=games.get(socket.data.gameCode); const user=userFor(game,socket); if(!game||!user||!['player','host'].includes(user.role)||game.phase!==PHASES.CONFIRM)return;
    if(user.role==='player'&&user.id!==game.currentPlayerId)return;
    const cell=game.grid.find(c=>c.id===game.currentCellId); if(!cell||cell.state!=='available')return;
    cell.state='revealed'; cell.revealedAt=Date.now(); game.revealEndsAt=Date.now()+30000; cell.timerEndsAt=game.revealEndsAt; game.phase=PHASES.REVEAL; broadcast(game);
    io.to(game.code).emit('playSound','reveal');
  });
  socket.on('scoreDelta',({teamId,delta})=>{const ctx=requireRole(socket,'host');if(!ctx)return;const t=ctx.game.teams.find(x=>x.id===String(teamId));const d=Number(delta);if(!t||![1,-1].includes(d))return;t.score+=d;broadcast(ctx.game);});
  socket.on('declareWinner',({teamId})=>{const ctx=requireRole(socket,'host');if(!ctx)return;const {game}=ctx;if(game.phase!==PHASES.FINISHED)return; if(!game.teams.some(t=>t.id===String(teamId)))return;game.winnerTeamId=String(teamId);broadcast(game);});
  socket.on('endGame',()=>{const ctx=requireRole(socket,'host');if(!ctx)return;const {game}=ctx;if(game.winnerTeamId===null)return sendError(socket,'Désigne d’abord le vainqueur.');game.closed=true;io.to(game.code).emit('gameClosed');games.delete(game.code);});
  socket.on('returnLobby',()=>{const game=games.get(socket.data.gameCode);if(!game)return;socket.leave(game.code);socket.data.gameCode=null;socket.data.clientId=null;});
  socket.on('disconnect',()=>{const game=games.get(socket.data.gameCode), id=socket.data.clientId;if(!game||!id)return;const user=game.users.get(id);if(user&&user.socketId===socket.id){user.connected=false;user.socketId=null;}broadcast(game);});
});

server.listen(PORT,()=>console.log(`Final Grid: http://localhost:${PORT}`));
