const config = require("../config/config");
const chalk = require("chalk");
const Table = require("cli-table3");

function set(key, value) {
  const validKeys = ["max-retries", "backoff-base", "job-timeout"];

  if (!validKeys.includes(key)) {
    throw new Error(
      `Invalid configuration key. Valid keys: ${validKeys.join(", ")}`
    );
  }

  try {
    config.set(key, value);
    console.log(chalk.green("✓"), `Configuration updated: ${key} = ${value}`);
  } catch (error) {
    throw new Error(`Failed to set configuration: ${error.message}`);
  }
}

function get(key) {
  if (key) {
    // Get single value
    const camelKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    const value = config.get(camelKey);

    if (value === undefined) {
      throw new Error(`Configuration key "${key}" not found`);
    }

    console.log(chalk.cyan(key + ":"), value);
  } else {
    // Get all values
    const allConfig = config.get();

    console.log(chalk.bold.blue("\n⚙️  Configuration\n"));

    const table = new Table({
      head: [chalk.cyan("Setting"), chalk.cyan("Value")],
      colWidths: [20, 15],
    });

    // Convert camelCase to kebab-case for display
    Object.keys(allConfig).forEach((key) => {
      const kebabKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
      table.push([kebabKey, allConfig[key]]);
    });

    console.log(table.toString());
    console.log(); // Empty line at the end
  }
}

module.exports = {
  set,
  get,
};
