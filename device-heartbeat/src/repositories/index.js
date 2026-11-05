import { env } from "../config/env.js";
import { PostgresDeviceRepository } from "./deviceRepository.js";
import { InMemoryDeviceRepository } from "./inMemoryRepository.js";
export let deviceRepository =
  env.DB_DRIVER === "postgres"
    ? new PostgresDeviceRepository()
    : new InMemoryDeviceRepository();
export function setInMemoryDriver() {
  deviceRepository = new InMemoryDeviceRepository();
  return { deviceRepository };
}
export { InMemoryDeviceRepository, PostgresDeviceRepository };
