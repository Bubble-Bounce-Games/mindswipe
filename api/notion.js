import { useState, useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";

const TYPES = {
  book:    { label: "Book",    color: "#6366f1", emoji: "📚" },
  article: { label: "Article", color: "#0ea5e9", emoji: "📄" },
  quote:   { label: "Quote",   color: "#f59e0b", emoji: "💬" },
  idea:    { label: "Idea",    color: "#10b981", emoji: "💡" },
  note:    { label: "Note",    color: "#ec4899", emoji: "📝" },
};

const uid = () => Math.random().toString(36).substr(2, 9);

const SAMPLES = [
  { id: uid(), title: "Atomic Habits", content: "You do not rise to the level of your goals. You fall to the level of your systems.", type: "quote", tags: ["habits", "productivity"], status: "unseen", connections: [], createdAt: Date.now() - 5e5 },
  { id: uid(), title: "Thinking, Fast and Slow", content: "System 1 operates automatically and quickly, with little effort and no sense of voluntary control. System 2 allocates attention to effortful mental activities.", type: "book", tags: ["psychology", "cognition"], status: "unseen", connections: [], createdAt: Date.now() - 4e5 },
  { id: uid(), title: "Deep Work", content: "The ability to perform deep work is becoming increasingly rare at exactly the same time it is becoming increasingly valuable in our economy.", type: "book", tags: ["productivity", "focus"], status: "unseen", connections: [], createdAt: Date.now() - 3e5 },
  { id: uid(), title: "The Power of Now", content: "Realize deeply that the present moment is all you ever have. Make the NOW the primary focus of your life.", type: "book", tags: ["mindfulness", "philosophy"], status: "unseen", connections: [], createdAt: Date.now() - 2e5 },
  { id: uid(), title: "Man's Search for Meaning", content: "Between stimulus and response there is a space. In that space is our power to choose our response.", type: "quote", tags: ["philosophy", "psychology"], status: "unseen", connections: [], createdAt: Date.now() - 1e5 },
];

export default function App() {
  const [screen, setScreen] = useState("swipe");
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dark, setDark] = useState(false);

  // Detect dark mode
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const handler = e => setDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("mindswipe-cards");
        setCards(r ? JSON.parse(r.value) : SAMPLES);
      } catch { setCards(SAMPLES); }
      setLoading(false);
    })();
  }, []);

  const saveCards = useCallback(async next => {
    setCards(next);
    try { await window.storage.set("mindswipe-cards", JSON.stringify(next)); } catch {}
  }, []);

  const addCard = useCallback(card => {
    saveCards([{ ...card, id: uid(), createdAt: Date.now(), status: "unseen", connections: [] }, ...cards]);
  }, [cards, saveCards]);

  const updateCard = useCallback((id, upd) => {
    saveCards(cards.map(c => c.id === id ? { ...c, ...upd } : c));
  }, [cards, saveCards]);

  const connectCards = useCallback((id1, id2) => {
    saveCards(cards.map(c => {
      if (c.id === id1 && !c.connections.includes(id2)) return { ...c, connections: [...c.connections, id2] };
      if (c.id === id2 && !c.connections.includes(id1)) return { ...c, connections: [...c.connections, id1] };
      return c;
    }));
  }, [cards, saveCards]);

  const bg = dark ? "#0f0f13" : "#f8f8fc";
  const surface = dark ? "#1a1a24" : "#ffffff";
  const text = dark ? "#f0f0f8" : "#1a1a2e";
  const muted = dark ? "#6b6b8a" : "#8888aa";
  const border = dark ? "#2a2a3a" : "#e8e8f0";

  const theme = { dark, bg, surface, text, muted, border };

  const NAV = [
    { id: "swipe", emoji: "🃏", label: "Swipe" },
    { id: "graph", emoji: "🗺️", label: "Graph" },
    { id: "add",   emoji: "➕", label: "Add" },
    { id: "notion",emoji: "🔗", label: "Notion" },
  ];

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:bg, color:text, fontFamily:"system-ui" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:48 }}>🧠</div>
        <div style={{ marginTop:12, color:muted }}>Loading your knowledge...</div>
      </div>
    </div>
  );

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", background:bg, color:text, fontFamily:"system-ui, -apple-system, sans-serif", overflow:"hidden" }}>
      <div style={{ flex:1, overflow:"hidden" }}>
        {screen === "swipe"  && <SwipeScreen  cards={cards} updateCard={updateCard} theme={theme} />}
        {screen === "graph"  && <GraphScreen  cards={cards} connectCards={connectCards} theme={theme} />}
        {screen === "add"    && <AddScreen    addCard={addCard} onDone={() => setScreen("swipe")} theme={theme} />}
        {screen === "notion" && <NotionScreen addCard={addCard} cards={cards} theme={theme} />}
      </div>

      {/* Bottom Nav */}
      <nav style={{ display:"flex", borderTop:`1px solid ${border}`, background:surface }}>
        {NAV.map(tab => (
          <button key={tab.id} onClick={() => setScreen(tab.id)}
            style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", padding:"10px 0 8px", gap:3, border:"none", background:"transparent", cursor:"pointer",
              color: screen === tab.id ? "#6366f1" : muted, fontSize:11, fontWeight: screen === tab.id ? 700 : 400, transition:"color 0.2s" }}>
            <span style={{ fontSize:22 }}>{tab.emoji}</span>
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ─── SWIPE SCREEN ───────────────────────────────────────────────
function SwipeScreen({ cards, updateCard, theme }) {
  const { dark, bg, surface, text, muted, border } = theme;
  const queue = cards.filter(c => c.status !== "known");
  const [idx, setIdx] = useState(0);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const startRef = useRef(null);
  const knownCount = cards.filter(c => c.status === "known").length;
  const learningCount = cards.filter(c => c.status === "learning").length;

  const card = queue[idx];

  function act(action) {
    if (!card) return;
    if (action === "know") updateCard(card.id, { status: "known" });
    if (action === "later") updateCard(card.id, { status: "learning" });
    setIdx(i => i + 1);
    setDrag({ x: 0, y: 0, active: false });
    startRef.current = null;
  }

  function onStart(e) {
    const p = e.touches ? e.touches[0] : e;
    startRef.current = { x: p.clientX, y: p.clientY };
    setDrag(d => ({ ...d, active: true }));
  }
  function onMove(e) {
    if (!startRef.current) return;
    const p = e.touches ? e.touches[0] : e;
    setDrag({ x: p.clientX - startRef.current.x, y: p.clientY - startRef.current.y, active: true });
  }
  function onEnd() {
    if (Math.abs(drag.x) > 90) act(drag.x > 0 ? "know" : "later");
    else setDrag({ x: 0, y: 0, active: false });
  }

  const rot = drag.x / 18;
  const swipeRight = drag.x > 40;
  const swipeLeft = drag.x < -40;

  if (!card || idx >= queue.length) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:16, padding:24 }}>
      <div style={{ fontSize:64 }}>🎉</div>
      <div style={{ fontSize:22, fontWeight:800, textAlign:"center" }}>All caught up!</div>
      <div style={{ color:muted, textAlign:"center", lineHeight:1.6 }}>
        ✅ {knownCount} mastered · 🔄 {learningCount} in progress
      </div>
      <button onClick={() => setIdx(0)} style={{ padding:"14px 32px", background:"#6366f1", color:"#fff", border:"none", borderRadius:99, fontSize:16, fontWeight:700, cursor:"pointer" }}>
        Review Again
      </button>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      {/* Stats */}
      <div style={{ display:"flex", justifyContent:"space-around", padding:"10px 16px 0", fontSize:13, color:muted }}>
        <span>🆕 {cards.filter(c=>c.status==="unseen").length} new</span>
        <span>🔄 {learningCount} review</span>
        <span>✅ {knownCount} known</span>
      </div>

      {/* Progress bar */}
      <div style={{ margin:"8px 20px 0", height:4, background:border, borderRadius:4, overflow:"hidden" }}>
        <div style={{ height:"100%", background:"#6366f1", borderRadius:4, width:`${(knownCount/cards.length)*100}%`, transition:"width 0.5s" }} />
      </div>

      {/* Card stack */}
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:"16px 20px", position:"relative" }}>
        {/* Shadow card */}
        {queue[idx+1] && (
          <div style={{ position:"absolute", width:"100%", maxWidth:380, height:380, background:surface, borderRadius:28, boxShadow:"0 8px 32px rgba(0,0,0,0.12)", transform:"scale(0.94) translateY(14px)", zIndex:0, border:`1px solid ${border}` }} />
        )}

        {/* Main card */}
        <div
          onMouseDown={onStart} onMouseMove={drag.active ? onMove : null} onMouseUp={onEnd} onMouseLeave={onEnd}
          onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
          style={{
            position:"relative", width:"100%", maxWidth:380, height:390, background:surface,
            borderRadius:28, boxShadow:"0 16px 48px rgba(0,0,0,0.18)", zIndex:1, cursor:"grab",
            border:`1px solid ${border}`, userSelect:"none",
            transform:`translateX(${drag.x}px) translateY(${drag.y*0.2}px) rotate(${rot}deg)`,
            transition: drag.active ? "none" : "transform 0.35s cubic-bezier(.34,1.56,.64,1)",
          }}
        >
          {swipeRight && (
            <div style={{ position:"absolute", top:20, left:20, border:"4px solid #22c55e", color:"#22c55e", fontWeight:900, fontSize:18, padding:"4px 12px", borderRadius:10, transform:"rotate(-18deg)", opacity:Math.min(drag.x/90,1) }}>
              GOT IT ✓
            </div>
          )}
          {swipeLeft && (
            <div style={{ position:"absolute", top:20, right:20, border:"4px solid #f97316", color:"#f97316", fontWeight:900, fontSize:18, padding:"4px 12px", borderRadius:10, transform:"rotate(18deg)", opacity:Math.min(-drag.x/90,1) }}>
              LATER 🔄
            </div>
          )}

          <div style={{ padding:24, height:"100%", display:"flex", flexDirection:"column", boxSizing:"border-box" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <span style={{ padding:"4px 12px", borderRadius:99, fontSize:12, fontWeight:700, color:"#fff", background: TYPES[card.type]?.color }}>
                {TYPES[card.type]?.emoji} {TYPES[card.type]?.label}
              </span>
              <span style={{ fontSize:12, color:muted }}>{card.status === "learning" ? "🔄 Review" : "🆕 New"}</span>
            </div>

            <div style={{ fontWeight:800, fontSize:17, marginBottom:12, lineHeight:1.3 }}>{card.title}</div>
            <div style={{ flex:1, overflow:"hidden", color: dark ? "#c0c0d8" : "#4a4a6a", fontSize:15, lineHeight:1.6 }}>
              {card.content}
            </div>

            {card.tags?.length > 0 && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:12 }}>
                {card.tags.map(t => (
                  <span key={t} style={{ padding:"2px 10px", background: dark?"#2a2a3a":"#f0f0f8", borderRadius:99, fontSize:11, color:muted }}>#{t}</span>
                ))}
              </div>
            )}
            <div style={{ textAlign:"center", fontSize:11, color:muted, marginTop:10 }}>Drag to swipe</div>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display:"flex", justifyContent:"center", gap:24, paddingBottom:20 }}>
        <button onClick={() => act("later")}
          style={{ width:64, height:64, borderRadius:"50%", border:"none", background: dark?"#2d1f0e":"#fff3e0", fontSize:26, cursor:"pointer", boxShadow:"0 4px 16px rgba(0,0,0,0.12)" }}>
          🔄
        </button>
        <button onClick={() => act("know")}
          style={{ width:64, height:64, borderRadius:"50%", border:"none", background: dark?"#0e2d1a":"#e8fdf0", fontSize:26, cursor:"pointer", boxShadow:"0 4px 16px rgba(0,0,0,0.12)" }}>
          ✅
        </button>
      </div>
    </div>
  );
}

// ─── GRAPH SCREEN ───────────────────────────────────────────────
function GraphScreen({ cards, connectCards, theme }) {
  const { dark, bg, surface, text, muted, border } = theme;
  const svgRef = useRef(null);
  const simRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [connectFrom, setConnectFrom] = useState(null);
  const [connectMode, setConnectMode] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  useEffect(() => {
    if (!svgRef.current) return;
    const el = svgRef.current;
    const W = el.clientWidth, H = el.clientHeight;

    d3.select(el).selectAll("*").remove();

    const nodes = cards.map(c => ({ ...c, _color: TYPES[c.type]?.color || "#6366f1" }));
    const links = [];
    cards.forEach(c => c.connections?.forEach(tid => {
      if (c.id < tid) links.push({ source: c.id, target: tid });
    }));

    const svg = d3.select(el);
    const g = svg.append("g");

    svg.call(d3.zoom().scaleExtent([0.2, 4]).on("zoom", e => g.attr("transform", e.transform)));

    const linkSel = g.append("g").selectAll("line").data(links).join("line")
      .attr("stroke", "#6366f1").attr("stroke-opacity", 0.35).attr("stroke-width", 2);

    const nodeSel = g.append("g").selectAll("g").data(nodes).join("g")
      .call(d3.drag()
        .on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; })
        .on("drag",  (e, d) => { d.fx=e.x; d.fy=e.y; })
        .on("end",   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx=null; d.fy=null; })
      )
      .on("click", (e, d) => {
        e.stopPropagation();
        setConnectMode(cm => {
          setConnectFrom(cf => {
            if (cm && cf) {
              if (cf !== d.id) { connectCards(cf, d.id); showToast("✅ Connected!"); }
              return null;
            }
            if (cm) return d.id;
            setSelected(d);
            return null;
          });
          return cm;
        });
      });

    nodeSel.append("circle")
      .attr("r", d => d.status === "known" ? 30 : 20)
      .attr("fill", d => d._color)
      .attr("opacity", d => d.status === "known" ? 1 : 0.65)
      .attr("stroke", dark ? "#1a1a24" : "#fff")
      .attr("stroke-width", 3);

    nodeSel.append("text")
      .text(d => d.title.length > 10 ? d.title.slice(0,10)+"…" : d.title)
      .attr("text-anchor","middle").attr("dy","0.35em")
      .attr("fill","#fff").attr("font-size", 8).attr("font-weight","bold")
      .attr("pointer-events","none");

    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d=>d.id).distance(130))
      .force("charge", d3.forceManyBody().strength(-250))
      .force("center", d3.forceCenter(W/2, H/2))
      .force("collide", d3.forceCollide(45))
      .on("tick", () => {
        linkSel.attr("x1",d=>d.source.x).attr("y1",d=>d.source.y).attr("x2",d=>d.target.x).attr("y2",d=>d.target.y);
        nodeSel.attr("transform", d=>`translate(${d.x},${d.y})`);
      });

    simRef.current = sim;
    svg.on("click", () => { setSelected(null); setConnectFrom(null); });
    return () => sim.stop();
  }, [cards, dark]);

  const legend = Object.entries(TYPES);

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", position:"relative" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 16px" }}>
        <div style={{ fontWeight:800, fontSize:18 }}>Idea Graph</div>
        <button onClick={() => { setConnectMode(c => !c); setConnectFrom(null); setSelected(null); }}
          style={{ padding:"6px 14px", borderRadius:99, border:"none", cursor:"pointer", fontSize:13, fontWeight:700,
            background: connectMode ? "#6366f1" : (dark?"#2a2a3a":"#f0f0f8"), color: connectMode ? "#fff" : muted }}>
          {connectMode ? "✕ Cancel" : "🔗 Connect"}
        </button>
      </div>

      {/* Legend */}
      <div style={{ display:"flex", gap:10, paddingLeft:16, paddingBottom:6, flexWrap:"wrap" }}>
        {legend.map(([k,v]) => (
          <div key={k} style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:muted }}>
            <div style={{ width:10, height:10, borderRadius:"50%", background:v.color }} />
            {v.label}
          </div>
        ))}
      </div>

      {connectMode && (
        <div style={{ margin:"0 16px 8px", padding:"8px 16px", background:"#6366f1", color:"#fff", borderRadius:12, fontSize:13, textAlign:"center" }}>
          {connectFrom ? "Now tap the second node to connect" : "Tap the first node to connect"}
        </div>
      )}

      <svg ref={svgRef} style={{ flex:1, width:"100%" }} />

      {cards.length === 0 && (
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", color:muted }}>
          Add some cards first!
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position:"absolute", top:70, left:"50%", transform:"translateX(-50%)", background:"#22c55e", color:"#fff", padding:"8px 20px", borderRadius:99, fontSize:13, fontWeight:700, zIndex:10 }}>
          {toast}
        </div>
      )}

      {/* Selected node panel */}
      {selected && !connectMode && (
        <div onClick={e=>e.stopPropagation()} style={{ position:"absolute", bottom:0, left:0, right:0, background:surface, borderRadius:"24px 24px 0 0", padding:20, boxShadow:"0 -8px 32px rgba(0,0,0,0.2)", maxHeight:260, overflowY:"auto", border:`1px solid ${border}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
            <div>
              <span style={{ padding:"3px 10px", borderRadius:99, fontSize:11, fontWeight:700, color:"#fff", background:TYPES[selected.type]?.color, marginRight:8 }}>
                {TYPES[selected.type]?.emoji} {TYPES[selected.type]?.label}
              </span>
              <span style={{ fontWeight:800, fontSize:16 }}>{selected.title}</span>
            </div>
            <button onClick={() => setSelected(null)} style={{ border:"none", background:"none", fontSize:20, color:muted, cursor:"pointer" }}>✕</button>
          </div>
          <p style={{ fontSize:14, lineHeight:1.6, color: dark?"#c0c0d8":"#4a4a6a" }}>{selected.content}</p>
          {selected.tags?.length > 0 && (
            <div style={{ display:"flex", gap:6, marginTop:8, flexWrap:"wrap" }}>
              {selected.tags.map(t => <span key={t} style={{ padding:"2px 10px", background:dark?"#2a2a3a":"#f0f0f8", borderRadius:99, fontSize:11, color:muted }}>#{t}</span>)}
            </div>
          )}
          {selected.connections?.length > 0 && (
            <div style={{ marginTop:8, fontSize:12, color:muted }}>
              🔗 Connected to {selected.connections.length} idea{selected.connections.length>1?"s":""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ADD SCREEN ─────────────────────────────────────────────────
function AddScreen({ addCard, onDone, theme }) {
  const { dark, surface, text, muted, border } = theme;
  const inp = { background: dark?"#2a2a3a":"#f2f2fa", border:"none", outline:"none", borderRadius:16, padding:"14px 16px", color:text, fontSize:15, width:"100%", boxSizing:"border-box", fontFamily:"inherit" };
  const [form, setForm] = useState({ title:"", content:"", type:"book", tags:"" });
  const upd = k => e => setForm(f => ({...f,[k]:e.target.value}));

  function submit() {
    if (!form.title.trim() || !form.content.trim()) return;
    addCard({ title:form.title.trim(), content:form.content.trim(), type:form.type, tags:form.tags.split(",").map(t=>t.trim()).filter(Boolean) });
    onDone();
  }

  return (
    <div style={{ height:"100%", overflowY:"auto", padding:"16px 20px 32px" }}>
      <div style={{ fontWeight:800, fontSize:22, marginBottom:4 }}>Add to Library</div>
      <div style={{ color:muted, fontSize:14, marginBottom:20 }}>Paste a highlight or type a note</div>

      {/* Type pills */}
      <div style={{ display:"flex", gap:8, marginBottom:20, overflowX:"auto", paddingBottom:4 }}>
        {Object.entries(TYPES).map(([k,v]) => (
          <button key={k} onClick={() => setForm(f=>({...f,type:k}))}
            style={{ padding:"8px 16px", borderRadius:99, border:"none", cursor:"pointer", whiteSpace:"nowrap", fontSize:13, fontWeight:700, transition:"all 0.2s",
              background: form.type===k ? v.color : (dark?"#2a2a3a":"#f0f0f8"), color: form.type===k ? "#fff" : muted }}>
            {v.emoji} {v.label}
          </button>
        ))}
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div>
          <label style={{ display:"block", fontSize:13, fontWeight:700, marginBottom:6, color:muted }}>SOURCE / TITLE *</label>
          <input style={inp} placeholder="e.g. Atomic Habits, The Atlantic…" value={form.title} onChange={upd("title")} />
        </div>
        <div>
          <label style={{ display:"block", fontSize:13, fontWeight:700, marginBottom:6, color:muted }}>CONTENT / HIGHLIGHT *</label>
          <textarea style={{...inp, resize:"none", minHeight:140}} placeholder="Paste your highlight, quote, or key idea…" value={form.content} onChange={upd("content")} />
        </div>
        <div>
          <label style={{ display:"block", fontSize:13, fontWeight:700, marginBottom:6, color:muted }}>TAGS (comma separated)</label>
          <input style={inp} placeholder="psychology, habits, productivity…" value={form.tags} onChange={upd("tags")} />
        </div>
        <button onClick={submit} disabled={!form.title.trim()||!form.content.trim()}
          style={{ padding:"16px", borderRadius:18, border:"none", background: (!form.title.trim()||!form.content.trim()) ? (dark?"#2a2a3a":"#e0e0ee") : "#6366f1",
            color: (!form.title.trim()||!form.content.trim()) ? muted : "#fff", fontSize:16, fontWeight:800, cursor:"pointer", marginTop:4 }}>
          Add to Library ✨
        </button>
      </div>
    </div>
  );
}

// ─── PASTE IMPORT ───────────────────────────────────────────────
function PasteImport({ addCard, cards, theme }) {
  const { dark, text, muted, border } = theme;
  const inp = { background: dark?"#2a2a3a":"#f2f2fa", border:"none", outline:"none", borderRadius:16, padding:"14px 16px", color:text, fontSize:14, width:"100%", boxSizing:"border-box", fontFamily:"inherit" };
  const [raw, setRaw] = useState("");
  const [type, setType] = useState("note");
  const [status, setStatus] = useState(null);

  function parseAndImport() {
    if (!raw.trim()) return;
    // Split by double newline (paragraphs) or single newline
    const blocks = raw.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
    const lines = blocks.length > 1 ? blocks : raw.split("\n").map(l => l.trim()).filter(Boolean);
    let count = 0;
    for (const line of lines) {
      if (line.length < 5) continue;
      // Try to detect title: first sentence or text before " - " or ":"
      const dashSplit = line.split(/\s[-–]\s/);
      const colonSplit = line.split(/:\s+/);
      let title, content;
      if (dashSplit.length >= 2) { title = dashSplit[0].slice(0,80); content = dashSplit.slice(1).join(" - "); }
      else if (colonSplit.length >= 2 && colonSplit[0].length < 60) { title = colonSplit[0]; content = colonSplit.slice(1).join(": "); }
      else { title = line.slice(0, 60) + (line.length > 60 ? "…" : ""); content = line; }
      if (!cards.some(c => c.content === content)) { addCard({ title, content, type, tags:[] }); count++; }
    }
    setStatus({ type:"ok", msg:`✅ Imported ${count} item${count!==1?"s":""}!` });
    setRaw("");
    setTimeout(() => setStatus(null), 3000);
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {Object.entries(TYPES).map(([k,v]) => (
          <button key={k} onClick={() => setType(k)}
            style={{ padding:"6px 14px", borderRadius:99, border:"none", cursor:"pointer", fontSize:12, fontWeight:700,
              background: type===k ? v.color : (dark?"#2a2a3a":"#f0f0f8"), color: type===k ? "#fff" : muted }}>
            {v.emoji} {v.label}
          </button>
        ))}
      </div>
      <textarea style={{...inp, resize:"none", minHeight:120}} 
        placeholder={"Paste your Notion notes here…\n\nTip: Format as 'Title - Content' or 'Title: Content' for best results, or just paste raw text blocks."}
        value={raw} onChange={e => setRaw(e.target.value)} />
      <button onClick={parseAndImport} disabled={!raw.trim()}
        style={{ padding:"14px", borderRadius:18, border:"none", background:raw.trim()?"#6366f1":(dark?"#2a2a3a":"#e0e0ee"),
          color:raw.trim()?"#fff":muted, fontSize:15, fontWeight:800, cursor:"pointer" }}>
        Import Notes ✨
      </button>
      {status && <div style={{ padding:"10px 14px", borderRadius:12, fontSize:13, background:dark?"#0d2b1a":"#e8fdf0", color:"#16a34a" }}>{status.msg}</div>}
    </div>
  );
}

// ─── NOTION SCREEN ──────────────────────────────────────────────
function NotionScreen({ addCard, cards, theme }) {
  const { dark, surface, text, muted, border } = theme;
  const inp = { background: dark?"#2a2a3a":"#f2f2fa", border:"none", outline:"none", borderRadius:16, padding:"14px 16px", color:text, fontSize:14, width:"100%", boxSizing:"border-box", fontFamily:"monospace" };
  const [key, setKey] = useState("");
  const [dbId, setDbId] = useState("");
  const [status, setStatus] = useState(null); // {type:"ok"|"err", msg}
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("notion-cfg");
        if (r) { const d = JSON.parse(r.value); setKey(d.key||""); setDbId(d.dbId||""); }
      } catch {}
    })();
  }, []);

  async function sync() {
    if (!key.trim() || !dbId.trim()) { setStatus({type:"err",msg:"Please fill in both fields."}); return; }
    setLoading(true); setStatus(null);
    try {
      await window.storage.set("notion-cfg", JSON.stringify({ key:key.trim(), dbId:dbId.trim() }));
      const proxyRes = await fetch("https://mindswipe-pi.vercel.app/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key.trim(), databaseId: dbId.trim() }),
      });
      const data = await proxyRes.json();
      if (!proxyRes.ok) throw new Error(data.error || `Error ${proxyRes.status}`);
      let imported = 0;
      for (const page of data.results) {
        const props = page.properties;
        const titleProp = Object.values(props).find(p => p.type==="title");
        const title = titleProp?.title?.map(t=>t.plain_text).join("") || "Untitled";
        const textProp = Object.values(props).find(p => p.type==="rich_text" && p.rich_text?.length>0);
        const content = textProp?.rich_text?.map(t=>t.plain_text).join("") || "(Open Notion for full content)";
        const selectProp = Object.values(props).find(p => p.type==="select" && p.select);
        const rawType = selectProp?.select?.name?.toLowerCase();
        const type = TYPES[rawType] ? rawType : "note";
        if (!cards.some(c => c.notionId === page.id)) {
          addCard({ title, content, type, tags:[], notionId:page.id });
          imported++;
        }
      }
      setStatus({type:"ok", msg:`✅ Imported ${imported} new item${imported!==1?"s":""} from Notion!`});
    } catch(e) {
      setStatus({type:"err", msg:`⚠️ ${e.message}. If you see a CORS error, deploy this app on your own domain with a backend proxy for Notion API calls.`});
    }
    setLoading(false);
  }

  const statCounts = Object.entries(TYPES).map(([k,v]) => ({ ...v, count:cards.filter(c=>c.type===k).length }));

  return (
    <div style={{ height:"100%", overflowY:"auto", padding:"16px 20px 32px" }}>
      <div style={{ fontWeight:800, fontSize:22, marginBottom:4 }}>Notion Sync</div>
      <div style={{ color:muted, fontSize:14, marginBottom:20 }}>Pull your notes from Notion automatically</div>

      {/* Steps */}
      <div style={{ background: dark?"#1a1a30":"#f0f0ff", borderRadius:16, padding:16, marginBottom:20, fontSize:13, lineHeight:2 }}>
        <div style={{ fontWeight:700, color:"#6366f1", marginBottom:4 }}>⚙️ Setup</div>
        <div style={{ color: dark?"#a0a0c8":"#4a4a7a" }}>
          1. Go to <b>notion.so/my-integrations</b> → New integration → copy key<br/>
          2. Open your reading database → <b>Share → Invite</b> your integration<br/>
          3. Copy the database ID from the page URL<br/>
          <span style={{ fontSize:11, opacity:0.7 }}>(URL format: notion.so/workspace/<b>[database-id]</b>?v=…)</span>
        </div>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div>
          <label style={{ display:"block", fontSize:12, fontWeight:700, marginBottom:6, color:muted }}>NOTION API KEY</label>
          <input style={inp} type="password" placeholder="secret_xxxxxxxxxxxx" value={key} onChange={e=>setKey(e.target.value)} />
        </div>
        <div>
          <label style={{ display:"block", fontSize:12, fontWeight:700, marginBottom:6, color:muted }}>DATABASE ID</label>
          <input style={inp} placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" value={dbId} onChange={e=>setDbId(e.target.value)} />
        </div>
        <button onClick={sync} disabled={loading}
          style={{ padding:"16px", borderRadius:18, border:"none", background:loading?"#4a4a7a":"#6366f1", color:"#fff", fontSize:16, fontWeight:800, cursor:loading?"wait":"pointer" }}>
          {loading ? "Syncing…" : "🔄 Sync Now"}
        </button>

        {status && (
          <div style={{ padding:"14px 16px", borderRadius:14, fontSize:13, lineHeight:1.6,
            background: status.type==="ok" ? (dark?"#0d2b1a":"#e8fdf0") : (dark?"#2d1010":"#fff0f0"),
            color: status.type==="ok" ? "#16a34a" : "#dc2626" }}>
            {status.msg}
          </div>
        )}

      {/* Manual paste import */}
      <div style={{ marginTop:24, borderTop:`1px solid ${border}`, paddingTop:20 }}>
        <div style={{ fontWeight:800, fontSize:16, marginBottom:4 }}>📋 Paste Import</div>
        <div style={{ color:muted, fontSize:13, marginBottom:14, lineHeight:1.6 }}>
          Works right now! In Notion, open your database → select all entries → copy → paste below. One entry per line, or paste any block of text notes.
        </div>
        <PasteImport addCard={addCard} cards={cards} theme={theme} />
      </div>
      </div>

      {/* Library stats */}
      <div style={{ marginTop:28 }}>
        <div style={{ fontSize:13, fontWeight:700, color:muted, marginBottom:12 }}>LIBRARY STATS</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:10 }}>
          {statCounts.map(s => (
            <div key={s.label} style={{ background:dark?"#2a2a3a":"#f2f2fa", borderRadius:16, padding:"14px 10px", textAlign:"center" }}>
              <div style={{ fontSize:22 }}>{s.emoji}</div>
              <div style={{ fontWeight:800, fontSize:20, margin:"4px 0" }}>{s.count}</div>
              <div style={{ fontSize:11, color:muted }}>{s.label}s</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:10, background:dark?"#2a2a3a":"#f2f2fa", borderRadius:16, padding:"14px 16px", display:"flex", justifyContent:"space-between" }}>
          <span style={{ color:muted, fontSize:14 }}>Total cards</span>
          <span style={{ fontWeight:800, fontSize:14 }}>{cards.length}</span>
        </div>
      </div>
    </div>
  );
}
