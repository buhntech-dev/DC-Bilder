const net = require("node:net");
const { parseMinecraftAddress } = require("./minecraft-status");

function createRconPacket(id, type, payload = "") {
  const data = Buffer.from(String(payload), "utf8");
  const body = Buffer.alloc(8 + data.length + 2);
  body.writeInt32LE(id, 0);
  body.writeInt32LE(type, 4);
  data.copy(body, 8);
  body[body.length - 2] = 0;
  body[body.length - 1] = 0;
  const framed = Buffer.alloc(body.length + 4);
  framed.writeInt32LE(body.length, 0);
  body.copy(framed, 4);
  return framed;
}

function readRconPacket(buffer) {
  if (buffer.length < 4) return null;
  const length = buffer.readInt32LE(0);
  if (length < 10 || length > 8192) throw new Error("Ungültiges RCON-Paket.");
  if (buffer.length < length + 4) return null;
  const body = buffer.subarray(4, length + 4);
  return {
    id: body.readInt32LE(0),
    type: body.readInt32LE(4),
    payload: body.subarray(8, body.length - 2).toString("utf8"),
    remaining: buffer.subarray(length + 4)
  };
}

function executeRconCommand(command, options = {}) {
  const password = options.password ?? process.env.RCON_PASSWORD;
  if (!password) return Promise.reject(new Error("RCON_PASSWORD ist nicht konfiguriert."));
  const address = options.address || process.env.MINECRAFT_ADDRESS || "Communety.aternos.me:18884";
  const { host: defaultHost } = parseMinecraftAddress(address);
  const host = options.host || process.env.RCON_HOST || defaultHost;
  const port = Number(options.port || process.env.RCON_PORT || 25575);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return Promise.reject(new Error("Ungültiger RCON-Port."));
  return new Promise((resolve, reject) => {
    let phase = "auth";
    let buffer = Buffer.alloc(0);
    let settled = false;
    const socket = net.createConnection({ host, port });
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve(result);
    };
    socket.setTimeout(options.timeoutMs || 5000);
    socket.once("connect", () => socket.write(createRconPacket(1, 3, password)));
    socket.on("data", chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      try {
        let packet;
        while ((packet = readRconPacket(buffer))) {
          buffer = packet.remaining;
          if (phase === "auth") {
            if (packet.id === -1) return finish(new Error("RCON-Authentifizierung fehlgeschlagen. Prüfe Passwort und RCON-Freigabe."));
            if (packet.id !== 1) continue;
            phase = "command";
            socket.write(createRconPacket(2, 2, command));
            continue;
          }
          if (packet.id === 2) return finish(null, packet.payload);
        }
      } catch (error) {
        finish(error);
      }
    });
    socket.once("timeout", () => finish(new Error("RCON-Zeitüberschreitung.")));
    socket.once("error", error => finish(new Error("RCON-Verbindung fehlgeschlagen: " + error.message)));
    socket.once("end", () => {
      if (!settled) finish(new Error("RCON-Server hat die Verbindung geschlossen."));
    });
  });
}

async function addMinecraftWhitelist(name) {
  if (!/^[A-Za-z0-9_]{3,16}$/.test(String(name))) throw new Error("Ungültiger Minecraft-Name.");
  if (!process.env.RCON_PASSWORD) return { configured: false, response: "" };
  const response = await executeRconCommand("whitelist add " + name);
  return { configured: true, response };
}

module.exports = { createRconPacket, readRconPacket, executeRconCommand, addMinecraftWhitelist };
