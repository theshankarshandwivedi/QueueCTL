const queue = require('../core/queue');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

function tailFileFollow(filePath) {
  // print the last 1000 chars then follow
  let pos = 0;
  try {
    const stats = fs.statSync(filePath);
    pos = Math.max(0, stats.size - 1000);
    const stream = fs.createReadStream(filePath, { start: pos, encoding: 'utf8' });
    stream.on('data', (chunk) => process.stdout.write(chunk));

    // watch for changes
    fs.watchFile(filePath, { interval: 500 }, (curr, prev) => {
      if (curr.size > prev.size) {
        const rs = fs.createReadStream(filePath, { start: prev.size, encoding: 'utf8' });
        rs.on('data', (c) => process.stdout.write(c));
      }
    });
  } catch (e) {
    console.error(chalk.red('Failed to open file for tail:'), e.message);
    process.exit(1);
  }
}

function tail(jobId, options = {}) {
  const job = queue.getJob(jobId);
  if (!job) {
    console.error(chalk.red('Job not found:'), jobId);
    process.exit(1);
  }

  const outFile = job.output_file || path.join(__dirname, '../../data/outputs', `${job.id}.log`);

  if (!fs.existsSync(outFile)) {
    console.error(chalk.yellow('Output file not found:'), outFile);
    process.exit(1);
  }

  if (options.follow) {
    tailFileFollow(outFile);
  } else {
    // print last 1000 chars
    try {
      const stats = fs.statSync(outFile);
      const start = Math.max(0, stats.size - 1000);
      const fd = fs.openSync(outFile, 'r');
      const buffer = Buffer.alloc(Math.min(1000, stats.size));
      fs.readSync(fd, buffer, 0, buffer.length, start);
      fs.closeSync(fd);
      console.log(buffer.toString());
    } catch (e) {
      console.error(chalk.red('Failed to read output file:'), e.message);
      process.exit(1);
    }
  }
}

module.exports = { tail };
