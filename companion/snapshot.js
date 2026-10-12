// Projection after the existing v1 shape validation. This is not a credential
// scanner: legitimate metadata strings still require the user's review.
function fields(value, schema) {
  const result = {};
  for (const [key, type] of Object.entries(schema)) {
    if (!Object.hasOwn(value, key)) continue;
    const item = value[key];
    if (item === null || (type === "timestamp" && (typeof item === "string" || Number.isFinite(item)))
      || (typeof item === type && (type !== "number" || Number.isFinite(item)))) result[key] = item;
  }
  return result;
}
const payloadFields = { account:"string", id:"string", label:"string", state:"string", source:"string",
  sourceLabel:"string", reason:"string", observedAt:"number", lastSuccessAt:"number", retryAt:"number" };
function projectItem(item) {
  const result = fields(item, {name:"string",used:"number",resets:"timestamp",state:"string"});
  if (Object.hasOwn(item,"forecast")) result.forecast = item.forecast == null ? null
    : fields(item.forecast,{kind:"string",beforeReset:"boolean",exhaustionAt:"number",samples:"number",usedPerHour:"number",observedAt:"number"});
  return result;
}
function projectPayload(payload) {
  return { ...fields(payload,payloadFields), items:payload.items.map(projectItem) };
}
export function projectWidgetSnapshot(snapshot) {
  const result = { ...fields(snapshot,{contractVersion:"number",generatedAt:"number",transport:"string"}),
    claude:snapshot.claude.map(projectPayload), codex:projectPayload(snapshot.codex) };
  if (Object.hasOwn(snapshot,"providers")) result.providers = snapshot.providers.map(projectPayload);
  if (Object.hasOwn(snapshot,"sessions")) result.sessions = snapshot.sessions.map(session => fields(session,
    {platform:"string",name:"string",id:"string",branch:"string",status:"string",model:"string",used:"number",pct:"number",win:"number",mtime:"number",kind:"string"}));
  return result;
}
