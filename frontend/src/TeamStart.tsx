import { createTeam, joinTeam } from './api';
import { TextForm } from './TextForm';

const MAX_NAME_LENGTH = 80;
const MAX_CODE_LENGTH = 64;

export function TeamStart({ token, onChange }: { token: string; onChange: () => Promise<void> }) {
  async function create(name: string) {
    await createTeam(token, name);
    await onChange();
  }

  async function join(joinCode: string) {
    await joinTeam(token, joinCode);
    await onChange();
  }

  return (
    <section className="rd-card rd-glass">
      <span className="rd-label">Tu equipo</span>
      <p className="rd-note">Todavía no estás en un equipo. Crea uno o pide entrar con el código que te compartieron.</p>
      <TextForm label="Nombre del equipo" placeholder="Nombre del equipo" action="Crear equipo" maxLength={MAX_NAME_LENGTH} onSubmit={create} />
      <TextForm label="Código del equipo" placeholder="Código del equipo" action="Pedir entrar" maxLength={MAX_CODE_LENGTH} onSubmit={join} />
    </section>
  );
}
