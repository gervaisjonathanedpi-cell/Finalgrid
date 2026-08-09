(() => {
  const socket = io();
  const KEY = 'finalGridSession';
  let session = JSON.parse(localStorage.getItem(KEY) || 'null');
  socket.on('connect', () => { if (session?.clientId) socket.emit('resumeSession', {clientId: session.clientId}); });
  socket.on('sessionReady', data => { session = {...session, ...data}; localStorage.setItem(KEY, JSON.stringify(session)); });
  socket.on('appError', msg => console.warn('[Final Grid]', msg));
  socket.on('state', state => console.debug('[Final Grid state]', state));
  document.getElementById('demoCreate').addEventListener('click', () => {
    socket.emit('createGame', { name:'Animateur', config:{cols:5,rows:4,memorySeconds:20,themes:[
      {name:'Thème 1',color:'#2f80ff'},{name:'Thème 2',color:'#ef3f4f'},{name:'Thème 3',color:'#22c55e'},{name:'Thème 4',color:'#f59e0b'}
    ]}, teamNames:['Équipe A','Équipe B'], clientId:session?.clientId });
  });
})();
