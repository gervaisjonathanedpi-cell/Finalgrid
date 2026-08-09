(() => {
  const socket = io();
  const KEY = 'finalGridSession';
  let session = JSON.parse(localStorage.getItem(KEY) || 'null');
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

  $('createBtn').onclick = () => {
    openModal('Configurer la partie',
      'Prépare la grille avant d’ouvrir le lobby. Les thèmes restent libres : l’animateur saisit simplement ce qu’il souhaite utiliser.',
      `<div class="config-panel">
        <div class="config-section">
          <div class="config-section-title"><strong>Dimensions de la grille</strong><span id="gridSizeLabel">20 cases</span></div>
          <div class="config-grid-size">
            <div class="config-control"><label for="cfgCols">Colonnes</label><select id="cfgCols">${Array.from({length:10},(_,i)=>{const n=i+3;return `<option value="${n}" ${n===5?'selected':''}>${n}</option>`}).join('')}</select></div>
            <div class="config-control"><label for="cfgRows">Lignes</label><select id="cfgRows">${Array.from({length:9},(_,i)=>{const n=i+2;return `<option value="${n}" ${n===4?'selected':''}>${n}</option>`}).join('')}</select></div>
          </div>
          <div class="config-summary"><span>Grille finale</span><b id="gridSummary">5 × 4 — 20 cases</b></div>
        </div>
        <div class="config-section">
          <div class="config-section-title"><strong>Thèmes</strong><span>2 à 6 thèmes</span></div>
          <div class="config-control"><label for="cfgThemeCount">Nombre de thèmes</label>
            <select id="cfgThemeCount">${Array.from({length:5},(_,i)=>{const n=i+2;return `<option value="${n}" ${n===4?'selected':''}>${n}</option>`}).join('')}</select>
          </div>
          <div class="theme-list" id="themeList" style="margin-top:9px"></div>
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
        <div class="theme-item"><span class="theme-swatch" style="color:${themeColors[i]};background:${themeColors[i]}"></span>
        <input class="form-input theme-name" data-index="${i}" maxlength="40" value="Thème ${i+1}" aria-label="Nom du thème ${i+1}"></div>`).join('');
    };
    const updateGridSummary = () => {
      const cols=Number($('cfgCols').value), rows=Number($('cfgRows').value);
      $('gridSizeLabel').textContent=`${cols*rows} cases`;
      $('gridSummary').textContent=`${cols} × ${rows} — ${cols*rows} cases`;
    };
    renderThemes(); updateGridSummary();
    $('cfgThemeCount').onchange=renderThemes; $('cfgCols').onchange=updateGridSummary; $('cfgRows').onchange=updateGridSummary;
    $('configCancel').onclick=closeModal;
    $('configCreate').onclick=()=>{
      const cols=Number($('cfgCols').value), rows=Number($('cfgRows').value), memorySeconds=Number($('memorySeconds').value);
      const themes=[...document.querySelectorAll('.theme-name')].map((input,i)=>({id:String(i),name:input.value.trim()||`Thème ${i+1}`,color:themeColors[i]}));
      const teamNames=[$('teamA').value.trim()||'Équipe A',$('teamB').value.trim()||'Équipe B'];
      $('configCreate').disabled=true; $('configCreate').textContent='Création…';
      socket.emit('createGame',{clientId:session?.clientId,name:'Animateur',config:{cols,rows,memorySeconds,themes},teamNames});
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
    saveSession({gameCode:data.code,role:data.role,teamId:session?.teamId??null});
    closeModal();
    openModal('Connexion réussie',`Partie ${data.code}. Le lobby complet sera construit dans l’étape suivante.`,`
      <div style="padding:18px;border:1px solid #263853;border-radius:12px;background:#060c17;text-align:center">
        <div style="color:#7f8ea6;font-size:10px;font-weight:900;letter-spacing:.16em">CODE DE PARTIE</div>
        <div style="font-size:34px;font-weight:950;letter-spacing:.16em;margin-top:7px">${data.code}</div>
      </div>
      <div class="form-actions" style="margin-top:14px"><button class="modal-primary" id="closeConnected" type="button">Continuer</button></div>`);
    $('closeConnected').onclick=closeModal;
  });
})();
