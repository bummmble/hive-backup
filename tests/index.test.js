import test from 'ava';
import Backup from '../src/index';

const basicConfig = {
  directory: 'backup',
  mongoDirectory: 'mongo',
  redisDirectory: 'redis',
  mongo: '',
  redis: '',
  aws: {
    accessKeyId: 'adfadf',
    secretAccessKey: 'adfasdf',
  },
};

test('Should throw error if directory is not a string', (t) => {
  const conf = Object.assign(basicConfig, {});
  conf.directory = true;
  try {
    const backup = new Backup(5, conf);
  } catch (err) {
    t.true(err.message ===
        'hive-backup: Directory must be a string! received boolean');
  }
});

test('Should throw error if mongo has output flag', (t) => {
  const conf = Object.assign(basicConfig, {});
  conf.directory = 'backup';
  conf.mongo = '--out';
  try {
    const backup = new Backup(5, conf);
  } catch (err) {
    t.true(err.message === 'hive-backup: Output flag is disabled, please remove it');
  }
});
