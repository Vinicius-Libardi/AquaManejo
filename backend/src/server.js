const { createApp } = require('./app');
const { initializeDatabase } = require('./database');

// Garante que o arquivo e o esquema existam antes de iniciar o servidor.
const database = initializeDatabase();
const app = createApp({ database });
const port = process.env.PORT || 3000;

const server = app.listen(port, () => {
  console.log(`Servidor AquaManejo iniciado na porta ${port}.`);
});

function shutdown() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
