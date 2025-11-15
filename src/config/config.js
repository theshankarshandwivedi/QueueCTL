const fs = require("fs");
const path = require("path");

const CONFIG_FILE = path.join(__dirname, "../../data/config.json");
const DATA_DIR = path.join(__dirname, "../../data");

const DEFAULT_CONFIG = {
  maxRetries: 3,
  backoffBase: 2,
  jobTimeout: 300000, // 5 minutes in milliseconds
};

class ConfigManager {
  constructor() {
    this.ensureDataDirectory();
    this.config = this.load();
  }

  ensureDataDirectory() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  load() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const data = fs.readFileSync(CONFIG_FILE, "utf8");
        return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
      }
    } catch (error) {
      console.warn("Error loading config, using defaults:", error.message);
    }
    return { ...DEFAULT_CONFIG };
  }

  save() {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
    } catch (error) {
      throw new Error(`Failed to save config: ${error.message}`);
    }
  }

  get(key) {
    if (key) {
      return this.config[key];
    }
    return this.config;
  }

  set(key, value) {
    // Convert kebab-case to camelCase
    const camelKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());

    // Validate and convert value
    let parsedValue = value;
    if (
      camelKey === "maxRetries" ||
      camelKey === "backoffBase" ||
      camelKey === "jobTimeout"
    ) {
      parsedValue = parseInt(value);
      if (isNaN(parsedValue) || parsedValue < 0) {
        throw new Error(`${key} must be a positive number`);
      }
    }

    this.config[camelKey] = parsedValue;
    this.save();
  }

  getMaxRetries() {
    return this.config.maxRetries;
  }

  getBackoffBase() {
    return this.config.backoffBase;
  }

  getJobTimeout() {
    return this.config.jobTimeout;
  }
}

module.exports = new ConfigManager();
