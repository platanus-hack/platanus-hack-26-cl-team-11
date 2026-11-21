import { createRoom } from './roomApi';
import { TextForm } from './TextForm';

const MAX_NAME_LENGTH = 80;

export function RoomStart() {
  async function open(name: string) {
    const room = await createRoom(name);
    window.location.assign(`/sala/${room.code}`);
  }

  return (
    <section className="rd-card rd-glass">
      <span className="rd-label">Nueva sala</span>
      <TextForm label="Nombre de la sala" placeholder="Nombre de la sala" action="Abrir sala" maxLength={MAX_NAME_LENGTH} onSubmit={open} />
      <p className="rd-note">Muestra un código en la pantalla. Quien lo escanea entra sin pedir permiso.</p>
    </section>
  );
}
