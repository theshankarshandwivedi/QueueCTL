const queue = require('../core/queue');
const storage = require('../storage/fileStorage');
const chalk = require('chalk');
const http = require('http');

function printMetrics() {
  const stats = queue.getStats();
  const workers = storage.loadWorkers();

  console.log(chalk.bold.blue('\nQueue Metrics\n'));
  console.log('Total jobs:', stats.total);
  console.log('Pending:', stats.pending);
  console.log('Processing:', stats.processing);
  console.log('Completed:', stats.completed);
  console.log('Failed:', stats.failed);
  console.log('Dead:', stats.dead);

  console.log('\nActive workers:', workers.length);
}

function serve(port = 8080) {
  const server = http.createServer((req, res) => {
    const stats = queue.getStats();
    const workers = storage.loadWorkers();
    const jobs = queue.getAllJobs();

    if (req.url === '/' || req.url.startsWith('/?')) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.write('<html><head><title>QueueCTL Metrics</title></head><body>');
      res.write('<h1>Queue Metrics</h1>');
      res.write(`<p>Total: ${stats.total} | Pending: ${stats.pending} | Completed: ${stats.completed} | Dead: ${stats.dead}</p>`);
      res.write('<h2>Jobs</h2><ul>');
      jobs.slice(0,200).forEach(j=> {
        res.write(`<li>${j.id} - ${j.command} - ${j.state} - attempts:${j.attempts}</li>`);
      });
      res.write('</ul>');
      res.write('</body></html>');
      res.end();
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  server.listen(port, () => {
    console.log(chalk.green(`Metrics server listening on http://localhost:${port}`));
  });

  return server;
}

module.exports = { printMetrics, serve };
