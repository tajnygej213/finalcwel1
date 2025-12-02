require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags,
} = require("discord.js");
const nodemailer = require("nodemailer");
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const REDEEM_CODES_FILE = "redeem_codes.json";

const pool = process.env.RAILWAY_DATABASE_URL 
  ? new Pool({
      connectionString: process.env.RAILWAY_DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    })
  : null;

async function initDatabase() {
  if (!pool) {
    console.log("⚠️ Brak RAILWAY_DATABASE_URL - kody będą zapisywane lokalnie w pliku JSON");
    return;
  }
  
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS redeem_codes (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        code_type VARCHAR(20) NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        used_by VARCHAR(50),
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Tabela redeem_codes gotowa w Railway");
  } catch (err) {
    console.error("❌ Błąd tworzenia tabeli w Railway:", err);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const CHANNEL_NAME = "generator";
const LINK_CHANNEL_NAME = "link-na-url";
const TEMPLATE_STOCKX = "stockx_new.html";
const LIMITS_FILE = "user_limits.json";
const ACCESS_FILE = "user_access.json";
const FORM_TRACKER_FILE = "form_tracker.json";
const EMAILS_FILE = "user_emails.json";
const SETTINGS_FILE = "user_settings.json";

const TEMPLATE_CONFIG = {
  stockx: {
    file: "stockx_new.html",
    needsStyleId: true,
    needsColour: false,
    needsTaxes: false,
    needsReference: false,
    needsFirstName: false,
    needsWholeName: false,
    needsCurrency: true,
  },
  apple: {
    file: "apple.html",
    needsStyleId: false,
    needsColour: false,
    needsTaxes: false,
    needsReference: false,
    needsFirstName: false,
    needsWholeName: false,
    needsQuantity: true,
    needsShippingAddress: true,
    needsCurrency: true,
  },
  balenciaga: {
    file: "balenciaga.html",
    needsStyleId: false,
    needsColour: true,
    needsTaxes: false,
    needsReference: false,
    needsFirstName: true,
    needsWholeName: false,
    needsCurrency: true,
  },
  bape: {
    file: "bape.html",
    needsStyleId: true,
    needsColour: false,
    needsTaxes: true,
    needsReference: false,
    needsFirstName: false,
    needsWholeName: false,
    needsCurrency: true,
    needsModal3: true,
  },
  dior: {
    file: "dior.html",
    needsStyleId: false,
    needsColour: false,
    needsTaxes: true,
    needsReference: false,
    needsFirstName: false,
    needsWholeName: false,
    needsCurrency: true,
  },
  lv: {
    file: "lv.html",
    needsStyleId: false,
    needsColour: false,
    needsTaxes: false,
    needsReference: true,
    needsFirstName: false,
    needsWholeName: false,
    needsPhoneNumber: false,
    needsCurrency: true,
  },
  moncler: {
    file: "moncler.html",
    needsStyleId: false,
    needsColour: true,
    needsTaxes: false,
    needsReference: false,
    needsFirstName: false,
    needsWholeName: false,
    needsEstimatedDelivery: true,
    needsCardEnd: true,
    needsModal3: true,
  },
  nike: {
    file: "nike.html",
    needsStyleId: false,
    needsColour: false,
    needsTaxes: false,
    needsReference: false,
    needsFirstName: false,
    needsWholeName: false,
    needsCurrency: true,
    needsCardEnd: true,
  },
  stussy: {
    file: "stussy.html",
    needsStyleId: true,
    needsColour: false,
    needsTaxes: true,
    needsReference: false,
    needsFirstName: false,
    needsWholeName: false,
    needsCurrency: true,
  },
  trapstar: {
    file: "trapstar.html",
    needsStyleId: true,
    needsColour: false,
    needsTaxes: false,
    needsReference: false,
    needsFirstName: false,
    needsWholeName: false,
    needsCurrency: true,
  },
  notino: {
    file: "notino.html",
    needsStyleId: false,
    needsColour: false,
    needsTaxes: false,
    needsReference: false,
    needsFirstName: false,
    needsWholeName: false,
    needsDiscount: true,
    needsShippingPrice: true,
    needsCurrency: true,
  },
  zalando: {
    file: "zalando.html",
    needsStyleId: false,
    needsColour: true,
    needsTaxes: true,
    needsReference: false,
    needsFirstName: false,
    needsWholeName: true,
    needsSize: true,
    needsQuantity: true,
    needsEstimatedDelivery: true,
    needsCurrency: true,
  },
  mediaexpert: {
    file: "media_expert.html",
    needsStyleId: false,
    needsColour: false,
    needsTaxes: true,
    needsReference: false,
    needsFirstName: false,
    needsWholeName: true,
    needsEstimatedDelivery: true,
    needsModal3: true,
    needsCurrency: true,
  },
  grailpoint: {
    file: "grail_point.html",
    needsStyleId: false,
    needsColour: false,
    needsTaxes: false,
    needsReference: false,
    needsFirstName: false,
    needsWholeName: true,
    needsSize: true,
    needsQuantity: false,
    needsShipping: true,
    needsStreet: true,
    needsPostalCode: true,
    needsCity: true,
    needsPhoneNumber: true,
    needsModal3: true,
    needsCurrency: true,
  },
};

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com", // zamiast process.env.EMAIL_HOST
  port: 587, // zamiast process.env.EMAIL_PORT
  secure: false, // 465 = true, 587 = false
  auth: {
    user: "doxyii00@gmail.com", // zamiast process.env.EMAIL_USER
    pass: "xwxg kpee dgnq ihes", // zamiast process.env.EMAIL_PASS (App Password)
  },
  logger: true,
  debug: true,
});

const readTpl = (name) => fs.readFileSync(path.join(__dirname, name), "utf8");
const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const loadLimits = () => {
  try {
    if (fs.existsSync(LIMITS_FILE)) {
      return JSON.parse(fs.readFileSync(LIMITS_FILE, "utf8"));
    }
  } catch (e) {
    console.error("Błąd wczytywania limitów:", e);
  }
  return {};
};

const saveLimits = (limits) => {
  try {
    fs.writeFileSync(LIMITS_FILE, JSON.stringify(limits, null, 2));
  } catch (e) {
    console.error("Błąd zapisywania limitów:", e);
  }
};

const getUserLimit = (userId) => {
  const limits = loadLimits();
  return limits[userId] !== undefined ? limits[userId] : 0;
};

const setUserLimit = (userId, limit) => {
  const limits = loadLimits();
  limits[userId] = limit;
  saveLimits(limits);
};

const decreaseUserLimit = (userId) => {
  const limits = loadLimits();
  if (limits[userId] !== undefined) {
    if (limits[userId] > 0) {
      limits[userId]--;
      saveLimits(limits);
    }
    return limits[userId];
  }
  return 0;
};

const loadAccess = () => {
  try {
    if (fs.existsSync(ACCESS_FILE)) {
      return JSON.parse(fs.readFileSync(ACCESS_FILE, "utf8"));
    }
  } catch (e) {
    console.error("Błąd wczytywania dostępu:", e);
  }
  return {};
};

const saveAccess = (access) => {
  try {
    fs.writeFileSync(ACCESS_FILE, JSON.stringify(access, null, 2));
  } catch (e) {
    console.error("Błąd zapisywania dostępu:", e);
  }
};

const setUserAccess = (userId, days) => {
  const access = loadAccess();
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  access[userId] = expiryDate.toISOString();
  saveAccess(access);
  return expiryDate;
};

const checkUserAccess = (userId) => {
  const access = loadAccess();
  if (!access[userId]) {
    return { hasAccess: false, noAccess: true };
  }
  const expiryDate = new Date(access[userId]);
  const now = new Date();
  if (now > expiryDate) {
    return { hasAccess: false, expired: true, expiryDate };
  }
  return { hasAccess: true, unlimited: true, expiryDate };
};

const loadFormTracker = () => {
  try {
    if (fs.existsSync(FORM_TRACKER_FILE)) {
      return JSON.parse(fs.readFileSync(FORM_TRACKER_FILE, "utf8"));
    }
  } catch (e) {
    console.error("Błąd wczytywania trackera formularzy:", e);
  }
  return {};
};

const saveFormTracker = (tracker) => {
  try {
    fs.writeFileSync(FORM_TRACKER_FILE, JSON.stringify(tracker, null, 2));
  } catch (e) {
    console.error("Błąd zapisywania trackera formularzy:", e);
  }
};

const loadEmails = () => {
  try {
    if (fs.existsSync(EMAILS_FILE)) {
      return JSON.parse(fs.readFileSync(EMAILS_FILE, "utf8"));
    }
  } catch (e) {
    console.error("Błąd wczytywania emaili:", e);
  }
  return {};
};

const saveEmails = (emails) => {
  try {
    fs.writeFileSync(EMAILS_FILE, JSON.stringify(emails, null, 2));
  } catch (e) {
    console.error("Błąd zapisywania emaili:", e);
  }
};

const getUserEmail = (userId) => {
  const emails = loadEmails();
  return emails[userId] || null;
};

const setUserEmail = (userId, email) => {
  const emails = loadEmails();
  emails[userId] = email;
  saveEmails(emails);
};

const loadSettings = () => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
    }
  } catch (e) {
    console.error("Błąd wczytywania ustawień:", e);
  }
  return {};
};

const saveSettings = (settings) => {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (e) {
    console.error("Błąd zapisywania ustawień:", e);
  }
};

const setUserSettings = (userId, settings) => {
  const allSettings = loadSettings();
  allSettings[userId] = settings;
  saveSettings(allSettings);
};

const getUserSettings = (userId) => {
  const allSettings = loadSettings();
  return allSettings[userId] || null;
};

const loadRedeemCodesLocal = () => {
  try {
    if (fs.existsSync(REDEEM_CODES_FILE)) {
      return JSON.parse(fs.readFileSync(REDEEM_CODES_FILE, "utf8"));
    }
  } catch (e) {
    console.error("Blad wczytywania kodow:", e);
  }
  return { codes: [] };
};

const saveRedeemCodesLocal = (data) => {
  try {
    fs.writeFileSync(REDEEM_CODES_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Blad zapisywania kodow:", e);
  }
};

const loadRedeemCodesDB = async () => {
  if (!pool) return loadRedeemCodesLocal();
  
  try {
    const result = await pool.query("SELECT * FROM redeem_codes ORDER BY created_at DESC");
    return {
      codes: result.rows.map(row => ({
        code: row.code,
        codeType: row.code_type,
        used: row.used,
        usedBy: row.used_by,
        usedAt: row.used_at ? row.used_at.toISOString() : null,
        createdAt: row.created_at ? row.created_at.toISOString() : null
      }))
    };
  } catch (e) {
    console.error("Blad wczytywania kodow z Railway:", e);
    return loadRedeemCodesLocal();
  }
};

const saveCodeToDB = async (code, codeType) => {
  if (!pool) {
    const data = loadRedeemCodesLocal();
    data.codes.push({ code, codeType, used: false });
    saveRedeemCodesLocal(data);
    return;
  }
  
  try {
    await pool.query(
      "INSERT INTO redeem_codes (code, code_type) VALUES ($1, $2)",
      [code, codeType]
    );
    console.log(`✅ Kod ${code} zapisany do Railway`);
  } catch (e) {
    console.error("Blad zapisywania kodu do Railway:", e);
    const data = loadRedeemCodesLocal();
    data.codes.push({ code, codeType, used: false });
    saveRedeemCodesLocal(data);
  }
};

const generateCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const parts = [];
  for (let i = 0; i < 4; i++) {
    let part = "";
    for (let j = 0; j < 4; j++) {
      part += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    parts.push(part);
  }
  return parts.join("-");
};

const redeemCode = async (code, userId) => {
  if (!pool) {
    const data = loadRedeemCodesLocal();
    const codeEntry = data.codes.find(c => c.code === code && !c.used);
    
    if (!codeEntry) {
      return { success: false, message: "Kod jest nieprawidlowy lub juz zostal uzyty." };
    }
    
    codeEntry.used = true;
    codeEntry.usedBy = userId;
    codeEntry.usedAt = new Date().toISOString();
    saveRedeemCodesLocal(data);
    
    if (codeEntry.codeType === "lifetime") {
      setUserAccess(userId, 36500);
      return { success: true, message: "Aktywowano dostep LIFETIME (100 lat)!", type: "lifetime" };
    } else if (codeEntry.codeType === "31days") {
      setUserAccess(userId, 31);
      return { success: true, message: "Aktywowano dostep na 31 dni!", type: "31days" };
    }
    
    return { success: false, message: "Nieznany typ kodu." };
  }
  
  try {
    const result = await pool.query(
      "SELECT * FROM redeem_codes WHERE code = $1 AND used = FALSE",
      [code]
    );
    
    if (result.rows.length === 0) {
      return { success: false, message: "Kod jest nieprawidlowy lub juz zostal uzyty." };
    }
    
    const codeEntry = result.rows[0];
    
    await pool.query(
      "UPDATE redeem_codes SET used = TRUE, used_by = $1, used_at = NOW() WHERE code = $2",
      [userId, code]
    );
    
    if (codeEntry.code_type === "lifetime") {
      setUserAccess(userId, 36500);
      return { success: true, message: "Aktywowano dostep LIFETIME (100 lat)!", type: "lifetime" };
    } else if (codeEntry.code_type === "31days") {
      setUserAccess(userId, 31);
      return { success: true, message: "Aktywowano dostep na 31 dni!", type: "31days" };
    }
    
    return { success: false, message: "Nieznany typ kodu." };
  } catch (e) {
    console.error("Blad realizacji kodu w Railway:", e);
    return { success: false, message: "Wystapil blad podczas realizacji kodu." };
  }
};

const commands = [
  new SlashCommandBuilder()
    .setName("setlimit")
    .setDescription("Ustaw limit użyć formularza dla użytkownika (tylko admin)")
    .addUserOption((option) =>
      option
        .setName("użytkownik")
        .setDescription("Użytkownik dla którego ustawiasz limit")
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("liczba")
        .setDescription("Liczba dozwolonych użyć (0 = brak dostępu)")
        .setRequired(true)
        .setMinValue(0),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("removeallaccess")
    .setDescription(
      "Usuń dostęp czasowy dla wszystkich użytkowników na serwerze (tylko admin)",
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("checklimit")
    .setDescription("Sprawdź limit użyć formularza")
    .addUserOption((option) =>
      option
        .setName("użytkownik")
        .setDescription(
          "Użytkownik którego limit chcesz sprawdzić (tylko admin)",
        )
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName("grantaccess")
    .setDescription(
      "Daj użytkownikowi dostęp do formularza na określoną liczbę dni (tylko admin)",
    )
    .addUserOption((option) =>
      option
        .setName("użytkownik")
        .setDescription("Użytkownik któremu dajesz dostęp")
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("dni")
        .setDescription("Liczba dni dostępu")
        .setRequired(true)
        .setMinValue(1),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("checkaccess")
    .setDescription("Sprawdź ile dni dostępu do formularza zostało")
    .addUserOption((option) =>
      option
        .setName("użytkownik")
        .setDescription(
          "Użytkownik którego dostęp chcesz sprawdzić (tylko admin)",
        )
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName("redeem")
    .setDescription("Aktywuj kod dostępu")
    .addStringOption((option) =>
      option
        .setName("kod")
        .setDescription("Kod do aktywacji (format: XXXX-XXXX-XXXX-XXXX)")
        .setRequired(true),
    ),
].map((command) => command.toJSON());

async function registerSlashCommands() {
  try {
    const guild = client.guilds.cache.first();
    if (!guild) {
      console.log("⚠️ Bot nie jest na serwerze");
      return;
    }

    console.log("📊 Sprawdzam istniejące komendy...");
    const existing = await guild.commands.fetch();
    console.log(
      `✅ Znaleziono ${existing.size} istniejących komend:`,
      existing.map((cmd) => cmd.name).join(", "),
    );

    if (existing.size < commands.length) {
      console.log("🔄 Rejestruję brakujące komendy...");
      (async () => {
        for (let i = 0; i < commands.length; i++) {
          try {
            console.log(`  ⏳ Rejestruję komendę ${i + 1}/${commands.length}: ${commands[i].name}...`);
            await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
            const cmd = await guild.commands.create(commands[i]);
            console.log(`  ✅ Zarejestrowana: ${cmd.name}`);
          } catch (err) {
            if (err.message.includes("Duplicate")) {
              console.log(`  ℹ️ ${commands[i].name} już istnieje`);
            } else {
              console.error(`  ❌ ${commands[i].name}: ${err.message}`);
            }
          }
        }
        console.log("🎉 Ukończono!");
      })();
    }
  } catch (error) {
    console.error("❌ Błąd:", error.message);
  }
}

client.once("ready", async () => {
  console.log(`✅ Zalogowano jako ${client.user.tag}`);

  // Uruchom rejestrację komend w tle (nie czekaj)
  registerSlashCommands().catch(err => console.error("Rejestracja komend error:", err));

  try {
    await transporter.verify();
    console.log("✅ SMTP OK");
  } catch (e) {
    console.error("❌ SMTP FAIL:", e);
  }

  const guild = client.guilds.cache.first();
  if (!guild) {
    console.error("❌ Bot nie jest na żadnym serwerze!");
    return;
  }

  const channel = guild.channels.cache.find((ch) => ch.name === CHANNEL_NAME);
  if (!channel) {
    console.error(`❌ Nie znaleziono kanału #${CHANNEL_NAME}`);
    return;
  }

  const tracker = loadFormTracker();
  const formKey = `${guild.id}_${channel.id}`;

  if (tracker[formKey]) {
    console.log(
      `✅ Formularz już istnieje na kanale #${CHANNEL_NAME} - pomijam wysyłanie`,
    );
    return;
  }

  const formButton = new ButtonBuilder()
    .setCustomId("open_stockx_form")
    .setLabel("📝 Wypełnij formularz zamówienia")
    .setStyle(ButtonStyle.Primary);

  const settingsButton = new ButtonBuilder()
    .setCustomId("open_user_settings")
    .setLabel("⚙️ Ustawienia")
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(formButton, settingsButton);

  const sentMessage = await channel.send({
    content:
      '**📦 Generator Zamówień - Multi-Brand**\n\n✨ **Dostępne szablony:** StockX, Apple, Balenciaga, Bape, Dior, LV, Moncler, Nike, Stussy, Trapstar, Notino, Zalando, Media Expert, GrailPoint\n\nKliknij przycisk poniżej, aby wypełnić formularz zamówienia.\nUżyj przycisku "Ustawienia" aby zapisać swoje dane (imię, adres, email) - nie będziesz musiał wpisywać ich za każdym razem!',
    components: [row],
  });

  tracker[formKey] = {
    messageId: sentMessage.id,
    timestamp: new Date().toISOString(),
  };
  saveFormTracker(tracker);

  console.log(`✅ Wysłano trwały formularz na kanał #${CHANNEL_NAME}`);
});

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;

    if (
      message.channel.name === LINK_CHANNEL_NAME &&
      message.attachments.size > 0
    ) {
      message.attachments.forEach((attachment) => {
        if (attachment.url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          message.channel.send(`🔗 ${attachment.url}`);
        }
      });
    }

    if (message.content.startsWith("!echo ")) {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply(
          "❌ Tylko administratorzy mogą używać komendy !echo!",
        );
      }

      const args = message.content.slice(6).trim();
      const channelMatch = args.match(/^<#(\d+)>\s+(.+)$/);

      if (!channelMatch) {
        return message.reply("❌ Użycie: `!echo #kanał wiadomość`");
      }

      const channelId = channelMatch[1];
      const content = channelMatch[2];

      const targetChannel = message.guild.channels.cache.get(channelId);
      if (!targetChannel) {
        return message.reply("❌ Nie znaleziono kanału!");
      }

      try {
        await targetChannel.send(content);
        await message.reply(`✅ Wysłano wiadomość na kanał ${targetChannel}`);
      } catch (err) {
        await message.reply("❌ Błąd wysyłania wiadomości!");
      }
    }

    if (message.content.startsWith("!setdays")) {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply(
          "❌ Tylko administratorzy mogą ustawiać dostęp czasowy!",
        );
      }

      const args = message.content.split(/\s+/);
      if (args.length < 3) {
        return message.reply(
          "❌ Użycie: `!setdays @użytkownik liczba_dni` lub `!setdays <ID> liczba_dni`",
        );
      }

      let userId;
      if (message.mentions.users.size > 0) {
        userId = message.mentions.users.first().id;
      } else {
        userId = args[1];
      }

      const days = parseInt(args[2]);
      if (isNaN(days) || days < 1) {
        return message.reply("❌ Liczba dni musi być >= 1");
      }

      const expiryDate = setUserAccess(userId, days);
      const user = await client.users.fetch(userId).catch(() => null);
      const userName = user ? user.tag : userId;

      const dateStr = expiryDate.toLocaleDateString("pl-PL");
      await message.reply(
        `✅ Ustawiono dostęp dla **${userName}** na **${days}** dni (do ${dateStr})`,
      );
      console.log(
        `✅ Admin ${message.author.tag} ustawił dostęp na ${days} dni dla ${userName}`,
      );

      if (user) {
        try {
          await user.send(
            `📩 **Powiadomienie z serwera ${message.guild.name}**\n\n✅ Administrator **${message.author.tag}** dał Ci dostęp do formularza StockX na **${days}** dni.\n\nTwój dostęp wygasa: **${dateStr}**`,
          );
        } catch (err) {
          console.log(`⚠️ Nie udało się wysłać DM do ${userName}`);
        }
      }
    }

    if (message.content.startsWith("!resettracker")) {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply(
          "❌ Tylko administratorzy mogą resetować tracker formularzy!",
        );
      }

      saveFormTracker({});
      await message.reply(
        "✅ Tracker formularzy został zresetowany! Bot wyśle formularz ponownie przy następnym uruchomieniu.",
      );
      console.log(
        `✅ Admin ${message.author.tag} zresetował tracker formularzy`,
      );
    }
  } catch (err) {
    console.error("❌ Błąd komendy:", err);
  }
});

client.on("interactionCreate", async (interaction) => {
  console.log(
    `\n🔵 INTERAKCJA: type=${interaction.type}, isButton=${interaction.isButton()}, customId=${interaction.customId || "N/A"}`,
  );

  try {
    // ========================================
    // BUTTONS & MODALS FIRST (need instant response)
    // ========================================

    if (interaction.isButton() && interaction.customId === "open_stockx_form") {
      console.log("🔘 BUTTON CLICKED: open_stockx_form");
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const accessStatus = checkUserAccess(interaction.user.id);

      if (!accessStatus.hasAccess) {
        if (accessStatus.noAccess) {
          return interaction.editReply({
            content:
              "❌ **Brak dostępu czasowego!**\n\nNie masz dostępu czasowego do formularza.\nSkontaktuj się z administratorem, aby otrzymać dostęp.",
          });
        }

        if (accessStatus.expired) {
          const dateStr = accessStatus.expiryDate.toLocaleDateString("pl-PL");
          return interaction.editReply({
            content: `❌ **Twój dostęp czasowy wygasł!**\n\nTwój dostęp wygasł: ${dateStr}\nSkontaktuj się z administratorem, aby odnowić dostęp.`,
          });
        }

        const userLimit = getUserLimit(interaction.user.id);

        if (userLimit === 0) {
          return interaction.editReply({
            content: "❌ **No access!**\n\n.Create ticekt on chanel how-to-buy",
          });
        }
      }

      if (accessStatus.hasAccess) {
        console.log(
          `✅ Użytkownik ${interaction.user.tag} ma aktywny dostęp czasowy - NIEOGRANICZONE UŻYCIA`,
        );
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("template_select")
        .setPlaceholder("🎨 Wybierz szablon email")
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel("StockX")
            .setDescription("Szablon StockX z order tracking")
            .setValue("stockx")
            .setEmoji("📦"),
          new StringSelectMenuOptionBuilder()
            .setLabel("Apple")
            .setDescription("Profesjonalny szablon Apple Store")
            .setValue("apple")
            .setEmoji("🍎"),
          new StringSelectMenuOptionBuilder()
            .setLabel("Balenciaga")
            .setDescription("Elegancki szablon Balenciaga")
            .setValue("balenciaga")
            .setEmoji("👗"),
          new StringSelectMenuOptionBuilder()
            .setLabel("Bape")
            .setDescription("Streetwear szablon Bape")
            .setValue("bape")
            .setEmoji("🦍"),
          new StringSelectMenuOptionBuilder()
            .setLabel("Dior")
            .setDescription("Luksusowy szablon Dior")
            .setValue("dior")
            .setEmoji("💎"),
          new StringSelectMenuOptionBuilder()
            .setLabel("Louis Vuitton")
            .setDescription("Premium szablon Louis Vuitton")
            .setValue("louis_vuitton")
            .setEmoji("👜"),
          new StringSelectMenuOptionBuilder()
            .setLabel("Moncler")
            .setDescription("Szablon Moncler z wysyłką")
            .setValue("moncler")
            .setEmoji("🧥"),
          new StringSelectMenuOptionBuilder()
            .setLabel("Nike")
            .setDescription("Sportowy szablon Nike")
            .setValue("nike")
            .setEmoji("👟"),
          new StringSelectMenuOptionBuilder()
            .setLabel("Stussy")
            .setDescription("Streetwear szablon Stussy")
            .setValue("stussy")
            .setEmoji("🎨"),
          new StringSelectMenuOptionBuilder()
            .setLabel("Trapstar")
            .setDescription("Urban szablon Trapstar")
            .setValue("trapstar")
            .setEmoji("⭐"),
          new StringSelectMenuOptionBuilder()
            .setLabel("Notino")
            .setDescription("Szablon Notino z kosmetykami")
            .setValue("notino")
            .setEmoji("💄"),
          new StringSelectMenuOptionBuilder()
            .setLabel("Zalando")
            .setDescription("Fashion szablon Zalando")
            .setValue("zalando")
            .setEmoji("👔"),
          new StringSelectMenuOptionBuilder()
            .setLabel("Media Expert")
            .setDescription("Elektronika Media Expert")
            .setValue("media_expert")
            .setEmoji("📱"),
          new StringSelectMenuOptionBuilder()
            .setLabel("GrailPoint")
            .setDescription("Premium GrailPoint (waluta zł)")
            .setValue("grail_point")
            .setEmoji("🏆"),
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      return interaction.editReply({
        content:
          "✅ **Wybierz szablon email:**\n\nWybierz markę z menu poniżej, aby rozpocząć wypełnianie formularza.",
        components: [row],
      });
    }

    // ========================================
    // SLASH COMMANDS (can be slower)
    // ========================================

    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "setlimit") {
        const targetUser = interaction.options.getUser("użytkownik");
        const limit = interaction.options.getInteger("liczba");

        setUserLimit(targetUser.id, limit);

        await interaction
          .reply({
            content: `✅ Ustawiono limit dla **${targetUser.tag}**: **${limit}** użyć`,
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});

        console.log(
          `✅ Admin ${interaction.user.tag} ustawił limit ${limit} dla ${targetUser.tag}`,
        );

        try {
          await targetUser.send(
            `📩 **Powiadomienie z serwera ${interaction.guild.name}**\n\n✅ Administrator **${interaction.user.tag}** ustawił Ci limit użyć formularza StockX: **${limit}** ${limit === 1 ? "użycie" : "użyć"}.\n\nMożesz teraz wypełnić formularz **${limit}** razy.`,
          );
        } catch (err) {
          console.log(`⚠️ Nie udało się wysłać DM do ${targetUser.tag}`);
        }
      }

      if (interaction.commandName === "removeallaccess") {
        saveAccess({});

        await interaction
          .reply({
            content:
              "✅ Usunięto dostęp czasowy dla wszystkich użytkowników na serwerze!",
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});

        console.log(
          `✅ Admin ${interaction.user.tag} usunął cały dostęp czasowy`,
        );
      }

      if (interaction.commandName === "checklimit") {
        const targetUser = interaction.options.getUser("użytkownik");
        const userId = targetUser ? targetUser.id : interaction.user.id;

        if (
          targetUser &&
          !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
        ) {
          return interaction.reply({
            content:
              "❌ Tylko administratorzy mogą sprawdzać limity innych użytkowników!",
            flags: MessageFlags.Ephemeral,
          });
        }

        const limit = getUserLimit(userId);
        const userName = targetUser ? targetUser.tag : "Masz";

        const content = targetUser
          ? `📊 **${userName}** ma jeszcze **${limit}** użyć formularza.`
          : `📊 ${userName} jeszcze **${limit}** użyć formularza.`;

        await interaction
          .reply({
            content,
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }

      if (interaction.commandName === "grantaccess") {
        const targetUser = interaction.options.getUser("użytkownik");
        const days = interaction.options.getInteger("dni");

        const expiryDate = setUserAccess(targetUser.id, days);
        const dateStr = expiryDate.toLocaleDateString("pl-PL");

        await interaction
          .reply({
            content: `✅ Ustawiono dostęp dla **${targetUser.tag}** na **${days}** ${days === 1 ? "dzień" : "dni"} (do ${dateStr})`,
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});

        console.log(
          `✅ Admin ${interaction.user.tag} ustawił dostęp na ${days} dni dla ${targetUser.tag}`,
        );

        try {
          await targetUser.send(
            `📩 **Powiadomienie z serwera ${interaction.guild.name}**\n\n✅ Administrator **${interaction.user.tag}** dał Ci dostęp do formularza na **${days}** ${days === 1 ? "dzień" : "dni"}.\n\nTwój dostęp wygasa: **${dateStr}**`,
          );
        } catch (err) {
          console.log(`⚠️ Nie udało się wysłać DM do ${targetUser.tag}`);
        }
      }

      if (interaction.commandName === "checkaccess") {
        const targetUser = interaction.options.getUser("użytkownik");
        const userId = targetUser ? targetUser.id : interaction.user.id;

        if (
          targetUser &&
          !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
        ) {
          return interaction.reply({
            content:
              "❌ Tylko administratorzy mogą sprawdzać dostęp innych użytkowników!",
            flags: MessageFlags.Ephemeral,
          });
        }

        const accessInfo = checkUserAccess(userId);
        const userName = targetUser ? targetUser.tag : "Masz";

        if (accessInfo.noAccess) {
          const content = targetUser
            ? `❌ **${userName}** nie ma dostępu czasowego do formularza.`
            : `❌ ${userName} nie ma dostępu czasowego do formularza.`;

          return interaction.reply({
            content,
            flags: MessageFlags.Ephemeral,
          });
        }

        if (accessInfo.expired) {
          const dateStr = accessInfo.expiryDate.toLocaleDateString("pl-PL");
          const content = targetUser
            ? `⏰ Dostęp dla **${userName}** wygasł **${dateStr}**`
            : `⏰ Twój dostęp wygasł **${dateStr}**`;

          return interaction.reply({
            content,
            flags: MessageFlags.Ephemeral,
          });
        }

        const now = new Date();
        const daysLeft = Math.ceil(
          (accessInfo.expiryDate - now) / (1000 * 60 * 60 * 24),
        );
        const dateStr = accessInfo.expiryDate.toLocaleDateString("pl-PL");

        const content = targetUser
          ? `📅 **${userName}** ma jeszcze **${daysLeft}** ${daysLeft === 1 ? "dzień" : "dni"} dostępu (do ${dateStr})`
          : `📅 ${userName} jeszcze **${daysLeft}** ${daysLeft === 1 ? "dzień" : "dni"} dostępu (do ${dateStr})`;

        await interaction
          .reply({
            content,
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }

      if (interaction.commandName === "redeem") {
        const code = interaction.options.getString("kod").toUpperCase().trim();
        const result = await redeemCode(code, interaction.user.id);
        
        if (result.success) {
          const emoji = result.type === "lifetime" ? "👑" : "✅";
          await interaction.reply({
            content: `${emoji} **Sukces!**\n\n${result.message}\n\nMozesz teraz uzywac formularza bez ograniczen!`,
            flags: MessageFlags.Ephemeral,
          });
          console.log(`✅ Uzytkownik ${interaction.user.tag} aktywował kod ${code} (${result.type})`);
        } else {
          await interaction.reply({
            content: `❌ **Blad!**\n\n${result.message}`,
            flags: MessageFlags.Ephemeral,
          });
          console.log(`❌ Uzytkownik ${interaction.user.tag} probowal uzyc nieprawidlowego kodu: ${code}`);
        }
      }
    }

    if (
      interaction.isButton() &&
      interaction.customId === "open_user_settings"
    ) {
      const modal = new ModalBuilder()
        .setCustomId("settings_modal_1")
        .setTitle("Ustawienia - Część 1/2");

      const nameInput = new TextInputBuilder()
        .setCustomId("full_name")
        .setLabel("Imię i Nazwisko")
        .setPlaceholder("Jan Kowalski")
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      const emailInput = new TextInputBuilder()
        .setCustomId("user_email")
        .setLabel("Adres Email")
        .setPlaceholder("jan@example.com")
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      const streetInput = new TextInputBuilder()
        .setCustomId("street")
        .setLabel("Ulica i Numer")
        .setPlaceholder("ul. Marszałkowska 123/45")
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      const cityInput = new TextInputBuilder()
        .setCustomId("city")
        .setLabel("Miasto")
        .setPlaceholder("Warszawa")
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      const postalInput = new TextInputBuilder()
        .setCustomId("postal_code")
        .setLabel("Kod Pocztowy")
        .setPlaceholder("00-001")
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(emailInput),
        new ActionRowBuilder().addComponents(streetInput),
        new ActionRowBuilder().addComponents(cityInput),
        new ActionRowBuilder().addComponents(postalInput),
      );

      await interaction.showModal(modal).catch((err) => {
        console.error("❌ Błąd przy otwieraniu ustawień:", err.code);
      });
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId === "settings_modal_1"
    ) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const fullName = interaction.fields.getTextInputValue("full_name");
      const email = interaction.fields.getTextInputValue("user_email");
      const street = interaction.fields.getTextInputValue("street");
      const city = interaction.fields.getTextInputValue("city");
      const postalCode = interaction.fields.getTextInputValue("postal_code");

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return interaction.followUp({
          content: "❌ Podaj poprawny adres email!",
          flags: MessageFlags.Ephemeral,
        });
      }

      interaction.client.tempSettings = interaction.client.tempSettings || {};
      interaction.client.tempSettings[interaction.user.id] = {
        fullName,
        email,
        street,
        city,
        postalCode,
      };

      await interaction.followUp({
        content: "✅ Wypełniono część 1/2. Wypełnij teraz część 2...",
        flags: MessageFlags.Ephemeral,
      });

      await interaction.followUp({
        content: "📝 Kliknij przycisk poniżej, aby kontynuować:",
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("continue_settings")
              .setLabel("Kontynuuj ustawienia")
              .setStyle(ButtonStyle.Success),
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (
      interaction.isButton() &&
      interaction.customId === "continue_settings"
    ) {
      try {
        const tempSettings =
          interaction.client.tempSettings?.[interaction.user.id];
        if (!tempSettings) {
          return interaction.reply({
            content:
              "❌ Błąd: Nie znaleziono danych z części 1. Spróbuj ponownie.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const modal = new ModalBuilder()
          .setCustomId("settings_modal_2")
          .setTitle("Ustawienia - Część 2/2");

        const countryInput = new TextInputBuilder()
          .setCustomId("country")
          .setLabel("Kraj")
          .setPlaceholder("np. Polska")
          .setStyle(TextInputStyle.Short)
          .setRequired(false);

        modal.addComponents(new ActionRowBuilder().addComponents(countryInput));
        await interaction.showModal(modal);
      } catch (err) {
        console.error("❌ Błąd przy otwieraniu ustawień cz.2:", err);
        if (!interaction.replied && !interaction.deferred) {
          await interaction
            .reply({
              content: "❌ Wystąpił błąd. Spróbuj ponownie.",
              flags: MessageFlags.Ephemeral,
            })
            .catch(() => {});
        }
      }
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId === "settings_modal_2"
    ) {
      const country = interaction.fields.getTextInputValue("country");

      const tempSettings =
        interaction.client.tempSettings?.[interaction.user.id];
      if (!tempSettings) {
        return interaction.reply({
          content:
            "❌ Błąd: Nie znaleziono danych z części 1. Spróbuj ponownie.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const completeSettings = {
        ...tempSettings,
        country,
      };

      setUserSettings(interaction.user.id, completeSettings);
      setUserEmail(interaction.user.id, completeSettings.email);

      delete interaction.client.tempSettings[interaction.user.id];

      console.log(
        `✅ Użytkownik ${interaction.user.tag} zapisał ustawienia:`,
        completeSettings,
      );

      await interaction
        .reply({
          content: `✅ **Ustawienia zapisane!**\n\n👤 **Imię:** ${completeSettings.fullName}\n📧 **Email:** ${completeSettings.email}\n📍 **Adres:**\n${completeSettings.street}\n${completeSettings.city}, ${completeSettings.postalCode}\n${completeSettings.country}\n\nPrzy wypełnianiu formularzy te dane będą automatycznie użyte!`,
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => {});
    }

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "template_select"
    ) {
      try {
        let template = interaction.values[0];
        // Fix template name mismatches - menu sends with underscore, config expects without
        if (template === "media_expert") template = "mediaexpert";
        if (template === "grail_point") template = "grailpoint";

        interaction.client.tempData = interaction.client.tempData || {};
        interaction.client.tempData[interaction.user.id] = { template };

        const modal = new ModalBuilder()
          .setCustomId("stockx_modal")
          .setTitle(`Formularz ${template.toUpperCase()} - Część 1/2`);

        const brandInput = new TextInputBuilder()
          .setCustomId("brand")
          .setLabel("Marka")
          .setPlaceholder("np. Nike")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const productInput = new TextInputBuilder()
          .setCustomId("product")
          .setLabel("Nazwa Produktu")
          .setPlaceholder("np. Air Jordan 1 Retro High")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const sizeInput = new TextInputBuilder()
          .setCustomId("size")
          .setLabel("Rozmiar (opcjonalnie dla Apple)")
          .setPlaceholder("np. 42 lub US 10 (zostaw puste dla Apple)")
          .setStyle(TextInputStyle.Short)
          .setRequired(false);

        const priceInput = new TextInputBuilder()
          .setCustomId("price")
          .setLabel("Cena (tylko liczba, bez $)")
          .setPlaceholder("np. 250.00")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const row1 = new ActionRowBuilder().addComponents(brandInput);
        const row2 = new ActionRowBuilder().addComponents(productInput);
        const row3 = new ActionRowBuilder().addComponents(sizeInput);
        const row4 = new ActionRowBuilder().addComponents(priceInput);

        modal.addComponents(row1, row2, row3, row4);
        await interaction.showModal(modal);
      } catch (error) {
        console.error("❌ Błąd przy pokazywaniu modala:", error);
        if (!interaction.replied && !interaction.deferred) {
          try {
            await interaction
              .reply({
                content: "❌ Wystąpił błąd. Spróbuj ponownie.",
                flags: MessageFlags.Ephemeral,
              })
              .catch(() => {});
          } catch (e) {
            console.error("Nie udało się odpowiedzieć na interakcję:", e);
          }
        }
      }
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId === "stockx_modal"
    ) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const tempData = interaction.client.tempData?.[interaction.user.id];
      if (!tempData || !tempData.template) {
        await interaction.followUp({
          content:
            "❌ Błąd: Nie znaleziono wybranego szablonu. Spróbuj ponownie.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      let template = tempData.template;
      // Fix template name mismatches - menu sends with underscore, config expects without
      if (template === "media_expert") template = "mediaexpert";
      if (template === "grail_point") template = "grailpoint";

      if (template === "grailpoint") currency = "zł";
      const brand = interaction.fields.getTextInputValue("brand");
      const product = interaction.fields.getTextInputValue("product");
      const size = interaction.fields.getTextInputValue("size") || "";
      const priceRaw = interaction.fields.getTextInputValue("price").trim();

      interaction.client.tempData[interaction.user.id] = {
        template,
        brand,
        product,
        size,
        priceRaw,
      };

      await interaction.followUp({
        content: "✅ Wypełniono część 1/2. Wypełnij teraz część 2...",
        flags: MessageFlags.Ephemeral,
      });

      await interaction.followUp({
        content: "📝 Kliknij przycisk poniżej, aby kontynuować:",
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("continue_form")
              .setLabel("Kontynuuj formularz")
              .setStyle(ButtonStyle.Success),
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (interaction.isButton() && interaction.customId === "continue_form") {
      const tempData = interaction.client.tempData?.[interaction.user.id];
      if (!tempData || !tempData.template) {
        return interaction.reply({
          content:
            "❌ Błąd: Nie znaleziono danych z części 1. Spróbuj ponownie.",
          flags: MessageFlags.Ephemeral,
        });
      }

      let template = tempData.template;
      // Fix template name mismatches - menu sends with underscore, config expects without
      if (template === "media_expert") template = "mediaexpert";
      if (template === "grail_point") template = "grailpoint";

      if (template === "grailpoint") currency = "zł";
      const config = TEMPLATE_CONFIG[template];

      if (!config) {
        return interaction.reply({
          content: `❌ Błąd: Nieznany szablon "${template}". Spróbuj ponownie od początku.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId("stockx_modal_2")
        .setTitle("Formularz - Część 2/2");

      const savedEmail = getUserEmail(interaction.user.id);

      const emailInput = new TextInputBuilder()
        .setCustomId("email")
        .setLabel("Email")
        .setPlaceholder("np. klient@example.com")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      if (savedEmail) {
        emailInput.setValue(savedEmail);
      }

      const dateInput = new TextInputBuilder()
        .setCustomId("date")
        .setLabel("Data (np. 22/12/2024)")
        .setPlaceholder("np. 22/12/2024")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const imageInput = new TextInputBuilder()
        .setCustomId("image_url")
        .setLabel("🌐 Link do Zdjęcia (PUBLICZNY URL!)")
        .setPlaceholder("https://i.imgur.com/abc123.jpg")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const rows = [
        new ActionRowBuilder().addComponents(emailInput),
        new ActionRowBuilder().addComponents(dateInput),
        new ActionRowBuilder().addComponents(imageInput),
      ];

      if (config && config.needsStyleId && rows.length < 5) {
        const styleIdInput = new TextInputBuilder()
          .setCustomId("style_id")
          .setLabel("Style ID")
          .setPlaceholder("np. DZ5485-612")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        rows.push(new ActionRowBuilder().addComponents(styleIdInput));
      }

      if (config && config.needsColour && rows.length < 5) {
        const colourInput = new TextInputBuilder()
          .setCustomId("colour")
          .setLabel("Kolor")
          .setPlaceholder("np. Czarny, Biały")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        rows.push(new ActionRowBuilder().addComponents(colourInput));
      }

      if (config && config.needsTaxes && rows.length < 5) {
        const taxesInput = new TextInputBuilder()
          .setCustomId("taxes")
          .setLabel("Podatki (tylko liczba, bez $)")
          .setPlaceholder("np. 15.00")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        rows.push(new ActionRowBuilder().addComponents(taxesInput));
      }

      if (config && config.needsReference && rows.length < 5) {
        const referenceInput = new TextInputBuilder()
          .setCustomId("reference")
          .setLabel("Numer Referencyjny")
          .setPlaceholder("np. REF123456")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        rows.push(new ActionRowBuilder().addComponents(referenceInput));
      }

      if (config && config.needsFirstName && rows.length < 5) {
        const firstNameInput = new TextInputBuilder()
          .setCustomId("first_name")
          .setLabel("Imię")
          .setPlaceholder("np. Jan")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        rows.push(new ActionRowBuilder().addComponents(firstNameInput));
      }

      if (config && config.needsWholeName && rows.length < 5) {
        const wholeNameInput = new TextInputBuilder()
          .setCustomId("whole_name")
          .setLabel("Pełne Imię i Nazwisko")
          .setPlaceholder("np. Jan Kowalski")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        rows.push(new ActionRowBuilder().addComponents(wholeNameInput));
      }

      if (config.needsQuantity && rows.length < 5) {
        const quantityInput = new TextInputBuilder()
          .setCustomId("quantity")
          .setLabel("Ilość")
          .setPlaceholder("np. 1")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setValue("1");
        rows.push(new ActionRowBuilder().addComponents(quantityInput));
      }

      if (config.needsCurrency && rows.length < 5 && !config.needsModal3) {
        const currencyInput = new TextInputBuilder()
          .setCustomId("currency")
          .setLabel("Waluta: $ lub € lub zł")
          .setPlaceholder("np. $")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setValue("$");
        rows.push(new ActionRowBuilder().addComponents(currencyInput));
      }

      if (config.needsPhoneNumber && rows.length < 5 && !config.needsModal3) {
        const phoneInput = new TextInputBuilder()
          .setCustomId("phone_number")
          .setLabel("Phone number")
          .setPlaceholder("np. 123 456 789")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        rows.push(new ActionRowBuilder().addComponents(phoneInput));
      }

      if (config.needsCardEnd && rows.length < 5 && !config.needsModal3) {
        const cardEndInput = new TextInputBuilder()
          .setCustomId("card_end")
          .setLabel("Ostatnie 4 cyfry karty")
          .setPlaceholder("np. 1234")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        rows.push(new ActionRowBuilder().addComponents(cardEndInput));
      }

      if (
        config.needsEstimatedDelivery &&
        rows.length < 5 &&
        !config.needsModal3
      ) {
        const deliveryInput = new TextInputBuilder()
          .setCustomId("estimated_delivery")
          .setLabel("Szacowana Data Dostawy")
          .setPlaceholder("np. 25/12/2024")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        rows.push(new ActionRowBuilder().addComponents(deliveryInput));
      }

      modal.addComponents(...rows);
      await interaction.showModal(modal);
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId === "stockx_modal_2"
    ) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const email = interaction.fields.getTextInputValue("email");
      let orderDate = interaction.fields.getTextInputValue("date");
      // Ensure proper date format: DD/MM/YYYY
      if (orderDate && !orderDate.includes("/")) {
        orderDate = orderDate.replace(/(\d{2})(\d{2})(\d{4})/, "$1/$2/$3");
      }
      const imageURL = interaction.fields.getTextInputValue("image_url").trim();

      if (!imageURL.startsWith("https://") && !imageURL.startsWith("http://")) {
        return interaction.followUp({
          content:
            "❌ **Link do zdjęcia musi być publicznym URL!**\n\n✅ Prawidłowy przykład:\n`https://i.imgur.com/abc123.jpg`\n\n❌ NIE używaj:\n- Lokalnych plików (C:\\zdjecie.jpg)\n- Replit dev URL\n- Linków bez https://\n\n💡 **Prześlij zdjęcie na Imgur.com i skopiuj link!**",
          flags: MessageFlags.Ephemeral,
        });
      }

      const tempData = interaction.client.tempData?.[interaction.user.id];
      if (!tempData) {
        await interaction.followUp({
          content:
            "❌ Błąd: Nie znaleziono danych z części 1. Spróbuj ponownie.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const { template, brand, product, size, priceRaw } = tempData;

      const config = TEMPLATE_CONFIG[template];

      console.log(`🔍 DEBUGOWANIE CENY:`);
      console.log(`   Oryginalna wartość: "${priceRaw}"`);
      console.log(`   Typ: ${typeof priceRaw}`);
      console.log(`   Długość: ${priceRaw.length}`);

      const cleanPrice = priceRaw.replace(/[^\d.,]/g, "").replace(",", ".");
      console.log(`   Po czyszczeniu: "${cleanPrice}"`);

      const price = Number(cleanPrice);
      console.log(`   Skonwertowana liczba: ${price}`);
      console.log(`   isNaN: ${isNaN(price)}`);
      console.log(`   price <= 0: ${price <= 0}`);

      if (!priceRaw || isNaN(price) || price <= 0) {
        await interaction.followUp({
          content: `❌ **Błąd: Nieprawidłowa cena!**\n\nWpisałeś: "${priceRaw}"\nPo czyszczeniu: "${cleanPrice}"\nLiczba: ${price}\n\n✅ Prawidłowy format:\n- 200\n- 250.50\n- 1500\n\n❌ NIE używaj:\n- Symbolu $ (tylko liczba)\n- Liter lub innych znaków`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      console.log(`✅ Cena zaakceptowana: $${price}`);

      const styleId = config.needsStyleId
        ? interaction.fields.getTextInputValue("style_id")
        : "";
      const colour = config.needsColour
        ? interaction.fields.getTextInputValue("colour")
        : "";
      const taxesRaw = config.needsTaxes
        ? interaction.fields.getTextInputValue("taxes")
        : "0";
      const reference = config.needsReference
        ? interaction.fields.getTextInputValue("reference")
        : "";
      const firstName = config.needsFirstName
        ? interaction.fields.getTextInputValue("first_name")
        : "";
      const wholeName = config.needsWholeName
        ? interaction.fields.getTextInputValue("whole_name")
        : "";
      const quantityRaw = config.needsQuantity
        ? interaction.fields.getTextInputValue("quantity")
        : "1";
      let currency = "$";
      let phoneNumber = "";
      let cardEnd = "";
      let estimatedDelivery = "";

      if (config.needsCurrency && !config.needsModal3) {
        try {
          currency = interaction.fields.getTextInputValue("currency");
        } catch (e) {
          currency = "$";
        }
      }

      if (config.needsPhoneNumber && !config.needsModal3) {
        try {
          phoneNumber = interaction.fields.getTextInputValue("phone_number");
        } catch (e) {
          phoneNumber = "";
        }
      }

      if (config.needsCardEnd && !config.needsModal3) {
        try {
          cardEnd = interaction.fields.getTextInputValue("card_end");
        } catch (e) {
          cardEnd = "";
        }
      }

      if (config.needsEstimatedDelivery && !config.needsModal3) {
        try {
          estimatedDelivery =
            interaction.fields.getTextInputValue("estimated_delivery");
        } catch (e) {
          estimatedDelivery = "";
        }
      }

      const taxes = Number(taxesRaw);
      if (isNaN(taxes)) {
        await interaction.followUp({
          content: "❌ Błąd: Podatki muszą być liczbą!",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const quantity = Number(quantityRaw);

      if (config.needsModal3) {
        interaction.client.tempData[interaction.user.id] = {
          ...tempData,
          email,
          orderDate,
          imageURL,
          styleId,
          colour,
          taxesRaw,
          taxes,
          reference,
          firstName,
          wholeName,
          quantityRaw,
          quantity,
          price,
          phoneNumber,
        };

        await interaction.followUp({
          content:
            "📝 Kliknij przycisk poniżej, aby wypełnić ostatnią część formularza:",
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("continue_modal3")
                .setLabel("Kontynuuj - Część 3/3")
                .setStyle(ButtonStyle.Success),
            ),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      delete interaction.client.tempData[interaction.user.id];
      if (isNaN(quantity) || quantity < 1) {
        await interaction.followUp({
          content: "❌ Błąd: Ilość musi być liczbą większą od 0!",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const processingFee = 5.95;
      const shipping = 12.95;
      const subtotal = price * quantity;
      const total = (subtotal + processingFee + shipping + taxes).toFixed(2);
      const orderNumber = String(Date.now());

      console.log(`📧 [${template}] Generating email with:`, {
        price: `${price.toFixed(2)}${currency}`,
        quantity,
        subtotal: `${subtotal.toFixed(2)}${currency}`,
        total: `${total}${currency}`,
        productQty: `Qty ${quantity}`,
      });

      const userSettings = getUserSettings(interaction.user.id);

      let html = readTpl(config.file);

      html = html
        .replace(/PRODUCT_IMAGE/g, esc(imageURL))
        .replace(/PRODUCT_LINK/g, esc(imageURL))
        .replace(/PRODUCT_NAME/g, esc(`${brand} ${product}`))
        .replace(/PRODUCTNAME/g, esc(`${brand} ${product}`))
        .replace(/PRODUCT_SUBTOTAL/g, esc(`${subtotal.toFixed(2)}${currency}`))
        .replace(/PRODUCT_QTY/g, esc(`Qty ${quantity}`))
        .replace(
          /PRODUCT_PRICE/g,
          esc(
            template === "stockx"
              ? `${currency} ${price.toFixed(2)}`
              : `${price.toFixed(2)}${currency}`,
          ),
        )
        .replace(
          /PRODUCTPRICE/g,
          esc(
            template === "stockx"
              ? `${currency} ${price.toFixed(2)}`
              : `${price.toFixed(2)}${currency}`,
          ),
        )
        .replace(
          /ORDER_PRICE/g,
          esc(
            template === "stockx"
              ? `${currency} ${price.toFixed(2)}`
              : `${price.toFixed(2)}${currency}`,
          ),
        )
        .replace(/PRODUCT_COLOUR/g, esc(colour))
        .replace(/PRODUCTSTYLE/g, esc(styleId))
        .replace(/PRODUCTSIZE/g, esc(size))
        .replace(/PRODUCT/g, esc(product))
        .replace(/STYLE_ID/g, esc(styleId))
        .replace(/\bSTYLE\b/g, esc(styleId))
        .replace(/\bSIZE\b/g, esc(size))
        .replace(/PRICE/g, esc(`${price.toFixed(2)}${currency}`))
        .replace(
          /FEE/g,
          esc(
            template === "stockx"
              ? `${currency} ${processingFee.toFixed(2)}`
              : `${processingFee.toFixed(2)}${currency}`,
          ),
        )
        .replace(
          /SHIPPING/g,
          esc(
            template === "stockx"
              ? `${currency} ${shipping.toFixed(2)}`
              : `${shipping.toFixed(2)}${currency}`,
          ),
        )
        .replace(/TAXES/g, esc(`${taxes.toFixed(2)}${currency}`))
        .replace(/TOTAL\*/g, esc(`${total}${currency}*`))
        .replace(/TOTAL/g, esc(`${total}${currency}`))
        .replace(/ORDER_TOTAL/g, esc(`${total}${currency}`))
        .replace(/CARTTOTAL/g, esc(`${total}${currency}`))
        .replace(/\bDATE\b/g, esc(orderDate))
        .replace(/ORDERDATE/g, esc(orderDate))
        .replace(/ORDER_NUMBER/g, esc(orderNumber))
        .replace(/ORDERNUMBER/g, esc(orderNumber))
        .replace(/\bCOLOUR\b/g, esc(colour))
        .replace(/\bREFERENCE\b/g, esc(reference))
        .replace(
          /\bFIRSTNAME\b/g,
          esc(userSettings?.fullName || firstName || "Jan"),
        )
        .replace(
          /FIRST_NAME/g,
          esc(userSettings?.fullName || firstName || "Jan"),
        )
        .replace(
          /WHOLE_NAME/g,
          esc(userSettings?.fullName || wholeName || "Jan Kowalski"),
        )
        .replace(
          /WHOLENAME/g,
          esc(userSettings?.fullName || wholeName || "Jan Kowalski"),
        )
        .replace(
          /FULL_NAME/g,
          esc(
            userSettings?.fullName || wholeName || firstName || "Jan Kowalski",
          ),
        )
        .replace(/\bEMAIL\b/g, esc(email))
        .replace(/\bQUANTITY\b/g, esc(quantity))
        .replace(/CURRENCY_STR/g, esc(currency))
        .replace(/\bCURRENCY\b/g, esc(currency))
        .replace(
          /PHONE_NUMBER/g,
          esc(phoneNumber || userSettings?.email || "+1 234 567 890"),
        )
        .replace(/CARD_END/g, esc(cardEnd || "1234"))
        .replace(/ESTIMATED_DELIVERY/g, esc(estimatedDelivery))
        .replace(/STREET/g, esc(userSettings?.street || "ul. Przykładowa 123"))
        .replace(/POSTAL_CODE/g, esc(userSettings?.postalCode || "00-000"))
        .replace(/CITY/g, esc(userSettings?.city || "Warszawa"))
        .replace(
          /ADDRESS1/g,
          esc(userSettings?.fullName || firstName || wholeName || "Customer"),
        )
        .replace(
          /ADDRESS2/g,
          esc(userSettings?.street || "Shipping Address Line 1"),
        )
        .replace(
          /ADDRESS3/g,
          esc(
            userSettings
              ? `${userSettings.city}, ${userSettings.postalCode}`
              : "City, Postal Code",
          ),
        )
        .replace(/ADDRESS4/g, esc(userSettings?.country || "Country"))
        .replace(/ADDRESS5/g, "")
        .replace(
          /BILLING1/g,
          esc(userSettings?.fullName || wholeName || firstName || "Customer"),
        )
        .replace(
          /BILLING2/g,
          esc(userSettings?.street || "Billing Address Line 1"),
        )
        .replace(
          /BILLING3/g,
          esc(
            userSettings
              ? `${userSettings.city}, ${userSettings.postalCode}`
              : "City, Postal Code",
          ),
        )
        .replace(/BILLING4/g, esc(userSettings?.country || "Country"))
        .replace(/BILLING5/g, "")
        .replace(
          /SHIPPING1/g,
          esc(userSettings?.fullName || firstName || wholeName || "Customer"),
        )
        .replace(
          /SHIPPING2/g,
          esc(userSettings?.street || "Shipping Address Line 1"),
        )
        .replace(
          /SHIPPING3/g,
          esc(
            userSettings
              ? `${userSettings.city}, ${userSettings.postalCode}`
              : "City, Postal Code",
          ),
        )
        .replace(/SHIPPING4/g, esc(userSettings?.country || "Country"))
        .replace(/SHIPPING5/g, "")
        .replace(
          /SHIPPING_JAN/g,
          esc(
            userSettings?.fullName || firstName || wholeName || "Jan Kowalski",
          ),
        )
        .replace(
          /BILLING_JAN/g,
          esc(
            userSettings?.fullName || wholeName || firstName || "Jan Kowalski",
          ),
        );

      const brandName = template.charAt(0).toUpperCase() + template.slice(1);
      const info = await transporter.sendMail({
        from: `"${brandName}" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `${brandName} — ${brand} ${product} (${size})`,
        html,
      });

      const accessStatus = checkUserAccess(interaction.user.id);
      let usageMessage = "";

      if (accessStatus.hasAccess) {
        console.log(
          `✅ Wysłano email [${template}]: ${info.messageId} | Użytkownik: ${interaction.user.tag} | Dostęp czasowy - NIEOGRANICZONE UŻYCIA`,
        );
        usageMessage = "📊 **Dostęp czasowy aktywny - nieograniczone użycia!**";
      } else {
        const remainingUses = decreaseUserLimit(interaction.user.id);
        console.log(
          `✅ Wysłano email [${template}]: ${info.messageId} | Użytkownik: ${interaction.user.tag} | Pozostało: ${remainingUses}`,
        );
        usageMessage = `📊 **Pozostałe użycia: ${remainingUses}**`;
      }

      await interaction.followUp({
        content: `✅ **Zamówienie wysłane pomyślnie!**\n\n**Szablon:** ${brandName}\n**Email:** ${email}\n**Produkt:** ${brand} ${product}\n**Rozmiar:** ${size}\n**Cena całkowita:** ${total}${currency}\n\n${usageMessage}`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (interaction.isButton() && interaction.customId === "continue_modal3") {
      const tempData = interaction.client.tempData?.[interaction.user.id];
      if (!tempData) {
        return interaction.reply({
          content:
            "❌ Błąd: Nie znaleziono danych z części 2. Spróbuj ponownie.",
          flags: MessageFlags.Ephemeral,
        });
      }

      let template = tempData.template;
      // Fix template name mismatches - menu sends with underscore, config expects without
      if (template === "media_expert") template = "mediaexpert";
      if (template === "grail_point") template = "grailpoint";

      if (template === "grailpoint") currency = "zł";
      const config = TEMPLATE_CONFIG[template];

      const modal = new ModalBuilder()
        .setCustomId("stockx_modal_3")
        .setTitle("Formularz - Część 3/3");

      const rows = [];

      if (config.needsCurrency && rows.length < 5) {
        const currencyInput = new TextInputBuilder()
          .setCustomId("currency")
          .setLabel("Waluty: $ lub € lub zł")
          .setPlaceholder("np. $")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setValue(template === "grailpoint" ? "zł" : "$");
        rows.push(new ActionRowBuilder().addComponents(currencyInput));
      }

      if (config.needsCardEnd && rows.length < 5) {
        const cardEndInput = new TextInputBuilder()
          .setCustomId("card_end")
          .setLabel("Ostatnie 4 cyfry karty")
          .setPlaceholder("np. 1234")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        rows.push(new ActionRowBuilder().addComponents(cardEndInput));
      }

      if (config.needsEstimatedDelivery && rows.length < 5) {
        const deliveryInput = new TextInputBuilder()
          .setCustomId("estimated_delivery")
          .setLabel("Szacowana Data Dostawy")
          .setPlaceholder("np. 25/12/2024")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        rows.push(new ActionRowBuilder().addComponents(deliveryInput));
      }

      if (config.needsPhoneNumber && rows.length < 5) {
        const phoneInput = new TextInputBuilder()
          .setCustomId("phone_number")
          .setLabel("Numer Telefonu")
          .setPlaceholder("np. +48 123 456 789")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        rows.push(new ActionRowBuilder().addComponents(phoneInput));
      }

      modal.addComponents(...rows);
      await interaction.showModal(modal);
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId === "stockx_modal_3"
    ) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const tempData = interaction.client.tempData?.[interaction.user.id];
      if (!tempData) {
        await interaction.followUp({
          content:
            "❌ Błąd: Nie znaleziono danych z poprzednich części. Spróbuj ponownie.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const {
        template,
        brand,
        product,
        size,
        email,
        orderDate,
        imageURL,
        styleId,
        colour,
        taxes,
        reference,
        firstName,
        wholeName,
        quantity,
        price,
      } = tempData;
      let phoneNumber = tempData.phoneNumber || "";

      delete interaction.client.tempData[interaction.user.id];
      const config = TEMPLATE_CONFIG[template];

      let currency = "$";
      let cardEnd = "";
      let estimatedDelivery = "";

      if (config.needsCurrency && config.needsModal3) {
        try {
          currency = interaction.fields.getTextInputValue("currency");
        } catch (e) {
          currency = "$";
        }
      }

      if (config.needsCardEnd && config.needsModal3) {
        try {
          cardEnd = interaction.fields.getTextInputValue("card_end");
        } catch (e) {
          cardEnd = "";
        }
      }

      if (config.needsEstimatedDelivery && config.needsModal3) {
        try {
          estimatedDelivery =
            interaction.fields.getTextInputValue("estimated_delivery");
        } catch (e) {
          estimatedDelivery = "";
        }
      }

      if (config.needsPhoneNumber && config.needsModal3) {
        try {
          phoneNumber = interaction.fields.getTextInputValue("phone_number");
        } catch (e) {
          phoneNumber = tempData.phoneNumber || "";
        }
      }

      const processingFee = 5.95;
      const shipping = 12.95;
      const subtotal = price * quantity;
      const total = (subtotal + processingFee + shipping + taxes).toFixed(2);
      const orderNumber = String(Date.now());

      console.log(`📧 [${template}] Generating email with modal3 data:`, {
        price: `${price.toFixed(2)}${currency}`,
        quantity,
        subtotal: `${subtotal.toFixed(2)}${currency}`,
        total: `${total}${currency}`,
        currency,
        cardEnd,
        estimatedDelivery,
      });

      const userSettings = getUserSettings(interaction.user.id);
      let html = readTpl(config.file);

      html = html
        .replace(/PRODUCT_IMAGE/g, esc(imageURL))
        .replace(/PRODUCT_LINK/g, esc(imageURL))
        .replace(/PRODUCT_NAME/g, esc(`${brand} ${product}`))
        .replace(/PRODUCTNAME/g, esc(`${brand} ${product}`))
        .replace(/PRODUCT_SUBTOTAL/g, esc(`${subtotal.toFixed(2)}${currency}`))
        .replace(/PRODUCT_QTY/g, esc(`Qty ${quantity}`))
        .replace(
          /PRODUCT_PRICE/g,
          esc(
            template === "stockx"
              ? `${currency} ${price.toFixed(2)}`
              : `${price.toFixed(2)}${currency}`,
          ),
        )
        .replace(
          /PRODUCTPRICE/g,
          esc(
            template === "stockx"
              ? `${currency} ${price.toFixed(2)}`
              : `${price.toFixed(2)}${currency}`,
          ),
        )
        .replace(
          /ORDER_PRICE/g,
          esc(
            template === "stockx"
              ? `${currency} ${price.toFixed(2)}`
              : `${price.toFixed(2)}${currency}`,
          ),
        )
        .replace(/PRODUCT_COLOUR/g, esc(colour))
        .replace(/PRODUCTSTYLE/g, esc(styleId))
        .replace(/PRODUCTSIZE/g, esc(size))
        .replace(/PRODUCT/g, esc(product))
        .replace(/STYLE_ID/g, esc(styleId))
        .replace(/\bSTYLE\b/g, esc(styleId))
        .replace(/\bSIZE\b/g, esc(size))
        .replace(
          /PRICE/g,
          esc(
            template === "stockx"
              ? `${currency} ${price.toFixed(2)}`
              : `${price.toFixed(2)}${currency}`,
          ),
        )
        .replace(
          /FEE/g,
          esc(
            template === "stockx"
              ? `${currency} ${processingFee.toFixed(2)}`
              : `${processingFee.toFixed(2)}${currency}`,
          ),
        )
        .replace(
          /SHIPPING/g,
          esc(
            template === "stockx"
              ? `${currency} ${shipping.toFixed(2)}`
              : `${shipping.toFixed(2)}${currency}`,
          ),
        )
        .replace(
          /TAXES/g,
          esc(
            template === "stockx"
              ? `${currency} ${taxes.toFixed(2)}`
              : `${taxes.toFixed(2)}${currency}`,
          ),
        )
        .replace(/TOTAL\*/g, esc(`${total}${currency}*`))
        .replace(/TOTAL/g, esc(`${total}${currency}`))
        .replace(/ORDER_TOTAL/g, esc(`${total}${currency}`))
        .replace(/CARTTOTAL/g, esc(`${total}${currency}`))
        .replace(/\bDATE\b/g, esc(orderDate))
        .replace(/ORDERDATE/g, esc(orderDate))
        .replace(/ORDER_NUMBER/g, esc(orderNumber))
        .replace(/ORDERNUMBER/g, esc(orderNumber))
        .replace(/\bCOLOUR\b/g, esc(colour))
        .replace(/\bREFERENCE\b/g, esc(reference))
        .replace(
          /\bFIRSTNAME\b/g,
          esc(userSettings?.fullName || firstName || "Jan"),
        )
        .replace(
          /FIRST_NAME/g,
          esc(userSettings?.fullName || firstName || "Jan"),
        )
        .replace(
          /WHOLE_NAME/g,
          esc(userSettings?.fullName || wholeName || "Jan Kowalski"),
        )
        .replace(
          /WHOLENAME/g,
          esc(userSettings?.fullName || wholeName || "Jan Kowalski"),
        )
        .replace(
          /FULL_NAME/g,
          esc(
            userSettings?.fullName || wholeName || firstName || "Jan Kowalski",
          ),
        )
        .replace(/\bEMAIL\b/g, esc(email))
        .replace(/\bQUANTITY\b/g, esc(quantity))
        .replace(/CURRENCY_STR/g, esc(currency))
        .replace(/\bCURRENCY\b/g, esc(currency))
        .replace(
          /PHONE_NUMBER/g,
          esc(phoneNumber || userSettings?.email || "+1 234 567 890"),
        )
        .replace(/CARD_END/g, esc(cardEnd || "1234"))
        .replace(/ESTIMATED_DELIVERY/g, esc(estimatedDelivery))
        .replace(/STREET/g, esc(userSettings?.street || "ul. Przykładowa 123"))
        .replace(/POSTAL_CODE/g, esc(userSettings?.postalCode || "00-000"))
        .replace(/CITY/g, esc(userSettings?.city || "Warszawa"))
        .replace(
          /ADDRESS1/g,
          esc(userSettings?.fullName || firstName || wholeName || "Customer"),
        )
        .replace(
          /ADDRESS2/g,
          esc(userSettings?.street || "Shipping Address Line 1"),
        )
        .replace(
          /ADDRESS3/g,
          esc(
            userSettings
              ? `${userSettings.city}, ${userSettings.postalCode}`
              : "City, Postal Code",
          ),
        )
        .replace(/ADDRESS4/g, esc(userSettings?.country || "Country"))
        .replace(/ADDRESS5/g, "")
        .replace(
          /BILLING1/g,
          esc(userSettings?.fullName || wholeName || firstName || "Customer"),
        )
        .replace(
          /BILLING2/g,
          esc(userSettings?.street || "Billing Address Line 1"),
        )
        .replace(
          /BILLING3/g,
          esc(
            userSettings
              ? `${userSettings.city}, ${userSettings.postalCode}`
              : "City, Postal Code",
          ),
        )
        .replace(/BILLING4/g, esc(userSettings?.country || "Country"))
        .replace(/BILLING5/g, "")
        .replace(
          /SHIPPING1/g,
          esc(userSettings?.fullName || firstName || wholeName || "Customer"),
        )
        .replace(
          /SHIPPING2/g,
          esc(userSettings?.street || "Shipping Address Line 1"),
        )
        .replace(
          /SHIPPING3/g,
          esc(
            userSettings
              ? `${userSettings.city}, ${userSettings.postalCode}`
              : "City, Postal Code",
          ),
        )
        .replace(/SHIPPING4/g, esc(userSettings?.country || "Country"))
        .replace(/SHIPPING5/g, "")
        .replace(
          /SHIPPING_JAN/g,
          esc(
            userSettings?.fullName || firstName || wholeName || "Jan Kowalski",
          ),
        )
        .replace(
          /BILLING_JAN/g,
          esc(
            userSettings?.fullName || wholeName || firstName || "Jan Kowalski",
          ),
        );

      const brandName = template.charAt(0).toUpperCase() + template.slice(1);
      const info = await transporter.sendMail({
        from: `"${brandName}" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `${brandName} — ${brand} ${product} (${size})`,
        html,
      });

      const accessStatus = checkUserAccess(interaction.user.id);
      let usageMessage = "";

      if (accessStatus.hasAccess) {
        console.log(
          `✅ Wysłano email [${template}]: ${info.messageId} | Użytkownik: ${interaction.user.tag} | Dostęp czasowy - NIEOGRANICZONE UŻYCIA`,
        );
        usageMessage = "📊 **Dostęp czasowy aktywny - nieograniczone użycia!**";
      } else {
        const remainingUses = decreaseUserLimit(interaction.user.id);
        console.log(
          `✅ Wysłano email [${template}]: ${info.messageId} | Użytkownik: ${interaction.user.tag} | Pozostało: ${remainingUses}`,
        );
        usageMessage = `📊 **Pozostałe użycia: ${remainingUses}**`;
      }

      await interaction.followUp({
        content: `✅ **Zamówienie wysłane pomyślnie!**\n\n**Szablon:** ${brandName}\n**Email:** ${email}\n**Produkt:** ${brand} ${product}\n**Rozmiar:** ${size}\n**Cena całkowita:** ${total}${currency}\n\n${usageMessage}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (err) {
    console.error("❌ Błąd interakcji:", err);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction
          .followUp({
            content: "❌ Wystąpił błąd podczas przetwarzania formularza.",
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      } else {
        await interaction
          .reply({
            content: "❌ Wystąpił błąd podczas przetwarzania formularza.",
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }
    } catch (replyErr) {
      console.error(
        "❌ Nie można wysłać odpowiedzi o błędzie:",
        replyErr.message,
      );
    }
  }
});
client.on("guildMemberAdd", async (member) => {
  try {
    // nowy użytkownik = brak dostępu
    setUserAccess(member.id, false);
    console.log(
      `🚫 Użytkownik ${member.user.tag} dołączył — dostęp ustawiony na FALSE`,
    );
  } catch (error) {
    console.error(
      "Błąd przy ustawianiu access = false dla nowego użytkownika:",
      error,
    );
  }
});

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generator Kodow Dostepu</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            min-height: 100vh;
            color: #fff;
            padding: 20px;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
        }
        h1 {
            text-align: center;
            margin-bottom: 30px;
            font-size: 2.5rem;
            background: linear-gradient(90deg, #e94560, #ff6b6b);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .card {
            background: rgba(255,255,255,0.05);
            border-radius: 16px;
            padding: 30px;
            margin-bottom: 20px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
        }
        .card h2 {
            margin-bottom: 20px;
            color: #e94560;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
        }
        input, select {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid rgba(255,255,255,0.1);
            border-radius: 8px;
            background: rgba(255,255,255,0.05);
            color: #fff;
            font-size: 16px;
            transition: all 0.3s;
        }
        input:focus, select:focus {
            outline: none;
            border-color: #e94560;
        }
        .btn {
            padding: 14px 28px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            margin-right: 10px;
            margin-bottom: 10px;
        }
        .btn-primary {
            background: linear-gradient(90deg, #e94560, #ff6b6b);
            color: #fff;
        }
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(233,69,96,0.4);
        }
        .btn-secondary {
            background: rgba(255,255,255,0.1);
            color: #fff;
            border: 2px solid rgba(255,255,255,0.2);
        }
        .btn-secondary:hover {
            background: rgba(255,255,255,0.2);
        }
        .codes-container {
            background: rgba(0,0,0,0.3);
            border-radius: 8px;
            padding: 20px;
            max-height: 400px;
            overflow-y: auto;
            margin-top: 20px;
            font-family: 'Courier New', monospace;
        }
        .code-item {
            padding: 8px 12px;
            margin: 4px 0;
            background: rgba(255,255,255,0.05);
            border-radius: 4px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .code-item.used {
            opacity: 0.5;
            text-decoration: line-through;
        }
        .badge {
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }
        .badge-lifetime {
            background: linear-gradient(90deg, #ffd700, #ffaa00);
            color: #000;
        }
        .badge-31days {
            background: linear-gradient(90deg, #00c9ff, #92fe9d);
            color: #000;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: rgba(255,255,255,0.05);
            border-radius: 12px;
            padding: 20px;
            text-align: center;
        }
        .stat-number {
            font-size: 2.5rem;
            font-weight: 700;
            background: linear-gradient(90deg, #e94560, #ff6b6b);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .stat-label {
            color: rgba(255,255,255,0.7);
            margin-top: 8px;
        }
        .auth-form {
            max-width: 400px;
            margin: 100px auto;
        }
        #generated-codes {
            display: none;
        }
        .hidden { display: none; }
    </style>
</head>
<body>
    <div class="container" id="main-container">
        <div class="auth-form card" id="auth-form">
            <h2>Logowanie</h2>
            <div class="form-group">
                <label>Haslo administratora</label>
                <input type="password" id="admin-password" placeholder="Wprowadz haslo...">
            </div>
            <button class="btn btn-primary" onclick="login()">Zaloguj</button>
        </div>
        
        <div id="admin-panel" class="hidden">
            <h1>Generator Kodow Dostepu</h1>
            
            <div class="stats" id="stats"></div>
            
            <div class="card">
                <h2>Generuj Nowe Kody</h2>
                <div class="form-group">
                    <label>Typ kodu</label>
                    <select id="code-type">
                        <option value="31days">31 Dni</option>
                        <option value="lifetime">Lifetime</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Ilosc kodow</label>
                    <input type="number" id="code-count" value="10" min="1" max="1000">
                </div>
                <button class="btn btn-primary" onclick="generateCodes()">Generuj Kody</button>
            </div>
            
            <div class="card" id="generated-codes">
                <h2>Wygenerowane Kody</h2>
                <button class="btn btn-secondary" onclick="downloadCodes()">Pobierz jako TXT</button>
                <button class="btn btn-secondary" onclick="copyAllCodes()">Kopiuj wszystkie</button>
                <div class="codes-container" id="new-codes-list"></div>
            </div>
            
            <div class="card">
                <h2>Pobierz Kody</h2>
                <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px;">
                    <button class="btn btn-primary" onclick="downloadByType('31days')" style="background: linear-gradient(90deg, #00c9ff, #92fe9d);">Pobierz 31 DNI (TXT)</button>
                    <button class="btn btn-primary" onclick="downloadByType('lifetime')" style="background: linear-gradient(90deg, #ffd700, #ffaa00);">Pobierz LIFETIME (TXT)</button>
                </div>
            </div>
            
            <div class="card">
                <h2>Wszystkie Kody</h2>
                <div class="form-group">
                    <label>Filtruj po typie</label>
                    <select id="filter-type" onchange="loadAllCodes()">
                        <option value="all">Wszystkie</option>
                        <option value="31days">31 Dni</option>
                        <option value="lifetime">Lifetime</option>
                        <option value="unused">Nieuzyte</option>
                        <option value="used">Uzyte</option>
                    </select>
                </div>
                <div class="codes-container" id="all-codes-list"></div>
            </div>
        </div>
    </div>
    
    <script>
        let authToken = '';
        let lastGeneratedCodes = [];
        
        function login() {
            const password = document.getElementById('admin-password').value;
            fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    authToken = data.token;
                    document.getElementById('auth-form').classList.add('hidden');
                    document.getElementById('admin-panel').classList.remove('hidden');
                    loadStats();
                    loadAllCodes();
                } else {
                    alert('Nieprawidlowe haslo!');
                }
            });
        }
        
        function loadStats() {
            fetch('/api/stats?token=' + authToken)
            .then(r => r.json())
            .then(data => {
                document.getElementById('stats').innerHTML = \`
                    <div class="stat-card">
                        <div class="stat-number">\${data.total}</div>
                        <div class="stat-label">Wszystkie kody</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">\${data.unused}</div>
                        <div class="stat-label">Nieuzyte</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">\${data.used}</div>
                        <div class="stat-label">Uzyte</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">\${data.lifetime}</div>
                        <div class="stat-label">Lifetime</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">\${data.days31}</div>
                        <div class="stat-label">31 Dni</div>
                    </div>
                \`;
            });
        }
        
        function generateCodes() {
            const type = document.getElementById('code-type').value;
            const count = parseInt(document.getElementById('code-count').value);
            
            fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, count, token: authToken })
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    lastGeneratedCodes = data.codes;
                    document.getElementById('generated-codes').style.display = 'block';
                    document.getElementById('new-codes-list').innerHTML = data.codes.map(code => 
                        \`<div class="code-item">\${code}</div>\`
                    ).join('');
                    loadStats();
                    loadAllCodes();
                } else {
                    alert(data.error);
                }
            });
        }
        
        function downloadCodes() {
            if (lastGeneratedCodes.length === 0) return;
            const type = document.getElementById('code-type').value;
            const blob = new Blob([lastGeneratedCodes.join('\\n')], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = \`kody_\${type}_\${new Date().toISOString().split('T')[0]}.txt\`;
            a.click();
        }
        
        function copyAllCodes() {
            if (lastGeneratedCodes.length === 0) return;
            navigator.clipboard.writeText(lastGeneratedCodes.join('\\n'));
            alert('Skopiowano ' + lastGeneratedCodes.length + ' kodow!');
        }
        
        function loadAllCodes() {
            const filter = document.getElementById('filter-type').value;
            fetch('/api/codes?token=' + authToken + '&filter=' + filter)
            .then(r => r.json())
            .then(data => {
                document.getElementById('all-codes-list').innerHTML = data.codes.map(c => 
                    \`<div class="code-item \${c.used ? 'used' : ''}">
                        <span>\${c.code}</span>
                        <span class="badge badge-\${c.codeType}">\${c.codeType === 'lifetime' ? 'LIFETIME' : '31 DNI'}</span>
                    </div>\`
                ).join('');
            });
        }
        
        function downloadByType(type) {
            fetch('/api/codes?token=' + authToken + '&filter=' + type)
            .then(r => r.json())
            .then(data => {
                const codes = data.codes.filter(c => !c.used).map(c => c.code);
                if (codes.length === 0) {
                    alert('Brak nieuzytych kodow ' + (type === 'lifetime' ? 'LIFETIME' : '31 DNI') + ' do pobrania!');
                    return;
                }
                const blob = new Blob([codes.join('\\n')], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'kody_' + type + '_' + new Date().toISOString().split('T')[0] + '.txt';
                a.click();
                alert('Pobrano ' + codes.length + ' kodow ' + (type === 'lifetime' ? 'LIFETIME' : '31 DNI') + '!');
            });
        }
        
        document.getElementById('admin-password').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') login();
        });
    </script>
</body>
</html>
  `);
});

let authTokens = {};

app.post("/api/login", (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    const token = crypto.randomBytes(32).toString('hex');
    authTokens[token] = { createdAt: Date.now() };
    res.json({ success: true, token });
  } else {
    res.json({ success: false });
  }
});

const checkAuth = (token) => {
  if (!authTokens[token]) return false;
  if (Date.now() - authTokens[token].createdAt > 24 * 60 * 60 * 1000) {
    delete authTokens[token];
    return false;
  }
  return true;
};

app.get("/api/stats", async (req, res) => {
  if (!checkAuth(req.query.token)) {
    return res.json({ error: "Unauthorized" });
  }
  const data = await loadRedeemCodesDB();
  const stats = {
    total: data.codes.length,
    unused: data.codes.filter(c => !c.used).length,
    used: data.codes.filter(c => c.used).length,
    lifetime: data.codes.filter(c => c.codeType === 'lifetime').length,
    days31: data.codes.filter(c => c.codeType === '31days').length
  };
  res.json(stats);
});

app.post("/api/generate", async (req, res) => {
  if (!checkAuth(req.body.token)) {
    return res.json({ error: "Unauthorized" });
  }
  
  const { type, count } = req.body;
  if (!type || !count || count < 1 || count > 1000) {
    return res.json({ error: "Invalid parameters" });
  }
  
  const data = await loadRedeemCodesDB();
  const newCodes = [];
  
  for (let i = 0; i < count; i++) {
    let code;
    do {
      code = generateCode();
    } while (data.codes.some(c => c.code === code) || newCodes.includes(code));
    
    await saveCodeToDB(code, type);
    newCodes.push(code);
  }
  
  res.json({ success: true, codes: newCodes });
});

app.get("/api/codes", async (req, res) => {
  if (!checkAuth(req.query.token)) {
    return res.json({ error: "Unauthorized" });
  }
  
  const filter = req.query.filter || 'all';
  const data = await loadRedeemCodesDB();
  let codes = data.codes;
  
  if (filter === '31days') {
    codes = codes.filter(c => c.codeType === '31days');
  } else if (filter === 'lifetime') {
    codes = codes.filter(c => c.codeType === 'lifetime');
  } else if (filter === 'unused') {
    codes = codes.filter(c => !c.used);
  } else if (filter === 'used') {
    codes = codes.filter(c => c.used);
  }
  
  res.json({ codes });
});

const PORT = 5000;

async function startApp() {
  await initDatabase();
  
  app.listen(PORT, "0.0.0.0", () => {
    console.log("Web panel dostepny na porcie " + PORT);
  });
  
  await client.login(process.env.DISCORD_TOKEN);
}

startApp().catch(err => {
  console.error("Blad uruchamiania aplikacji:", err);
  process.exit(1);
});
