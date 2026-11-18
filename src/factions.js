const { PermissionFlagsBits, EmbedBuilder } = require("discord.js");

const DEFAULT_FACTIONS = [
  { name: "Polizei", kind: "Staatlich", color: 0x2874A6 },
  { name: "Sheriff", kind: "Staatlich", color: 0x7D6608 },
  { name: "SASP", kind: "Staatlich", color: 0x1F618D },
  { name: "Feuerwehr", kind: "Staatlich", color: 0xC0392B },
  { name: "Rettungsdienst", kind: "Staatlich", color: 0x16A085 },
  { name: "Justiz", kind: "Staatlich", color: 0x6C3483 },
  { name: "Regierung", kind: "Staatlich", color: 0x566573 },
  { name: "Mechaniker", kind: "Zivil", color: 0xD35400 },
  { name: "Taxi", kind: "Zivil", color: 0xD4AC0D },
  { name: "News", kind: "Zivil", color: 0x2E86C1 },
  { name: "Families", kind: "Illegal", color: 0x922B21 },
  { name: "Ballas", kind: "Illegal", color: 0x8E44AD },
  { name: "Vagos", kind: "Illegal", color: 0xF1C40F },
  { name: "Lost MC", kind: "Illegal", color: 0x424949 }
];

function getFactionDefinitions(guild = null) {
  let configured = DEFAULT_FACTIONS;
  try {
    const value = JSON.parse(process.env.FACTIONS_CONFIG || "null");
    if (Array.isArray(value) && value.length) configured = value;
  } catch (error) {
    console.warn("[FACTIONS] FACTIONS_CONFIG ist ungültiges JSON; Standardliste wird verwendet.");
  }
  const dynamic = guild ? guild.roles.cache
    .filter(role => role.name.startsWith("🏛️ | "))
    .map(role => ({ name: role.name.slice("🏛️ | ".length), roleName: role.name, kind: "Benutzerdefiniert", color: role.hexColor })) : [];
  const names = new Set(configured.map(item => item.name.toLowerCase()));
  return [...configured, ...dynamic.filter(item => !names.has(item.name.toLowerCase()))];
}
function roleNameFor(faction) { return faction.roleName || faction.name; }

function canManageFactions(member) {
  return Boolean(member && (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageRoles) ||
    member.roles.cache.some(role => ["Owner", "Management", "Projektleitung", "Fraktionsleitung"].includes(role.name))
  ));
}

async function ensureFactionRoles(guild) {
  await guild.roles.fetch();
  const definitions = getFactionDefinitions(guild);
  const result = [];
  for (const faction of definitions) {
    let role = guild.roles.cache.find(item => item.name.toLowerCase() === roleNameFor(faction).toLowerCase());
    if (!role) {
      role = await guild.roles.create({
        name: faction.name,
        colors: { primaryColor: Number(faction.color) || 0x5865f2 },
        hoist: true,
        mentionable: false,
        reason: "Fraktionssystem: Fraktionsrolle anlegen"
      });
    }
    result.push({ ...faction, role });
  }
  return result;
}

async function getFactionOverview(guild) {
  await guild.roles.fetch();
  try { await guild.members.fetch(); } catch (error) { console.warn("[FACTIONS] Mitgliederliste nicht vollständig abrufbar. ENABLE_GUILD_MEMBERS prüfen:", error.message); }
  const rows = [];
  for (const faction of definitions) {
    const role = guild.roles.cache.find(item => item.name.toLowerCase() === roleNameFor(faction).toLowerCase());
    rows.push({
      name: faction.name,
      kind: faction.kind || "Weitere",
      roleId: role?.id || null,
      count: role?.members?.size || 0,
      members: role ? [...role.members.values()].map(member => ({
        id: member.id, tag: member.user.tag, displayName: member.displayName
      })) : []
    });
  }
  return rows;
}

async function handleFactionCommand(interaction) {
  const sub = interaction.options.getSubcommand();
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (sub === "anmelden") {
    const factionName = interaction.options.getString("fraktion", true);
    const definition = getFactionDefinitions(interaction.guild).find(item => item.name.toLowerCase() === factionName.toLowerCase());
    if (!definition) return interaction.editReply("Diese Fraktion gibt es nicht. Nutze /fraktion liste.");
    const factions = await ensureFactionRoles(interaction.guild);
    const selected = factions.find(item => item.name.toLowerCase() === definition.name.toLowerCase());
    const current = member.roles.cache.filter(role =>
      getFactionDefinitions(interaction.guild).some(item => roleNameFor(item).toLowerCase() === role.name.toLowerCase()) && role.id !== selected.role.id
    );
    if (current.size) await member.roles.remove([...current.values()], "Wechsel der Fraktion");
    if (!member.roles.cache.has(selected.role.id)) await member.roles.add(selected.role, "Fraktionsanmeldung");
    return interaction.editReply("✅ Du bist jetzt bei **" + selected.name + "** angemeldet.");
  }
  if (sub === "abmelden") {
    const current = member.roles.cache.filter(role =>
      getFactionDefinitions(interaction.guild).some(item => roleNameFor(item).toLowerCase() === role.name.toLowerCase())
    );
    if (!current.size) return interaction.editReply("Du bist aktuell bei keiner Fraktion angemeldet.");
    await member.roles.remove([...current.values()], "Fraktionsabmeldung");
    return interaction.editReply("✅ Du wurdest aus deiner Fraktion abgemeldet.");
  }
  if (sub === "liste") {
    const rows = await getFactionOverview(interaction.guild);
    const embed = new EmbedBuilder().setColor(0x5865f2).setTitle("🏛️ Fraktionsübersicht")
      .setDescription(rows.map(item => {
        const count = item.count;
        return "**" + item.name + "** · " + item.kind + " · " + count + " Mitglied(er)";
      }).join("\n").slice(0, 4000))
      .setFooter({ text: "Mitgliederzahlen basieren auf dem aktuell geladenen Discord-Mitglieder-Cache." });
    return interaction.editReply({ embeds: [embed] });
  }
  if (sub === "erstellen" || sub === "entfernen") {
    if (!canManageFactions(member)) return interaction.editReply("Du brauchst Administrator-, Rollen-verwalten- oder Fraktionsleitungsrechte.");
    const name = interaction.options.getString("name", true).trim();
    if (!/^[\\p{L}\\p{N} _-]{2,50}$/u.test(name)) return interaction.editReply("Der Fraktionsname darf 2–50 Zeichen haben und nur Buchstaben, Zahlen, Leerzeichen, _ oder - enthalten.");
    await interaction.guild.roles.fetch();
    const factionRoleName = "🏛️ | " + name;\n    const existing = interaction.guild.roles.cache.find(role => role.name.toLowerCase() === factionRoleName.toLowerCase());
    if (sub === "erstellen") {
      if (existing) return interaction.editReply("Diese Fraktionsrolle existiert bereits.");
      const role = await interaction.guild.roles.create({ name: factionRoleName, hoist: true, mentionable: false, reason: "Neue Fraktion durch " + interaction.user.tag });
      return interaction.editReply("✅ Fraktion **" + name + "** wurde erstellt (Rolle " + role + ").");
    }
    if (!existing) return interaction.editReply("Diese Fraktionsrolle wurde nicht gefunden.");
    if (getFactionDefinitions(interaction.guild).some(item => item.name.toLowerCase() === name.toLowerCase() && !item.roleName)) {
      return interaction.editReply("Die Standardfraktionen können nicht über diesen Befehl gelöscht werden. Passe FACTIONS_CONFIG an.");
    }
    await existing.delete("Fraktion entfernt durch " + interaction.user.tag);
    return interaction.editReply("Fraktion **" + name + "** wurde entfernt.");
  }
}

module.exports = {
  DEFAULT_FACTIONS, getFactionDefinitions, canManageFactions,
  ensureFactionRoles, getFactionOverview, handleFactionCommand, roleNameFor
};
