import express from 'express';
import indexRouter from './routes/index.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/', indexRouter);

app.listen(PORT, () => {
  console.log(`student-api listening on port ${PORT}`);
});

export default app;
