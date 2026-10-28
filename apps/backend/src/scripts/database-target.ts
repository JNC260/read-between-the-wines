import { config } from "../lib/config";

// Hosts that mean "this machine": the Docker Postgres from docker-compose.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "host.docker.internal"]);

const url = new URL(config.DATABASE_URL);

// Which database a script is about to change, without the password:
// "localhost:5432/read_between_the_wines".
export const databaseTarget = {
  label: `${url.hostname}:${url.port || "5432"}${url.pathname}`,
  isLocal: LOCAL_HOSTS.has(url.hostname),
};

// Every script that writes prints this first, so pointing one at production
// by accident is visible before anything changes.
export const printDatabaseTarget = () => {
  console.log(
    `Target database: ${databaseTarget.label}${databaseTarget.isLocal ? " (local)" : " (REMOTE)"}`,
  );
};
