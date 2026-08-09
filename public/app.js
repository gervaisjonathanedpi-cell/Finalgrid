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


  function showGame(state) {
    currentState = state;
    const isHost = session?.role === 'host';
    const isPlayer = session?.role === 'player';
    const total = state.config.totalCells || (state.config.themeCount * state.config.questionsPerTheme);
    const cols = state.config.cols;
    const phase = state.phase;
    const memoryActive = phase === 'MEMORY';
    const preMemory = phase === 'PRE_MEMORY';
    const waiting = phase === 'WAITING';
    const locked = preMemory || phase === 'LOBBY';
    const themeById = Object.fromEntries((state.themes || []).map(t => [t.id, t]));

    let countdown = '';
    if (memoryActive && state.memoryEndsAt) {
      countdown = `<span class="game-timer" data-memory-end="${state.memoryEndsAt}">--</span>`;
    } else {
      countdown = `<span class="game-timer">${memoryActive ? state.config.memorySeconds : '—'}</span>`;
    }

    const cells = (state.grid || []).map((cell, i) => {
      const theme = themeById[cell.themeId];
      const showTheme = memoryActive || cell.state === 'revealed';
      const unavailable = preMemory || memoryActive || cell.state === 'unavailable';
      const cls = `game-cell ${showTheme?'revealed':''} ${unavailable?'unavailable':''} ${cell.state==='available'&&!unavailable?'available':''}`;
      return `<button class="${cls}" type="button" data-game-cell="${cell.id}" ${unavailable?'disabled':''} ${showTheme && theme ? `style="--cell-color:${theme.color}"` : ''}>
        <span class="game-cell-number">${i+1}</span>
        ${showTheme && theme ? `<span class="game-cell-theme">${escapeHtml(theme.name)}</span>` : `<span class="game-cell-hidden">?</span>`}
      </button>`;
    }).join('');

    let title = 'Partie';
    let subtitle = '';
    if (preMemory) subtitle = 'La grille est prête. L’animateur choisit quand commencer la mémorisation.';
    else if (memoryActive) subtitle = 'Mémorisez l’emplacement des couleurs et des thèmes.';
    else if (waiting) subtitle = state.currentPlayerId ? 'En attente du premier tour.' : 'En attente du premier joueur.';
    else if (phase === 'CONFIRM') subtitle = 'Sélection en cours.';
    else if (phase === 'REVEAL') subtitle = 'Case révélée.';
    else if (phase === 'FINISHED') subtitle = 'Partie terminée.';

    openModal(title, subtitle, `
      <div class="game-screen">
        <div class="game-topbar">
          <div><span class="game-phase-label">${preMemory?'PRÊT':memoryActive?'MÉMORISATION':waiting?'ATTENTE':phase}</span><strong>${subtitle}</strong></div>
          <div class="game-timer-wrap"><span>Temps</span>${countdown}</div>
        </div>
        <div class="game-board-wrap">
          <div class="game-board" style="--cols:${cols}">${cells}</div>
        </div>
        <div class="game-controls">
          ${isHost && (preMemory || waiting) && state.grid.every(c=>c.state==='available') ? `<button class="modal-primary" id="memoryStartBtn">Mémorisation</button>` : ''}
          ${isHost && memoryActive ? `<button class="modal-secondary" id="memoryStopBtn">Arrêter la mémorisation</button>` : ''}
          ${waiting && state.currentPlayerId ? `<div class="game-turn">Tour de <strong>${escapeHtml((state.users||[]).find(u=>u.id===state.currentPlayerId)?.name || 'joueur')}</strong></div>` : ''}
        </div>
      </div>`);

    if ($('memoryStartBtn')) $('memoryStartBtn').onclick = () => socket.emit('startMemoryTimer');
    if ($('memoryStopBtn')) $('memoryStopBtn').onclick = () => socket.emit('stopMemory');

    // Les cases ne deviennent interactives pour la sélection qu'à l'étape
    // suivante. Pendant cette version, la phase de mémorisation ne permet
    // aucun clic sur la grille.
    if (false) {
      document.querySelectorAll('[data-game-cell]').forEach(cell => {
        cell.onclick = () => socket.emit('selectCell', {cellId:Number(cell.dataset.gameCell)});
      });
    }

    if (memoryActive && state.memoryEndsAt) {
      const tick = () => {
        const el=document.querySelector('[data-memory-end]');
        if(!el) return;
        const remaining=Math.max(0,state.memoryEndsAt-Date.now());
        el.textContent=(remaining/1000).toFixed(1)+' s';
        if(remaining>0) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  function buildConfigStepOne() {
    openModal('Configurer la partie',
      'Définissez les paramètres de la partie. La grille sera construite à l’étape suivante.',
      `<div class="config-panel config-scroll">
        <div class="config-section">
          <div class="config-section-title"><strong>Caractéristiques de la grille</strong><span>Étape 1 / 2</span></div>
          <div class="config-grid-size">
            <div class="config-control">
              <label for="cfgThemeCount">Nombre de thèmes</label>
              <select id="cfgThemeCount">${Array.from({length:5},(_,i)=>{const n=i+2;return `<option value="${n}" ${n===5?'selected':''}>${n} thèmes</option>`}).join('')}</select>
            </div>
            <div class="config-control">
              <label for="cfgQuestions">Questions par thème</label>
              <select id="cfgQuestions">${Array.from({length:10},(_,i)=>{const n=i+1;return `<option value="${n}" ${n===6?'selected':''}>${n} question${n>1?'s':''}</option>`}).join('')}</select>
            </div>
          </div>
          <div class="config-summary"><span>Cases à placer</span><b id="gridSummary">30 cases</b></div>
        </div>

        <div class="config-section">
          <div class="config-section-title"><strong>Configuration des thèmes</strong><span>Nom · couleur · joueur</span></div>
          <div class="theme-list" id="themeList"></div>
          <div class="config-note">Le joueur indiqué est celui qui a choisi le thème. Il peut être renseigné même s’il n’est pas encore connecté.</div>
        </div>

        <div class="config-section">
          <div class="config-section-title"><strong>Configuration des équipes</strong><span>2 équipes</span></div>
          <div class="team-grid">
            <div class="config-control"><label for="teamA">Équipe 1 — nom</label><input id="teamA" maxlength="30" value="Équipe A"></div>
            <div class="config-control color-control"><label for="teamAColor">Couleur équipe 1</label><input id="teamAColor" class="team-color-input" type="color" value="#2f80ff"></div>
            <div class="config-control"><label for="teamB">Équipe 2 — nom</label><input id="teamB" maxlength="30" value="Équipe B"></div>
            <div class="config-control color-control"><label for="teamBColor">Couleur équipe 2</label><input id="teamBColor" class="team-color-input" type="color" value="#ef3f4f"></div>
          </div>
        </div>

        <div class="config-section">
          <div class="config-section-title"><strong>Mémorisation</strong><span>Durée</span></div>
          <div class="config-control">
            <label for="memorySeconds">Durée de mémorisation</label>
            <select id="memorySeconds">
              <option value="10">10 secondes</option><option value="15">15 secondes</option><option value="15" selected>15 secondes</option><option value="20">20 secondes</option><option value="30">30 secondes</option><option value="45">45 secondes</option><option value="60">60 secondes</option>
            </select>
          </div>
        </div>

        <div class="config-actions">
          <button class="modal-secondary" id="configCancel" type="button">Retour</button>
          <button class="modal-primary" id="configContinue" type="button">Continuer →</button>
        </div>
      </div>`);

    const themeColors = ['#2f80ff','#ef3f4f','#22c55e','#f59e0b','#a855f7','#ffffff'];

    const renderThemes = () => {
      const count = Number($('cfgThemeCount').value);
      $('themeList').innerHTML = Array.from({length:count},(_,i)=>`
        <div class="theme-item">
          <input class="theme-color" type="color" data-index="${i}" value="${themeColors[i]}" aria-label="Couleur du thème ${i+1}">
          <span class="theme-swatch" style="color:${themeColors[i]};background:${themeColors[i]}"></span>
          <div class="theme-fields">
            <input class="form-input theme-name" data-index="${i}" maxlength="40" value="Thème ${i+1}" aria-label="Nom du thème ${i+1}" placeholder="Nom du thème">
            <input class="form-input theme-owner" data-index="${i}" maxlength="40" value="" aria-label="Joueur ayant choisi le thème ${i+1}" placeholder="Joueur qui l’a choisi">
          </div>
        </div>`).join('');

      document.querySelectorAll('.theme-color').forEach(input => {
        input.oninput = () => {
          const swatch = input.parentElement.querySelector('.theme-swatch');
          if (swatch) {
            swatch.style.background = input.value;
            swatch.style.color = input.value;
          }
        };
      });
    };

    const updateSummary = () => {
      const total = Number($('cfgThemeCount').value) * Number($('cfgQuestions').value);
      $('gridSummary').textContent = `${total} case${total > 1 ? 's' : ''}`;
    };

    renderThemes();
    updateSummary();
    $('cfgThemeCount').onchange = () => { renderThemes(); updateSummary(); };
    $('cfgQuestions').onchange = updateSummary;
    $('configCancel').onclick = closeModal;

    $('configContinue').onclick = () => {
      const themeCount = Number($('cfgThemeCount').value);
      const questionsPerTheme = Number($('cfgQuestions').value);
      const themes = [...document.querySelectorAll('.theme-name')].map((input,i) => ({
        id:String(i),
        name:input.value.trim() || `Thème ${i+1}`,
        color:document.querySelector(`.theme-color[data-index="${i}"]`)?.value || themeColors[i],
        chosenBy:document.querySelector(`.theme-owner[data-index="${i}"]`)?.value.trim() || ''
      }));
      const teamNames = [$('teamA').value.trim() || 'Équipe A', $('teamB').value.trim() || 'Équipe B'];
      const teamColors = [$('teamAColor').value, $('teamBColor').value];

      if (teamColors[0].toLowerCase() === teamColors[1].toLowerCase()) {
        return sendError(socket, 'Les deux équipes doivent avoir des couleurs différentes.');
      }

      buildGridStepTwo({
        themeCount, questionsPerTheme, themes, teamNames, teamColors,
        memorySeconds:Number($('memorySeconds').value)
      });
    };
  }

  function buildGridStepTwo(config, existingAssignments = null) {
    const total = config.themeCount * config.questionsPerTheme;
    const cols = Math.max(2, Math.ceil(Math.sqrt(total)));
    const rows = Math.ceil(total / cols);
    const assignments = existingAssignments ? [...existingAssignments] : Array(total).fill(null);
    const counts = Object.fromEntries(config.themes.map(t => [t.id, 0]));

    assignments.forEach(themeId => {
      if (themeId !== null && counts[themeId] !== undefined) counts[themeId]++;
    });

    const renderBuilder = () => {
      const filled = assignments.filter(v => v !== null).length;
      const allFull = filled === total && config.themes.every(t => counts[t.id] === config.questionsPerTheme);

      const grid = Array.from({length:total},(_,i)=>{
        const theme = assignments[i] !== null ? config.themes.find(t=>t.id===assignments[i]) : null;
        return `<button class="builder-cell ${theme?'filled':''}" data-cell="${i}" type="button" ${theme?'style="--cell-color:'+theme.color+'"':''}>
          <span class="builder-cell-number">${i+1}</span>
          ${theme?`<span class="builder-cell-theme">${escapeHtml(theme.name)}</span>`:`<span class="builder-cell-empty">+</span>`}
        </button>`;
      }).join('');

      const summary = config.themes.map(t=>`
        <div class="theme-summary-row ${counts[t.id]===config.questionsPerTheme?'complete':''}">
          <span class="summary-theme-dot" style="background:${t.color};box-shadow:0 0 8px ${t.color}"></span>
          <span class="summary-theme-name">${escapeHtml(t.name)}</span>
          <strong>${counts[t.id]} / ${config.questionsPerTheme}</strong>
        </div>`).join('');

      openModal('Construire la grille',
        'Attribuez un thème à chaque case. Chaque thème doit atteindre exactement son quota.',
        `<div class="grid-builder">
          <div class="builder-summary">
            <div class="config-section-title"><strong>Questions des thèmes</strong><span>${filled} / ${total}</span></div>
            <div class="theme-summary-list">${summary}</div>
            <div class="config-note">Cliquez sur une case pour lui attribuer un thème. Une case déjà remplie peut être modifiée ou vidée.</div>
          </div>
          <div class="builder-grid-wrap">
            <div class="builder-grid" style="--cols:${cols}">${grid}</div>
            <div class="builder-legend"><span>Case vide</span><span>•</span><span>${cols} × ${rows}</span></div>
          </div>
          <div class="config-actions">
            <button class="modal-secondary" id="gridBack" type="button">← Modifier la configuration</button>
            <button class="modal-primary" id="createConfiguredGame" type="button" ${allFull?'':'disabled'}>${allFull?'Créer la partie':'Compléter la grille'}</button>
          </div>
        </div>`);

      document.querySelectorAll('.builder-cell').forEach(cell => {
        cell.onclick = () => {
          const index = Number(cell.dataset.cell);
          const current = assignments[index];
          const available = config.themes.filter(t => counts[t.id] < config.questionsPerTheme || t.id === current);
          const options = available.map(t=>`<button type="button" class="theme-choice" data-theme="${t.id}" style="--choice-color:${t.color}">
            <span class="theme-choice-dot"></span><span>${escapeHtml(t.name)}</span><b>${counts[t.id]} / ${config.questionsPerTheme}</b>
          </button>`).join('');
          const clear = current !== null ? `<button type="button" class="theme-choice clear-choice" data-theme="__clear"><span class="theme-choice-dot"></span><span>Vider la case</span></button>` : '';

          openModal(`Case ${index+1}`,
            current===null ? 'Choisissez le thème à attribuer à cette case.' : 'Modifiez le thème ou videz la case.',
            `<div class="theme-choice-list">${options}${clear}</div>
             <div class="form-actions"><button class="modal-secondary" id="choiceCancel" type="button">Annuler</button></div>`);

          document.querySelectorAll('.theme-choice').forEach(choice => {
            choice.onclick = () => {
              const selected = choice.dataset.theme;

              // Update the persistent assignment array before returning to the builder.
              if (current !== null) counts[current]--;
              assignments[index] = selected === '__clear' ? null : selected;
              if (assignments[index] !== null) counts[assignments[index]]++;

              renderBuilder();
            };
          });

          $('choiceCancel').onclick = renderBuilder;
        };
      });

      $('gridBack').onclick = () => buildConfigStepOne();

      const createButton = $('createConfiguredGame');
      if (createButton) {
        createButton.onclick = () => {
          if (!allFull) return;

          const grid = assignments.map((themeId,i)=>({
            id:i+1,
            themeId,
            questionIndex:null,
            state:'available',
            revealedAt:null,
            timerEndsAt:null
          }));

          socket.emit('createGame', {
            clientId:session?.clientId,
            name:'Animateur',
            config:{
              themeCount:config.themeCount,
              questionsPerTheme:config.questionsPerTheme,
              memorySeconds:config.memorySeconds,
              themes:config.themes,
              grid
            },
            teamNames:config.teamNames,
            teamColors:config.teamColors
          });

          createButton.disabled=true;
          createButton.textContent='Création…';
        };
      }
    };

    renderBuilder();
  }

  $('createBtn').onclick = buildConfigStepOne;
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
        <div class="form-actions"><button class="modal-secondary" id="joinCancel" type="button">Retour</button><button class="modal-primary" id="joinSubmit" type="button">Rejoindre</button></div>
      </div>`);
    $('joinCancel').onclick = closeModal;
    $('joinSubmit').onclick = () => {
      const code=$('joinCode').value.trim().toUpperCase(); if(!code){$('joinCode').focus();return;}
      const name=$('joinName').value.trim()||'Joueur', role=document.querySelector('input[name="joinRole"]:checked').value;
      socket.emit('joinGame',{code,role,name,clientId:session?.clientId});
      $('joinSubmit').disabled=true; $('joinSubmit').textContent='Connexion…';
    };
  };

  socket.on('joined',(data)=>{
    saveSession({gameCode:data.code,role:data.role,teamId:data.state?.users?.find(u=>u.id===session?.clientId)?.teamId ?? session?.teamId ?? null});
    closeModal();
    if (data.state.phase === 'LOBBY') showLobby(data.state);
    else showGame(data.state);
  });

  socket.on('state',(state)=>{
    currentState = state;
    // The server broadcasts the new phase to every connected client in the game.
    // Do not keep a player on the lobby just because the local gameCode/session
    // has not been updated yet.
    if (session?.gameCode && session.gameCode !== state.code) return;
    if (state.phase === 'LOBBY') showLobby(state);
    else if (['PRE_MEMORY','MEMORY','WAITING','CONFIRM','REVEAL','FINISHED'].includes(state.phase)) showGame(state);
  });
})();
