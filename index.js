const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes,
  MessageFlags
} = require("discord.js");
const axios = require("axios");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const API_URL = process.env.API_URL;
const API_KEY = process.env.API_KEY;
const SALON_ID = process.env.SALON_ID;
const OWNER_ID = process.env.OWNER_ID;
const SERVER_SOFTWARE = process.env.SERVER_SOFTWARE || "Paper";
const SERVEUR_SORTI = false; // Passe à true quand le serveur sera sorti

let panelMessage = null;

async function envoyerMessageSalon(texte) {
  if (!SALON_ID) return;
  try {
    const salon = await client.channels.fetch(SALON_ID);
    if (salon && salon.isTextBased()) {
      await salon.send(texte);
    }
  } catch (err) {
    console.error("Erreur salon :", err.message);
  }
}

async function lireEtatServeur() {
  if (!API_URL || !API_KEY) {
    return { online: false, joueurs: 0, logiciel: SERVER_SOFTWARE };
  }

  try {
    const res = await axios.get(API_URL, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      timeout: 15000
    });

    const d = res.data || {};
    const online =
      Boolean(d.online) ||
      ["online", "running", "up"].includes(String(d.status || d.state || "").toLowerCase());
    const joueurs = Number(d.players ?? d.onlinePlayers ?? 0) || 0;
    const logiciel = d.software || d.type || SERVER_SOFTWARE;

    return { online, joueurs, logiciel };
  } catch (err) {
    console.error("Erreur lecture API :", err.message);
    return { online: false, joueurs: 0, logiciel: SERVER_SOFTWARE };
  }
}

async function envoyerAction(action) {
  if (!API_URL || !API_KEY) return "API_URL ou API_KEY manquante.";

  try {
    const res = await axios.post(
      API_URL,
      { action },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 15000
      }
    );
    return `Action **${action}** envoyée (HTTP ${res.status}).`;
  } catch (err) {
    return `Échec **${action}** (${err.response ? err.response.status : "sans réponse"}).`;
  }
}

async function afficherPanel(salon) {
  const infos = await lireEtatServeur();

  const embed = new EmbedBuilder()
    .setTitle("📊 Panel Serveur")
    .setColor(infos.online ? 0x2ecc71 : 0xe74c3c)
    .addFields(
      { name: "État", value: infos.online ? "🟢 Online" : "🔴 Offline", inline: true },
      { name: "Joueurs", value: `${infos.joueurs}`, inline: true },
      { name: "Logiciel", value: `${infos.logiciel}`, inline: true },
      {
        name: "IP",
        value: SERVEUR_SORTI ? "Serveur en ligne" : "🔒 Pas encore disponible (serveur pas encore sorti)",
        inline: false
      }
    )
    .setTimestamp();

  const boutons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("start").setLabel("Start").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("stop").setLabel("Stop").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("restart").setLabel("Restart").setStyle(ButtonStyle.Primary)
  );

  if (salon) {
    panelMessage = await salon.send({ embeds: [embed], components: [boutons] });
  } else if (panelMessage) {
    await panelMessage.edit({ embeds: [embed], components: [boutons] });
  } else if (SALON_ID) {
    const s = await client.channels.fetch(SALON_ID).catch(() => null);
    if (s && s.isTextBased()) {
      panelMessage = await s.send({ embeds: [embed], components: [boutons] });
    }
  }
}

client.once("ready", async () => {
  console.log(`Bot connecté en tant que ${client.user.tag}`);

  const commandes = [
    new SlashCommandBuilder().setName("panel").setDescription("Affiche le panel du serveur").toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commandes });

  await afficherPanel();

  // Mise à jour du panel toutes les 60 secondes
  setInterval(() => afficherPanel(), 60 * 1000);

  // Cycle de 4 heures
  const QUATRE_HEURES = 4 * 60 * 60 * 1000;
  setInterval(async () => {
    console.log("Déclenchement du cycle de 4 heures...");
    const msg = await envoyerAction("restart");
    await envoyerMessageSalon(msg);
  }, QUATRE_HEURES);
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === "panel") {
    if (OWNER_ID && interaction.user.id !== OWNER_ID) {
      await interaction.reply({ content: "Accès refusé.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await afficherPanel(interaction.channel);
    await interaction.editReply("Panel envoyé.");
    return;
  }

  if (interaction.isButton()) {
    if (!["start", "stop", "restart"].includes(interaction.customId)) return;

    if (OWNER_ID && interaction.user.id !== OWNER_ID) {
      await interaction.reply({ content: "Tu n'as pas accès à ces boutons.", flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const resultat = await envoyerAction(interaction.customId);
    await interaction.editReply(resultat);
    setTimeout(() => afficherPanel(), 2000);
  }
});

if (!DISCORD_TOKEN) {
  console.error("ERREUR : La variable DISCORD_TOKEN est introuvable.");
  process.exit(1);
}

client.login(DISCORD_TOKEN);
