import { Face } from './Face';

export function PersonTag({ name, detail }: { name: string; detail?: string }) {
  return (
    <span className="app-person">
      <Face name={name} />
      <span className="app-text">
        <span className="rd-person__name app-wrap">{name}</span>
        {detail && <span className="rd-note">{detail}</span>}
      </span>
    </span>
  );
}
