import 'dotenv/config';
import config from 'config';
import express from 'express';
import bodyParser from 'body-parser';
import ip from 'ip';
import { wizRouter } from './routes/wiz';

const appName = config.get('app.name');
const appPort = config.get('app.port');

const app = express();
app.use(bodyParser.json({ limit: '50mb', type: 'application/json' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

app.use('/wiz', wizRouter);

app.listen(appPort, () => {
  console.log(`${appName} is listening on ${ip.address()}:${appPort}...`);
});


