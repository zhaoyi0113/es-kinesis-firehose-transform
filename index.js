const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { default: axios } = require('axios');

const ES_ENDPOINT = 'http://es-entrypoint:9200';

let app = express();

const port = 8080;

app.use(
  bodyParser.urlencoded({
    extended: true,
  }),
);
app.use(bodyParser.json({ limit: '50mb' }));

const processRecords = async (req, res, type) => {
  console.log('get a request:');
  const records = req.body.records.map((record) => Buffer.from(record.data, 'base64').toString('utf-8'));
  console.log('records:', records);

  let data = '';
  records.forEach((record) => (data += JSON.stringify(record)));
  const today = new Date();
  const index = `${type}-${today.getFullYear()}-${today.getMonth()}-${today.getDate()}}`;

  const url = `${ES_ENDPOINT}/${index}/_bulk`;
  console.log('send to es:', url, data);
  try {
    await axios.put(`${ES_ENDPOINT}/${index}`);
  } catch (err) {
    console.error('create index error:', err);
  }
  try {
    await axios.post(url, data, {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send to es error:', err);
  }
  res.set({
    'X-Amz-Firehose-Protocol-Version': '1.0',
    'X-Amz-Firehose-Request-Id': req.requestId,
    'Content-Type': 'application/json',
  });
  console.log('response:', { requestId: req.requestId, timestamp: req.timestamp });
  res.json({ requestId: req.requestId, timestamp: req.timestamp });
};

app.post('/logs', cors(), (req, res) => processRecords(req, res, 'logs'));

app.post('/metrics', cors(), (req, res) => processRecords(req, res, 'metrics'));

app.listen(port, '0.0.0.0', () => {
  console.log(`CORS-enabled web server listening on port ${port}`);
});
