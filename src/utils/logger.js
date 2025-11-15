const chalk = require("chalk");

const isDebug = process.env.QUEUECTL_DEBUG === "1" || false;

function timestamp() {
  return chalk.dim(new Date().toISOString());
}

function info(...args) {
  console.log(timestamp(), chalk.blue("ℹ"), ...args);
}

function warn(...args) {
  console.warn(timestamp(), chalk.yellow("⚠"), ...args);
}

function error(...args) {
  console.error(timestamp(), chalk.red("✖"), ...args);
}

function success(...args) {
  console.log(timestamp(), chalk.green("✓"), ...args);
}

function debug(...args) {
  if (isDebug) {
    console.log(timestamp(), chalk.magenta("dbg"), ...args);
  }
}

module.exports = {
  info,
  warn,
  error,
  success,
  debug,
};
