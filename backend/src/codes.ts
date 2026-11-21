import { createHash, randomInt } from 'node:crypto';

const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const NOT_IN_A_CODE = /[^0-9A-Z]/g;
const PUBLIC_ID_LENGTH = 12;

export const randomCode = (length: number): string => Array.from({ length }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');

export const normalizeCode = (value: string): string => value.toUpperCase().replace(NOT_IN_A_CODE, '');

export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export const publicIdOf = (personToken: string): string => sha256(personToken).slice(0, PUBLIC_ID_LENGTH);
