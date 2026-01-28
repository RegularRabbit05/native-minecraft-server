const serverVersionName = process.argv[2];
const serverProtoVersion = Number(process.argv[3]);

const mcdata = require("minecraft-data/data.js").pc;
const { nearestVersion, sortVersions } = require("./versionUtils.js");

const supportedVersions =
  require("minecraft-data/minecraft-data/data/pc/common/versions.json").filter(
    (v) => /^\d+\.\d+\.\d*$/.test(v), // FIx this when they mix up the versioning scheme
  );

const usingVersion = nearestVersion(serverVersionName, supportedVersions);

if (usingVersion !== serverVersionName) {
  console.log(
    `Using version ${usingVersion} to connect to ${serverVersionName}`,
  );
  mcdata[serverVersionName] = structuredClone(mcdata[usingVersion]);
  mcdata[serverVersionName].version = {
    version: serverProtoVersion,
    minecraftVersion: serverVersionName,
    majorVersion: usingVersion.split(".").slice(0, 2).join("."),
    releaseType: "release",
  };
}

const mineflayerVersionSupport = require("mineflayer/lib/version.js");
if (!mineflayerVersionSupport.testedVersions.includes(serverVersionName)) {
  mineflayerVersionSupport.testedVersions.push(serverVersionName);
  mineflayerVersionSupport.testedVersions = sortVersions(
    mineflayerVersionSupport.testedVersions,
  );
  mineflayerVersionSupport.latestSupportedVersion =
    mineflayerVersionSupport.testedVersions[
      mineflayerVersionSupport.testedVersions.length - 1
    ];
  mineflayerVersionSupport.oldestSupportedVersion =
    mineflayerVersionSupport.testedVersions[0];
}
// Actual code
const mineflayer = require("mineflayer");
const { ping } = require("minecraft-protocol");

(async () => {
  // Create a bot to connect to the server
  const bot = mineflayer.createBot({
    host: "127.0.0.1", // Replace with your server's IP or domain
    port: 25565, // Default Minecraft port
    auth: "microsoft",
    username: "MidwayDesert719",
    "profilesFolder": "./profiles"
  });

  bot.once("spawn", () => {
    console.log("Bot connected to the server!");
    setTimeout(() => {
      console.log("Bot disconnecting after 5 seconds...");
      bot.quit("Test complete");
    }, 5000);
  });

  bot.on("error", (err) => {
    console.log("Error:", err);
  });

  bot.on("end", () => {
    console.log("Bot disconnected.");
  });
})();
