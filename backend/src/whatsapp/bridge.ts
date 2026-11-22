import { askTeam } from '../agents/ask.js';
import { cardDepsFrom, roundDepsFrom } from '../agents/deps.js';
import { AgentModelError, type AgentModel } from '../agents/model.js';
import { topicKeyOf } from '../agents/cards.js';
import { cardFor, openNeedsOf, runRound } from '../agents/round.js';
import type { PartyDecision, Proposal } from '../agents/store.js';
import { MAX_TEXT_LENGTH as MAX_POST_LENGTH, openBoardStore, type BoardPost } from '../board/store.js';
import { CHECKIN_SOURCE, isMood, MAX_CHECKIN_TEXT_LENGTH, recordCheckin, type Mood } from '../checkins.js';
import type { AppContext } from '../context.js';
import { openPolicyStore, withChosenVisibility } from '../policy/store.js';
import { dayKeyOf, deriveSignals, type LevelSignal } from '../signals.js';
import { mesaCardDeps } from '../mesa/members.js';
import { MESA_NAME, MESA_TEAM_ID } from '../mesa/store.js';
import { startMesaRound } from '../mesa/ticker.js';
import type { JsonObject, Person } from '../types.js';
import { digitsOf, type ReplyButton, type WhatsAppChannel } from './kapso.js';
import { InboundReading, isIntent, readingPrompt, readingSystemFor } from './reading.js';
import { LINK_CODE_LENGTH, type InboxMessage, type PromptKind, type PromptOption, type WhatsAppStore } from './store.js';

const UNKNOWN_SENDER_QUIET_MS = 60 * 60_000;
const MAX_TRACKED_SENDERS = 5000;
const VISIBLE_PHONE_DIGITS = 4;
const RECENT_EVENTS = 50;
const UNSTATED_MOOD: Mood = 'normal';
const RECENT_MESSAGES = 10;
const ANSWER_WAIT_MS = 60_000;

type Door = 'whatsapp' | 'asistente';
const EVERY_DOOR = null;
const NOT_A_CODE_CHARACTER = /[^0-9A-Z]+/;

const ALLOW = 'si';
const DENY = 'no';
const ACCEPT: PartyDecision = 'acepta';
const REJECT: PartyDecision = 'rechaza';
const CHOICES: Record<PromptKind, readonly string[]> = { permiso: [ALLOW, DENY], propuesta: [ACCEPT, REJECT] };

const COPY = {
  unknownSender: 'Hola. Todavía no sé quién eres. Abre tu página de Montu, entra a Ajustes y toca «Conectar WhatsApp».',
  onlyText: 'Por ahora solo leo mensajes de texto.',
  noModel: 'Todavía no puedo leer mensajes: al servidor le falta el modelo.',
  noTeam: 'Todavía no estás en un equipo. Entra a uno desde tu página de Montu y pregunta de nuevo.',
  alreadyAnswered: 'Eso ya lo respondiste.',
  proposalClosed: 'Esa propuesta ya está cerrada.',
  noted: 'Anotado.',
  help: 'Puedes contarme cómo viene tu día o preguntarle algo a tu equipo.',
  allowedNow: 'Listo. Tu agente ya está conversando con los de tu equipo.',
  allowedLater: 'Listo. Lo pido en la próxima ronda.',
  alreadyProposed: 'Ya hay una propuesta de ayuda con ese tema. Respóndela y, si no te sirve, lo vuelvo a pedir.',
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

export interface AgentMessage {
  id: number;
  text: string;
  at: string;
  options: Array<{ id: string; label: string }>;
}

export interface AgentInbox {
  pending: AgentMessage[];
  recent: AgentMessage[];
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
  say(personToken: string, text: string): Promise<AgentMessage[]>;
  choose(personToken: string, optionId: string): AgentMessage[];
  inboxOf(personToken: string): AgentInbox;
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
  say: () => Promise.resolve([]),
  choose: () => [],
  inboxOf: () => ({ pending: [], recent: [] }),
};

const asRecord = (value: unknown): JsonObject => (value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {});
const textOf = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const lowerFirst = (text: string) => text.charAt(0).toLocaleLowerCase('es') + text.slice(1);
const names = new Intl.ListFormat('es', { style: 'long', type: 'conjunction' });
const linkMessage = (code: string) => `Hola Montu, mi código es ${code}`;

const todayLine = (signals: LevelSignal[]): string | null => {
  const known = signals.filter((signal) => signal.level !== 'sin_datos').map((signal) => lowerFirst(signal.statement));
  return known.length > 0 ? `Por tus fuentes veo: ${known.join(' y ')}.` : null;
};

const MESA_RETRY_MS = 3000;
const ACTIVE_PROPOSAL_MS = 7 * 86_400_000;

const optionIdOf = (promptId: string, choice: string) => `${promptId}:${choice}`;

const viewMessage = (message: InboxMessage): AgentMessage => ({
  id: message.id,
  text: message.body,
  at: message.createdAt,
  options: message.promptId ? message.options.map((option) => ({ id: optionIdOf(message.promptId as string, option.choice), label: option.title })) : [],
});

const settledWithin = (work: Promise<void>, limitMs: number): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, limitMs);
    timer.unref();
    void work.finally(() => {
      clearTimeout(timer);
      resolve();
    });
  });

export function createWhatsAppBridge(ctx: AppContext, channel: WhatsAppChannel | null, links: WhatsAppStore): WhatsAppBridge {
  const board = openBoardStore(ctx.db);
  const policies = openPolicyStore(ctx.db);
  const lastUnknownReply = new Map<string, number>();

  const phoneFor = (personToken: string, door: Door | null) => (channel && door !== 'asistente' ? links.phoneOf(personToken) : undefined);

  const sendTextThrough = (personToken: string, body: string, door: Door | null = EVERY_DOOR): void => {
    links.addMessage(personToken, body, null, [], new Date());
    const phone = phoneFor(personToken, door);
    if (channel && phone) void channel.sendText(phone, body);
  };

  const sendPrompt = (personToken: string, kind: PromptKind, ref: string, body: string, options: PromptOption[], door: Door | null = EVERY_DOOR, askAgain = false): void => {
    if (ctx.sim.isSynthetic(personToken)) return;
    const now = new Date();
    const promptId = links.openPrompt(personToken, kind, ref, now) ?? (askAgain ? links.unansweredPrompt(personToken, kind, ref) : undefined);
    if (!promptId) return;
    links.addMessage(personToken, body, promptId, options, now);
    const phone = phoneFor(personToken, door);
    const replies: ReplyButton[] = options.map((option) => ({ id: optionIdOf(promptId, option.choice), title: option.title }));
    if (channel && phone) void channel.sendButtons(phone, body, replies);
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

  const askPermissions = (personToken: string, door: Door | null = EVERY_DOOR, statedNow: string | null = null): void => {
    const person = ctx.store.findPerson(personToken);
    if (!person) return;
    for (const need of cardFor(cardDepsFrom(ctx), person, new Date()).pendingAsks) {
      sendPrompt(
        person.token,
        'permiso',
        need.topic,
        `¿Le pido ayuda a tu equipo con «${need.topic}»? Si dices que sí, los agentes de tu equipo van a saber que tienes ese bloqueo.`,
        [
          { choice: ALLOW, title: 'Permitir' },
          { choice: DENY, title: 'No contar' },
        ],
        door,
        statedNow !== null && topicKeyOf(need.topic) === topicKeyOf(statedNow),
      );
    }
  };

  const inMesa = (personToken: string) => !ctx.mesa.hasLeft(personToken) && !ctx.sim.isSynthetic(personToken);

  const hasOpenNeed = (personToken: string): boolean =>
    openNeedsOf({ ...mesaCardDeps(ctx), chatter: undefined }, MESA_TEAM_ID, new Date(), personToken).openNeeds.some((open) => open.requester.token === personToken);

  const waiting = new Set<string>();
  let waitingTimer: ReturnType<typeof setInterval> | null = null;

  const beginMesaRound = (model: AgentModel, personToken: string): boolean => {
    const mesaRound = startMesaRound(ctx, model, personToken);
    if (mesaRound) void mesaRound.done.catch((failure: unknown) => console.error('La ronda de la mesa pública falló.', failure));
    return mesaRound !== null;
  };

  const startWaiting = (model: AgentModel): void => {
    try {
      if (ctx.agents.latestRound(MESA_TEAM_ID)?.status === 'en_curso') return;
      const next = [...waiting].find(hasOpenNeed);
      waiting.clear();
      if (next) beginMesaRound(model, next);
    } catch (failure) {
      waiting.clear();
      console.error('No se pudo iniciar la ronda pendiente de la mesa pública.', failure);
    }
    if (waiting.size === 0 && waitingTimer) {
      clearInterval(waitingTimer);
      waitingTimer = null;
    }
  };

  const startRounds = (personToken: string): boolean => {
    const { model } = ctx;
    if (!model) return false;
    if (inMesa(personToken)) {
      if (beginMesaRound(model, personToken)) return true;
      waiting.add(personToken);
      if (!waitingTimer) {
        waitingTimer = setInterval(() => startWaiting(model), MESA_RETRY_MS);
        waitingTimer.unref();
      }
      return false;
    }
    let started = false;
    for (const team of ctx.teams.teamsOf(personToken)) {
      const round = ctx.agents.startRound(team.id, personToken);
      if (!round) continue;
      void runRound(roundDepsFrom(ctx, model), round);
      started = true;
    }
    return started;
  };

  const reportAnswer = (personToken: string, post: BoardPost, door: Door): void => {
    const sendTextTo = (to: string, body: string) => sendTextThrough(to, body, door);
    const answer = board.answerOf(post.id, new Date());
    if (!answer) return;
    if (answer.status === 'fallida') return sendTextTo(personToken, `Los agentes no pudieron responder. ${answer.problem ?? ''}`.trim());
    if (!answer.text) return sendTextTo(personToken, COPY.nothingKnown);
    const sources = answer.sourceTokens.flatMap((token) => ctx.store.findPerson(token)?.name ?? []);
    sendTextTo(personToken, sources.length > 0 ? `${answer.text}\n\nArmada con lo que ${sources.length === 1 ? 'comparte' : 'comparten'} ${names.format(sources)}.` : answer.text);
  };

  const askQuestion = (person: Person, question: string, door: Door): Promise<void> | null => {
    const team = ctx.teams.teamsOf(person.token).at(-1) ?? (inMesa(person.token) ? { id: MESA_TEAM_ID, name: MESA_NAME } : undefined);
    if (!team) {
      sendTextThrough(person.token, COPY.noTeam, door);
      return null;
    }
    const post = board.createPost({ teamId: team.id, authorToken: person.token, kind: 'pregunta', text: question.slice(0, MAX_POST_LENGTH) });
    const outcome = askTeam({ ...(team.id === MESA_TEAM_ID ? mesaCardDeps(ctx) : cardDepsFrom(ctx)), board, model: ctx.model }, post);
    if (outcome.state !== 'started') {
      sendTextThrough(person.token, `Tu pregunta quedó en el tablero de ${team.name}. Los agentes están ocupados; pídeles la respuesta desde tu página.`, door);
      return null;
    }
    sendTextThrough(person.token, `Le pregunto a los agentes de ${team.name}. Te aviso cuando respondan.`, door);
    return outcome.done.then(() => reportAnswer(person.token, post, door));
  };

  const converse = async (person: Person, message: string, door: Door): Promise<void> => {
    const { model } = ctx;
    const sendText = (personToken: string, body: string) => sendTextThrough(personToken, body, door);
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
    if (intent === 'pregunta') {
      const answered = askQuestion(person, question, door);
      if (answered && door === 'asistente') await settledWithin(answered, ANSWER_WAIT_MS);
      return;
    }

    const now = new Date();
    const statedMood = reading.mood.trim().toLowerCase();
    const earlier = moodToday(person, now);
    const within = (text: string) => [...text.trim()].slice(0, MAX_CHECKIN_TEXT_LENGTH).join('') || null;
    recordCheckin(ctx.store, person.token, { mood: isMood(statedMood) ? statedMood : (earlier ?? UNSTATED_MOOD), blocker: within(reading.blocker), note: within(reading.note) }, now);
    sendText(person.token, [reply || COPY.noted, earlier === null ? todayOf(person, now) : null].filter(Boolean).join('\n'));
    const stated = within(reading.blocker);
    const waitsForPermission = stated !== null && cardFor(cardDepsFrom(ctx), person, new Date()).pendingAsks.some((need) => topicKeyOf(need.topic) === topicKeyOf(stated));
    askPermissions(person.token, door, stated);
    if (stated === null || waitsForPermission || !inMesa(person.token)) return;
    if (hasOpenNeed(person.token)) return sendText(person.token, startRounds(person.token) ? COPY.allowedNow : COPY.allowedLater);
    const lastWeek = new Date(Date.now() - ACTIVE_PROPOSAL_MS).toISOString();
    if (ctx.agents.activeTopicKeys(MESA_TEAM_ID, person.token, lastWeek).has(topicKeyOf(stated))) sendText(person.token, COPY.alreadyProposed);
  };

  const greetUnknown = (phone: string): void => {
    if (!channel) return;
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
      sendTextThrough(person.token, [`Listo, ${person.name}. Soy tu agente en Montu.`, todayOf(person, now), COPY.help].filter(Boolean).join('\n'), 'whatsapp');
      askPermissions(person.token, 'whatsapp');
      return;
    }
    const personToken = links.personOf(phone);
    const person = personToken ? ctx.store.findPerson(personToken) : undefined;
    if (!person) return greetUnknown(phone);
    await converse(person, text, 'whatsapp');
  };

  const press = (personToken: string | undefined, optionId: string, door: Door): void => {
    const sendText = (to: string, body: string) => sendTextThrough(to, body, door);
    const [promptId = '', choice = ''] = optionId.split(':');
    const prompt = links.findPrompt(promptId);
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
    if (!channel) return;
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
    if (message.type === 'interactive' && interactive.type === 'button_reply') return press(links.personOf(phone), textOf(asRecord(interactive.button_reply).id), 'whatsapp');
    const personToken = links.personOf(phone);
    if (personToken) sendTextThrough(personToken, COPY.onlyText, 'whatsapp');
  };

  const bridge: WhatsAppBridge = {
    configured: channel !== null,

    statusOf(personToken) {
      const phone = channel ? links.phoneOf(personToken) : undefined;
      return { configured: channel !== null, linked: phone !== undefined, phoneEnding: phone ? phone.slice(-VISIBLE_PHONE_DIGITS) : null };
    },

    async startLink(personToken) {
      if (!channel) return null;
      const { code, expiresAt } = links.createCode(personToken, new Date());
      const number = await channel.number();
      return { code, expiresAt, url: number ? `https://wa.me/${number}?text=${encodeURIComponent(linkMessage(code))}` : null };
    },

    unlink: (personToken) => links.unlink(personToken),

    accepts: (rawBody, signature) => channel?.isSigned(rawBody, signature) ?? false,

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
        if (proposal.status === 'acordada') sendTextThrough(party.token, `Quedó acordado entre ${everyone}.\n\n${proposal.text}\n\nYa pueden hablar directo.`);
        else if (party.token !== answeredBy) sendTextThrough(party.token, `La propuesta sobre «${proposal.topic}» no salió esta vez.`);
      }
    },

    askPermissions: (personToken) => askPermissions(personToken),

    async say(personToken, text) {
      const person = ctx.store.findPerson(personToken);
      if (!person) return [];
      const before = links.lastMessageId(person.token);
      await converse(person, text, 'asistente');
      return links.messagesAfter(person.token, before).map(viewMessage);
    },

    choose(personToken, optionId) {
      const before = links.lastMessageId(personToken);
      press(personToken, optionId, 'asistente');
      return links.messagesAfter(personToken, before).map(viewMessage);
    },

    inboxOf: (personToken) => ({
      pending: links.openPromptMessages(personToken).map(viewMessage),
      recent: links.recentMessages(personToken, RECENT_MESSAGES).map(viewMessage),
    }),
  };

  return bridge;
}
