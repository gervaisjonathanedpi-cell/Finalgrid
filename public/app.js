(() => {
  const socket = io();
  const KEY = 'finalGridSession';
  let session = JSON.parse(localStorage.getItem(KEY) || 'null');
  let currentState = null;
  const $ = (id) => document.getElementById(id);
  const modalLayer = $('modalLayer'), modalTitle = $('modalTitle'), modalDescription = $('modalDescription'), modalContent = $('modalContent');

  const saveSession = (data) => {
    session = { ...(session || {}), ...data };
    localStorage.setItem(KEY, JSON.stringify(session));
  };
  const closeModal = () => { modalLayer.hidden = true; modalContent.innerHTML = ''; document.body.style.overflow = ''; };
  const openModal = (title, description, content) => {
    modalTitle.textContent = title; modalDescription.textContent = description; modalContent.innerHTML = content;
    modalLayer.hidden = false; document.body.style.overflow = 'hidden';
  };

  $('modalClose').onclick = closeModal;
  modalLayer.onclick = (e) => { if (e.target === modalLayer) closeModal(); };

  socket.on('connect', () => { if (session?.clientId) socket.emit('resumeSession', { clientId: session.clientId }); });
  socket.on('sessionReady', saveSession);

  socket.on('appError', (message) => {
    const el = document.createElement('div');
    el.className = 'inline-error';
    el.textContent = typeof message === 'string' ? message : 'Une erreur est survenue.';
    el.style.cssText = 'margin-top:10px;padding:10px 12px;border:1px solid #71343e;border-radius:9px;background:#2a1016;color:#ff9aa4;font-size:12px;';
    modalContent.prepend(el);
  });


  function showLobby(state) {
    currentState = state;
    const isHost = session?.role === 'host';
    const players = (state.users || []).filter(u => u.role === 'player');
    const spectators = (state.users || []).filter(u => u.role === 'spectator');
    const hosts = (state.users || []).filter(u => u.role === 'host');

    openModal('Lobby', `Code de partie : ${state.code}`, `
      <div class="lobby-panel">
        <div class="lobby-code"><span>CODE</span><strong>${state.code}</strong></div>

        <div class="lobby-columns">
          <div class="lobby-box">
            <div class="lobby-box-title">Équipes</div>
            ${state.teams.map(team => `
              <div class="team-card">
                <div class="team-head"><span class="team-dot" style="background:${team.color}"></span><strong>${escapeHtml(team.name)}</strong><b>${team.score}</b></div>
                <div class="team-members">
                  ${players.filter(p => p.teamId === team.id).map(p => `
                    <div class="lobby-user">
                      <span class="connection-dot ${p.connected?'online':''}"></span>
                      <span>${escapeHtml(p.name)}</span>
                      ${isHost ? `<select class="team-move" data-player="${p.id}"><option value="0" ${p.teamId==='0'?'selected':''}>Équipe 1</option><option value="1" ${p.teamId==='1'?'selected':''}>Équipe 2</option></select>` : (session?.clientId===p.id ? `<div class="team-pick-actions"><button class="team-pick" data-team="${team.id==='0'?'1':'0'}" type="button">Changer</button></div>` : '')}
                    </div>`).join('') || '<div class="empty-members">Aucun joueur</div>'}
                </div>
              </div>`).join('')}
          </div>

          <div class="lobby-box">
            <div class="lobby-box-title">Joueurs sans équipe</div>
            <div class="unassigned-list">
              ${players.filter(p => p.teamId === null).map(p => `
                <div class="lobby-user">
                  <span class="connection-dot ${p.connected?'online':''}"></span><span>${escapeHtml(p.name)}</span>
                  ${p.id===session?.clientId ? `<div class="team-pick-actions"><button class="team-pick" data-team="0" type="button">Équipe 1</button><button class="team-pick" data-team="1" type="button">Équipe 2</button></div>` : ''}
                </div>`).join('') || '<div class="empty-members">Tous les joueurs ont une équipe</div>'}
            </div>
          </div>

          <div class="lobby-box">
            <div class="lobby-box-title">Présents</div>
            <div class="presence-list">
              ${hosts.map(u=>`<div class="lobby-user"><span class="connection-dot online"></span><span>${escapeHtml(u.name)}</span><em>Animateur</em></div>`).join('')}
              ${spectators.map(u=>`<div class="lobby-user"><span class="connection-dot ${u.connected?'online':''}"></span><span>${escapeHtml(u.name)}</span><em>Spectateur</em></div>`).join('')}
              ${!hosts.length && !spectators.length ? '<div class="empty-members">En attente de participants</div>' : ''}
            </div>
          </div>
        </div>

        <div class="lobby-themes">
          <div class="lobby-box-title">Thèmes configurés</div>
          <div class="lobby-theme-list">
            ${(state.themes || []).map(theme => `
              <div class="lobby-theme">
                <span class="theme-dot-large" style="background:${theme.color};box-shadow:0 0 10px ${theme.color}"></span>
                <span class="lobby-theme-name">${escapeHtml(theme.name)}</span>
                <span class="lobby-theme-owner">${theme.chosenBy ? `Choisi par ${escapeHtml(theme.chosenBy)}` : 'Choix non renseigné'}</span>
              </div>`).join('')}
          </div>
        </div>

        <div class="lobby-summary">
          <span>${players.length} joueur${players.length>1?'s':''}</span>
          <span>${spectators.length} spectateur${spectators.length>1?'s':''}</span>
          <span>${state.config.themeCount} thèmes · ${state.config.questionsPerTheme} questions/thème</span>
        </div>

        <div class="lobby-actions">
          <button class="modal-secondary" id="lobbyLeave" type="button">Retour</button>
          ${isHost ? `<button class="modal-primary" id="lobbyStart" type="button">Lancer la mémorisation</button>` : ''}
        </div>
      </div>`);

    document.querySelectorAll('.team-move').forEach(sel => {
      sel.onchange = () => socket.emit('setPlayerTeam', { playerId: sel.dataset.player, teamId: sel.value });
    });
    document.querySelectorAll('.team-pick').forEach(btn => {
      btn.onclick = () => socket.emit('chooseTeam', { teamId: btn.dataset.team });
    });
    $('lobbyLeave').onclick = () => { closeModal(); socket.emit('returnLobby'); localStorage.removeItem(KEY); session=null; };
    if (isHost) $('lobbyStart').onclick = () => {
      socket.emit('startMemory');
      $('lobbyStart').disabled = true;
      $('lobbyStart').textContent = 'Lancement…';
    };
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  $('createBtn').onclick = () => {
    openModal('Configurer la partie',
      'Définissez les thèmes et le nombre de questions par thème. La disposition de la grille sera calculée automatiquement.',
      `<div class="config-panel config-scroll">
        <div class="config-section">
          <div class="config-section-title"><strong>Contenu de la grille</strong><span id="gridSizeLabel">20 cases</span></div>
          <div class="config-grid-size">
            <div class="config-control">
              <label for="cfgThemeCount">Nombre de thèmes</label>
              <select id="cfgThemeCount">${Array.from({length:5},(_,i)=>{const n=i+2;return `<option value="${n}" ${n===4?'selected':''}>${n} thèmes</option>`}).join('')}</select>
            </div>
            <div class="config-control">
              <label for="cfgQuestions">Questions par thème</label>
              <select id="cfgQuestions">${Array.from({length:10},(_,i)=>{const n=i+1;return `<option value="${n}" ${n===5?'selected':''}>${n} question${n>1?'s':''}</option>`}).join('')}</select>
            </div>
          </div>
          <div class="config-summary"><span>Grille générée automatiquement</span><b id="gridSummary">4 × 5 — 20 cases</b></div>
          <div class="config-note">La taille et la disposition de la grille sont déterminées automatiquement à partir du nombre de thèmes et de questions.</div>
        </div>

        <div class="config-section">
          <div class="config-section-title"><strong>Thèmes</strong><span>2 à 6 thèmes</span></div>
          <div class="theme-list" id="themeList"></div>
          <div class="config-note">Les thèmes ne sont pas liés aux joueurs : l’animateur saisit librement leurs intitulés.</div>
        </div>

        <div class="config-section">
          <div class="config-section-title"><strong>Équipes</strong><span>2 équipes</span></div>
          <div class="team-grid">
            <div class="config-control"><label for="teamA">Équipe 1</label><input id="teamA" maxlength="30" value="Équipe A"></div>
            <div class="config-control"><label for="teamB">Équipe 2</label><input id="teamB" maxlength="30" value="Équipe B"></div>
          </div>
        </div>

        <div class="config-section">
          <div class="config-section-title"><strong>Mémorisation</strong><span>5 à 120 secondes</span></div>
          <div class="config-control"><label for="memorySeconds">Durée</label><select id="memorySeconds">
            <option value="10">10 secondes</option><option value="15">15 secondes</option><option value="20" selected>20 secondes</option><option value="30">30 secondes</option><option value="45">45 secondes</option><option value="60">60 secondes</option>
          </select></div>
        </div>

        <div class="config-actions">
          <button class="modal-secondary" id="configCancel" type="button">Retour</button>
          <button class="modal-primary" id="configCreate" type="button">Créer la partie</button>
        </div>
      </div>`);

    const themeColors = ['#2f80ff','#ef3f4f','#22c55e','#f59e0b','#a855f7','#06b6d4'];
    const renderThemes = () => {
      const count = Number($('cfgThemeCount').value);
      $('themeList').innerHTML = Array.from({length:count},(_,i)=>`
        <div class="theme-item">
          <input class="theme-color" type="color" data-index="${i}" value="${themeColors[i]}" aria-label="Couleur du thème ${i+1}">
          <span class="theme-swatch" style="color:${themeColors[i]};background:${themeColors[i]}"></span>
          <div class="theme-fields">
            <input class="form-input theme-name" data-index="${i}" maxlength="40" value="Thème ${i+1}" aria-label="Nom du thème ${i+1}" placeholder="Nom du thème">
            <input class="form-input theme-owner" data-index="${i}" maxlength="40" value="" aria-label="Joueur ayant choisi le thème ${i+1}" placeholder="Choisi par…">
          </div>
        </div>`).join('');
    };

    const updateGridSummary = () => {
      const themes = Number($('cfgThemeCount').value);
      const questions = Number($('cfgQuestions').value);
      const total = themes * questions;
      const cols = Math.max(2, Math.ceil(Math.sqrt(total)));
      const rows = Math.ceil(total / cols);
      $('gridSizeLabel').textContent = `${total} cases`;
      $('gridSummary').textContent = `${cols} × ${rows} — ${total} cases`;
    };

    renderThemes();
    updateGridSummary();
    $('cfgThemeCount').onchange = () => { renderThemes(); updateGridSummary(); };
    $('cfgQuestions').onchange = updateGridSummary;
    $('configCancel').onclick = closeModal;

    $('configCreate').onclick = () => {
      const themeCount = Number($('cfgThemeCount').value);
      const questionsPerTheme = Number($('cfgQuestions').value);
      const memorySeconds = Number($('memorySeconds').value);
      const themes = [...document.querySelectorAll('.theme-name')].map((input,i)=>({
        id:String(i), name:input.value.trim() || `Thème ${i+1}`, color:themeColors[i]
      }));
      const teamNames = [$('teamA').value.trim() || 'Équipe A', $('teamB').value.trim() || 'Équipe B'];

      $('configCreate').disabled = true;
      $('configCreate').textContent = 'Création…';

      socket.emit('createGame', {
        clientId: session?.clientId,
        name: 'Animateur',
        config: { themeCount, questionsPerTheme, memorySeconds, themes },
        teamNames
      });
    };
  };

  $('joinBtn').onclick = () => {
    openModal('Rejoindre une partie','Entre le code de la partie et choisis ton rôle. Les animateurs et spectateurs pourront rejoindre une partie déjà lancée.',`
      <div class="form-stack">
        <div><div class="form-label">Code de partie</div><input class="form-input" id="joinCode" maxlength="8" placeholder="Ex. A4F92C" autocomplete="off"></div>
        <div><div class="form-label">Nom</div><input class="form-input" id="joinName" maxlength="32" placeholder="Votre nom"></div>
        <div><div class="form-label">Rôle</div><div class="role-row">
          <div class="role-option"><input type="radio" name="joinRole" id="rolePlayer" value="player" checked><label for="rolePlayer">Joueur</label></div>
          <div class="role-option"><input type="radio" name="joinRole" id="roleHost" value="host"><label for="roleHost">Animateur</label></div>
          <div class="role-option"><input type="radio" name="joinRole" id="roleSpectator" value="spectator"><label for="roleSpectator">Spectateur</label></div>
        </div></div>
        <div id="teamField"><div class="form-label">Équipe</div><select class="form-select" id="joinTeam"><option value="0">Équipe A</option><option value="1">Équipe B</option></select></div>
        <div class="form-actions"><button class="modal-secondary" id="joinCancel" type="button">Retour</button><button class="modal-primary" id="joinSubmit" type="button">Rejoindre</button></div>
      </div>`);
    const teamField = $('teamField');
    document.querySelectorAll('input[name="joinRole"]').forEach(r => r.onchange = () => { teamField.style.display = r.checked && r.value === 'player' ? '' : 'none'; });
    $('joinCancel').onclick = closeModal;
    $('joinSubmit').onclick = () => {
      const code=$('joinCode').value.trim().toUpperCase(); if(!code){$('joinCode').focus();return;}
      const name=$('joinName').value.trim()||'Joueur', role=document.querySelector('input[name="joinRole"]:checked').value, teamId=$('joinTeam').value;
      socket.emit('joinGame',{code,role,name,teamId,clientId:session?.clientId});
      $('joinSubmit').disabled=true; $('joinSubmit').textContent='Connexion…';
    };
  };

  socket.on('joined',(data)=>{
    saveSession({gameCode:data.code,role:data.role,teamId:data.state?.users?.find(u=>u.id===session?.clientId)?.teamId ?? session?.teamId ?? null});
    closeModal();
    showLobby(data.state);
  });

  socket.on('state',(state)=>{
    currentState = state;
    if (state.phase === 'LOBBY' && session?.gameCode === state.code) showLobby(state);
  });
})();
