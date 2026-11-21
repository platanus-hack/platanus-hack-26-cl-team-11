const base = 'https://hack.platan.us/api/market/';
export async function upstream(path) {
  const response = await fetch(base + path + '?event=26-cl', {
    headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(7000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error('Fuente no disponible');
  return response.json();
}
export async function snapshot() {
  const state = await upstream('state');
  const teams = state.projects.map(p => ({
    team: p.teamSlug, id: p.id, name: p.name, price: p.price,
    q: state.qVector[p.id], presenting: p.isCurrentlyPresenting,
    description: p.onelinerShort || '',
  })).sort((a, b) => b.price - a.price);
  if (!teams.length || !Number.isFinite(state.serverTs) ||
      teams.some(p => !Number.isFinite(p.price) || p.price <= 0 || !Number.isFinite(p.q))) {
    throw new Error('Lectura incompleta');
  }
  return { event: '26-cl', at: state.serverTs, status: state.market.status, feeBps: state.market.feeBps, teams };
}
export async function history(id) {
  const data = await upstream('history/' + id);
  const points = data.points.map(p => [Date.parse(p.t), p.price])
    .filter(([t, p]) => Number.isFinite(t) && Number.isFinite(p) && p > 0)
    .sort((a,b) => a[0] - b[0]);
  if (!points.length) throw new Error('Serie no disponible');
  return points;
}
export function atTime(points, t) {
  return points.findLast(row => row[0] <= t)?.[1];
}
