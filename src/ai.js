const OpenAI = require("openai");
const { zodTextFormat } = require("openai/helpers/zod");
const { serverPlanSchema } = require("./plan-schema");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function createServerPlan(prompt) {
  const response = await openai.responses.parse({
    model: process.env.OPENAI_MODEL || "gpt-5.5",
    instructions: [
      "Du bist ein erfahrener Discord-Server-Architekt.",
      "Erstelle aus dem Nutzerprompt eine sinnvolle, vollständige Discord-Serverstruktur.",
      "Antworte ausschließlich im vorgegebenen Schema.",
      "Erstelle Rollen, Kategorien und passende Text-/Sprachkanäle.",
      "privateToRoles enthält nur Rollennamen aus roles. Verwende es für sensible Bereiche wie Leitung, Personal, Finanzen und interne Verwaltung.",
      "Erstelle keine Rollen mit Administrator-, ManageGuild-, ManageRoles- oder ManageChannels-Rechten. Der Bot vergibt keine gefährlichen Serverrechte.",
      "Erfinde keine externen Integrationen oder Funktionen, die Discord-Kanäle allein nicht bereitstellen.",
      "Nutze kurze Discord-taugliche Namen, bei Bedarf passende Emojis.",
      "Halte die Struktur übersichtlich und vermeide doppelte Kanäle.",
      "Maximal 15 Rollen, 12 Kategorien und insgesamt 60 Kanäle."
    ].join(" "),
    input: prompt,
    text: { format: zodTextFormat(serverPlanSchema, "discord_server_plan") }
  });

  if (!response.output_parsed) {
    throw new Error("Die KI hat keinen gültigen Serverplan zurückgegeben.");
  }

  const plan = response.output_parsed;
  if (plan.roles.length > 15) throw new Error("Die KI hat zu viele Rollen geplant.");
  if (plan.categories.length > 12) throw new Error("Die KI hat zu viele Kategorien geplant.");
  const totalChannels = plan.categories.reduce((n, c) => n + c.channels.length, 0);
  if (totalChannels > 60) throw new Error("Die KI hat zu viele Kanäle geplant.");
  return plan;
}

module.exports = { createServerPlan };