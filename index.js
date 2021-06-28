const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Client } = require('@elastic/elasticsearch');

const ES_ENDPOINT = 'http://es-entrypoint:9200';

const esclient = new Client({
  node: ES_ENDPOINT,
});
let app = express();

const port = 8080;

app.use(
  bodyParser.urlencoded({
    extended: true,
  }),
);
app.use(bodyParser.json({ limit: '50mb' }));

const processRecords = async (req, res, type) => {
  console.log('req:', type, req.body.requestId, req.body.timestmap);
  const today = new Date();
  const index = `aws-${type}-${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;

  const records = [];
  req.body.records.forEach((record) => {
    Buffer.from(record.data, 'base64')
      .toString('utf-8')
      .split('\n')
      .forEach((d) => {
        try {
          const j = JSON.parse(d);
          records.push({ index: { _index: index } });
          records.push(j);
        } catch (err) {}
      });
  });

  // let data = '';
  // records.forEach((record) => (data += JSON.stringify(record)));
  try {
    const { body } = await esclient.indices.exists({
      index,
    });
    console.log('index exists:', body);
    if (!body) {
      console.log('create index ', index);
      await esclient.indices.create({
        index,
      });
      await esclient.indices.putMapping({
        index,
        body: { properties: { timestamp: { type: 'date' } } },
      });
    }
  } catch (err) {
    console.error('create index error:', err);
  }
  try {
    console.log('send ', records.length, ' documents.');
    console.log('records:', records[0], records[1]);
    await esclient.bulk({
      index,
      body: records,
    });
  } catch (err) {
    console.error('send to es error:', err);
  }
  res.set({
    'X-Amz-Firehose-Protocol-Version': '1.0',
    'X-Amz-Firehose-Request-Id': req.requestId,
    'Content-Type': 'application/json',
  });
  console.log('response:', { requestId: req.body.requestId, timestamp: req.body.timestamp });
  res.json({ requestId: req.body.requestId, timestamp: req.body.timestamp });
};

app.post('/logs', cors(), (req, res) => processRecords(req, res, 'logs'));

app.post('/metrics', cors(), (req, res) => processRecords(req, res, 'metrics'));

app.listen(port, '0.0.0.0', () => {
  console.log(`CORS-enabled web server listening on port ${port}`);
});
