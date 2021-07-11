const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const zlib = require('zlib');
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

const formatLogMessage = (log) => {
  let message = {'@message': ''};
  if (log.message) {
    try{
      message = JSON.parse(log.message);
    }catch(err){
      message = {'@message': log.message}
    }
  }
  return JSON.stringify(message, null, 4);
}

const createIndex = async (esclient, index, type) => {
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
      const mappingProps = { timestamp: { type: 'date' } };
      if (type === 'logs') {
        mappingProps.logGroup = {type: 'text', fielddata: true}
      }
      await esclient.indices.putMapping({
        index,
        body: { properties: mappingProps },
      });
    }
  } catch (err) {
    console.error('create index error:', err);
  }
}

const processRecords = async (req, res, type) => {
	console.log('req:', type, req.body.requestId, req.body.timestmap);
  const response = { requestId: req.body.requestId, timestamp: req.body.timestamp };
  const today = new Date();
  const index = `aws-${type}-${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;

  const records = [];
  req.body.records.forEach((record) => {
    let str = '';
    if (type === 'metrics') {
      str = Buffer.from(record.data, 'base64').toString('utf-8');
    } else if (type === 'logs') {
      str = zlib.unzipSync(Buffer.from(record.data, 'base64')).toString('utf-8');
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
              records.push({ ...j, ...log, message });
            });
          } else {
            records.push({ index: { _index: index } });
            records.push(j);
          }
        }
      } catch (err) {
        console.error('failed to decode record.', d);
      }
    });
  });

  if (records.length === 0) {
    console.log('record lenght is 0');
    res.json(response);
    return;
  }

  await createIndex(esclient, index, type);
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
  console.log('response:', response);
  res.json(response);
};

app.post('/logs', cors(), (req, res) => processRecords(req, res, 'logs'));

app.post('/metrics', cors(), (req, res) => processRecords(req, res, 'metrics'));

app.listen(port, '0.0.0.0', () => {
  console.log(`CORS-enabled web server listening on port ${port}`);
});
