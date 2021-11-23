const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const zlib = require('zlib');
const { Client } = require('@elastic/elasticsearch');
const { convertMetric } = require('./metricsConverter');

const ES_ENDPOINT = process.env.ES_HOST; // || 'http://elk-es-http:9200';
const ES_USER_NAME = process.env.ES_USER_NAME;
const ES_PWD = process.env.ES_PWD;

const esclient = new Client({
  node: ES_ENDPOINT,
  auth: ES_USER_NAME
    ? {
        username: ES_USER_NAME,
        password: ES_PWD,
      }
    : undefined,
});
let app = express();

const port = 8080;

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
app.use(bodyParser.json({ limit: '50mb' }));

const formatLogMessage = (log) => {
  let message = { '@message': '' };
  if (log.message) {
    try {
      message = JSON.parse(log.message);
    } catch (err) {
      message = { '@message': log.message };
    }
  }
  return message;
};

const createIndex = async (esclient, index, type) => {
  try {
    const { body } = await esclient.indices.exists({
      index,
    });
    if (!body) {
      console.log('create index ', index);
      await esclient.indices.create({
        index,
      });
      const mappingProps = { timestamp: { type: 'date' } };
      if (type === 'logs') {
        mappingProps.logGroup = { type: 'text', fielddata: true };
      }
      await esclient.indices.putMapping({
        index,
        body: { properties: mappingProps },
      });
    }
  } catch (err) {
    console.error('create index error:', err);
  }
};

const formatNumber = (num, len = 2) => {
  return `${num}`.padStart(len, '0');
};

const processRecords = async (req, res, type) => {
  console.log('req:', type, req.body.timestamp);
  const response = {
    requestId: req.body.requestId,
    timestamp: req.body.timestamp,
  };
  const today = new Date();
  const index = `aws-${type}-${today.getFullYear()}-${formatNumber(
    today.getMonth() + 1
  )}-${formatNumber(today.getDate())}`;

  const records = [];
  req.body.records.forEach((record) => {
    let str = '';
    if (type === 'metrics') {
      str = Buffer.from(record.data, 'base64').toString('utf-8');
    } else if (type === 'logs') {
      str = zlib
        .unzipSync(Buffer.from(record.data, 'base64'))
        .toString('utf-8');
    }
    str.split('\n').forEach((d) => {
      try {
        if (d) {
          const j = JSON.parse(d);
          if (type === 'logs') {
            const { logEvents } = j;
            delete j.logEvents;
            logEvents.forEach((log) => {
              const message = formatLogMessage(log);
              delete log.message;
              records.push({ index: { _index: index } });
              records.push({ ...j, ...log, ...message });
            });
          } else if (type === 'metrics') {
            const mRecord = convertMetric(j);
            if (mRecord) {
              records.push({ index: { _index: index } });
              records.push(mRecord);
            }
          }
        }
      } catch (err) {
        console.error(err);
        console.error('failed to decode record.', d);
      }
    });
  });

  if (records.length === 0) {
    res.json(response);
    return;
  }

  await createIndex(esclient, index, type);
  try {
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
  res.json(response);
};

app.post('/logs', cors(), (req, res) => processRecords(req, res, 'logs'));

app.post('/metrics', cors(), (req, res) => processRecords(req, res, 'metrics'));

app.listen(port, '0.0.0.0', () => {
  console.log(`CORS-enabled web server listening on port ${port}`);
});
