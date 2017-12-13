# Hive-Backup

> An extremely simple ecnrypted and compressed backup to Amazon S3 for MongoDB/Redis

## Usage

### Redis Permission Requirements

The user running the CLI or interacting with the API needs permission to access your Redis database backup file path.

> Note that if you have changed the paths below from the defaults then you will need to adjust the below

* Mac: If you installed Redis with 'brew install redis' and have the default permissions, you're good out of the box!

* Ubuntu: Run the following commands, replacig 'user' with your currently logged in username (type 'whoami' to discover this)

```sh
sudo adduser user redis
sudo chown -R redis:redis /etc/redis
sudo chown -R redis:redis /var/lib/redis
sudo chmod g+wr /etc/redis/redis.conf
sudo chmod g+wr /var/lib/redis/dump.rdb
```

### API

* If you want to backup all databases:

```js
const Backup = require('hive-backup');
const myBackup = new Backup('your-s3-bucket-name');

// backup mongo and redis, then upload the results to Amazon s3
myBackup
    .backup()
    .then(console.log)
    .catch(console.error);

// Run mongorestore to create a mongo backup file
myBackup
    .mongo()
    .then(console.log)
    .catch(console.error)

// Run bgsave to create a Redis backup file
myBackup
    .redis()
    .then(console.log)
    .catch(console.error)
```

* If you only need a specific database

```js
const Backup = require('hive-backup');
const myBackup = new Backup('your-s3-bucket-name', { mongo: '--db=your_database' });

myBackup
    .backup()
    .then(console.log)
    .catch(console.error);
```

#### new Backup(bucket, options)

> You can technically create a new backup instance with just 'new FrostBackup(options) but make sure you specify 'options.aws.params.Bucket' if you do

If no bucket name is provided it will throw an error

#### Backup.backup(tasks)

Returns a Promise that resolves with the S3 upload response or rejects with an Error.

The tasks argument is an optional array that defaults to ['mongo', 'redis'];

By defaults, this method runs `FrostBackup.mongo()`, `FrostBackup.redis()`, and for each one it then runs `FrostBackup.tar()` and `FrostBackup.upload()`

#### Backup.mongo()

Return a Promise that resolves with the file path to the MongoDB backup, or it rejects with an Error

#### Backup.redis()

Returns a Promise that resolves with the file path to the Redis backup or rejects with an Error object

#### Backup.upload(directory, filePath)

Returns a Promise that resolves with an s3 upload response or rejects with an Error

This method is used by `Backup.backup()` It will automatically remove the 'directory' arguments from the file-system

... more soon!
