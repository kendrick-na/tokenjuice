const WEEK = 7 * 86400000;
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
export function normalizeHistory(value, now = Date.now()) {
  const provider = value?.format === "tokenjuice-forecast-history-v1" ? "Claude"
    : value?.format === "tokenjuice-codex-forecast-history-v1" ? "Codex" : null;
  if (!provider || !record(value) || !Array.isArray(value.observations) || value.observations.length > 320
    || !Number.isSafeInteger(now) || now <= WEEK) throw new Error("invalid_history");
  const groups = new Map(); let excluded = 0;
  for (const row of value.observations) {
    const validKey = provider === "Claude" ? /^\d{1,3}:(5-hour|Weekly(?: Opus| Sonnet| Cowork)?)$/.test(row?.key)
      : /^cw_[a-f0-9]{64}$/.test(row?.key);
    if (!record(row) || typeof row.key !== "string" || !validKey || !Number.isSafeInteger(row.at)
      || row.at <= 0 || row.at > now || !Number.isFinite(row.used) || row.used < 0 || row.used > 100)
      throw new Error("invalid_history");
    if (row.at < now - WEEK) { excluded++; continue; }
    if (!groups.has(row.key)) groups.set(row.key, []);
    groups.get(row.key).push({at:row.at, used:row.used});
  }
  if (groups.size > 128) throw new Error("too_many_series");
  const series = [...groups].map(([key, rows], index) => {
    rows.sort((a,b) => a.at-b.at); const points = [];
    for (const row of rows) {
      const previous = points.at(-1);
      if (previous?.at === row.at) {
        if (previous.used !== row.used) throw new Error("conflicting_observation");
        continue;
      }
      points.push(row);
    }
    const label = provider === "Claude" ? `Claude 로컬 슬롯 ${Number(key.split(":")[0])+1} · ${key.split(":")[1]}`
      : `Codex 관측 구간 ${index+1} · 창/계정 미식별`;
    return {label,points}; // Never expose opaque keys or unknown imported fields.
  });
  return {provider, start:now-WEEK, end:now, excluded, series};
}
export function historySegments(points) {
  const segments = []; let current = [];
  for (const point of points) {
    const last = current.at(-1);
    if (last && (point.at-last.at > 3600000 || point.used < last.used)) {
      segments.push(current); current = [];
    }
    current.push(point);
  }
  if (current.length) segments.push(current);
  return segments;
}

export function initHistory() {
  const get = id => document.getElementById(id), input = get("history-file");
  let history = null, busy = false;
  const feedback = text => {get("history-feedback").textContent=text;};
  const controls = () => {input.disabled=busy;get("history-clear").disabled=busy||!history;get("history-series").disabled=busy;};
  function render() {
    const series = history.series[Number(get("history-series").value)];
    const graph = get("history-chart"), rows = get("history-rows"); graph.replaceChildren(); rows.replaceChildren();
    if (!series) {get("history-summary").textContent="최근 7일 관측이 없습니다. 기록을 직접 켠 뒤 새 history를 내보내세요.";return;}
    const points = series.points, first = points[0], last = points.at(-1);
    get("history-summary").textContent=`${points.length}개 관측 · 첫 값 ${first.used}% → 마지막 관측 ${last.used}% 사용 · ${new Date(last.at).toLocaleString("ko-KR")}. 현재 사용량이 아닙니다.`;
    const svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
    svg.setAttribute("viewBox","0 0 600 260");svg.setAttribute("role","img");
    svg.setAttribute("aria-label",`${series.label} · 과거 사용률 0~100%, 최근 7일. 정확한 값은 관측 표에서 확인하세요.`);
    const add = (tag,attributes,text) => {
      const node = document.createElementNS(svg.namespaceURI,tag);
      for (const [key,value] of Object.entries(attributes)) node.setAttribute(key,String(value));
      if (text !== undefined) node.textContent=text;svg.append(node);return node;
    };
    const x = at => last.at===first.at ? 333 : 88+(at-first.at)/(last.at-first.at)*490, y = used => 180-used*1.5;
    for (const pct of [0,50,100]) {
      add("line",{x1:88,x2:578,y1:y(pct),y2:y(pct),class:"history-grid"});
      add("text",{x:0,y:y(pct)+5,class:"history-axis"},`${pct}%`);
    }
    const date = at => new Date(at).toLocaleDateString("ko-KR",{month:"numeric",day:"numeric"});
    const ticks = last.at===first.at ? [[333,first.at,"middle"]] : [[88,first.at,"start"],[578,last.at,"end"]];
    for (const [position,at,anchor] of ticks) {
      add("text",{x:position,y:218,"text-anchor":anchor,class:"history-axis"},date(at));
      add("text",{x:position,y:250,"text-anchor":anchor,class:"history-axis"},new Date(at).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit",hour12:false}));
    }
    for (const segment of historySegments(points)) if (segment.length>1)
      add("polyline",{points:segment.map(point=>`${x(point.at)},${y(point.used)}`).join(" "),class:"history-line"});
    for (const point of points) {
      const dot = add("circle",{cx:x(point.at),cy:y(point.used),r:3,class:"history-point"});
      const title = document.createElementNS(svg.namespaceURI,"title");title.textContent=`${new Date(point.at).toLocaleString("ko-KR")} · ${point.used}% 사용`;dot.append(title);
      const row = document.createElement("tr");
      for (const text of [new Date(point.at).toLocaleString("ko-KR"),`${point.used}%`]) {
        const cell = document.createElement("td");cell.textContent=text;row.append(cell);
      }
      rows.append(row);
    }
    graph.append(svg);
  }
  input.addEventListener("change",async()=>{
    const file=input.files?.[0];if (!file||busy)return;busy=true;controls();feedback("이 기기에서 기록을 읽는 중입니다. 외부로 보내지 않습니다.");
    try {
      if (file.size>1024*1024) throw new Error("too_large");
      const next=normalizeHistory(JSON.parse(await file.text()));
      history=next;const select=get("history-series");select.replaceChildren();
      next.series.forEach((series,index)=>{const option=document.createElement("option");option.value=String(index);option.textContent=series.label;select.append(option);});
      get("history-content").hidden=false;render();
      feedback(`${next.provider} 과거 관측을 열었습니다. 7일 밖 ${next.excluded}개 제외. 이 화면에만 보관하며 새로고침하면 사라집니다.`);
    } catch {feedback("지원하지 않거나 손상된 history입니다. 엔진의 history JSON(1 MiB 이하)을 다시 선택하세요. 기존 화면은 유지했습니다.");}
    finally {busy=false;input.value="";controls();}
  });
  get("history-series").addEventListener("change",render);
  get("history-clear").addEventListener("click",()=>{
    history=null;get("history-content").hidden=true;get("history-chart").replaceChildren();get("history-rows").replaceChildren();get("history-series").replaceChildren();get("history-summary").textContent="";
    feedback("화면의 기록을 지웠습니다. 선택한 원본 파일과 엔진 기록은 변경하지 않습니다.");controls();input.focus();
  });
  controls();
}
