const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const API_KEY = process.env.API_KEY || 'user123';
const DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(path.join(DIR, 'img'), { recursive: true });

const DB = path.join(DIR, 'events.json');
let events = fs.existsSync(DB) ? JSON.parse(fs.readFileSync(DB, 'utf8')) : [];
const save = () => fs.writeFileSync(DB, JSON.stringify(events));

// Reception depuis l'ESP32-CAM : IN / OUT + photo
app.post('/api/event', express.raw({ type: 'image/jpeg', limit: '5mb' }), (req, res) => {
  if (req.headers['x-api-key'] !== API_KEY) return res.status(401).send('bad key');

  const type = String(req.query.type || '').toUpperCase();
  if (type !== 'IN' && type !== 'OUT') return res.status(400).send('type invalide');
  if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).send('pas d\'image');

  const now = new Date();
  const date = req.query.date || now.toLocaleDateString('fr-FR', { timeZone: 'Africa/Tunis' });
  const time = req.query.time || now.toLocaleTimeString('fr-FR', { timeZone: 'Africa/Tunis' });

  const file = Date.now() + '.jpg';
  fs.writeFileSync(path.join(DIR, 'img', file), req.body);

  events.push({ type, time, date, img: '/img/' + file });
  save();
  res.json({ ok: true });
});

app.use('/img', express.static(path.join(DIR, 'img')));
app.get('/api/events', (req, res) => res.json(events));

// Page web : tableau IN/OUT | Heure | Date | Image
app.get('/', (req, res) => res.send(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pointage</title>
<style>
 body{font-family:Arial,sans-serif;margin:20px;background:#f4f4f4}
 table{border-collapse:collapse;width:100%;background:#fff}
 th,td{border:1px solid #ddd;padding:8px;text-align:center}
 th{background:#222;color:#fff}
 .IN{color:#0a8a0a;font-weight:bold}
 .OUT{color:#c0392b;font-weight:bold}
 img{height:90px;border-radius:6px;cursor:pointer}
</style></head><body>
<h2>Tableau de pointage</h2>
<table>
 <thead><tr><th>IN / OUT</th><th>Heure</th><th>Date</th><th>Image</th></tr></thead>
 <tbody id="tb"></tbody>
</table>
<script>
async function load(){
  const r = await fetch('/api/events');
  const ev = await r.json();
  document.getElementById('tb').innerHTML = ev.slice().reverse().map(e =>
    '<tr><td class="'+e.type+'">'+e.type+'</td><td>'+e.time+'</td><td>'+e.date+
    '</td><td><a href="'+e.img+'" target="_blank"><img src="'+e.img+'"></a></td></tr>'
  ).join('');
}
load();
setInterval(load, 5000);
</script></body></html>`));

app.listen(process.env.PORT || 3000, () => console.log('Serveur pret'));
