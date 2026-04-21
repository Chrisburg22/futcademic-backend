import * as dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

import express, { Request, Response } from 'express';
import cors from 'cors';
import apiRoutes from './routes/index'; // The resolved path works even if no extension

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Montar rutas
app.use('/api', apiRoutes);

app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'Futcamedic API is running correctly in TS!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor TS corriendo en puerto ${PORT}`);
});

export default app;
