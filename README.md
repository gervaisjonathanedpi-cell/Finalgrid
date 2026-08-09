# Final Grid — v1 architecture

Base technique alignée sur le premier site : Node.js + Express + Socket.IO + HTML/CSS/JS vanilla.

## Lancer

```bash
npm install
npm start
```

Puis ouvrir http://localhost:3000.

## Déjà posé dans cette base

- sessions `clientId` persistées côté navigateur ;
- reprise de session après refresh ;
- état de partie côté serveur ;
- timers mémorisation / révélation côté serveur ;
- suppression après 30 s sans connexion ;
- rôles animateur / joueur / spectateur ;
- grille et thèmes ;
- confirmation de sélection ;
- validation serveur des cases indisponibles ;
- score ;
- désignation du vainqueur ;
- fermeture manuelle après désignation du vainqueur.

Cette version est le **socle technique**, pas encore la version finale des écrans et du design validés.
