# TypeORM Simple History

<img src="https://cdn-icons-png.flaticon.com/512/1014/1014670.png" height="90" width="90">

## Description

Plug and play TypeORM entity history tracking.

<br />

## Install

```bash
npm install typeorm-simple-history
```

If you use Typescript enable `experimentalDecorators` flag inside your tsconfig file, otherwise for babel use one of the following plugins [babel-plugin-transform-decorators-legacy](https://github.com/loganfsmyth/babel-plugin-transform-decorators-legacy) or [@babel/plugin-proposal-decorators](https://github.com/babel/babel/tree/master/packages/babel-plugin-proposal-decorators).

<br />

## Usage

As early as possible in your application, import and setup history module.

```ts
import { getRepository } from 'typeorm';
import { setup } from 'typeorm-simple-history';

// Run setup as early as possible
setup({ getRepository });
```

Register entity for tracking either by using `@TrackHistory` decorator or by calling `trackHistory` method.
<br/>
Now every time decorated entity updates library will automatically save model differences in the database.

```ts
import { Entity, PrimaryGeneratedColumn, Column, BeforeUpdate } from 'typeorm';
import { TrackHistory, trackHistory } from 'typeorm-simple-history';

@TrackHistory()
@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;
}

// Or `trackEntityHistory` method instead of @TrackHistory decorator
trackHistory(User);
```

Register history entities and subscribers in TypeORM connection:

```ts
import { ConnectionOptions } from 'typeorm';
import { getEntities, getSubscribers } from 'typeorm-simple-history';

export const options: ConnectionOptions = {
  // ...
  entities: [Foo, Bar, ...getEntities()],
  subscribers: [FooSubscriber, ...getSubscribers()],
};
```

When accessing `historyRepository` use one of following methods:

```ts
import { getRepository } from 'typeorm';
import { getHistoryRepository, History } from 'typeorm-simple-history';

// Get history repository by using `getHistoryRepository`

const historyRepository = getHistoryRepository(User); // or
const historyRepository = getHistoryRepository<User>('user'); // or
const historyRepository = getHistoryRepository('user'); // Without TS support

// or with TypeORM's `getRepository`

const historyRepository = getRepository<History<User>>('user_history'); // or
const historyRepository = getRepository('user_history'); // Without TS support
```

<br/>

### Minimal example:

```ts
import { getRepository } from 'typeorm';
import { getHistoryRepository } from 'typeorm-simple-history';

try {
  const historyRepository = getHistoryRepository(User);
  const userHistory = await historyRepository.find({ where: { origin: req.params.id } });

  return userHistory;
} catch (err) {
  // ...
}
```

Response:

```json
[
  {
    "id": 1,
    "diff": {
      "firstName": "Peter"
    },
    "historyDetails": null,
    "createdAt": "2022-04-29T14:35:05.645Z"
  },
  {
    "id": 2,
    "diff": {
      "firstName": "John",
      "lastName": "Stanbridge"
    },
    "historyDetails": null,
    "createdAt": "2022-04-29T14:35:19.633Z"
  },
  {
    "id": 3,
    "diff": {
      "lastName": "Wong"
    },
    "historyDetails": null,
    "createdAt": "2022-04-29T14:35:28.282Z"
  }
]
```

<br/>

### Example with provided hydrate utility:

```ts
import { getRepository } from 'typeorm';
import { getHistoryRepository, hydrate } from 'typeorm-simple-history';

try {
  const repository = getRepository(User);
  const historyRepository = getHistoryRepository(User);

  const user = await repository.findOne(req.params.id);
  const userHistory = await historyRepository.find({ where: { origin: user } });

  const response = hydrate(user, userHistory);
  return response;
} catch (err) {
  // ...
}
```

Response:

```json
[
  {
    "originId": 1,
    "id": 1,
    "firstName": "Peter",
    "lastName": "Virtue",
    "historyDetails": null,
    "createdAt": "2022-04-29T14:35:05.645Z"
  },
  {
    "originId": 1,
    "id": 2,
    "firstName": "John",
    "lastName": "Stanbridge",
    "historyDetails": null,
    "createdAt": "2022-04-29T14:35:19.633Z"
  },
  {
    "originId": 1,
    "id": 33,
    "firstName": "John",
    "lastName": "Wong",
    "historyDetails": null,
    "createdAt": "2022-04-29T14:35:28.282Z"
  }
]
```

<br/>

### Example with additional properties:

```ts
import { getRepository } from 'typeorm';
import { cloneDeep, omit } from 'lodash';

// Library also supports additional JSON property `historyDetails` inside history entry.
// It can be used for storing interesting things like editor info.
// In order to store data to this property pass additional `historyDetails` object inside `data` parameter.

try {
  const repository = getRepository(User);
  const user = await this.repository.findOne(req.params.id);

  const data = omit<User, 'id'>(req.body, 'id');
  const newEntity = Object.assign(cloneDeep(user, data);
  await this.repository.save(newEntity, { data: { historyDetails: { editor: 'John Doe' } } });

  return true;
} catch (err) {
  // ...
}
```

Hydrated response would look like this:

```json
[
  {
    "originId": 1,
    "id": 1,
    "firstName": "Peter",
    "lastName": "Virtue",
    "historyDetails": {
      "editor": "John Doe"
    },
    "createdAt": "2022-04-29T14:35:05.645Z"
  }
  // ...
]
```

<br/>

## Caveats

Library is currently only supporting relational databases.
