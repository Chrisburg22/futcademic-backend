import express, { Request, Response } from 'express';
import cors from 'cors';
import apiRoutes from './routes/index';

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.use('/api', apiRoutes);

app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'Futcamedic API is running correctly in TS!' });
});

export default app;
