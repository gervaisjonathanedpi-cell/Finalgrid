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
    openModal('Créer une partie','La configuration complète sera construite juste après l’accueil. Cette étape valide déjà le parcours de création et la connexion temps réel.',`
      <div class="form-stack">
        <div><div class="form-label">Nom de l’animateur</div><input class="form-input" id="createName" maxlength="32" value="Animateur" placeholder="Votre nom"></div>
        <div class="form-actions"><button class="modal-secondary" id="createCancel" type="button">Retour</button><button class="modal-primary" id="createSubmit" type="button">Créer la partie</button></div>
      </div>`);
    $('createCancel').onclick = closeModal;
    $('createSubmit').onclick = () => {
      const name = $('createName').value.trim() || 'Animateur';
      socket.emit('createGame',{clientId:session?.clientId,name,config:{cols:5,rows:4,memorySeconds:20,themes:[
        {id:'0',name:'Thème 1',color:'#2f80ff'},{id:'1',name:'Thème 2',color:'#ef3f4f'},{id:'2',name:'Thème 3',color:'#22c55e'},{id:'3',name:'Thème 4',color:'#f59e0b'}]},teamNames:['Équipe A','Équipe B']});
      $('createSubmit').disabled = true; $('createSubmit').textContent = 'Création…';
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
