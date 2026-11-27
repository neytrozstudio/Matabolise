const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const API_URL = process.env.API_URL;
const API_KEY = process.env.API_KEY;
const SALON_ID = process.env.SALON_ID; // Optionnel : ID d'un salon Discord pour les messages

async function envoyerMessageSalon(texte) {
  if (!SALON_ID) return;
  try {
    const salon = await client.channels.fetch(SALON_ID);
    if (salon && salon.isTextBased()) {
      await salon.send(texte);
    }
  } catch (err) {
    console.error("Impossible d'envoyer le message dans le salon :", err.message);
  }
}

async function relancerServeur() {
  if (!API_URL || !API_KEY) {
    console.log("API_URL ou API_KEY manquante dans les variables d'environnement.");
    return;
  }

  try {
    const reponse = await axios.post(
      API_URL,
      {},
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 15000
      }
    );

    console.log("Appel API réussi. Statut :", reponse.status);
    await envoyerMessageSalon(`Demande de démarrage envoyée à l'API (statut HTTP : ${reponse.status}).`);
  } catch (erreur) {
    const codeStatut = erreur.response ? erreur.response.status : "sans réponse";
    console.error("Erreur lors de l'appel API :", codeStatut, erreur.message);
    await envoyerMessageSalon(`Échec de l'appel API (statut : ${codeStatut}).`);
  }
}

client.once("ready", () => {
  console.log(`Bot connecté en tant que ${client.user.tag}`);

  // 4 heures en millisecondes : 4h * 60m * 60s * 1000ms = 14 400 000 ms
  const QUATRE_HEURES = 4 * 60 * 60 * 1000;

  setInterval(() => {
    console.log("Déclenchement du cycle de 4 heures...");
    relancerServeur();
  }, QUATRE_HEURES);
});

if (!DISCORD_TOKEN) {
  console.error("ERREUR : La variable DISCORD_TOKEN est introuvable.");
  process.exit(1);
}

client.login(DISCORD_TOKEN);
