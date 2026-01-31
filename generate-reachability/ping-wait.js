const { ping } = require("minecraft-protocol");

const timeout = 2;

function checkServerStatus(host, port = 25565) {
  return Promise.race([
    new Promise((resolve, reject) => {
      ping({ host, port }, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    }),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Timed out")), timeout * 1000);
    }),
  ]);
}
const delay = 5;

(async () => {
  let status;
  while (true) {
    try {
      status = await checkServerStatus("127.0.0.1");
      break;
    } catch (e) {
      process.stderr.write(`Got error ${e.message}\n`);
      process.stderr.write(`Trying again in ${delay} seconds\n`);
      await new Promise((resolve) => setTimeout(resolve, delay * 1000));
    }
  }
  console.log(`${status.version.name} ${status.version.protocol}`);
})();
