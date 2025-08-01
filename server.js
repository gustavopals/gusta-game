import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });


const players = new Map();
let nextId = 1;
const bullets = [];
const COLORS = ['white', 'red', 'green', 'blue', 'orange', 'purple', 'cyan', 'magenta'];

wss.on('connection', ws => {
  let playerId = nextId++;
  let nickname = '';

  // Inicializa contagem de acertos
  let hitCount = 0;

  ws.on('message', msg => {
    const data = JSON.parse(msg);
    if (data.type === 'join') {
      nickname = data.nickname;
      players.set(playerId, { id: playerId, nickname, x: 100, y: 100, angle: 0, color: 'white', deaths: 0 });
    } else if (data.type === 'move') {
      let p = players.get(playerId);
      if (p) {
        p.x += data.dx;
        p.y += data.dy;
        p.angle = data.angle;
      }
    } else if (data.type === 'shoot') {
      let p = players.get(playerId);
      if (p) {
        // Cria um tiro na posição do jogador
        bullets.push({
          owner: playerId,
          x: p.x + Math.cos(p.angle) * 15,
          y: p.y + Math.sin(p.angle) * 15,
          angle: p.angle,
          color: p.color || 'white',
        });
      }
    }
  });

  ws.on('close', () => players.delete(playerId));

  const sendState = () => {
    const state = Array.from(players.values());
    ws.send(JSON.stringify({ type: 'state', players: state, bullets }));
  };

  const interval = setInterval(sendState, 50);
  ws.on('close', () => clearInterval(interval));
});


// Atualiza tiros e verifica colisões
setInterval(() => {
  // Move os tiros
  for (let bullet of bullets) {
    bullet.x += Math.cos(bullet.angle) * 10;
    bullet.y += Math.sin(bullet.angle) * 10;
  }
  // Remove tiros fora da tela
  for (let i = bullets.length - 1; i >= 0; i--) {
    if (
      bullets[i].x < 0 || bullets[i].x > 800 ||
      bullets[i].y < 0 || bullets[i].y > 600
    ) {
      bullets.splice(i, 1);
    }
  }
  // Colisão tiro-jogador
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    for (let [id, p] of players) {
      if (id !== bullet.owner) {
        const dx = bullet.x - p.x;
        const dy = bullet.y - p.y;
        if (dx * dx + dy * dy < 20 * 20) { // raio de colisão
          // Conta acerto
          p.hits = (p.hits || 0) + 1;
          bullets.splice(i, 1);
          // Se atingido 3 vezes, renasce
          if (p.hits >= 3) {
            p.hits = 0;
            p.deaths = (p.deaths || 0) + 1;
            // Muda cor
            const colorIdx = p.deaths % COLORS.length;
            p.color = COLORS[colorIdx];
            // Respawn
            p.x = Math.random() * 700 + 50;
            p.y = Math.random() * 500 + 50;
          }
          break;
        }
      }
    }
  }
}, 50);

app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
