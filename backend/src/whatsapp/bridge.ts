import { askTeam } from '../agents/ask.js';
import { cardDepsFrom, roundDepsFrom } from '../agents/deps.js';
import { AgentModelError } from '../agents/model.js';
import { cardFor, runRound } from '../agents/round.js';
import type { PartyDecision, Proposal } from '../agents/store.js';
import { MAX_TEXT_LENGTH as MAX_POST_LENGTH, openBoardStore, type BoardPost } from '../board/store.js';
import { CHECKIN_SOURCE, isMood, MAX_CHECKIN_TEXT_LENGTH, recordCheckin, type Mood } from '../checkins.js';
import type { AppContext } from '../context.js';
import { openPolicyStore, withChosenVisibility } from '../policy/store.js';
import { dayKeyOf, deriveSignals, type LevelSignal } from '../signals.js';
import type { JsonObject, Person } from '../types.js';
import { digitsOf, type ReplyButton, type WhatsAppChannel } from './kapso.js';
import { InboundReading, isIntent, readingPrompt, readingSystemFor } from './reading.js';
import { LINK_CODE_LENGTH, type PromptKind, type WhatsAppStore } from './store.js';

const UNKNOWN_SENDER_QUIET_MS = 60 * 60_000;
const MAX_TRACKED_SENDERS = 5000;
const VISIBLE_PHONE_DIGITS = 4;
const RECENT_EVENTS = 50;
const UNSTATED_MOOD: Mood = 'normal';
const NOT_A_CODE_CHARACTER = /[^0-9A-Z]+/;

const ALLOW = 'si';
const DENY = 'no';
const ACCEPT: PartyDecision = 'acepta';
const REJECT: PartyDecision = 'rechaza';
const CHOICES: Record<PromptKind, readonly string[]> = { permiso: [ALLOW, DENY], propuesta: [ACCEPT, REJECT] };

const COPY = {
  unknownSender: 'Hola. Todavía no sé quién eres. Abre tu página de Ronda, entra a Ajustes y toca «Conectar WhatsApp».',
  onlyText: 'Por ahora solo leo mensajes de texto.',
  noModel: 'Todavía no puedo leer mensajes: al servidor le falta el modelo.',
  noTeam: 'Todavía no estás en un equipo. Entra a uno desde tu página de Ronda y pregunta de nuevo.',
  alreadyAnswered: 'Eso ya lo respondiste.',
  proposalClosed: 'Esa propuesta ya está cerrada.',
  noted: 'Anotado.',
  help: 'Puedes contarme cómo viene tu día o preguntarle algo a tu equipo.',
  allowedNow: 'Listo. Tu agente ya está conversando con los de tu equipo.',
  allowedLater: 'Listo. Lo pido en la próxima ronda.',
  denied: 'Entendido. No lo cuento.',
  accepted: 'Anotado. Te aviso cuando acepten todos.',
  rejected: 'Entendido. No esta vez.',
  nothingKnown: 'Ningún agente de tu equipo tenía algo que aportar. La pregunta quedó en el tablero para que respondan las personas.',
} as const;

export interface WhatsAppStatus {
  configured: boolean;
  linked: boolean;
  phoneEnding: string | null;
}

export interface WhatsAppLink {
  code: string;
  url: string | null;
  expiresAt: string;
}

export interface WhatsAppBridge {
  configured: boolean;
  statusOf(personToken: string): WhatsAppStatus;
  startLink(personToken: string): Promise<WhatsAppLink | null>;
  unlink(personToken: string): void;
  accepts(rawBody: string, signature: string | undefined): boolean;
  firstDelivery(key: string): boolean;
  receive(payload: JsonObject): Promise<void>;
  proposalCreated(proposal: Proposal): void;
  proposalAnswered(proposal: Proposal, answeredBy: string): void;
  askPermissions(personToken: string): void;
}

export const SILENT_BRIDGE: WhatsAppBridge = {
  configured: false,
  statusOf: () => ({ configured: false, linked: false, phoneEnding: null }),
  startLink: () => Promise.resolve(null),
  unlink: () => {},
  accepts: () => false,
  firstDelivery: () => false,
  receive: () => Promise.resolve(),
  proposalCreated: () => {},
  proposalAnswered: () => {},
  askPermissions: () => {},
};

const asRecord = (value: unknown): JsonObject => (value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {});
const textOf = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const lowerFirst = (text: string) => text.charAt(0).toLocaleLowerCase('es') + text.slice(1);
const names = new Intl.ListFormat('es', { style: 'long', type: 'conjunction' });
const linkMessage = (code: string) => `Hola Ronda, mi código es ${code}`;

const todayLine = (signals: LevelSignal[]): string | null => {
  const known = signals.filter((signal) => signal.level !== 'sin_datos').map((signal) => lowerFirst(signal.statement));
  return known.length > 0 ? `Por tus fuentes veo: ${known.join(' y ')}.` : null;
};

export function createWhatsAppBridge(ctx: AppContext, channel: WhatsAppChannel, links: WhatsAppStore): WhatsAppBridge {
  const board = openBoardStore(ctx.db);
  const policies = openPolicyStore(ctx.db);
  const lastUnknownReply = new Map<string, number>();

  const sendText = (personToken: string, body: string): void => {
    const phone = links.phoneOf(personToken);
    if (phone) void channel.sendText(phone, body);
  };

  const sendPrompt = (personToken: string, kind: PromptKind, ref: string, body: string, buttons: Array<{ choice: string; title: string }>): void => {
    const phone = links.phoneOf(personToken);
    if (!phone) return;
    const promptId = links.openPrompt(personToken, kind, ref, new Date());
    if (!promptId) return;
    const replies: ReplyButton[] = buttons.map((button) => ({ id: `${promptId}:${button.choice}`, title: button.title }));
    void channel.sendButtons(phone, body, replies);
  };

  const todayOf = (person: Person, now: Date): string | null => {
    const signals = withChosenVisibility(deriveSignals(ctx.store.listSignalEvents(person.token, now), now), policies.chosen(person.token));
    return todayLine([signals.energy, signals.load]);
  };

  const moodToday = (person: Person, now: Date): Mood | null => {
    const today = dayKeyOf(now);
    const latest = ctx.store.listEvents(person.token, RECENT_EVENTS).find((event) => event.source === CHECKIN_SOURCE && dayKeyOf(new Date(event.occurredAt)) === today);
    const mood = asRecord(latest?.raw).mood;
    return isMood(mood) ? mood : null;
  };

  const askPermissions = (personToken: string): void => {
    const person = ctx.store.findPerson(personToken);
    if (!person || !links.phoneOf(personToken)) return;
    for (const need of cardFor(cardDepsFrom(ctx), person, new Date()).pendingAsks) {
      sendPrompt(person.token, 'permiso', need.topic, `¿Le pido ayuda a tu equipo con «${need.topic}»? Si dices que sí, los agentes de tu equipo van a saber que tienes ese bloqueo.`, [
        { choice: ALLOW, title: 'Permitir' },
        { choice: DENY, title: 'No contar' },
      ]);
    }
  };

  const startRounds = (personToken: string): boolean => {
    const { model } = ctx;
    if (!model) return false;
    let started = false;
    for (const team of ctx.teams.teamsOf(personToken)) {
      const round = ctx.agents.startRound(team.id, personToken);
      if (!round) continue;
      void runRound(roundDepsFrom(ctx, model), round);
      started = true;
    }
    return started;
  };

  const reportAnswer = (personToken: string, post: BoardPost): void => {
    const answer = board.answerOf(post.id, new Date());
    if (!answer) return;
    if (answer.status === 'fallida') return sendText(personToken, `Los agentes no pudieron responder. ${answer.problem ?? ''}`.trim());
    if (!answer.text) return sendText(personToken, COPY.nothingKnown);
    const sources = answer.sourceTokens.flatMap((token) => ctx.store.findPerson(token)?.name ?? []);
    sendText(personToken, sources.length > 0 ? `${answer.text}\n\nArmada con lo que ${sources.length === 1 ? 'comparte' : 'comparten'} ${names.format(sources)}.` : answer.text);
  };

  const askQuestion = (person: Person, question: string): void => {
    const team = ctx.teams.teamsOf(person.token).at(-1);
    if (!team) return sendText(person.token, COPY.noTeam);
    const post = board.createPost({ teamId: team.id, authorToken: person.token, kind: 'pregunta', text: question.slice(0, MAX_POST_LENGTH) });
    const outcome = askTeam({ ...cardDepsFrom(ctx), board, model: ctx.model }, post);
    if (outcome.state !== 'started') return sendText(person.token, `Tu pregunta quedó en el tablero de ${team.name}. Los agentes están ocupados; pídeles la respuesta desde tu página.`);
    sendText(person.token, `Le pregunto a los agentes de ${team.name}. Te aviso cuando respondan.`);
    void outcome.done.then(() => reportAnswer(person.token, post));
  };

  const converse = async (person: Person, message: string): Promise<void> => {
    const { model } = ctx;
    if (!model) return sendText(person.token, COPY.noModel);
    let reading;
    try {
      reading = await model.decide({ system: readingSystemFor(person.name), prompt: readingPrompt(message), schema: InboundReading });
    } catch (failure) {
      if (!(failure instanceof AgentModelError)) throw failure;
      return sendText(person.token, `No pude leer tu mensaje. ${failure.message}`);
    }
    const intent = reading.intent.trim().toLowerCase();
    const reply = reading.reply.trim();
    const question = reading.question.trim();
    if (!isIntent(intent) || intent === 'otro' || (intent === 'pregunta' && !question)) return sendText(person.token, reply || COPY.help);
    if (intent === 'pregunta') return askQuestion(person, question);

    const now = new Date();
    const stated = reading.mood.trim().toLowerCase();
    const earlier = moodToday(person, now);
    const within = (text: string) => [...text.trim()].slice(0, MAX_CHECKIN_TEXT_LENGTH).join('') || null;
    recordCheckin(ctx.store, person.token, { mood: isMood(stated) ? stated : (earlier ?? UNSTATED_MOOD), blocker: within(reading.blocker), note: within(reading.note) }, now);
    sendText(person.token, [reply || COPY.noted, earlier === null ? todayOf(person, now) : null].filter(Boolean).join('\n'));
    askPermissions(person.token);
  };

  const greetUnknown = (phone: string): void => {
    const now = Date.now();
    if (now - (lastUnknownReply.get(phone) ?? 0) < UNKNOWN_SENDER_QUIET_MS) return;
    if (lastUnknownReply.size >= MAX_TRACKED_SENDERS) lastUnknownReply.clear();
    lastUnknownReply.set(phone, now);
    void channel.sendText(phone, COPY.unknownSender);
  };

  const onText = async (phone: string, text: string): Promise<void> => {
    const now = new Date();
    const candidates = text.toUpperCase().split(NOT_A_CODE_CHARACTER).filter((word) => word.length === LINK_CODE_LENGTH);
    for (const candidate of candidates) {
      const personToken = links.redeemCode(candidate, now);
      const person = personToken ? ctx.store.findPerson(personToken) : undefined;
      if (!person) continue;
      links.link(person.token, phone, now);
      sendText(person.token, [`Listo, ${person.name}. Soy tu agente en Ronda.`, todayOf(person, now), COPY.help].filter(Boolean).join('\n'));
      askPermissions(person.token);
      return;
    }
    const personToken = links.personOf(phone);
    const person = personToken ? ctx.store.findPerson(personToken) : undefined;
    if (!person) return greetUnknown(phone);
    await converse(person, text);
  };

  const onButton = (phone: string, buttonId: string): void => {
    const [promptId = '', choice = ''] = buttonId.split(':');
    const prompt = links.findPrompt(promptId);
    const personToken = links.personOf(phone);
    if (!prompt || !personToken || prompt.personToken !== personToken || !CHOICES[prompt.kind].includes(choice)) return;
    if (!links.closePrompt(prompt.id, choice, new Date())) return sendText(personToken, COPY.alreadyAnswered);

    if (prompt.kind === 'permiso') {
      const allowed = choice === ALLOW;
      ctx.agents.decideTopic(personToken, prompt.ref, allowed);
      return sendText(personToken, !allowed ? COPY.denied : startRounds(personToken) ? COPY.allowedNow : COPY.allowedLater);
    }

    const proposal = ctx.agents.findProposal(prompt.ref);
    if (!proposal || proposal.status !== 'por_aprobar') return sendText(personToken, COPY.proposalClosed);
    const decision = choice === ACCEPT ? ACCEPT : REJECT;
    const answered = ctx.agents.answerProposal(proposal.id, personToken, decision);
    if (!answered) return;
    if (answered.status !== 'acordada') sendText(personToken, decision === ACCEPT ? COPY.accepted : COPY.rejected);
    bridge.proposalAnswered(answered, personToken);
  };

  const handle = async (event: JsonObject): Promise<void> => {
    const message = asRecord(event.message);
    const detail = asRecord(message.kapso);
    const conversation = asRecord(event.conversation);
    if (detail.direction === 'outbound') return;
    const numberId = textOf(event.phone_number_id) || textOf(conversation.phone_number_id) || textOf(detail.phone_number_id);
    if (numberId && numberId !== channel.phoneNumberId) return;
    const phone = digitsOf(message.from) || digitsOf(conversation.phone_number) || digitsOf(detail.phone_number);
    if (!phone) return;

    if (message.type === 'text') return onText(phone, textOf(asRecord(message.text).body));
    const interactive = asRecord(message.interactive);
    if (message.type === 'interactive' && interactive.type === 'button_reply') return onButton(phone, textOf(asRecord(interactive.button_reply).id));
    const personToken = links.personOf(phone);
    if (personToken) sendText(personToken, COPY.onlyText);
  };

  const bridge: WhatsAppBridge = {
    configured: true,

    statusOf(personToken) {
      const phone = links.phoneOf(personToken);
      return { configured: true, linked: phone !== undefined, phoneEnding: phone ? phone.slice(-VISIBLE_PHONE_DIGITS) : null };
    },

    async startLink(personToken) {
      const { code, expiresAt } = links.createCode(personToken, new Date());
      const number = await channel.number();
      return { code, expiresAt, url: number ? `https://wa.me/${number}?text=${encodeURIComponent(linkMessage(code))}` : null };
    },

    unlink: (personToken) => links.unlink(personToken),

    accepts: (rawBody, signature) => channel.isSigned(rawBody, signature),

    firstDelivery: (key) => links.firstDelivery(key, new Date()),

    async receive(payload) {
      const events = payload.batch === true && Array.isArray(payload.data) ? payload.data.map(asRecord) : [payload];
      for (const event of events) await handle(event);
    },

    proposalCreated(proposal) {
      const requester = proposal.parties.find((party) => party.role === 'pide');
      for (const party of proposal.parties) {
        const lead = party.role === 'pide' ? `Tu agente encontró ayuda con «${proposal.topic}».` : `El agente de ${requester?.name ?? 'alguien de tu equipo'} pide tu ayuda con «${proposal.topic}».`;
        sendPrompt(party.token, 'propuesta', proposal.id, `${lead}\n\n${proposal.text}`, [
          { choice: ACCEPT, title: 'Aceptar' },
          { choice: REJECT, title: 'Ahora no' },
        ]);
      }
    },

    proposalAnswered(proposal, answeredBy) {
      if (proposal.status === 'por_aprobar') return;
      const everyone = names.format(proposal.parties.map((party) => party.name));
      for (const party of proposal.parties) {
        if (proposal.status === 'acordada') sendText(party.token, `Quedó acordado entre ${everyone}.\n\n${proposal.text}\n\nYa pueden hablar directo.`);
        else if (party.token !== answeredBy) sendText(party.token, `La propuesta sobre «${proposal.topic}» no salió esta vez.`);
      }
    },

    askPermissions,
  };

  return bridge;
}
