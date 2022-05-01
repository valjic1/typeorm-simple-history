import { diff as deepDiff } from 'deep-object-diff';
import {
  Column,
  CreateDateColumn,
  Entity,
  EntitySubscriberInterface,
  EntityTarget,
  EventSubscriber,
  ManyToOne,
  PrimaryGeneratedColumn,
  Repository,
  UpdateEvent,
} from 'typeorm';

const isEmptyObj = (passedObj: any) =>
  !(passedObj && passedObj === Object(passedObj) && Object.keys(passedObj).length !== 0);

type Constructor<E> = new (...args: any[]) => E;

type GetRepository = <Entity>(
  entityClass: EntityTarget<Entity>,
  connectionName?: string | undefined,
) => Repository<Entity>;

type Entry = {
  name: string;
  entity: Function;
  subscriber: Function;
};

type Config = {
  getRepository: GetRepository;
};

export type History<E> = {
  id: number;
  origin: E;
  diff: Partial<E>;
  historyDetails?: Object;
  createdAt: Date;
};

/**
 * @name HistoryModule
 */
abstract class HistoryModule {
  private static entries: Entry[] = [];
  private static config: Config;

  public static setup(config: Config) {
    HistoryModule.config = config;
  }

  public static getEntities() {
    return HistoryModule.entries.map((e) => e.entity);
  }

  public static getSubscribers() {
    return HistoryModule.entries.map((e) => e.subscriber);
  }

  /**
   * @description
   * Create history entity and subscriber for provided entity
   */
  private static createHistoryEntityAndSubscriber = <E extends { id: number }>(
    entityClass: Constructor<E>,
  ) => {
    const entityName = entityClass.name.toLocaleLowerCase();
    const historyEntityName = `${entityName}_history`;

    @Entity({ name: historyEntityName })
    class MyHistoryEntity {
      @PrimaryGeneratedColumn() id: number;
      @ManyToOne(entityClass.name, 'id') origin: E;
      @Column('simple-json') diff: Partial<E>;
      @Column('simple-json', { default: null }) historyDetails?: Object;
      @CreateDateColumn() createdAt: Date;
    }

    @EventSubscriber()
    class MyEntitySubscriber implements EntitySubscriberInterface<E> {
      listenTo() {
        return entityClass;
      }

      async beforeUpdate(event: UpdateEvent<E>) {
        event.queryRunner.data;
        const newEntity = event.entity || {};
        const oldEntity = event.databaseEntity || {};
        const { historyDetails } = event.queryRunner.data;
        const diff = deepDiff(newEntity, oldEntity);
        if (!isEmptyObj(diff)) {
          const historyRepository = HistoryModule.config.getRepository(historyEntityName);
          const data = historyRepository.create({ origin: oldEntity.id, diff, historyDetails });
          await historyRepository.save(data);
        }
      }
    }

    return {
      name: entityName,
      entity: MyHistoryEntity,
      subscriber: MyEntitySubscriber,
    };
  };

  /**
   * @description
   * EntityHistory decorator
   *
   */
  static TrackHistory() {
    return function (target: any) {
      const entry = HistoryModule.createHistoryEntityAndSubscriber(target);
      HistoryModule.entries.push(entry);
      return target;
    };
  }

  /**
   * @description
   * Register entity for tracking
   */
  static trackHistory = <E extends { id: number }>(MyEntity: Constructor<E>) => {
    const entry = HistoryModule.createHistoryEntityAndSubscriber(MyEntity);
    HistoryModule.entries.push(entry);
  };

  /**
   * @description
   * Get history repository for provided entity
   */
  static getHistoryRepository<E>(entityClass: string | EntityTarget<E>) {
    const entityName = (typeof entityClass === 'function' ? entityClass.name : entityClass)
      .toString()
      .toLocaleLowerCase();

    const entity = HistoryModule.entries.find((e) => e.name === entityName)?.entity;

    if (!entity) {
      throw new Error('Provided entity is not registered for history tracking');
    }

    return HistoryModule.config.getRepository<History<E>>(entity);
  }

  /**
   * @description
   * Create full history from current element and diffs array
   */
  static hydrate = <T extends { id: number }>(current: T, history: History<T>[]) => {
    let pivot = Object.assign({ originId: current.id }, current) as T;
    return history.map(({ id, diff, historyDetails, createdAt }) => {
      pivot = { ...pivot, ...diff, id, historyDetails, createdAt } as T;
      return pivot;
    });
  };
}

/**
 * Export
 */
export const {
  TrackHistory,
  trackHistory,
  setup,
  getEntities,
  getSubscribers,
  getHistoryRepository,
  hydrate,
} = HistoryModule;
