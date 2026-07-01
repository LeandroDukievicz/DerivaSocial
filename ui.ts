// UI do dashboard — tema dark/neon inspirado no LD Studio.
export const PAGE = /* html */ `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Blog Syndicator</title>
<style>
:root{
  --bg-page:#010212; --bg-deep:#040d1e; --bg-card:#081A3A;
  --cyan:#00ffff; --cyan-bright:#6CF2FF; --magenta:#ff00cc; --pink:#FF4AC4;
  --purple:#cc00ff; --lilac:#b88cff; --teal:#006d77;
  --txt:#e6f6ff; --muted:#7f93b0; --faint:#4f5b66;
  --line:rgba(108,242,255,.14); --line2:rgba(108,242,255,.28);
  --ok:#34d399; --warn:#f59e0b;
  --grad:linear-gradient(135deg,var(--cyan),var(--magenta));
  --mono:ui-monospace,"Roboto Mono","Cascadia Code",Consolas,monospace;
  --sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
}
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{
  background:
    radial-gradient(720px 420px at 12% -6%, rgba(0,255,255,.10), transparent 42%),
    radial-gradient(680px 460px at 108% 12%, rgba(255,0,204,.10), transparent 46%),
    radial-gradient(600px 500px at 50% 120%, rgba(204,0,255,.07), transparent 55%),
    var(--bg-page);
  color:var(--txt); font-family:var(--sans); font-size:15px; line-height:1.55;
  -webkit-font-smoothing:antialiased;
}
a{color:var(--cyan-bright);text-decoration:none}
.wrap{max-width:1080px;margin:0 auto;padding:26px 22px 70px}

/* Header */
.top{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:22px}
.logo{width:40px;height:40px;border-radius:11px;background:var(--grad);display:grid;place-items:center;
  font-weight:900;color:#02121f;font-family:var(--mono);box-shadow:0 0 20px rgba(0,255,255,.35),0 0 30px rgba(255,0,204,.25)}
.brand h1{margin:0;font-size:1.28rem;letter-spacing:.3px;
  background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.brand p{margin:1px 0 0;font-size:.78rem;color:var(--muted);font-family:var(--mono)}
.spacer{flex:1}
.btn{cursor:pointer;font-family:var(--sans);font-weight:600;font-size:.84rem;color:var(--txt);
  background:rgba(8,26,58,.7);border:1px solid var(--line2);padding:9px 15px;border-radius:10px;transition:.18s}
.btn:hover{border-color:var(--cyan);box-shadow:0 0 16px rgba(0,255,255,.25);color:#fff}
.btn:disabled{opacity:.45;cursor:not-allowed}

/* Stats */
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px}
.stat{position:relative;background:linear-gradient(180deg,rgba(8,26,58,.85),rgba(4,13,30,.85));
  border:1px solid var(--line);border-radius:15px;padding:16px 18px;overflow:hidden}
.stat::before{content:"";position:absolute;inset:0;background:radial-gradient(300px 80px at 100% 0,rgba(0,255,255,.10),transparent 60%);pointer-events:none}
.stat .n{font-family:var(--mono);font-size:2rem;font-weight:800;line-height:1;
  background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.stat.novos .n{background:linear-gradient(135deg,var(--warn),var(--pink));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.stat.pub .n{background:linear-gradient(135deg,var(--ok),var(--cyan));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.stat .l{margin-top:4px;font-size:.72rem;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);font-family:var(--mono)}

/* Section title */
.sec{display:flex;align-items:center;gap:10px;margin:6px 2px 12px}
.sec h2{margin:0;font-size:.82rem;text-transform:uppercase;letter-spacing:.16em;color:var(--muted);font-family:var(--mono)}
.sec .rule{flex:1;height:1px;background:linear-gradient(90deg,var(--line2),transparent)}

/* Post card */
.list{display:grid;gap:12px}
.card{position:relative;display:flex;gap:14px;background:var(--bg-card);border:1px solid var(--line);
  border-radius:14px;padding:12px;overflow:hidden;transition:.18s}
.card:hover{border-color:var(--line2);box-shadow:0 0 0 1px rgba(0,255,255,.06),0 10px 34px rgba(0,0,0,.5),inset 0 0 26px rgba(0,255,255,.05)}
.card::after{content:"";position:absolute;top:0;left:-60%;width:45%;height:100%;
  background:linear-gradient(110deg,transparent,rgba(255,255,255,.10) 45%,transparent 60%);
  transform:skewX(-18deg);transition:.55s;opacity:0}
.card:hover::after{left:130%;opacity:1}
.thumb{width:120px;height:78px;flex:0 0 auto;border-radius:10px;object-fit:cover;background:var(--bg-deep);
  border:1px solid var(--line)}
.thumb.ph{display:grid;place-items:center;color:var(--faint);font-family:var(--mono);font-size:.7rem}
.info{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.info .t{font-weight:700;font-size:.98rem;color:#eaffff;line-height:1.3}
.info .meta{font-size:.74rem;color:var(--muted);font-family:var(--mono);display:flex;gap:10px;flex-wrap:wrap}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:2px}
.chip{font-family:var(--mono);font-size:.66rem;font-weight:700;padding:3px 9px;border-radius:999px;
  border:1px solid var(--line2);color:var(--muted);display:inline-flex;align-items:center;gap:5px}
.chip .dot{width:6px;height:6px;border-radius:50%;background:var(--faint)}
.chip.pend .dot{background:var(--warn)}
.chip.ok{color:var(--ok);border-color:rgba(52,211,153,.4)} .chip.ok .dot{background:var(--ok)}
.status{align-self:flex-start;font-family:var(--mono);font-size:.68rem;font-weight:800;letter-spacing:.05em;
  padding:4px 10px;border-radius:999px;text-transform:uppercase}
.status.novo{color:#02121f;background:linear-gradient(135deg,var(--warn),var(--pink))}
.status.publicado{color:#02121f;background:linear-gradient(135deg,var(--ok),var(--cyan))}
.side{display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;gap:8px}
.empty{text-align:center;color:var(--muted);padding:50px 0;font-family:var(--mono);font-size:.85rem}
.foot{margin-top:26px;text-align:center;color:var(--faint);font-size:.72rem;font-family:var(--mono)}
</style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <div class="logo">BS</div>
    <div class="brand">
      <h1>Blog Syndicator</h1>
      <p id="rssline">devsaderiva.com.br</p>
    </div>
    <div class="spacer"></div>
    <button class="btn" id="refresh">↻ Atualizar agora</button>
  </div>

  <div class="stats">
    <div class="stat"><div class="n" id="s-total">–</div><div class="l">Posts</div></div>
    <div class="stat novos"><div class="n" id="s-novos">–</div><div class="l">A publicar</div></div>
    <div class="stat pub"><div class="n" id="s-pub">–</div><div class="l">Publicados</div></div>
  </div>

  <div class="sec"><h2>Posts do blog</h2><div class="rule"></div></div>
  <div class="list" id="list"><div class="empty">carregando…</div></div>

  <div class="foot">M0 · lista + sincronização horária · publicação nas redes chega no M1</div>
</div>

<script>
const REDES = ["threads","instagram","linkedin"];
const fmtDate = (s) => { if(!s) return ""; const d=new Date(s); return isNaN(d)?"":d.toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric"}); };
const esc = (s) => (s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

function card(p){
  const thumb = p.image
    ? '<img class="thumb" src="'+esc(p.image)+'" alt="" loading="lazy">'
    : '<div class="thumb ph">sem imagem</div>';
  const chips = REDES.map(r=>{
    const st = p.networks && p.networks[r];
    const ok = st && st.status==="published";
    return '<span class="chip '+(ok?"ok":"pend")+'"><span class="dot"></span>'+r+'</span>';
  }).join("");
  return '<div class="card">'+thumb+
    '<div class="info">'+
      '<div class="t">'+esc(p.title)+'</div>'+
      '<div class="meta"><span>'+fmtDate(p.publishedAt||p.discoveredAt)+'</span>'+(p.category?'<span>#'+esc(p.category)+'</span>':'')+'</div>'+
      '<div class="chips">'+chips+'</div>'+
    '</div>'+
    '<div class="side">'+
      '<span class="status '+p.status+'">'+p.status+'</span>'+
      '<button class="btn" disabled title="chega no M1">Publicar</button>'+
    '</div>'+
  '</div>';
}

async function render(){
  const [posts, stats] = await Promise.all([
    fetch("/api/posts").then(r=>r.json()),
    fetch("/api/stats").then(r=>r.json()),
  ]);
  document.getElementById("s-total").textContent = stats.total;
  document.getElementById("s-novos").textContent = stats.novos;
  document.getElementById("s-pub").textContent = stats.publicados;
  const list = document.getElementById("list");
  list.innerHTML = posts.length ? posts.map(card).join("") : '<div class="empty">nenhum post ainda</div>';
}

document.getElementById("refresh").addEventListener("click", async (e)=>{
  const b=e.target; b.disabled=true; b.textContent="↻ atualizando…";
  try{ await fetch("/api/refresh",{method:"POST"}); await render(); }
  finally{ b.disabled=false; b.textContent="↻ Atualizar agora"; }
});

render();
</script>
</body>
</html>`;
