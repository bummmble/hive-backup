import os from 'os';
import path from 'path';
import delay from 'delay';
import fs from 'fs-extra';
import autoBind from 'auto-bind';
import AWS from 'aws-sdk';
import { exec } from 'child-process-promise';

/* eslint-disable no-unused-vars */
class Backup {
  constructor(bucket = process.env.BACKUP_AWS_BUCKET, config = {}) {
    if (typeof bucket === 'object') {
      config = bucket;
    }

    this.config = Object.assign(
      {
        directory: 'backup',
        mongoDirectory: 'mongo',
        redisDirectory: 'redis',
        mongo: '',
        redis: '',
        redisConfPath:
          os.platform() === 'darwin'
            ? '/usr/local/etc/redis.conf'
            : '/etc/redis/redis.conf',
        redisBgSaveCheckInterval: 300,
        aws: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      },
      config,
    );

    if (
      typeof bucket === 'object' &&
      typeof this.config.aws === 'object' &&
      typeof this.config.aws.params === 'object' &&
      typeof this.config.aws.params.Bucket === 'string'
    ) {
      bucket = this.config.aws.params.Bucket;
    }

    this.bucket = bucket;

    if (typeof this.config.directory !== 'string') {
      throw new Error(`hive-backup: Directory must be a string! received ${typeof this.config
        .directory}`);
    }

    if (this.config.directory.charAt(this.config.length - 1) !== '/') {
      this.config.directory += '/';
    }

    if (this.config.directory.charAt(0) === '/') {
      this.config.directory = this.config.directory.substring(1);
    }

    if (
      this.config.mongo.includes('-o') ||
      this.config.mongo.includes('--out')
    ) {
      throw new Error('hive-backup: Output flag is disabled, please remove it');
    }

    autoBind(this);
  }

  backup(tasks = ['mongo', 'redis']) {
    return Promise.all(tasks.map(task =>
      new Promise(async (resolve, reject) => {
        try {
          const filePath = await this[task]();
          const result = await this.upload(
            this.config[`${task}Directory`],
            filePath,
          );
          resolve(result);
        } catch (err) {
          reject(err);
        }
      })));
  }

  upload(dir, filePath) {
    return new Promise(async (resolve, reject) => {
      try {
        if (typeof this.bucket !== 'string' || this.bucket.trim() === '') {
          throw new Error('hive-backup: s3 bucket name is required');
        }
        if (typeof this.config.aws !== 'object') {
          throw new Error(`hive-backup: AWS config must be an object. Recieved ${typeof this
            .config.aws}`);
        }

        if (typeof this.config.aws.accessKeyId !== 'string') {
          throw new Error(`hive-backup: AWS Access Key Id invalid. It should be a string. Received ${typeof this
            .config.aws.accessKeyId}`);
        }

        if (typeof this.config.aws.secretAccessKey !== 'string') {
          throw new Error(`hive-backup: AWS Secret Key is invalid. IT should be a string. Received ${typeof this
            .config.aws.secretAccessKey}`);
        }

        const s3 = new AWS.S3(this.config.aws);
        const params = {
          Bucket: this.bucket,
          key: `${this.config.directory}${dir}/${path.basename(filePath)}`,
          ACL: 'private',
          Body: fs.createReadStream(filePath),
          ServerSideEncryption: 'AES256',
        };

        const result = await s3.upload(params).promise();
        await fs.remove(filePath);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
  }

  mongo() {
    return new Promise(async (resolve, reject) => {
      try {
        const archive = path.join(
          __dirname,
          `${new Date().toISOString()}.archive.gz`,
        );

        await exec(`mongodump ${this.config.mongo} --archive=${archive} --gzip`);
        resolve(archive);
      } catch (err) {
        reject(err);
      }
    });
  }

  getRedisSavePath(lastSave) {
    return new Promise(async (resolve, reject) => {
      try {
        await delay(this.config.redisBgSaveCheckInterval);
        const { stdout } = await exec(`echo lastsave | redis-cli ${this.config.redis}`);
        const unixTime = parseInt(stdout.replace(/\D/g, ''), 10);

        if (unixTime < lastSave) {
          return this.getRedisSavePath(lastSave);
        }

        return resolve(`${os.tempdir()}/${new Date(unixTime * 1000).toISOString()}.dump.rdb`);
      } catch (err) {
        return reject(err);
      }
    });
  }

  redis() {
    return new Promise(async (resolve, reject) => {
      try {
        const conf = await fs.readFile(this.config.redisConfPath, 'utf-8');
        const rdbFileName = conf
          .substring(conf.indexOf('\ndbfilename'))
          .split('\n')[1]
          .split(' ')[1];
        const rdbDirectory = conf
          .substring(conf.indexOf('\ndir'))
          .split('\n')[1]
          .split(' ')[1];
        const rdbFilePath = path.join(rdbDirectory, rdbFileName);

        let lastSave = await exec(`echo lastsave | redis-cli ${this.config.redis}`);
        lastSave = parseInt(lastSave.stdout.replace(/\D/g, ''), 10);

        await exec(`echo bgsave | redis-cli ${this.config.redis}`);
        const filePath = await this.getRedisSavePath(lastSave);
        await fs.copy(rdbFilePath, filePath);
        resolve(filePath);
      } catch (err) {
        reject(err);
      }
    });
  }
}
