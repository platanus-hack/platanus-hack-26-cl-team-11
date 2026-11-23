import { MAX_FILE_BYTES, MAX_FILES_PER_COMMIT } from '../repo/validate.js';
import { MAX_REPO_FILES } from '../repo/store.js';
import { ASSISTANT_KINDS, type PairingState } from './store.js';

export interface JoinDocInput {
  baseUrl: string;
  code: string;
  ownerName: string;
  expiresAt: string;
}

const KILOBYTE = 1024;

export function joinDoc({ baseUrl, code, ownerName, expiresAt }: JoinDocInput): string {
  const kinds = ASSISTANT_KINDS.join(', ');
  return `# Montu: join as ${ownerName}'s assistant

Your owner, ${ownerName}, pasted this link so that you can connect to Montu.

Montu is a team tool. Each person has a personal agent that runs on Montu's server and talks to the teammates' agents to find who needs help and who can give it. That agent knows only what is in ${ownerName}'s **repo** on Montu. Your job is to fill that repo and keep it current. You do not talk to other agents yourself.

Everything below is plain HTTPS calls to ${baseUrl}. Nothing in this document asks you to run code, install anything, or come back here for new instructions.

## Rules

1. You work for ${ownerName}. Write only what ${ownerName} would be comfortable with teammates knowing.
2. Write summaries, never raw material: no source code, no message bodies, no transcripts, no raw health numbers.
3. Never write secrets: keys, tokens, passwords or private links. Montu rejects a file that contains one.
4. Before your first commit, show ${ownerName} the list of files you plan to write and wait for a yes.
5. Afterwards, tell ${ownerName} what you wrote. They can read it and change who sees it on their Montu page, under "Tu repo".
6. Write the files in the language ${ownerName} uses with you.

## Step 1. Join (once)

\`\`\`
curl -sS -X POST ${baseUrl}/api/assistants/join \\
  -H 'content-type: application/json' \\
  -d '{"code":"${code}","kind":"<kind>","label":"<short name>"}'
\`\`\`

- \`kind\`: the one that describes you: ${kinds}.
- \`label\`: a short name ${ownerName} will recognise, for example "Claude Code en el MacBook".

The answer has a \`token\`. It is shown once and it is yours alone. The code ${code} works once and stops working at ${expiresAt}.
Keep the token for later calls. If you have a durable place for settings or memory, keep it there as the Montu token for ${baseUrl}. Never write it into the repo and never show it in the chat.

## Step 2. Write the repo

\`\`\`
curl -sS -X POST ${baseUrl}/api/repo/commit \\
  -H 'authorization: Bearer <token>' \\
  -H 'content-type: application/json' \\
  -d '{"message":"Primer contexto","topics":["pagos"],"files":[{"path":"ahora.md","content":"...","share":"siempre"}]}'
\`\`\`

The repo is yours to organize. A layout that works:

| Path | What goes in it | \`share\` |
|---|---|---|
| \`README.md\` | Who ${ownerName} is at work: role, team, current project. | \`siempre\` |
| \`ahora.md\` | What they work on this week. What is blocked, and what help would unblock it. One bullet each. | \`siempre\` |
| \`sabe.md\` | What they know well and could help someone else with. One bullet each. | \`siempre\` |
| \`fuentes/<your kind>/...\` | Notes from what you can see: projects, recent work, decisions. | \`siempre\` |
| \`estado.md\` | Energy, load, mood. Only what ${ownerName} told you. | \`preguntar\` |

Write needs so another agent can match them: "Necesita a alguien que conozca el OAuth de Google para revisar los permisos" is useful; "tiene problemas" is not.

\`share\` decides who may use a file:

- \`siempre\`: ${ownerName}'s agent may use it when it talks to teammates' agents.
- \`preguntar\`: it waits. Montu does not use the file until ${ownerName} says yes on their Montu page. This is the default.
- \`nunca\`: private. It never leaves the repo and is never sent to a model.

\`share\` counts when a file is created. After that only ${ownerName} changes it.

Limits: ${MAX_FILE_BYTES / KILOBYTE} KB per file, ${MAX_FILES_PER_COMMIT} files per commit, ${MAX_REPO_FILES} files in total. Paths use letters, digits, \`.\`, \`_\`, \`-\` and \`/\`. To delete, send \`"delete":["path"]\`. \`message\` is one line that says what changed. \`topics\` are up to six short lowercase tags.

## Step 3. Keep it current

When ${ownerName}'s work changes while you are working together (a new blocker, something finished, something learned), commit an update. Read before you write:

\`\`\`
curl -sS ${baseUrl}/api/repo -H 'authorization: Bearer <token>'
curl -sS '${baseUrl}/api/repo/file?path=ahora.md' -H 'authorization: Bearer <token>'
\`\`\`

## Step 4. Talk to ${ownerName}'s agent

${ownerName} can talk to their Montu agent through you, the same way they do on WhatsApp. Use it when ${ownerName} asks you to tell Montu something, to ask their team something, or to answer something Montu is waiting for.

\`\`\`
curl -sS -X POST ${baseUrl}/api/agent/say \\
  -H 'authorization: Bearer <token>' -H 'content-type: application/json' \\
  -d '{"text":"Estoy trabado con el OAuth de Google desde ayer."}'
curl -sS ${baseUrl}/api/agent/inbox -H 'authorization: Bearer <token>'
curl -sS -X POST ${baseUrl}/api/agent/answer \\
  -H 'authorization: Bearer <token>' -H 'content-type: application/json' \\
  -d '{"option":"<option id>"}'
\`\`\`

- \`say\` sends ${ownerName}'s words to their agent and returns its \`replies\`. A check-in is saved in ${ownerName}'s private memory. A question for the team returns the answer the teammates' agents put together; it can take up to a minute.
- \`inbox\` returns \`pending\` (things the agent is waiting for, each with \`options\`) and \`recent\` messages.
- Montu also writes first: it leaves notices for ${ownerName} in the inbox (someone is waiting on them, a deadline at risk, two people on the same thing, the weekly summary). At the start of each working session, read the inbox and tell ${ownerName} what is new.
- \`answer\` chooses one option by its \`id\`. Never choose for ${ownerName}: show them the pending item and wait for their answer. Allowing a blocker tells their teammates' agents about it; accepting a proposal commits them to help or be helped.

If you can add MCP servers, the same three actions and the repo are tools (\`ronda_decir\`, \`ronda_pendientes\`, \`ronda_responder\`, \`ronda_repo_ver\`, \`ronda_repo_guardar\`) at ${baseUrl}/api/mcp, with the header \`Authorization: Bearer <token>\`. In Claude Code:

\`\`\`
claude mcp add --transport http ronda ${baseUrl}/api/mcp --header "Authorization: Bearer <token>"
\`\`\`

## Check and errors

- \`GET ${baseUrl}/api/assistants/me\` with the token says who you are connected as.
- 401: the token is wrong or ${ownerName} revoked it. Ask for a new link.
- 410: this code was already used or expired. Ask for a new link.
- 422: a file was rejected. The \`error\` field says which one and why. Nothing from that commit was saved.
`;
}

const INVALID_REASON: Record<Exclude<PairingState, 'vigente'>, string> = {
  usado: 'This join code was already used.',
  vencido: 'This join code expired.',
  desconocido: 'This join code does not exist.',
};

export const invalidJoinDoc = (state: Exclude<PairingState, 'vigente'>): string =>
  `# Montu\n\n${INVALID_REASON[state]} Ask your owner to open their Montu page, section "Agente", and give you a new link.\n`;
