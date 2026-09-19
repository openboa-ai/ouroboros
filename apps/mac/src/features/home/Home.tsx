import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Settings2, X, GripVertical } from "lucide-react";
import { Button } from "@/ui/primitives/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/primitives/select";
import { EmptyState } from "@/ui/components/EmptyState";
import { ModuleBoundary } from "@/app/ModuleBoundary";
import type { ViewProps } from "@/app/contracts";
import type { WidgetDefinition, WidgetSize } from "@/contracts/modules";
import { defaultLayout, moveWidget, readLayout } from "./layout";
import "./home.css";
/** User-owned presentation only. No layout mutation dispatches a company command. */
export function HomeScreen({widgets, scope, ...view}: ViewProps & { widgets: readonly WidgetDefinition[]; scope: string }) {
  const key = `ouroboros.home.v1.${scope}`;
  const [saved, setSaved] = useState(() => { try { return readLayout(localStorage.getItem(key), defaultLayout(widgets)); } catch { return defaultLayout(widgets); } });
  const [draft, setDraft] = useState(saved);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const items = editing ? draft : saved;
  function save() {
    try { localStorage.setItem(key, JSON.stringify(draft)); setSaved(draft); setEditing(false); setAdding(false); setError(""); }
    catch { setError("This layout could not be saved. Your previous layout is intact."); }
  }
  return <div className="home-screen">
    <div className="home-toolbar"><div><h2 className="type-section">Your company, at a glance</h2><p className="type-meta muted">{editing ? "Arrange your view. Company activity continues independently." : "Your selection of company and workspace widgets"}</p></div>
      <div className="detail-toolbar">{editing ? <><Button variant="ghost" onClick={() => {setEditing(false);setAdding(false);setError("");}}>Cancel</Button><Button variant="secondary" onClick={() => setAdding(!adding)}><Plus size={14}/>Add widget</Button><Button onClick={save}>Save layout</Button></> : <Button variant="secondary" onClick={() => {setDraft(saved);setEditing(true);}}><Settings2 size={14}/>Edit home</Button>}</div></div>
    {error && <p role="alert" className="type-data">{error}</p>}
    {adding && <section className="widget-picker" aria-label="Add widgets">{[...new Set(widgets.map(w => w.provider))].map(provider => <div key={provider}><h3 className="type-meta muted">{provider}</h3>{widgets.filter(w => w.provider === provider).map(w => <button className="record-link record-link--row" key={w.id} onClick={() => setDraft([...draft,{id:crypto.randomUUID(),widget:w.id,size:w.sizes[0]}])} disabled={draft.length >= 24}><span className="record-copy"><span className="type-control">{w.title}</span><span className="type-meta muted">{w.description}</span></span><Plus size={14}/></button>)}</div>)}</section>}
    {!items.length && <EmptyState title="Make room for what matters" detail="Add workspace or company widgets using Edit home."/>}
    <div className="widget-grid">{items.map((item, index) => {
      const definition = widgets.find(w => w.id === item.widget);
      const Widget = definition?.Component;
      return <section key={item.id} className={`home-widget widget-${item.size} ${editing ? "is-editing" : ""}`} aria-label={definition?.title ?? item.widget} draggable={editing} onDragStart={() => setDragging(item.id)} onDragOver={e => editing && e.preventDefault()} onDrop={() => { if(dragging) setDraft(moveWidget(draft,dragging,index-draft.findIndex(x=>x.id===dragging))); setDragging(null); }}>
        <div className="widget-heading"><div><span className="type-meta muted">{definition?.provider ?? "Unavailable module"}</span><h3 className="type-section">{definition?.title ?? item.widget}</h3></div>{editing && <GripVertical size={16} className="muted"/>}</div>
        {editing && <div className="widget-editor"><Button variant="ghost" size="icon-sm" aria-label={`Move ${definition?.title ?? item.widget} up`} disabled={index===0} onClick={()=>setDraft(moveWidget(draft,item.id,-1))}><ArrowUp/></Button><Button variant="ghost" size="icon-sm" aria-label={`Move ${definition?.title ?? item.widget} down`} disabled={index===items.length-1} onClick={()=>setDraft(moveWidget(draft,item.id,1))}><ArrowDown/></Button><Select value={item.size} onValueChange={v=>v&&setDraft(draft.map(i=>i.id===item.id?{...i,size:v as WidgetSize}:i))}><SelectTrigger aria-label={`Size of ${definition?.title ?? item.widget}`}><SelectValue/></SelectTrigger><SelectContent>{(definition?.sizes??[item.size]).map(size=><SelectItem key={size} value={size}>{size}</SelectItem>)}</SelectContent></Select><Button variant="ghost" size="icon-sm" aria-label={`Remove ${definition?.title ?? item.widget}`} onClick={()=>setDraft(draft.filter(i=>i.id!==item.id))}><X/></Button></div>}
        <ModuleBoundary>{Widget ? <Widget {...view}/> : <EmptyState title="Widget unavailable" detail="Its module or current access is unavailable. Your layout is preserved."/>}</ModuleBoundary>
      </section>;
    })}</div>
  </div>;
}
