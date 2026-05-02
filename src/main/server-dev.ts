import { createServer } from './server';

const isDev = process.env.NODE_ENV === 'development';
const PORT = parseInt(process.env.PORT || '3006', 10);

const app = createServer(isDev);

app.listen(PORT, () => {
  console.log(`🚀 NonePOS API server running on http://localhost:${PORT}`);
  console.log(`📊 Database: ${isDev ? 'Development mode' : 'Production mode'}`);
});