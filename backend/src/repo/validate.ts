import { isVisibility } from '../policy/store.js';
import type { JsonObject } from '../types.js';
import type { FileDraft } from './store.js';

export const MAX_PATH_LENGTH = 120;
export const MAX_FILE_BYTES = 8192;
export const MAX_FILES_PER_COMMIT = 20;
export const MAX_MESSAGE_LENGTH = 200;

const PATH_SHAPE = /^[A-Za-z0-9_][A-Za-z0-9._-]*(?:\/[A-Za-z0-9_][A-Za-z0-9._-]*)*$/;

const CREDENTIAL_SHAPES: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9_-]{20,}/,
  /\brda_[A-Za-z0-9_-]{20,}/,
  /\bphk_[A-Za-z0-9_-]{16,}/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/,
  /\bgithub_pat_[A-Za-z0-9_]{22,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
];

export const isRepoPath = (value: unknown): value is string => typeof value === 'string' && value.length <= MAX_PATH_LENGTH && PATH_SHAPE.test(value);

export const looksLikeCredential = (text: string): boolean => CREDENTIAL_SHAPES.some((shape) => shape.test(text));

export type Checked<Value> = { ok: true; value: Value } | { ok: false; error: string };

const fail = (error: string) => ({ ok: false as const, error });

export function checkFile(value: unknown): Checked<FileDraft> {
  const file = value && typeof value === 'object' ? (value as JsonObject) : {};
  if (!isRepoPath(file.path)) return fail('La ruta de un archivo no es válida. Usa letras, números, punto, guion y «/», hasta 120 caracteres.');
  if (typeof file.content !== 'string') return fail(`Falta el contenido de ${file.path}.`);
  if (Buffer.byteLength(file.content) > MAX_FILE_BYTES) return fail(`${file.path} pasa de 8 KB. Resume o divide el archivo.`);
  if (looksLikeCredential(file.content)) return fail(`${file.path} parece contener una credencial. No se guardó nada.`);
  if (file.share !== undefined && !isVisibility(file.share)) return fail(`El permiso de ${file.path} debe ser siempre, preguntar o nunca.`);
  return { ok: true, value: { path: file.path, content: file.content, ...(file.share === undefined ? {} : { share: file.share }) } };
}

export function checkCommit(body: JsonObject): Checked<{ message: string; files: FileDraft[]; remove: string[] }> {
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, MAX_MESSAGE_LENGTH) : '';
  if (!message) return fail('Falta el mensaje: una línea que diga qué cambió.');
  const rawFiles = body.files === undefined ? [] : body.files;
  const rawRemove = body.delete === undefined ? [] : body.delete;
  if (!Array.isArray(rawFiles) || !Array.isArray(rawRemove)) return fail('«files» y «delete» deben ser listas.');
  if (rawFiles.length + rawRemove.length === 0) return fail('El cambio no trae archivos.');
  if (rawFiles.length + rawRemove.length > MAX_FILES_PER_COMMIT) return fail(`Un cambio lleva hasta ${MAX_FILES_PER_COMMIT} archivos.`);
  if (looksLikeCredential(message)) return fail('El mensaje parece contener una credencial. No se guardó nada.');

  const files: FileDraft[] = [];
  for (const raw of rawFiles) {
    const checked = checkFile(raw);
    if (!checked.ok) return checked;
    if (files.some((file) => file.path === checked.value.path)) return fail(`${checked.value.path} viene dos veces en el mismo cambio.`);
    files.push(checked.value);
  }
  if (!rawRemove.every(isRepoPath)) return fail('Una ruta en «delete» no es válida.');
  return { ok: true, value: { message, files, remove: [...new Set(rawRemove)] } };
}
